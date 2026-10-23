import React, { useState, useEffect, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import SystemLayout from './components/layout/SystemLayout';
import Dashboard from './pages/Dashboard';
import Leads from './pages/Leads';
import Quotations from './pages/Quotations';
import Bookings from './pages/Bookings';
import TravelAgent from './pages/TravelAgent';
import AdminAgentLeadsHub from './pages/AdminAgentLeadsHub';
import Settings from './pages/Settings';
import Profile from './pages/Profile';
import Studio from './pages/Studio';
import Login from './pages/Login';
import Onboarding from './pages/Onboarding';
import Finance from './pages/Finance';
import AdminSubscriptionFinance from './pages/AdminSubscriptionFinance';
import Plans from './pages/Plans';
import TermsConditions from './pages/TermsConditions';
import PlanFeatureLocked from './components/PlanFeatureLocked';
import { DatabaseProvider, useDatabase } from './context/DatabaseContext';
import { ROUTE_PLAN_FEATURES, canAccessRouteOnPlan, getAgencyPlanFeatures } from './utils/planFeatures';
import { ThemeProvider } from './context/ThemeContext';
import {
    agentRequiresOnboarding,
    canManageAgencyProfile,
    findSessionUser,
    isMainAgencyOwnerSession,
    isSubAgencyAgentSession,
    PENDING_AGENT_ONBOARDING_KEY,
} from './utils/databaseSync';
import {
    type PermissionKey,
    canAccessRoute,
    canAccessTeamRoute,
    clearStoredPermissions,
    getAssignedPermissions,
    getStoredPermissions,
    setStoredPermissions,
    SUB_AGENT_STAFF_PERMISSIONS,
} from './utils/permissions';
import {
    getSessionAccessBlockReason,
    LOGIN_BLOCK_REASON_KEY,
    clearStoredSessionUserId,
    getStoredSessionUserId,
    setStoredSessionUserId,
} from './utils/authLogin';

function AppContent() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => localStorage.getItem('isAuthenticated') === 'true');
  const [userEmail, setUserEmail] = useState(() => localStorage.getItem('userEmail') || '');
  const [userRole, setUserRole] = useState(() => localStorage.getItem('userRole') as 'admin' | 'agent' | 'staff' || 'agent');
  const [agentId, setAgentId] = useState(() => localStorage.getItem('agentId') || '');
  const [userPermissions, setUserPermissions] = useState<PermissionKey[]>(() => getStoredPermissions());
  const { db } = useDatabase();
  const planFeatures = useMemo(
    () => getAgencyPlanFeatures(db, { userRole, sessionAgentId: agentId, userEmail }),
    [db, userRole, agentId, userEmail]
  );

  useEffect(() => {
    if (!isAuthenticated || userRole === 'admin') return;

    const blockReason = getSessionAccessBlockReason(db, {
      userRole,
      userEmail,
      sessionAgentId: agentId,
      sessionUserId: getStoredSessionUserId(),
    });
    if (!blockReason) return;

    sessionStorage.setItem(LOGIN_BLOCK_REASON_KEY, blockReason);
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userRole');
    localStorage.removeItem('agentId');
    localStorage.removeItem(PENDING_AGENT_ONBOARDING_KEY);
    clearStoredPermissions();
    clearStoredSessionUserId();
    setIsAuthenticated(false);
    setUserEmail('');
    setUserRole('agent');
    setAgentId('');
    setUserPermissions([]);
  }, [isAuthenticated, userRole, agentId, userEmail, db]);

  useEffect(() => {
    if (!isAuthenticated || !db || localStorage.getItem('sessionUserId')) return;

    const sessionUser = findSessionUser(db, {
      userRole: localStorage.getItem('userRole'),
      userEmail: localStorage.getItem('userEmail'),
      sessionAgentId: localStorage.getItem('agentId'),
    });
    if (sessionUser?.record?.id) {
      setStoredSessionUserId(sessionUser.record.id);
    }
  }, [isAuthenticated, db]);

  const handleLogin = (
    email: string,
    role: 'admin' | 'agent' | 'staff',
    id?: string,
    options?: {
      requireOnboarding?: boolean;
      permissions?: PermissionKey[];
      sessionUserId?: string;
    }
  ) => {
    localStorage.setItem('isAuthenticated', 'true');
    localStorage.setItem('userEmail', email);
    localStorage.setItem('userRole', role);
    if (id) localStorage.setItem('agentId', id);
    if (options?.sessionUserId) {
      setStoredSessionUserId(options.sessionUserId);
    } else if (id) {
      setStoredSessionUserId(id);
    } else if (role === 'admin' && db?.settings?.data?.[0]?.id) {
      setStoredSessionUserId(db.settings.data[0].id);
    } else {
      clearStoredSessionUserId();
    }
    if (role === 'agent' && options?.requireOnboarding) {
      localStorage.setItem(PENDING_AGENT_ONBOARDING_KEY, 'true');
    } else {
      localStorage.removeItem(PENDING_AGENT_ONBOARDING_KEY);
    }

    if (role === 'staff') {
      const perms =
        options?.permissions && options.permissions.length > 0
          ? options.permissions
          : [...SUB_AGENT_STAFF_PERMISSIONS];
      setStoredPermissions(perms);
      setUserPermissions(perms);
    } else {
      clearStoredPermissions();
      setUserPermissions([]);
    }

    setIsAuthenticated(true);
    setUserEmail(email);
    setUserRole(role);
    if (id) setAgentId(id);

    window.location.href = '/';
  };

  const handleLogout = () => {
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userRole');
    localStorage.removeItem('agentId');
    localStorage.removeItem(PENDING_AGENT_ONBOARDING_KEY);
    clearStoredPermissions();
    clearStoredSessionUserId();
    setIsAuthenticated(false);
    setUserEmail('');
    setUserRole('agent');
    setAgentId('');
    setUserPermissions([]);
    window.location.href = '/';
  };

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/admin/login" element={<Login onLogin={handleLogin} initialPortal="admin" />} />
        <Route path="*" element={<Login onLogin={handleLogin} />} />
      </Routes>
    );
  }

  const needsOnboarding = agentRequiresOnboarding({
    userRole,
    agentId,
    userEmail,
    db,
  });

  if (needsOnboarding) {
    return (
      <Onboarding
        userEmail={userEmail}
        onComplete={() => {
          localStorage.removeItem(PENDING_AGENT_ONBOARDING_KEY);
          window.location.href = '/';
        }}
      />
    );
  }

  // Modules missing from the agency's subscription plan show an upgrade notice instead
  const planGate = (path: string, element: React.ReactNode) =>
    canAccessRouteOnPlan(planFeatures, path) ? (
      element
    ) : (
      <PlanFeatureLocked features={ROUTE_PLAN_FEATURES[path]} />
    );

  const guardRoute = (path: string, element: React.ReactNode) =>
    canAccessRoute(userRole, userPermissions, path, { isSubAgentSession }) ? (
      planGate(path, element)
    ) : (
      <Navigate to="/" replace />
    );

  const isSubAgentSession = isSubAgencyAgentSession(agentId, db);

  return (
    <Routes>
      <Route element={<SystemLayout onLogout={handleLogout} userRole={userRole} userPermissions={userPermissions} />}>
        <Route path="/" element={planGate('/', <Dashboard />)} />
        <Route
          path="/my-team"
          element={
            canAccessTeamRoute(userRole, userPermissions, isSubAgentSession) ? (
              planGate('/my-team', <TravelAgent />)
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route
          path="/agent-hub"
          element={userRole === 'admin' ? <AdminAgentLeadsHub /> : <Navigate to="/my-team" replace />}
        />
        <Route path="/leads" element={guardRoute('/leads', <Leads />)} />
        <Route path="/quotations" element={guardRoute('/quotations', <Quotations />)} />
        <Route
          path="/terms"
          element={
            userRole === 'admin'
              ? <Navigate to="/" replace />
              : guardRoute('/terms', <TermsConditions />)
          }
        />
        <Route path="/bookings" element={guardRoute('/bookings', <Bookings />)} />
        <Route
          path="/finance"
          element={guardRoute('/finance', userRole === 'admin' ? <AdminSubscriptionFinance /> : <Finance />)}
        />
        <Route path="/studio" element={guardRoute('/studio', <Studio />)} />
        <Route
          path="/settings"
          element={
            canManageAgencyProfile(userRole, agentId, db) ? (
              <Settings />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route
          path="/plans"
          element={
            isMainAgencyOwnerSession(userRole, agentId, db) ? (
              <Plans />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route path="/profile" element={<Profile />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <ThemeProvider>
      <DatabaseProvider>
        <Router>
          <AppContent />
        </Router>
      </DatabaseProvider>
    </ThemeProvider>
  );
}

export default App;
