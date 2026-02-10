import { memo, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import './StatsPanel.css';

/**
 * Stats Panel Component
 * Displays real-time metrics and statistics
 */

function StatsPanel({ stats, recordsPerSecond, totalRecords, isConnected }) {
    // Prepare chart data from category stats
    const chartData = useMemo(() => {
        if (!stats?.categoryStats) return [];

        return stats.categoryStats.map(cat => ({
            name: cat._id,
            count: cat.count,
            avgValue: cat.avgValue?.toFixed(2) || 0
        }));
    }, [stats]);

    const categoryColors = {
        sensor: '#3b82f6',
        metric: '#10b981',
        event: '#f59e0b',
        alert: '#ef4444',
        system: '#8b5cf6'
    };

    return (
        <div className="stats-panel">
            <div className="stats-grid">
                {/* Connection Status */}
                <div className="stat-card">
                    <div className="stat-icon">
                        {isConnected ? '🟢' : '🔴'}
                    </div>
                    <div className="stat-content">
                        <div className="stat-label">Connection</div>
                        <div className="stat-value">
                            {isConnected ? 'Connected' : 'Disconnected'}
                        </div>
                    </div>
                </div>

                {/* Records Per Second */}
                <div className="stat-card highlight">
                    <div className="stat-icon">⚡</div>
                    <div className="stat-content">
                        <div className="stat-label">Records/sec</div>
                        <div className="stat-value animated">
                            {recordsPerSecond}
                        </div>
                    </div>
                </div>

                {/* Total Records */}
                <div className="stat-card">
                    <div className="stat-icon">📊</div>
                    <div className="stat-content">
                        <div className="stat-label">Total Records</div>
                        <div className="stat-value">
                            {totalRecords.toLocaleString()}
                        </div>
                    </div>
                </div>

                {/* Recent Records (last hour) */}
                <div className="stat-card">
                    <div className="stat-icon">🕐</div>
                    <div className="stat-content">
                        <div className="stat-label">Last Hour</div>
                        <div className="stat-value">
                            {stats?.recentCount?.toLocaleString() || 0}
                        </div>
                    </div>
                </div>
            </div>

            {/* Category Breakdown */}
            {chartData.length > 0 && (
                <div className="category-breakdown">
                    <h3>Category Distribution</h3>
                    <div className="category-list">
                        {chartData.map(cat => (
                            <div key={cat.name} className="category-item">
                                <div
                                    className="category-color"
                                    style={{ backgroundColor: categoryColors[cat.name] || '#6b7280' }}
                                />
                                <div className="category-name">{cat.name}</div>
                                <div className="category-count">{cat.count.toLocaleString()}</div>
                                <div className="category-avg">Avg: {cat.avgValue}</div>
                            </div>
                        ))}
                    </div>

                    {/* Mini Chart */}
                    <div className="mini-chart">
                        <ResponsiveContainer width="100%" height={150}>
                            <LineChart data={chartData}>
                                <XAxis dataKey="name" stroke="rgba(255,255,255,0.5)" />
                                <YAxis stroke="rgba(255,255,255,0.5)" />
                                <Tooltip
                                    contentStyle={{
                                        background: 'rgba(0,0,0,0.8)',
                                        border: '1px solid rgba(255,255,255,0.2)',
                                        borderRadius: '8px'
                                    }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="count"
                                    stroke="#3b82f6"
                                    strokeWidth={2}
                                    dot={{ fill: '#3b82f6', r: 4 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}
        </div>
    );
}

export default memo(StatsPanel);
