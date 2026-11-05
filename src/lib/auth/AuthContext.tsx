'use client';

import { createContext, useContext, useCallback } from 'react';
import { AppRole } from '@/types/database';
import { switchDemoRoleAction } from '@/lib/actions/auth';
import { hasPermission, ROLE_PERMISSIONS } from '@/lib/permissions/roles';

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

export function AuthProvider({
  children,
  roles,
  userName,
  userEmail,
  isRealSession,
}: {
  children: React.ReactNode;
  roles: AppRole[];
  userName: string;
  userEmail: string;
  isRealSession: boolean;
}) {
  // Demo role switching swaps the server session, so reload to refetch data under the new role.
  const setActiveRole = useCallback(async (role: AppRole) => {
    const result = await switchDemoRoleAction(role);
    if (result.ok) window.location.reload();
  }, []);

  const can = useCallback((permission: PermissionKey) => hasPermission(roles, permission), [roles]);

  return (
    <AuthContext.Provider
      value={{
        activeRole: roles[0] ?? 'viewer',
        roles,
        userName,
        userEmail,
        isRealSession,
        setActiveRole,
        can,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
