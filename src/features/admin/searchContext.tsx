import {createContext, useCallback, useContext, useEffect, useMemo, useState} from 'react';
import type {ReactNode} from 'react';
import {useLocation} from 'react-router-dom';
import {useDebouncedValue} from '../../hooks/useDebouncedValue';

interface SearchRegistration {
  placeholder: string;
}

interface AdminSearchContextValue {
  term: string;
  setTerm: (term: string) => void;
  registration: SearchRegistration | null;
  register: (registration: SearchRegistration | null) => void;
}

const AdminSearchContext = createContext<AdminSearchContextValue | null>(null);

/**
 * The top app bar's search box belongs to whichever screen is open: Properties
 * searches listings, Users searches people, and a screen that has nothing to
 * search (Settings) hides the box entirely.
 *
 * Two behaviours matter here and are easy to get wrong:
 *  - the term is cleared on navigation, so a keyword typed on Properties does
 *    not silently filter Users when you switch to it;
 *  - screens consume a *debounced* term, so typing doesn't fire a request per
 *    keystroke.
 */
export function AdminSearchProvider({children}: {children: ReactNode}) {
  const [term, setTerm] = useState('');
  const [registration, setRegistration] = useState<SearchRegistration | null>(null);
  const location = useLocation();

  useEffect(() => {
    setTerm('');
  }, [location.pathname]);

  const register = useCallback((next: SearchRegistration | null) => setRegistration(next), []);

  const value = useMemo(
    () => ({term, setTerm, registration, register}),
    [term, registration, register]
  );

  return <AdminSearchContext.Provider value={value}>{children}</AdminSearchContext.Provider>;
}

function useAdminSearchContext() {
  const context = useContext(AdminSearchContext);
  if (!context) throw new Error('Admin search components must be used inside an AdminSearchProvider');
  return context;
}

/** Used by AdminLayout to render the shared box. */
export function useAdminSearchBar() {
  return useAdminSearchContext();
}

/**
 * Called by a screen that wants the top-bar search. Registers the placeholder
 * while mounted and returns the debounced term to filter on.
 */
export function useAdminSearch(placeholder: string): string {
  const {term, register} = useAdminSearchContext();

  useEffect(() => {
    register({placeholder});
    return () => register(null);
  }, [placeholder, register]);

  return useDebouncedValue(term, 350);
}
