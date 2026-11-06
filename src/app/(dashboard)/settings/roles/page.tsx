"use client";

import { useRole, ModuleName, CRUDAction, MODULES, RoleDefinition } from "@/context/RoleContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useState } from "react";
import {
  Shield,
  Plus,
  Trash2,
  Check,
  X,
  Lock,
  Edit3,
  ShieldCheck,
  PlusCircle,
  Eye,
  RotateCcw,
  XCircle,
  Settings2,
  Save,
  ChevronRight,
  Sparkles,
  Users,
  CheckCheck,
  AlertCircle,
  Download,
  ThumbsUp
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const CRUD_HEADERS: { label: string; key: CRUDAction; icon: any }[] = [
  { label: "Create", key: "CREATE", icon: PlusCircle },
  { label: "Read", key: "READ", icon: Eye },
  { label: "Update", key: "UPDATE", icon: RotateCcw },
  { label: "Delete", key: "DELETE", icon: XCircle },
  { label: "Approve", key: "APPROVE", icon: ThumbsUp },
  { label: "Export", key: "EXPORT", icon: Download },
];

export const MODULE_ACTIONS: Record<ModuleName, CRUDAction[]> = {
  DASHBOARD: ["READ"],
  EMPLOYEES: ["CREATE", "READ", "UPDATE", "DELETE", "EXPORT"],
  ONBOARDING: ["CREATE", "READ", "UPDATE", "DELETE"],
  ATTENDANCE: ["CREATE", "READ", "UPDATE", "DELETE", "APPROVE", "EXPORT"],
  LOCATIONS: ["CREATE", "READ", "UPDATE", "DELETE"],
  LEAVE: ["CREATE", "READ", "UPDATE", "DELETE", "APPROVE", "EXPORT"],
  PAYROLL: ["CREATE", "READ", "UPDATE", "DELETE", "APPROVE", "EXPORT"],
  LOANS: ["CREATE", "READ", "UPDATE", "DELETE", "APPROVE", "EXPORT"],
  PERFORMANCE: ["CREATE", "READ", "UPDATE", "DELETE", "APPROVE"],
  LETTERS: ["CREATE", "READ", "UPDATE", "DELETE"],
  TOUR_EXPENSES: ["CREATE", "READ", "UPDATE", "DELETE", "APPROVE", "EXPORT"],
  REPORTS: ["READ", "EXPORT"],
  SETTINGS: ["CREATE", "READ", "UPDATE", "DELETE"],
  ROLE_MGMT: ["CREATE", "READ", "UPDATE", "DELETE"],
};

export default function RolesPage() {
  const { availableRoles, loadingRoles, createRole, updateRolePermissions, deleteRole, refreshRoles } = useRole();
  const [isAdding, setIsAdding] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDesc, setNewRoleDesc] = useState("");
  const [matrix, setMatrix] = useState<Record<ModuleName, CRUDAction[]>>({} as any);
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [editingRoleId, setEditingRoleId] = useState<number | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const selectedRoleDef = availableRoles.find((r) => r.name === editingRole);
  const isSuperAdmin = selectedRoleDef?.name === "SUPER_ADMIN";

  const handleSelectRole = (roleDef: RoleDefinition) => {
    setEditingRole(roleDef.name);
    setEditingRoleId(roleDef.id);
    const initialMatrix = {} as Record<ModuleName, CRUDAction[]>;
    MODULES.forEach((m) => {
      const valid = MODULE_ACTIONS[m] || [];
      if (roleDef.name === 'SUPER_ADMIN') {
        initialMatrix[m] = [...valid];
      } else {
        const raw = roleDef.permissions[m] || [];
        initialMatrix[m] = raw.filter((a) => valid.includes(a));
      }
    });
    setMatrix(initialMatrix);
    setIsAdding(false);
    setStatusMessage(null);
  };

  const handleCreateRole = async () => {
    if (!newRoleName.trim()) return;
    setIsSaving(true);
    setStatusMessage(null);

    const initialMatrix = {} as Record<ModuleName, CRUDAction[]>;
    MODULES.forEach((m) => {
      initialMatrix[m] = matrix[m] || [];
    });

    const success = await createRole(newRoleName, initialMatrix, newRoleDesc);
    setIsSaving(false);

    if (success) {
      setStatusMessage({ type: 'success', text: `Role [${newRoleName.toUpperCase()}] created successfully!` });
      setNewRoleName("");
      setNewRoleDesc("");
      setIsAdding(false);
      await refreshRoles();
    } else {
      setStatusMessage({ type: 'error', text: "Failed to create role. Please verify role name is unique." });
    }
  };

  const handleUpdatePermissions = async () => {
    if (!editingRole || isSuperAdmin) return;
    setIsSaving(true);
    setStatusMessage(null);

    const success = await updateRolePermissions(editingRoleId || editingRole, matrix);
    setIsSaving(false);

    if (success) {
      setStatusMessage({ type: 'success', text: `Permissions for [${editingRole}] saved to database!` });
      setTimeout(() => setStatusMessage(null), 4000);
    } else {
      setStatusMessage({ type: 'error', text: "Failed to save permissions to database." });
    }
  };

  const handleDeleteRole = async (roleDef: RoleDefinition) => {
    if (roleDef.is_system) {
      alert("System predefined roles cannot be deleted.");
      return;
    }
    if ((roleDef.employee_count || 0) > 0) {
      alert(`Cannot delete role [${roleDef.name}] because it is currently assigned to ${roleDef.employee_count} employee(s). Please reassign them first.`);
      return;
    }
    if (!confirm(`Are you sure you want to permanently delete custom role [${roleDef.name}]?`)) {
      return;
    }

    const success = await deleteRole(roleDef.id || roleDef.name);
    if (success) {
      if (editingRole === roleDef.name) {
        setEditingRole(null);
      }
      setStatusMessage({ type: 'success', text: `Role [${roleDef.name}] deleted successfully.` });
    } else {
      setStatusMessage({ type: 'error', text: "Failed to delete role." });
    }
  };

  const toggleCRUD = (module: ModuleName, action: CRUDAction) => {
    if (isSuperAdmin) return;
    if (!MODULE_ACTIONS[module]?.includes(action)) return;
    setMatrix((prev) => {
      const current = prev[module] || [];
      const next = current.includes(action)
        ? current.filter((a) => a !== action)
        : [...current, action];
      return { ...prev, [module]: next };
    });
  };

  const toggleModuleAll = (module: ModuleName) => {
    if (isSuperAdmin) return;
    const validActions = MODULE_ACTIONS[module] || [];
    setMatrix((prev) => {
      const current = prev[module] || [];
      const isAllSelected = validActions.every((a) => current.includes(a));
      return { ...prev, [module]: isAllSelected ? [] : [...validActions] };
    });
  };

  const grantAll = () => {
    if (isSuperAdmin) return;
    const newM = {} as Record<ModuleName, CRUDAction[]>;
    MODULES.forEach((m) => {
      newM[m] = [...(MODULE_ACTIONS[m] || [])];
    });
    setMatrix(newM);
  };

  const revokeAll = () => {
    if (isSuperAdmin) return;
    const newM = {} as Record<ModuleName, CRUDAction[]>;
    MODULES.forEach((m) => {
      newM[m] = [];
    });
    setMatrix(newM);
  };

  return (
    <ProtectedRoute module="ROLE_MGMT" action="READ">
      <div className="space-y-8 pb-20 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between px-2">
          <div>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 flex items-center gap-3 italic underline underline-offset-8 decoration-[#D9F99D] decoration-2 uppercase tracking-tighter">
              <ShieldCheck className="h-7 w-7 text-indigo-600 stroke-[2.5]" /> Enterprise Role Permissions
            </h1>
            <p className="text-[9px] font-black text-slate-400 mt-3 uppercase tracking-[0.25em]">
              Fine-grained access control across all modules, actions, and staff tiers.
            </p>
          </div>
          {!isAdding && (
            <Button
              onClick={() => {
                setIsAdding(true);
                setEditingRole(null);
                setEditingRoleId(undefined);
                const empty = {} as any;
                MODULES.forEach((m) => (empty[m] = []));
                setMatrix(empty);
                setStatusMessage(null);
              }}
              className="bg-[#D9F99D] text-slate-900 hover:bg-[#c8ea8a] font-black text-[9px] uppercase tracking-widest px-6 h-11 rounded-xl shadow-sm transition-all"
            >
              <Plus className="mr-2 h-4 w-4 stroke-[3]" /> Add Custom Role
            </Button>
          )}
        </div>

        {/* Status Notification */}
        {statusMessage && (
          <div
            className={cn(
              "p-4 rounded-xl flex items-center gap-3 text-xs font-black uppercase tracking-wider transition-all",
              statusMessage.type === "success"
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                : "bg-rose-50 text-rose-800 border border-rose-200"
            )}
          >
            {statusMessage.type === "success" ? (
              <Check className="h-4 w-4 text-emerald-600 stroke-[3]" />
            ) : (
              <AlertCircle className="h-4 w-4 text-rose-600 stroke-[3]" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Role Selection List */}
          <div className="lg:col-span-4 space-y-3">
            <div className="flex items-center justify-between px-2">
              <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                System & Custom Roles ({availableRoles.length})
              </label>
              {loadingRoles && (
                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest animate-pulse">
                  Syncing…
                </span>
              )}
            </div>

            {availableRoles.map((roleDef) => {
              const isSelected = editingRole === roleDef.name;
              return (
                <div
                  key={roleDef.name}
                  onClick={() => handleSelectRole(roleDef)}
                  className={cn(
                    "group flex flex-col p-4 rounded-2xl cursor-pointer transition-all duration-200 border-2",
                    isSelected
                      ? "bg-slate-900 border-slate-900 text-white shadow-xl shadow-slate-200"
                      : "bg-white border-transparent hover:border-slate-200 text-slate-700 shadow-sm"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "h-8 w-8 rounded-xl flex items-center justify-center shrink-0",
                          isSelected
                            ? "bg-white/10 text-[#D9F99D]"
                            : roleDef.is_system
                            ? "bg-indigo-50 text-indigo-600"
                            : "bg-amber-50 text-amber-600"
                        )}
                      >
                        <Shield className="h-4 w-4 stroke-[2.5]" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-black uppercase tracking-wider">
                            {roleDef.display_name || roleDef.name.replace(/_/g, " ")}
                          </span>
                        </div>
                        <span
                          className={cn(
                            "text-[8px] font-bold uppercase tracking-widest block",
                            isSelected ? "text-slate-400" : "text-slate-400"
                          )}
                        >
                          {roleDef.name}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge
                        className={cn(
                          "text-[7.5px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border-none",
                          isSelected
                            ? "bg-white/20 text-white"
                            : "bg-slate-100 text-slate-600"
                        )}
                      >
                        {roleDef.employee_count ?? 0} Staff
                      </Badge>

                      {!roleDef.is_system && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteRole(roleDef);
                          }}
                          className={cn(
                            "h-7 w-7 rounded-lg transition-colors",
                            isSelected
                              ? "hover:bg-rose-500 hover:text-white text-white/50"
                              : "hover:bg-rose-50 hover:text-rose-600 text-slate-300"
                          )}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {roleDef.description && (
                    <p
                      className={cn(
                        "text-[8px] font-medium mt-2 leading-relaxed line-clamp-2",
                        isSelected ? "text-slate-300" : "text-slate-400"
                      )}
                    >
                      {roleDef.description}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Right Column: Permission Matrix Table */}
          <div className="lg:col-span-8">
            {isAdding || editingRole ? (
              <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
                <CardHeader className="p-8 pb-6 border-b border-slate-100">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-3">
                        <CardTitle className="text-lg font-black uppercase italic tracking-tighter text-slate-900">
                          {isAdding
                            ? "Create Custom Role"
                            : `Permissions: ${selectedRoleDef?.display_name || editingRole}`}
                        </CardTitle>
                        {isSuperAdmin ? (
                          <Badge className="bg-amber-100 text-amber-900 border-amber-200 font-black text-[7.5px] uppercase tracking-wider flex items-center gap-1 shadow-none">
                            <Lock className="h-2.5 w-2.5" /> Immutable Root Role
                          </Badge>
                        ) : selectedRoleDef?.is_system ? (
                          <Badge className="bg-indigo-50 text-indigo-600 border-indigo-100 font-black text-[7.5px] uppercase tracking-wider">
                            System Predefined
                          </Badge>
                        ) : null}
                      </div>
                      <CardDescription className="text-[8.5px] font-black uppercase tracking-widest text-slate-400 mt-1">
                        {isSuperAdmin
                          ? "Super Administrator has permanent, unrestricted access (*) across all enterprise modules. Permissions cannot be modified."
                          : "Configure granular CRUD, approval, and export capabilities for this role."}
                      </CardDescription>
                    </div>

                    <div className="flex items-center gap-2">
                      {isSuperAdmin ? (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-800 text-[8px] font-black uppercase tracking-wider">
                          <Lock className="h-3 w-3 text-amber-600" />
                          <span>Permissions Locked</span>
                        </div>
                      ) : (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={grantAll}
                            className="text-[8px] font-black uppercase tracking-wider h-8 rounded-lg border-slate-200"
                          >
                            Grant All
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={revokeAll}
                            className="text-[8px] font-black uppercase tracking-wider h-8 rounded-lg border-slate-200"
                          >
                            Revoke All
                          </Button>
                        </>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setIsAdding(false);
                          setEditingRole(null);
                        }}
                        className="rounded-xl h-8 w-8"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {isAdding && (
                    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">
                          Role Name
                        </label>
                        <Input
                          value={newRoleName}
                          onChange={(e) => setNewRoleName(e.target.value)}
                          placeholder="e.g. Regional Operations Lead"
                          className="h-11 rounded-xl bg-slate-50 border-slate-200 font-black text-xs uppercase tracking-wider px-4"
                        />
                      </div>
                      <div>
                        <label className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">
                          Role Description
                        </label>
                        <Input
                          value={newRoleDesc}
                          onChange={(e) => setNewRoleDesc(e.target.value)}
                          placeholder="Brief summary of responsibilities"
                          className="h-11 rounded-xl bg-slate-50 border-slate-200 font-semibold text-xs px-4"
                        />
                      </div>
                    </div>
                  )}
                </CardHeader>

                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent border-slate-100 bg-slate-50/50">
                          <TableHead className="text-[8.5px] font-black uppercase tracking-widest text-slate-400 px-8 h-12">
                            Module / App Section
                          </TableHead>
                          {CRUD_HEADERS.map((header) => (
                            <TableHead key={header.key} className="text-center w-20 p-0">
                              <div className="flex flex-col items-center gap-0.5">
                                <header.icon className="h-3 w-3 text-slate-400 stroke-[2.5]" />
                                <span className="text-[7.5px] font-black uppercase tracking-wider text-slate-600">
                                  {header.label}
                                </span>
                              </div>
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {MODULES.map((module) => {
                          const currentActions = matrix[module] || [];
                          const validActions = MODULE_ACTIONS[module] || [];
                          const isFullyGranted = validActions.length > 0 && validActions.every((h) => currentActions.includes(h));
                          return (
                            <TableRow key={module} className="hover:bg-slate-50/50 border-slate-100 group">
                              <TableCell className="px-8 py-3.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-800">
                                    {module.replace(/_/g, " ")}
                                  </span>
                                  {isSuperAdmin ? (
                                    <span className="text-[7.5px] font-black uppercase tracking-wider text-emerald-600 flex items-center gap-1">
                                      <Check className="h-3 w-3 stroke-[3]" /> All Granted
                                    </span>
                                  ) : validActions.length === 0 ? null : (
                                    <button
                                      type="button"
                                      onClick={() => toggleModuleAll(module)}
                                      className="text-[7.5px] font-bold uppercase tracking-wider text-slate-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                      {isFullyGranted ? "Deselect" : "Select All"}
                                    </button>
                                  )}
                                </div>
                              </TableCell>
                              {CRUD_HEADERS.map((header) => {
                                const isApplicable = validActions.includes(header.key);
                                if (!isApplicable) {
                                  return (
                                    <TableCell key={header.key} className="text-center p-0">
                                      <div
                                        title="Action not applicable for this module"
                                        className="h-8 w-8 mx-auto flex items-center justify-center text-slate-200 select-none font-bold text-xs"
                                      >
                                        —
                                      </div>
                                    </TableCell>
                                  );
                                }
                                const isChecked = isSuperAdmin ? true : currentActions.includes(header.key);
                                return (
                                  <TableCell key={header.key} className="text-center p-0">
                                    <div
                                      onClick={() => !isSuperAdmin && toggleCRUD(module, header.key)}
                                      title={isSuperAdmin ? "Super Admin has permanent access" : `${module} ${header.label}`}
                                      className={cn(
                                        "h-8 w-8 rounded-lg mx-auto flex items-center justify-center transition-all border-2",
                                        isSuperAdmin
                                          ? "bg-slate-900 border-slate-900 text-[#D9F99D] shadow-sm cursor-not-allowed opacity-90"
                                          : isChecked
                                          ? "bg-slate-900 border-slate-900 text-[#D9F99D] shadow-sm cursor-pointer"
                                          : "bg-white border-slate-200 text-transparent hover:border-slate-400 cursor-pointer"
                                      )}
                                    >
                                      <Check className="h-3.5 w-3.5 stroke-[4]" />
                                    </div>
                                  </TableCell>
                                );
                              })}
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="p-8 border-t border-slate-100 flex items-center justify-between bg-slate-50/40">
                    {isSuperAdmin ? (
                      <div className="flex items-center gap-2 text-amber-800">
                        <Lock className="h-4 w-4 shrink-0 text-amber-600" />
                        <span className="text-[8.5px] font-black uppercase tracking-wider">
                          Super Administrator has global wildcard bypass (*) — permissions cannot be revoked.
                        </span>
                      </div>
                    ) : (
                      <span className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider">
                        Changes take effect across web and mobile apps immediately upon saving.
                      </span>
                    )}

                    {isSuperAdmin ? (
                      <Button
                        disabled
                        className="bg-slate-200 text-slate-500 cursor-not-allowed font-black uppercase tracking-[0.25em] text-[9.5px] px-8 h-12 rounded-xl shadow-none flex items-center gap-2 border border-slate-300"
                      >
                        <Lock className="h-4 w-4 text-slate-400" />
                        Permissions Locked
                      </Button>
                    ) : (
                      <Button
                        disabled={isSaving}
                        onClick={isAdding ? handleCreateRole : handleUpdatePermissions}
                        className="bg-slate-900 text-white hover:bg-black font-black uppercase tracking-[0.25em] text-[9.5px] px-8 h-12 rounded-xl shadow-md transition-all flex items-center gap-2"
                      >
                        <Save className="h-4 w-4 text-[#D9F99D]" />
                        {isSaving ? "Saving…" : isAdding ? "Create Role" : "Save Permissions"}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="h-full min-h-[460px] rounded-3xl border-2 border-dashed border-slate-200 bg-white/50 flex flex-col items-center justify-center p-16 text-center">
                <Settings2 className="h-12 w-12 text-slate-200 mb-4" />
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">
                  No Role Selected
                </h3>
                <p className="text-[8.5px] font-bold text-slate-300 uppercase tracking-wider mt-1.5 max-w-sm">
                  Select an enterprise role on the left to configure permissions, or click "Add Custom Role" to create a new one.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
