import { useReducer, useCallback, useRef, useEffect } from 'react';

/**
 * Custom Data Buffer Hook
 * Optimized state management for high-frequency updates
 * 
 * Features:
 * - Circular buffer to limit memory usage
 * - Batch updates to minimize re-renders
 * - Performance metrics tracking
 */

const MAX_BUFFER_SIZE = 5000;
const BATCH_UPDATE_INTERVAL = 100; // ms

// Reducer for complex state management
function dataBufferReducer(state, action) {
    switch (action.type) {
        case 'ADD_BATCH': {
            const newRecords = action.payload;
            const combined = [...state.records, ...newRecords];

            // Keep only the most recent MAX_BUFFER_SIZE records
            const records = combined.length > MAX_BUFFER_SIZE
                ? combined.slice(-MAX_BUFFER_SIZE)
                : combined;

            return {
                ...state,
                records,
                total: state.total + newRecords.length,
                lastUpdate: Date.now()
            };
        }

        case 'UPDATE_STATS': {
            return {
                ...state,
                stats: action.payload
            };
        }

        case 'CLEAR': {
            return {
                records: [],
                total: 0,
                stats: null,
                lastUpdate: Date.now()
            };
        }

        case 'SET_FILTER': {
            return {
                ...state,
                filter: action.payload
            };
        }

        default:
            return state;
    }
}

const initialState = {
    records: [],
    total: 0,
    stats: null,
    lastUpdate: Date.now(),
    filter: null
};

export function useDataBuffer() {
    const [state, dispatch] = useReducer(dataBufferReducer, initialState);
    const pendingBatchRef = useRef([]);
    const batchTimeoutRef = useRef(null);
    const metricsRef = useRef({
        recordsPerSecond: 0,
        lastRecordCount: 0,
        lastMeasureTime: Date.now()
    });

    // Batch add records to minimize re-renders
    const addRecords = useCallback((records) => {
        const recordsArray = Array.isArray(records) ? records : [records];
        pendingBatchRef.current.push(...recordsArray);

        // Clear existing timeout
        if (batchTimeoutRef.current) {
            clearTimeout(batchTimeoutRef.current);
        }

        // Schedule batch update
        batchTimeoutRef.current = setTimeout(() => {
            if (pendingBatchRef.current.length > 0) {
                dispatch({
                    type: 'ADD_BATCH',
                    payload: pendingBatchRef.current
                });
                pendingBatchRef.current = [];
            }
        }, BATCH_UPDATE_INTERVAL);
    }, []);

    // Update statistics
    const updateStats = useCallback((stats) => {
        dispatch({
            type: 'UPDATE_STATS',
            payload: stats
        });
    }, []);

    // Clear all data
    const clearData = useCallback(() => {
        pendingBatchRef.current = [];
        if (batchTimeoutRef.current) {
            clearTimeout(batchTimeoutRef.current);
        }
        dispatch({ type: 'CLEAR' });
    }, []);

    // Set filter
    const setFilter = useCallback((filter) => {
        dispatch({
            type: 'SET_FILTER',
            payload: filter
        });
    }, []);

    // Calculate performance metrics
    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now();
            const timeDiff = (now - metricsRef.current.lastMeasureTime) / 1000; // seconds
            const recordDiff = state.total - metricsRef.current.lastRecordCount;

            metricsRef.current.recordsPerSecond = Math.round(recordDiff / timeDiff);
            metricsRef.current.lastRecordCount = state.total;
            metricsRef.current.lastMeasureTime = now;
        }, 1000);

        return () => clearInterval(interval);
    }, [state.total]);

    // Get filtered records
    const filteredRecords = state.filter
        ? state.records.filter(record => record.category === state.filter)
        : state.records;

    return {
        records: filteredRecords,
        allRecords: state.records,
        total: state.total,
        stats: state.stats,
        filter: state.filter,
        recordsPerSecond: metricsRef.current.recordsPerSecond,
        addRecords,
        updateStats,
        clearData,
        setFilter
    };
}
