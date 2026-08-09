import { Outlet, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useState, createContext, useContext, useEffect, useMemo } from "react";
import axios from "axios";
import { API } from "../config/api";

import Topbar from "../components/navbar";
import AdminSidebar from "../sidebars/adminsidebar";
import UserSidebar from "../sidebars/usersidebar";
import MobileBottomNav from "../components/MobileBottomNav";
import SMTPConfigPrompt from "../components/SMTPConfigPrompt";
import { initMobileTables } from "../utils/mobileTableHelper";
import MadhuraLogo from "./Madhura-logo.png";

import { isServiceEngineer } from "../utils/serviceEngineerHelper";

export const DashboardSearchContext = createContext("");
export const ReminderContext = createContext({ setReminderData: () => { }, setReminderNotes: () => { } });

export default function DashboardLayout() {
  const { user, login } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 1024);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const [searchQuery, setSearchQuery] = useState("");
  const [reminderData, setReminderData] = useState(null);
  const [reminderNotes, setReminderNotes] = useState(null);
  const [escalations, setEscalations] = useState([]);
  const [showSMTPPrompt, setShowSMTPPrompt] = useState(false);
  const location = useLocation();

  useEffect(() => { initMobileTables(); }, []);

  useEffect(() => {
    let prevWidth = window.innerWidth;
    const handleResize = () => {
      const currWidth = window.innerWidth;
      const mobile = currWidth < 768;
      setIsMobile(mobile);

      // Handle layouts transitions
      if ((prevWidth < 768 && currWidth >= 768) || (prevWidth >= 768 && currWidth < 768)) {
        setSidebarOpen(currWidth >= 1024);
      } else if ((prevWidth < 1024 && currWidth >= 1024) || (prevWidth >= 1024 && currWidth < 1024)) {
        if (!mobile) {
          setSidebarOpen(currWidth >= 1024);
        }
      }
      prevWidth = currWidth;
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Sync user profile/permissions on mount
  useEffect(() => {
    if (user && login) {
      axios.get(`${API}/api/auth/profile`)
        .then(res => {
          if (
            res.data.role !== user.role ||
            res.data.job_title !== user.job_title ||
            res.data.emp_role !== user.emp_role
          ) {
            login({
              ...user,
              role: res.data.role,
              job_title: res.data.job_title,
              emp_role: res.data.emp_role
            });
          }
        })
        .catch(err => console.error("Permission sync error:", err));
    }
  }, []);

  useEffect(() => {
    if (user) {
      const checkSMTP = () => {
        axios.get(`${API}/api/auth/check-email-config`)
          .then(res => {
            if (!res.data.hasConfig) {
              const lastClosed = localStorage.getItem("smtp_prompt_last_closed");
              const now = Date.now();
              if (!lastClosed || (now - parseInt(lastClosed)) > 3 * 60 * 60 * 1000) {
                setShowSMTPPrompt(true);
              }
            } else {
              setShowSMTPPrompt(false);
            }
          })
          .catch(err => console.error("Error checking SMTP config:", err));
      };

      checkSMTP();
      const interval = setInterval(checkSMTP, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [user]);

  useEffect(() => {
    const fetchEscalations = async () => {
      try {
        await axios.post(`${API}/api/leads/check-missed`);
        const res = await axios.get(`${API}/api/leads/escalations`);
        setEscalations(res.data);
      } catch (_) { }
    };
    fetchEscalations();
    const interval = setInterval(fetchEscalations, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const reminderValue = useMemo(() => ({ setReminderData, setReminderNotes }), [setReminderData, setReminderNotes]);

  if (!user) return <Navigate to="/login" />;

  const isEngineer = isServiceEngineer(user);
  const allowedEngineerPaths = [
    "/dashboard/call-report",
    "/dashboard/products",
    "/dashboard/profile",
    "/dashboard/notifications"
  ];

  if (isEngineer && !allowedEngineerPaths.some(p => location.pathname.startsWith(p))) {
    return <Navigate to="/dashboard/call-report" replace />;
  }

  const isDashboard = location.pathname === "/dashboard" || location.pathname === "/dashboard/";

  return (
    <DashboardSearchContext.Provider value={searchQuery}>
      <ReminderContext.Provider value={reminderValue}>
        {/* TOPBAR */}
        <div className="fixed top-0 left-0 w-full z-50">
          <Topbar
            onHamburgerClick={() => setSidebarOpen(prev => !prev)}
            showSearch={isDashboard}
            onSearch={setSearchQuery}
            reminderData={reminderData}
            reminderNotes={reminderNotes}
            escalationCount={escalations.length}
            escalations={escalations}
          />
        </div>

        <div className="flex">
          {/* Overlay for phone only */}
          {sidebarOpen && (
            <div
              className="fixed inset-0 bg-black/40 z-40 md:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          {/* Sidebar */}
          <div
            className={`fixed left-0 top-[65px] bg-shell text-shell-text z-40 transition-all duration-300
            ${isMobile
                ? `w-[250px] ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`
                : `${sidebarOpen ? "w-[250px]" : "w-[70px]"} translate-x-0`
              }
            h-[calc(100vh-65px)] phone-sidebar`}
          >
            {user.role === "admin" ? (
              <AdminSidebar
                onNavigate={() => setSidebarOpen(false)}
                collapsed={!isMobile && !sidebarOpen}
                onExpand={() => setSidebarOpen(true)}
              />
            ) : (
              <UserSidebar
                onNavigate={() => setSidebarOpen(false)}
                collapsed={!isMobile && !sidebarOpen}
                onExpand={() => setSidebarOpen(true)}
              />
            )}
          </div>

          {/* CENTER CONTENT */}
          <div
            className={`transition-all duration-300 mt-[65px] w-full max-w-full min-h-screen text-shell-text bg-content flex flex-col pb-16 md:pb-6
            ${isMobile
                ? "ml-0 max-w-full"
                : `${sidebarOpen ? "md:ml-[250px] md:max-w-[calc(100%-250px)]" : "md:ml-[70px] md:max-w-[calc(100%-70px)]"}`
              }
            p-3 md:p-5 lg:p-6`}
          >
            <div className="flex-1 w-full max-w-7xl mx-auto">
              <Outlet />
            </div>
            <div className="mt-6 flex items-center justify-end gap-2 text-xs md:text-sm font-bold text-blue-600 uppercase tracking-wider">
              <span className="hidden md:block italic">DEVELOPED BY</span>
              <a href="https://madhuratech.com/" target="_blank" rel="noopener noreferrer" className="inline-block hover:opacity-85 transition">
                <img src={MadhuraLogo} alt="Madhura Logo" className="h-5 w-auto object-contain" />
              </a>
            </div>
          </div>
        </div>

        {/* Bottom Nav — phone only */}
        <div className="md:hidden">
          <MobileBottomNav onMenuOpen={() => setSidebarOpen(true)} />
        </div>

        {showSMTPPrompt && user && (
          <SMTPConfigPrompt
            email={user.email}
            onClose={() => setShowSMTPPrompt(false)}
          />
        )}
      </ReminderContext.Provider>
    </DashboardSearchContext.Provider>
  );
}
