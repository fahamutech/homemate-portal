import type {ReactElement} from 'react';
import {render} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {AdminApiProvider} from '../../api/AdminApiContext';
import {AdminSearchProvider, useAdminSearchBar} from './searchContext';
import {AttentionProvider} from './attentionContext';
import {createFakeAdminApi} from '../../api/adminApi.fake';
import type {AdminApi} from '../../api/adminApi';

/**
 * Stand-in for the top app bar's search box. The real one lives in
 * AdminLayout; rendering an equivalent here means page tests exercise the
 * actual contextual-search path (register → type → debounce → refetch)
 * rather than a bypass.
 */
function SearchBarHarness() {
  const search = useAdminSearchBar();
  if (!search.registration) return null;
  return (
    <input
      type="search"
      aria-label="Search this page"
      placeholder={search.registration.placeholder}
      value={search.term}
      onChange={(event) => search.setTerm(event.target.value)}
    />
  );
}

/**
 * Renders an admin screen with a fake AdminApi and a router — the two things
 * every one of these screens needs. Returns the api so a test can assert on
 * calls or drive a specific failure.
 */
export function renderAdminScreen(
  ui: ReactElement,
  {api = createFakeAdminApi(), route = '/admin'}: {api?: AdminApi; route?: string} = {}
) {
  const result = render(
    <MemoryRouter initialEntries={[route]}>
      <AdminApiProvider api={api}>
        {/* screens may register the shared top-bar search, so the provider
            has to be present exactly as it is in the real layout */}
        <AdminSearchProvider>
          {/* polling off: a test drives refreshes explicitly rather than
              racing a timer */}
          <AttentionProvider pollMs={0}>
            <SearchBarHarness />
            {ui}
          </AttentionProvider>
        </AdminSearchProvider>
      </AdminApiProvider>
    </MemoryRouter>
  );
  return {...result, api};
}
