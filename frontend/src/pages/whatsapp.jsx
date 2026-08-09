import { useState, useEffect, useRef, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  MessageCircle,
  LogOut,
  RefreshCw,
  Send,
  Loader2,
  Smartphone,
  ChevronLeft,
} from "lucide-react";
import axios from "axios";
import { API } from "../config/api";
import WhatsAppNav from "../components/WhatsAppNav";

export default function WhatsAppPage() {
  const [status, setStatus] = useState({ connected: false, initializing: false, hasQr: false });
  const [qrCode, setQrCode] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState("");
  const [chatsLoading, setChatsLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const messagesEndRef = useRef(null);
  const pollRef = useRef(null);

  const scrollToBottom = () => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const fetchStatus = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      let res;
      try {
        res = await axios.get(`${API}/api/whatsapp/unified-status`, { headers });
      } catch (e1) {
        try {
          res = await axios.get(`/api/whatsapp/unified-status`, { headers });
        } catch (e2) {
          res = await axios.get(`${API}/api/whatsapp/status`, { headers });
        }
      }
      // unified-status returns {connected, activeEngine, web:{connected,phone,...}, cloud:{...}}
      // flatten it to match the shape the rest of the UI expects
      const raw = res.data;
      const flat = raw.web
        ? { connected: raw.connected, phone: raw.web.phone, initializing: raw.web.initializing, hasQr: raw.web.hasQr, activeEngine: raw.activeEngine }
        : raw;
      setStatus(flat);
      if (flat.connected) {
        setQrCode(null);
      }
      return flat;
    } catch {
      return null;
    }
  }, []);

  const fetchQr = useCallback(async (force = false) => {
    setQrLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const endpoint = force ? "/api/whatsapp/qr?force=true" : "/api/whatsapp/qr";
      let res;
      try {
        res = await axios.get(`${API}${endpoint}`, { headers, timeout: 70000 });
      } catch (e1) {
        res = await axios.get(endpoint, { headers, timeout: 70000 });
      }
      if (res.data && res.data.qr) {
        setQrCode(res.data.qr);
        setStatus((s) => ({ ...s, hasQr: true }));
      } else {
        setError(res.data?.error || "Failed to generate QR code. Please try again.");
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.message || "Failed to connect to WhatsApp backend server. Please verify server status.";
      setError(msg);
    }
    setQrLoading(false);
  }, []);

  const fetchChats = useCallback(async (refresh = false) => {
    setChatsLoading(true);
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const endpoint = refresh ? `/api/whatsapp/chats?refresh=true` : `/api/whatsapp/chats`;
      let res;
      try {
        res = await axios.get(`${API}${endpoint}`, { headers });
      } catch (e1) {
        res = await axios.get(endpoint, { headers });
      }
      setChats(res.data || []);
    } catch {}
    setChatsLoading(false);
  }, []);

  const fetchMessages = useCallback(async (chatId) => {
    setMessagesLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API}/api/whatsapp/chat/${encodeURIComponent(chatId)}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMessages(res.data || []);
      scrollToBottom();
    } catch {}
    setMessagesLoading(false);
  }, []);

  const handleSelectChat = async (chat) => {
    setSelectedChat(chat);
    setShowMobileChat(true);
    await fetchMessages(chat.id);
  };

  const handleSend = async () => {
    if (!messageInput.trim() || !selectedChat || sending) return;
    setSending(true);
    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `${API}/api/whatsapp/send`,
        { chatId: selectedChat.id, message: messageInput.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessageInput("");
      await fetchMessages(selectedChat.id);
    } catch {
      setError("Failed to send message");
    }
    setSending(false);
  };

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `${API}/api/whatsapp/logout`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch {}
    setStatus({ connected: false, initializing: false, hasQr: false });
    setQrCode(null);
    setChats([]);
    setSelectedChat(null);
    setMessages([]);
  };

  const handleRefresh = () => {
    if (status.connected) {
      fetchChats();
    } else {
      setQrCode(null);
      fetchQr(true);
    }
  };

  const [connectMode, setConnectMode] = useState("qr"); // 'qr', 'pairing', 'api'
  const [pairingPhone, setPairingPhone] = useState("");
  const [pairingCode, setPairingCode] = useState(null);
  const [pairingLoading, setPairingLoading] = useState(false);
  const [pairingError, setPairingError] = useState(null);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 4000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  // Auto-fetch QR code on mount if not connected and no QR yet
  useEffect(() => {
    if (!status.connected && !qrCode && !qrLoading && connectMode === "qr") {
      fetchQr();
    }
  }, [status.connected, qrCode, qrLoading, connectMode, fetchQr]);

  const handleRequestPairingCode = async (e) => {
    e.preventDefault();
    if (!pairingPhone.trim()) return;
    setPairingLoading(true);
    setPairingError(null);
    setPairingCode(null);
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      let res;
      try {
        res = await axios.get(`${API}/api/whatsapp/pairing-code?phone=${encodeURIComponent(pairingPhone.trim())}`, { headers, timeout: 40000 });
      } catch (e1) {
        res = await axios.get(`/api/whatsapp/pairing-code?phone=${encodeURIComponent(pairingPhone.trim())}`, { headers, timeout: 40000 });
      }
      if (res.data && res.data.code) {
        setPairingCode(res.data.code);
      } else {
        setPairingError(res.data?.error || "Failed to generate pairing code");
      }
    } catch (err) {
      setPairingError(err.response?.data?.error || err.message || "Failed to request pairing code");
    }
    setPairingLoading(false);
  };

  // Auto-fetch chats immediately when connected
  useEffect(() => {
    if (status.connected) {
      fetchChats(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.connected]);

  useEffect(() => {
    if (status.connected) {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(() => {
        fetchChats();
        if (selectedChat) fetchMessages(selectedChat.id);
      }, 8000);
    } else {
      if (pollRef.current) clearInterval(pollRef.current);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [status.connected, fetchChats, fetchMessages, selectedChat]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!status.connected) {
    return (
      <div className="p-4 md:p-6">
        <WhatsAppNav />
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <MessageCircle className="text-[#25D366]" size={28} />
            <h1 className="text-xl font-bold text-gray-800">WhatsApp Connection Center</h1>
          </div>
          <button
            onClick={() => fetchQr(true)}
            disabled={qrLoading}
            className="flex items-center gap-2 px-4 py-2 bg-[#25D366] text-white rounded-lg hover:bg-[#1ebe5d] transition text-sm font-semibold shadow-sm disabled:opacity-50"
          >
            <RefreshCw size={16} className={qrLoading ? "animate-spin" : ""} />
            {qrLoading ? "Generating..." : "Fresh QR / Reset"}
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Connection Options Sub-Tabs */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm max-w-2xl mx-auto">
          <div className="flex items-center justify-center gap-2 mb-6 border-b border-gray-100 pb-4">
            <button
              onClick={() => { setConnectMode("qr"); if (!qrCode) fetchQr(); }}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${connectMode === "qr" ? "bg-[#25D366] text-white shadow" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
            >
              📱 QR Code Scan
            </button>
            <button
              onClick={() => setConnectMode("pairing")}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${connectMode === "pairing" ? "bg-[#25D366] text-white shadow" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
            >
              🔢 Phone Pairing Code
            </button>
          </div>

          {/* Mode 1: QR Code Scan */}
          {connectMode === "qr" && (
            <div className="flex flex-col items-center justify-center text-center py-4">
              {qrLoading ? (
                <div className="py-10 text-center">
                  <Loader2 size={48} className="animate-spin text-[#25D366] mx-auto mb-4" />
                  <p className="text-gray-700 font-medium">Generating WhatsApp QR Code...</p>
                  <p className="text-gray-400 text-xs mt-1">Please wait a few seconds</p>
                </div>
              ) : qrCode ? (
                <div>
                  <div className="bg-white p-4 rounded-2xl shadow-xl border border-gray-100 inline-block mb-4">
                    <QRCodeSVG value={qrCode} size={250} level="M" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-800 mb-1">Scan with WhatsApp</h3>
                  <p className="text-gray-500 text-xs max-w-md mx-auto mb-4">
                    Open WhatsApp on your phone → Settings / Menu → <strong>Linked Devices</strong> → <strong>Link a Device</strong> and scan this code.
                  </p>
                  <button
                    onClick={() => fetchQr(true)}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
                  >
                    Refresh QR Code
                  </button>
                </div>
              ) : (
                <div className="py-6 text-center">
                  <Smartphone size={56} className="text-gray-300 mx-auto mb-3" />
                  <h3 className="text-base font-semibold text-gray-800 mb-2">Ready to Link WhatsApp</h3>
                  <button
                    onClick={() => fetchQr()}
                    className="px-6 py-2.5 bg-[#25D366] text-white rounded-lg hover:bg-[#1ebe5d] transition font-bold text-sm shadow-md"
                  >
                    Display QR Code Now
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Mode 2: Phone Pairing Code */}
          {connectMode === "pairing" && (
            <div className="py-4">
              <h3 className="text-base font-bold text-gray-800 mb-1 text-center">Link via Mobile Number</h3>
              <p className="text-gray-500 text-xs text-center mb-6 max-w-md mx-auto">
                Enter your mobile number with country code (e.g. 919876543210) to receive an 8-character WhatsApp pairing code.
              </p>

              {pairingError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg text-center">
                  {pairingError}
                </div>
              )}

              {pairingCode ? (
                <div className="text-center py-4 bg-emerald-50 border border-emerald-200 rounded-2xl p-6">
                  <p className="text-xs text-emerald-700 font-semibold mb-2">YOUR WHATSAPP PAIRING CODE</p>
                  <div className="text-3xl font-mono font-black text-emerald-900 tracking-widest bg-white py-3 px-6 rounded-xl border border-emerald-300 inline-block mb-3 shadow-inner">
                    {pairingCode}
                  </div>
                  <p className="text-xs text-emerald-800 max-w-sm mx-auto">
                    Open WhatsApp on phone → Linked Devices → <strong>Link with phone number instead</strong> → Enter this code.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleRequestPairingCode} className="space-y-4 max-w-md mx-auto">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Mobile Number (with Country Code)</label>
                    <input
                      type="text"
                      placeholder="e.g. 919876543210"
                      value={pairingPhone}
                      onChange={(e) => setPairingPhone(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#25D366]"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={pairingLoading || !pairingPhone}
                    className="w-full py-3 bg-[#25D366] text-white rounded-lg font-bold text-sm hover:bg-[#1ebe5d] transition flex items-center justify-center gap-2 shadow-md disabled:opacity-50"
                  >
                    {pairingLoading ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>Generating Code...</span>
                      </>
                    ) : (
                      <span>Get 8-Digit Pairing Code</span>
                    )}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 h-[calc(100vh-80px)] flex flex-col">
      <WhatsAppNav />
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-3">
          <MessageCircle className="text-[#25D366]" size={28} />
          <h1 className="text-xl font-bold text-gray-800">WhatsApp Live Chat & Web</h1>
          {status.phone && (
            <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
              {status.phone}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
            title="Refresh"
          >
            <RefreshCw size={18} />
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition text-sm"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">Disconnect</span>
          </button>
        </div>
      </div>

      <div className="flex-1 flex gap-0 bg-white rounded-xl border border-gray-200 overflow-hidden min-h-0">
        <div className={`w-full md:w-80 border-r border-gray-200 flex flex-col ${showMobileChat ? "hidden md:flex" : "flex"}`}>
          <div className="p-3 border-b border-gray-100 flex items-center gap-2">
            <input
              type="text"
              placeholder="Search contacts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 bg-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]/30"
            />
            <button
              onClick={() => fetchChats(true)}
              className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition flex-shrink-0"
              title={`Sync all contacts (${chats.length} loaded)`}
            >
              <RefreshCw size={16} className={chatsLoading ? "animate-spin" : ""} />
            </button>
          </div>
          {chats.length > 0 && (
            <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-100 text-[10px] text-gray-500 font-semibold flex items-center gap-2">
              <span className="text-[#25D366]">●</span>
              <span>{chats.filter(c => (c.name || "").toLowerCase().includes(searchTerm.toLowerCase()) || (c.id || "").includes(searchTerm)).length} contacts {searchTerm ? `of ${chats.length}` : "total"}</span>
            </div>
          )}
          <div className="flex-1 overflow-y-auto">
            {chatsLoading && chats.length === 0 ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 size={24} className="animate-spin text-gray-400" />
              </div>
            ) : chats.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-6 text-gray-400 text-sm text-center">
                <MessageCircle size={32} className="mb-2 text-[#25D366]" />
                <p className="font-semibold text-gray-700 mb-1">No chats loaded yet</p>
                <p className="text-xs text-gray-500 mb-3">Syncing WhatsApp history & CRM contacts...</p>
                <button
                  onClick={() => fetchChats(true)}
                  className="px-4 py-2 bg-[#25D366] text-white rounded-lg text-xs font-semibold hover:bg-[#1ebe5d] transition shadow-sm flex items-center gap-1.5"
                >
                  <RefreshCw size={14} className={chatsLoading ? "animate-spin" : ""} />
                  <span>Sync Contacts & Chats</span>
                </button>
              </div>
            ) : (
              chats
                .filter(c => (c.name || "").toLowerCase().includes(searchTerm.toLowerCase()) || (c.id || "").includes(searchTerm))
                .map((chat) => {
                  const sourceColors = {
                    "Client": "bg-blue-100 text-blue-700",
                    "Telecalling": "bg-orange-100 text-orange-700",
                    "Walkin": "bg-purple-100 text-purple-700",
                    "Field": "bg-teal-100 text-teal-700",
                  };
                  const isActive = selectedChat?.id === chat.id;
                  return (
                    <button
                      key={chat.id}
                      onClick={() => handleSelectChat(chat)}
                      className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition text-left border-l-2 ${isActive ? "bg-[#25D366]/10 border-[#25D366]" : "border-transparent"}`}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-bold text-sm ${isActive ? "bg-[#25D366] text-white" : "bg-[#25D366]/15 text-[#25D366]"}`}>
                        {(chat.name || "?").charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-semibold text-gray-800 text-sm truncate">{chat.name}</span>
                          {chat.unreadCount > 0 && (
                            <span className="bg-[#25D366] text-white text-[10px] px-1.5 py-0.5 rounded-full shrink-0 font-bold">
                              {chat.unreadCount}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {chat.source && (
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${sourceColors[chat.source] || "bg-gray-100 text-gray-600"}`}>
                              {chat.source}
                            </span>
                          )}
                          <span className="text-gray-400 text-xs truncate">{chat.id.split("@")[0].replace(/^91/, "+91 ")}</span>
                        </div>
                      </div>
                    </button>
                  );
                })
            )}
          </div>
        </div>

        <div className={`flex-1 flex flex-col min-w-0 ${!showMobileChat ? "hidden md:flex" : "flex"}`}>
          {selectedChat ? (
            <>
              <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-gray-50 shrink-0">
                <button
                  onClick={() => setShowMobileChat(false)}
                  className="md:hidden p-1 hover:bg-gray-200 rounded"
                >
                  <ChevronLeft size={20} />
                </button>
                <div className="w-10 h-10 rounded-full bg-[#25D366]/20 flex items-center justify-center">
                  <MessageCircle size={20} className="text-[#25D366]" />
                </div>
                <div>
                  <p className="font-medium text-gray-800 text-sm">{selectedChat.name}</p>
                  <p className="text-xs text-gray-500">Online</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50">
                {messagesLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 size={24} className="animate-spin text-gray-400" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                    No messages yet
                  </div>
                ) : (
                  [...messages].reverse().map((msg) => (
                    <div
                      key={msg.id || msg.timestamp}
                      className={`flex ${msg.isMe ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[75%] px-4 py-2 rounded-2xl text-sm ${
                          msg.isMe
                            ? "bg-[#25D366] text-white rounded-br-md"
                            : "bg-white text-gray-800 border border-gray-200 rounded-bl-md"
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                        <p
                          className={`text-xs mt-1 ${
                            msg.isMe ? "text-white/70" : "text-gray-400"
                          }`}
                        >
                          {msg.timestamp
                            ? new Date(msg.timestamp * 1000).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : ""}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="flex items-center gap-2 p-3 border-t border-gray-100 bg-white shrink-0">
                <input
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-2.5 bg-gray-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]/30"
                  disabled={sending}
                />
                <button
                  onClick={handleSend}
                  disabled={!messageInput.trim() || sending}
                  className="p-2.5 bg-[#25D366] text-white rounded-full hover:bg-[#1ebe5d] transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sending ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Send size={18} />
                  )}
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <MessageCircle size={64} className="mb-4 text-gray-300" />
              <p className="text-lg font-medium text-gray-500">Select a chat</p>
              <p className="text-sm">Choose a conversation from the left panel</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
