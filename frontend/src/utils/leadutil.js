// utils/leadutil.js

import { parseDate } from "./dateCompat";

export const getToday = () => {
  const d = new Date();
  return d.getFullYear() + '-' + 
         String(d.getMonth() + 1).padStart(2, '0') + '-' + 
         String(d.getDate()).padStart(2, '0');
};

export const normalizeDate = (dateStr) => {
  if (!dateStr) return "";
  if (dateStr instanceof Date) {
    if (isNaN(dateStr.getTime())) return "";
    return `${dateStr.getFullYear()}-${String(dateStr.getMonth() + 1).padStart(2, '0')}-${String(dateStr.getDate()).padStart(2, '0')}`;
  }
  if (typeof dateStr === 'string') {
    const trimmed = dateStr.trim();
    if (!trimmed) return "";

    // If ISO string with T (e.g. "2026-08-10T18:30:00.000Z"), parse as Date to get local date
    if (trimmed.includes("T")) {
      const d = new Date(trimmed);
      if (!isNaN(d.getTime())) {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      }
    }

    // Matches YYYY-MM-DD
    const ymd = /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/.exec(trimmed);
    if (ymd) {
      return `${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`;
    }

    // Matches DD/MM/YYYY
    const dmy = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/.exec(trimmed);
    if (dmy) {
      return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
    }
  }
  const d = parseDate(dateStr);
  if (isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const isThisMonth = (dateStr) => {
  if (!dateStr) return false;
  const d = parseDate(dateStr);
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
};

export const departmentCount = (data = [], key) => ({
  New: data.filter(item => item[key] === "New").length,
  Converted: data.filter(item => item[key] === "Converted").length,
  Disqualified: data.filter(item => item[key] === "Disqualified").length,
});

export const bottomText = (count, label) =>
  count === 0 ? `No ${label} Leads Today` : `${count} ${label} Leads Today`;

export const getWhatsAppWelcomeUrl = (phone, customerName) => {
  const cleanPhone = (phone || "").toString().replace(/\D/g, "").slice(-10);
  if (!cleanPhone) return "#";

  let execName = "Executive";
  try {
    const u = JSON.parse(localStorage.getItem("user") || "{}");
    execName = u.first_name ? `${u.first_name} ${u.last_name || ""}`.trim() : (u.name || u.username || "Executive");
  } catch (_) {}

  const clientName = customerName ? customerName.trim() : "Valued Customer";

  const text = `Hello ${clientName},\n\nWelcome to ACHME Communication! 🌟\n\nI am ${execName}, Executive from ACHME Communication. Thank you for connecting with us.\n\nHow can I assist you with your requirements today?\n\nBest Regards,\n${execName}\nACHME Communication`;

  return `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(text)}`;
};