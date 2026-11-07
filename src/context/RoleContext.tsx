"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api-client';

export type CRUDAction = 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'APPROVE' | 'EXPORT';

export const MODULES = [
  'DASHBOARD',
  'EMPLOYEES',
  'ONBOARDING',
  'ATTENDANCE',
  'PAYROLL',
  'LOANS',
  'LEAVE',
  'PERFORMANCE',
  'LOCATIONS',
  'LETTERS',
  'TOUR_EXPENSES',
  'REPORTS',
  'SETTINGS',
  'ROLE_MGMT'
] as const;

export type ModuleName = typeof MODULES[number];

export interface RoleDefinition {
  id?: number;
  name: string;
  display_name?: string;
  description?: string;
  is_system?: boolean;
  employee_count?: number;
  permissions: Record<ModuleName, CRUDAction[]>;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  role_id?: number;
  permissions?: string[];
  branch?: string;
  department?: string;
}

interface RoleContextType {
  user: User | null;
  role: string;
  availableRoles: RoleDefinition[];
  loadingRoles: boolean;
  refreshRoles: () => Promise<void>;
  hasPermission: (module: ModuleName, action: CRUDAction) => boolean;
  hasDirectPermission: (permissionSlug: string) => boolean;
  updateRolePermissions: (roleNameOrId: string | number, permissions: Record<ModuleName, CRUDAction[]>) => Promise<boolean>;
  createRole: (roleName: string, permissions: Record<ModuleName, CRUDAction[]>, description?: string) => Promise<boolean>;
  deleteRole: (roleNameOrId: string | number) => Promise<boolean>;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

const FULL_CRUD: CRUDAction[] = ['CREATE', 'READ', 'UPDATE', 'DELETE', 'APPROVE', 'EXPORT'];
const READ_ONLY: CRUDAction[] = ['READ'];
const NO_ACCESS: CRUDAction[] = [];

// Fallback baseline in case network is initialising
const initialFallbackRoles: RoleDefinition[] = [
  {
    name: 'SUPER_ADMIN',
    display_name: 'Super Administrator',
    is_system: true,
    permissions: {
      DASHBOARD: FULL_CRUD, EMPLOYEES: FULL_CRUD, ONBOARDING: FULL_CRUD, ATTENDANCE: FULL_CRUD,
      PAYROLL: FULL_CRUD, LOANS: FULL_CRUD, LEAVE: FULL_CRUD, LOCATIONS: FULL_CRUD,
      LETTERS: FULL_CRUD, TOUR_EXPENSES: FULL_CRUD, REPORTS: FULL_CRUD, SETTINGS: FULL_CRUD,
      ROLE_MGMT: FULL_CRUD, PERFORMANCE: FULL_CRUD
    }
  },
  {
    name: 'ADMIN',
    display_name: 'Administrator',
    is_system: true,
    permissions: {
      DASHBOARD: FULL_CRUD, EMPLOYEES: FULL_CRUD, ONBOARDING: FULL_CRUD, ATTENDANCE: FULL_CRUD,
      PAYROLL: FULL_CRUD, LOANS: FULL_CRUD, LEAVE: FULL_CRUD, LOCATIONS: FULL_CRUD,
      LETTERS: FULL_CRUD, TOUR_EXPENSES: FULL_CRUD, REPORTS: FULL_CRUD, SETTINGS: FULL_CRUD,
      ROLE_MGMT: READ_ONLY, PERFORMANCE: FULL_CRUD
    }
  },
  {
    name: 'HR',
    display_name: 'HR Manager',
    is_system: true,
    permissions: {
      DASHBOARD: READ_ONLY, EMPLOYEES: ['CREATE', 'READ', 'UPDATE', 'EXPORT'], ONBOARDING: FULL_CRUD,
      ATTENDANCE: FULL_CRUD, PAYROLL: ['CREATE', 'READ', 'UPDATE', 'EXPORT'], LOANS: FULL_CRUD,
      LEAVE: FULL_CRUD, LOCATIONS: READ_ONLY, LETTERS: FULL_CRUD, TOUR_EXPENSES: ['READ', 'APPROVE', 'EXPORT'],
      REPORTS: FULL_CRUD, SETTINGS: READ_ONLY, ROLE_MGMT: NO_ACCESS, PERFORMANCE: ['READ', 'UPDATE']
    }
  },
  {
    name: 'MANAGER',
    display_name: 'Team Manager',
    is_system: true,
    permissions: {
      DASHBOARD: READ_ONLY, EMPLOYEES: ['READ', 'UPDATE'], ONBOARDING: NO_ACCESS, ATTENDANCE: ['READ', 'APPROVE'],
      PAYROLL: NO_ACCESS, LOANS: READ_ONLY, LEAVE: ['READ', 'APPROVE'], LOCATIONS: READ_ONLY,
      LETTERS: NO_ACCESS, TOUR_EXPENSES: ['READ', 'APPROVE'], REPORTS: READ_ONLY,
      SETTINGS: NO_ACCESS, ROLE_MGMT: NO_ACCESS, PERFORMANCE: FULL_CRUD
    }
  },
  {
    name: 'EMPLOYEE',
    display_name: 'Staff Employee',
    is_system: true,
    permissions: {
      DASHBOARD: READ_ONLY, EMPLOYEES: NO_ACCESS, ONBOARDING: NO_ACCESS, ATTENDANCE: ['CREATE', 'READ'],
      PAYROLL: READ_ONLY, LOANS: ['CREATE', 'READ'], LEAVE: ['CREATE', 'READ', 'DELETE'], LOCATIONS: NO_ACCESS,
      LETTERS: READ_ONLY, TOUR_EXPENSES: ['CREATE', 'READ'], REPORTS: NO_ACCESS,
      SETTINGS: NO_ACCESS, ROLE_MGMT: NO_ACCESS, PERFORMANCE: READ_ONLY
    }
  }
];

export const RoleProvider = ({ children }: { children: ReactNode }) => {
  const auth = useAuth();
  const user = auth.user;

  const [availableRoles, setAvailableRoles] = useState<RoleDefinition[]>(initialFallbackRoles);
  const [loadingRoles, setLoadingRoles] = useState<boolean>(true);

  // Fetch live roles and permissions matrix from backend API
  const refreshRoles = useCallback(async () => {
    try {
      const data = await apiGet<any[]>('/roles');
      if (Array.isArray(data) && data.length > 0) {
        const formatted: RoleDefinition[] = data.map((r) => {
          const rawMatrix = r.matrix || {};
          const fullMatrix = {} as Record<ModuleName, CRUDAction[]>;
          const isSuper = r.name === 'SUPER_ADMIN';
          MODULES.forEach((m) => {
            fullMatrix[m] = isSuper ? [...FULL_CRUD] : (rawMatrix[m] || []);
          });
          return {
            id: r.id,
            name: r.name,
            display_name: r.display_name || r.name,
            description: r.description,
            is_system: r.is_system,
            employee_count: r.employee_count || 0,
            permissions: fullMatrix,
          };
        });
        setAvailableRoles(formatted);
      }
    } catch (_) {
      // Keep initialFallbackRoles if offline/loading
    } finally {
      setLoadingRoles(false);
    }
  }, []);

  useEffect(() => {
    if (auth.isAuthenticated) {
      refreshRoles();
    }
  }, [auth.isAuthenticated, refreshRoles]);

  /**
   * Evaluates if current user has permission for a specific module and action
   */
  const hasPermission = (module: ModuleName, action: CRUDAction): boolean => {
    if (!user) return false;

    const userRole = (user.role || '').toUpperCase();

    // 1. Super Admin and Admin bypass all module permission checks
    if (userRole === 'SUPER_ADMIN' || userRole === 'ADMIN') {
      return true;
    }

    // 2. Wildcard check in user's permissions array from JWT
    const userPerms = user.permissions || [];
    if (userPerms.includes('*')) {
      return true;
    }

    // 3. Module-level wildcard check (e.g. 'employees:*')
    const modLower = module.toLowerCase();
    const actLower = action.toLowerCase();
    if (userPerms.includes(`${modLower}:*`)) {
      return true;
    }

    // 4. Exact slug match in user's live token permissions
    if (userPerms.includes(`${modLower}:${actLower}`)) {
      return true;
    }

    // 5. Check role definition matrix from current state
    const currentRoleDef = availableRoles.find((r) => r.name === userRole);
    if (!currentRoleDef) return false;

    const modulePerms = currentRoleDef.permissions[module];
    if (!modulePerms) return false;

    return modulePerms.includes(action);
  };

  /**
   * Checks direct slug e.g. 'payroll:approve'
   */
  const hasDirectPermission = (permissionSlug: string): boolean => {
    if (!user) return false;
    const userRole = (user.role || '').toUpperCase();
    if (userRole === 'SUPER_ADMIN' || userRole === 'ADMIN') return true;

    const userPerms = user.permissions || [];
    if (userPerms.includes('*')) return true;

    const [mod] = permissionSlug.split(':');
    if (userPerms.includes(`${mod}:*`)) return true;

    return userPerms.includes(permissionSlug);
  };

  /**
   * Updates permission matrix in the live database via PUT /api/v1/roles/:id/permissions
   */
  const updateRolePermissions = async (
    roleNameOrId: string | number,
    permissions: Record<ModuleName, CRUDAction[]>
  ): Promise<boolean> => {
    const roleDef = availableRoles.find((r) => r.id === roleNameOrId || r.name === roleNameOrId);
    if (!roleDef) return false;

    if (roleDef.name === 'SUPER_ADMIN') {
      console.warn('Super Admin permissions are immutable and cannot be modified.');
      return false;
    }

    try {
      if (roleDef.id) {
        await apiPut(`/roles/${roleDef.id}/permissions`, { matrix: permissions });
      }
      setAvailableRoles((prev) =>
        prev.map((r) => (r.name === roleDef.name ? { ...r, permissions } : r))
      );
      return true;
    } catch {
      return false;
    }
  };

  /**
   * Creates a new role in the live database via POST /api/v1/roles
   */
  const createRole = async (
    roleName: string,
    permissions: Record<ModuleName, CRUDAction[]>,
    description?: string
  ): Promise<boolean> => {
    const formattedName = roleName.toUpperCase().replace(/\s+/g, '_');
    try {
      const created = await apiPost<any>('/roles', {
        name: formattedName,
        display_name: roleName.trim(),
        description: description || `Custom role for ${roleName}`,
        matrix: permissions,
      });

      await refreshRoles();
      return true;
    } catch {
      return false;
    }
  };

  /**
   * Deletes a custom role in the live database via DELETE /api/v1/roles/:id
   */
  const deleteRole = async (roleNameOrId: string | number): Promise<boolean> => {
    const roleDef = availableRoles.find((r) => r.id === roleNameOrId || r.name === roleNameOrId);
    if (!roleDef) return false;
    if (roleDef.is_system || ['SUPER_ADMIN', 'ADMIN'].includes(roleDef.name)) return false;

    try {
      if (roleDef.id) {
        await apiDelete(`/roles/${roleDef.id}`);
      }
      setAvailableRoles((prev) => prev.filter((r) => r.name !== roleDef.name));
      return true;
    } catch {
      return false;
    }
  };

  return (
    <RoleContext.Provider
      value={{
        user,
        role: user?.role || 'EMPLOYEE',
        availableRoles,
        loadingRoles,
        refreshRoles,
        hasPermission,
        hasDirectPermission,
        updateRolePermissions,
        createRole,
        deleteRole,
      }}
    >
      {children}
    </RoleContext.Provider>
  );
};

export const useRole = () => {
  const context = useContext(RoleContext);
  if (context === undefined) {
    throw new Error('useRole must be used within a RoleProvider');
  }
  return context;
};
