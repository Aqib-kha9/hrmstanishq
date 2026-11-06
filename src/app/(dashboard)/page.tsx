"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users,
  Briefcase,
  Calendar,
  Clock,
  ArrowUpRight,
  Building2,
  AlertCircle,
  ShieldCheck,
  IndianRupee,
  Activity,
  FileCheck,
  CheckCircle2,
  Users2,
  Sparkles,
  Layers,
  Percent,
  Coins,
  Scale,
  Plane
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Link from "next/link";
import { apiGet } from "@/lib/api-client";
import { ProtectedRoute } from "@/components/ProtectedRoute";

type AdminSummary = {
  total_employees: number;
  active_employees: number;
  today_present: number;
  today_absent: number;
  pending_leaves: number;
  active_loans: number;
  department_stats: Array<{ department: string | null; count: number }>;
};

type AdminStats = {
  monthly_attendance: Array<{
    month: number;
    attendance_percentage: number;
    present_days: number;
    absent_days: number;
  }>;
  leave_distribution: Array<{ leave_type: string; count: number }>;
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
};

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [governance, setGovernance] = useState<AdminGovernance | null>(null);
  const [compliance, setCompliance] = useState<AdminCompliance | null>(null);
  const [activity, setActivity] = useState<AdminActivity | null>(null);

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
  const todayPresent = summary?.today_present ?? 0;
  const todayAbsent = summary?.today_absent ?? 0;
  const attendanceRate = totalEmployees > 0
    ? Math.round((todayPresent / totalEmployees) * 100)
    : 0;
  const pendingLeaves = summary?.pending_leaves ?? 0;
  const activeLoansCount = summary?.active_loans ?? 0;
  const departmentStats = summary?.department_stats ?? [];
  const leaveDistribution = stats?.leave_distribution ?? [];
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
              <span className="font-black text-indigo-600">System Summary :</span>{" "}
              {loading
                ? "Loading dashboard data…"
                : `${activeEmployees} active employees across ${departmentStats.length} departments. ${pendingLeaves} pending leaves, ${activeLoansCount} active loans.`
              }
            </p>
          </div>
          <Link href="/payroll" className="w-full md:w-auto">
            <Button className="w-full md:w-auto bg-[#D9F99D] text-slate-900 hover:bg-[#c8ea8a] font-black uppercase text-[8px] tracking-widest px-6 h-10 rounded-lg border border-[#D9F99D] shadow-sm">
              Review Payroll
            </Button>
          </Link>
        </div>

        {/* Strategic Business KPI Metrics (from /dashboard/admin-summary) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { title: "Total Employees", value: loading ? "…" : `${totalEmployees} Staff`, icon: Users2, bg: "bg-[#E0E7FF]", trend: `${activeEmployees} Active`, desc: "Registered workforce count" },
            { title: "Today's Attendance", value: loading ? "…" : `${attendanceRate}%`, icon: Activity, bg: "bg-[#D1FAE5]", trend: `${todayPresent} Present`, desc: `${todayAbsent} absent today` },
            { title: "Pending Leave Requests", value: loading ? "…" : `${pendingLeaves}`, icon: Calendar, bg: "bg-[#FEF3C7]", trend: "Awaiting Review", desc: "Leave requests to process" },
            { title: "Active Loans", value: loading ? "…" : `${activeLoansCount}`, icon: Coins, bg: "bg-[#DBEAFE]", trend: "Ongoing", desc: "Active loan accounts" },
          ].map((stat, i) => (
            <Card key={i} className={cn(stat.bg, "border-none rounded-2xl shadow-sm relative overflow-hidden h-36 flex flex-col justify-between p-5 hover:shadow-md transition-shadow group")}>
              <div className="flex items-start justify-between">
                <div className="bg-white/50 p-2 rounded-xl group-hover:scale-105 transition-transform">
                  <stat.icon className="h-4 w-4 text-slate-900 stroke-[2.5]" />
                </div>
                <span className="text-[7.5px] font-black uppercase text-slate-500 opacity-60 tracking-wider select-none">{stat.trend}</span>
              </div>
              <div>
                <h3 className="text-2xl md:text-3xl font-black text-slate-900 italic tracking-tighter">{stat.value}</h3>
                <p className="text-[8.5px] font-bold text-slate-600 mt-1 uppercase tracking-widest">{stat.title}</p>
                <p className="text-[7px] font-medium text-slate-400 mt-0.5 uppercase tracking-wide">{stat.desc}</p>
              </div>
            </Card>
          ))}
        </div>

        {/* Deep Analytics & Visualization Dashboard Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 md:gap-8">

          {/* Left Side: Advanced Analytical Charts */}
          <div className="xl:col-span-8 space-y-6 md:space-y-8">

            {/* Department Distribution Table (from department_stats) */}
            <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden p-1">
              <CardHeader className="p-6 pb-2 border-none">
                <CardTitle className="text-sm font-black italic text-slate-900 underline underline-offset-4 decoration-[#D9F99D] decoration-2 uppercase tracking-widest">Department Distribution</CardTitle>
                <CardDescription className="text-[8px] font-black text-slate-400 mt-3 uppercase tracking-wider">Active employee headcount split across departments.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="border-none hover:bg-transparent">
                      <TableHead className="pl-6 text-[9px] font-black uppercase tracking-widest text-slate-400">Department</TableHead>
                      <TableHead className="text-[9px] font-black uppercase tracking-widest text-slate-400">Headcount</TableHead>
                      <TableHead className="text-[9px] font-black uppercase tracking-widest text-slate-400">% of Workforce</TableHead>
                      <TableHead className="pr-6 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right">Distribution</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-10 text-[9px] font-black text-slate-300 uppercase tracking-widest">Loading department data…</TableCell>
                      </TableRow>
                    ) : departmentStats.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-10 text-[9px] font-black text-slate-300 uppercase tracking-widest">No department data available</TableCell>
                      </TableRow>
                    ) : (
                      departmentStats.map((dept, i) => {
                        const deptName = dept.department || "Unassigned";
                        const pct = totalEmployees > 0 ? Math.round((dept.count / totalEmployees) * 100) : 0;
                        const barColor = DEPT_COLORS[deptName] || "bg-slate-400";
                        return (
                          <TableRow key={i} className="border-b border-dashed border-slate-50 last:border-none h-14 hover:bg-slate-50/55 transition-colors">
                            <TableCell className="pl-6">
                              <div className="flex items-center gap-2">
                                <div className={cn("h-2 w-2 rounded-full", barColor)} />
                                <span className="text-[11px] font-black text-slate-900 uppercase tracking-tight">{deptName}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-[10px] font-black text-slate-700">{dept.count}</TableCell>
                            <TableCell className="text-[10px] font-bold text-slate-600">{pct}%</TableCell>
                            <TableCell className="pr-6">
                              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                <div className={cn("h-full rounded-full transition-all duration-500", barColor)} style={{ width: `${Math.max(5, pct)}%` }} />
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

            {/* Leave Distribution Chart (from leave_distribution) */}
            <Card className="border-none shadow-sm rounded-2xl bg-white p-6">
              <div className="flex items-center justify-between mb-5 border-b border-dashed border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-black text-slate-900 italic uppercase tracking-widest leading-none underline underline-offset-4 decoration-[#D9F99D] decoration-2">Leave Type Distribution</h3>
                  <p className="text-[8px] font-black text-slate-400 mt-3 uppercase tracking-wider">Breakdown of leave requests by type across the organisation.</p>
                </div>
                <Layers className="h-4 w-4 text-indigo-500" />
              </div>

              {loading ? (
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest text-center py-8">Loading leave data…</p>
              ) : leaveDistribution.length === 0 ? (
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest text-center py-8">No leave data available</p>
              ) : (
                (() => {
                  const totalLeaves = leaveDistribution.reduce((sum, l) => sum + l.count, 0);
                  const LEAVE_COLORS: Record<string, string> = {
                    sick: "bg-rose-500",
                    casual: "bg-amber-500",
                    earned: "bg-indigo-500",
                    unpaid: "bg-slate-400",
                  };
                  return (
                    <div className="space-y-6">
                      <div className="h-4 w-full bg-slate-100 rounded-full flex overflow-hidden shadow-inner">
                        {leaveDistribution.map((l, i) => {
                          const pct = totalLeaves > 0 ? Math.round((l.count / totalLeaves) * 100) : 0;
                          return (
                            <div
                              key={i}
                              style={{ width: `${Math.max(2, pct)}%` }}
                              className={cn("h-full transition-all duration-500", LEAVE_COLORS[l.leave_type] || "bg-slate-400")}
                              title={`${l.leave_type}: ${l.count}`}
                            />
                          );
                        })}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {leaveDistribution.map((l, i) => {
                          const pct = totalLeaves > 0 ? Math.round((l.count / totalLeaves) * 100) : 0;
                          return (
                            <div key={i} className="flex items-start gap-2.5">
                              <div className={cn("h-2 w-2 rounded-full mt-1 shrink-0", LEAVE_COLORS[l.leave_type] || "bg-slate-400")} />
                              <div>
                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">{l.leave_type}</span>
                                <span className="text-xs font-black text-slate-900 mt-0.5 block">{l.count} <span className="text-[8.5px] font-bold text-slate-400">({pct}%)</span></span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()
              )}
            </Card>

            {/* Tour Expenses & Travel Audit (placeholder — no backend API) */}
            <Card className="border-none shadow-sm rounded-2xl bg-white p-6">
              <div className="flex items-center justify-between mb-5 border-b border-dashed border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-black text-slate-900 italic uppercase tracking-widest leading-none underline underline-offset-4 decoration-[#D9F99D] decoration-2">Tour Expenses & Travel Audit</h3>
                  <p className="text-[8px] font-black text-slate-400 mt-3 uppercase tracking-wider">Operational travel claims, reimbursements and budget approvals.</p>
                </div>
                <Plane className="h-4 w-4 text-indigo-500" />
              </div>

              <div className="text-center py-8 space-y-3">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Tour expenses module available separately</p>
                <Link href="/tour-expenses">
                  <Button variant="outline" className="font-black uppercase text-[8px] tracking-widest px-6 h-10 rounded-lg border-slate-200">
                    Open Tour Expenses
                    <ArrowUpRight className="h-3 w-3 ml-1" />
                  </Button>
                </Link>
              </div>
            </Card>
          </div>

          {/* Right Side: Operational Control & Audit Trail */}
          <div className="xl:col-span-4 space-y-6 md:space-y-8">

            {/* Active Governance Rules — live from /dashboard/admin-governance */}
            <Card className="border-none shadow-sm rounded-2xl bg-white p-5">
              <div className="flex items-center justify-between mb-5 border-b border-dashed border-slate-100 pb-3">
                <h3 className="text-sm font-black text-slate-900 italic uppercase tracking-widest leading-none underline underline-offset-4 decoration-[#D9F99D] decoration-2">Active Governance Rules</h3>
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

            {/* Active Loans Summary (from admin-summary + loan_distribution) */}
            <Card className="border-none shadow-sm rounded-2xl bg-white p-5">
              <div className="flex items-center justify-between mb-5 border-b border-dashed border-slate-100 pb-3">
                <h3 className="text-sm font-black text-slate-900 italic uppercase tracking-widest leading-none underline underline-offset-4 decoration-[#D9F99D] decoration-2">Active Loan Recoveries</h3>
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

            {/* Hub Allocation (from department_stats) */}
            <Card className="border-none shadow-sm rounded-2xl bg-white p-5">
              <div className="flex items-center justify-between mb-5 border-b border-dashed border-slate-100 pb-3">
                <h3 className="text-sm font-black text-slate-900 italic uppercase tracking-widest leading-none underline underline-offset-4 decoration-[#D9F99D] decoration-2">Department Allocation</h3>
                <Building2 className="h-4 w-4 text-indigo-500" />
              </div>

              {loading ? (
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest text-center py-8">Loading allocation data…</p>
              ) : departmentStats.length === 0 ? (
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest text-center py-8">No data available</p>
              ) : (
                <div className="space-y-4">
                  {departmentStats.slice(0, 5).map((dept, i) => {
                    const deptName = dept.department || "Unassigned";
                    const pct = totalEmployees > 0 ? Math.round((dept.count / totalEmployees) * 100) : 0;
                    const barColor = DEPT_COLORS[deptName] || "bg-slate-400";
                    return (
                      <div key={i} className="space-y-1.5 p-3.5 rounded-xl bg-slate-50 border border-slate-100/50">
                        <div className="flex justify-between items-center text-[9px] font-black uppercase text-slate-700 tracking-wider">
                          <span className="flex items-center gap-1.5">
                            <div className={cn("h-1.5 w-1.5 rounded-full", barColor.replace("bg-", "bg-").split(" ")[0])} style={{ backgroundColor: barColor.includes("indigo") ? "#6366f1" : barColor.includes("emerald") ? "#10b981" : barColor.includes("amber") ? "#f59e0b" : barColor.includes("blue") ? "#3b82f6" : barColor.includes("rose") ? "#f43f5e" : barColor.includes("cyan") ? "#06b6d4" : "#94a3b8" }} />
                            {deptName}
                          </span>
                          <span>{pct}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-200/50 rounded-full overflow-hidden mt-2">
                          <div className={cn("h-full rounded-full", barColor)} style={{ width: `${Math.max(5, pct)}%` }} />
                        </div>
                        <div className="flex justify-between text-[7px] font-bold text-slate-400 uppercase tracking-widest mt-1.5">
                          <span>{dept.count} active resources</span>
                          <span>{pct}% of workforce</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* Compliance Audit — live from /dashboard/admin-compliance */}
            <Card className="border-none shadow-sm rounded-2xl bg-white p-5">
              <div className="flex items-center justify-between mb-5 border-b border-dashed border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-black text-slate-900 italic uppercase tracking-widest leading-none underline underline-offset-4 decoration-[#D9F99D] decoration-2">Compliance Audit</h3>
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

            {/* Recent Activities — live from /dashboard/admin-activity */}
            <Card className="border-none shadow-sm rounded-2xl bg-white p-5">
              <div className="flex items-center justify-between mb-5 border-b border-dashed border-slate-100 pb-3">
                <h3 className="text-sm font-black text-slate-900 italic uppercase tracking-widest leading-none underline underline-offset-4 decoration-[#D9F99D] decoration-2">Recent Activities</h3>
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
