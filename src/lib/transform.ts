/// Transforms backend API responses to frontend-compatible shapes.
/// Kept inline with page files for clarity — each page has its own mapper.

import type { User } from "@/context/RoleContext";

// ── Backend raw types ──

export interface BackendEmployee {
  id: number;
  emp_code: string;
  name: string;
  email: string;
  phone: string | null;
  designation: string;
  department: string;
  role: string;
  status: string;
  date_of_joining: string | null;
  date_of_birth: string | null;
  gender: string | null;
  address: string | null;
  profile_image: string | null;
  office_id: number;
  is_first_login: boolean;
  last_login_at: string | null;
  office?: { id: number; name: string } | null;
  company?: { id: number; name: string } | null;
  // Financial / bank
  bank_name: string | null;
  bank_account_number: string | null;
  ifsc_code: string | null;
  pan_number: string | null;
  aadhaar_number?: string | null;
  lic_details?: string | null;
  blood_group?: string | null;
  pf_number: string | null;
  uan: string | null;
  // Salary
  fixed_gross: number | null;
  basic_salary: number | null;
  // Compliance
  pf_applicable: boolean | null;
  pf_ceiling: boolean | null;
  pf_contribution_mode: string | null;
  esic_applicable: boolean | null;
  esic_contribution_mode: string | null;
  // Additional
  company_name: string | null;
  emergency_contact_name: string | null;
  emergency_contact_relation: string | null;
  hr_manager?: string | null;
  location: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface FrontendEmployee {
  id: string;
  emp_code: string;
  name: string;
  role: string;
  jobTitle: string;
  dept: string;
  email: string;
  phone: string;
  status: string;
  location: string;
  company: string;
  hr_manager?: string;
  color: string;
  employeeId: number; // numeric DB id for API calls
}

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: "blue",
  ADMIN: "indigo",
  HR: "purple",
  MANAGER: "emerald",
  EMPLOYEE: "amber",
};

function mapBackendRole(backendRole: string | undefined): string {
  if (!backendRole) return "EMPLOYEE";
  const normalized = backendRole.trim().toUpperCase().replace(/\s+/g, "_");
  if (normalized === "HR") return "HR";
  if (normalized === "SUPER_ADMIN") return "SUPER_ADMIN";
  if (normalized === "ADMIN") return "ADMIN";
  if (normalized === "MANAGER") return "MANAGER";
  if (normalized === "EMPLOYEE") return "EMPLOYEE";
  // Dynamic custom role (e.g. ACCOUNTANT, BRANCH_HEAD)
  return normalized;
}

function mapStatus(status: string | undefined): string {
  switch (status) {
    case "active": return "Active";
    case "on_leave": return "On Leave";
    case "inactive": return "Inactive";
    case "terminated": return "Terminated";
    case "resigned": return "Resigned";
    case "suspended": return "Suspended";
    default: return "Active";
  }
}

export function toFrontendEmployee(be: BackendEmployee): FrontendEmployee {
  const role = mapBackendRole(be.role);
  return {
    id: be.emp_code || `EMP${String(be.id).padStart(3, "0")}`,
    emp_code: be.emp_code || "",
    name: be.name,
    role,
    jobTitle: be.designation || "",
    dept: be.department || "",
    email: be.email || "",
    phone: be.phone || "",
    status: mapStatus(be.status),
    location: be.office?.name || "Unknown",
    company: be.company?.name || be.company_name || "Apaar Logistics",
    hr_manager: be.hr_manager || "HR Operations",
    color: ROLE_COLORS[role] || "blue",
    employeeId: be.id,
  };
}
