"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Users2,
  Calendar,
  AlertCircle,
  ShieldCheck,
  Activity,
  CheckCircle2,
  Layers,
  Coins,
  Scale,
  Plane,
  UserCheck,
  UserX,
  Search,
  Eye,
  Building2,
  ArrowUpRight,
  CalendarDays,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { apiGet } from "@/lib/api-client";
import { ProtectedRoute } from "@/components/ProtectedRoute";

type AbsentEmployee = {
  id: number;
  employee_code: string;
  name: string;
  email: string | null;
  phone: string | null;
  department: string;
  designation: string;
  status: string;
  avatar_url?: string | null;
  date: string;
  punch_in?: string | null;
  punch_out?: string | null;
  leave_type?: string | null;
  leave_status?: string | null;
  reason?: string | null;
};

type DepartmentDistribution = {
  department: string;
  total_employees: number;
  active_employees: number;
  inactive_employees: number;
};

type RecentEmployee = {
  id: number;
  employee_code: string;
  name: string;
  email: string | null;
  phone: string | null;
  department: string;
  designation: string;
  status: string;
  date_of_joining: string | null;
  created_at: string;
  avatar_url?: string | null;
};

type TourExpensesSummary = {
  total_claims: number;
  pending_claims: number;
  approved_amount: number;
  active_tours: number;
};

type AnnualLeavePolicy = {
  policy_name: string;
  annual_cl_days: number;
  annual_el_days: number;
  total_annual_days: number;
  rules: {
    cl: string;
    el: string;
  };
  company_totals: {
    cl_allocated: number;
    cl_used: number;
    cl_balance: number;
    el_allocated: number;
    el_carried_forward: number;
    el_used: number;
    el_balance: number;
    total_allocated: number;
    total_used: number;
    total_balance: number;
  };
};

type AdminSummary = {
  total_employees: number;
  active_employees: number;
  inactive_employees: number;
  today_present: number;
  today_absent: number;
  absent_employees?: AbsentEmployee[];
  pending_leaves: number;
  active_loans: number;
  department_distribution?: DepartmentDistribution[];
  department_stats: Array<{ department: string | null; count: number; total_count?: number; inactive_count?: number }>;
  recent_employees?: RecentEmployee[];
  tour_expenses_summary?: TourExpensesSummary;
  annual_leave_policy?: AnnualLeavePolicy;
};

type LeaveTypeDistributionItem = {
  leave_type: string;
  label: string;
  count: number;
  total_days: number;
  annual_entitlement: number;
  percentage: number;
  color: string;
};

type AdminStats = {
  leave_type_distribution?: LeaveTypeDistributionItem[];
  leave_distribution: Array<{ leave_type: string; count: number }>;
  total_leave_requests?: number;
  total_leave_days?: number;
  loan_distribution: Array<{ type: string; count: number }>;
};

type GovernanceRule = {
  key: string;
  label: string;
  value: string;
  description: string;
};

type AdminGovernance = {
  rules: GovernanceRule[];
  meta: {
    working_days_this_cycle: number;
    billing_cycle_days: number;
    billing_cycle_start_day: number;
    billing_cycle_end_day: number;
    pf_ceiling_amount: number;
    esic_wage_threshold: number;
    basic_split_rate: number;
    hra_split_rate: number;
    pf_employee_rate: number;
    pf_employer_rate: number;
    esic_employee_rate: number;
    esic_employer_rate: number;
    pt_slabs: Array<{ from: number; to: number; amount: number }>;
  };
};

type ComplianceCheck = {
  title: string;
  description: string;
  status: boolean | null;
  detail: string;
};

type AdminCompliance = {
  checks: ComplianceCheck[];
  summary: { total: number; passed: number; warnings: number; failed: number };
};

type ActivityItem = {
  type: string;
  message: string;
  time: string;
  timestamp: string;
};

type AdminActivity = {
  activities: ActivityItem[];
};

const DEPT_COLORS: Record<string, string> = {
  "Engineering": "bg-indigo-500",
  "HR": "bg-emerald-500",
  "Finance": "bg-amber-500",
  "Sales": "bg-blue-500",
  "Marketing": "bg-rose-500",
  "Operations": "bg-cyan-500",
  "Unassigned": "bg-slate-400",
};

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [governance, setGovernance] = useState<AdminGovernance | null>(null);
  const [compliance, setCompliance] = useState<AdminCompliance | null>(null);
  const [activity, setActivity] = useState<AdminActivity | null>(null);

  // Absent employees dialog & search filter state
  const [absentDialogOpen, setAbsentDialogOpen] = useState(false);
  const [absentSearch, setAbsentSearch] = useState("");

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryData, statsData, governanceData, complianceData, activityData] = await Promise.all([
        apiGet<AdminSummary>("/dashboard/admin-summary"),
        apiGet<AdminStats>("/dashboard/admin-stats"),
        apiGet<AdminGovernance>("/dashboard/admin-governance"),
        apiGet<AdminCompliance>("/dashboard/admin-compliance"),
        apiGet<AdminActivity>("/dashboard/admin-activity"),
      ]);
      setSummary(summaryData);
      setStats(statsData);
      setGovernance(governanceData);
      setCompliance(complianceData);
      setActivity(activityData);
    } catch (_) {
      /* silently handle — UI shows skeleton/empty */
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // --- Derived values from API ---
  const totalEmployees = summary?.total_employees ?? 0;
  const activeEmployees = summary?.active_employees ?? 0;
  const inactiveEmployees = summary?.inactive_employees ?? Math.max(0, totalEmployees - activeEmployees);
  const todayPresent = summary?.today_present ?? 0;
  const todayAbsent = summary?.today_absent ?? 0;
  const attendanceRate = totalEmployees > 0
    ? Math.round((todayPresent / totalEmployees) * 100)
    : 0;
  const pendingLeaves = summary?.pending_leaves ?? 0;
  const activeLoansCount = summary?.active_loans ?? 0;

  // Department distribution
  const departmentDistribution: DepartmentDistribution[] = useMemo(() => {
    if (summary?.department_distribution && summary.department_distribution.length > 0) {
      return summary.department_distribution;
    }
    return (summary?.department_stats ?? []).map((ds) => ({
      department: ds.department || "Unassigned",
      total_employees: ds.total_count ?? ds.count,
      active_employees: ds.count,
      inactive_employees: ds.inactive_count ?? 0,
    }));
  }, [summary]);

  // Absent employees
  const absentEmployees: AbsentEmployee[] = summary?.absent_employees ?? [];
  const filteredAbsentEmployees = useMemo(() => {
    if (!absentSearch.trim()) return absentEmployees;
    const q = absentSearch.toLowerCase();
    return absentEmployees.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.employee_code.toLowerCase().includes(q) ||
        e.department.toLowerCase().includes(q) ||
        e.designation.toLowerCase().includes(q) ||
        (e.reason && e.reason.toLowerCase().includes(q))
    );
  }, [absentEmployees, absentSearch]);

  // Recent employees
  const recentEmployees: RecentEmployee[] = summary?.recent_employees ?? [];

  // Tour expenses summary
  const tourExpensesSummary = summary?.tour_expenses_summary ?? {
    total_claims: 0,
    pending_claims: 0,
    approved_amount: 0,
    active_tours: 0,
  };

  // Annual leave policy
  const annualLeavePolicy = summary?.annual_leave_policy;

  // Leave Type Distribution (PL, EL, CL)
  const leaveTypeDistribution: LeaveTypeDistributionItem[] = useMemo(() => {
    if (stats?.leave_type_distribution && stats.leave_type_distribution.length > 0) {
      return stats.leave_type_distribution;
    }
    // Fallback if older backend version responds
    const rawList = stats?.leave_distribution ?? [];
    const totalCount = rawList.reduce((acc, curr) => acc + curr.count, 0);
    return [
      {
        leave_type: "CL",
        label: "Casual Leave (CL)",
        count: rawList.find((l) => l.leave_type.toLowerCase() === "cl" || l.leave_type.toLowerCase() === "casual")?.count ?? 0,
        total_days: 0,
        annual_entitlement: 12,
        percentage: 0,
        color: "bg-amber-500",
      },
      {
        leave_type: "EL",
        label: "Earned Leave (EL)",
        count: rawList.find((l) => l.leave_type.toLowerCase() === "el" || l.leave_type.toLowerCase() === "earned")?.count ?? 0,
        total_days: 0,
        annual_entitlement: 12,
        percentage: 0,
        color: "bg-indigo-500",
      },
      {
        leave_type: "PL",
        label: "Privilege Leave (PL)",
        count: rawList.find((l) => l.leave_type.toLowerCase() === "pl" || l.leave_type.toLowerCase() === "paid")?.count ?? 0,
        total_days: 0,
        annual_entitlement: 12,
        percentage: 0,
        color: "bg-emerald-500",
      },
      {
        leave_type: "OTHER",
        label: "Other / LWP",
        count: rawList.find((l) => ["lwp", "other", "unpaid", "sick"].includes(l.leave_type.toLowerCase()))?.count ?? 0,
        total_days: 0,
        annual_entitlement: 0,
        percentage: 0,
        color: "bg-slate-400",
      },
    ].map((item) => ({
      ...item,
      percentage: totalCount > 0 ? Math.round((item.count / totalCount) * 100) : 0,
    }));
  }, [stats]);

  const loanDistribution = stats?.loan_distribution ?? [];
  const governanceRules = governance?.rules ?? [];
  const complianceChecks = compliance?.checks ?? [];
  const complianceSummary = compliance?.summary ?? { total: 0, passed: 0, warnings: 0, failed: 0 };
  const recentActivities = activity?.activities ?? [];

  return (
    <ProtectedRoute module="DASHBOARD" action="READ">
      <div className="space-y-6 md:space-y-8 pb-16 bg-[#F8F9FA] min-h-screen">

        {/* Executive Command Notification Bar */}
        <div className="bg-white rounded-xl p-3 md:p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-sm border border-slate-100">
          <div className="flex items-start md:items-center gap-3">
            <div className="h-6 w-6 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
              <AlertCircle className="h-4 w-4 text-indigo-500" />
            </div>
            <p className="text-[10px] md:text-xs font-semibold text-slate-700 leading-relaxed uppercase tracking-wider">
              <span className="font-black text-indigo-600">Executive Overview :</span>{" "}
              {loading
                ? "Loading live dashboard data…"
                : `${activeEmployees} active workforce • ${todayPresent} present today • ${todayAbsent} absent • ${pendingLeaves} pending leave requests • Annual Policy: 12 CL + 12 EL = 24d.`
              }
            </p>
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <Link href="/payroll" className="flex-1 md:flex-none">
              <Button className="w-full md:w-auto bg-[#D9F99D] text-slate-900 hover:bg-[#c8ea8a] font-black uppercase text-[8px] tracking-widest px-5 h-9 rounded-lg border border-[#D9F99D] shadow-xs">
                Review Payroll
              </Button>
            </Link>
          </div>
        </div>

        {/* Primary Strategic KPI Cards (Requirement 2.1) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

          {/* 1. Total Active Employees */}
          <Card className="bg-[#EEF2FF] border-none rounded-2xl shadow-sm relative overflow-hidden h-36 flex flex-col justify-between p-5 hover:shadow-md transition-shadow group">
            <div className="flex items-start justify-between">
              <div className="bg-white/60 p-2 rounded-xl group-hover:scale-105 transition-transform">
                <Users2 className="h-4 w-4 text-indigo-700 stroke-[2.5]" />
              </div>
              <Badge className="bg-white/80 text-indigo-700 border-none font-black text-[7.5px] tracking-wider uppercase">
                {totalEmployees} Total Staff
              </Badge>
            </div>
            <div>
              <h3 className="text-2xl md:text-3xl font-black text-slate-900 italic tracking-tighter">
                {loading ? "…" : `${activeEmployees} Active`}
              </h3>
              <p className="text-[8.5px] font-bold text-slate-600 mt-1 uppercase tracking-widest">Total Active Employees</p>
              <p className="text-[7px] font-medium text-slate-400 mt-0.5 uppercase tracking-wide">
                {inactiveEmployees} Inactive / On Notice
              </p>
            </div>
          </Card>

          {/* 2. Present Employees */}
          <Card className="bg-[#ECFDF5] border-none rounded-2xl shadow-sm relative overflow-hidden h-36 flex flex-col justify-between p-5 hover:shadow-md transition-shadow group">
            <div className="flex items-start justify-between">
              <div className="bg-white/60 p-2 rounded-xl group-hover:scale-105 transition-transform">
                <UserCheck className="h-4 w-4 text-emerald-700 stroke-[2.5]" />
              </div>
              <Badge className="bg-white/80 text-emerald-700 border-none font-black text-[7.5px] tracking-wider uppercase">
                {attendanceRate}% Present
              </Badge>
            </div>
            <div>
              <h3 className="text-2xl md:text-3xl font-black text-slate-900 italic tracking-tighter">
                {loading ? "…" : `${todayPresent} Present`}
              </h3>
              <p className="text-[8.5px] font-bold text-slate-600 mt-1 uppercase tracking-widest">Present Employees</p>
              <p className="text-[7px] font-medium text-slate-400 mt-0.5 uppercase tracking-wide">
                Checked in & on duty today
              </p>
            </div>
          </Card>

          {/* 3. Absent Employees (Includes visibility of employees marked absent) */}
          <Card
            onClick={() => setAbsentDialogOpen(true)}
            className="bg-[#FEF2F2] border-none rounded-2xl shadow-sm relative overflow-hidden h-36 flex flex-col justify-between p-5 hover:shadow-md transition-shadow group cursor-pointer border-2 border-transparent hover:border-rose-300"
          >
            <div className="flex items-start justify-between">
              <div className="bg-white/60 p-2 rounded-xl group-hover:scale-105 transition-transform">
                <UserX className="h-4 w-4 text-rose-700 stroke-[2.5]" />
              </div>
              <Badge className="bg-rose-500 text-white border-none font-black text-[7.5px] tracking-wider uppercase flex items-center gap-1 shadow-xs hover:bg-rose-600">
                <Eye className="h-2.5 w-2.5" /> View Staff ({todayAbsent})
              </Badge>
            </div>
            <div>
              <h3 className="text-2xl md:text-3xl font-black text-rose-950 italic tracking-tighter">
                {loading ? "…" : `${todayAbsent} Absent`}
              </h3>
              <p className="text-[8.5px] font-bold text-rose-800 mt-1 uppercase tracking-widest flex items-center justify-between">
                <span>Absent Employees</span>
                <span className="text-[7.5px] underline underline-offset-2">Click to inspect</span>
              </p>
              <p className="text-[7px] font-medium text-rose-600 mt-0.5 uppercase tracking-wide">
                Includes uninformed & applied leave absentees
              </p>
            </div>
          </Card>

          {/* 4. Annual Leave Entitlement (Finalized Policy: 12 CL + 12 EL = 24d) */}
          <Card className="bg-[#FFFBEB] border-none rounded-2xl shadow-sm relative overflow-hidden h-36 flex flex-col justify-between p-5 hover:shadow-md transition-shadow group">
            <div className="flex items-start justify-between">
              <div className="bg-white/60 p-2 rounded-xl group-hover:scale-105 transition-transform">
                <CalendarDays className="h-4 w-4 text-amber-700 stroke-[2.5]" />
              </div>
              <Badge className="bg-white/80 text-amber-800 border-none font-black text-[7.5px] tracking-wider uppercase">
                12 CL + 12 EL
              </Badge>
            </div>
            <div>
              <h3 className="text-2xl md:text-3xl font-black text-slate-900 italic tracking-tighter">
                24 Days / Yr
              </h3>
              <p className="text-[8.5px] font-bold text-slate-600 mt-1 uppercase tracking-widest">Annual Leave Entitlement</p>
              <p className="text-[7px] font-medium text-slate-400 mt-0.5 uppercase tracking-wide">
                {pendingLeaves} Pending Leave Request{pendingLeaves !== 1 ? "s" : ""}
              </p>
            </div>
          </Card>

        </div>

        {/* Absent Employees Visibility Dialog / Modal (Requirement 2.1) */}
        <Dialog open={absentDialogOpen} onOpenChange={setAbsentDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0 overflow-hidden bg-white rounded-2xl border-none shadow-2xl">
            <div className="p-6 bg-gradient-to-r from-rose-50 via-red-50/50 to-white border-b border-rose-100/60">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-rose-500 text-white flex items-center justify-center shadow-xs">
                    <UserX className="h-5 w-5" />
                  </div>
                  <div>
                    <DialogTitle className="text-base font-black italic text-slate-900 uppercase tracking-wider">
                      Absent Employees Today
                    </DialogTitle>
                    <DialogDescription className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
                      {todayAbsent} Staff Marked Absent • Live Visibility & Leave Status
                    </DialogDescription>
                  </div>
                </div>
                <Badge className="bg-rose-100 text-rose-800 border-none font-black text-[9px] px-2.5 py-1 uppercase tracking-widest">
                  {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                </Badge>
              </div>

              {/* Search Filter */}
              <div className="relative mt-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <Input
                  placeholder="Filter by name, employee code, department, or reason…"
                  value={absentSearch}
                  onChange={(e) => setAbsentSearch(e.target.value)}
                  className="pl-9 h-9 text-xs bg-white border-slate-200 rounded-lg font-medium"
                />
              </div>
            </div>

            {/* Table of Absent Employees */}
            <div className="flex-1 overflow-y-auto p-4 max-h-[50vh]">
              {filteredAbsentEmployees.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                  <p className="text-xs font-black text-slate-700 uppercase tracking-wider">
                    {absentEmployees.length === 0
                      ? "No Employees Marked Absent Today"
                      : "No employees match your search filter"}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wide">
                    {absentEmployees.length === 0
                      ? "All active workforce are accounted for or present on duty."
                      : "Try clearing or updating your search query."}
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-slate-100 hover:bg-transparent">
                      <TableHead className="text-[9px] font-black uppercase tracking-widest text-slate-400">Employee</TableHead>
                      <TableHead className="text-[9px] font-black uppercase tracking-widest text-slate-400">Department</TableHead>
                      <TableHead className="text-[9px] font-black uppercase tracking-widest text-slate-400">Designation</TableHead>
                      <TableHead className="text-[9px] font-black uppercase tracking-widest text-slate-400">Absence Type / Reason</TableHead>
                      <TableHead className="text-[9px] font-black uppercase tracking-widest text-slate-400 text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAbsentEmployees.map((emp) => (
                      <TableRow key={emp.id} className="border-b border-slate-50 last:border-none hover:bg-slate-50/60 transition-colors">
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-black text-[10px] flex items-center justify-center uppercase shrink-0">
                              {emp.name.split(" ").map((n) => n[0]).join("").slice(0, 2) || "EM"}
                            </div>
                            <div>
                              <p className="text-xs font-black text-slate-900 tracking-tight">{emp.name}</p>
                              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{emp.employee_code}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-bold text-[8px] uppercase tracking-wider text-slate-700 bg-slate-50 border-slate-200">
                            {emp.department}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-[10px] font-medium text-slate-600">{emp.designation}</TableCell>
                        <TableCell>
                          {emp.leave_type ? (
                            <div className="flex items-center gap-1.5">
                              <Badge className={cn(
                                "text-[8px] font-black uppercase tracking-wider border-none px-1.5 py-0.5",
                                emp.leave_type.toLowerCase() === "cl" ? "bg-amber-100 text-amber-800" :
                                emp.leave_type.toLowerCase() === "el" ? "bg-indigo-100 text-indigo-800" :
                                emp.leave_type.toLowerCase() === "pl" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"
                              )}>
                                {emp.leave_type.toUpperCase()} ({emp.leave_status || "Pending"})
                              </Badge>
                              <span className="text-[9px] text-slate-500 truncate max-w-[150px]" title={emp.reason || ""}>
                                {emp.reason || "Applied Leave"}
                              </span>
                            </div>
                          ) : (
                            <Badge className="bg-rose-100 text-rose-700 border-none text-[8px] font-bold uppercase tracking-wider">
                              {emp.reason || "Uninformed / Absent"}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Link href={`/employees?search=${encodeURIComponent(emp.employee_code)}`}>
                            <Button variant="ghost" size="sm" className="h-7 text-[8px] font-black uppercase tracking-wider text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50">
                              View Profile
                              <ArrowUpRight className="h-3 w-3 ml-0.5" />
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                Showing {filteredAbsentEmployees.length} of {absentEmployees.length} absent employee records
              </span>
              <div className="flex items-center gap-2">
                <Link href="/attendance">
                  <Button variant="outline" size="sm" className="h-8 text-[9px] font-black uppercase tracking-wider border-slate-200">
                    Attendance Grid
                  </Button>
                </Link>
                <Link href="/leave">
                  <Button size="sm" className="h-8 text-[9px] font-black uppercase tracking-wider bg-slate-900 text-white hover:bg-slate-800">
                    Review Leaves
                  </Button>
                </Link>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Deep Analytics & Visualization Dashboard Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 md:gap-8">

          {/* Left Side: Advanced Analytical Charts & Core Sections (8 Cols) */}
          <div className="xl:col-span-8 space-y-6 md:space-y-8">

            {/* Department Distribution Table (Requirement 2.1: Total, Active, Inactive) */}
            <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden p-1">
              <CardHeader className="p-6 pb-3 border-none flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-black italic text-slate-900 underline underline-offset-4 decoration-[#D9F99D] decoration-2 uppercase tracking-widest">
                    Department Distribution
                  </CardTitle>
                  <CardDescription className="text-[8px] font-black text-slate-400 mt-2 uppercase tracking-wider">
                    Total Headcount, Active Employees, and Inactive Employees across all departments.
                  </CardDescription>
                </div>
                <Building2 className="h-4 w-4 text-indigo-500" />
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-slate-100 hover:bg-transparent">
                      <TableHead className="pl-6 text-[9px] font-black uppercase tracking-widest text-slate-400">Department</TableHead>
                      <TableHead className="text-[9px] font-black uppercase tracking-widest text-slate-400 text-center">Total Staff</TableHead>
                      <TableHead className="text-[9px] font-black uppercase tracking-widest text-slate-400 text-center">Active</TableHead>
                      <TableHead className="text-[9px] font-black uppercase tracking-widest text-slate-400 text-center">Inactive</TableHead>
                      <TableHead className="pr-6 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right">Active Ratio</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-10 text-[9px] font-black text-slate-300 uppercase tracking-widest">
                          Loading department distribution…
                        </TableCell>
                      </TableRow>
                    ) : departmentDistribution.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-10 text-[9px] font-black text-slate-300 uppercase tracking-widest">
                          No department data available
                        </TableCell>
                      </TableRow>
                    ) : (
                      departmentDistribution.map((dept, i) => {
                        const deptName = dept.department || "Unassigned";
                        const total = dept.total_employees || 0;
                        const active = dept.active_employees || 0;
                        const inactive = dept.inactive_employees || 0;
                        const activePct = total > 0 ? Math.round((active / total) * 100) : 0;
                        const barColor = DEPT_COLORS[deptName] || "bg-indigo-500";
                        return (
                          <TableRow key={i} className="border-b border-dashed border-slate-50 last:border-none h-14 hover:bg-slate-50/55 transition-colors">
                            <TableCell className="pl-6">
                              <div className="flex items-center gap-2">
                                <div className={cn("h-2.5 w-2.5 rounded-full shrink-0", barColor)} />
                                <span className="text-[11px] font-black text-slate-900 uppercase tracking-tight">{deptName}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline" className="font-black text-[9px] text-slate-800 bg-slate-50 border-slate-200 px-2 py-0.5">
                                {total} Staff
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge className="font-black text-[9px] text-emerald-800 bg-emerald-50 border-none px-2 py-0.5">
                                {active} Active
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge className={cn(
                                "font-black text-[9px] border-none px-2 py-0.5",
                                inactive > 0 ? "text-amber-800 bg-amber-50" : "text-slate-400 bg-slate-50"
                              )}>
                                {inactive} Inactive
                              </Badge>
                            </TableCell>
                            <TableCell className="pr-6">
                              <div className="flex items-center justify-end gap-2.5">
                                <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
                                  <div
                                    className={cn("h-full rounded-l-full transition-all duration-500", barColor)}
                                    style={{ width: `${activePct}%` }}
                                    title={`Active: ${active}`}
                                  />
                                  <div
                                    className="h-full bg-slate-300 rounded-r-full transition-all duration-500"
                                    style={{ width: `${100 - activePct}%` }}
                                    title={`Inactive: ${inactive}`}
                                  />
                                </div>
                                <span className="text-[10px] font-bold text-slate-700 min-w-[32px] text-right">{activePct}%</span>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Leave Type Distribution (Requirement 2.1: PL, EL, CL) */}
            <Card className="border-none shadow-sm rounded-2xl bg-white p-6">
              <div className="flex items-center justify-between mb-5 border-b border-dashed border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-black text-slate-900 italic uppercase tracking-widest leading-none underline underline-offset-4 decoration-[#D9F99D] decoration-2">
                    Leave Type Distribution (PL, EL, CL)
                  </h3>
                  <p className="text-[8px] font-black text-slate-400 mt-3 uppercase tracking-wider">
                    Breakdown of employee leave requests across Privilege (PL), Earned (EL), and Casual (CL) leaves.
                  </p>
                </div>
                <Layers className="h-4 w-4 text-indigo-500" />
              </div>

              {loading ? (
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest text-center py-8">Loading leave distribution…</p>
              ) : (
                <div className="space-y-6">
                  {/* Segmented Distribution Bar */}
                  <div className="h-4 w-full bg-slate-100 rounded-full flex overflow-hidden shadow-inner">
                    {leaveTypeDistribution.map((item, i) => {
                      const pct = Math.max(item.count > 0 ? 3 : 0, item.percentage);
                      return (
                        <div
                          key={i}
                          style={{ width: `${pct}%` }}
                          className={cn("h-full transition-all duration-500", item.color || "bg-slate-400")}
                          title={`${item.label}: ${item.count} requests (${item.total_days} days)`}
                        />
                      );
                    })}
                  </div>

                  {/* Grid of PL, EL, CL and Other Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {leaveTypeDistribution.map((item, i) => (
                      <div key={i} className="p-4 rounded-xl bg-slate-50 border border-slate-100/60 flex flex-col justify-between h-28">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={cn("h-2.5 w-2.5 rounded-full shrink-0", item.color)} />
                            <span className="text-[9px] font-black text-slate-800 uppercase tracking-wider">{item.label}</span>
                          </div>
                          <Badge className="bg-white text-slate-700 border border-slate-200 text-[8px] font-black px-1.5 py-0.5">
                            {item.percentage}%
                          </Badge>
                        </div>
                        <div>
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-xl font-black text-slate-900 italic tracking-tight">{item.count}</span>
                            <span className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider">Requests</span>
                          </div>
                          <div className="flex items-center justify-between mt-1 text-[7.5px] font-bold uppercase tracking-wider text-slate-500">
                            <span>{item.total_days} Total Days</span>
                            {item.annual_entitlement > 0 && (
                              <span className="text-indigo-600 font-black">Quota: {item.annual_entitlement}d/yr</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>

            {/* Annual Leave Entitlement Policy Overview (Requirement 2.1 & Section 9: 12 CL + 12 EL = 24d) */}
            <Card className="border-none shadow-sm rounded-2xl bg-gradient-to-br from-indigo-50/50 via-white to-slate-50/50 p-6 border border-indigo-100/40">
              <div className="flex items-center justify-between mb-5 border-b border-dashed border-indigo-100 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-indigo-600 text-white border-none font-black text-[7.5px] px-2 py-0.5 uppercase tracking-widest">
                      Approved Policy
                    </Badge>
                    <h3 className="text-sm font-black text-slate-900 italic uppercase tracking-widest leading-none">
                      Annual Leave Entitlement Structure
                    </h3>
                  </div>
                  <p className="text-[8px] font-black text-slate-400 mt-2 uppercase tracking-wider">
                    Standardized annual allocation: 12 Casual Leave (CL) + 12 Earned Leave (EL) = 24 Days / Year.
                  </p>
                </div>
                <CalendarDays className="h-4 w-4 text-indigo-600" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Casual Leave Card */}
                <div className="p-4 rounded-xl bg-white border border-amber-200/60 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black text-amber-700 uppercase tracking-widest">Casual Leave (CL)</span>
                    <Badge className="bg-amber-100 text-amber-800 border-none font-black text-[8px] px-2 py-0.5">
                      12 Days / Year
                    </Badge>
                  </div>
                  <p className="text-[8px] font-bold text-slate-500 mt-2 leading-relaxed">
                    • Annual allocation: 12 days<br />
                    • Unused CL does not carry forward<br />
                    • Balance resets annually per company cycle
                  </p>
                  <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[8px] font-black uppercase text-slate-600">
                    <span>Company Used: {annualLeavePolicy?.company_totals?.cl_used ?? 0}d</span>
                    <span className="text-amber-700">Remaining: {annualLeavePolicy?.company_totals?.cl_balance ?? 0}d</span>
                  </div>
                </div>

                {/* Earned Leave Card */}
                <div className="p-4 rounded-xl bg-white border border-indigo-200/60 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black text-indigo-700 uppercase tracking-widest">Earned Leave (EL)</span>
                    <Badge className="bg-indigo-100 text-indigo-800 border-none font-black text-[8px] px-2 py-0.5">
                      12 Days / Year
                    </Badge>
                  </div>
                  <p className="text-[8px] font-bold text-slate-500 mt-2 leading-relaxed">
                    • Annual allocation: 12 days<br />
                    • Carry-forward permitted per policy<br />
                    • Subject to company carry-forward limits
                  </p>
                  <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[8px] font-black uppercase text-slate-600">
                    <span>Company Used: {annualLeavePolicy?.company_totals?.el_used ?? 0}d</span>
                    <span className="text-indigo-700">Remaining: {annualLeavePolicy?.company_totals?.el_balance ?? 0}d</span>
                  </div>
                </div>

                {/* Total Annual Entitlement Card */}
                <div className="p-4 rounded-xl bg-white border border-emerald-200/60 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black text-emerald-700 uppercase tracking-widest">Combined Entitlement</span>
                      <Badge className="bg-emerald-100 text-emerald-800 border-none font-black text-[8px] px-2 py-0.5">
                        24 Days / Year
                      </Badge>
                    </div>
                    <p className="text-[8px] font-bold text-slate-500 mt-2 leading-relaxed">
                      • 12 CL + 12 EL = 24 Total Annual Days<br />
                      • Full Admin / HR history & balance controls<br />
                      • Decoupled payroll salary deduction logic
                    </p>
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[8px] font-black uppercase text-slate-600">
                    <span>Active Staff: {activeEmployees}</span>
                    <Link href="/leave" className="text-emerald-700 hover:underline flex items-center gap-0.5">
                      Leave Ledger <ArrowUpRight className="h-2.5 w-2.5" />
                    </Link>
                  </div>
                </div>
              </div>
            </Card>

            {/* Recent Employees Section (Requirement 2.1) */}
            <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden p-1">
              <CardHeader className="p-6 pb-3 border-none flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-black italic text-slate-900 underline underline-offset-4 decoration-[#D9F99D] decoration-2 uppercase tracking-widest">
                    Recent Employees
                  </CardTitle>
                  <CardDescription className="text-[8px] font-black text-slate-400 mt-2 uppercase tracking-wider">
                    Newly onboarded workforce and recently added staff members.
                  </CardDescription>
                </div>
                <Link href="/employees">
                  <Button variant="ghost" size="sm" className="h-7 text-[8px] font-black uppercase tracking-wider text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50">
                    View All Staff
                    <ArrowUpRight className="h-3 w-3 ml-1" />
                  </Button>
                </Link>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-slate-100 hover:bg-transparent">
                      <TableHead className="pl-6 text-[9px] font-black uppercase tracking-widest text-slate-400">Employee</TableHead>
                      <TableHead className="text-[9px] font-black uppercase tracking-widest text-slate-400">Department</TableHead>
                      <TableHead className="text-[9px] font-black uppercase tracking-widest text-slate-400">Designation</TableHead>
                      <TableHead className="text-[9px] font-black uppercase tracking-widest text-slate-400">Joining Date</TableHead>
                      <TableHead className="pr-6 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-10 text-[9px] font-black text-slate-300 uppercase tracking-widest">
                          Loading recent employees…
                        </TableCell>
                      </TableRow>
                    ) : recentEmployees.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-10 text-[9px] font-black text-slate-300 uppercase tracking-widest">
                          No recent employees found
                        </TableCell>
                      </TableRow>
                    ) : (
                      recentEmployees.map((emp) => (
                        <TableRow key={emp.id} className="border-b border-dashed border-slate-50 last:border-none h-14 hover:bg-slate-50/55 transition-colors">
                          <TableCell className="pl-6">
                            <div className="flex items-center gap-2.5">
                              <div className="h-8 w-8 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-black text-[10px] flex items-center justify-center uppercase shrink-0">
                                {emp.name.split(" ").map((n) => n[0]).join("").slice(0, 2) || "EM"}
                              </div>
                              <div>
                                <span className="text-[11px] font-black text-slate-900 uppercase tracking-tight block">{emp.name}</span>
                                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block">{emp.employee_code}</span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-bold text-[8px] uppercase tracking-wider text-slate-700 bg-slate-50 border-slate-200">
                              {emp.department}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-[10px] font-bold text-slate-600">{emp.designation}</TableCell>
                          <TableCell className="text-[10px] font-bold text-slate-500">
                            {emp.date_of_joining
                              ? new Date(emp.date_of_joining).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                              : "—"}
                          </TableCell>
                          <TableCell className="pr-6 text-right">
                            <Badge className={cn(
                              "font-black text-[8px] tracking-wider uppercase border-none px-2 py-0.5",
                              emp.status === "active" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
                            )}>
                              {emp.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Tour Expenses & Travel Audit (Requirement 2.1: Retained & Enhanced with live stats) */}
            <Card className="border-none shadow-sm rounded-2xl bg-white p-6">
              <div className="flex items-center justify-between mb-5 border-b border-dashed border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-black text-slate-900 italic uppercase tracking-widest leading-none underline underline-offset-4 decoration-[#D9F99D] decoration-2">
                    Tour Expenses & Travel Audit
                  </h3>
                  <p className="text-[8px] font-black text-slate-400 mt-3 uppercase tracking-wider">
                    Operational travel claims, reimbursements and budget approvals.
                  </p>
                </div>
                <Plane className="h-4 w-4 text-indigo-500" />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100/70">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Active Tours</span>
                  <span className="text-xl font-black text-slate-900 italic tracking-tight mt-1 block">
                    {tourExpensesSummary.active_tours}
                  </span>
                  <span className="text-[7.5px] font-bold text-slate-400 uppercase tracking-wide mt-0.5 block">Ongoing assignments</span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100/70">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Total Claims</span>
                  <span className="text-xl font-black text-slate-900 italic tracking-tight mt-1 block">
                    {tourExpensesSummary.total_claims}
                  </span>
                  <span className="text-[7.5px] font-bold text-slate-400 uppercase tracking-wide mt-0.5 block">Submitted travel claims</span>
                </div>
                <div className="p-3.5 rounded-xl bg-amber-50/50 border border-amber-100">
                  <span className="text-[8px] font-black text-amber-700 uppercase tracking-widest block">Pending Review</span>
                  <span className="text-xl font-black text-amber-800 italic tracking-tight mt-1 block">
                    {tourExpensesSummary.pending_claims}
                  </span>
                  <span className="text-[7.5px] font-bold text-amber-600 uppercase tracking-wide mt-0.5 block">Awaiting signoff</span>
                </div>
                <div className="p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-100">
                  <span className="text-[8px] font-black text-emerald-700 uppercase tracking-widest block">Approved Total</span>
                  <span className="text-xl font-black text-emerald-800 italic tracking-tight mt-1 block">
                    ₹{Number(tourExpensesSummary.approved_amount || 0).toLocaleString("en-IN")}
                  </span>
                  <span className="text-[7.5px] font-bold text-emerald-600 uppercase tracking-wide mt-0.5 block">Approved reimbursements</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-50">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest text-center sm:text-left">
                  Manage comprehensive per diem, lodging, travel bills and audit workflow in the dedicated module.
                </p>
                <Link href="/tour-expenses" className="w-full sm:w-auto">
                  <Button variant="outline" className="w-full sm:w-auto font-black uppercase text-[8px] tracking-widest px-6 h-10 rounded-lg border-slate-200 hover:bg-slate-50 shadow-xs">
                    Open Tour Expenses
                    <ArrowUpRight className="h-3 w-3 ml-1" />
                  </Button>
                </Link>
              </div>
            </Card>

          </div>

          {/* Right Side: Operational Control & Audit Trail (4 Cols) */}
          <div className="xl:col-span-4 space-y-6 md:space-y-8">

            {/* Active Governance Rules */}
            <Card className="border-none shadow-sm rounded-2xl bg-white p-5">
              <div className="flex items-center justify-between mb-5 border-b border-dashed border-slate-100 pb-3">
                <h3 className="text-sm font-black text-slate-900 italic uppercase tracking-widest leading-none underline underline-offset-4 decoration-[#D9F99D] decoration-2">
                  Active Governance Rules
                </h3>
                <Scale className="h-4 w-4 text-indigo-500" />
              </div>

              <div className="space-y-3.5">
                {loading ? (
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest text-center py-6">Loading governance rules…</p>
                ) : governanceRules.length === 0 ? (
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest text-center py-6">No governance data available</p>
                ) : (
                  governanceRules.map((rule, idx) => (
                    <div key={idx} className="flex justify-between items-start text-xs border-b border-slate-50 last:border-none pb-2 last:pb-0">
                      <div>
                        <span className="text-[8.5px] font-black uppercase text-slate-700 tracking-wider block">{rule.label}</span>
                        <span className="text-[7.5px] text-slate-400 block mt-0.5 uppercase tracking-tight">{rule.description}</span>
                      </div>
                      <Badge className="bg-slate-100 text-slate-800 border-none font-black text-[8px] tracking-wider uppercase h-5.5 px-2 rounded-md shrink-0">
                        {rule.value}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </Card>

            {/* Active Loans Summary */}
            <Card className="border-none shadow-sm rounded-2xl bg-white p-5">
              <div className="flex items-center justify-between mb-5 border-b border-dashed border-slate-100 pb-3">
                <h3 className="text-sm font-black text-slate-900 italic uppercase tracking-widest leading-none underline underline-offset-4 decoration-[#D9F99D] decoration-2">
                  Active Loan Recoveries
                </h3>
                <Coins className="h-4 w-4 text-indigo-500" />
              </div>

              {loading ? (
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest text-center py-8">Loading loan data…</p>
              ) : (
                <div className="space-y-4">
                  <div className="p-3.5 rounded-xl bg-amber-50/50 border border-amber-100 flex flex-col justify-between h-[120px]">
                    <div className="flex justify-between items-start">
                      <div>
                        <Badge className="bg-amber-100 text-amber-700 border-none font-black text-[7px] px-1.5 py-0.5 rounded uppercase tracking-wider">Active</Badge>
                        <h4 className="text-xs font-black uppercase tracking-tight mt-2 text-slate-900">
                          {activeLoansCount} Active Loan{activeLoansCount !== 1 ? "s" : ""}
                        </h4>
                        <p className="text-[7.5px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Currently in recovery</p>
                      </div>
                      <span className="text-[11px] font-black text-amber-600">{activeLoansCount}</span>
                    </div>

                    {/* Loan type breakdown */}
                    {loanDistribution.length > 0 && (
                      <div className="space-y-1.5 mt-3">
                        {loanDistribution.map((l, i) => (
                          <div key={i} className="flex justify-between text-[7px] font-bold uppercase text-slate-400 tracking-wider">
                            <span>{l.type}</span>
                            <span>{l.count}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <Link href="/loans">
                    <Button variant="outline" className="w-full font-black uppercase text-[8px] tracking-widest h-9 rounded-lg border-slate-200">
                      View All Loans
                      <ArrowUpRight className="h-3 w-3 ml-1" />
                    </Button>
                  </Link>
                </div>
              )}
            </Card>

            {/* Compliance Audit */}
            <Card className="border-none shadow-sm rounded-2xl bg-white p-5">
              <div className="flex items-center justify-between mb-5 border-b border-dashed border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-black text-slate-900 italic uppercase tracking-widest leading-none underline underline-offset-4 decoration-[#D9F99D] decoration-2">
                    Compliance Audit
                  </h3>
                  {!loading && complianceSummary.total > 0 && (
                    <p className="text-[7.5px] font-black text-slate-400 mt-2 uppercase tracking-wider">
                      {complianceSummary.passed} passed • {complianceSummary.warnings} warnings • {complianceSummary.failed} failed
                    </p>
                  )}
                </div>
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
              </div>

              <div className="space-y-4">
                {loading ? (
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest text-center py-8">Running compliance checks…</p>
                ) : complianceChecks.length === 0 ? (
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest text-center py-8">No compliance data available</p>
                ) : (
                  complianceChecks.map((check, i) => {
                    const passed = check.status === true;
                    const warning = check.status === null;
                    return (
                      <div key={i} className="flex items-start gap-3">
                        <div className={cn(
                          "h-4 w-4 rounded-full flex items-center justify-center shrink-0 mt-0.5 border",
                          passed ? "bg-emerald-50 border-emerald-100" : warning ? "bg-amber-50 border-amber-100" : "bg-rose-50 border-rose-100"
                        )}>
                          {passed ? (
                            <CheckCircle2 className="h-3 w-3 text-emerald-600 fill-current" />
                          ) : (
                            <AlertCircle className={cn("h-3 w-3", warning ? "text-amber-600" : "text-rose-600")} />
                          )}
                        </div>
                        <div>
                          <p className="text-[9.5px] font-black text-slate-900 uppercase tracking-wider">{check.title}</p>
                          <p className="text-[8px] font-bold text-slate-400 mt-0.5 uppercase tracking-tight">{check.description}</p>
                          <p className={cn("text-[7.5px] font-bold mt-0.5 uppercase tracking-tight", passed ? "text-emerald-500" : warning ? "text-amber-500" : "text-rose-500")}>{check.detail}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </Card>

            {/* Recent Activities */}
            <Card className="border-none shadow-sm rounded-2xl bg-white p-5">
              <div className="flex items-center justify-between mb-5 border-b border-dashed border-slate-100 pb-3">
                <h3 className="text-sm font-black text-slate-900 italic uppercase tracking-widest leading-none underline underline-offset-4 decoration-[#D9F99D] decoration-2">
                  Recent Activities
                </h3>
                <Activity className="h-4 w-4 text-indigo-500" />
              </div>

              <div className="space-y-4">
                {loading ? (
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest text-center py-8">Loading recent activities…</p>
                ) : recentActivities.length === 0 ? (
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest text-center py-8">No recent activity</p>
                ) : (
                  recentActivities.map((act, i) => (
                    <div key={i} className="flex items-start gap-2.5 pb-2 border-b border-dashed border-slate-100 last:border-none last:pb-0">
                      <div className={cn(
                        "h-1.5 w-1.5 rounded-full mt-1 shrink-0",
                        act.type === "summary" ? "bg-indigo-500" :
                          act.type === "attendance" ? "bg-emerald-500" :
                            act.type === "leaves" ? "bg-amber-500" :
                              act.type === "onboarding" ? "bg-blue-500" :
                                act.type === "loan" ? "bg-rose-500" :
                                  act.type === "payroll" ? "bg-cyan-500" : "bg-slate-400"
                      )} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[8px] font-bold text-slate-700 leading-relaxed uppercase tracking-tight">{act.message}</p>
                        <span className="text-[7px] text-slate-400 uppercase tracking-widest font-black block mt-0.5">{act.time}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>

          </div>

        </div>
      </div>
    </ProtectedRoute>
  );
}
