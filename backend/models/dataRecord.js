const mongoose = require('mongoose');

/**
 * Data Record Schema
 * Optimized for high-frequency inserts and time-based queries
 */

const dataRecordSchema = new mongoose.Schema({
    timestamp: {
        type: Date,
        default: Date.now,
        index: true,  // Index for efficient time-based queries
        required: true
    },
    value: {
        type: Number,
        required: true,
        min: 0,
        max: 10000
    },
    category: {
        type: String,
        required: true,
        enum: ['sensor', 'metric', 'event', 'alert', 'system'],
        index: true  // Index for category filtering
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    status: {
        type: String,
        enum: ['active', 'processed', 'archived'],
        default: 'active'
    }
}, {
    timestamps: true,  // Auto-manage createdAt and updatedAt
    collection: 'data_records'
});

// Compound index for common query patterns (category + recent timestamp)
dataRecordSchema.index({ category: 1, timestamp: -1 });

// Index for status-based queries
dataRecordSchema.index({ status: 1, createdAt: -1 });

// TTL index to auto-delete old records after 30 days (2592000 seconds)
// Comment out if you want to keep all data
dataRecordSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 });

// Static methods for batch operations
dataRecordSchema.statics.createBatch = async function (records) {
    try {
        return await this.insertMany(records, { ordered: false });
    } catch (error) {
        console.error('Batch insert error:', error.message);
        throw error;
    }
};

// Static method to get recent records with pagination
dataRecordSchema.statics.getRecent = async function (limit = 100, skip = 0, category = null) {
    const query = category ? { category } : {};
    return await this.find(query)
        .sort({ timestamp: -1 })
        .limit(limit)
        .skip(skip)
        .lean();  // Return plain objects for better performance
};

// Static method to get statistics
dataRecordSchema.statics.getStats = async function () {
    const now = new Date();
    const oneHourAgo = new Date(now - 3600000);

    const [total, recentCount, categoryStats] = await Promise.all([
        this.countDocuments(),
        this.countDocuments({ timestamp: { $gte: oneHourAgo } }),
        this.aggregate([
            {
                $group: {
                    _id: '$category',
                    count: { $sum: 1 },
                    avgValue: { $avg: '$value' }
                }
            }
        ])
    ]);

    return {
        total,
        recentCount,
        categoryStats,
        timestamp: now
    };
};

const DataRecord = mongoose.model('DataRecord', dataRecordSchema);

module.exports = DataRecord;
