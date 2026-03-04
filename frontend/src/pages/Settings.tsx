import { useState, useEffect } from "react";
import { useAppStore } from "@/store";
import {
  createHardwareConfig,
  createControlDomain,
  getControlDomains,
  getCoverageStats,
  getSettings,
  updateSettings,
  type SerialSettings,
} from "@/api/client";
import type { ControlDomain } from "@/types";
import { Save, Plus } from "lucide-react";

interface HardwareConfigForm {
  part_number: string;
  hardware_id: string;
  control_domain: string;
  description: string;
}

interface ControlDomainForm {
  name: string;
  domain_code: string;
  description: string;
}

export default function Settings() {
  const { setCoverageStats } = useAppStore();

  // Local state for control domains (like Management page)
  const [controlDomains, setControlDomains] = useState<ControlDomain[]>([]);

  // Serial settings state
  const [serialSettings, setSerialSettings] = useState<SerialSettings>({
    serial_port: "COM3",
    serial_baudrate: 9600,
    serial_bytesize: 8,
    serial_parity: "N",
    serial_stopbits: 1,
  });
  const [settingsLoading, setSettingsLoading] = useState(false);

  // Load data on mount
  useEffect(() => {
    getControlDomains()
      .then((data) => {
        setControlDomains(data);
      })
      .catch(console.error);

    getCoverageStats()
      .then((data) => {
        setCoverageStats(data);
      })
      .catch(console.error);

    // Load serial settings
    getSettings()
      .then((data) => {
        setSerialSettings(data);
      })
      .catch(console.error);
  }, [setCoverageStats]);

  // Hardware Config Form
  const [hwForm, setHwForm] = useState<HardwareConfigForm>({
    part_number: "",
    hardware_id: "",
    control_domain: "",
    description: "",
  });

  // Control Domain Form
  const [domainForm, setDomainForm] = useState<ControlDomainForm>({
    name: "",
    domain_code: "",
    description: "",
  });

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const handleSaveSerialSettings = async () => {
    setSettingsLoading(true);
    setMessage(null);
    try {
      await updateSettings(serialSettings);
      setMessage({
        type: "success",
        text: "串口设置已保存，需要重启应用才能生效",
      });
    } catch (error) {
      setMessage({ type: "error", text: "保存失败" });
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleSaveHardwareConfig = async () => {
    if (!hwForm.part_number || !hwForm.hardware_id || !hwForm.control_domain) {
      setMessage({ type: "error", text: "请填写所有必填字段" });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      await createHardwareConfig(hwForm);
      setMessage({ type: "success", text: "硬件配置保存成功" });
      setHwForm({
        part_number: "",
        hardware_id: "",
        control_domain: "",
        description: "",
      });
    } catch (error) {
      setMessage({ type: "error", text: "保存失败" });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveControlDomain = async () => {
    if (!domainForm.name || !domainForm.domain_code) {
      setMessage({ type: "error", text: "请填写所有必填字段" });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      await createControlDomain(domainForm);
      setMessage({ type: "success", text: "控制域保存成功" });
      setDomainForm({ name: "", domain_code: "", description: "" });

      // Refresh list
      const data = await getControlDomains();
      setControlDomains(data);
    } catch (error) {
      setMessage({ type: "error", text: "保存失败" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Message */}
        {message && (
          <div
            role="alert"
            aria-live="polite"
            className={`p-4 rounded-lg ${
              message.type === "success"
                ? "bg-green-50 text-green-800"
                : "bg-red-50 text-red-800"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Serial Port Settings */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">串口设置</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="serial-port"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                串口号
              </label>
              <input
                id="serial-port"
                type="text"
                value={serialSettings.serial_port}
                onChange={(e) =>
                  setSerialSettings({
                    ...serialSettings,
                    serial_port: e.target.value,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label
                htmlFor="baudrate"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                波特率
              </label>
              <select
                id="baudrate"
                value={serialSettings.serial_baudrate}
                onChange={(e) =>
                  setSerialSettings({
                    ...serialSettings,
                    serial_baudrate: Number(e.target.value),
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              >
                <option value={9600}>9600</option>
                <option value={19200}>19200</option>
                <option value={38400}>38400</option>
                <option value={57600}>57600</option>
                <option value={115200}>115200</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="databits"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                数据位
              </label>
              <select
                id="databits"
                value={serialSettings.serial_bytesize}
                onChange={(e) =>
                  setSerialSettings({
                    ...serialSettings,
                    serial_bytesize: Number(e.target.value),
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              >
                <option value={5}>5</option>
                <option value={6}>6</option>
                <option value={7}>7</option>
                <option value={8}>8</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="stopbits"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                停止位
              </label>
              <select
                id="stopbits"
                value={serialSettings.serial_stopbits}
                onChange={(e) =>
                  setSerialSettings({
                    ...serialSettings,
                    serial_stopbits: Number(e.target.value),
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
              </select>
            </div>
          </div>
          <button
            onClick={handleSaveSerialSettings}
            disabled={settingsLoading}
            aria-label="保存串口设置"
            className="mt-4 flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
          >
            <Save className="w-4 h-4" aria-hidden="true" />
            {settingsLoading ? "保存中..." : "保存串口设置"}
          </button>
        </div>

        {/* Control Domain Management */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            控制域管理
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="domain-name"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                名称 <span className="text-red-500">*</span>
              </label>
              <input
                id="domain-name"
                type="text"
                value={domainForm.name}
                onChange={(e) =>
                  setDomainForm({ ...domainForm, name: e.target.value })
                }
                placeholder="如：动力域"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label
                htmlFor="domain-code"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                代码 <span className="text-red-500">*</span>
              </label>
              <input
                id="domain-code"
                type="text"
                value={domainForm.domain_code}
                onChange={(e) =>
                  setDomainForm({ ...domainForm, domain_code: e.target.value })
                }
                placeholder="如：PT"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="col-span-2">
              <label
                htmlFor="domain-description"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                描述
              </label>
              <input
                id="domain-description"
                type="text"
                value={domainForm.description}
                onChange={(e) =>
                  setDomainForm({ ...domainForm, description: e.target.value })
                }
                placeholder="可选描述"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
          <button
            onClick={handleSaveControlDomain}
            disabled={saving}
            aria-label="保存控制域"
            className="mt-4 flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
          >
            <Save className="w-4 h-4" aria-hidden="true" />
            保存控制域
          </button>
        </div>

        {/* Hardware Config Management */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            硬件配置管理
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="hw-part-number"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                零件号 (PN) <span className="text-red-500">*</span>
              </label>
              <input
                id="hw-part-number"
                type="text"
                value={hwForm.part_number}
                onChange={(e) =>
                  setHwForm({ ...hwForm, part_number: e.target.value })
                }
                placeholder="如：ECU-12345"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label
                htmlFor="hw-hardware-id"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                硬件号 (HW ID) <span className="text-red-500">*</span>
              </label>
              <input
                id="hw-hardware-id"
                type="text"
                value={hwForm.hardware_id}
                onChange={(e) =>
                  setHwForm({ ...hwForm, hardware_id: e.target.value })
                }
                placeholder="如：HW-001"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label
                htmlFor="hw-control-domain"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                控制域 <span className="text-red-500">*</span>
              </label>
              <select
                id="hw-control-domain"
                value={hwForm.control_domain}
                onChange={(e) =>
                  setHwForm({ ...hwForm, control_domain: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              >
                {controlDomains.map((domain) => (
                  <option key={domain.id} value={domain.domain_code}>
                    {domain.name} ({domain.domain_code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="hw-description"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                描述
              </label>
              <input
                id="hw-description"
                type="text"
                value={hwForm.description}
                onChange={(e) =>
                  setHwForm({ ...hwForm, description: e.target.value })
                }
                placeholder="可选描述"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
          <button
            onClick={handleSaveHardwareConfig}
            disabled={saving}
            aria-label="添加硬件配置"
            className="mt-4 flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            添加硬件配置
          </button>
        </div>

        {/* System Info */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">系统信息</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">版本</span>
              <p className="font-medium">ECU Scanner v1.0.0</p>
            </div>
            <div>
              <span className="text-gray-500">API 状态</span>
              <p className="font-medium text-green-600">在线</p>
            </div>
            <div>
              <span className="text-gray-500">数据库</span>
              <p className="font-medium">SQLite</p>
            </div>
            <div>
              <span className="text-gray-500">运行环境</span>
              <p className="font-medium">工控 PC</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
