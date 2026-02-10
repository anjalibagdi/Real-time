import React, { useCallback } from 'react';
import Dashboard from './components/Dashboard';
import { useWebSocket } from './hooks/useWebSocket';
import { useDataBuffer } from './hooks/useDataBuffer';
import './App.css';

/**
 * Main Application Component
 * Orchestrates WebSocket connection and data management
 */

function App() {
  const {
    records,
    total,
    stats,
    recordsPerSecond,
    filter,
    addRecords,
    updateStats,
    clearData,
    setFilter
  } = useDataBuffer();

  // Handle WebSocket messages
  const handleMessage = useCallback((data) => {
    switch (data.type) {
      case 'batch':
        // Add batch of records
        addRecords(data.data);
        break;

      case 'stats':
        // Update statistics
        updateStats(data.data);
        break;

      case 'connected':
        console.log('✅', data.message);
        break;

      default:
        console.log('Received message:', data);
    }
  }, [addRecords, updateStats]);

  const { isConnected, connectionStatus } = useWebSocket(handleMessage);

  return (
    <div className="app">
      {/* Connection Status Banner */}
      {!isConnected && (
        <div className={`connection-banner ${connectionStatus}`}>
          {connectionStatus === 'connecting' && '🔄 Connecting to server...'}
          {connectionStatus === 'reconnecting' && '🔄 Reconnecting...'}
          {connectionStatus === 'disconnected' && '⚠️ Disconnected from server'}
          {connectionStatus === 'failed' && '❌ Connection failed'}
          {connectionStatus === 'error' && '❌ Connection error'}
        </div>
      )}

      {/* Main Dashboard */}
      <Dashboard
        records={records}
        stats={stats}
        totalRecords={total}
        recordsPerSecond={recordsPerSecond}
        isConnected={isConnected}
        onClearData={clearData}
        filter={filter}
        onFilterChange={setFilter}
      />
    </div>
  );
}

export default App;
