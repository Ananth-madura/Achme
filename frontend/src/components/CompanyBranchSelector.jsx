import React, { useState, useEffect } from "react";
import { Building2, ChevronDown, Edit3 } from "lucide-react";

const CompanyBranchSelector = ({
  companies = [],
  value = "",
  onSelectCompany,
  onCustomChange,
  placeholder = "Company Name",
  className = ""
}) => {
  const [isCustomMode, setIsCustomMode] = useState(false);

  // If user clears or if companies list changes, reset custom mode if value matches one of the companies
  useEffect(() => {
    if (companies && companies.length > 0) {
      const match = companies.find(c => c.company_name === value);
      if (match) {
        setIsCustomMode(false);
      }
    }
  }, [value, companies]);

  if (!companies || companies.length === 0 || isCustomMode) {
    return (
      <div className={`relative flex items-center ${className}`}>
        <input
          type="text"
          value={value}
          onChange={(e) => onCustomChange(e.target.value)}
          placeholder={placeholder}
          className="w-full border rounded-lg px-3 py-2 text-sm outline-none bg-white text-gray-900 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
        {companies && companies.length > 0 && (
          <button
            type="button"
            onClick={() => setIsCustomMode(false)}
            title="Switch back to company dropdown list"
            className="absolute right-2 px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-[11px] font-bold rounded flex items-center gap-1 transition-colors"
          >
            <Building2 size={12} /> List
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`relative flex items-center ${className}`}>
      <select
        value={value}
        onChange={(e) => {
          const selectedVal = e.target.value;
          if (selectedVal === "__CUSTOM__") {
            setIsCustomMode(true);
            onCustomChange("");
          } else {
            const comp = companies.find((c) => (c.company_name || "") === selectedVal);
            if (comp) {
              onSelectCompany(comp);
            } else {
              onCustomChange(selectedVal);
            }
          }
        }}
        className="w-full border rounded-lg px-3 py-2 text-sm outline-none bg-white text-gray-900 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-semibold cursor-pointer appearance-none pr-8"
      >
        <option value="">-- Select Company / Branch --</option>
        {companies.map((comp, idx) => (
          <option key={comp.id || idx} value={comp.company_name || ""}>
            {comp.company_name || "Primary Branch"} {comp.gst_number ? `(GST: ${comp.gst_number})` : ""} {comp.city ? `- ${comp.city}` : ""} {comp.is_primary === 1 ? "(Primary)" : ""}
          </option>
        ))}
        <option value="__CUSTOM__">✏️ Enter Custom Company Name...</option>
      </select>
      <div className="absolute right-3 pointer-events-none text-gray-400">
        <ChevronDown size={16} />
      </div>
    </div>
  );
};

export default CompanyBranchSelector;
