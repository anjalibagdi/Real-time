import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Custom WebSocket Hook
 * Manages WebSocket connection with auto-reconnect logic
 * 
 * Features:
 * - Auto-reconnect on disconnect
 * - Connection status tracking
 * - Message buffering during disconnection
 * - Heartbeat/ping mechanism
 */

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3000/ws';
const RECONNECT_DELAY = 3000;
const MAX_RECONNECT_ATTEMPTS = 10;
const HEARTBEAT_INTERVAL = 30000;

export function useWebSocket(onMessage) {
    const [isConnected, setIsConnected] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState('disconnected');
    const wsRef = useRef(null);
    const reconnectTimeoutRef = useRef(null);
    const reconnectAttemptsRef = useRef(0);
    const heartbeatIntervalRef = useRef(null);
    const messageBufferRef = useRef([]);

    const connect = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            return;
        }

        setConnectionStatus('connecting');
        console.log('🔌 Connecting to WebSocket...');

        try {
            const ws = new WebSocket(WS_URL);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log('✅ WebSocket connected');
                setIsConnected(true);
                setConnectionStatus('connected');
                reconnectAttemptsRef.current = 0;

                // Send buffered messages
                if (messageBufferRef.current.length > 0) {
                    console.log(`📤 Sending ${messageBufferRef.current.length} buffered messages`);
                    messageBufferRef.current.forEach(msg => ws.send(msg));
                    messageBufferRef.current = [];
                }

                // Start heartbeat
                heartbeatIntervalRef.current = setInterval(() => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({ type: 'ping' }));
                    }
                }, HEARTBEAT_INTERVAL);
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type !== 'pong') { // Don't log pong messages
                        onMessage?.(data);
                    }
                } catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                }
            };

            ws.onerror = (error) => {
                console.error('❌ WebSocket error:', error);
                setConnectionStatus('error');
            };

            ws.onclose = () => {
                console.log('🔌 WebSocket disconnected');
                setIsConnected(false);
                setConnectionStatus('disconnected');

                // Clear heartbeat
                if (heartbeatIntervalRef.current) {
                    clearInterval(heartbeatIntervalRef.current);
                    heartbeatIntervalRef.current = null;
                }

                // Attempt reconnect
                if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
                    reconnectAttemptsRef.current++;
                    console.log(`🔄 Reconnecting... (attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`);
                    setConnectionStatus('reconnecting');

                    reconnectTimeoutRef.current = setTimeout(() => {
                        connect();
                    }, RECONNECT_DELAY);
                } else {
                    console.error('❌ Max reconnection attempts reached');
                    setConnectionStatus('failed');
                }
            };
        } catch (error) {
            console.error('Error creating WebSocket:', error);
            setConnectionStatus('error');
        }
    }, [onMessage]);

    const disconnect = useCallback(() => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }

        if (heartbeatIntervalRef.current) {
            clearInterval(heartbeatIntervalRef.current);
            heartbeatIntervalRef.current = null;
        }

        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }

        setIsConnected(false);
        setConnectionStatus('disconnected');
    }, []);

    const sendMessage = useCallback((message) => {
        const msgString = typeof message === 'string' ? message : JSON.stringify(message);

        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(msgString);
        } else {
            // Buffer message if not connected
            console.warn('⚠️  WebSocket not connected. Buffering message...');
            messageBufferRef.current.push(msgString);
        }
    }, []);

    useEffect(() => {
        connect();

        return () => {
            disconnect();
        };
    }, [connect, disconnect]);

    return {
        isConnected,
        connectionStatus,
        sendMessage,
        reconnect: connect
    };
}
