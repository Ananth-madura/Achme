import { useNavigate, useLocation } from "react-router-dom";
import {
  MessageCircle,
  FileText,
  Users,
  Send,
  BarChart3,
  Settings,
  CheckCircle2,
  XCircle,
  Loader2,
  X,
  Zap,
} from "lucide-react";
import { useState, useEffect } from "react";
import axios from "axios";
import { API } from "../config/api";
import WAConfigPrompt from "./WAConfigPrompt";

export default function WhatsAppNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showConfig, setShowConfig] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [status, setStatus] = useState(null);
  const [testPhone, setTestPhone] = useState("");
  const [testMessage, setTestMessage] = useState("Hello! This is a test message from ACHME Communication CRM.");
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const fetchStatus = async () => {
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      let res;
      try {
        res = await axios.get(`${API}/api/whatsapp/unified-status`, { headers });
      } catch (e1) {
        res = await axios.get(`/api/whatsapp/unified-status`, { headers });
      }
      setStatus(res.data);
    } catch {}
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleTestSend = async (e) => {
    e.preventDefault();
    if (!testPhone.trim()) return;
    setTestLoading(true);
    setTestResult(null);
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      let res;
      try {
        res = await axios.post(`${API}/api/whatsapp/test-send`, { phone: testPhone.trim(), message: testMessage.trim() }, { headers });
      } catch (e1) {
        res = await axios.post(`/api/whatsapp/test-send`, { phone: testPhone.trim(), message: testMessage.trim() }, { headers });
      }
      setTestResult({ success: true, message: `🎉 Sent successfully via ${res.data.engineUsed || 'WhatsApp Engine'}!` });
    } catch (err) {
      setTestResult({ success: false, message: err.response?.data?.error || err.message || "Failed to send test message" });
    }
    setTestLoading(false);
  };

  const tabs = [
    {
      id: "chats",
      label: "Live Chats & QR",
      path: "/dashboard/whatsapp",
      icon: MessageCircle,
      exact: true,
    },
    {
      id: "templates",
      label: "Templates",
      path: "/dashboard/whatsapp/templates",
      icon: FileText,
    },
    {
      id: "groups",
      label: "Contact Groups",
      path: "/dashboard/whatsapp/groups",
      icon: Users,
    },
    {
      id: "campaigns",
      label: "Bulk Campaigns",
      path: "/dashboard/whatsapp/campaigns",
      icon: Send,
    },
    {
      id: "analytics",
      label: "Analytics & Logs",
      path: "/dashboard/whatsapp/analytics",
      icon: BarChart3,
    },
  ];

  const isTabActive = (tab) => {
    if (tab.exact) {
      return location.pathname === tab.path;
    }
    return location.pathname.startsWith(tab.path);
  };

  return (
    <div className="mb-6 bg-white rounded-xl border border-gray-200 p-2 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Top Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto py-1 px-1 scrollbar-none w-full sm:w-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = isTabActive(tab);
            return (
              <button
                key={tab.id}
                onClick={() => navigate(tab.path)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all whitespace-nowrap ${
                  active
                    ? "bg-[#25D366] text-white shadow-md shadow-[#25D366]/20 font-semibold"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                }`}
              >
                <Icon size={18} className={active ? "text-white" : "text-gray-500"} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Engine Status & Config Buttons */}
        <div className="flex items-center gap-2 ml-auto pr-1">
          {status && (
            <button
              onClick={() => setShowTestModal(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                status.connected
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                  : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
              }`}
              title="Click to send a test message and verify session"
            >
              {status.connected ? <CheckCircle2 size={13} className="text-emerald-600" /> : <XCircle size={13} className="text-amber-600" />}
              <span>{status.activeEngine || "Disconnected"}</span>
            </button>
          )}

          <button
            onClick={() => setShowTestModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition text-xs font-semibold"
            title="Test WhatsApp Connection"
          >
            <Zap size={14} className="text-emerald-600" />
            <span className="hidden sm:inline">Test Connection</span>
          </button>

          <button
            onClick={() => setShowConfig(true)}
            className="flex items-center gap-2 px-3.5 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg transition text-xs font-semibold"
            title="Configure Meta Cloud API"
          >
            <Settings size={15} className="text-gray-600" />
            <span className="hidden md:inline">API Config</span>
          </button>
        </div>
      </div>

      {showConfig && <WAConfigPrompt onClose={() => setShowConfig(false)} />}

      {/* Test Send Modal */}
      {showTestModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full border border-gray-100 shadow-2xl relative">
            <button onClick={() => setShowTestModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-emerald-100 text-[#25D366] rounded-xl">
                <Zap size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-800">Test WhatsApp Connection</h3>
                <p className="text-xs text-gray-500">Send instant test message to verify active engine</p>
              </div>
            </div>

            {testResult && (
              <div className={`mb-4 p-3 rounded-lg text-xs font-semibold ${testResult.success ? "bg-emerald-50 border border-emerald-200 text-emerald-700" : "bg-red-50 border border-red-200 text-red-700"}`}>
                {testResult.message}
              </div>
            )}

            <form onSubmit={handleTestSend} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Mobile Number (with country code)</label>
                <input
                  type="text"
                  placeholder="e.g. 919876543210"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#25D366]"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Test Message Text</label>
                <textarea
                  rows={3}
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#25D366] resize-none"
                  required
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowTestModal(false)} className="px-4 py-2 border rounded-lg text-xs text-gray-600 hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={testLoading || !testPhone} className="px-5 py-2 bg-[#25D366] text-white rounded-lg text-xs font-bold hover:bg-[#1ebe5d] flex items-center gap-2 shadow-md disabled:opacity-50">
                  {testLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  <span>Send Test Message</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
