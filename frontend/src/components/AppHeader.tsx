'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ReactNode, useState } from 'react';
import { User } from '@/types';
import DictionarySidebar from './DictionarySidebar';
import NotificationBell from './NotificationBell';
import ProfileModal from './ProfileModal';
import Avatar from './Avatar';

type Section = 'boards' | 'changelog' | 'admin';

interface Props {
  user: User | null;
  /** Marks the current page in the nav. */
  current?: Section;
  /** Page context after the brand, e.g. a board name. Truncates when tight. */
  breadcrumb?: ReactNode;
  /** Page-specific controls, placed before the global actions. */
  actions?: ReactNode;
}

// The header every page shares. Each page used to build its own: the changelog
// page showed "Boards" where the dashboard showed "Changelog", the admin page had
// neither and put Logout in the nav, and the board page had an unlabelled
// document icon. Opening the changelog meant losing your place and landing on a
// top bar that had rearranged itself.
export default function AppHeader({ user, current, breadcrumb, actions }: Props) {
  const router = useRouter();
  const [showProfile, setShowProfile] = useState(false);
  // The dictionary lives in the header rather than on a page, so a term is
  // reachable from the workspace and from inside every board alike.
  const [showDictionary, setShowDictionary] = useState(false);

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
          {user && (
            <button
              onClick={() => setShowDictionary((open) => !open)}
              aria-expanded={showDictionary}
              aria-label="Riverly Dictionary"
              className={`flex items-center gap-1.5 text-sm px-2.5 sm:px-3 py-1.5 rounded-lg font-medium transition-colors ${
                showDictionary ? 'text-gray-900 bg-gray-100' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
              <span className="hidden lg:inline">Dictionary</span>
            </button>
          )}
          {navLink('boards', '/dashboard', 'Boards')}
          {navLink('changelog', '/changelog', 'Changelog')}
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
        </div>
      </nav>

      {showProfile && user && (
        <ProfileModal user={user} onClose={() => setShowProfile(false)} onLogout={logout} />
      )}

      {showDictionary && user && (
        <DictionarySidebar user={user} onClose={() => setShowDictionary(false)} />
      )}
    </>
  );
}
