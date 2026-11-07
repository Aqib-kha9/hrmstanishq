"use client";

import { ReactNode } from "react";
import { useRole, ModuleName, CRUDAction } from "@/context/RoleContext";

interface PermissionGateProps {
  children: ReactNode;
  module?: ModuleName;
  action?: CRUDAction;
  permission?: string; // Direct slug e.g. 'payroll:approve'
  allowedRoles?: string[];
  fallback?: ReactNode;
}

/**
 * Enterprise Permission Gate component
 * Conditionally renders child elements only if the authenticated user has
 * the required module permission, direct permission slug, or allowed role.
 */
export function PermissionGate({
  children,
  module,
  action,
  permission,
  allowedRoles,
  fallback = null,
}: PermissionGateProps) {
  const { role, hasPermission, hasDirectPermission } = useRole();

  // Role check
  if (allowedRoles && allowedRoles.length > 0) {
    const userRole = (role || "").toUpperCase();
    const isAllowedRole = allowedRoles.map((r) => r.toUpperCase()).includes(userRole);
    if (!isAllowedRole && userRole !== "SUPER_ADMIN" && userRole !== "ADMIN") {
      return <>{fallback}</>;
    }
  }

  // Direct permission check (e.g. 'payroll:approve')
  if (permission) {
    if (!hasDirectPermission(permission)) {
      return <>{fallback}</>;
    }
  }

  // Module and Action check (e.g. module='EMPLOYEES', action='CREATE')
  if (module && action) {
    if (!hasPermission(module, action)) {
      return <>{fallback}</>;
    }
  }

  return <>{children}</>;
}
