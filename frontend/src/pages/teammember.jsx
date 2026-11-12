import React, { useState, useEffect, useMemo } from "react";
import "../Styles/tailwind.css";
import {
  Search, Plus, X, Trash2, Edit, Mail, UserCheck, AlertCircle,
  CheckSquare, Zap, Key, Ban, Unlock, Users, Shield, Phone,
  MapPin, Briefcase, ChevronDown, Star, Eye, EyeOff, RefreshCw,
  LayoutGrid, List, Lock, CheckCircle
} from "lucide-react";
import axios from "axios";
import { useAuth } from "../auth/AuthContext";
import { API } from "../config/api";
import { isServiceEngineer } from "../utils/serviceEngineerHelper";

/* ─── Avatar Helper ─────────────────────────────────────────── */
const AVATAR_COLORS = [
  ["#6366f1","#fff"],["#f43f5e","#fff"],["#0ea5e9","#fff"],
  ["#10b981","#fff"],["#f59e0b","#fff"],["#8b5cf6","#fff"],
  ["#ec4899","#fff"],["#14b8a6","#fff"],["#f97316","#fff"],["#64748b","#fff"],
];
const getAvatar = (name = "") => {
  const initials = name.split(" ").map(n => n[0]).filter(Boolean).slice(0,2).join("").toUpperCase() || "?";
  const idx = name.charCodeAt(0) % AVATAR_COLORS.length;
  return { initials, bg: AVATAR_COLORS[idx][0], color: AVATAR_COLORS[idx][1] };
};

/* ─── Role badge helper ─────────────────────────────────────── */
const RoleBadge = ({ role }) => {
  const map = {
    admin:    { label: "Admin",     cls: "bg-purple-100 text-purple-700 border border-purple-200" },
    subadmin: { label: "Sub-Admin", cls: "bg-orange-100 text-orange-700 border border-orange-200" },
    employee: { label: "Employee",  cls: "bg-sky-100   text-sky-700    border border-sky-200" },
  };
  const r = map[role] || map.employee;
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${r.cls}`}>{r.label}</span>;
};

/* ─── Status badge ──────────────────────────────────────────── */
const StatusBadge = ({ status }) => {
  if (status === "active")  return <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" title="Active" />;
  if (status === "banned")  return <span className="w-2 h-2 rounded-full bg-red-500 inline-block"     title="Banned" />;
  if (status === "pending") return <span className="w-2 h-2 rounded-full bg-amber-400 inline-block"   title="Pending" />;
  return <span className="w-2 h-2 rounded-full bg-gray-300 inline-block" />;
};

/* ─── Stat card ─────────────────────────────────────────────── */
const StatCard = ({ icon: Icon, label, value, color }) => (
  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
    <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: color + "18" }}>
      <Icon size={20} style={{ color }} />
    </div>
    <div>
      <p className="text-2xl font-black text-gray-800">{value}</p>
      <p className="text-xs text-gray-400 font-medium">{label}</p>
    </div>
  </div>
);

/* ─── Input ─────────────────────────────────────────────────── */
const FI = ({ label, required, error, children }) => (
  <div className="space-y-1">
    <label className="text-xs font-semibold text-gray-600 block">
      {label}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
    {children}
    {error && <p className="text-red-500 text-[11px] flex items-center gap-1"><AlertCircle size={10}/>{error}</p>}
  </div>
);

const inp = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition placeholder:text-gray-300";
const inpErr = "border-red-300 focus:ring-red-100 focus:border-red-400";

/* ══════════════════════════════════════════════════════════════
   Main Component
══════════════════════════════════════════════════════════════ */
const Team = () => {
  /* ── View Mode ───────────────────────────────────────────── */
  const [viewMode, setViewMode] = useState(() => localStorage.getItem("team_view_mode") || "grid");

  const changeViewMode = (mode) => {
    setViewMode(mode);
    localStorage.setItem("team_view_mode", mode);
  };
  /* ── Modal toggles ──────────────────────────────────────── */
  const [open, setOpen]                   = useState(false);
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [mailOpen, setMailOpen]           = useState(false);
  const [assignOpen, setAssignOpen]       = useState(false);
  const [pwModalOpen, setPwModalOpen]     = useState(false);
  const [viewOpen, setViewOpen]           = useState(false);
  const [viewMember, setViewMember]       = useState(null);

  /* ── Mail state ─────────────────────────────────────────── */
  const [mailTo, setMailTo]           = useState("");
  const [mailSubject, setMailSubject] = useState("");
  const [mailMessage, setMailMessage] = useState("");
  const [mailName, setMailName]       = useState("");

  /* ── Assign Task state ──────────────────────────────────── */
  const [assignMember, setAssignMember] = useState(null);
  const [assignForm, setAssignForm]     = useState({ taskTargetId:"", taskTargetType:"task", title:"", description:"", dueDate:"", priority:"medium", notes:"", amount:"" });
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignErrors, setAssignErrors]   = useState({});
  const [taskTargets, setTaskTargets]     = useState([]);

  /* ── Role modal ─────────────────────────────────────────── */
  const [roleModalData, setRoleModalData] = useState(null);
  const [newUserRole, setNewUserRole]     = useState("");

  /* ── Password modal ─────────────────────────────────────── */
  const [pwModalMember, setPwModalMember] = useState(null);
  const [newPassword, setNewPassword]     = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw]               = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [pwLoading, setPwLoading]         = useState(false);
  const [pwSuccessMsg, setPwSuccessMsg]   = useState("");
  const [pwErrorMsg, setPwErrorMsg]       = useState("");

  /* ── Form state ─────────────────────────────────────────── */
  const [form, setForm] = useState({
    first_name:"", last_name:"", emp_email:"", mobile:"", mobile_number:"",
    job_title:"", emp_role:"", quotation_count:0, emp_id:"",
    user_password:"", repeat_password:"", system_role:"employee", emp_address:""
  });
  const [showFormPw, setShowFormPw]       = useState(false);
  const [formErrors, setFormErrors]       = useState({});
  const [isEdit, setIsEdit]               = useState(false);
  const [editId, setEditId]               = useState(null);
  const [editUserId, setEditUserId]       = useState(null);
  const [isLoading, setIsLoading]         = useState(false);

  /* ── List state ─────────────────────────────────────────── */
  const [team, setTeam]             = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [fetching, setFetching]     = useState(false);

  const { user: currentUser } = useAuth();
  const isAdminOrSubAdmin = currentUser?.role === "admin" || currentUser?.role === "subadmin";

  /* ── Fetch helpers ──────────────────────────────────────── */
  const getToken = () => localStorage.getItem("token");
  const cfg = () => ({ headers: { Authorization: `Bearer ${getToken()}` } });

  const fetchTeam = async () => {
    setFetching(true);
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const url = (user.role === "admin" || user.role === "subadmin")
        ? `${API}/api/teammember/admin`
        : `${API}/api/teammember`;
      const res = await axios.get(url, cfg());
      setTeam(res.data);
    } catch (err) { console.log("Error fetching team:", err); }
    finally { setFetching(false); }
  };

  const fetchTaskTargets = async () => {
    try {
      const [taskRes, targetRes] = await Promise.all([
        axios.get(`${API}/api/task`, cfg()),
        axios.get(`${API}/api/task/targets`, cfg()),
      ]);
      const tasks   = taskRes.data.map(t => ({ id: t.id, title: t.task_title || t.project_name || "Task", type: "task" }));
      const targets = targetRes.data.map(t => ({ id: t.id, title: `Target — ${t.user_name} (${t.monthly_target}/mo)`, type: "target" }));
      setTaskTargets([...tasks, ...targets]);
    } catch (_) {}
  };

  useEffect(() => {
    fetchTeam();
    fetchTaskTargets();
    const h = () => { fetchTeam(); fetchTaskTargets(); };
    window.addEventListener("refresh-team", h);
    window.addEventListener("refresh-dashboard", h);
    return () => { window.removeEventListener("refresh-team", h); window.removeEventListener("refresh-dashboard", h); };
  }, []);

  /* ── Derived lists ──────────────────────────────────────── */
  const nonEngineerTeam = useMemo(() => {
    return team.filter(m => !isServiceEngineer(m));
  }, [team]);

  const filtered = useMemo(() => {
    return nonEngineerTeam.filter(m => {
      const name = `${m.first_name} ${m.last_name}`.toLowerCase();
      const matchSearch = name.includes(searchTerm.toLowerCase()) ||
        (m.emp_id || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.emp_email || "").toLowerCase().includes(searchTerm.toLowerCase());
      const matchRole = roleFilter === "all" || m.user_role === roleFilter;
      return matchSearch && matchRole;
    });
  }, [nonEngineerTeam, searchTerm, roleFilter]);

  const stats = useMemo(() => ({
    total:    nonEngineerTeam.length,
    active:   nonEngineerTeam.filter(m => m.user_status === "active").length,
    admin:    nonEngineerTeam.filter(m => m.user_role === "admin").length,
    subadmin: nonEngineerTeam.filter(m => m.user_role === "subadmin").length,
  }), [nonEngineerTeam]);

  /* ── Form handlers ──────────────────────────────────────── */
  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (formErrors[e.target.name]) setFormErrors({ ...formErrors, [e.target.name]: null });
  };

  const validateForm = () => {
    const errors = {};
    if (!form.first_name?.trim()) errors.first_name = "First name is required";
    if (!form.last_name?.trim())  errors.last_name  = "Last name is required";
    if (!form.emp_email?.trim())  errors.emp_email  = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(form.emp_email)) errors.emp_email = "Invalid email format";
    if (!form.job_title?.trim())  errors.job_title  = "Job title is required";
    if (!form.emp_role?.trim())   errors.emp_role   = "Role is required";
    if (!isEdit) {
      if (!form.user_password) errors.user_password = "Password is required";
      if (form.user_password !== form.repeat_password) errors.repeat_password = "Passwords do not match";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const saveTeam = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsLoading(true);
    try {
      if (isEdit) {
        await axios.put(`${API}/api/teammember/${editId}`, {
          first_name: form.first_name, last_name: form.last_name, emp_email: form.emp_email,
          mobile: form.mobile, mobile_number: form.mobile_number || form.mobile,
          job_title: form.job_title, emp_role: form.emp_role,
          quotation_count: form.quotation_count, emp_id: form.emp_id, emp_address: form.emp_address
        }, cfg());
        if (editUserId && form.system_role) {
          try { await axios.put(`${API}/api/auth/change-role/${editUserId}`, { role: form.system_role }, cfg()); }
          catch (_) {}
        }
      } else {
        await axios.post(`${API}/api/auth/create-user`, {
          first_name: form.first_name, last_name: form.last_name, email: form.emp_email,
          emp_id: form.emp_id, job_title: form.job_title, emp_role: form.emp_role,
          mobile_number: form.mobile_number || form.mobile, emp_address: form.emp_address,
          user_password: form.user_password, system_role: form.system_role
        }, cfg());
      }
      fetchTeam();
      resetForm();
      setOpen(false);
      window.dispatchEvent(new Event("refresh-team"));
      window.dispatchEvent(new Event("refresh-dashboard"));
    } catch (err) {
      alert(err.response?.data?.message || "Error saving team member");
    } finally { setIsLoading(false); }
  };

  const resetForm = () => {
    setForm({ first_name:"", last_name:"", emp_email:"", mobile:"", mobile_number:"",
      job_title:"", emp_role:"", quotation_count:0, emp_id:"",
      user_password:"", repeat_password:"", system_role:"employee", emp_address:"" });
    setFormErrors({});
    setIsEdit(false);
    setEditId(null);
    setEditUserId(null);
    setShowFormPw(false);
  };

  const editTeam = (data) => {
    setForm({ first_name: data.first_name||"", last_name: data.last_name||"", emp_email: data.emp_email||"",
      mobile: data.mobile||"", mobile_number: data.mobile_number||data.mobile||"",
      job_title: data.job_title||"", emp_role: data.emp_role||"",
      quotation_count: data.quotation_count||0, emp_id: data.emp_id||"",
      user_password:"", repeat_password:"", system_role: data.user_role||"employee", emp_address: data.emp_address||"" });
    setEditId(data.id); setEditUserId(data.user_id||null); setIsEdit(true); setOpen(true);
  };

  const deleteTeamMember = async (id) => {
    if (!window.confirm("Delete this team member?")) return;
    setIsLoading(true);
    try { await axios.delete(`${API}/api/teammember/${id}`, cfg()); fetchTeam(); window.dispatchEvent(new Event("refresh-team")); }
    catch (err) { alert(err.response?.data?.message || "Error deleting"); }
    finally { setIsLoading(false); }
  };

  /* ── Mail ───────────────────────────────────────────────── */
  const openMailModal = (m) => { setMailTo(m.emp_email||""); setMailName(m.first_name||""); setMailSubject("Work Information"); setMailMessage(`Hello ${m.first_name},\n\n`); setMailOpen(true); };
  const handleSendMail = () => {
    if (!mailTo) return alert("No email address");
    window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(mailTo)}&su=${encodeURIComponent(mailSubject)}&body=${encodeURIComponent(mailMessage)}`, "_blank");
    setMailOpen(false);
  };

  /* ── Role ───────────────────────────────────────────────── */
  const openRoleModal = async (m) => {
    try {
      const res = await axios.get(`${API}/api/teammember/${m.id}`, cfg());
      setRoleModalData({ ...m, user_id: res.data.user_id, user_role: res.data.user_role });
      setNewUserRole(res.data.user_role || "employee");
    } catch { setRoleModalData(m); setNewUserRole(m.user_role||"employee"); }
    setRoleModalOpen(true);
  };
  const saveRole = async () => {
    if (!roleModalData?.user_id) return alert("No user account linked.");
    try {
      await axios.put(`${API}/api/auth/change-role/${roleModalData.user_id}`, { role: newUserRole }, cfg());
      setRoleModalOpen(false); fetchTeam();
    } catch (err) { alert("Failed: " + (err.response?.data?.message || err.message)); }
  };

  /* ── Password ───────────────────────────────────────────── */
  const openPwModal = (m) => {
    setPwModalMember(m);
    setNewPassword("");
    setConfirmPassword("");
    setShowPw(false);
    setShowConfirmPw(false);
    setPwSuccessMsg("");
    setPwErrorMsg("");
    setPwModalOpen(true);
  };
  const savePassword = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setPwErrorMsg("");
    setPwSuccessMsg("");
    if (!newPassword || newPassword.length < 6) {
      setPwErrorMsg("Password must be at least 6 characters long.");
      return;
    }
    if (confirmPassword && newPassword !== confirmPassword) {
      setPwErrorMsg("Passwords do not match.");
      return;
    }
    const targetId = pwModalMember?.user_id || pwModalMember?.id;
    if (!targetId) {
      setPwErrorMsg("No linked user account found for this member.");
      return;
    }
    setPwLoading(true);
    try {
      const res = await axios.post(`${API}/api/auth/reset-password/${targetId}`, { new_password: newPassword }, cfg());
      setPwSuccessMsg(res.data?.message || `Password for ${pwModalMember.first_name || "account"} updated successfully!`);
      setTimeout(() => {
        setPwModalOpen(false);
        setPwModalMember(null);
        setNewPassword("");
        setConfirmPassword("");
        setPwSuccessMsg("");
        setPwErrorMsg("");
      }, 1200);
    } catch (err) {
      setPwErrorMsg(err.response?.data?.message || err.message || "Failed to update password");
    } finally {
      setPwLoading(false);
    }
  };

  /* ── Ban/Unban ──────────────────────────────────────────── */
  const handleBan = async (m) => {
    if (!m?.user_id) return alert("No user account linked.");
    const newStatus = m.user_status === "banned" ? "active" : "banned";
    if (!window.confirm(`${newStatus === "banned" ? "Ban" : "Unban"} this user?`)) return;
    try {
      await axios.put(`${API}/api/auth/ban-user/${m.user_id}`, { status: newStatus }, cfg());
      fetchTeam();
    } catch (err) { alert("Failed: " + (err.response?.data?.message || err.message)); }
  };

  /* ── Assign ─────────────────────────────────────────────── */
  const openAssignModal = (m) => { setAssignMember(m); setAssignForm({ taskTargetId:"", taskTargetType:"task", title:"", description:"", dueDate:"", priority:"medium", notes:"", amount:"" }); setAssignErrors({}); setAssignOpen(true); };
  const saveAssignment = async (e) => {
    e.preventDefault();
    const errors = {};
    if (!assignForm.taskTargetId) errors.taskTargetId = "Select a task/target";
    if (!assignForm.dueDate)      errors.dueDate      = "Due date required";
    setAssignErrors(errors);
    if (Object.keys(errors).length) return;
    setAssignLoading(true);
    try {
      await axios.post(`${API}/api/task/assign`, {
        type: assignForm.taskTargetType,
        task_id:   assignForm.taskTargetType === "task"   ? assignForm.taskTargetId : null,
        target_id: assignForm.taskTargetType === "target" ? assignForm.taskTargetId : null,
        amount:    assignForm.taskTargetType === "target" ? assignForm.amount        : null,
        assigned_to_user_id: assignMember?.user_id || assignMember?.id,
        assigned_to_user_name: `${assignMember?.first_name} ${assignMember?.last_name}`.trim(),
        assigned_by: currentUser?.name || "Admin",
        due_date: assignForm.dueDate, priority: assignForm.priority, notes: assignForm.notes
      }, cfg());
      setAssignOpen(false); fetchTeam();
    } catch (err) { alert(err.response?.data?.message || "Error saving assignment"); }
    finally { setAssignLoading(false); }
  };

  /* ─────────────────────────────────────────────────────────
     RENDER
  ───────────────────────────────────────────────────────── */
  const ROLE_TABS = [
    { id:"all",      label:"All Members" },
    { id:"admin",    label:"Admin" },
    { id:"subadmin", label:"Sub-Admin" },
    { id:"employee", label:"Employee" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 p-4 md:p-6">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center mb-6">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Team Members</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            <a href="/dashboard" className="hover:text-blue-500 transition-colors">Dashboard</a>
            <span className="mx-1.5">›</span>Team
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Search */}
          <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-gray-200 shadow-sm flex-1 sm:w-64">
            <Search size={15} className="text-gray-400 shrink-0"/>
            <input type="text" placeholder="Search name, email, ID…" value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="outline-none text-sm w-full bg-transparent placeholder:text-gray-300"/>
            {searchTerm && <button onClick={() => setSearchTerm("")} className="text-gray-300 hover:text-gray-500"><X size={13}/></button>}
          </div>
          {/* Refresh */}
          <button onClick={fetchTeam} className="p-2 rounded-xl border border-gray-200 bg-white shadow-sm text-gray-500 hover:text-blue-600 hover:border-blue-200 transition" title="Refresh">
            <RefreshCw size={15} className={fetching ? "animate-spin" : ""}/>
          </button>
          {/* Quick Admin Password button */}
          {currentUser?.role === "admin" && (
            <button
              onClick={() => {
                const myMember = team.find(m => m.user_id === currentUser?.id || (m.emp_email && currentUser?.email && m.emp_email.toLowerCase() === currentUser.email.toLowerCase())) || {
                  first_name: currentUser?.name || "Admin",
                  last_name: "",
                  emp_email: currentUser?.email || "kk@achmecommunication.com",
                  user_role: "admin",
                  user_id: currentUser?.id,
                  id: currentUser?.id
                };
                openPwModal(myMember);
              }}
              className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 px-3 py-2 rounded-xl shadow-sm hover:bg-indigo-100 hover:border-indigo-300 transition-all font-semibold text-xs sm:text-sm"
              title="Change Admin Password"
            >
              <Key size={14} className="text-indigo-600"/>
              <span className="hidden md:inline">Admin Password</span>
              <span className="md:hidden">Password</span>
            </button>
          )}
          {/* Add button */}
          {isAdminOrSubAdmin && (
            <button onClick={() => { resetForm(); setOpen(true); }}
              className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-500 text-white px-4 py-2 rounded-xl shadow-md hover:shadow-lg hover:from-blue-700 hover:to-blue-600 transition-all font-semibold text-sm">
              <Plus size={16}/> Add Member
            </button>
          )}
        </div>
      </div>

      {/* ── Stat Cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <StatCard icon={Users}   label="Total Members"  value={stats.total}    color="#3b82f6"/>
        <StatCard icon={UserCheck} label="Active"        value={stats.active}  color="#10b981"/>
        <StatCard icon={Shield}  label="Admins"          value={stats.admin}   color="#8b5cf6"/>
        <StatCard icon={Briefcase} label="Sub-Admins"   value={stats.subadmin} color="#f59e0b"/>
      </div>

      {/* ── Controls Row: Role Filter Tabs & View Toggle ─────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex gap-1 bg-white rounded-xl border border-gray-100 shadow-sm p-1">
          {ROLE_TABS.map(tab => (
            <button key={tab.id} onClick={() => setRoleFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${roleFilter === tab.id ? "bg-blue-600 text-white shadow-sm" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"}`}>
              {tab.label}
              <span className={`ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${roleFilter === tab.id ? "bg-white/20" : "bg-gray-100 text-gray-400"}`}>
                {tab.id === "all" ? nonEngineerTeam.length : nonEngineerTeam.filter(m => m.user_role === tab.id).length}
              </span>
            </button>
          ))}
        </div>

        {/* Grid / List View Toggle */}
        <div className="flex items-center gap-1 bg-white rounded-xl border border-gray-100 shadow-sm p-1">
          <button
            onClick={() => changeViewMode("grid")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === "grid" ? "bg-blue-50 text-blue-600 border border-blue-100" : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
            }`}
            title="Grid View"
          >
            <LayoutGrid size={14} /> Grid
          </button>
          <button
            onClick={() => changeViewMode("list")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === "list" ? "bg-blue-50 text-blue-600 border border-blue-100" : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
            }`}
            title="List View"
          >
            <List size={14} /> List
          </button>
        </div>
      </div>

      {/* ── Member Cards / List Table ─────────────────────────── */}
      {fetching ? (
        <div className="flex items-center justify-center h-48 text-gray-400 text-sm gap-2">
          <RefreshCw size={16} className="animate-spin"/> Loading…
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-2">
          <Users size={32} className="opacity-30"/>
          <p className="text-sm">No members found</p>
        </div>
      ) : viewMode === "list" ? (
        /* ── LIST VIEW ─────────────────────────────────────── */
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-100 text-gray-500 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3.5 px-4">Member</th>
                  <th className="py-3.5 px-4">Role & Status</th>
                  <th className="py-3.5 px-4">Job Title & Position</th>
                  <th className="py-3.5 px-4">Contact Info</th>
                  <th className="py-3.5 px-4 text-center">Quotes</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((m) => {
                  const fullName = `${m.first_name} ${m.last_name}`.trim();
                  const av = getAvatar(fullName);
                  const isPrimary = m.emp_email?.toLowerCase() === "kk@achmecommunication.com";
                  const isBanned  = m.user_status === "banned";
                  return (
                    <tr key={m.id} className={`hover:bg-blue-50/30 transition-colors ${isBanned ? "bg-red-50/20" : ""}`}>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs flex-shrink-0"
                            style={{ background: av.bg + "22", color: av.bg }}>
                            {av.initials}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-gray-900 text-xs">{fullName}</span>
                              {isPrimary && <Star size={12} className="text-amber-400 shrink-0" title="Primary Admin" />}
                            </div>
                            <span className="text-[10px] font-mono text-gray-400">{m.emp_id || "—"}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-1 items-start">
                          <RoleBadge role={m.user_role} />
                          <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                            <StatusBadge status={m.user_status} />
                            <span className="capitalize">{m.user_status || "active"}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-gray-800 font-medium text-xs">{m.job_title || "—"}</div>
                        <div className="text-gray-400 text-[10px]">{m.emp_role || "—"}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-0.5 text-[11px] text-gray-600">
                          {m.emp_email && (
                            <div className="flex items-center gap-1">
                              <Mail size={11} className="text-gray-300 shrink-0" />
                              <span>{m.emp_email}</span>
                            </div>
                          )}
                          {(m.mobile || m.mobile_number) && (
                            <div className="flex items-center gap-1">
                              <Phone size={11} className="text-gray-300 shrink-0" />
                              <span>{m.mobile || m.mobile_number}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap items-center gap-1 text-[10px]">
                          <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-bold border border-blue-100" title="Quotations">
                            📄 {m.quotations_count || m.quotation_count || 0} Q
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold border border-indigo-100" title="Proformas">
                            🧾 {m.proformas_count || 0} PI
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-100" title="Clients">
                            👥 {m.clients_count || 0} C
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-bold border border-amber-100" title="Leads">
                            📞 {m.leads_count || 0} L
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 font-bold border border-purple-100" title="Services">
                            🔧 {m.services_count || 0} S
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 font-bold border border-sky-100" title="Tasks">
                            📋 {m.tasks_count || 0} T
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => { setViewMember(m); setViewOpen(true); }}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition" title="View Profile">
                            <Eye size={14}/>
                          </button>
                          <button onClick={() => openMailModal(m)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition" title="Send Email">
                            <Mail size={14}/>
                          </button>
                          {isAdminOrSubAdmin && (
                            <>
                              <button onClick={() => editTeam(m)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 transition" title="Edit">
                                <Edit size={14}/>
                              </button>
                              <button onClick={() => openAssignModal(m)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition" title="Assign Task">
                                <CheckSquare size={14}/>
                              </button>
                            </>
                          )}
                          {currentUser?.role === "admin" && (
                            <>
                              {!isPrimary && (
                                <button onClick={() => openRoleModal(m)}
                                  className="p-1.5 rounded-lg text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition" title="Change Role">
                                  <Zap size={14}/>
                                </button>
                              )}
                              <button onClick={() => openPwModal(m)}
                                className="p-1.5 rounded-lg text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 transition font-medium"
                                title={isPrimary || m.user_role === "admin" ? "Change Admin Password" : "Change Password"}>
                                <Key size={14}/>
                              </button>
                              {!isPrimary && (
                                <>
                                  <button onClick={() => handleBan(m)}
                                    className={`p-1.5 rounded-lg transition ${isBanned ? "text-emerald-500 hover:bg-emerald-50" : "text-gray-400 hover:text-orange-500 hover:bg-orange-50"}`}
                                    title={isBanned ? "Unban" : "Ban"}>
                                    {isBanned ? <Unlock size={14}/> : <Ban size={14}/>}
                                  </button>
                                  <button onClick={() => deleteTeamMember(m.id)}
                                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition" title="Delete">
                                    <Trash2 size={14}/>
                                  </button>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ── GRID VIEW ─────────────────────────────────────── */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((m) => {
            const fullName = `${m.first_name} ${m.last_name}`.trim();
            const av = getAvatar(fullName);
            const isPrimary = m.emp_email?.toLowerCase() === "kk@achmecommunication.com";
            const isBanned  = m.user_status === "banned";
            return (
              <div key={m.id} className={`bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all group relative overflow-hidden ${isBanned ? "border-red-100 opacity-75" : "border-gray-100"}`}>
                {/* Top color strip */}
                <div className="h-1.5 w-full rounded-t-2xl" style={{ background: av.bg }}/>

                {/* Card body */}
                <div className="p-4">
                  {/* Avatar + name */}
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-base flex-shrink-0"
                      style={{ background: av.bg + "22", color: av.bg }}>
                      {av.initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-gray-900 truncate text-sm leading-tight">{fullName}</p>
                      <p className="text-[11px] text-gray-400 truncate">{m.emp_id || "—"}</p>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <StatusBadge status={m.user_status}/>
                        <span className="text-[10px] text-gray-400 capitalize">{m.user_status || "—"}</span>
                        <RoleBadge role={m.user_role}/>
                      </div>
                    </div>
                    {isPrimary && <Star size={13} className="text-amber-400 flex-shrink-0 mt-0.5" title="Primary Admin"/>}
                  </div>

                  {/* Info rows */}
                  <div className="space-y-1.5 text-[11px] text-gray-500">
                    <div className="flex items-center gap-1.5 truncate">
                      <Briefcase size={10} className="flex-shrink-0 text-gray-300"/>
                      <span className="truncate">{m.job_title || "—"}</span>
                      <span className="text-gray-200">·</span>
                      <span className="text-gray-400 truncate">{m.emp_role || "—"}</span>
                    </div>
                    {m.emp_email && (
                      <div className="flex items-center gap-1.5 truncate">
                        <Mail size={10} className="flex-shrink-0 text-gray-300"/>
                        <span className="truncate">{m.emp_email}</span>
                      </div>
                    )}
                    {(m.mobile || m.mobile_number) && (
                      <div className="flex items-center gap-1.5">
                        <Phone size={10} className="flex-shrink-0 text-gray-300"/>
                        <span>{m.mobile || m.mobile_number}</span>
                      </div>
                    )}
                    {m.emp_address && (
                      <div className="flex items-center gap-1.5 truncate">
                        <MapPin size={10} className="flex-shrink-0 text-gray-300"/>
                        <span className="truncate">{m.emp_address}</span>
                      </div>
                    )}
                  </div>

                  {/* Work Metrics Breakdown */}
                  <div className="mt-3 pt-2.5 border-t border-gray-100 grid grid-cols-3 gap-1.5 text-[10px]">
                    <div className="bg-blue-50/60 p-1.5 rounded-lg border border-blue-100/50 text-center" title="Quotations">
                      <span className="text-gray-400 block font-medium">Quotes</span>
                      <span className="font-bold text-blue-700 text-xs">{m.quotations_count || m.quotation_count || 0}</span>
                    </div>
                    <div className="bg-indigo-50/60 p-1.5 rounded-lg border border-indigo-100/50 text-center" title="Proforma Invoices">
                      <span className="text-gray-400 block font-medium">Proforma</span>
                      <span className="font-bold text-indigo-700 text-xs">{m.proformas_count || 0}</span>
                    </div>
                    <div className="bg-emerald-50/60 p-1.5 rounded-lg border border-emerald-100/50 text-center" title="Clients">
                      <span className="text-gray-400 block font-medium">Clients</span>
                      <span className="font-bold text-emerald-700 text-xs">{m.clients_count || 0}</span>
                    </div>
                    <div className="bg-amber-50/60 p-1.5 rounded-lg border border-amber-100/50 text-center" title="Leads">
                      <span className="text-gray-400 block font-medium">Leads</span>
                      <span className="font-bold text-amber-700 text-xs">{m.leads_count || 0}</span>
                    </div>
                    <div className="bg-purple-50/60 p-1.5 rounded-lg border border-purple-100/50 text-center" title="Services">
                      <span className="text-gray-400 block font-medium">Services</span>
                      <span className="font-bold text-purple-700 text-xs">{m.services_count || 0}</span>
                    </div>
                    <div className="bg-sky-50/60 p-1.5 rounded-lg border border-sky-100/50 text-center" title="Tasks">
                      <span className="text-gray-400 block font-medium">Tasks</span>
                      <span className="font-bold text-sky-700 text-xs">{m.tasks_count || 0}</span>
                    </div>
                  </div>
                </div>

                {/* ─ Action bar ─────────────────────────────── */}
                <div className="border-t border-gray-50 px-3 py-2 flex items-center justify-between bg-gray-50/50">
                  {/* View */}
                  <button onClick={() => { setViewMember(m); setViewOpen(true); }}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition" title="View Profile">
                    <Eye size={15}/>
                  </button>

                  {/* Mail always available */}
                  <button onClick={() => openMailModal(m)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition" title="Send Email">
                    <Mail size={15}/>
                  </button>

                  {isAdminOrSubAdmin && (
                    <>
                      <button onClick={() => editTeam(m)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 transition" title="Edit">
                        <Edit size={15}/>
                      </button>
                      <button onClick={() => openAssignModal(m)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition" title="Assign Task">
                        <CheckSquare size={15}/>
                      </button>
                    </>
                  )}

                  {currentUser?.role === "admin" && (
                    <>
                      {!isPrimary && (
                        <button onClick={() => openRoleModal(m)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition" title="Change Role">
                          <Zap size={15}/>
                        </button>
                      )}
                      <button onClick={() => openPwModal(m)}
                        className="p-1.5 rounded-lg text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 transition font-medium"
                        title={isPrimary || m.user_role === "admin" ? "Change Admin Password" : "Change Password"}>
                        <Key size={15}/>
                      </button>
                      {!isPrimary && (
                        <>
                          <button onClick={() => handleBan(m)}
                            className={`p-1.5 rounded-lg transition ${isBanned ? "text-emerald-500 hover:bg-emerald-50" : "text-gray-400 hover:text-orange-500 hover:bg-orange-50"}`}
                            title={isBanned ? "Unban" : "Ban"}>
                            {isBanned ? <Unlock size={15}/> : <Ban size={15}/>}
                          </button>
                          <button onClick={() => deleteTeamMember(m.id)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition" title="Delete">
                            <Trash2 size={15}/>
                          </button>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          ADD / EDIT MEMBER MODAL
      ══════════════════════════════════════════════════════ */}
      {open && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center overflow-y-auto p-4 py-8">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl border border-gray-100" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                  <UserCheck size={18} className="text-blue-600"/>
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">{isEdit ? "Edit Team Member" : "Add New Team Member"}</h2>
                  <p className="text-xs text-gray-400">{isEdit ? "Update member details below" : "Fill in the details to create a new member"}</p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition"><X size={18}/></button>
            </div>

            {/* Form */}
            <form onSubmit={saveTeam} className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Employee ID */}
              <FI label="Employee ID">
                <input type="text" name="emp_id" value={form.emp_id} onChange={handleChange}
                  placeholder="e.g. AC108" className={inp}/>
              </FI>

              {/* First Name */}
              <FI label="First Name" required error={formErrors.first_name}>
                <input type="text" name="first_name" value={form.first_name} onChange={handleChange}
                  placeholder="Enter first name" className={`${inp} ${formErrors.first_name ? inpErr : ""}`}/>
              </FI>

              {/* Last Name */}
              <FI label="Last Name" required error={formErrors.last_name}>
                <input type="text" name="last_name" value={form.last_name} onChange={handleChange}
                  placeholder="Enter last name" className={`${inp} ${formErrors.last_name ? inpErr : ""}`}/>
              </FI>

              {/* Email */}
              <FI label="Email Address" required error={formErrors.emp_email}>
                <input type="email" name="emp_email" value={form.emp_email} onChange={handleChange}
                  placeholder="employee@company.com" className={`${inp} ${formErrors.emp_email ? inpErr : ""}`}/>
              </FI>

              {/* Phone */}
              <FI label="Phone Number">
                <input type="tel" name="mobile_number" value={form.mobile_number} onChange={handleChange}
                  placeholder="Enter phone number" className={inp}/>
              </FI>

              {/* Job Title */}
              <FI label="Job Title" required error={formErrors.job_title}>
                <input type="text" name="job_title" value={form.job_title} onChange={handleChange}
                  placeholder="e.g. AC Engineer" className={`${inp} ${formErrors.job_title ? inpErr : ""}`}/>
              </FI>

              {/* Department / Role */}
              <FI label="Department / Role" required error={formErrors.emp_role}>
                <input type="text" name="emp_role" value={form.emp_role} onChange={handleChange}
                  placeholder="e.g. Service, Sales, BDM…" className={`${inp} ${formErrors.emp_role ? inpErr : ""}`}/>
              </FI>

              {/* System Role */}
              <FI label="System Access Level" required>
                <div className="relative">
                  <select name="system_role" value={form.system_role} onChange={handleChange} className={`${inp} appearance-none pr-8`}>
                    <option value="employee">Employee — Create / View Only</option>
                    <option value="subadmin">Sub-Admin — Edit, Assign Tasks</option>
                    {currentUser?.role === "admin" && <option value="admin">Admin — Full Access</option>}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-3 text-gray-400 pointer-events-none"/>
                </div>
                {isEdit && <p className="text-[10px] text-amber-600 mt-0.5">⚠ Changing this updates the employee's login access.</p>}
              </FI>

              {/* Address */}
              <FI label="Address" >
                <textarea name="emp_address" value={form.emp_address} onChange={handleChange}
                  rows={2} placeholder="Office / home address (optional)"
                  className={`${inp} resize-none`}/>
              </FI>

              {/* Quotation Count */}
              <FI label="Quotation Count">
                <input type="number" name="quotation_count" value={form.quotation_count} onChange={handleChange}
                  min={0} className={inp}/>
              </FI>

              {/* Passwords — create only */}
              {!isEdit && (
                <>
                  <FI label="Password" required error={formErrors.user_password}>
                    <div className="relative">
                      <input type={showFormPw ? "text" : "password"} name="user_password" value={form.user_password}
                        onChange={handleChange} placeholder="Min. 6 characters"
                        className={`${inp} pr-10 ${formErrors.user_password ? inpErr : ""}`}/>
                      <button type="button" onClick={() => setShowFormPw(p => !p)}
                        className="absolute right-3 top-3 text-gray-400 hover:text-gray-600">
                        {showFormPw ? <EyeOff size={14}/> : <Eye size={14}/>}
                      </button>
                    </div>
                  </FI>
                  <FI label="Confirm Password" required error={formErrors.repeat_password}>
                    <input type={showFormPw ? "text" : "password"} name="repeat_password" value={form.repeat_password}
                      onChange={handleChange} placeholder="Repeat password"
                      className={`${inp} ${formErrors.repeat_password ? inpErr : ""}`}/>
                  </FI>
                </>
              )}

              {/* Actions */}
              <div className="col-span-full flex gap-3 pt-2 border-t border-gray-100 mt-2">
                <button type="submit" disabled={isLoading}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition shadow-md disabled:opacity-50 flex items-center justify-center gap-2">
                  {isLoading ? <><UserCheck size={15} className="animate-spin"/> Saving…</> : <>{isEdit ? "Update Member" : "Create Member"}</>}
                </button>
                <button type="button" onClick={() => setOpen(false)}
                  className="px-6 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-500 hover:bg-gray-50 transition">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          VIEW PROFILE MODAL
      ══════════════════════════════════════════════════════ */}
      {viewOpen && viewMember && (() => {
        const m  = viewMember;
        const fn = `${m.first_name} ${m.last_name}`.trim();
        const av = getAvatar(fn);
        const qCount = m.quotations_count || m.quotation_count || 0;
        const piCount = m.proformas_count || 0;
        const cCount = m.clients_count || 0;
        const lCount = m.leads_count || 0;
        const sCount = m.services_count || 0;
        const tCount = m.tasks_count || 0;
        const totalWork = qCount + piCount + cCount + lCount + sCount + tCount;

        return (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setViewOpen(false)}>
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-gray-100 overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="h-24 rounded-t-2xl relative" style={{ background: `linear-gradient(135deg, ${av.bg}44, ${av.bg}11)` }}>
                <button onClick={() => setViewOpen(false)} className="absolute right-3 top-3 p-1.5 rounded-full bg-white/80 text-gray-500 hover:text-gray-800 transition">
                  <X size={16} />
                </button>
              </div>
              <div className="-mt-12 px-6 pb-6">
                <div className="flex items-end justify-between mb-3">
                  <div className="w-20 h-20 rounded-2xl flex items-center justify-center font-black text-2xl border-4 border-white shadow-md"
                    style={{ background: av.bg + "22", color: av.bg }}>
                    {av.initials}
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    <RoleBadge role={m.user_role}/>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${m.user_status === "active" ? "bg-emerald-100 text-emerald-700" : m.user_status === "banned" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-500"}`}>
                      {m.user_status || "—"}
                    </span>
                  </div>
                </div>

                <h3 className="text-lg font-black text-gray-900">{fn}</h3>
                <p className="text-xs text-gray-400">{m.emp_id || "—"} · {m.job_title || "—"}</p>

                {/* Overall Work Performance Metrics */}
                <div className="mt-4 p-3 rounded-xl bg-blue-50/40 border border-blue-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-blue-800">Overall Work Activity</span>
                    <span className="text-xs font-black text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">{totalWork} Total Actions</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-white p-2 rounded-lg border border-gray-100 shadow-2xs">
                      <p className="text-[10px] text-gray-400 font-medium">Quotations</p>
                      <p className="font-bold text-blue-600 text-sm mt-0.5">{qCount}</p>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-gray-100 shadow-2xs">
                      <p className="text-[10px] text-gray-400 font-medium">Proforma</p>
                      <p className="font-bold text-indigo-600 text-sm mt-0.5">{piCount}</p>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-gray-100 shadow-2xs">
                      <p className="text-[10px] text-gray-400 font-medium">Clients</p>
                      <p className="font-bold text-emerald-600 text-sm mt-0.5">{cCount}</p>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-gray-100 shadow-2xs">
                      <p className="text-[10px] text-gray-400 font-medium">Leads</p>
                      <p className="font-bold text-amber-600 text-sm mt-0.5">{lCount}</p>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-gray-100 shadow-2xs">
                      <p className="text-[10px] text-gray-400 font-medium">Services</p>
                      <p className="font-bold text-purple-600 text-sm mt-0.5">{sCount}</p>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-gray-100 shadow-2xs">
                      <p className="text-[10px] text-gray-400 font-medium">Tasks</p>
                      <p className="font-bold text-sky-600 text-sm mt-0.5">{tCount}</p>
                    </div>
                  </div>
                </div>

                <hr className="my-4 border-gray-100"/>

                {/* Contact & Details */}
                <div className="space-y-2.5 text-sm">
                  {[
                    { icon: Mail,      label: "Email",      value: m.emp_email },
                    { icon: Phone,     label: "Mobile",     value: m.mobile || m.mobile_number },
                    { icon: Briefcase, label: "Department", value: m.emp_role },
                    { icon: MapPin,    label: "Address",    value: m.emp_address },
                  ].map(({ icon: Icon, label, value }) => value ? (
                    <div key={label} className="flex items-start gap-2 text-gray-600">
                      <Icon size={14} className="text-gray-400 flex-shrink-0 mt-0.5"/>
                      <div><span className="text-[10px] text-gray-400 block uppercase font-bold">{label}</span>{value}</div>
                    </div>
                  ) : null)}
                </div>

                <div className="mt-5 flex gap-2">
                  {currentUser?.role === "admin" && (
                    <button
                      onClick={() => {
                        const target = viewMember;
                        setViewOpen(false);
                        openPwModal(target);
                      }}
                      className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition shadow-sm flex items-center justify-center gap-1.5"
                    >
                      <Key size={14}/> Change Password
                    </button>
                  )}
                  <button onClick={() => setViewOpen(false)} className="flex-1 py-2.5 rounded-xl text-xs font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition">
                    Close Profile
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ══════════════════════════════════════════════════════
          MAIL MODAL
      ══════════════════════════════════════════════════════ */}
      {mailOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-gray-100">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2"><Mail size={15} className="text-amber-500"/> Email to {mailName}</h3>
              <button onClick={() => setMailOpen(false)} className="text-gray-400 hover:text-red-500 p-1 rounded-lg"><X size={16}/></button>
            </div>
            <div className="p-5 space-y-3">
              <FI label="To (Email)"><input type="email" value={mailTo} readOnly className={`${inp} bg-gray-50`}/></FI>
              <FI label="Subject"><input type="text" value={mailSubject} onChange={e => setMailSubject(e.target.value)} className={inp}/></FI>
              <FI label="Message"><textarea value={mailMessage} onChange={e => setMailMessage(e.target.value)} rows={4} className={`${inp} resize-none`}/></FI>
            </div>
            <div className="flex gap-3 px-5 pb-5">
              <button onClick={handleSendMail} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-amber-500 hover:bg-amber-600 transition shadow">Open in Gmail</button>
              <button onClick={() => setMailOpen(false)} className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-500 hover:bg-gray-50 transition">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          ASSIGN TASK MODAL
      ══════════════════════════════════════════════════════ */}
      {assignOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-gray-100 overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white">
              <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2"><CheckSquare size={15} className="text-blue-600"/> Assign to {assignMember?.first_name}</h3>
              <button onClick={() => setAssignOpen(false)} className="text-gray-400 hover:text-red-500 p-1 rounded-lg"><X size={16}/></button>
            </div>
            <form onSubmit={saveAssignment} className="p-5 space-y-4">
              <FI label="Task / Target" error={assignErrors.taskTargetId}>
                <div className="relative">
                  <select value={assignForm.taskTargetId}
                    onChange={e => setAssignForm({ ...assignForm, taskTargetId: e.target.value })}
                    className={`${inp} appearance-none pr-8 ${assignErrors.taskTargetId ? inpErr : ""}`}>
                    <option value="">Select a Task or Target</option>
                    {taskTargets.map(item => (
                      <option key={`${item.id}-${item.type}`} value={item.id}>[{item.type === "task" ? "📋 Task" : "🎯 Target"}] {item.title}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-3 text-gray-400 pointer-events-none"/>
                </div>
              </FI>
              <FI label="Type">
                <div className="flex gap-4">
                  {["task","target"].map(t => (
                    <label key={t} className="flex items-center gap-2 cursor-pointer text-sm">
                      <input type="radio" value={t} checked={assignForm.taskTargetType === t}
                        onChange={e => setAssignForm({ ...assignForm, taskTargetType: e.target.value })}
                        className="text-blue-600"/>
                      <span className="capitalize">{t}</span>
                    </label>
                  ))}
                </div>
              </FI>
              {assignForm.taskTargetType === "target" && (
                <FI label="Target Amount (₹ yearly)">
                  <input type="number" value={assignForm.amount}
                    onChange={e => setAssignForm({ ...assignForm, amount: e.target.value })}
                    placeholder="Yearly amount" className={inp}/>
                  <p className="text-[10px] text-gray-400">Monthly ≈ ₹{assignForm.amount ? Math.round(parseFloat(assignForm.amount)/12).toLocaleString() : "0"}</p>
                </FI>
              )}
              <FI label="Due Date" error={assignErrors.dueDate}>
                <input type="date" value={assignForm.dueDate}
                  onChange={e => setAssignForm({ ...assignForm, dueDate: e.target.value })}
                  className={`${inp} ${assignErrors.dueDate ? inpErr : ""}`}/>
              </FI>
              <FI label="Priority">
                <div className="relative">
                  <select value={assignForm.priority} onChange={e => setAssignForm({ ...assignForm, priority: e.target.value })} className={`${inp} appearance-none pr-8`}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-3 text-gray-400 pointer-events-none"/>
                </div>
              </FI>
              <FI label="Notes">
                <textarea value={assignForm.notes} onChange={e => setAssignForm({ ...assignForm, notes: e.target.value })}
                  rows={3} placeholder="Optional notes…" className={`${inp} resize-none`}/>
              </FI>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={assignLoading}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition disabled:opacity-50">
                  {assignLoading ? "Saving…" : "Assign Now"}
                </button>
                <button type="button" onClick={() => setAssignOpen(false)}
                  className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-500 hover:bg-gray-50">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          ROLE MODAL
      ══════════════════════════════════════════════════════ */}
      {roleModalOpen && roleModalData && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl border border-gray-100">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2"><Zap size={14} className="text-purple-600"/> Change Role</h3>
              <button onClick={() => setRoleModalOpen(false)} className="text-gray-400 hover:text-red-500 p-1 rounded-lg"><X size={16}/></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                {(() => { const av = getAvatar(`${roleModalData.first_name} ${roleModalData.last_name}`); return (
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0"
                    style={{ background: av.bg + "22", color: av.bg }}>{av.initials}</div>
                ); })()}
                <div>
                  <p className="font-bold text-sm text-gray-800">{roleModalData.first_name} {roleModalData.last_name}</p>
                  <p className="text-[11px] text-gray-400">{roleModalData.emp_email}</p>
                </div>
              </div>
              <FI label="Select Role">
                <div className="relative">
                  <select value={newUserRole} onChange={e => setNewUserRole(e.target.value)} className={`${inp} appearance-none pr-8`}>
                    <option value="employee">Employee — Create/View Only</option>
                    <option value="subadmin">Sub-Admin — Assign Tasks, Edit</option>
                    {currentUser?.role === "admin" && <option value="admin">Admin — Full Access</option>}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-3 text-gray-400 pointer-events-none"/>
                </div>
              </FI>
              <div className="p-3 bg-purple-50 rounded-xl text-[11px] text-purple-700 space-y-0.5">
                <p><strong>Employee:</strong> Create/view records, edit own</p>
                <p><strong>Sub-Admin:</strong> Assign tasks, edit, delete</p>
                <p><strong>Admin:</strong> Full system access</p>
              </div>
            </div>
            <div className="flex gap-3 px-5 pb-5">
              <button onClick={saveRole} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 transition">Update Role</button>
              <button onClick={() => setRoleModalOpen(false)} className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-500 hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          CHANGE PASSWORD MODAL
      ══════════════════════════════════════════════════════ */}
      {pwModalOpen && pwModalMember && (() => {
        const isSelf = pwModalMember.user_id === currentUser?.id || 
                       (pwModalMember.emp_email && currentUser?.email && pwModalMember.emp_email.toLowerCase() === currentUser.email.toLowerCase()) ||
                       pwModalMember.user_role === "admin";
        const av = getAvatar(`${pwModalMember.first_name} ${pwModalMember.last_name}`);

        return (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4" onClick={() => setPwModalOpen(false)}>
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-gray-100 overflow-hidden" onClick={e => e.stopPropagation()}>
              {/* Top Banner */}
              <div className="px-6 py-4 bg-gradient-to-r from-indigo-600 to-blue-600 text-white flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-white">
                    <Key size={16}/>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold">{isSelf ? "Change Admin Password" : "Change User Password"}</h3>
                    <p className="text-[11px] text-indigo-100">Dynamic instant password update</p>
                  </div>
                </div>
                <button onClick={() => setPwModalOpen(false)} className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"><X size={18}/></button>
              </div>

              <form onSubmit={savePassword} className="p-6 space-y-4">
                {/* Member Preview Card */}
                <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-100 rounded-xl">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0"
                    style={{ background: av.bg + "22", color: av.bg }}>
                    {av.initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="font-bold text-sm text-gray-800 truncate">{pwModalMember.first_name} {pwModalMember.last_name}</p>
                      {isSelf && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">You / Admin</span>}
                    </div>
                    <p className="text-[11px] text-gray-400 truncate">{pwModalMember.emp_email || "No email"}</p>
                  </div>
                  <RoleBadge role={pwModalMember.user_role || "employee"}/>
                </div>

                {/* Error message */}
                {pwErrorMsg && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                    <AlertCircle size={15} className="shrink-0 text-red-500"/>
                    <span>{pwErrorMsg}</span>
                  </div>
                )}

                {/* Success message */}
                {pwSuccessMsg && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
                    <CheckCircle size={15} className="shrink-0 text-emerald-600"/>
                    <span>{pwSuccessMsg}</span>
                  </div>
                )}

                {/* New Password */}
                <FI label="New Password" required>
                  <div className="relative">
                    <input
                      type={showPw ? "text" : "password"}
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Enter new password (min. 6 chars)"
                      className={`${inp} pr-10`}
                      autoFocus
                    />
                    <button type="button" onClick={() => setShowPw(p => !p)} className="absolute right-3 top-3 text-gray-400 hover:text-gray-600">
                      {showPw ? <EyeOff size={15}/> : <Eye size={15}/>}
                    </button>
                  </div>
                </FI>

                {/* Confirm Password */}
                <FI label="Confirm New Password" required>
                  <div className="relative">
                    <input
                      type={showConfirmPw ? "text" : "password"}
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      className={`${inp} pr-10`}
                    />
                    <button type="button" onClick={() => setShowConfirmPw(p => !p)} className="absolute right-3 top-3 text-gray-400 hover:text-gray-600">
                      {showConfirmPw ? <EyeOff size={15}/> : <Eye size={15}/>}
                    </button>
                  </div>
                </FI>

                {/* Notice Note */}
                <div className={`p-3 rounded-xl text-[11px] leading-relaxed ${isSelf ? "bg-indigo-50 border border-indigo-100 text-indigo-800" : "bg-amber-50 border border-amber-100 text-amber-800"}`}>
                  {isSelf ? (
                    <p>
                      <strong>Note:</strong> You are dynamically updating your own Admin password. The new password will take effect immediately for all your future logins.
                    </p>
                  ) : (
                    <p>
                      <strong>Notice:</strong> This dynamically updates the employee's login password immediately. Please inform the member after updating.
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={pwLoading}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {pwLoading ? <><RefreshCw size={15} className="animate-spin"/> Updating…</> : <><Lock size={15}/> Update Password</>}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPwModalOpen(false)}
                    className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

    </div>
  );
};

export default Team;
