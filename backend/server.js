require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const connectDB = require('./config/database');
const apiRoutes = require('./routes/api');
const { createRateLimiter } = require('./middleware/rateLimiter');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const DataGenerator = require('./services/dataGenerator');

/**
 * Initialize Express App
 */
const app = express();
const server = http.createServer(app);

/**
 * WebSocket Server Setup
 */
const wss = new WebSocket.Server({
    server,
    path: '/ws'
});

/**
 * Initialize Data Generator
 */
const dataGenerator = new DataGenerator({
    rate: parseInt(process.env.DATA_GENERATION_RATE) || 50,
    batchSize: parseInt(process.env.BATCH_SIZE) || 10
});

/**
 * Middleware Configuration
 */
app.use(cors({
    origin: process.env.NODE_ENV === 'production'
        ? process.env.FRONTEND_URL
        : '*',
    credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.path}`);
    next();
});

/**
 * Apply Rate Limiter to API routes
 */
const rateLimiter = createRateLimiter({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100
});

app.use('/api', rateLimiter);

/**
 * API Routes
 */
app.use('/api', apiRoutes);

/**
 * Data Generator Control Routes
 */
app.post('/api/generator/start', (req, res) => {
    dataGenerator.start();
    res.json({
        success: true,
        message: 'Data generator started',
        status: dataGenerator.getStatus()
    });
});

app.post('/api/generator/stop', async (req, res) => {
    await dataGenerator.stop();
    res.json({
        success: true,
        message: 'Data generator stopped',
        status: dataGenerator.getStatus()
    });
});

app.get('/api/generator/status', (req, res) => {
    res.json({
        success: true,
        data: dataGenerator.getStatus()
    });
});

app.post('/api/generator/rate', (req, res) => {
    const { rate } = req.body;

    if (!rate || rate < 1 || rate > 1000) {
        return res.status(400).json({
            success: false,
            error: 'Invalid rate. Must be between 1 and 1000'
        });
    }

    dataGenerator.setRate(rate);
    res.json({
        success: true,
        message: `Rate updated to ${rate} records/sec`,
        status: dataGenerator.getStatus()
    });
});

/**
 * Root Route
 */
app.get('/', (req, res) => {
    res.json({
        name: 'Real-Time Data Processor API',
        version: '1.0.0',
        status: 'running',
        endpoints: {
            api: '/api',
            websocket: '/ws',
            health: '/api/health'
        }
    });
});

/**
 * WebSocket Connection Handler
 */
wss.on('connection', (ws, req) => {
    console.log('📡 New WebSocket connection established');

    // Add client to data generator
    dataGenerator.addClient(ws);

    // Send welcome message
    ws.send(JSON.stringify({
        type: 'connected',
        message: 'Connected to Real-Time Data Processor',
        timestamp: new Date().toISOString()
    }));

    // Handle incoming messages
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log('Received WebSocket message:', data);

            // Handle different message types
            if (data.type === 'ping') {
                ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
            }
        } catch (error) {
            console.error('Error parsing WebSocket message:', error.message);
        }
    });

    // Handle client disconnect
    ws.on('close', () => {
        console.log('📡 WebSocket connection closed');
        dataGenerator.removeClient(ws);
    });

    // Handle errors
    ws.on('error', (error) => {
        console.error('WebSocket error:', error.message);
        dataGenerator.removeClient(ws);
    });
});

/**
 * Error Handling
 */
app.use(notFoundHandler);
app.use(errorHandler);

/**
 * Graceful Shutdown
 */
process.on('SIGTERM', async () => {
    console.log('\n🛑 SIGTERM received. Shutting down gracefully...');
    await shutdown();
});

process.on('SIGINT', async () => {
    console.log('\n🛑 SIGINT received. Shutting down gracefully...');
    await shutdown();
});

async function shutdown() {
    // Stop data generator
    await dataGenerator.stop();

    // Close WebSocket server
    wss.close(() => {
        console.log('✅ WebSocket server closed');
    });

    // Close HTTP server
    server.close(() => {
        console.log('✅ HTTP server closed');
        process.exit(0);
    });

    // Force exit after 10 seconds
    setTimeout(() => {
        console.error('⚠️  Forced shutdown after timeout');
        process.exit(1);
    }, 10000);
}

/**
 * Start Server
 */
const PORT = process.env.PORT || 3000;

async function startServer() {
    try {
        // Connect to MongoDB
        await connectDB();

        // Start HTTP server
        server.listen(PORT, () => {
            console.log('\n' + '='.repeat(60));
            console.log('🚀 Real-Time Data Processor Server');
            console.log('='.repeat(60));
            console.log(`📍 HTTP Server: http://localhost:${PORT}`);
            console.log(`📍 WebSocket Server: ws://localhost:${PORT}/ws`);
            console.log(`📍 API Docs: http://localhost:${PORT}/api`);
            console.log(`📍 Health Check: http://localhost:${PORT}/api/health`);
            console.log('='.repeat(60) + '\n');
        });

        // Auto-start data generator in development
        if (process.env.NODE_ENV === 'development') {
            setTimeout(() => {
                console.log('🎬 Auto-starting data generator...');
                dataGenerator.start();
            }, 2000);
        }

    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

startServer();

module.exports = { app, server, wss };
