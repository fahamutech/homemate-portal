import {useMemo} from 'react';
import {BrowserRouter, Navigate, Route, Routes} from 'react-router-dom';
import type {AdminAccount} from './api/adminAuthClient';
import {AdminLoginScreen} from './features/auth/AdminLoginScreen';
import {useAdminSession} from './features/auth/useAdminSession';
import {AdminApiProvider} from './api/AdminApiContext';
import {AdminSearchProvider} from './features/admin/searchContext';
import {AttentionProvider} from './features/admin/attentionContext';
import {createHttpAdminApi} from './api/adminApi';
import {AdminLayout} from './features/admin/AdminLayout';
import {DashboardPage} from './features/admin/DashboardPage';
import {UsersPage} from './features/admin/UsersPage';
import {AgenciesPage} from './features/admin/AgenciesPage';
import {PropertiesPage} from './features/admin/PropertiesPage';
import {DictionariesPage} from './features/admin/DictionariesPage';
import {SettingsPage} from './features/admin/SettingsPage';
import {AuditPage} from './features/admin/AuditPage';
import {PaymentsPage} from './features/admin/PaymentsPage';
import {InquiriesPage} from './features/admin/InquiriesPage';
import {RentalsPage} from './features/admin/RentalsPage';

/** The admin console, mounted once a session exists. */
export function AdminRoutes({token, admin, onLogout}: {token: string; admin: AdminAccount; onLogout: () => void}) {
  const api = useMemo(() => createHttpAdminApi(token), [token]);

  return (
    <AdminApiProvider api={api}>
      <AdminSearchProvider>
        <AttentionProvider>
        <Routes>
        <Route path="/admin" element={<AdminLayout admin={admin} onLogout={onLogout} />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="users" element={<UsersPage staffOnly={false} />} />
          <Route path="staff" element={<UsersPage staffOnly />} />
          <Route path="properties" element={<PropertiesPage />} />
          <Route path="agencies" element={<AgenciesPage />} />
          <Route path="dictionaries" element={<DictionariesPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="inquiries" element={<InquiriesPage />} />
          <Route path="rentals" element={<RentalsPage />} />
          {/* Old bookmarks: bookings became rentals, viewings are gone. */}
          <Route path="bookings" element={<Navigate to="/admin/rentals" replace />} />
          <Route path="viewings" element={<Navigate to="/admin/inquiries" replace />} />
          <Route path="payments" element={<PaymentsPage />} />
          <Route path="audit" element={<AuditPage />} />
        </Route>
        <Route path="/login" element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
        </Routes>
        </AttentionProvider>
      </AdminSearchProvider>
    </AdminApiProvider>
  );
}

export default function App() {
  const {state, login, logout} = useAdminSession();

  if (state.status === 'loading') {
    return null;
  }

  return (
    <BrowserRouter>
      {state.status === 'authenticated' ? (
        <AdminRoutes token={state.session.token} admin={state.session.admin} onLogout={logout} />
      ) : (
        <Routes>
          <Route path="*" element={<AdminLoginScreen onAuthenticated={login} />} />
        </Routes>
      )}
    </BrowserRouter>
  );
}
