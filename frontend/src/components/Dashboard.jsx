import { useState, useCallback, useEffect } from 'react';
import VirtualizedList from './VirtualizedList';
import StatsPanel from './StatsPanel';
import './Dashboard.css';

/**
 * Main Dashboard Component
 * Orchestrates all UI components and controls
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

function Dashboard({
    records,
    stats,
    totalRecords,
    recordsPerSecond,
    isConnected,
    onClearData,
    filter,
    onFilterChange
}) {
    const [autoScroll, setAutoScroll] = useState(true);
    const [generatorStatus, setGeneratorStatus] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    // Control data generator
    const controlGenerator = useCallback(async (action) => {
        setIsLoading(true);
        try {
            const response = await fetch(`${API_URL}/generator/${action}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            const data = await response.json();
            if (data.success) {
                setGeneratorStatus(data.status);
            }
        } catch (error) {
            console.error(`Error ${action} generator:`, error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Get generator status
    const fetchGeneratorStatus = useCallback(async () => {
        try {
            const response = await fetch(`${API_URL}/generator/status`);
            const data = await response.json();
            if (data.success) {
                setGeneratorStatus(data.data);
            }
        } catch (error) {
            console.error('Error fetching generator status:', error);
        }
    }, []);

    // Fetch status on mount
    useEffect(() => {
        fetchGeneratorStatus();
        const interval = setInterval(fetchGeneratorStatus, 5000);
        return () => clearInterval(interval);
    }, [fetchGeneratorStatus]);

    const categories = ['sensor', 'metric', 'event', 'alert', 'system'];

    return (
        <div className="dashboard">
            {/* Header */}
            <header className="dashboard-header">
                <div className="header-content">
                    <h1>⚡ Real-Time Data Processor</h1>
                    <p>High-Performance Monitoring Dashboard</p>
                </div>
            </header>

            {/* Stats Panel */}
            <StatsPanel
                stats={stats}
                recordsPerSecond={recordsPerSecond}
                totalRecords={totalRecords}
                isConnected={isConnected}
            />

            {/* Controls */}
            <div className="controls-panel">
                <div className="control-group">
                    <h3>🎛️ Data Generator</h3>
                    <div className="button-group">
                        <button
                            onClick={() => controlGenerator('start')}
                            disabled={isLoading || generatorStatus?.isRunning}
                            className="btn btn-success"
                        >
                            ▶️ Start
                        </button>
                        <button
                            onClick={() => controlGenerator('stop')}
                            disabled={isLoading || !generatorStatus?.isRunning}
                            className="btn btn-danger"
                        >
                            ⏸️ Stop
                        </button>
                        <div className="status-indicator">
                            <span className={`status-dot ${generatorStatus?.isRunning ? 'active' : ''}`} />
                            {generatorStatus?.isRunning ? 'Running' : 'Stopped'}
                        </div>
                    </div>
                </div>



                <div className="control-group">
                    <h3>🔍 Filter</h3>
                    <div className="button-group">
                        <button
                            onClick={() => onFilterChange(null)}
                            className={`btn ${!filter ? 'btn-active' : ''}`}
                        >
                            All
                        </button>
                        {categories.map(cat => (
                            <button
                                key={cat}
                                onClick={() => onFilterChange(cat)}
                                className={`btn ${filter === cat ? 'btn-active' : ''}`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>


                <div className="control-group">
                    <h3>🔍 Filter</h3>
                    <div className="button-group">
                        <button
                            onClick={() => onFilterChange(null)}
                            className={`btn ${!filter ? 'btn-active' : ''}`}
                        >
                            All
                        </button>
                        {categories.map(cat => (
                            <button
                                key={cat}
                                onClick={() => onFilterChange(cat)}
                                className={`btn ${filter === cat ? 'btn-active' : ''}`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="control-group">
                    <h3>⚙️ Options</h3>
                    <div className="button-group">
                        <button
                            onClick={() => setAutoScroll(!autoScroll)}
                            className={`btn ${autoScroll ? 'btn-active' : ''}`}
                        >
                            {autoScroll ? '📌' : '📍'} Auto-scroll
                        </button>
                        <button
                            onClick={onClearData}
                            className="btn btn-warning"
                        >
                            🗑️ Clear Data
                        </button>
                    </div>
                </div>
            </div>

            {/* Data List */}
            <div className="data-section">
                <div className="section-header">
                    <h2>📊 Live Data Stream</h2>
                    <div className="record-count">
                        {records.length.toLocaleString()} / {totalRecords.toLocaleString()} records
                    </div>
                </div>
                <VirtualizedList
                    records={records}
                    height={600}
                    autoScroll={autoScroll}
                />
            </div>
        </div>
    );
}

export default Dashboard;
