// API Response Types

export interface ApiResponse<T = unknown> {
  code: number;
  data?: T;
  message?: string;
}

export interface ScanRecord {
  id: number;
  barcode: string;
  part_number: string | null;
  hardware_id: string | null;
  serial_number: string | null;
  control_domain: string | null;
  status: 'pending' | 'success' | 'failed' | 'duplicate';
  error_message: string | null;
  scanned_at: string;
}

export interface FlashRecord {
  id: number;
  serial_number: string;
  part_number: string;
  hardware_id: string;
  control_domain: string;
  flash_status: string;
  flash_result: string | null;
  flashed_at: string;
}

export interface HardwareConfig {
  id: number;
  part_number: string;
  hardware_id: string;
  control_domain: string;
  description: string | null;
  is_active: number;
  created_at: string;
}

export interface ControlDomain {
  id: number;
  name: string;
  domain_code: string;
  description: string | null;
  created_at: string;
}

export interface CoverageStats {
  domain: string;
  domain_name: string;
  scanned: number;
  flashed: number;
}

export interface ScanRecordsResponse {
  total: number;
  records: ScanRecord[];
}

export interface FlashRecordsResponse {
  total: number;
  records: FlashRecord[];
}

export interface ScanResult {
  barcode: string;
  part_number?: string;
  hardware_id?: string;
  serial_number?: string;
  control_domain?: string;
  status: 'success' | 'failed' | 'duplicate';
  message?: string;
  error_message?: string;
  scanned_at?: string;
}

export interface ConnectionStatus {
  connected: boolean;
  port: string;
  baudrate: number;
}

// Frontend Types

export type TabType = 'scan' | 'management' | 'settings';

export interface FilterParams {
  control_domain?: string;
  status?: string;
  start_date?: string;
  end_date?: string;
  search?: string;
  limit?: number;
  offset?: number;
}
