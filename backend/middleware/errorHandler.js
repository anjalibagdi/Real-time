/**
 * Centralized Error Handling Middleware
 * Provides consistent error responses and logging
 */

/**
 * Custom error class for API errors
 */
class APIError extends Error {
    constructor(message, statusCode = 500, details = null) {
        super(message);
        this.name = 'APIError';
        this.statusCode = statusCode;
        this.details = details;
    }
}

/**
 * Log error with timestamp and details
 */
function logError(error, req) {
    const timestamp = new Date().toISOString();
    const method = req.method;
    const url = req.originalUrl;
    const ip = req.ip || req.connection.remoteAddress;

    console.error('\n' + '='.repeat(80));
    console.error(`[${timestamp}] ERROR`);
    console.error(`Request: ${method} ${url}`);
    console.error(`IP: ${ip}`);
    console.error(`Error: ${error.name} - ${error.message}`);

    if (error.stack && process.env.NODE_ENV === 'development') {
        console.error('Stack trace:', error.stack);
    }

    if (error.details) {
        console.error('Details:', JSON.stringify(error.details, null, 2));
    }

    console.error('='.repeat(80) + '\n');
}

/**
 * Error handler middleware
 */
function errorHandler(err, req, res, next) {
    // Log the error
    logError(err, req);

    // Default error response
    let statusCode = err.statusCode || 500;
    let message = err.message || 'Internal Server Error';
    let details = err.details || null;

    // Handle specific error types
    if (err.name === 'ValidationError') {
        statusCode = 400;
        message = 'Validation Error';
        details = err.errors;
    } else if (err.name === 'CastError') {
        statusCode = 400;
        message = 'Invalid ID format';
    } else if (err.name === 'MongoServerError' && err.code === 11000) {
        statusCode = 409;
        message = 'Duplicate entry';
        details = err.keyValue;
    } else if (err.name === 'UnauthorizedError') {
        statusCode = 401;
        message = 'Unauthorized';
    } else if (err.name === 'ForbiddenError') {
        statusCode = 403;
        message = 'Forbidden';
    }

    // Build error response
    const errorResponse = {
        error: err.name || 'Error',
        message,
        timestamp: new Date().toISOString()
    };

    // Include details if available
    if (details) {
        errorResponse.details = details;
    }

    // Include stack trace in development mode
    if (process.env.NODE_ENV === 'development' && err.stack) {
        errorResponse.stack = err.stack;
    }

    // Send error response
    res.status(statusCode).json(errorResponse);
}

/**
 * 404 Not Found handler
 */
function notFoundHandler(req, res) {
    res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.originalUrl} not found`,
        timestamp: new Date().toISOString()
    });
}

function notHandler(req, res) {
    res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.originalUrl} not found`,
        timestamp: new Date().toISOString()
    });
}

/**
 * Async handler wrapper to catch errors in async route handlers
 */
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

module.exports = {
    errorHandler,
    notFoundHandler,
    asyncHandler,
    APIError
};
