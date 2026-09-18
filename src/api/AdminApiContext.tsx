import {createContext, useContext} from 'react';
import type {ReactNode} from 'react';
import type {AdminApi} from './adminApi';

const AdminApiContext = createContext<AdminApi | null>(null);

export function AdminApiProvider({api, children}: {api: AdminApi; children: ReactNode}) {
  return <AdminApiContext.Provider value={api}>{children}</AdminApiContext.Provider>;
}

export function useAdminApi(): AdminApi {
  const api = useContext(AdminApiContext);
  if (!api) throw new Error('useAdminApi must be used inside an AdminApiProvider');
  return api;
}
