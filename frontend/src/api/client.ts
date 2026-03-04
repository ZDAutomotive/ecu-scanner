import axios from 'axios';
import type {
  ScanRecord,
  FlashRecord,
  HardwareConfig,
  ControlDomain,
  CoverageStats,
  ScanRecordsResponse,
  FlashRecordsResponse,
  ScanResult,
  ConnectionStatus,
} from '@/types';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor to handle standardized API response format
// All backend responses are wrapped in { code: 0, data: ..., message: "Success" }
// This interceptor extracts the actual data so API calls return data directly
// If code is non-zero, it throws an error with the message
api.interceptors.response.use(
  (response) => {
    const data = response.data as { code?: number; data?: unknown; message?: string };
    // Check if response follows standard format
    if (data && typeof data === 'object' && 'code' in data && 'data' in data) {
      // If code is non-zero, throw an error
      if (data.code !== 0) {
        const error = new Error(data.message || 'Request failed');
        (error as { code?: number }).code = data.code;
        throw error;
      }
      // Return the inner data directly
      return data.data;
    }
    return response.data;
  },
  (error) => {
    if (error.response) {
      console.error('API Error:', error.response.status, error.response.data);
    } else if (error.request) {
      console.error('Network Error: No response from server');
    } else {
      console.error('Request Error:', error.message);
    }
    return Promise.reject(error);
  }
);

// Helper to cast API response to data type
const unwrap = <T>(promise: Promise<unknown>): Promise<T> =>
  promise as Promise<T>;

// Serial port APIs - now with standardized format via interceptor
export const getSerialStatus = () =>
  unwrap<ConnectionStatus>(api.get('/serial/status'));

export const connectSerial = () =>
  unwrap<{ success: boolean; message: string }>(api.post('/serial/connect'));

export const disconnectSerial = () =>
  unwrap<{ success: boolean; message: string }>(api.post('/serial/disconnect'));

// API endpoints

export const healthCheck = () => api.get('/health');

// Hardware Config
export const getHardwareConfigs = () =>
  unwrap<HardwareConfig[]>(api.get('/hardware-config'));

export const createHardwareConfig = (config: Partial<HardwareConfig>) =>
  unwrap(api.post('/hardware-config', config));

// Control Domains
export const getControlDomains = () =>
  unwrap<ControlDomain[]>(api.get('/control-domains'));

export const createControlDomain = (domain: Partial<ControlDomain>) =>
  unwrap(api.post('/control-domains', domain));

// Scan Records
export const getScanRecords = (params?: Record<string, unknown>) =>
  unwrap<ScanRecordsResponse>(api.get('/scan-records', { params }));

export const createScanRecord = (record: Partial<ScanRecord>) =>
  unwrap(api.post('/scan-records', record));

// Flash Records
export const getFlashRecords = (params?: Record<string, unknown>) =>
  unwrap<FlashRecordsResponse>(api.get('/flash-records', { params }));

export const createFlashRecord = (record: Partial<FlashRecord>) =>
  unwrap(api.post('/flash-records', record));

// Statistics
export const getCoverageStats = () =>
  unwrap<CoverageStats[]>(api.get('/statistics/coverage'));

// Manual scan trigger (for testing)
export const triggerManualScan = (barcode: string, targetDomain?: string) =>
  unwrap<ScanResult>(api.post('/scan', { barcode, target_domain: targetDomain }));

// Export
export const exportCsv = (params?: Record<string, unknown>) =>
  unwrap(api.get('/export/csv', { params }));

// Settings
export interface SerialSettings {
  serial_port: string;
  serial_baudrate: number;
  serial_bytesize: number;
  serial_parity: string;
  serial_stopbits: number;
}

export const getSettings = () =>
  unwrap<SerialSettings>(api.get('/settings'));

export const updateSettings = (settings: SerialSettings) =>
  unwrap(api.post('/settings', settings));

export default api;
