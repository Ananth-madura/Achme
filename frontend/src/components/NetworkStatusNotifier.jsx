import React, { useState, useEffect } from "react";
import { WifiOff, AlertTriangle, RefreshCw, CheckCircle, Clock } from "lucide-react";
import axios from "axios";
import { API } from "../config/api";

const API_BACKEND = API;

export default function NetworkStatusNotifier() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [serverStatus, setServerStatus] = useState("online"); // "online" | "offline" | "slow"
  const [latency, setLatency] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    let timerId;
    let consecutiveFailures = 0;

    const checkServerHealth = async () => {
      if (!navigator.onLine) {
        setServerStatus("offline");
        return;
      }

      const start = performance.now();
      let ok = false;
      try {
        await axios.get(`${API_BACKEND}/api/health`, { timeout: 10000 });
        ok = true;
      } catch (err) {
        try {
          await axios.get("/api/health", { timeout: 10000 });
          ok = true;
        } catch (err2) {
          ok = false;
        }
      }

      if (ok) {
        consecutiveFailures = 0;
        const duration = Math.round(performance.now() - start);
        setLatency(duration);
        setServerStatus("online");
        setRetryCount(0);
      } else {
        consecutiveFailures++;
        if (consecutiveFailures >= 2) {
          setServerStatus("offline");
          setRetryCount((prev) => prev + 1);
        }
      }
    };

    checkServerHealth();
    timerId = setInterval(checkServerHealth, serverStatus === "offline" ? 10000 : 30000);

    return () => clearInterval(timerId);
  }, [serverStatus]);

  if (isOnline && serverStatus === "online") {
    return null;
  }

  return (
    <div className="fixed top-2 left-1/2 -translate-x-1/2 z-[99999] w-[92%] max-w-lg shadow-2xl rounded-xl overflow-hidden transition-all duration-300 animate-bounce-short">
      {!isOnline && (
        <div className="bg-red-600 text-white px-4 py-3 flex items-center justify-between text-sm font-semibold">
          <div className="flex items-center gap-2">
            <WifiOff size={18} className="animate-pulse" />
            <span>Network Offline: Check your internet connection</span>
          </div>
          <span className="text-xs bg-red-800 px-2 py-0.5 rounded">Offline</span>
        </div>
      )}

      {isOnline && serverStatus === "offline" && (
        <div className="bg-amber-600 text-white px-4 py-3 flex items-center justify-between text-sm font-semibold">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="animate-bounce" />
            <span>Server Disconnected / Restarting. Retrying... {retryCount > 0 && `(${retryCount})`}</span>
          </div>
          <div className="flex items-center gap-1 text-xs bg-amber-800 px-2.5 py-1 rounded">
            <RefreshCw size={12} className="animate-spin" />
            <span>Reconnecting</span>
          </div>
        </div>
      )}

      {isOnline && serverStatus === "slow" && (
        <div className="bg-yellow-500 text-gray-900 px-4 py-2.5 flex items-center justify-between text-xs font-bold">
          <div className="flex items-center gap-2">
            <Clock size={16} />
            <span>Slow Network Detected ({latency}ms latency). Responses may take a moment.</span>
          </div>
          <span className="bg-yellow-700 text-white px-2 py-0.5 rounded text-[10px]">Slow</span>
        </div>
      )}
    </div>
  );
}
