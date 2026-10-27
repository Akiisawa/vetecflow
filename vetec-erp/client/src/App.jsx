import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import { LookupProvider } from './lookups.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Clients from './pages/Clients.jsx';
import ClientDetail from './pages/ClientDetail.jsx';
import Crm from './pages/Crm.jsx';
import Proposals from './pages/Proposals.jsx';
import Contracts from './pages/Contracts.jsx';
import Projects from './pages/Projects.jsx';
import ProjectDetail from './pages/ProjectDetail.jsx';
import Tasks from './pages/Tasks.jsx';
import Team from './pages/Team.jsx';
import Timesheets from './pages/Timesheets.jsx';
import Documents from './pages/Documents.jsx';
import Finance from './pages/Finance.jsx';
import Suppliers from './pages/Suppliers.jsx';
import Assets from './pages/Assets.jsx';
import Incidents from './pages/Incidents.jsx';
import CalendarPage from './pages/Calendar.jsx';
import Reports from './pages/Reports.jsx';
import Audit from './pages/Audit.jsx';
import Users from './pages/Users.jsx';
import { Spinner } from './ui.jsx';
import Preloader from './components/Preloader.jsx';

export default function App() {
  const { user, loading } = useAuth();
  const [showPreloader, setShowPreloader] = useState(true);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    // Preloader inicial (quando abre o site)
    const timer = setTimeout(() => setShowPreloader(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Preloader ao fazer login (transição para o dashboard)
    if (user) {
      setShowPreloader(true);
      const timer = setTimeout(() => setShowPreloader(false), 1200);
      return () => clearTimeout(timer);
    }
  }, [user]);

  if (loading || showPreloader) {
    return <Preloader />;
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <LookupProvider>
      <Routes>
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route element={<Layout theme={theme} setTheme={setTheme} />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/clients/:id" element={<ClientDetail />} />
          <Route path="/crm" element={<Crm />} />
          <Route path="/proposals" element={<Proposals />} />
          <Route path="/contracts" element={<Contracts />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/:id" element={<ProjectDetail />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/team" element={<Team />} />
          <Route path="/timesheets" element={<Timesheets />} />
          <Route path="/documents" element={<Documents />} />
          <Route path="/finance" element={<Finance />} />
          <Route path="/suppliers" element={<Suppliers />} />
          <Route path="/assets" element={<Assets />} />
          <Route path="/incidents" element={<Incidents />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/audit" element={<Audit />} />
          <Route path="/users" element={<Users />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </LookupProvider>
  );
}
