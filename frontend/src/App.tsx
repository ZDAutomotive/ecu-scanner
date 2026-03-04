import { useEffect, useState } from 'react';
import { useAppStore } from './store';
import { getControlDomains, getCoverageStats, healthCheck, getSerialStatus } from './api/client';
import { useWebSocket } from './hooks/useWebSocket';
import Dashboard from './pages/Dashboard';
import Management from './pages/Management';
import Settings from './pages/Settings';
import { LayoutDashboard, Database, Settings as SettingsIcon, Wifi, WifiOff, Activity } from 'lucide-react';

function App() {
  const { currentTab, setCurrentTab, isScannerConnected, setScannerConnected, setControlDomains, setCoverageStats } = useAppStore();
  const [apiStatus, setApiStatus] = useState<'checking' | 'online' | 'offline'>('checking');

  // Initialize WebSocket for real-time scan results
  useWebSocket();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    // Check API health with explicit error handling
    const checkApiStatus = async () => {
      try {
        const response = await healthCheck();
        console.log('Health check response:', response);
        setApiStatus('online');
      } catch (error) {
        console.error('Health check failed:', error);
        setApiStatus('offline');
      }
    };

    checkApiStatus();

    // Poll API status every 10 seconds
    const interval = setInterval(checkApiStatus, 10000);

    // Fetch initial data
    getControlDomains()
      .then(data => {
        setControlDomains(data);
      })
      .catch(console.error);

    getCoverageStats()
      .then(data => {
        setCoverageStats(data);
      })
      .catch(console.error);

    // Check serial port status
    getSerialStatus()
      .then(data => {
        setScannerConnected(data.connected);
      })
      .catch(console.error);

    return () => clearInterval(interval);
  }, []);

  const tabs = [
    { id: 'scan' as const, label: '扫码工作站', icon: LayoutDashboard },
    { id: 'management' as const, label: '数据管理', icon: Database },
    { id: 'settings' as const, label: '系统设置', icon: SettingsIcon },
  ];

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Skip Link for Accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary-600 focus:text-white focus:rounded"
      >
        跳至主要内容
      </a>

      {/* Header */}
      <header className="bg-gray-800 text-white px-6 py-4 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-4">
          <Activity className="w-8 h-8 text-primary-400" aria-hidden="true" />
          <h1 className="text-xl font-bold tracking-wide">ECU Scanner</h1>
          <span className="text-gray-400 text-sm">扫码验证系统</span>
        </div>

        <div className="flex items-center gap-6">
          {/* API Status */}
          <div className="flex items-center gap-2" role="status" aria-live="polite">
            {apiStatus === 'online' ? (
              <>
                <Wifi className="w-4 h-4 text-green-500" aria-hidden="true" />
                <span className="text-sm text-green-500">API 在线</span>
              </>
            ) : apiStatus === 'offline' ? (
              <>
                <WifiOff className="w-4 h-4 text-red-500" aria-hidden="true" />
                <span className="text-sm text-red-500">API 离线</span>
              </>
            ) : (
              <span className="text-sm text-gray-400">检查中...</span>
            )}
          </div>

          {/* Scanner Status */}
          <div className="flex items-center gap-2" role="status" aria-live="polite">
            {isScannerConnected ? (
              <>
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" aria-hidden="true" />
                <span className="text-sm text-green-500">扫码枪已连接</span>
              </>
            ) : (
              <>
                <div className="w-2 h-2 bg-red-500 rounded-full" aria-hidden="true" />
                <span className="text-sm text-red-500">扫码枪未连接</span>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-white border-b border-gray-200 px-6" role="navigation" aria-label="主导航">
        <div className="flex gap-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setCurrentTab(tab.id)}
              aria-current={currentTab === tab.id ? 'page' : undefined}
              aria-pressed={currentTab === tab.id}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors border-b-2 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 ${
                currentTab === tab.id
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="w-4 h-4" aria-hidden="true" />
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Main Content */}
      <main id="main-content" className="flex-1 overflow-hidden" tabIndex={-1}>
        {currentTab === 'scan' && <Dashboard />}
        {currentTab === 'management' && <Management />}
        {currentTab === 'settings' && <Settings />}
      </main>
    </div>
  );
}

export default App;
