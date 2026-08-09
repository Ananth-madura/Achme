import { useState } from "react";
import { MessageCircle, X, Send, Clock, ShieldCheck, Users, Loader2, CheckCircle2 } from "lucide-react";
import axios from "axios";
import { API } from "../config/api";

export default function BulkWhatsAppModal({ contacts = [], isOpen, onClose, onSuccess }) {
  const [campaignName, setCampaignName] = useState("");
  const [message, setMessage] = useState("Hello {name}, thank you for contacting ACHME Communication! How can we assist you today?");
  const [delaySeconds, setDelaySeconds] = useState(7);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  if (!isOpen) return null;

  const handleSend = async (e) => {
    e.preventDefault();
    if (!campaignName.trim() || !message.trim()) {
      setError("Please provide a campaign name and message.");
      return;
    }
    if (!contacts.length) {
      setError("No contacts selected.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };

      const payload = {
        name: campaignName.trim(),
        message_text: message.trim(),
        contacts: contacts.map(c => ({
          name: c.name || c.customer_name || c.company_name || "Customer",
          phone: c.phone || c.mobile_number || "",
          source: c.source || "CRM Client"
        })),
        delay_seconds: Number(delaySeconds) || 7
      };

      const res = await axios.post(`${API}/api/wa/campaigns/create-direct`, payload, { headers });
      setSuccess(`🎉 Massive Campaign launched! ${contacts.length} messages scheduled with a ${delaySeconds}-second gap between messages.`);
      setTimeout(() => {
        if (onSuccess) onSuccess(res.data);
        onClose();
      }, 2500);
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Failed to start bulk campaign");
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-6 border border-gray-100 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-green-100 rounded-xl text-[#25D366]">
            <MessageCircle size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">Launch Massive WhatsApp Campaign</h2>
            <p className="text-xs text-gray-500">Send bulk messages with rate-limiting safety</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm flex items-center gap-2">
            <CheckCircle2 size={18} />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSend} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Campaign Title</label>
            <input
              type="text"
              placeholder="e.g., July Special Promotion"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#25D366] outline-none"
              required
            />
          </div>

          <div className="bg-emerald-50/70 border border-emerald-200/60 rounded-xl p-3 flex items-center justify-between text-xs text-emerald-800">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-[#25D366]" />
              <span>Target Recipients: <strong>{contacts.length} Selected Contacts</strong></span>
            </div>
            <div className="flex items-center gap-1 font-semibold text-emerald-700">
              <ShieldCheck size={16} />
              <span>Anti-Spam Safe</span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-gray-600 uppercase">
                Message Content
              </label>
              <div className="flex items-center gap-1 text-xs">
                <span className="text-gray-400">Insert:</span>
                {["{name}", "{city}", "{company}", "{phone}"].map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setMessage(prev => prev + " " + tag)}
                    className="px-2 py-0.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-mono text-[11px] rounded transition"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your WhatsApp broadcast message..."
              className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#25D366] outline-none resize-none"
              required
            />
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock size={18} className="text-amber-600" />
              <div>
                <p className="font-semibold">Safe Delay Between Messages</p>
                <p className="text-[11px] text-amber-700">Prevents account bans on large campaigns</p>
              </div>
            </div>
            <select
              value={delaySeconds}
              onChange={(e) => setDelaySeconds(Number(e.target.value))}
              className="px-3 py-1 bg-white border border-amber-300 rounded-lg text-xs font-bold text-amber-900 outline-none"
            >
              <option value={5}>5 Seconds Gap</option>
              <option value={7}>7 Seconds Gap (Recommended)</option>
              <option value={10}>10 Seconds Gap</option>
              <option value={15}>15 Seconds Gap</option>
            </select>
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !contacts.length}
              className="px-5 py-2.5 bg-[#25D366] text-white rounded-lg hover:bg-[#1ebe5d] transition font-semibold text-sm flex items-center gap-2 shadow-md disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Scheduling {contacts.length} Messages...</span>
                </>
              ) : (
                <>
                  <Send size={16} />
                  <span>Send to {contacts.length} Contacts (7s gap)</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
