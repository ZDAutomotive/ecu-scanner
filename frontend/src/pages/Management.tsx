import { useState, useEffect } from 'react';
import { getScanRecords, getFlashRecords, getCoverageStats, exportCsv } from '@/api/client';
import type { ScanRecord, FlashRecord, CoverageStats } from '@/types';
import { Search, Download, RefreshCw } from 'lucide-react';

export default function Management() {
  const [activeTab, setActiveTab] = useState<'scan' | 'flash'>('scan');
  const [scanRecords, setScanRecords] = useState<ScanRecord[]>([]);
  const [flashRecords, setFlashRecords] = useState<FlashRecord[]>([]);
  const [coverageStats, setCoverageStats] = useState<CoverageStats[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDomain, setSelectedDomain] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  const fetchData = async () => {
    setLoading(true);
    try {
      const offset = (currentPage - 1) * pageSize;

      if (activeTab === 'scan') {
        const data = await getScanRecords({
          limit: pageSize,
          offset,
          control_domain: selectedDomain || undefined,
          search: searchTerm || undefined,
        });
        setScanRecords(data.records);
        setTotal(data.total);
      } else {
        const data = await getFlashRecords({
          limit: pageSize,
          offset,
          control_domain: selectedDomain || undefined,
          search: searchTerm || undefined,
        });
        setFlashRecords(data.records);
        setTotal(data.total);
      }

      // Also fetch coverage stats
      const statsData = await getCoverageStats();
      setCoverageStats(statsData);
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab, currentPage, selectedDomain]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      setCurrentPage(1);
      fetchData();
    }, 300);
    return () => clearTimeout(debounce);
  }, [searchTerm]);

  const handleExport = async () => {
    try {
      await exportCsv({
        type: activeTab,
        control_domain: selectedDomain || undefined,
      });
      alert('导出功能开发中');
    } catch (error) {
      console.error('Export error:', error);
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  const getStatusBadge = (status: string) => {
    const styles = {
      success: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      pending: 'bg-yellow-100 text-yellow-800',
      duplicate: 'bg-orange-100 text-orange-800',
    };
    const labels = {
      success: '成功',
      failed: '失败',
      pending: '待处理',
      duplicate: '重复',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status as keyof typeof styles] || 'bg-gray-100'}`}>
        {labels[status as keyof typeof labels] || status}
      </span>
    );
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return '-';
    }
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="h-full flex flex-col p-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        {coverageStats.map((stat) => (
          <div key={stat.domain} className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500">{stat.domain_name}</p>
            <div className="flex items-end gap-2 mt-1">
              <span className="text-2xl font-bold text-gray-800">{stat.scanned}</span>
              <span className="text-sm text-gray-400">/ {stat.flashed}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
            <input
              id="search-input"
              type="text"
              placeholder="搜索序列号或零件号..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="搜索序列号或零件号"
              autoComplete="off"
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          {/* Domain Filter */}
          <select
            id="domain-filter"
            value={selectedDomain}
            onChange={(e) => setSelectedDomain(e.target.value)}
            aria-label="筛选控制域"
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
          >
            <option value="">全部控制域</option>
            {coverageStats.map((stat) => (
              <option key={stat.domain} value={stat.domain}>
                {stat.domain_name}
              </option>
            ))}
          </select>

          {/* Refresh */}
          <button
            onClick={fetchData}
            aria-label="刷新数据"
            className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          </button>

          {/* Export */}
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            <Download className="w-4 h-4" />
            导出 CSV
          </button>
        </div>
      </div>

      {/* Data Table */}
      <div className="flex-1 bg-white rounded-lg shadow overflow-hidden flex flex-col">
        {/* Table Tabs */}
        <div className="border-b border-gray-200 px-4" role="tablist" aria-label="记录类型">
          <button
            onClick={() => setActiveTab('scan')}
            role="tab"
            aria-selected={activeTab === 'scan'}
            aria-controls="table-content"
            className={`px-4 py-3 text-sm font-medium border-b-2 focus-visible:ring-2 focus-visible:ring-primary-500 ${
              activeTab === 'scan'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500'
            }`}
          >
            扫码记录
          </button>
          <button
            onClick={() => setActiveTab('flash')}
            role="tab"
            aria-selected={activeTab === 'flash'}
            aria-controls="table-content"
            className={`px-4 py-3 text-sm font-medium border-b-2 focus-visible:ring-2 focus-visible:ring-primary-500 ${
              activeTab === 'flash'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500'
            }`}
          >
            刷写记录
          </button>
        </div>

        {/* Table Content */}
        <div id="table-content" className="flex-1 overflow-auto" role="tabpanel" aria-label={activeTab === 'scan' ? '扫码记录表格' : '刷写记录表格'}>
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">时间</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">条码</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">序列号</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">零件号</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">硬件号</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">控制域</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    加载中...
                  </td>
                </tr>
              ) : activeTab === 'scan' ? (
                scanRecords.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      暂无数据
                    </td>
                  </tr>
                ) : (
                  scanRecords.map((record) => (
                    <tr key={record.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {formatDate(record.scanned_at)}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono">{record.barcode}</td>
                      <td className="px-4 py-3 text-sm font-mono">{record.serial_number || '-'}</td>
                      <td className="px-4 py-3 text-sm font-mono">{record.part_number || '-'}</td>
                      <td className="px-4 py-3 text-sm font-mono">{record.hardware_id || '-'}</td>
                      <td className="px-4 py-3 text-sm">{record.control_domain || '-'}</td>
                      <td className="px-4 py-3">{getStatusBadge(record.status)}</td>
                    </tr>
                  ))
                )
              ) : flashRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    暂无数据
                  </td>
                </tr>
              ) : (
                flashRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {formatDate(record.flashed_at)}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono">-</td>
                    <td className="px-4 py-3 text-sm font-mono">{record.serial_number}</td>
                    <td className="px-4 py-3 text-sm font-mono">{record.part_number}</td>
                    <td className="px-4 py-3 text-sm font-mono">{record.hardware_id}</td>
                    <td className="px-4 py-3 text-sm">{record.control_domain}</td>
                    <td className="px-4 py-3">{getStatusBadge(record.flash_status)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="border-t border-gray-200 px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-gray-500">
            共 {total} 条记录，第 {currentPage} / {totalPages} 页
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50"
            >
              上一页
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50"
            >
              下一页
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
