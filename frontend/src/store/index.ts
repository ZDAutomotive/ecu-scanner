import { create } from 'zustand';
import type { ScanResult, ConnectionStatus, ControlDomain, CoverageStats } from '@/types';

interface AppState {
  // Connection status
  connectionStatus: ConnectionStatus;
  setConnectionStatus: (status: ConnectionStatus) => void;

  // Current scan result
  lastScanResult: ScanResult | null;
  setLastScanResult: (result: ScanResult | null) => void;

  // Selected control domain
  selectedDomain: string;
  setSelectedDomain: (domain: string) => void;

  // Control domains
  controlDomains: ControlDomain[];
  setControlDomains: (domains: ControlDomain[]) => void;

  // Coverage stats
  coverageStats: CoverageStats[];
  setCoverageStats: (stats: CoverageStats[]) => void;

  // UI state
  currentTab: 'scan' | 'management' | 'settings';
  setCurrentTab: (tab: 'scan' | 'management' | 'settings') => void;

  // Scanner connected
  isScannerConnected: boolean;
  setScannerConnected: (connected: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Connection status
  connectionStatus: {
    connected: false,
    port: 'COM3',
    baudrate: 9600,
  },
  setConnectionStatus: (status) => set({ connectionStatus: status }),

  // Current scan result
  lastScanResult: null,
  setLastScanResult: (result) => set({ lastScanResult: result }),

  // Selected control domain
  selectedDomain: 'PT',
  setSelectedDomain: (domain) => set({ selectedDomain: domain }),

  // Control domains
  controlDomains: [],
  setControlDomains: (domains) => set({ controlDomains: domains }),

  // Coverage stats
  coverageStats: [],
  setCoverageStats: (stats) => set({ coverageStats: stats }),

  // UI state
  currentTab: 'scan',
  setCurrentTab: (tab) => set({ currentTab: tab }),

  // Scanner connected
  isScannerConnected: false,
  setScannerConnected: (connected) => set({ isScannerConnected: connected }),
}));
