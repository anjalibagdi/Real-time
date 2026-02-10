import { memo, useEffect, useRef } from 'react';
import { FixedSizeList as List } from 'react-window';
import './VirtualizedList.css';

/**
 * Virtualized List Component
 * Efficiently renders large lists using react-window
 * 
 * Features:
 * - Only renders visible items
 * - Memoized row renderer
 * - Smooth scrolling
 * - Auto-scroll to latest option
 */

// Memoized row component to prevent unnecessary re-renders
const Row = memo(({ data, index, style }) => {
    const record = data.records[index];

    if (!record) return null;

    const categoryColors = {
        sensor: '#3b82f6',
        metric: '#10b981',
        event: '#f59e0b',
        alert: '#ef4444',
        system: '#8b5cf6'
    };

    const color = categoryColors[record.category] || '#6b7280';
    const timestamp = new Date(record.timestamp).toLocaleTimeString();

    return (
        <div style={style} className="list-row">
            <div className="list-row-content">
                <div className="row-index">#{data.total - index}</div>
                <div className="row-timestamp">{timestamp}</div>
                <div
                    className="row-category"
                    style={{ backgroundColor: color }}
                >
                    {record.category}
                </div>
                <div className="row-value">{record.value.toFixed(2)}</div>
                {record.metadata?.source && (
                    <div className="row-source">{record.metadata.source}</div>
                )}
            </div>
        </div>
    );
});

Row.displayName = 'Row';

function VirtualizedList({ records, height = 600, autoScroll = false }) {
    const listRef = useRef(null);

    // Auto-scroll to bottom when new records arrive
    useEffect(() => {
        if (autoScroll && listRef.current && records.length > 0) {
            listRef.current.scrollToItem(records.length - 1, 'end');
        }
    }, [records.length, autoScroll]);

    if (records.length === 0) {
        return (
            <div className="empty-state">
                <div className="empty-icon">📊</div>
                <h3>No Data Yet</h3>
                <p>Waiting for data stream to start...</p>
            </div>
        );
    }

    return (
        <div className="virtualized-list-container">
            <div className="list-header">
                <div className="header-item">#</div>
                <div className="header-item">Time</div>
                <div className="header-item">Category</div>
                <div className="header-item">Value</div>
                <div className="header-item">Source</div>
            </div>
            <List
                ref={listRef}
                height={height}
                itemCount={records.length}
                itemSize={60}
                width="100%"
                itemData={{ records, total: records.length }}
                className="virtual-list"
            >
                {Row}
            </List>
            <div className="list-footer">
                Showing {records.length.toLocaleString()} records
            </div>
        </div>
    );
}

export default memo(VirtualizedList);
