"use client";

import { useState, useEffect } from "react";

export default function ClientDashboard() {
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/client/dashboard');
        
        if (!response.ok) throw new Error('Failed to fetch dashboard data');

        const data = await response.json();
        setDashboardData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
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