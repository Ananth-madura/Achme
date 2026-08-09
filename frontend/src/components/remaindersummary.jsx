import React, { useState } from "react";
import "../Styles/tailwind.css";
import { useNavigate } from "react-router-dom";
import { Bell, ChevronRight, CheckCircle2, AlertCircle } from "lucide-react";

const Remainder = ({ data, notes }) => {
  const [activeTab3, setActiveTab3] = useState("Todays");
  const navigate = useNavigate();

  const remainderTabs = [
    { label: "Todays", count: data?.Todays || 0, badge: "bg-purple-500 text-white", text: "text-purple-600" },
    { label: "Due", count: data?.Due || 0, badge: "bg-emerald-600 text-white", text: "text-emerald-600" },
    { label: "Overdue", count: data?.Overdue || 0, badge: "bg-rose-600 text-white", text: "text-rose-600" },
  ];

  const remainderBottomText = (count, type) => {
    if (count === 0) {
      if (type === "Overdue") return "No Overdue Reminders";
      return `No Reminders ${type}`;
    }
    return `${count} ${type} Reminders Active`;
  };

  return (
    <div className="w-full card p-4 md:p-5 flex flex-col justify-between h-full">
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-base text-ink flex items-center gap-2">
            <Bell className="w-4.5 h-4.5 text-purple-500" />
            Reminder Summary
          </h2>
          <button
            onClick={() => navigate(`/dashboard/followupslist?type=${activeTab3}`)}
            className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
          >
            View List <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        <div className="flex justify-around gap-2 bg-surface p-1.5 rounded-xl border border-hairline mb-4">
          {remainderTabs.map((item) => (
            <button
              key={item.label}
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab3 === item.label
                  ? "bg-white text-ink shadow-sm"
                  : "text-muted hover:text-ink"
              }`}
              onClick={() => setActiveTab3(item.label)}
            >
              <span>{item.label}</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${item.badge}`}>
                {item.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="pt-2 border-t border-hairline/60">
        {notes?.[activeTab3]?.length > 0 ? (
          <div
            onClick={() => navigate(`/dashboard/followupslist?type=${activeTab3}`)}
            className="p-2.5 rounded-lg bg-purple-50/60 border border-purple-100 hover:bg-purple-100/60 cursor-pointer transition-all flex items-start gap-2"
          >
            <AlertCircle className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-ink line-clamp-2">
                {notes[activeTab3][0].reminder_notes}
              </p>
              {notes[activeTab3][0].customer_name && (
                <p className="text-[10px] text-muted font-medium mt-0.5">
                  Lead: {notes[activeTab3][0].customer_name}
                </p>
              )}
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-muted shrink-0 self-center" />
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-muted font-medium justify-center py-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>{remainderBottomText(data?.[activeTab3] || 0, activeTab3)}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default Remainder;