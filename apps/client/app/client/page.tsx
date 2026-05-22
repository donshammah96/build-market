"use client";

import { useClientDashboard } from "@/hooks/useClientDashboard";

export default function ClientDashboard() {
  const {
    data: dashboardData,
    isLoading: loading,
    error,
  } = useClientDashboard();

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!dashboardData) return <div>No data available</div>;

  const { stats, projects, ideaBooks, savedProfessionals } = dashboardData;

  return (
    <div>
      <h1>Client Dashboard</h1>
      <p>Stats: {stats.activeProjects}</p>
      <p>Projects: {projects.length}</p>
      <p>Idea Books: {ideaBooks.length}</p>
      <p>Saved Professionals: {savedProfessionals.length}</p>
    </div>
  );
}
