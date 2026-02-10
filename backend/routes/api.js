const express = require('express');
const router = express.Router();
const DataRecord = require('../models/dataRecord');
const { createValidator } = require('../middleware/requestValidator');
const { asyncHandler, APIError } = require('../middleware/errorHandler');

/**
 * GET /api/records
 * Fetch paginated records with optional filtering
 */
router.get('/records',
    createValidator('getRecords'),
    asyncHandler(async (req, res) => {
        const { limit, skip, category } = req.validated;

        const records = await DataRecord.getRecent(limit, skip, category);
        const total = await DataRecord.countDocuments(category ? { category } : {});

        res.json({
            success: true,
            data: records,
            pagination: {
                total,
                limit,
                skip,
                hasMore: skip + records.length < total
            }
        });
    })
);

/**
 * POST /api/records
 * Create a new record
 */
router.post('/records',
    createValidator('createRecord'),
    asyncHandler(async (req, res) => {
        const recordData = {
            ...req.validated,
            timestamp: new Date()
        };

        const record = await DataRecord.create(recordData);

        res.status(201).json({
            success: true,
            data: record
        });
    })
);

/**
 * GET /api/stats
 * Get system statistics
 */
router.get('/stats',
    asyncHandler(async (req, res) => {
        const stats = await DataRecord.getStats();

        res.json({
            success: true,
            data: stats
        });
    })
);

/**
 * DELETE /api/records/:id
 * Delete a specific record
 */
router.delete('/records/:id',
    asyncHandler(async (req, res) => {
        const { id } = req.params;

        const record = await DataRecord.findByIdAndDelete(id);

        if (!record) {
            throw new APIError('Record not found', 404);
        }

        res.json({
            success: true,
            message: 'Record deleted successfully',
            data: record
        });
    })
);

/**
 * DELETE /api/records
 * Delete all records (for testing purposes)
 */
router.delete('/records',
    asyncHandler(async (req, res) => {
        const result = await DataRecord.deleteMany({});

        res.json({
            success: true,
            message: `Deleted ${result.deletedCount} records`
        });
    })
);

/**
 * GET /api/health
 * Health check endpoint
 */
router.get('/health', (req, res) => {
    res.json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

module.exports = router;
