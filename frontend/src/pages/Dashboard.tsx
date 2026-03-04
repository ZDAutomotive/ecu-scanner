import { useState, useEffect } from "react";
import { useAppStore } from "@/store";
import {
  triggerManualScan,
  getCoverageStats,
  getControlDomains,
} from "@/api/client";
import type { CoverageStats, ControlDomain } from "@/types";

export default function Dashboard() {
  const {
    lastScanResult,
    setLastScanResult,
    selectedDomain,
    setSelectedDomain,
    coverageStats,
    setCoverageStats,
    isScannerConnected,
  } = useAppStore();

  // Local state for control domains
  const [controlDomains, setControlDomains] = useState<ControlDomain[]>([]);

  // Load data on mount
  useEffect(() => {
    getCoverageStats()
      .then((data) => {
        setCoverageStats(data);
      })
      .catch(console.error);

    getControlDomains()
      .then((data) => {
        setControlDomains(data);
      })
      .catch(console.error);
  }, [setCoverageStats, setControlDomains]);

  const [manualBarcode, setManualBarcode] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleManualScan = async () => {
    if (!manualBarcode.trim()) return;

    setIsLoading(true);
    try {
      const data = await triggerManualScan(
        manualBarcode,
        selectedDomain || undefined,
      );

      setLastScanResult({
        barcode: data.barcode,
        serial_number: data.serial_number,
        hardware_id: data.hardware_id,
        control_domain: data.control_domain,
        status: data.status,
        message: data.message,
        error_message: data.error_message,
        scanned_at: data.scanned_at,
      });

      // Refresh stats
      const statsData = await getCoverageStats();
      setCoverageStats(statsData);
    } catch (error) {
      console.error("Scan error:", error);
      setLastScanResult({
        barcode: manualBarcode,
        status: "failed",
        error_message: "扫码处理失败",
      });
    } finally {
      setIsLoading(false);
      setManualBarcode("");
    }
  };

  const getStatusColor = () => {
    if (!lastScanResult) return "bg-gray-200 text-gray-500";
    switch (lastScanResult.status) {
      case "success":
        return "bg-green-500 text-white";
      case "failed":
        return "bg-red-500 text-white";
      case "duplicate":
        return "bg-yellow-500 text-white";
      default:
        return "bg-gray-200 text-gray-500";
    }
  };

  const getStatusText = () => {
    if (!lastScanResult) return "等待扫码";
    switch (lastScanResult.status) {
      case "success":
        return "PASS";
      case "failed":
        return "FAIL";
      case "duplicate":
        return "重复";
      default:
        return "未知";
    }
  };

  return (
    <div className="h-full flex">
      {/* Left Panel - Status Display */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gray-50">
        {/* Status Display */}
        <div
          className={`w-80 h-80 rounded-2xl flex items-center justify-center shadow-2xl transition-all duration-300 ${getStatusColor()}`}
          role="status"
          aria-live="polite"
          aria-label={`扫码结果: ${getStatusText()}`}
        >
          <span className="status-display">{getStatusText()}</span>
        </div>

        {/* Scan Info */}
        {lastScanResult && (
          <div className="mt-8 grid grid-cols-2 gap-4 text-center">
            <div className="bg-white rounded-lg p-4 shadow">
              <p className="text-xs text-gray-500 uppercase">条码</p>
              <p className="text-lg font-mono font-semibold text-gray-800">
                {lastScanResult.barcode}
              </p>
            </div>
            <div className="bg-white rounded-lg p-4 shadow">
              <p className="text-xs text-gray-500 uppercase">序列号</p>
              <p className="text-lg font-mono font-semibold text-gray-800">
                {lastScanResult.serial_number || "-"}
              </p>
            </div>
            <div className="bg-white rounded-lg p-4 shadow">
              <p className="text-xs text-gray-500 uppercase">控制域</p>
              <p className="text-lg font-semibold text-gray-800">
                {lastScanResult.control_domain || selectedDomain}
              </p>
            </div>
            <div className="bg-white rounded-lg p-4 shadow">
              <p className="text-xs text-gray-500 uppercase">硬件号</p>
              <p className="text-lg font-mono font-semibold text-gray-800">
                {lastScanResult.hardware_id || "-"}
              </p>
            </div>
          </div>
        )}

        {/* Error Message */}
        {lastScanResult?.error_message && (
          <div className="mt-4 px-6 py-3 bg-red-100 border border-red-300 rounded-lg text-red-700 text-sm">
            {lastScanResult.error_message}
          </div>
        )}
      </div>

      {/* Right Panel - Controls */}
      <div className="w-96 bg-white border-l border-gray-200 p-6 flex flex-col">
        {/* Domain Selector */}
        <div className="mb-6">
          <label
            htmlFor="control-domain"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            当前控制域
          </label>
          <select
            id="control-domain"
            value={selectedDomain}
            onChange={(e) => setSelectedDomain(e.target.value)}
            aria-label="选择当前控制域"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-lg"
          >
            {controlDomains.map((domain) => (
              <option key={domain.id} value={domain.domain_code}>
                {domain.name} ({domain.domain_code})
              </option>
            ))}
          </select>
        </div>

        {/* Manual Input */}
        <div className="mb-6">
          <label
            htmlFor="manual-barcode"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            手动输入条码（测试用）
          </label>
          <div className="flex gap-2">
            <input
              id="manual-barcode"
              type="text"
              value={manualBarcode}
              onChange={(e) => setManualBarcode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleManualScan()}
              placeholder="输入条码并回车"
              autoComplete="off"
              maxLength={50}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-mono"
            />
            <button
              onClick={handleManualScan}
              disabled={isLoading || !manualBarcode.trim()}
              aria-label="确认扫码"
              className="px-6 py-3 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
            >
              {isLoading ? "处理中..." : "确认"}
            </button>
          </div>
        </div>

        {/* Coverage Stats */}
        <div className="flex-1">
          <h3 className="text-sm font-medium text-gray-700 mb-4">刷写覆盖率</h3>
          <div className="space-y-3">
            {coverageStats.map((stat: CoverageStats) => (
              <div key={stat.domain} className="bg-gray-50 rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium text-gray-800">
                    {stat.domain_name}
                  </span>
                  <span className="text-sm text-gray-500">
                    {stat.scanned} / {stat.flashed}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-primary-500 h-2 rounded-full transition-all"
                    style={{
                      width:
                        stat.scanned > 0
                          ? `${(stat.flashed / stat.scanned) * 100}%`
                          : "0%",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Connection Status */}
        <div
          className="mt-auto pt-4 border-t border-gray-200"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">扫码枪状态</span>
            <div className="flex items-center gap-2">
              <div
                className={`w-3 h-3 rounded-full ${
                  isScannerConnected ? "bg-green-500" : "bg-red-500"
                }`}
                aria-hidden="true"
              />
              <span
                className={`text-sm font-medium ${isScannerConnected ? "text-green-600" : "text-red-600"}`}
              >
                {isScannerConnected ? "已连接" : "未连接"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
