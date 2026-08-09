import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { Search, X, User, Building2, Phone, MapPin, Loader2, ChevronRight, Check, Sparkles } from "lucide-react";
import { API } from "../config";

const ClientSearchDropdown = ({ 
  value, 
  onSelect, 
  placeholder = "Search client name, company, phone or email...",
  required = false,
  className = "" 
}) => {
  const [searchTerm, setSearchTerm] = useState(value || "");
  const [results, setResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedClientData, setSelectedClientData] = useState(null);
  const [chosenCompany, setChosenCompany] = useState(null);
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [pendingClient, setPendingClient] = useState(null);
  const dropdownRef = useRef(null);

  // Sync internal search term with external value if it changes externally
  useEffect(() => {
    setSearchTerm(value || "");
  }, [value]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getAuthConfig = () => {
    const token = localStorage.getItem("token");
    return { headers: { Authorization: `Bearer ${token}` } };
  };

  const handleSearch = async (val) => {
    setSearchTerm(val);
    if (val.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    try {
      const res = await axios.get(`${API}/api/client/search?name=${encodeURIComponent(val)}`, getAuthConfig());
      setResults(res.data || []);
      setIsOpen(true);
    } catch (error) {
      console.error("Client search error:", error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClientClick = (client) => {
    const companies = client.companies && client.companies.length > 0
      ? client.companies
      : [{
          company_name: client.company_name || "",
          gst_number: client.gst_number || "",
          address: client.address || "",
          address_2: client.address_2 || "",
          city: client.city || "",
          state: client.state || "",
          pincode: client.pincode || "",
          phone: client.phone || "",
          email: client.email || "",
          is_primary: 1
        }];

    if (companies.length > 1) {
      setPendingClient(client);
      setShowCompanyModal(true);
      setIsOpen(false);
    } else {
      confirmSelection(client, companies[0]);
    }
  };

  const confirmSelection = (client, company) => {
    const finalClient = {
      ...client,
      company_name: company?.company_name || client.company_name || "",
      gst_number: company?.gst_number || client.gst_number || "",
      address: company?.address || client.address || "",
      address_2: company?.address_2 || client.address_2 || "",
      city: company?.city || client.lead_city || client.city || "",
      state: company?.state || client.state || "",
      pincode: company?.pincode || client.pincode || "",
      phone: company?.phone || client.phone || "",
      email: company?.email || client.email || "",
      selectedCompany: company
    };

    setSelectedClientData(client);
    setChosenCompany(company);
    setSearchTerm(finalClient.name || "");
    setIsOpen(false);
    setShowCompanyModal(false);
    setPendingClient(null);
    onSelect(finalClient);
  };

  const clearSearch = () => {
    setSearchTerm("");
    setResults([]);
    setIsOpen(false);
    setSelectedClientData(null);
    setChosenCompany(null);
    onSelect({ name: "", phone: "", email: "", gst_number: "", city: "", state: "", address: "", address_2: "", company_name: "" });
  };

  return (
    <div className={`relative w-full ${className}`} ref={dropdownRef}>
      <div className="relative group">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors">
          {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
        </div>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => searchTerm.length >= 2 && setIsOpen(true)}
          placeholder={placeholder}
          required={required}
          autoComplete="off"
          className="w-full pl-10 pr-10 py-2.5 bg-white border border-gray-200 rounded-xl outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50/50 transition-all text-sm font-medium placeholder:text-gray-400"
        />
        {searchTerm && (
          <button
            type="button"
            onClick={clearSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 transition-colors p-1 rounded-full hover:bg-gray-100"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Selected Company Branch Pill Indicator */}
      {selectedClientData && selectedClientData.companies && selectedClientData.companies.length > 1 && chosenCompany && (
        <div className="mt-1.5 flex items-center justify-between px-3 py-1.5 bg-purple-50 border border-purple-200 rounded-lg text-xs">
          <div className="flex items-center gap-1.5 text-purple-900 font-medium overflow-hidden text-ellipsis whitespace-nowrap">
            <Building2 size={13} className="text-purple-600 shrink-0" />
            <span>Company: <strong>{chosenCompany.company_name || selectedClientData.company_name}</strong></span>
            {chosenCompany.gst_number && (
              <span className="text-[10px] bg-purple-200 text-purple-800 px-1.5 py-0.2 rounded font-mono font-bold">
                GST: {chosenCompany.gst_number}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => { setPendingClient(selectedClientData); setShowCompanyModal(true); }}
            className="text-[11px] font-bold text-purple-700 hover:text-purple-900 underline shrink-0 ml-2"
          >
            Change Branch
          </button>
        </div>
      )}

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-[9999] left-0 right-0 mt-2 bg-white border border-gray-100 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 origin-top">
          <div className="max-h-80 overflow-y-auto custom-scrollbar">
            {results.length > 0 ? (
              results.map((client) => {
                const companiesList = client.companies && client.companies.length > 0
                  ? client.companies
                  : [{
                      company_name: client.company_name || "",
                      gst_number: client.gst_number || "",
                      address: client.address || "",
                      address_2: client.address_2 || "",
                      city: client.city || "",
                      state: client.state || "",
                      pincode: client.pincode || "",
                      phone: client.phone || "",
                      email: client.email || "",
                      is_primary: 1
                    }];

                const hasMultipleCompanies = companiesList.length > 1;

                return (
                  <div key={client.id} className="border-b border-gray-50 last:border-b-0">
                    {/* Client Header */}
                    <div 
                      onClick={() => handleClientClick(client)}
                      className="px-4 py-2.5 bg-gray-50/90 hover:bg-blue-50 cursor-pointer flex items-center justify-between border-b border-gray-100 transition-colors group"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center font-bold text-xs group-hover:bg-blue-600 group-hover:text-white transition-colors">
                          {client.name?.charAt(0).toUpperCase() || "C"}
                        </div>
                        <span className="font-bold text-gray-800 text-sm group-hover:text-blue-700 transition-colors">
                          {client.name}
                        </span>
                      </div>
                      {hasMultipleCompanies ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Sparkles size={10} /> {companiesList.length} Companies (Select)
                          </span>
                          <ChevronRight size={14} className="text-gray-400" />
                        </div>
                      ) : (
                        client.gst_number && (
                          <span className="text-[10px] font-black bg-green-100 text-green-700 px-2 py-0.5 rounded-full uppercase tracking-tighter">
                            GST: {client.gst_number}
                          </span>
                        )
                      )}
                    </div>

                    {/* Company Branches list */}
                    <div className="divide-y divide-gray-50">
                      {companiesList.map((comp, idx) => (
                        <div
                          key={comp.id || idx}
                          onClick={() => confirmSelection(client, comp)}
                          className="px-4 py-2.5 hover:bg-blue-50/70 cursor-pointer transition-all group pl-6"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <Building2 size={13} className="text-blue-500 flex-shrink-0" />
                              <span className="font-semibold text-gray-700 text-xs group-hover:text-blue-700 transition-colors">
                                {comp.company_name || client.company_name || "Individual / Personal"}
                              </span>
                              {comp.is_primary === 1 && (
                                <span className="text-[9px] font-bold bg-blue-50 text-blue-600 px-1.5 py-0.2 border border-blue-200 rounded">
                                  Primary
                                </span>
                              )}
                            </div>
                            {comp.gst_number && (
                              <span className="text-[10px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded">
                                GST: {comp.gst_number}
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px] text-gray-500">
                            <div className="flex items-center gap-1 overflow-hidden text-ellipsis whitespace-nowrap">
                              <Phone size={11} className="text-gray-400 flex-shrink-0" />
                              {comp.phone || client.phone || "No contact"}
                            </div>
                            <div className="flex items-center gap-1 overflow-hidden text-ellipsis whitespace-nowrap col-span-1">
                              <MapPin size={11} className="text-gray-400 flex-shrink-0" />
                              {comp.address ? `${comp.address}, ${comp.city || ""}` : (client.address ? `${client.address}, ${client.city || ""}` : "No address")}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="px-6 py-10 text-center">
                <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
                  <User size={24} className="text-gray-300" />
                </div>
                <p className="text-sm text-gray-500 font-medium">No results found for "{searchTerm}"</p>
                <p className="text-xs text-gray-400 mt-1">Try a different name, company, GST, phone or email</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Interactive Modal: "Choose Which Company to Continue" */}
      {showCompanyModal && pendingClient && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[10000] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden border border-gray-200 animate-scale-in">
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-700 to-indigo-700 px-6 py-4 text-white flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center font-bold text-lg">
                  <Building2 size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-base font-display">Choose Company / Branch</h3>
                  <p className="text-xs text-purple-100">Client: <strong>{pendingClient.name}</strong></p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setShowCompanyModal(false)}
                className="text-purple-200 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
              <div className="p-3 bg-purple-50 rounded-xl border border-purple-100 flex items-center gap-2 text-xs text-purple-800 font-medium">
                <Sparkles size={16} className="text-purple-600 shrink-0" />
                This customer has multiple registered companies/addresses. Select which company details to use for this document:
              </div>

              <div className="space-y-3">
                {(pendingClient.companies && pendingClient.companies.length > 0 ? pendingClient.companies : [pendingClient]).map((comp, idx) => (
                  <div
                    key={comp.id || idx}
                    onClick={() => confirmSelection(pendingClient, comp)}
                    className="p-4 rounded-xl border-2 border-gray-100 hover:border-purple-500 hover:bg-purple-50/40 cursor-pointer transition-all group relative shadow-xs"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Building2 size={16} className="text-purple-600" />
                        <span className="font-bold text-gray-900 text-sm group-hover:text-purple-700 transition-colors">
                          {comp.company_name || pendingClient.company_name || "Primary / Personal"}
                        </span>
                        {comp.is_primary === 1 && (
                          <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                            Primary
                          </span>
                        )}
                      </div>
                      {comp.gst_number && (
                        <span className="text-xs font-mono font-bold bg-green-100 text-green-700 px-2.5 py-0.5 rounded-full">
                          GST: {comp.gst_number}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-600 mt-2">
                      <div className="flex items-center gap-1.5">
                        <Phone size={13} className="text-gray-400" /> Phone: <span className="font-semibold text-gray-800">{comp.phone || pendingClient.phone || "—"}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <User size={13} className="text-gray-400" /> Email: <span className="font-semibold text-gray-800">{comp.email || pendingClient.email || "—"}</span>
                      </div>
                      <div className="flex items-start gap-1.5 col-span-1 sm:col-span-2">
                        <MapPin size={13} className="text-gray-400 mt-0.5 shrink-0" /> Address: <span className="font-semibold text-gray-800">{[comp.address, comp.address_2, comp.city, comp.state, comp.pincode].filter(Boolean).join(", ") || "—"}</span>
                      </div>
                    </div>

                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        className="px-4 py-1.5 rounded-lg bg-purple-600 group-hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1"
                      >
                        <Check size={14} /> Select & Continue
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="bg-gray-50 border-t border-gray-200 px-6 py-3 flex justify-end">
              <button
                type="button"
                onClick={() => setShowCompanyModal(false)}
                className="px-4 py-2 rounded-lg text-xs font-bold text-gray-600 bg-white border border-gray-300 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientSearchDropdown;
