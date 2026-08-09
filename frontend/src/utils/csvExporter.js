// Utility function for exporting Lead and Telecalling data to CSV files safely
export const exportLeadsToCSV = (leads = [], filename = "Leads_Export.csv") => {
  if (!leads || leads.length === 0) {
    alert("No records available to export!");
    return;
  }

  const headers = [
    "ID",
    "Customer Name",
    "Company Name",
    "GST Number",
    "Mobile Number",
    "Email",
    "Location / City",
    "Service Interest",
    "Status / Outcome",
    "Lead / Call Date",
    "Followup Required",
    "Followup Date",
    "Reminder Required",
    "Reminder Date",
    "Remarks / Notes",
    "Staff / Creator",
    "Created At"
  ];

  const escapeCSV = (val) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = leads.map(l => [
    escapeCSV(l.id || ""),
    escapeCSV(l.customer_name || l.name || l.lead_name || ""),
    escapeCSV(l.company_name || ""),
    escapeCSV(l.gst_number || ""),
    escapeCSV(l.mobile_number || l.phone || l.mobile || ""),
    escapeCSV(l.email || l.lead_email || ""),
    escapeCSV(l.location_city || l.city || l.lead_city || l.address || ""),
    escapeCSV(l.service || l.purpose || l.service_interest || ""),
    escapeCSV(l.call_outcome || l.lead_status || l.status || "New"),
    escapeCSV(l.call_date || l.walkin_date || l.created_at || ""),
    escapeCSV(l.followup_required || (l.followup_date ? "Yes" : "No")),
    escapeCSV(l.followup_date || ""),
    escapeCSV(l.reminder_required || (l.reminder_date ? "Yes" : "No")),
    escapeCSV(l.reminder_date || ""),
    escapeCSV(l.remarks || l.notes || l.call_details || ""),
    escapeCSV(l.creator_name || l.assigned_to || l.staff_name || ""),
    escapeCSV(l.created_at || "")
  ]);

  const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
