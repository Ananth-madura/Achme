/**
 * Helper function to determine if a user or team member is a Service Engineer.
 * Checks job_title, emp_role, and user_role.
 */
export const isServiceEngineer = (userOrMember) => {
  if (!userOrMember) return false;
  const jobTitle = (userOrMember.job_title || "").toLowerCase();
  const empRole = (userOrMember.emp_role || "").toLowerCase();
  const userRole = (userOrMember.user_role || userOrMember.role || "").toLowerCase();

  return (
    userRole === "service_engineer" ||
    userRole === "engineer" ||
    jobTitle.includes("service engineer") ||
    empRole === "engineer" ||
    empRole === "service engineer"
  );
};
