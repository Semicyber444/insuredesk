'use client';

import { createContext, useContext, useSyncExternalStore, useCallback, useMemo } from 'react';
import { AppRole } from '@/types/database';
import { DEMO_USERS } from './demoUsers';
import { hasPermission, ROLE_PERMISSIONS } from '@/lib/permissions/roles';

export const DEMO_ROLE_STORAGE_KEY = 'insuredesk_active_role_v1';

type PermissionKey = keyof typeof ROLE_PERMISSIONS['admin'];

interface AuthContextValue {
  activeRole: AppRole;
  roles: AppRole[];
  userName: string;
  userEmail: string;
  isRealSession: boolean;
  setActiveRole: (role: AppRole) => void;
  can: (permission: PermissionKey) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const roleListeners = new Set<() => void>();

function subscribeRole(callback: () => void) {
  roleListeners.add(callback);
  if (typeof window !== 'undefined') {
    const onStorage = (e: StorageEvent) => {
      if (e.key === DEMO_ROLE_STORAGE_KEY) callback();
    };
    window.addEventListener('storage', onStorage);
    return () => {
      roleListeners.delete(callback);
      window.removeEventListener('storage', onStorage);
    };
  }
  return () => {
    roleListeners.delete(callback);
  };
}

export function setStoredDemoRole(role: AppRole) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DEMO_ROLE_STORAGE_KEY, role);
    roleListeners.forEach((fn) => fn());
  } catch {
    // Ignore storage quota errors
  }
}

export function AuthProvider({
  children,
  initialRole = 'admin',
  initialUserName = 'สมชาย ผู้ดูแลระบบ',
  initialEmail = 'admin@insuredesk.team',
  isRealSession = false,
  realRoles,
}: {
  children: React.ReactNode;
  initialRole?: AppRole;
  initialUserName?: string;
  initialEmail?: string;
  isRealSession?: boolean;
  realRoles?: AppRole[];
}) {
  const storedRole = useSyncExternalStore(
    subscribeRole,
    () => {
      if (typeof window === 'undefined') return initialRole;
      const saved = localStorage.getItem(DEMO_ROLE_STORAGE_KEY) as AppRole | null;
      if (saved && ['admin', 'reviewer', 'editor', 'viewer'].includes(saved)) {
        return saved;
      }
      return initialRole;
    },
    () => initialRole
  );

  const activeRole: AppRole = isRealSession ? initialRole : storedRole;

  const demoUser = DEMO_USERS[activeRole] ?? DEMO_USERS.admin;
  const userName = isRealSession ? initialUserName : demoUser.profile.display_name;
  const userEmail = isRealSession ? initialEmail : demoUser.user.email;
  const effectiveRoles: AppRole[] = useMemo(
    () => (isRealSession && realRoles?.length ? realRoles : [activeRole]),
    [isRealSession, realRoles, activeRole]
  );

  const handleSetRole = useCallback((role: AppRole) => {
    setStoredDemoRole(role);
  }, []);

  const can = useCallback(
    (permission: PermissionKey) => hasPermission(effectiveRoles, permission),
    [effectiveRoles]
  );

  return (
    <AuthContext.Provider
      value={{
        activeRole,
        roles: effectiveRoles,
        userName,
        userEmail,
        isRealSession,
        setActiveRole: handleSetRole,
        can,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    return {
      activeRole: 'admin',
      roles: ['admin'],
      userName: 'สมชาย ผู้ดูแลระบบ',
      userEmail: 'admin@insuredesk.team',
      isRealSession: false,
      setActiveRole: setStoredDemoRole,
      can: (permission) => hasPermission(['admin'], permission),
    };
  }
  return ctx;
}
