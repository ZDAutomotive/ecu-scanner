import { useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '@/store';
import { getSerialStatus } from '@/api/client';
import type { ScanResult } from '@/types';

// Constants for reconnection
const MAX_RECONNECT_ATTEMPTS = 5;
const INITIAL_RECONNECT_DELAY = 3000;
const MAX_RECONNECT_DELAY = 30000;

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const reconnectAttemptsRef = useRef(0);
  const { setScannerConnected, setLastScanResult, setCoverageStats } = useAppStore();

  const connect = useCallback(() => {
    // Check if max reconnect attempts reached
    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      console.warn(`WebSocket: Max reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached. Stopping reconnection.`);
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/scan`;

    try {
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = async () => {
        console.log('WebSocket connected');
        reconnectAttemptsRef.current = 0; // Reset attempts on successful connection

        // Fetch initial scanner status when WebSocket connects
        try {
          const status = await getSerialStatus();
          setScannerConnected(status.connected);
        } catch (e) {
          console.error('Failed to get serial status:', e);
        }
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // Handle scanner status updates
          if (data.type === 'scanner_status') {
            setScannerConnected(data.connected);
            return;
          }

          // Handle scan results (directly from WebSocket, not wrapped)
          const scanResult = data as ScanResult;
          setLastScanResult(scanResult);

          // Refresh coverage stats
          import('@/api/client').then(({ getCoverageStats }) => {
            getCoverageStats().then(statsData => {
              setCoverageStats(statsData);
            });
          });
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      };

      wsRef.current.onclose = () => {
        console.log('WebSocket disconnected');
        // Note: We don't change scanner status here because
        // scanner status is independent of WebSocket connection

        // Increment reconnect attempts
        reconnectAttemptsRef.current++;

        // Calculate delay with exponential backoff (capped at MAX_RECONNECT_DELAY)
        const delay = Math.min(
          INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttemptsRef.current - 1),
          MAX_RECONNECT_DELAY
        );

        console.log(`WebSocket: Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})...`);

        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
    }
  }, [setScannerConnected, setLastScanResult, setCoverageStats]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return { connect, disconnect };
}
