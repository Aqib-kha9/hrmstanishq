"use client";

import { apiGet } from "@/lib/api-client";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import {
    Wallet,
    Banknote,
    Users,
    Search,
    Filter,
    Download,
    CalendarDays,
    Activity,
    ArrowLeft,
    Building2,
    TrendingUp,
    TrendingDown,
    Calendar,
    BarChart3,
    ArrowUpRight,
    CheckCircle2,
    Clock
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

export default function PayrollAnalyticsPage() {
    const now = new Date();
    const currentYearStr = String(now.getFullYear());
    const currentMonthStr = String(now.getMonth() + 1);

    const [viewMode, setViewMode] = useState<"monthly" | "yearly">("monthly");
    const [selectedYear, setSelectedYear] = useState(currentYearStr);
    const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);
    const [selectedCompany, setSelectedCompany] = useState("ALL");
    const [searchQuery, setSearchQuery] = useState("");
    const [loading, setLoading] = useState(true);

    // Data from backend
    const [metrics, setMetrics] = useState<any>({
        companyCostPerDay: 0,
        generatedPayout: 0,
        projectedPayout: 0,
        totalActiveStaff: 0,
        totalGrossSalary: 0,
        totalDeductions: 0,
        totalNetPayable: 0,
        totalMonthlyCost: 0,
        totalAnnualCost: 0,
        totalAnnualGross: 0,
        totalAnnualDeductions: 0,
        totalAnnualNetPayout: 0,
        averageMonthlyBurn: 0,
        peakStaffCount: 0,
    });
    const [employees, setEmployees] = useState<any[]>([]);
    const [monthlyBreakdown, setMonthlyBreakdown] = useState<any[]>([]);
    const [dbCompanies, setDbCompanies] = useState<{ id: number; name: string; code?: string }[]>([]);
    const [displayPeriodName, setDisplayPeriodName] = useState("");

    const loadAnalytics = async () => {
        setLoading(true);
        try {
            const params: Record<string, string | number> = {
                periodType: viewMode,
                year: selectedYear,
            };
            if (viewMode === "monthly") {
                params.month = selectedMonth;
            }
            if (selectedCompany !== "ALL") {
                params.company = selectedCompany;
            }

            const [res, comps] = await Promise.all([
                apiGet<any>("/payroll/financial-summary", params),
                apiGet<{ id: number; name: string; code?: string }[]>("/companies").catch(() => [])
            ]);

            const data = (res as any)?.data || res;
            if (data) {
                if (data.metrics) setMetrics(data.metrics);
                if (data.employees) setEmployees(data.employees);
                if (data.monthlyBreakdown) setMonthlyBreakdown(data.monthlyBreakdown);
                if (data.monthName) {
                    setDisplayPeriodName(data.monthName);
                } else if (viewMode === "yearly") {
                    setDisplayPeriodName(`Fiscal Year ${selectedYear}`);
                }
            }
            if (comps && Array.isArray(comps)) {
                setDbCompanies(comps);
            }
        } catch (e) {
            console.error("Failed to load financial summary:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAnalytics();
    }, [viewMode, selectedYear, selectedMonth, selectedCompany]);

    // Unique companies merged
    const companyNamesSet = new Set<string>();
    dbCompanies.forEach(c => { if (c.name) companyNamesSet.add(c.name); });
    employees.forEach(e => { if (e.company) companyNamesSet.add(e.company); });
    const companyList = ["ALL", ...Array.from(companyNamesSet)];

    // Filter employees by search query
    const filteredEmployees = employees.filter(emp => {
        const query = searchQuery.toLowerCase();
        return (
            (emp.name && emp.name.toLowerCase().includes(query)) ||
            (emp.employeeCode && emp.employeeCode.toString().toLowerCase().includes(query)) ||
            (emp.company && emp.company.toLowerCase().includes(query)) ||
            (emp.location && emp.location.toLowerCase().includes(query))
        );
    });

    const handleExport = () => {
        if (viewMode === "yearly") {
            const headers = ["Month", "Staff Count", "Gross Salary (INR)", "Deductions (INR)", "Net Payout (INR)", "Company Cost / CTC (INR)", "Cost / Day (INR)", "Status"];
            const rows = monthlyBreakdown.map(m => [
                m.monthName || m.label,
                m.staffCount,
                m.grossSalary,
                m.deductions,
                m.netPayout,
                m.companyCost,
                m.costPerDay,
                m.status || "Completed"
            ]);
            const csvContent = [
                headers.join(","),
                ...rows.map(row => row.map((cell: any) => `"${cell}"`).join(","))
            ].join("\n");

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", `Yearly_Financial_Summary_${selectedYear}_${selectedCompany.replace(/[^a-zA-Z0-9]/g, '_')}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } else {
            const headers = ["Employee Code", "Name", "Company", "Location", "Designation", "Monthly Gross", "Cost / Day", "Days Active", "Payable Days", "Generated Payout (Till Date)", "Projected Full Month"];
            const rows = filteredEmployees.map(emp => [
                emp.employeeCode,
                emp.name,
                emp.company || "N/A",
                emp.location || "N/A",
                emp.designation || "N/A",
                emp.fixedGross,
                emp.dailyCost,
                `${emp.payableDays} / ${emp.dynamicDays}`,
                emp.payableDays,
                emp.generatedPayout,
                emp.projectedMonthly
            ]);
            const csvContent = [
                headers.join(","),
                ...rows.map(row => row.map((cell: any) => `"${cell}"`).join(","))
            ].join("\n");

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", `Monthly_Financial_Summary_${displayPeriodName.replace(/ /g, "_")}_${selectedCompany.replace(/[^a-zA-Z0-9]/g, '_')}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    return (
        <ProtectedRoute module="PAYROLL" action="READ">
            <div className="space-y-8 pb-20">
                {/* Header Section */}
                <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between px-2 pt-4">
                    <div>
                        <Link href="/payroll" className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-500 transition-colors mb-4 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                            <ArrowLeft className="h-3 w-3" /> Back to Payroll
                        </Link>
                        <h1 className="text-2xl font-black text-slate-900 italic uppercase tracking-tighter underline underline-offset-8 decoration-[#D9F99D] decoration-4">
                            Financial & Analytical Dashboard
                        </h1>
                        <p className="text-[10px] font-bold text-slate-400 mt-4 uppercase tracking-[0.2em]">
                            Company Cost per Day • Generated & Projected Payouts • Workforce Analytics
                        </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Period Filter: Monthly vs Yearly */}
                        <div className="bg-slate-100 p-1 rounded-2xl flex items-center gap-1">
                            <button
                                onClick={() => setViewMode("monthly")}
                                className={cn(
                                    "h-9 px-4 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all",
                                    viewMode === "monthly" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
                                )}
                            >
                                Monthly View
                            </button>
                            <button
                                onClick={() => setViewMode("yearly")}
                                className={cn(
                                    "h-9 px-4 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all",
                                    viewMode === "yearly" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
                                )}
                            >
                                Yearly View
                            </button>
                        </div>

                        {/* Month Selector (if Monthly View) */}
                        {viewMode === "monthly" && (
                            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                                <SelectTrigger className="h-11 w-[130px] rounded-xl bg-white border-2 border-slate-50 font-black text-[9px] uppercase tracking-widest text-slate-900 shadow-sm">
                                    <Calendar className="h-3.5 w-3.5 mr-1 text-indigo-500" />
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="border-none shadow-xl rounded-2xl max-h-60">
                                    {MONTH_NAMES.map((m, idx) => (
                                        <SelectItem key={m} value={String(idx + 1)} className="text-[10px] font-bold uppercase">
                                            {m}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}

                        {/* Year Selector */}
                        <Select value={selectedYear} onValueChange={setSelectedYear}>
                            <SelectTrigger className="h-11 w-[110px] rounded-xl bg-white border-2 border-slate-50 font-black text-[9px] uppercase tracking-widest text-slate-900 shadow-sm">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="border-none shadow-xl rounded-2xl">
                                <SelectItem value="2026" className="text-[10px] font-bold uppercase">2026</SelectItem>
                                <SelectItem value="2025" className="text-[10px] font-bold uppercase">2025</SelectItem>
                                <SelectItem value="2024" className="text-[10px] font-bold uppercase">2024</SelectItem>
                            </SelectContent>
                        </Select>

                        {/* Company Filter Dropdown */}
                        <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                            <SelectTrigger className="h-11 w-[170px] rounded-xl bg-white border-2 border-slate-50 font-black text-[9px] uppercase tracking-widest text-slate-900 shadow-sm">
                                <Building2 className="h-3.5 w-3.5 mr-1 text-indigo-500" />
                                <SelectValue placeholder="Company" />
                            </SelectTrigger>
                            <SelectContent className="border-none shadow-xl rounded-2xl max-h-60">
                                {companyList.map(c => (
                                    <SelectItem key={c} value={c} className="text-[10px] font-bold uppercase truncate max-w-[220px]">
                                        {c === "ALL" ? "All Companies" : c}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Button
                            onClick={handleExport}
                            className="bg-slate-900 text-white hover:bg-black font-black uppercase text-[9px] tracking-[0.3em] px-6 h-11 rounded-xl shadow-md hover:translate-y-[-2px] transition-all"
                        >
                            <Download className="h-4 w-4 mr-2" /> Export
                        </Button>
                    </div>
                </div>

                {/* Section 2.9 Core Financial & Workforce Metrics Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 px-2">
                    {/* 1. Company Cost per Day */}
                    <Card className="bg-[#E0E7FF] border-none rounded-2xl p-6 shadow-sm flex flex-col justify-between h-36 group hover:shadow-lg transition-all">
                        <div className="flex items-start justify-between">
                            <div className="bg-white/50 p-2.5 rounded-xl group-hover:scale-110 transition-transform">
                                <Activity className="h-5 w-5 text-indigo-900" />
                            </div>
                            <Badge className="bg-indigo-100 text-indigo-800 border-none font-black text-[7px] uppercase tracking-widest px-2 h-4">
                                Daily Burn
                            </Badge>
                        </div>
                        <div>
                            <h3 className="text-3xl font-black text-indigo-950 italic tracking-tighter flex items-end gap-1">
                                <span className="text-sm mb-1 text-indigo-400">₹</span>
                                {Number(metrics.companyCostPerDay || 0).toLocaleString()}
                            </h3>
                            <p className="text-[9px] font-bold text-indigo-700 mt-1 uppercase tracking-widest">Company Cost per Day</p>
                        </div>
                    </Card>

                    {/* 2. Generated Payout / Salary Payable to Date */}
                    <Card className="bg-[#D1FAE5] border-none rounded-2xl p-6 shadow-sm flex flex-col justify-between h-36 group hover:shadow-lg transition-all">
                        <div className="flex items-start justify-between">
                            <div className="bg-white/50 p-2.5 rounded-xl group-hover:scale-110 transition-transform">
                                <Banknote className="h-5 w-5 text-emerald-900" />
                            </div>
                            <Badge className="bg-emerald-100 text-emerald-800 border-none font-black text-[7px] uppercase tracking-widest px-2 h-4">
                                {viewMode === "monthly" ? "Earned to Date" : "Disbursed YTD"}
                            </Badge>
                        </div>
                        <div>
                            <h3 className="text-3xl font-black text-emerald-950 italic tracking-tighter flex items-end gap-1">
                                <span className="text-sm mb-1 text-emerald-500">₹</span>
                                {Number(metrics.generatedPayout || 0).toLocaleString()}
                            </h3>
                            <p className="text-[9px] font-bold text-emerald-700 mt-1 uppercase tracking-widest">
                                {viewMode === "monthly" ? "Generated Payout (To Date)" : "Total Generated Payout"}
                            </p>
                        </div>
                    </Card>

                    {/* 3. Projected Payout */}
                    <Card className="bg-[#FEE2E2] border-none rounded-2xl p-6 shadow-sm flex flex-col justify-between h-36 group hover:shadow-lg transition-all">
                        <div className="flex items-start justify-between">
                            <div className="bg-white/50 p-2.5 rounded-xl group-hover:scale-110 transition-transform">
                                <Wallet className="h-5 w-5 text-rose-900" />
                            </div>
                            <Badge className="bg-rose-100 text-rose-800 border-none font-black text-[7px] uppercase tracking-widest px-2 h-4">
                                {viewMode === "monthly" ? "Full Month Liability" : "Annual Forecast"}
                            </Badge>
                        </div>
                        <div>
                            <h3 className="text-3xl font-black text-rose-950 italic tracking-tighter flex items-end gap-1">
                                <span className="text-sm mb-1 text-rose-400">₹</span>
                                {Number(metrics.projectedPayout || 0).toLocaleString()}
                            </h3>
                            <p className="text-[9px] font-bold text-rose-700 mt-1 uppercase tracking-widest">
                                {viewMode === "monthly" ? "Projected Payout (Current Month)" : "Projected Annual Payout"}
                            </p>
                        </div>
                    </Card>

                    {/* 4. Total Active Staff */}
                    <Card className="bg-[#FEF3C7] border-none rounded-2xl p-6 shadow-sm flex flex-col justify-between h-36 group hover:shadow-lg transition-all">
                        <div className="flex items-start justify-between">
                            <div className="bg-white/50 p-2.5 rounded-xl group-hover:scale-110 transition-transform">
                                <Users className="h-5 w-5 text-amber-900" />
                            </div>
                            <Badge className="bg-amber-100 text-amber-800 border-none font-black text-[7px] uppercase tracking-widest px-2 h-4">
                                {selectedCompany === "ALL" ? "All Companies" : "Filtered"}
                            </Badge>
                        </div>
                        <div>
                            <h3 className="text-3xl font-black text-amber-950 italic tracking-tighter flex items-end gap-2">
                                {Number(metrics.totalActiveStaff || filteredEmployees.length || 0)}
                                <span className="text-[11px] mb-1 font-bold uppercase tracking-widest text-amber-700">Staff</span>
                            </h3>
                            <p className="text-[9px] font-bold text-amber-700 mt-1 uppercase tracking-widest">Total Active Staff</p>
                        </div>
                    </Card>
                </div>

                {/* VIEW SPECIFIC CONTENT: MONTHLY vs YEARLY */}
                {viewMode === "yearly" ? (
                    /* ── YEARLY FINANCIAL SUMMARY ── */
                    <div className="space-y-6 mx-2">
                        {/* Macro Yearly Summary Banner */}
                        <div className="p-6 rounded-3xl bg-slate-900 text-white shadow-xl flex flex-col lg:flex-row items-center justify-between gap-6">
                            <div>
                                <Badge className="bg-[#D9F99D] text-slate-900 font-black text-[8px] tracking-[0.2em] uppercase px-3 py-1 rounded-lg mb-3">
                                    Annual Financial Audit
                                </Badge>
                                <h3 className="text-2xl font-black italic uppercase tracking-tighter">
                                    Yearly Financial Summary &mdash; {selectedYear}
                                </h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                                    {selectedCompany === "ALL" ? "Consolidated Across All Companies" : selectedCompany}
                                </p>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full lg:w-auto">
                                <div className="p-3 bg-white/5 rounded-2xl border border-white/10 text-center">
                                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Annual CTC Cost</p>
                                    <p className="text-base font-black text-[#D9F99D] mt-0.5">₹{Number(metrics.totalAnnualCost || 0).toLocaleString()}</p>
                                </div>
                                <div className="p-3 bg-white/5 rounded-2xl border border-white/10 text-center">
                                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Annual Gross</p>
                                    <p className="text-base font-black text-white mt-0.5">₹{Number(metrics.totalAnnualGross || 0).toLocaleString()}</p>
                                </div>
                                <div className="p-3 bg-white/5 rounded-2xl border border-white/10 text-center">
                                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Annual Deductions</p>
                                    <p className="text-base font-black text-rose-400 mt-0.5">₹{Number(metrics.totalAnnualDeductions || 0).toLocaleString()}</p>
                                </div>
                                <div className="p-3 bg-white/5 rounded-2xl border border-white/10 text-center">
                                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Monthly Burn (Avg)</p>
                                    <p className="text-base font-black text-indigo-300 mt-0.5">₹{Number(metrics.averageMonthlyBurn || 0).toLocaleString()}</p>
                                </div>
                            </div>
                        </div>

                        {/* Month-Wise Financial Breakdown Table */}
                        <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden p-1">
                            <CardHeader className="p-6 pb-4 border-none">
                                <CardTitle className="text-lg font-black italic text-slate-900 uppercase tracking-tighter">
                                    Month-by-Month Financial Summary ({selectedYear})
                                </CardTitle>
                                <CardDescription className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                    Consolidated historical payroll cycles with gross, deductions, and daily cost
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="border-none bg-slate-50/50 hover:bg-slate-50/50">
                                            <TableHead className="pl-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Month</TableHead>
                                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Staff Count</TableHead>
                                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Gross Salary</TableHead>
                                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Deductions</TableHead>
                                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Net Payout</TableHead>
                                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Company Cost</TableHead>
                                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cost / Day</TableHead>
                                            <TableHead className="pr-6 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {monthlyBreakdown.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={8} className="text-center py-12 text-slate-400 font-bold text-xs uppercase tracking-widest">
                                                    No payroll cycles recorded for year {selectedYear}
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            monthlyBreakdown.map((m, idx) => (
                                                <TableRow key={idx} className="border-b border-dashed border-slate-100 hover:bg-slate-50/50 transition-all h-16 last:border-none">
                                                    <TableCell className="pl-6 font-black text-slate-900 text-xs italic uppercase tracking-tight">
                                                        {m.monthName || m.label}
                                                    </TableCell>
                                                    <TableCell className="font-bold text-xs text-slate-700">
                                                        {m.staffCount} Staff
                                                    </TableCell>
                                                    <TableCell className="font-bold text-xs text-slate-900">
                                                        ₹{Number(m.grossSalary || 0).toLocaleString()}
                                                    </TableCell>
                                                    <TableCell className="font-bold text-xs text-rose-600">
                                                        ₹{Number(m.deductions || 0).toLocaleString()}
                                                    </TableCell>
                                                    <TableCell className="font-black text-sm text-emerald-600 italic">
                                                        ₹{Number(m.netPayout || 0).toLocaleString()}
                                                    </TableCell>
                                                    <TableCell className="font-bold text-xs text-indigo-700">
                                                        ₹{Number(m.companyCost || 0).toLocaleString()}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline" className="bg-slate-100 text-slate-700 border-none font-black text-[8px] uppercase tracking-wider px-2 h-5">
                                                            ₹{Number(m.costPerDay || 0).toLocaleString()} / day
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="pr-6 text-right">
                                                        <Badge className={cn(
                                                            "font-black text-[8px] uppercase tracking-widest px-2.5 h-5 rounded-md border-none",
                                                            m.status === "Paid" || m.status === "Completed" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                                                        )}>
                                                            {m.status || "Completed"}
                                                        </Badge>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </div>
                ) : (
                    /* ── MONTHLY FINANCIAL SUMMARY & EMPLOYEE BREAKDOWN ── */
                    <div className="space-y-6 mx-2">
                        {/* Monthly Financial Summary Card */}
                        <div className="p-6 rounded-3xl bg-slate-900 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
                            <div>
                                <Badge className="bg-[#D9F99D] text-slate-900 font-black text-[8px] tracking-[0.2em] uppercase px-3 py-1 rounded-lg mb-3">
                                    Monthly Financial Summary
                                </Badge>
                                <h3 className="text-2xl font-black italic uppercase tracking-tighter">
                                    {displayPeriodName || `${MONTH_NAMES[Number(selectedMonth) - 1]} ${selectedYear}`}
                                </h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                                    {selectedCompany === "ALL" ? "All Associated Companies" : selectedCompany}
                                </p>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full md:w-auto">
                                <div className="p-3 bg-white/5 rounded-2xl border border-white/10 text-center">
                                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Prorated Gross</p>
                                    <p className="text-base font-black text-white mt-0.5">₹{Number(metrics.totalGrossSalary || 0).toLocaleString()}</p>
                                </div>
                                <div className="p-3 bg-white/5 rounded-2xl border border-white/10 text-center">
                                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Deductions</p>
                                    <p className="text-base font-black text-rose-400 mt-0.5">₹{Number(metrics.totalDeductions || 0).toLocaleString()}</p>
                                </div>
                                <div className="p-3 bg-white/5 rounded-2xl border border-white/10 text-center">
                                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Net Payable</p>
                                    <p className="text-base font-black text-emerald-400 mt-0.5">₹{Number(metrics.totalNetPayable || 0).toLocaleString()}</p>
                                </div>
                                <div className="p-3 bg-white/5 rounded-2xl border border-white/10 text-center">
                                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Company CTC Cost</p>
                                    <p className="text-base font-black text-[#D9F99D] mt-0.5">₹{Number(metrics.totalMonthlyCost || 0).toLocaleString()}</p>
                                </div>
                            </div>
                        </div>

                        {/* Employee Level Cost & Liability Table */}
                        <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden p-1">
                            <CardHeader className="p-6 pb-3 border-none flex flex-col md:flex-row md:items-center justify-between gap-6">
                                <div>
                                    <CardTitle className="text-lg font-black italic text-slate-900 underline underline-offset-4 decoration-[#D9F99D] decoration-2 uppercase tracking-tighter">
                                        Per Employee Cost & Liability Metrics
                                    </CardTitle>
                                    <CardDescription className="text-[8px] font-black text-slate-400 mt-4 uppercase tracking-[0.3em] italic">
                                        Active staff cost per day, earned to date, and projected payout
                                    </CardDescription>
                                </div>
                                <div className="relative min-w-[240px] group">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                                    <Input
                                        placeholder="Search by employee, code, location..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="h-10 pl-10 pr-4 rounded-xl bg-slate-50 border-none shadow-xs font-bold text-[10px] focus:ring-2 ring-indigo-100"
                                    />
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="border-none hover:bg-transparent bg-slate-50/50">
                                            <TableHead className="pl-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Employee Information</TableHead>
                                            <TableHead className="py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Monthly Gross</TableHead>
                                            <TableHead className="py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Cost / Day</TableHead>
                                            <TableHead className="py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Days Active</TableHead>
                                            <TableHead className="py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Generated Payout</TableHead>
                                            <TableHead className="pr-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Projected Full Month</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredEmployees.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={6} className="text-center py-12 text-slate-400 font-bold text-xs uppercase tracking-widest">
                                                    No employee records found for this period
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            filteredEmployees.map((emp) => (
                                                <TableRow key={emp.id} className="group border-b border-dashed border-slate-100 hover:bg-slate-50/50 transition-all h-20 last:border-none">
                                                    <TableCell className="pl-6">
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-black text-slate-900 italic tracking-tight uppercase group-hover:translate-x-1 transition-transform">
                                                                {emp.name}
                                                            </span>
                                                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                                                <Badge className="bg-slate-900 text-white border-none font-black text-[7px] h-4 px-1.5 rounded uppercase tracking-widest" title={emp.company}>
                                                                    {emp.companyCode || (emp.company ? String(emp.company).split(' ')[0] : 'APA')}
                                                                </Badge>
                                                                <Badge className="bg-slate-100 text-slate-500 border-none font-black text-[7px] h-4 px-1.5 rounded uppercase tracking-widest">
                                                                    {emp.employeeCode}
                                                                </Badge>
                                                                <Badge className="bg-indigo-50 text-indigo-500 border-none font-black text-[7px] h-4 px-1.5 rounded uppercase tracking-widest">
                                                                    {emp.designation}
                                                                </Badge>
                                                                <Badge className="bg-slate-50 text-slate-400 border-none font-black text-[7px] h-4 px-1.5 rounded uppercase tracking-widest">
                                                                    {emp.location}
                                                                </Badge>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className="text-xs font-black text-slate-900">₹{Number(emp.fixedGross || 0).toLocaleString()}</span>
                                                        <p className="text-[7px] font-bold text-slate-400 mt-0.5 uppercase tracking-widest">Fixed Gross</p>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline" className="bg-rose-50 text-rose-600 border-none font-black text-[9px] uppercase tracking-widest px-3 h-6 rounded-lg shadow-xs">
                                                            ₹{Number(emp.dailyCost || 0).toLocaleString()}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-col gap-1.5">
                                                            <span className="text-[10px] font-black text-slate-900">
                                                                {emp.payableDays} <span className="text-slate-400">/ {emp.dynamicDays} Days</span>
                                                            </span>
                                                            <div className="h-1.5 w-full max-w-[80px] bg-slate-100 rounded-full overflow-hidden">
                                                                <div
                                                                    className="h-full bg-[#D9F99D] rounded-full"
                                                                    style={{ width: `${Math.min(100, (Number(emp.payableDays || 0) / Number(emp.dynamicDays || 30)) * 100)}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-black text-emerald-600 italic">
                                                                ₹{Number(emp.generatedPayout || 0).toLocaleString()}
                                                            </span>
                                                            <span className="text-[7px] font-bold text-slate-400 mt-0.5 uppercase tracking-widest">To Date</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="pr-6 text-right">
                                                        <div className="flex flex-col items-end">
                                                            <span className="text-sm font-black text-slate-900 italic">
                                                                ₹{Number(emp.projectedMonthly || 0).toLocaleString()}
                                                            </span>
                                                            <span className="text-[7px] font-bold text-slate-400 mt-0.5 uppercase tracking-widest">Full Month</span>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>
        </ProtectedRoute>
    );
}
