import {useEffect, useState} from 'react';
import {NavLink, Outlet, useLocation, useNavigate} from 'react-router-dom';
import type {AdminAccount} from '../../api/adminAuthClient';
import {ADMIN_NAV_ITEMS} from './navConfig';
import {AdminNavIcon} from './icons';
import {useAdminSearchBar} from './searchContext';
import {useAttention} from './attentionContext';
import {humanise} from '../../components/ui';
import bellIcon from '../../assets/icons/bell.svg';
import searchIcon from '../../assets/icons/search.svg';
import styles from './AdminLayout.module.css';

export interface AdminLayoutProps {
  admin: AdminAccount;
  onLogout: () => void;
}

function initialsFor(email: string): string {
  const localPart = email.split('@')[0] ?? '';
  return localPart.slice(0, 2).toUpperCase();
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator',
  manager: 'Manager',
  moderator: 'Moderator',
  finance_auditor: 'Finance Auditor',
};

/** role='admin' always sees everything; other roles are scoped to their granted sections. */
function visibleNavItems(admin: AdminAccount) {
  if (admin.role === 'admin') return ADMIN_NAV_ITEMS;
  const granted = admin.allowedRoutes ?? [];
  return ADMIN_NAV_ITEMS.filter((item) => item.aclKey === 'dashboard' || granted.includes(item.aclKey));
}

/**
 * Pixel reference: Figma node 2:4072 (sidebar 374:777 Role=SuperAdmin, top bar
 * 2:4122). Desktop keeps the 240px sidebar; below 1024px it becomes an
 * off-canvas drawer opened from the top bar, so the console is usable on a
 * phone as well as at the designed 1440px.
 */
export function AdminLayout({admin, onLogout}: AdminLayoutProps) {
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);
  const search = useAdminSearchBar();
  const attention = useAttention();
  const totalWaiting = Object.values(attention.badges).reduce((sum, count) => sum + count, 0);
  const navItems = visibleNavItems(admin);
  const currentItem = ADMIN_NAV_ITEMS.find((item) => location.pathname.startsWith(item.path));
  const navigate = useNavigate();

  // Navigating on a phone should close the drawer behind you.
  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  // A direct link (bookmark, typed URL) to a section this account was never
  // granted should not render — the API would 403 it anyway, so send them
  // somewhere they can actually use instead of a broken screen.
  useEffect(() => {
    if (currentItem && !navItems.some((item) => item.path === currentItem.path)) {
      navigate('/admin/dashboard', {replace: true});
    }
  }, [currentItem, navItems, navigate]);

  return (
    <div className={styles.shell}>
      {navOpen && <div className={styles.scrim} onClick={() => setNavOpen(false)} aria-hidden="true" />}

      <aside className={`${styles.sidebar} ${navOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.sidebarTop}>
          <div className={styles.logoRow}>
            <div className={styles.logoIcon} />
            <div>
              <p className={styles.logoTitle}>HomeMate</p>
              <p className={styles.logoSubtitle}>AFRICA ADMIN</p>
            </div>
          </div>

          <nav className={styles.navList} aria-label="Admin sections">
            {navItems.map((item) => {
              const waiting = item.badge ? attention.badges[item.badge] : 0;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({isActive}) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
                >
                  <AdminNavIcon icon={item.icon} />
                  <span className={styles.navLabel}>{item.label}</span>
                  {waiting > 0 && (
                    /* The number is the point, so it is in the accessible name
                       too — a screen reader should hear "Users, 3 need
                       attention", not just "Users". */
                    <span className={styles.navBadge} aria-label={`${waiting} need attention`}>
                      {waiting > 99 ? '99+' : waiting}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>

        <div className={styles.userProfile}>
          <div className={styles.avatar}>{initialsFor(admin.email)}</div>
          <div className={styles.userInfo}>
            <p className={styles.userEmail} title={admin.email}>{admin.email}</p>
            <p className={styles.userRole}>{ROLE_LABELS[admin.role] ?? humanise(admin.role)}</p>
          </div>
          <button className={styles.logoutButton} onClick={onLogout}>Log out</button>
        </div>
      </aside>

      <div className={styles.contentWrapper}>
        <header className={styles.topBar}>
          <div className={styles.topBarLeft}>
            <button
              type="button"
              className={styles.menuButton}
              aria-label="Open navigation"
              aria-expanded={navOpen}
              onClick={() => setNavOpen((open) => !open)}
            >
              <span />
              <span />
              <span />
            </button>
            <div>
              <p className={styles.topBarTitle}>{currentItem?.title ?? 'HomeMate Africa Admin'}</p>
              <p className={styles.topBarSubtitle}>{currentItem?.subtitle ?? ''}</p>
            </div>
          </div>
          <div className={styles.topBarRight}>
            {/* the box belongs to the open screen: it searches what you are
                looking at, and disappears where there is nothing to search */}
            {search.registration && (
              <div className={styles.searchBox}>
                <img src={searchIcon} alt="" width={16} height={16} />
                <input
                  type="search"
                  aria-label="Search this page"
                  placeholder={search.registration.placeholder}
                  value={search.term}
                  onChange={(event) => search.setTerm(event.target.value)}
                />
              </div>
            )}
            <button
              className={styles.iconButton}
              aria-label={
                totalWaiting > 0 ? `Notifications, ${totalWaiting} items need attention` : 'Notifications'
              }
            >
              <img src={bellIcon} alt="" width={18} height={18} />
              {totalWaiting > 0 && <span className={styles.notificationDot} />}
            </button>
          </div>
        </header>

        <main className={styles.mainBody}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
