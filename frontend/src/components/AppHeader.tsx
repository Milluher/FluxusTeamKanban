'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { User } from '@/types';
import ChangelogSidebar from './ChangelogSidebar';
import DictionarySidebar from './DictionarySidebar';
import InitiativesSidebar from './InitiativesSidebar';
import PersonasPanel from './PersonasPanel';
import NotificationBell from './NotificationBell';
import ProfileModal from './ProfileModal';
import Avatar from './Avatar';

type Section = 'boards' | 'admin';

/** The panels that open beside the page rather than replacing it. */
type Panel = 'dictionary' | 'personas' | 'initiatives' | 'changelog';

/**
 * The panel toggles, as data.
 *
 * Rendered twice — as a row of icons on a wide screen, as labelled rows inside
 * the mobile menu — and they were four near-identical buttons before, so the
 * two renderings could disagree about which panels exist. The accessible name
 * is the only name an icon button has, which is why it is spelled out here
 * rather than left to the hidden label.
 */
const PANELS: { key: Panel; label: string; icon: ReactNode }[] = [
  {
    key: 'personas',
    label: 'Personas',
    icon: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      </>
    ),
  },
  {
    key: 'initiatives',
    label: 'Initiatives',
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="4.5" />
        <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      </>
    ),
  },
  {
    key: 'dictionary',
    label: 'Riverly Dictionary',
    icon: (
      <>
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </>
    ),
  },
  {
    key: 'changelog',
    label: 'Changelog',
    icon: (
      <>
        <path d="M12 8v4l3 2" />
        <path d="M3.05 11a9 9 0 1 1 .5 4" />
        <polyline points="3 20 3 15 8 15" />
      </>
    ),
  },
];

/** One 15px line-art glyph, the shape every header control shares. */
function PanelIcon({ children }: { children: ReactNode }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      {children}
    </svg>
  );
}

interface Props {
  user: User | null;
  /** Marks the current page in the nav. */
  current?: Section;
  /** Page context after the brand, e.g. a board name. Truncates when tight. */
  breadcrumb?: ReactNode;
  /** Page-specific controls, placed before the global actions. */
  actions?: ReactNode;
  /**
   * The board the page is showing, if it is showing one.
   *
   * The panels live in the header but their contents belong to a board, so the
   * header is the only thing that knows which board to scope them to. Left
   * undefined — on the dashboard, the admin screens — the panels show every
   * board the user can see and ask which board a new entry is for.
   */
  boardId?: string;
  /**
   * Page controls to fold into the mobile menu as labelled rows.
   *
   * A phone header holds about four controls. Anything a page wants beyond that
   * has to go somewhere, and an icon pushed off the right edge is worse than one
   * behind a menu — so a page passes the overflow here and hides it from
   * `actions` below `sm`, rather than every page inventing its own answer.
   */
  menuExtras?: ReactNode;
}

// The header every page shares. Each page used to build its own: the changelog
// page showed "Boards" where the dashboard showed "Changelog", the admin page had
// neither and put Logout in the nav, and the board page had an unlabelled
// document icon. Opening the changelog meant losing your place and landing on a
// top bar that had rearranged itself.
export default function AppHeader({ user, current, breadcrumb, actions, boardId, menuExtras }: Props) {
  const router = useRouter();
  const [showProfile, setShowProfile] = useState(false);
  // Below `sm` the nav and the panel toggles collapse behind one button. Eight
  // controls plus whatever the page adds does not fit across a phone, and with
  // `flex-shrink-0` holding their width they did not wrap or compress — they
  // simply ran off the edge, taking Admin and the account menu with them.
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  // The personas, the initiatives, the dictionary and the changelog all live in
  // the header rather than on a page, so each is reachable from the workspace
  // and from inside every board alike. One slot, because they would otherwise
  // render on top of each other.
  //
  // What they show depends on `boardId`: that board's entries inside a board,
  // everything you can see outside one.
  //
  // They are panels for the same reason: each answers a question you ask *while*
  // looking at the work. "Who is this for", "what goal does this serve", "what
  // does that word mean", "did that already ship" — reading any of them used to
  // cost you the board or the sprint you had open.
  const [panel, setPanel] = useState<Panel | null>(null);
  const togglePanel = (next: Panel) => setPanel((open) => (open === next ? null : next));

  useEffect(() => {
    if (!showMenu) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setShowMenu(false);
    };
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowMenu(false); };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [showMenu]);

  // Opening a panel from the menu closes the menu: the panel it opens covers
  // the same corner of the screen the menu was occupying.
  const openPanelFromMenu = (next: Panel) => {
    setShowMenu(false);
    togglePanel(next);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/');
  };

  const navLink = (section: Section, href: string, label: string) => (
    <Link
      href={href}
      aria-current={current === section ? 'page' : undefined}
      className={`text-sm px-2.5 sm:px-3 py-1.5 rounded-lg font-medium transition-colors ${
        current === section ? 'text-gray-900 bg-gray-100' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
      }`}
    >
      {label}
    </Link>
  );

  return (
    <>
      <nav className="bg-white border-b border-gray-200 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-10 h-14 flex-shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Link href="/dashboard" className="flex items-center gap-2.5 flex-shrink-0" aria-label="FluxusTeam home">
            <Image src="/logo.png" width={28} height={28} alt="" className="rounded-md" />
            <span className="font-bold text-base tracking-tight hidden sm:inline" style={{ color: '#1a1f3c' }}>
              FluxusTeam
            </span>
          </Link>
          {breadcrumb && (
            <>
              <span className="text-gray-300 hidden sm:inline" aria-hidden="true">/</span>
              <div className="min-w-0">{breadcrumb}</div>
            </>
          )}
        </div>

        <div className="flex items-center gap-1 sm:gap-3 flex-shrink-0">
          {actions}

          {/* Wide screens: everything in reach, in one row. */}
          <div className="hidden sm:flex items-center gap-1 sm:gap-3">
            {user && PANELS.map((p) => (
              <button
                key={p.key}
                onClick={() => togglePanel(p.key)}
                aria-expanded={panel === p.key}
                aria-label={p.label}
                className={`flex items-center gap-1.5 text-sm px-2.5 sm:px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  panel === p.key ? 'text-gray-900 bg-gray-100' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                }`}
              >
                <PanelIcon>{p.icon}</PanelIcon>
                <span className="hidden lg:inline">{p.label === 'Riverly Dictionary' ? 'Dictionary' : p.label}</span>
              </button>
            ))}
            {navLink('boards', '/dashboard', 'Boards')}
            {user?.role === 'admin' && (
              <Link
                href="/admin"
                aria-current={current === 'admin' ? 'page' : undefined}
                className="text-sm px-2.5 sm:px-3 py-1.5 rounded-lg font-medium border transition-all duration-150"
                style={{ color: '#c73009', borderColor: '#e8390e', background: current === 'admin' ? '#fff7f5' : 'white' }}
              >
                Admin
              </Link>
            )}
          </div>

          {/* Kept visible at every width: a notification you cannot see is a
              notification you do not get, and the account menu is the way out. */}
          {user && <NotificationBell userId={user.id} />}
          {user && (
            <button
              onClick={() => setShowProfile(true)}
              className="flex items-center gap-2 min-h-[44px] px-1 rounded-lg hover:bg-gray-50 transition-colors"
              aria-label={`Account menu for ${user.name}`}
            >
              <Avatar name={user.name} className="w-8 h-8 text-xs" decorative />
              <span className="hidden md:block text-sm font-medium text-gray-700">{user.name}</span>
            </button>
          )}

          {/* Phones: one button for all of it, with the labels an icon row has
              to hide. */}
          {user && (
            <div className="sm:hidden relative" ref={menuRef}>
              <button
                onClick={() => setShowMenu((open) => !open)}
                aria-expanded={showMenu}
                aria-haspopup="menu"
                aria-label="More"
                className={`w-11 h-11 flex items-center justify-center rounded-lg transition-colors ${
                  showMenu ? 'text-gray-900 bg-gray-100' : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>

              {showMenu && (
                <div
                  role="menu"
                  aria-label="More"
                  className="absolute right-0 top-full mt-2 min-w-[220px] max-w-[calc(100vw-2rem)] bg-white border border-gray-200 rounded-xl shadow-lg py-1.5 z-30"
                >
                  {/* Whatever the page could not fit in the bar, first:
                      it is the most specific thing to where you are. */}
                  {menuExtras && (
                    <>
                      <div onClick={() => setShowMenu(false)}>{menuExtras}</div>
                      <div className="my-1.5 border-t border-gray-100" />
                    </>
                  )}

                  {PANELS.map((p) => (
                    <button
                      key={p.key}
                      role="menuitem"
                      onClick={() => openPanelFromMenu(p.key)}
                      className={`w-full flex items-center gap-2.5 px-4 py-2.5 min-h-[44px] text-sm font-medium text-left transition-colors ${
                        panel === p.key ? 'text-gray-900 bg-gray-50' : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <span className="text-gray-500 flex-shrink-0"><PanelIcon>{p.icon}</PanelIcon></span>
                      {p.label}
                    </button>
                  ))}

                  <div className="my-1.5 border-t border-gray-100" />

                  <Link
                    href="/dashboard"
                    role="menuitem"
                    onClick={() => setShowMenu(false)}
                    aria-current={current === 'boards' ? 'page' : undefined}
                    className={`w-full flex items-center gap-2.5 px-4 py-2.5 min-h-[44px] text-sm font-medium transition-colors ${
                      current === 'boards' ? 'text-gray-900 bg-gray-50' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span className="text-gray-500 flex-shrink-0">
                      <PanelIcon>
                        <path d="M3 3h6v12H3V3zm8 0h6v8h-6V3zm8 0h2v18h-2V3zM3 17h6v4H3v-4zm8-4h6v8h-6v-8z" />
                      </PanelIcon>
                    </span>
                    Boards
                  </Link>

                  {user.role === 'admin' && (
                    <Link
                      href="/admin"
                      role="menuitem"
                      onClick={() => setShowMenu(false)}
                      aria-current={current === 'admin' ? 'page' : undefined}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 min-h-[44px] text-sm font-semibold transition-colors hover:bg-gray-50"
                      style={{ color: '#c73009' }}
                    >
                      <span className="flex-shrink-0">
                        <PanelIcon>
                          <circle cx="12" cy="12" r="3" />
                          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                        </PanelIcon>
                      </span>
                      Admin
                    </Link>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </nav>

      {showProfile && user && (
        <ProfileModal user={user} onClose={() => setShowProfile(false)} onLogout={logout} />
      )}

      {panel === 'dictionary' && user && (
        <DictionarySidebar user={user} boardId={boardId} onClose={() => setPanel(null)} />
      )}

      {panel === 'personas' && user && (
        <PersonasPanel user={user} boardId={boardId} onClose={() => setPanel(null)} />
      )}

      {panel === 'initiatives' && user && (
        <InitiativesSidebar user={user} boardId={boardId} onClose={() => setPanel(null)} />
      )}

      {panel === 'changelog' && user && (
        <ChangelogSidebar user={user} boardId={boardId} onClose={() => setPanel(null)} />
      )}
    </>
  );
}
