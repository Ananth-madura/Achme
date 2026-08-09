import { useState, useEffect } from "react";
import { Send, Plus, Play, Pause, Square, X, Loader2, Clock, CheckCircle, XCircle, MessageCircle, Eye, FileText, Users } from "lucide-react";
import axios from "axios";
import { API } from "../config/api";
import WhatsAppNav from "../components/WhatsAppNav";
import BulkWhatsAppModal from "../components/BulkWhatsAppModal";

export default function WACampaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [groups, setGroups] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [campaignDetail, setCampaignDetail] = useState(null);
  const [starting, setStarting] = useState(null);
  const [crmContacts, setCrmContacts] = useState([]);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [form, setForm] = useState({
    name: "", description: "", type: "text", template_id: "", message_text: "", group_id: "", scheduled_at: ""
  });

  const fetchData = async () => {
    try {
      const token = localStorage.getItem("token");
      const [cRes, gRes, tRes] = await Promise.all([
        axios.get(`${API}/api/wa/campaigns`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/api/wa/groups`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/api/wa/templates`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      setCampaigns(cRes.data);
      setGroups(gRes.data);
      setTemplates(tRes.data);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => {
    setForm({ name: "", description: "", type: "text", template_id: "", message_text: "", group_id: "", scheduled_at: "" });
    setShowCreate(true);
  };

  const handleCreate = async () => {
    if (!form.name || !form.group_id) return;
    try {
      const token = localStorage.getItem("token");
      await axios.post(`${API}/api/wa/campaigns`, {
        ...form,
        template_id: form.template_id || null,
        scheduled_at: form.scheduled_at || null,
      }, { headers: { Authorization: `Bearer ${token}` } });
      setShowCreate(false);
      fetchData();
    } catch (err) { console.error(err); }
  };

  const handleStart = async (id) => {
    setStarting(id);
    try {
      const token = localStorage.getItem("token");
      await axios.post(`${API}/api/wa/campaigns/${id}/start`, {}, { headers: { Authorization: `Bearer ${token}` } });
      fetchData();
    } catch (err) { alert(err.response?.data?.error || "Failed to start"); }
    setStarting(null);
  };

  const handlePause = async (id) => {
    try {
      const token = localStorage.getItem("token");
      await axios.post(`${API}/api/wa/campaigns/${id}/pause`, {}, { headers: { Authorization: `Bearer ${token}` } });
      fetchData();
    } catch (err) { console.error(err); }
  };

  const handleStop = async (id) => {
    try {
      const token = localStorage.getItem("token");
      await axios.post(`${API}/api/wa/campaigns/${id}/stop`, {}, { headers: { Authorization: `Bearer ${token}` } });
      fetchData();
    } catch (err) { console.error(err); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this campaign?")) return;
    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${API}/api/wa/campaigns/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      setCampaignDetail(null);
      fetchData();
    } catch (err) { console.error(err); }
  };

  const viewDetail = async (id) => {
    try {
      const token = localStorage.getItem("token");
      const { data } = await axios.get(`${API}/api/wa/campaigns/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      setCampaignDetail(data);
    } catch (err) { console.error(err); }
  };

  const getStatusBadge = (status) => {
    const colors = {
      draft: "bg-gray-100 text-gray-600",
      scheduled: "bg-yellow-100 text-yellow-700",
      running: "bg-blue-100 text-blue-700",
      completed: "bg-green-100 text-green-700",
      paused: "bg-orange-100 text-orange-700",
      failed: "bg-red-100 text-red-700",
    };
    return <span className={`text-xs px-2 py-0.5 rounded-full ${colors[status] || "bg-gray-100"}`}>{status}</span>;
  };

  const getTypeIcon = (type) => {
    if (type === "template") return <FileText size={14} />;
    return <MessageCircle size={14} />;
  };

  return (
    <div className="p-4 md:p-6">
      <WhatsAppNav />
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Send className="text-[#25D366]" size={28} />
          <h1 className="text-xl font-bold text-gray-800">Campaigns</h1>
          <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">{campaigns.length} campaigns</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              try {
                const token = localStorage.getItem("token");
                const { data } = await axios.get(`${API}/api/wa/groups/sources/all`, { headers: { Authorization: `Bearer ${token}` } });
                setCrmContacts(data || []);
              } catch (e) { console.error(e); }
              setShowBulkModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition text-sm font-semibold shadow-sm"
          >
            <Users size={16} />
            <span>Massive Broadcast (7s Gap)</span>
          </button>
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-[#25D366] text-white rounded-lg hover:bg-[#1ebe5d] transition text-sm font-semibold shadow-sm">
            <Plus size={16} /> New Campaign
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 size={32} className="animate-spin text-[#25D366]" /></div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-20 text-gray-400 bg-white rounded-xl border border-gray-200">
          <Send size={48} className="mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">No campaigns yet</p>
          <p className="text-sm">Create a campaign to send bulk WhatsApp messages</p>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => (
            <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 font-semibold text-gray-800 text-base">
                    {getTypeIcon(c.type)}
                    <span>{c.name}</span>
                    {getStatusBadge(c.status)}
                  </div>
                  {c.description && <p className="text-sm text-gray-500 mb-2">{c.description}</p>}
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <span className="flex items-center gap-1"><MessageCircle size={12} /> {c.total_contacts || 0}</span>
                    <span className="flex items-center gap-1 text-green-600"><CheckCircle size={12} /> {c.sent_count || 0}</span>
                    <span className="flex items-center gap-1 text-blue-600"><Eye size={12} /> {c.delivered_count || 0}</span>
                    <span className="flex items-center gap-1 text-red-600"><XCircle size={12} /> {c.failed_count || 0}</span>
                    {c.scheduled_at && <span className="flex items-center gap-1"><Clock size={12} /> {new Date(c.scheduled_at).toLocaleString()}</span>}
                    {c.created_at && <span>{new Date(c.created_at).toLocaleDateString()}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 ml-4">
                  <button onClick={() => viewDetail(c.id)} className="p-2 hover:bg-gray-100 rounded-lg" title="View details"><Eye size={16} className="text-gray-500" /></button>
                  {c.status === "draft" || c.status === "paused" ? (
                    <button onClick={() => handleStart(c.id)} disabled={starting === c.id} className="p-2 hover:bg-green-50 rounded-lg">
                      {starting === c.id ? <Loader2 size={16} className="animate-spin text-green-600" /> : <Play size={16} className="text-green-600" />}
                    </button>
                  ) : null}
                  {c.status === "running" ? (
                    <>
                      <button onClick={() => handlePause(c.id)} className="p-2 hover:bg-orange-50 rounded-lg"><Pause size={16} className="text-orange-500" /></button>
                      <button onClick={() => handleStop(c.id)} className="p-2 hover:bg-red-50 rounded-lg"><Square size={16} className="text-red-500" /></button>
                    </>
                  ) : null}
                  <button onClick={() => handleDelete(c.id)} className="p-2 hover:bg-red-50 rounded-lg"><X size={16} className="text-red-400" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-800">New Campaign</h2>
              <button onClick={() => setShowCreate(false)}><X size={20} className="text-gray-400" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Name *</label>
                <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Diwali Promotion" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Campaign description" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message Type</label>
                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  <option value="text">Text Message</option>
                  <option value="template">Template Message (Requires Meta approval)</option>
                </select>
              </div>
              {form.type === "template" ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Template</label>
                  <select value={form.template_id} onChange={e => setForm({ ...form, template_id: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                    <option value="">Select template</option>
                    {templates.map(t => <option key={t.id} value={t.id}>{t.name} ({t.category})</option>)}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Message Text</label>
                  <textarea value={form.message_text} onChange={e => setForm({ ...form, message_text: e.target.value })} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Hello! This is a promotional message from our company..." />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Target Group *</label>
                <select value={form.group_id} onChange={e => setForm({ ...form, group_id: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  <option value="">Select group</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name} ({g.contact_count || 0} contacts)</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Schedule (optional)</label>
                <input type="datetime-local" value={form.scheduled_at} onChange={e => setForm({ ...form, scheduled_at: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t border-gray-100">
              <button onClick={() => setShowCreate(false)} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
              <button onClick={handleCreate} disabled={!form.name || !form.group_id} className="flex-1 px-4 py-2.5 bg-[#25D366] text-white rounded-lg text-sm hover:bg-[#1ebe5d] disabled:opacity-50">Create Campaign</button>
            </div>
          </div>
        </div>
      )}

      {campaignDetail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setCampaignDetail(null)}>
          <div className="bg-white rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-800">{campaignDetail.name}</h2>
                <p className="text-sm text-gray-500">{campaignDetail.description}</p>
              </div>
              <button onClick={() => setCampaignDetail(null)}><X size={20} className="text-gray-400" /></button>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-gray-800">{campaignDetail.total_contacts}</p>
                  <p className="text-xs text-gray-500">Total</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-green-600">{campaignDetail.sent_count}</p>
                  <p className="text-xs text-gray-500">Sent</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-blue-600">{campaignDetail.delivered_count}</p>
                  <p className="text-xs text-gray-500">Delivered</p>
                </div>
                <div className="bg-red-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-red-600">{campaignDetail.failed_count}</p>
                  <p className="text-xs text-gray-500">Failed</p>
                </div>
              </div>
              {campaignDetail.messages?.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-800 mb-3">Messages ({campaignDetail.messages.length})</h3>
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {campaignDetail.messages.map((m) => (
                      <div key={m.id} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-lg text-sm">
                        <span className="text-gray-700">{m.contact_name || m.phone}</span>
                        <span className="text-gray-500">{m.phone}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${m.status === "sent" ? "bg-green-100 text-green-700" : m.status === "delivered" ? "bg-blue-100 text-blue-700" : m.status === "read" ? "bg-purple-100 text-purple-700" : m.status === "failed" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"}`}>
                          {m.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-3 p-5 border-t border-gray-100">
              <button onClick={() => setCampaignDetail(null)} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">Close</button>
            </div>
          </div>
        </div>
      )}

      <BulkWhatsAppModal
        isOpen={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        contacts={crmContacts || []}
        onSuccess={() => fetchData()}
      />
    </div>
  );
}