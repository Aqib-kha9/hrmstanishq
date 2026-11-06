"use client";

import { useState, useEffect } from "react";
import {
    BarChart3,
    Users,
    Download,
    Calendar,
    Activity,
    ShieldCheck,
    Search,
    Building2,
    IndianRupee,
    FileSpreadsheet,
    FileText,
    Loader2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { apiGet } from "@/lib/api-client";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────
type ReportType = "payroll" | "attendance" | "statutory" | "branch" | "tour-expenses";

interface CycleOption {
    month: string;       // e.g. "FEBRUARY"
    month_index: number; // 0-indexed
    year: number;
    status: string;
    paid_on: string | null;
}

interface OfficeOption {
    id: number;
    name: string;
    city: string;
}

interface PayrollRow {
    id: number;
    employeeCode: string;
    name: string;
    location: string;
    company: string;
    designation: string;
    fixedGross: number;
    pfApplicable: boolean;
    pfCeiling: boolean;
    esicApplicable: boolean;
    absentDays: number;
    bonus: number;
    previousArrears: number;
    incentive: number;
    loanDeduction: number;
    otherDeduction: number;
    status: string;
    basic: number;
    hra: number;
    other: number;
    proratedGross: number;
    totalEarnings: number;
    pf: number;
    esi: number;
    pt: number;
    grossDeductions: number;
    net: number;
    pfEmployer: number;
    esiEmployer: number;
    totalMonthlyCTC: number;
    payableDays: number;
    workingDays: number;
}

interface PayrollSummary {
    totalStaff: number;
    totalGrossPayout: number;
    totalNetPayout: number;
    totalDeductions: number;
    totalEmployerLiability: number;
    averageAttendance: number;
}

interface PayrollReport {
    cycle: { id: number; month: string; month_index: number; year: number; status: string; paid_on: string | null; } | null;
    workingDays: number;
    elapsedWorkingDays: number;
    summary: PayrollSummary;
    rows: PayrollRow[];
}

interface AttendanceRow {
    id: number;
    employeeCode: string;
    name: string;
    designation: string;
    location: string;
    totalWorkingDays: number;
    elapsedDays: number;
    absentDays: number;
    payableDays: number;
    attendanceRate: number;
    presentDays: number;
    lateDays: number;
    halfDays: number;
    holidayDays: number;
    weekendDays: number;
}

interface AttendanceReport {
    workingDays: number;
    elapsedWorkingDays: number;
    summary: { totalStaff: number; averageAttendance: number; totalAbsentDays: number; };
    rows: AttendanceRow[];
}

interface StatutoryRow {
    id: number;
    employeeCode: string;
    name: string;
    designation: string;
    location: string;
    pfEmployee: number;
    pfEmployer: number;
    esiEmployee: number;
    esiEmployer: number;
    pt: number;
    loanDeduction: number;
    otherDeduction: number;
    totalMonthlyCTC: number;
    grossDeductions: number;
    status: string;
}

interface StatutoryReport {
    workingDays: number;
    summary: {
        totalStaff: number;
        totalPfEmployee: number;
        totalPfEmployer: number;
        totalEsiEmployee: number;
        totalEsiEmployer: number;
        totalPt: number;
        totalCTCLiability: number;
        totalStatutoryDeductions: number;
    };
    rows: StatutoryRow[];
}

interface BranchItem {
    location: string;
    officeName: string;
    headcount: number;
    totalFixedGross: number;
    totalNet: number;
    averageNetPay: number;
    totalPfEmployer: number;
    totalEsiEmployer: number;
    totalCTC: number;
    totalEmployerLiability: number;
}

interface BranchReport {
    workingDays: number;
    summary: {
        totalBranches: number;
        totalHeadcount: number;
        totalNetDisbursed: number;
        totalEmployerLiability: number;
    };
    branches: BranchItem[];
}

interface TourExpenseRow {
    emp_code: string;
    name: string;
    branch: string;
    claim_code: string;
    purpose: string;
    amount: number;
    status: string;
    date: string;
}

interface TourExpenseReport {
    summary: {
        totalClaims: number;
        totalAmount: number;
        approvedAmount: number;
        pendingAmount: number;
    };
    details: TourExpenseRow[];
}

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────
const MONTH_NAMES = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

function formatCycleLabel(monthIndex: number, year: number): string {
    return `${MONTH_NAMES[monthIndex] || "???"} ${year}`;
}

function parseCycleLabel(label: string): { monthIndex: number; year: number } | null {
    const parts = label.split(" ");
    if (parts.length !== 2) return null;
    const idx = MONTH_NAMES.indexOf(parts[0].toUpperCase());
    const year = parseInt(parts[1], 10);
    if (idx === -1 || isNaN(year)) return null;
    return { monthIndex: idx, year };
}

function fmtCurrency(n: number): string {
    return `₹${n.toLocaleString("en-IN")}`;
}

// ────────────────────────────────────────────────────────────
// Page Component
// ────────────────────────────────────────────────────────────
export default function ReportsPage() {
    // ── State ──
    const [selectedReport, setSelectedReport] = useState<ReportType>("payroll");
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedBranch, setSelectedBranch] = useState("All");
    const [selectedCycle, setSelectedCycle] = useState("");

    // Data from API
    const [cycles, setCycles] = useState<CycleOption[]>([]);
    const [offices, setOffices] = useState<OfficeOption[]>([]);
    const [payrollData, setPayrollData] = useState<PayrollReport | null>(null);
    const [attendanceData, setAttendanceData] = useState<AttendanceReport | null>(null);
    const [statutoryData, setStatutoryData] = useState<StatutoryReport | null>(null);
    const [branchData, setBranchData] = useState<BranchReport | null>(null);
    const [tourExpenseData, setTourExpenseData] = useState<TourExpenseReport | null>(null);

    // Loading
    const [loadingCycles, setLoadingCycles] = useState(true);
    const [loadingReport, setLoadingReport] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [retryCount, setRetryCount] = useState(0);

    // ── Fetch cycles & offices on mount ──
    useEffect(() => {
        (async () => {
            try {
                setLoadingCycles(true);
                const [cycleList, officeList] = await Promise.all([
                    apiGet<CycleOption[]>("/reports/cycles"),
                    apiGet<OfficeOption[]>("/reports/offices"),
                ]);
                setCycles(cycleList);
                setOffices(officeList);
                if (cycleList.length > 0) {
                    setSelectedCycle(formatCycleLabel(cycleList[0].month_index, cycleList[0].year));
                }
            } catch (err: any) {
                console.error("Failed to load report config:", err);
                setError("Could not load report cycles. Please try again.");
            } finally {
                setLoadingCycles(false);
            }
        })();
    }, []);

    // ── Parse selected cycle ──
    const parsedCycle = parseCycleLabel(selectedCycle);
    const queryMonth = parsedCycle ? parsedCycle.monthIndex + 1 : new Date().getMonth() + 1;
    const queryYear = parsedCycle ? parsedCycle.year : new Date().getFullYear();
    const queryOfficeId = selectedBranch !== "All" ? offices.find(o => o.name === selectedBranch || o.city === selectedBranch)?.id : undefined;

    // ── Fetch report data when filters change ──
    // ── Fetch report data when filters change ──
    useEffect(() => {
        if (!parsedCycle) return;
        setLoadingReport(true);
        setError(null);

        const params = new URLSearchParams();
        params.set("month", String(queryMonth));
        params.set("year", String(queryYear));
        if (queryOfficeId) params.set("office_id", String(queryOfficeId));
        if (searchQuery.trim()) params.set("search", searchQuery.trim());

        let cancelled = false;

        (async () => {
            try {
                if (selectedReport === "payroll") {
                    const data = await apiGet<PayrollReport>(`/reports/payroll?${params.toString()}`);
                    if (!cancelled) setPayrollData(data);
                } else if (selectedReport === "attendance") {
                    const data = await apiGet<AttendanceReport>(`/reports/attendance?${params.toString()}`);
                    if (!cancelled) setAttendanceData(data);
                } else if (selectedReport === "statutory") {
                    const data = await apiGet<StatutoryReport>(`/reports/statutory?${params.toString()}`);
                    if (!cancelled) setStatutoryData(data);
                } else if (selectedReport === "branch") {
                    const branchParams = new URLSearchParams();
                    branchParams.set("month", String(queryMonth));
                    branchParams.set("year", String(queryYear));
                    const data = await apiGet<BranchReport>(`/reports/branch?${branchParams.toString()}`);
                    if (!cancelled) setBranchData(data);
                } else if (selectedReport === "tour-expenses") {
                    const data = await apiGet<TourExpenseReport>(`/reports/tour-expenses?${params.toString()}`);
                    if (!cancelled) setTourExpenseData(data);
                }
            } catch (err: any) {
                if (!cancelled) {
                    console.error("Failed to load report:", err);
                    setError(err?.message || "Failed to load report data.");
                }
            } finally {
                if (!cancelled) setLoadingReport(false);
            }
        })();

        return () => { cancelled = true; };
    }, [selectedReport, queryMonth, queryYear, queryOfficeId, searchQuery, parsedCycle?.monthIndex, parsedCycle?.year, retryCount]);

    // ── Derived data for summary cards ──
    const summaryCards = (() => {
        if (selectedReport === "payroll" && payrollData) {
            return [
                { label: "Attendance Efficiency", value: `${payrollData.summary.averageAttendance}%`, icon: Activity, color: "bg-[#E0E7FF] text-indigo-600", note: "Optimal Attendance Rate" },
                { label: "Statutory Deductions", value: fmtCurrency(payrollData.summary.totalDeductions), icon: ShieldCheck, color: "bg-[#FEF3C7] text-amber-600", note: "Total Government Liabilities" },
                { label: "Net Disbursed Salaries", value: fmtCurrency(payrollData.summary.totalNetPayout), icon: IndianRupee, color: "bg-[#D1FAE5] text-emerald-600", note: "Direct In-hand Payroll releases" },
                { label: "Workforce Count", value: `${payrollData.summary.totalStaff} Staff`, icon: Users, color: "bg-[#FEE2E2] text-rose-600", note: "Active Employees in Ledger" },
            ];
        }
        if (selectedReport === "attendance" && attendanceData) {
            return [
                { label: "Attendance Efficiency", value: `${attendanceData.summary.averageAttendance}%`, icon: Activity, color: "bg-[#E0E7FF] text-indigo-600", note: "Average Attendance Rate" },
                { label: "Total Absent Days", value: `${attendanceData.summary.totalAbsentDays}`, icon: ShieldCheck, color: "bg-[#FEF3C7] text-amber-600", note: "LWP Days Across Workforce" },
                { label: "Working Days", value: `${attendanceData.workingDays} Days`, icon: IndianRupee, color: "bg-[#D1FAE5] text-emerald-600", note: "Total Billing Days in Cycle" },
                { label: "Workforce Count", value: `${attendanceData.summary.totalStaff} Staff`, icon: Users, color: "bg-[#FEE2E2] text-rose-600", note: "Active Employees Tracked" },
            ];
        }
        if (selectedReport === "statutory" && statutoryData) {
            return [
                { label: "Total PF Liability", value: fmtCurrency(statutoryData.summary.totalPfEmployee + statutoryData.summary.totalPfEmployer), icon: ShieldCheck, color: "bg-[#FEF3C7] text-amber-600", note: "EE + ER Combined" },
                { label: "Total ESI Liability", value: fmtCurrency(statutoryData.summary.totalEsiEmployee + statutoryData.summary.totalEsiEmployer), icon: Activity, color: "bg-[#E0E7FF] text-indigo-600", note: "EE + ER Combined" },
                { label: "Total PT Deduction", value: fmtCurrency(statutoryData.summary.totalPt), icon: IndianRupee, color: "bg-[#D1FAE5] text-emerald-600", note: "Professional Tax Total" },
                { label: "Total CTC Liability", value: fmtCurrency(statutoryData.summary.totalCTCLiability), icon: Users, color: "bg-[#FEE2E2] text-rose-600", note: "Employer Monthly Cost" },
            ];
        }
        if (selectedReport === "branch" && branchData) {
            return [
                { label: "Total Branches", value: `${branchData.summary.totalBranches}`, icon: Building2, color: "bg-[#E0E7FF] text-indigo-600", note: "Active Hubs" },
                { label: "Total Headcount", value: `${branchData.summary.totalHeadcount} Staff`, icon: Users, color: "bg-[#FEE2E2] text-rose-600", note: "Across All Locations" },
                { label: "Net Disbursed", value: fmtCurrency(branchData.summary.totalNetDisbursed), icon: IndianRupee, color: "bg-[#D1FAE5] text-emerald-600", note: "Total In-Hand Payroll" },
                { label: "Employer Liability", value: fmtCurrency(branchData.summary.totalEmployerLiability), icon: ShieldCheck, color: "bg-[#FEF3C7] text-amber-600", note: "PF+ESI Employer Cost" },
            ];
        }
        if (selectedReport === "tour-expenses" && tourExpenseData) {
            return [
                { label: "Total Claims", value: `${tourExpenseData.summary.totalClaims}`, icon: FileText, color: "bg-[#E0E7FF] text-indigo-600", note: "Submitted Claims" },
                { label: "Total Claimed Amount", value: fmtCurrency(tourExpenseData.summary.totalAmount), icon: IndianRupee, color: "bg-[#FEF3C7] text-amber-600", note: "Overall Requested" },
                { label: "Approved Disbursals", value: fmtCurrency(tourExpenseData.summary.approvedAmount), icon: ShieldCheck, color: "bg-[#D1FAE5] text-emerald-600", note: "Approved Amounts" },
                { label: "Pending Claims", value: fmtCurrency(tourExpenseData.summary.pendingAmount), icon: Activity, color: "bg-[#FEE2E2] text-rose-600", note: "Pending Review" },
            ];
        }
        return [
            { label: "Loading...", value: "--", icon: Activity, color: "bg-slate-100 text-slate-400", note: "Fetching report data" },
            { label: "Loading...", value: "--", icon: ShieldCheck, color: "bg-slate-100 text-slate-400", note: "Fetching report data" },
            { label: "Loading...", value: "--", icon: IndianRupee, color: "bg-slate-100 text-slate-400", note: "Fetching report data" },
            { label: "Loading...", value: "--", icon: Users, color: "bg-slate-100 text-slate-400", note: "Fetching report data" },
        ];
    })();

    // ── Export: Excel ──
    const handleExportExcel = () => {
        let sheetData: any[] = [];
        const filename = `HRMS_Report_${selectedReport}_${selectedCycle.replace(/\s/g, "_")}.xlsx`;

        if (selectedReport === "payroll" && payrollData) {
            sheetData = payrollData.rows.map(r => ({
                "Employee Code": r.employeeCode,
                "Name": r.name,
                "Designation": r.designation,
                "Location/Branch": r.location,
                "Company": r.company,
                "Base CTC (₹)": r.fixedGross,
                "Prorated Gross (₹)": r.proratedGross,
                "Total Earnings (₹)": r.totalEarnings,
                "Statutory Deductions (₹)": r.grossDeductions,
                "Net In-Hand Payable (₹)": r.net,
                "Status": r.status,
            }));
        } else if (selectedReport === "attendance" && attendanceData) {
            sheetData = attendanceData.rows.map(r => ({
                "Employee Code": r.employeeCode,
                "Name": r.name,
                "Designation": r.designation,
                "Location/Branch": r.location,
                "Total Working Days": r.totalWorkingDays,
                "Absent Days (LWP)": r.absentDays,
                "Payable Days": r.payableDays,
                "Attendance Rate (%)": r.attendanceRate,
            }));
        } else if (selectedReport === "statutory" && statutoryData) {
            sheetData = statutoryData.rows.map(r => ({
                "Employee Code": r.employeeCode,
                "Name": r.name,
                "Employee PF (₹)": r.pfEmployee,
                "Employer PF (₹)": r.pfEmployer,
                "Employee ESI (₹)": r.esiEmployee,
                "Employer ESI (₹)": r.esiEmployer,
                "Professional Tax (₹)": r.pt,
                "Loan Deduction (₹)": r.loanDeduction,
                "Other Deduction (₹)": r.otherDeduction,
                "Total CTC Cost (₹)": r.totalMonthlyCTC,
            }));
        } else if (selectedReport === "branch" && branchData) {
            sheetData = branchData.branches.map(b => ({
                "Branch / Hub Location": b.location,
                "Office Name": b.officeName,
                "Total Headcount": b.headcount,
                "Total Fixed Salaries (₹)": b.totalFixedGross,
                "Total In-Hand Disbursed (₹)": b.totalNet,
                "Average Net Pay (₹)": b.averageNetPay,
                "Employer PF (₹)": b.totalPfEmployer,
                "Employer ESI (₹)": b.totalEsiEmployer,
                "Total CTC (₹)": b.totalCTC,
            }));
        } else if (selectedReport === "tour-expenses" && tourExpenseData) {
            sheetData = tourExpenseData.details.map(r => ({
                "Employee Code": r.emp_code,
                "Name": r.name,
                "Branch": r.branch,
                "Claim Code": r.claim_code,
                "Purpose": r.purpose,
                "Amount (₹)": r.amount,
                "Status": r.status,
                "Date": new Date(r.date).toLocaleDateString(),
            }));
        }

        if (sheetData.length === 0) return;
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(sheetData);
        XLSX.utils.book_append_sheet(wb, ws, "Business Report");
        XLSX.writeFile(wb, filename);
    };

    // ── Export: PDF ──
    const handleExportPDF = () => {
        const doc = new jsPDF();
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(16);
        doc.text("HRMS BUSINESS REPORT CENTER", 14, 18);
        doc.setFontSize(10);
        doc.setFont("Helvetica", "normal");
        doc.text(`Report Type: ${selectedReport.toUpperCase()} | Cycle: ${selectedCycle}`, 14, 25);
        doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 30);

        let headers: string[] = [];
        let body: any[] = [];

        if (selectedReport === "payroll" && payrollData) {
            headers = ["Code", "Employee Name", "Branch", "Base CTC", "Gross", "Deductions", "Net Pay"];
            body = payrollData.rows.map(r => [
                r.employeeCode, r.name, r.location,
                fmtCurrency(r.fixedGross), fmtCurrency(r.proratedGross),
                fmtCurrency(r.grossDeductions), fmtCurrency(r.net),
            ]);
        } else if (selectedReport === "attendance" && attendanceData) {
            headers = ["Code", "Employee Name", "Designation", "LWP Days", "Active Days", "Rate %"];
            body = attendanceData.rows.map(r => [
                r.employeeCode, r.name, r.designation,
                r.absentDays, r.payableDays, `${r.attendanceRate}%`,
            ]);
        } else if (selectedReport === "statutory" && statutoryData) {
            headers = ["Name", "EE PF", "ER PF", "EE ESI", "ER ESI", "PT", "Net CTC"];
            body = statutoryData.rows.map(r => [
                r.name, fmtCurrency(r.pfEmployee), fmtCurrency(r.pfEmployer),
                fmtCurrency(r.esiEmployee), fmtCurrency(r.esiEmployer),
                fmtCurrency(r.pt), fmtCurrency(r.totalMonthlyCTC),
            ]);
        } else if (selectedReport === "branch" && branchData) {
            headers = ["Branch Location", "Headcount", "Total CTC", "Disbursed Net", "Avg Net Pay"];
            body = branchData.branches.map(b => [
                b.location, b.headcount,
                fmtCurrency(b.totalCTC), fmtCurrency(b.totalNet),
                fmtCurrency(b.averageNetPay),
            ]);
        } else if (selectedReport === "tour-expenses" && tourExpenseData) {
            headers = ["Claim Code", "Employee", "Branch", "Purpose", "Amount", "Status"];
            body = tourExpenseData.details.map(r => [
                r.claim_code, r.name, r.branch, r.purpose,
                fmtCurrency(r.amount), r.status
            ]);
        }

        if (body.length === 0) return;
        autoTable(doc, {
            head: [headers],
            body,
            startY: 38,
            theme: "striped",
            styles: { fontSize: 8, font: "Helvetica", fontStyle: "normal" },
            headStyles: { fillColor: [15, 23, 42] },
        });
        doc.save(`HRMS_Report_${selectedReport}_${selectedCycle.replace(/\s/g, "_")}.pdf`);
    };

    // ── Render ──
    return (
        <ProtectedRoute module="REPORTS" action="READ">
        <div className="space-y-8 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-2">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 flex items-center gap-3 italic uppercase tracking-tighter underline underline-offset-8 decoration-[#D9F99D] decoration-4">
                        <BarChart3 className="h-7 w-7 text-indigo-500" /> Business Reports
                    </h1>
                    <p className="text-[10px] font-black text-slate-400 mt-4 uppercase tracking-[0.3em] leading-loose">
                        Production-grade compliance analytics, workforce performance & complete financial data.
                    </p>
                </div>

                {/* Global Controls */}
                <div className="flex items-center gap-3 bg-slate-50 p-1.5 rounded-2xl border border-slate-100 shadow-sm shrink-0">
                    <div className="flex items-center gap-1.5 px-3">
                        <Calendar className="h-4 w-4 text-slate-400" />
                        {loadingCycles ? (
                            <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                        ) : (
                            <select
                                value={selectedCycle}
                                onChange={(e) => setSelectedCycle(e.target.value)}
                                className="bg-transparent border-none text-[10px] font-black uppercase tracking-wider text-slate-700 focus:outline-none cursor-pointer"
                            >
                                {cycles.map((c, i) => (
                                    <option key={i} value={formatCycleLabel(c.month_index, c.year)}>
                                        {formatCycleLabel(c.month_index, c.year)}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>
                    <div className="h-4 w-[1px] bg-slate-200" />
                    <Button
                        onClick={handleExportExcel}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[8px] tracking-widest px-4 h-9 rounded-xl flex items-center gap-1.5 transition-all shadow-sm"
                    >
                        <FileSpreadsheet className="h-3.5 w-3.5" /> XLS Export
                    </Button>
                    <Button
                        onClick={handleExportPDF}
                        className="bg-slate-900 hover:bg-black text-white font-black uppercase text-[8px] tracking-widest px-4 h-9 rounded-xl flex items-center gap-1.5 transition-all shadow-sm"
                    >
                        <FileText className="h-3.5 w-3.5" /> PDF Export
                    </Button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 px-2">
                {summaryCards.map((stat, i) => (
                    <Card key={i} className="border-none rounded-2xl p-6 shadow-sm bg-white flex flex-col justify-between h-36 group hover:shadow-md transition-all">
                        <div className="flex items-center justify-between">
                            <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center font-bold", stat.color)}>
                                <stat.icon className="h-5 w-5" />
                            </div>
                            <span className="text-[7.5px] font-black uppercase text-slate-400 tracking-widest select-none">{stat.note}</span>
                        </div>
                        <div>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
                            <h3 className="text-2xl font-black text-slate-900 italic tracking-tighter mt-1">{stat.value}</h3>
                        </div>
                    </Card>
                ))}
            </div>

            {/* Report Selector + Table */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start px-2">
                {/* Sidebar Selectors */}
                <div className="lg:col-span-3 space-y-3">
                    <p className="text-[8.5px] font-black uppercase tracking-[0.2em] text-slate-400 pl-1">Available Reports</p>
                    <div className="flex flex-col gap-2">
                        {([
                            { id: "payroll", label: "Payroll & CTC breakdown", desc: "Detailed CTC, Gross, Deductions and Net payable." },
                            { id: "attendance", label: "Attendance & LWP Log", desc: "Leaves, working days, active billing hours." },
                            { id: "statutory", label: "Statutory & Deductions", desc: "Employee & Employer PF/ESI liabilities breakdown." },
                            { id: "branch", label: "Branch Operations split", desc: "CTC distribution, salaries and headcounts per branch." },
                            { id: "tour-expenses", label: "Tour Expenses", desc: "Travel claims, approvals, and reimbursements." },
                        ] as { id: ReportType; label: string; desc: string }[]).map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setSelectedReport(tab.id)}
                                className={cn(
                                    "w-full text-left p-4 rounded-2xl transition-all border outline-none flex flex-col gap-1.5",
                                    selectedReport === tab.id
                                        ? "bg-slate-900 border-slate-900 text-white shadow-md scale-[1.01]"
                                        : "bg-white border-slate-100 hover:bg-slate-50 text-slate-700"
                                )}
                            >
                                <span className={cn(
                                    "text-[10px] font-black uppercase tracking-wider",
                                    selectedReport === tab.id ? "text-[#D9F99D]" : "text-slate-900"
                                )}>
                                    {tab.label}
                                </span>
                                <span className={cn(
                                    "text-[8.5px] font-medium leading-relaxed",
                                    selectedReport === tab.id ? "text-slate-300" : "text-slate-400"
                                )}>
                                    {tab.desc}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Main Table */}
                <Card className="lg:col-span-9 border-none shadow-sm rounded-2xl bg-white overflow-hidden p-1">
                    <CardHeader className="p-6 pb-4 border-none flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                        <div>
                            <CardTitle className="text-base font-black italic text-slate-900 underline underline-offset-4 decoration-[#D9F99D] decoration-2 uppercase tracking-tighter">
                                {selectedReport === "payroll" && "Payroll CTC Details Ledger"}
                                {selectedReport === "attendance" && "Attendance & LWP Statistics"}
                                {selectedReport === "statutory" && "Statutory Deductions & Liabilities"}
                                {selectedReport === "branch" && "Branch CTC Allocation & Headcounts"}
                                {selectedReport === "tour-expenses" && "Tour Expenses & Claims Ledger"}
                            </CardTitle>
                            <CardDescription className="text-[8px] font-black text-slate-400 mt-4 uppercase tracking-[0.25em] italic">
                                {loadingReport ? "Fetching live data from server..." : "Live calculation from payroll engine"}
                            </CardDescription>
                        </div>

                        {/* Search + Branch Filter */}
                        {selectedReport !== "branch" && (
                            <div className="flex items-center gap-3 bg-slate-50 p-1.5 rounded-2xl border border-slate-100 shadow-inner">
                                <div className="relative min-w-[160px] group">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                                    <Input
                                        placeholder="Search Employee..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="h-9 pl-9 pr-3 rounded-xl bg-white border-none shadow-sm font-bold text-[9px] focus:ring-2 ring-indigo-100"
                                    />
                                </div>
                                <select
                                    value={selectedBranch}
                                    onChange={(e) => setSelectedBranch(e.target.value)}
                                    className="h-9 px-3 rounded-xl bg-white border-none shadow-sm font-black uppercase text-[8px] tracking-wider text-slate-700 focus:outline-none cursor-pointer"
                                >
                                    <option value="All">All Hubs</option>
                                    {offices.map(o => (
                                        <option key={o.id} value={o.name}>{o.name} ({o.city})</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </CardHeader>

                    <CardContent className="p-0">
                        {loadingReport && (
                            <div className="flex items-center justify-center py-24">
                                <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
                            </div>
                        )}

                        {error && !loadingReport && (
                            <div className="flex flex-col items-center justify-center py-24 gap-3">
                                <p className="text-xs font-bold text-rose-500 uppercase tracking-wider">{error}</p>
                                <Button onClick={() => setRetryCount(c => c + 1)} variant="outline" className="text-[9px] uppercase tracking-widest">Retry</Button>
                            </div>
                        )}

                        {!loadingReport && !error && (
                            <Table>
                                {/* ── Payroll Table ── */}
                                {selectedReport === "payroll" && payrollData && (
                                    <>
                                        <TableHeader>
                                            <TableRow className="border-none hover:bg-transparent">
                                                <TableHead className="pl-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Employee</TableHead>
                                                <TableHead className="py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Designation</TableHead>
                                                <TableHead className="py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Base gross ctc</TableHead>
                                                <TableHead className="py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Prorated Gross</TableHead>
                                                <TableHead className="py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Statutory</TableHead>
                                                <TableHead className="pr-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Net Payable</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {payrollData.rows.map((r) => (
                                                <TableRow key={r.id} className="border-b border-dashed border-slate-50 last:border-none h-16 hover:bg-slate-50/40 transition-colors">
                                                    <TableCell className="pl-6">
                                                        <div className="flex flex-col">
                                                            <span className="text-xs font-black text-slate-900 uppercase tracking-tight">{r.name}</span>
                                                            <span className="text-[7.5px] font-bold text-slate-400 mt-0.5 uppercase tracking-wider">{r.employeeCode} | {r.company}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge className="bg-indigo-50 text-indigo-600 border-none font-black text-[7px] h-4.5 px-2 rounded-md uppercase tracking-widest">{r.designation}</Badge>
                                                    </TableCell>
                                                    <TableCell className="text-xs font-black text-slate-900">{fmtCurrency(r.fixedGross)}</TableCell>
                                                    <TableCell className="text-xs font-bold text-slate-600">{fmtCurrency(r.proratedGross)}</TableCell>
                                                    <TableCell className="text-[10px] font-bold text-rose-500">{fmtCurrency(r.grossDeductions)}</TableCell>
                                                    <TableCell className="pr-6 text-right text-xs font-black text-emerald-600 italic">{fmtCurrency(r.net)}</TableCell>
                                                </TableRow>
                                            ))}
                                            {payrollData.rows.length === 0 && (
                                                <TableRow>
                                                    <TableCell colSpan={6} className="text-center py-16 text-[10px] font-bold text-slate-400 uppercase tracking-widest">No employees found for this cycle.</TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </>
                                )}

                                {/* ── Attendance Table ── */}
                                {selectedReport === "attendance" && attendanceData && (
                                    <>
                                        <TableHeader>
                                            <TableRow className="border-none hover:bg-transparent">
                                                <TableHead className="pl-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Employee Details</TableHead>
                                                <TableHead className="py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Total cycle days</TableHead>
                                                <TableHead className="py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Absent Days (LWP)</TableHead>
                                                <TableHead className="py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Payable Days</TableHead>
                                                <TableHead className="pr-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Attendance rate</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {attendanceData.rows.map((r) => (
                                                <TableRow key={r.id} className="border-b border-dashed border-slate-50 last:border-none h-16 hover:bg-slate-50/40 transition-colors">
                                                    <TableCell className="pl-6">
                                                        <div className="flex flex-col">
                                                            <span className="text-xs font-black text-slate-900 uppercase tracking-tight">{r.name}</span>
                                                            <span className="text-[7.5px] font-bold text-slate-400 mt-0.5 uppercase tracking-wider">{r.designation} | {r.location}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-xs font-black text-slate-900">{r.totalWorkingDays} Days</TableCell>
                                                    <TableCell className="text-xs font-black text-rose-500">{r.absentDays} Days</TableCell>
                                                    <TableCell className="text-xs font-black text-slate-600">{r.payableDays} Days</TableCell>
                                                    <TableCell className="pr-6 text-right">
                                                        <Badge className={cn(
                                                            "border-none font-black text-[8px] uppercase tracking-widest px-2.5 h-5 rounded-md shadow-sm",
                                                            r.attendanceRate > 90 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-500"
                                                        )}>
                                                            {r.attendanceRate}%
                                                        </Badge>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                            {attendanceData.rows.length === 0 && (
                                                <TableRow>
                                                    <TableCell colSpan={5} className="text-center py-16 text-[10px] font-bold text-slate-400 uppercase tracking-widest">No attendance data for this cycle.</TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </>
                                )}

                                {/* ── Statutory Table ── */}
                                {selectedReport === "statutory" && statutoryData && (
                                    <>
                                        <TableHeader>
                                            <TableRow className="border-none hover:bg-transparent">
                                                <TableHead className="pl-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Employee</TableHead>
                                                <TableHead className="py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">PF EE / ER</TableHead>
                                                <TableHead className="py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">ESI EE / ER</TableHead>
                                                <TableHead className="py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Prof Tax (PT)</TableHead>
                                                <TableHead className="py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Other Deductions</TableHead>
                                                <TableHead className="pr-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Total CTC Cost</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {statutoryData.rows.map((r) => (
                                                <TableRow key={r.id} className="border-b border-dashed border-slate-50 last:border-none h-16 hover:bg-slate-50/40 transition-colors">
                                                    <TableCell className="pl-6">
                                                        <div className="flex flex-col">
                                                            <span className="text-xs font-black text-slate-900 uppercase tracking-tight">{r.name}</span>
                                                            <span className="text-[7.5px] font-bold text-slate-400 mt-0.5 uppercase tracking-wider">{r.employeeCode}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-col gap-0.5">
                                                            <span className="text-[9px] font-black text-slate-900">{fmtCurrency(r.pfEmployee)} <span className="text-slate-400 font-medium">EE</span></span>
                                                            <span className="text-[7.5px] text-slate-500 font-bold">{fmtCurrency(r.pfEmployer)} <span className="text-slate-400 font-medium">ER</span></span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-col gap-0.5">
                                                            <span className="text-[9px] font-black text-slate-900">{fmtCurrency(r.esiEmployee)} <span className="text-slate-400 font-medium">EE</span></span>
                                                            <span className="text-[7.5px] text-slate-500 font-bold">{fmtCurrency(r.esiEmployer)} <span className="text-slate-400 font-medium">ER</span></span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-xs font-bold text-slate-600">{fmtCurrency(r.pt)}</TableCell>
                                                    <TableCell className="text-xs font-bold text-rose-500">{fmtCurrency(r.loanDeduction + r.otherDeduction)}</TableCell>
                                                    <TableCell className="pr-6 text-right text-xs font-black text-indigo-600 italic">{fmtCurrency(r.totalMonthlyCTC)}</TableCell>
                                                </TableRow>
                                            ))}
                                            {statutoryData.rows.length === 0 && (
                                                <TableRow>
                                                    <TableCell colSpan={6} className="text-center py-16 text-[10px] font-bold text-slate-400 uppercase tracking-widest">No statutory data for this cycle.</TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </>
                                )}

                                {/* ── Branch Table ── */}
                                {selectedReport === "branch" && branchData && (
                                    <>
                                        <TableHeader>
                                            <TableRow className="border-none hover:bg-transparent">
                                                <TableHead className="pl-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Branch Location</TableHead>
                                                <TableHead className="py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Headcount</TableHead>
                                                <TableHead className="py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Monthly Gross Budget</TableHead>
                                                <TableHead className="py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Total Statutory Liabilities</TableHead>
                                                <TableHead className="pr-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Avg net pay</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {branchData.branches.map((b, idx) => (
                                                <TableRow key={idx} className="border-b border-dashed border-slate-50 last:border-none h-16 hover:bg-slate-50/40 transition-colors">
                                                    <TableCell className="pl-6">
                                                        <div className="flex items-center gap-2">
                                                            <Building2 className="h-4 w-4 text-indigo-500" />
                                                            <span className="text-xs font-black text-slate-900 uppercase tracking-wider">{b.location} Hub / Depot</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-xs font-black text-slate-900">{b.headcount} Staff</TableCell>
                                                    <TableCell className="text-xs font-black text-slate-600">{fmtCurrency(b.totalFixedGross)}</TableCell>
                                                    <TableCell className="text-xs font-black text-amber-600">{fmtCurrency(b.totalEmployerLiability)}</TableCell>
                                                    <TableCell className="pr-6 text-right text-xs font-black text-emerald-600 italic">{fmtCurrency(b.averageNetPay)}</TableCell>
                                                </TableRow>
                                            ))}
                                            {branchData.branches.length === 0 && (
                                                <TableRow>
                                                    <TableCell colSpan={5} className="text-center py-16 text-[10px] font-bold text-slate-400 uppercase tracking-widest">No branch data for this cycle.</TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </>
                                )}

                                {/* ── Tour Expenses Table ── */}
                                {selectedReport === "tour-expenses" && tourExpenseData && (
                                    <>
                                        <TableHeader>
                                            <TableRow className="border-none hover:bg-transparent">
                                                <TableHead className="pl-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Claim Code / Date</TableHead>
                                                <TableHead className="py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Employee Details</TableHead>
                                                <TableHead className="py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Purpose</TableHead>
                                                <TableHead className="py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Status</TableHead>
                                                <TableHead className="pr-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Claim Amount</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {tourExpenseData.details.map((r, idx) => (
                                                <TableRow key={idx} className="border-b border-dashed border-slate-50 last:border-none h-16 hover:bg-slate-50/40 transition-colors">
                                                    <TableCell className="pl-6">
                                                        <div className="flex flex-col">
                                                            <span className="text-xs font-black text-slate-900 uppercase tracking-wider">{r.claim_code}</span>
                                                            <span className="text-[7.5px] font-bold text-slate-400 mt-0.5 uppercase tracking-wider">{new Date(r.date).toLocaleDateString()}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-col">
                                                            <span className="text-[10px] font-black text-slate-900 uppercase tracking-wider">{r.name}</span>
                                                            <span className="text-[7.5px] text-slate-500 font-bold uppercase">{r.emp_code} | {r.branch}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-[10px] font-medium text-slate-600 max-w-[200px] truncate" title={r.purpose}>
                                                        {r.purpose}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge className={cn(
                                                            "border-none font-black text-[7px] uppercase tracking-widest px-2.5 h-5 rounded-md shadow-sm",
                                                            r.status === 'approved' ? "bg-emerald-50 text-emerald-600" :
                                                            r.status === 'rejected' ? "bg-rose-50 text-rose-500" :
                                                            "bg-amber-50 text-amber-600"
                                                        )}>
                                                            {r.status}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="pr-6 text-right text-xs font-black text-indigo-600 italic">{fmtCurrency(r.amount)}</TableCell>
                                                </TableRow>
                                            ))}
                                            {tourExpenseData.details.length === 0 && (
                                                <TableRow>
                                                    <TableCell colSpan={5} className="text-center py-16 text-[10px] font-bold text-slate-400 uppercase tracking-widest">No tour expenses for this cycle.</TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </>
                                )}
                            </Table>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
        </ProtectedRoute>
    );
}
