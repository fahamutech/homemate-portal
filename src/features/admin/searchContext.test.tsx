import {describe, test, expect} from 'vitest';
import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter, Route, Routes, Link} from 'react-router-dom';
import {AdminSearchProvider, useAdminSearch, useAdminSearchBar} from './searchContext';

function SearchBar() {
  const search = useAdminSearchBar();
  if (!search.registration) return <span>No search on this page</span>;
  return (
    <input
      aria-label="Search this page"
      placeholder={search.registration.placeholder}
      value={search.term}
      onChange={(event) => search.setTerm(event.target.value)}
    />
  );
}

function SearchingScreen({label, onTerm}: {label: string; onTerm?: (term: string) => void}) {
  const term = useAdminSearch(label);
  onTerm?.(term);
  return <p>{label} results for: {term || '(nothing)'}</p>;
}

function QuietScreen() {
  return <p>This screen has nothing to search</p>;
}

function renderApp(initial = '/properties', onTerm?: (term: string) => void) {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <AdminSearchProvider>
        <SearchBar />
        <Link to="/properties">Properties</Link>
        <Link to="/users">Users</Link>
        <Link to="/settings">Settings</Link>
        <Routes>
          <Route path="/properties" element={<SearchingScreen label="Title or reference code" onTerm={onTerm} />} />
          <Route path="/users" element={<SearchingScreen label="Name, email or phone" />} />
          <Route path="/settings" element={<QuietScreen />} />
        </Routes>
      </AdminSearchProvider>
    </MemoryRouter>
  );
}

describe('contextual top-bar search', () => {
  test('shows the placeholder registered by the active screen', async () => {
    renderApp();
    expect(await screen.findByPlaceholderText('Title or reference code')).toBeInTheDocument();
  });

  test('hides itself on a screen that registers no search', async () => {
    const user = userEvent.setup();
    renderApp();
    await screen.findByPlaceholderText('Title or reference code');

    await user.click(screen.getByRole('link', {name: 'Settings'}));

    expect(await screen.findByText('No search on this page')).toBeInTheDocument();
    expect(screen.queryByLabelText('Search this page')).not.toBeInTheDocument();
  });

  test('swaps the placeholder when the active screen changes', async () => {
    const user = userEvent.setup();
    renderApp();
    await screen.findByPlaceholderText('Title or reference code');

    await user.click(screen.getByRole('link', {name: 'Users'}));

    expect(await screen.findByPlaceholderText('Name, email or phone')).toBeInTheDocument();
  });

  test('clears the keyword when navigating to another screen', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.type(screen.getByLabelText('Search this page'), 'masaki');
    expect(screen.getByLabelText('Search this page')).toHaveValue('masaki');

    await user.click(screen.getByRole('link', {name: 'Users'}));

    // the keyword must not follow you across screens
    expect(await screen.findByPlaceholderText('Name, email or phone')).toHaveValue('');
    expect(screen.getByText(/Name, email or phone results for: \(nothing\)/)).toBeInTheDocument();
  });

  test('debounces: a screen sees one settled term, not one per keystroke', async () => {
    const terms: string[] = [];
    const user = userEvent.setup();
    renderApp('/properties', (term) => {
      if (terms.at(-1) !== term) terms.push(term);
    });

    await user.type(screen.getByLabelText('Search this page'), 'masaki');

    await waitFor(() => expect(terms.at(-1)).toBe('masaki'), {timeout: 2000});
    // '' plus the settled value — never the intermediate prefixes
    expect(terms).toEqual(['', 'masaki']);
  });
});
