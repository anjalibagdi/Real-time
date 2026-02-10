const DataRecord = require('../models/dataRecord');

/**
 * High-Frequency Data Generator Service
 * Simulates real-time data stream for demonstration
 * 
 * Features:
 * - Configurable generation rate
 * - Batch database inserts for performance
 * - WebSocket broadcasting
 * - Realistic data patterns
 */

class DataGenerator {
    constructor(options = {}) {
        this.rate = options.rate || 50; // Records per second
        this.batchSize = options.batchSize || 10;
        this.isRunning = false;
        this.interval = null;
        this.buffer = [];
        this.totalGenerated = 0;
        this.wsClients = new Set();
        this.categories = ['sensor', 'metric', 'event', 'alert', 'system'];
    }

    /**
     * Generate a single realistic data record
     */
    generateRecord() {
        const category = this.categories[Math.floor(Math.random() * this.categories.length)];

        // Generate realistic values based on category
        let value;
        switch (category) {
            case 'sensor':
                value = 20 + Math.random() * 60; // Temperature-like: 20-80
                break;
            case 'metric':
                value = Math.random() * 1000; // Generic metric: 0-1000
                break;
            case 'event':
                value = Math.floor(Math.random() * 100); // Event count: 0-100
                break;
            case 'alert':
                value = Math.random() * 10; // Alert severity: 0-10
                break;
            case 'system':
                value = 50 + Math.random() * 50; // CPU/Memory: 50-100
                break;
            default:
                value = Math.random() * 100;
        }

        return {
            timestamp: new Date(),
            value: Math.round(value * 100) / 100, // Round to 2 decimals
            category,
            metadata: {
                source: `generator-${Math.floor(Math.random() * 5)}`,
                batch: Math.floor(this.totalGenerated / this.batchSize)
            }
        };
    }

    /**
     * Add WebSocket client for broadcasting
     */
    addClient(ws) {
        this.wsClients.add(ws);
        console.log(`📡 WebSocket client connected. Total clients: ${this.wsClients.size}`);

        // Send current stats to new client
        this.sendStatsToClient(ws);
    }

    /**
     * Remove WebSocket client
     */
    removeClient(ws) {
        this.wsClients.delete(ws);
        console.log(`📡 WebSocket client disconnected. Total clients: ${this.wsClients.size}`);
    }

    /**
     * Broadcast data to all connected WebSocket clients
     */
    broadcast(data) {
        const message = JSON.stringify(data);

        this.wsClients.forEach(client => {
            if (client.readyState === 1) { // WebSocket.OPEN
                try {
                    client.send(message);
                } catch (error) {
                    console.error('Error broadcasting to client:', error.message);
                    this.wsClients.delete(client);
                }
            }
        });
    }

    /**
     * Send stats to specific client
     */
    async sendStatsToClient(ws) {
        try {
            const stats = await DataRecord.getStats();
            ws.send(JSON.stringify({
                type: 'stats',
                data: stats
            }));
        } catch (error) {
            console.error('Error sending stats:', error.message);
        }
    }

    /**
     * Process buffer: save to database and broadcast
     */
    async processBuffer() {
        if (this.buffer.length === 0) return;

        const records = [...this.buffer];
        this.buffer = [];

        try {
            // Batch insert to database
            await DataRecord.createBatch(records);

            console.log('Batch processed:', records);

            // Broadcast to WebSocket clients
            this.broadcast({
                type: 'batch',
                data: records,
                total: this.totalGenerated
            });

        } catch (error) {
            console.error('Error processing buffer:', error.message);
        }
    }

    /**
     * Start generating data
     */
    start() {
        if (this.isRunning) {
            console.log('⚠️  Data generator is already running');
            return;
        }

        this.isRunning = true;
        const intervalMs = 1000 / this.rate; // Calculate interval for desired rate

        console.log(`🚀 Data generator started: ${this.rate} records/sec, batch size: ${this.batchSize}`);

        this.interval = setInterval(() => {
            const record = this.generateRecord();
            this.buffer.push(record);
            this.totalGenerated++;

            // Process buffer when it reaches batch size
            if (this.buffer.length >= this.batchSize) {
                this.processBuffer();
            }
        }, intervalMs);
    }

    /**
     * Stop generating data
     */
    async stop() {
        if (!this.isRunning) {
            console.log('⚠️  Data generator is not running');
            return;
        }

        this.isRunning = false;

        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }

        // Process remaining buffer
        if (this.buffer.length > 0) {
            await this.processBuffer();
        }

        console.log(`🛑 Data generator stopped. Total generated: ${this.totalGenerated}`);
    }

    /**
     * Get current status
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            rate: this.rate,
            batchSize: this.batchSize,
            totalGenerated: this.totalGenerated,
            bufferSize: this.buffer.length,
            connectedClients: this.wsClients.size
        };
    }

    /**
     * Update generation rate
     */
    setRate(newRate) {
        const wasRunning = this.isRunning;

        if (wasRunning) {
            this.stop();
        }

        this.rate = newRate;

        if (wasRunning) {
            this.start();
        }

        console.log(`⚙️  Generation rate updated to ${newRate} records/sec`);
    }
}

module.exports = DataGenerator;
