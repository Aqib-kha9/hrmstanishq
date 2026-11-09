"use client";

import { useRole } from "@/context/RoleContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
    User,
    Mail,
    Smartphone,
    MapPin,
    Calendar,
    ShieldCheck,
    Briefcase,
    Banknote,
    FileText,
    ArrowLeft,
    Edit3,
    TrendingUp,
    Clock,
    Award,
    Download,
    ExternalLink,
    Activity,
    Trash2,
    Power,
    PowerOff,
    Loader2,
    CheckCircle2,
    AlertCircle,
    Building2,
    CreditCard,
    Calculator,
    Percent,
    Receipt,
    FileCheck,
    Compass,
    Sparkles,
    History,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { apiGet, apiDelete, apiPatch } from "@/lib/api-client";
import { toFrontendEmployee, type BackendEmployee, type FrontendEmployee } from "@/lib/transform";

// ── Types ──

interface SalaryStructure {
    id: number;
    employee_id: number;
    fixed_gross: number | string;
    basic_salary: number | string;
    hra: number | string;
    special_allowance: number | string;
    other_allowance: number | string;
    conveyance: number | string;
    medical_allowance: number | string;
    performance_allowance?: number | string;
    annual_ctc?: number | string;
    hra_applicable?: boolean;
    pf_applicable: boolean;
    pf_ceiling: boolean;
    pf_contribution_mode: string | null;
    pf_employee_rate?: number | string;
    pf_employer_rate?: number | string;
    esic_applicable: boolean;
    esic_contribution_mode: string | null;
    esic_employee_rate?: number | string;
    esic_employer_rate?: number | string;
    pt_applicable: boolean;
    effective_work_days: number;
    effective_from: string;
    effective_to: string | null;
}

interface SalaryResponse {
    current: SalaryStructure | null;
    history: SalaryStructure[];
    revisions: unknown[];
}

interface DocumentItem {
    id: number;
    employee_id: number;
    name: string;
    type: string;
    file_path: string;
    file_size: number;
    mime_type: string;
    status: string;
    verified_by: number | null;
    verified_at: string | null;
}

interface PerformanceReview {
    id: number;
    employee_id: number;
    review_period: string;
    overall_score: number;
    delivery_score: number;
    quality_score: number;
    learning_score: number;
    rating: string;
    comments: string | null;
    reviewed_by: number;
    reviewed_at: string;
    status: string;
    reviewer?: { id: number; name: string } | null;
}

interface LeaveBalance {
    id: number;
    employee_id: number;
    year?: number;
    cl_allocated?: number | string;
    cl_used?: number | string;
    el_allocated?: number | string;
    el_carried_forward?: number | string;
    el_used?: number | string;
    available: number;
    used: number;
    admin_granted: number;
    lapsed: number;
    last_accrual_month: string | null;
    consecutive_no_usage_months: number;
}

interface MonthlyAttendanceRecord {
    id: number;
    employee_id: number;
    month: number;
    year: number;
    present_days: number;
    absent_days: number;
    late_days: number;
    half_days: number;
    holiday_days: number;
    weekend_days: number;
    tour_days?: number;
    total_working_days: number;
    attendance_percentage: number;
}

interface DailyAttendanceRecord {
    id: string | number;
    date: string;
    status: string;
    check_in_time?: string | null;
    check_out_time?: string | null;
    total_hours?: number;
    remarks?: string;
}

interface AttendanceStats {
    monthly: MonthlyAttendanceRecord | null;
    daily: DailyAttendanceRecord[];
}

// ── Helpers ──

const formatDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return "N/A";
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return String(dateStr);
        return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    } catch {
        return String(dateStr);
    }
};

const formatCurrency = (amount: number | string | null | undefined): string => {
    const num = Number(amount);
    if (amount == null || isNaN(num)) return "₹0.00";
    return "₹" + num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatDocType = (type: string): string => {
    const map: Record<string, string> = {
        id_proof: "ID Proof (Aadhaar / Passport)",
        pan_card: "PAN Card",
        aadhaar_card: "Aadhaar Card",
        bank_proof: "Bank Proof (Passbook / Cheque)",
        address_proof: "Address Proof",
        certificate: "Educational Certificate",
        offer_letter: "Offer Letter",
        contract: "Employment Contract",
        photo: "Candidate Photograph",
        other: "Supporting Document",
    };
    return map[type.toLowerCase()] || type.replace(/_/g, " ").toUpperCase();
};

const getDocumentUrl = (filePath?: string): string => {
    if (!filePath) return "";
    if (filePath.startsWith("http://") || filePath.startsWith("https://") || filePath.startsWith("data:")) {
        return filePath;
    }
    const backendBase = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000")
        .replace(/\/api\/v1\/?$/, "")
        .replace(/\/+$/, "");
    const clean = filePath.startsWith("/") ? filePath : `/${filePath}`;
    return `${backendBase}${clean}`;
};

const starRating = (score: number): number[] => {
    const full = Math.floor(score);
    const partial = score - full >= 0.5 ? 1 : 0;
    return Array.from({ length: 5 }, (_, i) => (i < full ? 2 : i < full + partial ? 1 : 0));
};

// ── Calculation Engines ──

interface SalaryComputation {
    monthlyGross: number;
    annualCtc: number;
    basic: number;
    hra: number;
    other: number;
    earnings: { component: string; amount: number; description: string }[];
    deductions: { component: string; amount: number; rate: string; note: string }[];
    totalDeductions: number;
    netTakeHomeMonthly: number;
    netTakeHomeAnnual: number;
    employerContributions: { component: string; amount: number; rate: string; note: string }[];
    totalEmployerCost: number;
    complianceBadges: { label: string; active: boolean; detail: string }[];
}

function computeSalaryMetrics(
    salary: SalaryStructure | null | undefined,
    rawEmp: BackendEmployee | null | undefined
): SalaryComputation | null {
    const gross = Number(salary?.fixed_gross ?? rawEmp?.fixed_gross ?? 0);
    if (!gross || gross <= 0) return null;

    // 1. Earnings Breakdown (Req 2.4: 50% Basic Salary, Optional HRA, Allowances)
    const basic = Number(salary?.basic_salary ?? rawEmp?.basic_salary ?? Math.round(gross * 0.5));
    const hraApplicable = salary?.hra_applicable !== false && (rawEmp as any)?.hra_applicable !== false;
    const hra = hraApplicable ? Number(salary?.hra ?? Math.round(basic * 0.4)) : 0;
    const special = Number(salary?.special_allowance ?? 0);
    const conveyance = Number(salary?.conveyance ?? 0);
    const medical = Number(salary?.medical_allowance ?? 0);
    const performance = Number(salary?.performance_allowance ?? (rawEmp as any)?.performance_allowance ?? 0);

    let other = Number(salary?.other_allowance ?? 0);
    const remaining = gross - (basic + hra + special + conveyance + medical + performance);
    if (!salary?.other_allowance && remaining > 0) {
        other = remaining;
    }

    const earnings = [
        { component: "Basic Salary", amount: basic, description: "Core base wage (50% of Gross CTC per Req 2.4)" },
        ...(hraApplicable ? [{ component: "House Rent Allowance (HRA)", amount: hra, description: "Housing allowance (40% of Basic Salary)" }] : []),
        ...(!hraApplicable ? [{ component: "House Rent Allowance (HRA)", amount: 0, description: "Exempt / Disabled for this profile (Req 2.4)" }] : []),
        ...(conveyance > 0 ? [{ component: "Conveyance Allowance", amount: conveyance, description: "Commute & transit allowance" }] : []),
        ...(medical > 0 ? [{ component: "Medical Allowance", amount: medical, description: "Healthcare allowance" }] : []),
        ...(special > 0 ? [{ component: "Special Allowance", amount: special, description: "Role / competency incentive" }] : []),
        ...(performance > 0 ? [{ component: "Performance Allowance", amount: performance, description: "Performance incentive (Req 2.4)" }] : []),
        ...(other > 0 ? [{ component: "Other Allowances", amount: other, description: "Flexible balancing allowance" }] : []),
    ];

    // 2. Statutory Employee Deductions
    const pfApplicable = Boolean(salary?.pf_applicable ?? rawEmp?.pf_applicable);
    const pfCeiling = Boolean(salary?.pf_ceiling ?? rawEmp?.pf_ceiling);
    const pfEmployeeRate = Number(salary?.pf_employee_rate ?? 0.12);

    let pfEmployee = 0;
    let pfNote = "Exempt / Opted out";
    if (pfApplicable) {
        const pfWage = pfCeiling ? Math.min(basic, 15000) : basic;
        pfEmployee = Math.round(pfWage * pfEmployeeRate);
        pfNote = pfCeiling ? "12% of Basic (Statutory cap ₹15,000)" : "12% of actual Basic";
    }

    const esicApplicable = Boolean(salary?.esic_applicable ?? rawEmp?.esic_applicable);
    const esicEmployeeRate = Number(salary?.esic_employee_rate ?? 0.0075);
    let esicEmployee = 0;
    let esicNote = "Not applicable (Gross > ₹21,000)";
    if (esicApplicable && gross <= 21000) {
        esicEmployee = Math.ceil(gross * esicEmployeeRate);
        esicNote = "0.75% of Gross (Statutory ceiling ₹21,000)";
    } else if (esicApplicable && gross > 21000) {
        esicNote = "Exempt: Gross exceeds ₹21,000 threshold";
    }

    const ptApplicable = salary?.pt_applicable ?? true;
    let ptAmount = 0;
    let ptNote = "Exempt";
    if (ptApplicable && gross >= 10000) {
        ptAmount = 200;
        ptNote = "Standard slab (Gross ≥ ₹10,000/mo)";
    }

    const deductions = [
        { component: "Provident Fund (EPF - Employee)", amount: pfEmployee, rate: pfApplicable ? "12%" : "0%", note: pfNote },
        { component: "Employee State Insurance (ESIC)", amount: esicEmployee, rate: (esicApplicable && gross <= 21000) ? "0.75%" : "0%", note: esicNote },
        { component: "Professional Tax (PT)", amount: ptAmount, rate: "Flat", note: ptNote },
    ];

    const totalDeductions = pfEmployee + esicEmployee + ptAmount;
    const netTakeHomeMonthly = Math.max(0, gross - totalDeductions);
    const annualCtc = gross * 12;
    const netTakeHomeAnnual = netTakeHomeMonthly * 12;

    // 3. Employer Statutory Contributions (CTC Inclusions)
    const pfEmployerRate = Number(salary?.pf_employer_rate ?? 0.12);
    let pfEmployer = 0;
    let pfEmployerNote = "Not applicable";
    if (pfApplicable) {
        const pfWage = pfCeiling ? Math.min(basic, 15000) : basic;
        pfEmployer = Math.round(pfWage * pfEmployerRate);
        const epsShare = Math.min(1250, Math.round(pfWage * 0.0833));
        const epfShare = pfEmployer - epsShare;
        pfEmployerNote = `EPS: ₹${epsShare.toLocaleString("en-IN")} (8.33%) + EPF: ₹${epfShare.toLocaleString("en-IN")} (3.67%)`;
    }

    const esicEmployerRate = Number(salary?.esic_employer_rate ?? 0.0325);
    let esicEmployer = 0;
    let esicEmployerNote = "Not applicable";
    if (esicApplicable && gross <= 21000) {
        esicEmployer = Math.ceil(gross * esicEmployerRate);
        esicEmployerNote = "3.25% of Gross (Employer Contribution)";
    }

    const employerContributions = [
        { component: "Employer Provident Fund (PF / EPS)", amount: pfEmployer, rate: pfApplicable ? "12%" : "0%", note: pfEmployerNote },
        ...(esicApplicable && gross <= 21000 ? [{ component: "Employer ESIC Contribution", amount: esicEmployer, rate: "3.25%", note: esicEmployerNote }] : []),
    ];

    const totalEmployerCost = pfEmployer + esicEmployer;

    const complianceBadges = [
        {
            label: "Provident Fund (PF)",
            active: pfApplicable,
            detail: pfApplicable ? (pfCeiling ? "Statutory Capped (₹15k)" : "Full Basic Contributed") : "Exempt / Opt-out",
        },
        {
            label: "ESIC Medical",
            active: esicApplicable && gross <= 21000,
            detail: gross <= 21000 && esicApplicable ? "Active (Gross ≤ ₹21k)" : (gross > 21000 ? "Exempt (> ₹21k Gross)" : "Not Applicable"),
        },
        {
            label: "Professional Tax (PT)",
            active: ptApplicable && gross >= 10000,
            detail: ptApplicable && gross >= 10000 ? "₹200 / Month Standard" : "Exempt",
        },
    ];

    return {
        monthlyGross: gross,
        annualCtc,
        basic,
        hra,
        other,
        earnings,
        deductions,
        totalDeductions,
        netTakeHomeMonthly,
        netTakeHomeAnnual,
        employerContributions,
        totalEmployerCost,
        complianceBadges,
    };
}

interface AttendanceComputation {
    percentage: string;
    label: string;
    presentDays: number;
    workingDays: number;
    halfDays: number;
    absentDays: number;
    tourDays: number;
    weekendDays: number;
    statusBadge: { text: string; color: string };
}

function computeAttendanceStats(stats: AttendanceStats | null | undefined): AttendanceComputation {
    if (stats?.monthly?.attendance_percentage != null) {
        const m = stats.monthly;
        const pctNum = Number(m.attendance_percentage);
        return {
            percentage: `${pctNum.toFixed(1)}%`,
            label: `${m.present_days || 0}/${m.total_working_days || 0} Working Days`,
            presentDays: Number(m.present_days || 0),
            workingDays: Number(m.total_working_days || 0),
            halfDays: Number(m.half_days || 0),
            absentDays: Number(m.absent_days || 0),
            tourDays: Number(m.tour_days || 0),
            weekendDays: Number(m.weekend_days || 0),
            statusBadge: pctNum >= 90
                ? { text: "Excellent", color: "bg-emerald-50 text-emerald-700 border-emerald-200" }
                : pctNum >= 75
                ? { text: "Good", color: "bg-blue-50 text-blue-700 border-blue-200" }
                : { text: "Needs Attention", color: "bg-amber-50 text-amber-700 border-amber-200" },
        };
    }

    const daily = (stats?.daily as any[]) || [];
    if (daily.length === 0) {
        return {
            percentage: "N/A",
            label: "No records this cycle",
            presentDays: 0,
            workingDays: 0,
            halfDays: 0,
            absentDays: 0,
            tourDays: 0,
            weekendDays: 0,
            statusBadge: { text: "Pending", color: "bg-slate-100 text-slate-600 border-slate-200" },
        };
    }

    const working = daily.filter(d => d.status !== 'weekend' && d.status !== 'holiday');
    const presents = daily.filter(d => d.status === 'present').length;
    const tours = daily.filter(d => d.status === 'tour').length;
    const halfs = daily.filter(d => d.status === 'half_day').length;
    const absents = daily.filter(d => d.status === 'absent').length;
    const weekends = daily.filter(d => d.status === 'weekend').length;

    const effectivePresent = presents + tours + (halfs * 0.5);
    const totalWorking = working.length;
    const pct = totalWorking > 0 ? (effectivePresent / totalWorking) * 100 : 0;

    return {
        percentage: `${pct.toFixed(1)}%`,
        label: `${effectivePresent}/${totalWorking} Days Recorded`,
        presentDays: presents,
        workingDays: totalWorking,
        halfDays: halfs,
        absentDays: absents,
        tourDays: tours,
        weekendDays: weekends,
        statusBadge: pct >= 90
            ? { text: "Excellent", color: "bg-emerald-50 text-emerald-700 border-emerald-200" }
            : pct >= 75
            ? { text: "Good", color: "bg-blue-50 text-blue-700 border-blue-200" }
            : pct > 0
            ? { text: "Needs Attention", color: "bg-amber-50 text-amber-700 border-amber-200" }
            : { text: "No Punches", color: "bg-slate-100 text-slate-600 border-slate-200" },
    };
}

interface LeaveComputation {
    totalAvailable: number;
    clAvailable: number;
    clAllocated: number;
    clUsed: number;
    elAvailable: number;
    elAllocated: number;
    elCarriedForward: number;
    elUsed: number;
    adminGranted: number;
    lapsed: number;
    year: number;
}

function computeLeaveMetrics(lb: LeaveBalance | null | undefined): LeaveComputation {
    if (!lb) {
        return {
            totalAvailable: 0,
            clAvailable: 0,
            clAllocated: 0,
            clUsed: 0,
            elAvailable: 0,
            elAllocated: 0,
            elCarriedForward: 0,
            elUsed: 0,
            adminGranted: 0,
            lapsed: 0,
            year: new Date().getFullYear(),
        };
    }
    const clAlloc = Number(lb.cl_allocated || 0);
    const clUsed = Number(lb.cl_used || 0);
    const clAvail = Math.max(0, clAlloc - clUsed);

    const elAlloc = Number(lb.el_allocated || 0);
    const elCarry = Number(lb.el_carried_forward || 0);
    const elUsed = Number(lb.el_used || 0);
    const elAvail = Math.max(0, elAlloc + elCarry - elUsed);

    const total = lb.available != null ? Number(lb.available) : (clAvail + elAvail);

    return {
        totalAvailable: total,
        clAvailable: clAvail,
        clAllocated: clAlloc,
        clUsed: clUsed,
        elAvailable: elAvail,
        elAllocated: elAlloc,
        elCarriedForward: elCarry,
        elUsed: elUsed,
        adminGranted: Number(lb.admin_granted || 0),
        lapsed: Number(lb.lapsed || 0),
        year: Number(lb.year || new Date().getFullYear()),
    };
}

export default function EmployeeProfilePage() {
    const params = useParams();
    const router = useRouter();
    const { hasPermission } = useRole();
    const [employee, setEmployee] = useState<FrontendEmployee | null>(null);
    const [rawEmployee, setRawEmployee] = useState<BackendEmployee | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    // Additional data states
    const [salary, setSalary] = useState<SalaryResponse | null>(null);
    const [documents, setDocuments] = useState<DocumentItem[]>([]);
    const [reviews, setReviews] = useState<PerformanceReview[]>([]);
    const [leaveBalance, setLeaveBalance] = useState<LeaveBalance | null>(null);
    const [attendanceStats, setAttendanceStats] = useState<AttendanceStats | null>(null);

    // ID Card dialog
    const [idCardOpen, setIdCardOpen] = useState(false);

    useEffect(() => {
        async function fetchAll() {
            try {
                setLoading(true);
                const id = params.id as string;

                // Fetch employee + all related data in parallel
                const [be, salaryRes, docsRes, reviewsRes, leaveRes, attendanceRes] = await Promise.allSettled([
                    apiGet<BackendEmployee>(`/employees/${id}`),
                    apiGet<SalaryResponse>(`/employees/${id}/salary`),
                    apiGet<DocumentItem[]>(`/documents/employee/${id}`, { limit: 100 }),
                    apiGet<PerformanceReview[]>(`/performance/employee/${id}/reviews`),
                    apiGet<LeaveBalance>(`/leave/balance/${id}`),
                    apiGet<AttendanceStats>(`/attendance/employee/${id}`),
                ]);

                // Employee (required)
                if (be.status === "fulfilled") {
                    setRawEmployee(be.value);
                    setEmployee(toFrontendEmployee(be.value));
                } else {
                    console.error("Failed to load employee:", be.reason);
                    setEmployee(null);
                    setRawEmployee(null);
                }

                // Optional data
                if (salaryRes.status === "fulfilled") setSalary(salaryRes.value);
                if (docsRes.status === "fulfilled") setDocuments(docsRes.value);
                if (reviewsRes.status === "fulfilled") setReviews(reviewsRes.value);
                if (leaveRes.status === "fulfilled") setLeaveBalance(leaveRes.value);
                if (attendanceRes.status === "fulfilled") setAttendanceStats(attendanceRes.value);
            } catch (err) {
                console.error("Failed to load profile:", err);
                setEmployee(null);
                setRawEmployee(null);
            } finally {
                setLoading(false);
            }
        }
        if (params.id) {
            fetchAll();
        }
    }, [params.id]);

    // ── Computed Calculations ──
    const salaryMetrics = useMemo(() => {
        return computeSalaryMetrics(salary?.current, rawEmployee);
    }, [salary, rawEmployee]);

    const attendanceMetrics = useMemo(() => {
        return computeAttendanceStats(attendanceStats);
    }, [attendanceStats]);

    const leaveMetrics = useMemo(() => {
        return computeLeaveMetrics(leaveBalance);
    }, [leaveBalance]);

    const latestReview = reviews.length > 0 ? reviews[0] : null;
    const reviewScore = latestReview?.overall_score != null ? Number(latestReview.overall_score) : 0;
    const reviewStars = starRating(reviewScore);

    // ── Actions ──
    const handleToggleStatus = async () => {
        if (!employee) return;
        const currentBackendStatus = employee.status === "Active" ? "active" : "inactive";
        const newBackendStatus = currentBackendStatus === "active" ? "inactive" : "active";
        setActionLoading(`Updating status to ${newBackendStatus}...`);
        try {
            await apiPatch(`/employees/${employee.employeeId}/status`, { status: newBackendStatus });
            setEmployee({ ...employee, status: newBackendStatus === "active" ? "Active" : "Inactive" });
        } catch (err: any) {
            console.error("Failed to update status:", err);
            const msg = err.response?.data?.message || err.message || "Failed to update employee status.";
            alert(msg);
        } finally {
            setActionLoading(null);
        }
    };

    const handleDeleteEmployee = async () => {
        if (!employee) return;
        if (!window.confirm(`HARD DELETE ${employee.name} (${employee.id})? This is for TESTING ONLY and cannot be undone.`)) return;
        setActionLoading(`Deleting employee ${employee.name} (${employee.id}). Please wait...`);
        try {
            await apiDelete(`/employees/${employee.employeeId}`);
            router.push("/employees");
        } catch (err: any) {
            console.error("Delete failed:", err);
            const msg = err.response?.data?.message || err.message || "Failed to delete employee.";
            alert(msg);
            setActionLoading(null);
        }
    };

    // ── Loading / Error ──
    if (loading) {
        return (
            <div className="h-[65vh] flex flex-col items-center justify-center space-y-4">
                <div className="h-16 w-16 rounded-3xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-inner">
                    <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                </div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Loading Employee Workspace...</p>
            </div>
        );
    }

    if (!employee) {
        return (
            <div className="h-[65vh] flex flex-col items-center justify-center space-y-4">
                <div className="h-16 w-16 rounded-3xl bg-rose-50 text-rose-600 flex items-center justify-center shadow-inner">
                    <AlertCircle className="h-8 w-8 text-rose-500" />
                </div>
                <h2 className="text-lg font-black text-slate-800 tracking-tight">Employee Not Found</h2>
                <p className="text-xs font-bold text-slate-400 max-w-sm text-center">
                    The requested employee record could not be found or has been permanently deleted.
                </p>
                <Button onClick={() => router.push("/employees")} variant="outline" className="rounded-xl mt-2 font-bold text-xs">
                    Return to Employees List
                </Button>
            </div>
        );
    }

    // Designation fallback
    const designationDisplay = employee.jobTitle || rawEmployee?.designation || "Designation Not Assigned";
    const officeDisplay = employee.location && employee.location !== "Unknown"
        ? employee.location
        : rawEmployee?.office?.name || rawEmployee?.company?.name || "Main Office";
    const joiningDateDisplay = rawEmployee?.date_of_joining
        ? formatDate(rawEmployee.date_of_joining)
        : formatDate(rawEmployee?.created_at);

    return (
        <ProtectedRoute module="EMPLOYEES" action="READ">
            <div className="space-y-8 pb-20 max-w-6xl mx-auto px-4 md:px-0 animate-in fade-in duration-300">
                {/* ── Top Navigation & Action Bar ── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <Button
                        variant="ghost"
                        onClick={() => router.push("/employees")}
                        className="h-10 px-3 rounded-xl gap-2 text-slate-500 hover:text-slate-900 font-bold uppercase tracking-wider text-[11px] w-fit"
                    >
                        <ArrowLeft className="h-4 w-4" /> Back to Employees
                    </Button>

                    <div className="flex flex-wrap items-center gap-2.5">
                        {hasPermission('EMPLOYEES', 'UPDATE') && (
                            <Button
                                onClick={() => router.push(`/onboarding?editId=${employee.employeeId}`)}
                                className="bg-indigo-600 text-white hover:bg-indigo-700 font-black text-[10px] uppercase tracking-widest px-5 h-10 rounded-xl shadow-md transition-all flex items-center gap-2"
                            >
                                <Edit3 className="h-3.5 w-3.5" /> Edit Profile
                            </Button>
                        )}

                        <Button
                            variant="outline"
                            onClick={() => setIdCardOpen(true)}
                            className="h-10 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 font-black text-[10px] uppercase tracking-widest px-4 flex items-center gap-2"
                        >
                            <Download className="h-3.5 w-3.5 text-slate-500" /> ID Card
                        </Button>

                        {hasPermission('EMPLOYEES', 'UPDATE') && (
                            <Button
                                variant="outline"
                                onClick={handleToggleStatus}
                                className={cn(
                                    "h-10 rounded-xl font-black text-[10px] uppercase tracking-widest px-4 flex items-center gap-2 transition-all",
                                    employee.status === "Active"
                                        ? "border-amber-200 text-amber-700 bg-amber-50/50 hover:bg-amber-100/60"
                                        : "border-emerald-200 text-emerald-700 bg-emerald-50/50 hover:bg-emerald-100/60"
                                )}
                            >
                                {employee.status === "Active" ? (
                                    <><PowerOff className="h-3.5 w-3.5" /> Deactivate</>
                                ) : (
                                    <><Power className="h-3.5 w-3.5" /> Activate</>
                                )}
                            </Button>
                        )}

                        {hasPermission('EMPLOYEES', 'DELETE') && (
                            <Button
                                variant="outline"
                                onClick={handleDeleteEmployee}
                                className="h-10 rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50 font-black text-[10px] uppercase tracking-widest px-4 flex items-center gap-2"
                                title="Use Deactivate instead for standard offboarding"
                            >
                                <Trash2 className="h-3.5 w-3.5" /> Hard Delete
                            </Button>
                        )}
                    </div>
                </div>

                {/* ── Profile Header Banner ── */}
                <Card className="border border-slate-200/80 shadow-sm rounded-3xl bg-white overflow-hidden">
                    <div className="h-28 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 w-full relative">
                        <div className="absolute -bottom-12 left-8 h-24 w-24 rounded-2xl bg-white p-1.5 shadow-xl border border-slate-100">
                            <div className={cn(
                                "h-full w-full rounded-xl flex items-center justify-center text-2xl font-black italic uppercase",
                                employee.color === 'blue' ? "bg-blue-50 text-blue-600" :
                                employee.color === 'amber' ? "bg-amber-50 text-amber-600" :
                                employee.color === 'indigo' ? "bg-indigo-50 text-indigo-600" :
                                "bg-emerald-50 text-emerald-600"
                            )}>
                                {employee.name?.slice(0, 2).toUpperCase()}
                            </div>
                        </div>
                    </div>

                    <CardContent className="pt-16 pb-8 px-8">
                        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                            <div className="space-y-2">
                                <div className="flex flex-wrap items-center gap-3">
                                    <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">{employee.name}</h1>
                                    <Badge className={cn(
                                        "font-black text-[9px] uppercase tracking-wider px-2.5 py-0.5 rounded-lg border",
                                        employee.status === 'Active'
                                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                            : "bg-amber-50 text-amber-700 border-amber-200"
                                    )}>
                                        {employee.status}
                                    </Badge>
                                    <Badge className="bg-slate-100 text-slate-700 border-slate-200 font-mono text-[10px] font-bold">
                                        {employee.id}
                                    </Badge>
                                </div>

                                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-semibold text-slate-500 pt-1">
                                    <div className="flex items-center gap-1.5 text-slate-700">
                                        <Briefcase className="h-4 w-4 text-indigo-500 shrink-0" />
                                        <span>{designationDisplay}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <MapPin className="h-4 w-4 text-slate-400 shrink-0" />
                                        <span>{officeDisplay}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
                                        <span>Joined {joiningDateDisplay}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Key Performance & Balance Cards */}
                            <div className="flex flex-wrap items-center gap-3">
                                <div className="px-5 py-3 bg-slate-50/80 rounded-2xl border border-slate-200/80 min-w-[130px] text-center">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Attendance</p>
                                    <p className="text-lg font-black text-slate-900">{attendanceMetrics.percentage}</p>
                                    <p className="text-[9px] font-bold text-slate-500">{attendanceMetrics.label}</p>
                                </div>

                                <div className="px-5 py-3 bg-slate-50/80 rounded-2xl border border-slate-200/80 min-w-[130px] text-center">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Leave Balance</p>
                                    <p className="text-lg font-black text-indigo-600">{leaveMetrics.totalAvailable} Days</p>
                                    <p className="text-[9px] font-bold text-slate-500">CL: {leaveMetrics.clAvailable} | EL: {leaveMetrics.elAvailable}</p>
                                </div>

                                {salaryMetrics && (
                                    <div className="px-5 py-3 bg-indigo-50/60 rounded-2xl border border-indigo-100 min-w-[140px] text-center">
                                        <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider mb-0.5">Est. Net Take Home</p>
                                        <p className="text-lg font-black text-indigo-950">{formatCurrency(salaryMetrics.netTakeHomeMonthly)}</p>
                                        <p className="text-[9px] font-bold text-indigo-600/80">Gross: {formatCurrency(salaryMetrics.monthlyGross)}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* ── Main Two-Column Information Workspace ── */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* ════════ LEFT COLUMN (8 cols): Primary Profiles & Salary Engine ════════ */}
                    <div className="lg:col-span-8 space-y-8">

                        {/* ── SECTION 1: Personal & Contact Profile ── */}
                        <Card className="border border-slate-200/80 shadow-sm rounded-3xl bg-white p-7">
                            <CardHeader className="px-0 pt-0 pb-5 border-b border-slate-100 mb-6 flex flex-row items-center justify-between">
                                <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-800 flex items-center gap-2.5">
                                    <div className="h-8 w-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                                        <User className="h-4 w-4" />
                                    </div>
                                    <span>Personal & Employment Identity</span>
                                </CardTitle>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => router.push(`/onboarding?editId=${employee.employeeId}`)}
                                    className="h-8 text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                                >
                                    Update Info
                                </Button>
                            </CardHeader>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                                <div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Email Address</span>
                                    <p className="text-xs font-bold text-slate-800 font-mono">{employee.email || "—"}</p>
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Phone Number</span>
                                    <p className="text-xs font-bold text-slate-800">{employee.phone || <span className="text-slate-400 font-normal italic">Not Submitted</span>}</p>
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Employee Code</span>
                                    <Badge className="bg-slate-100 text-slate-800 border border-slate-200 font-mono text-xs font-bold">
                                        {employee.id}
                                    </Badge>
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Department</span>
                                    <p className="text-xs font-bold text-slate-800">{rawEmployee?.department || <span className="text-slate-400 font-normal italic">General / Unassigned</span>}</p>
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">System Role & Access</span>
                                    <Badge className="bg-slate-900 text-[#D9F99D] font-bold text-[10px] uppercase tracking-wider px-2.5 py-0.5">
                                        {employee.role || "EMPLOYEE"}
                                    </Badge>
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Date of Birth</span>
                                    <p className="text-xs font-bold text-slate-800">{rawEmployee?.date_of_birth ? formatDate(rawEmployee.date_of_birth) : <span className="text-slate-400 font-normal italic">Not Provided</span>}</p>
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Gender & Marital Status</span>
                                    <p className="text-xs font-bold text-slate-800 capitalize">
                                        {rawEmployee?.gender || "Not Specified"} • {rawEmployee?.marital_status ? (rawEmployee.marital_status.charAt(0).toUpperCase() + rawEmployee.marital_status.slice(1)) : "Unmarried"}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Father&apos;s / Husband&apos;s Name</span>
                                    <p className="text-xs font-bold text-slate-800 uppercase">
                                        {rawEmployee?.father_or_husband_name || <span className="text-slate-400 font-normal italic">Not Provided</span>}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Shift Schedule & Rotation</span>
                                    <p className="text-xs font-bold text-slate-800">
                                        {rawEmployee?.shift_start_time ? rawEmployee.shift_start_time.slice(0, 5) : "09:30"} - {rawEmployee?.shift_end_time ? rawEmployee.shift_end_time.slice(0, 5) : "18:30"} • {rawEmployee?.is_rotational_shift ? <span className="text-purple-600 font-black">Rotational Roster</span> : <span className="text-slate-500 font-bold">Fixed Shift</span>}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Emergency Contact</span>
                                    <p className="text-xs font-bold text-slate-800">
                                        {rawEmployee?.emergency_contact_name
                                            ? `${rawEmployee.emergency_contact_name} (${rawEmployee.emergency_contact_relation || "Relation"})${rawEmployee.emergency_contact_phone ? ` • ${rawEmployee.emergency_contact_phone}` : ""}`
                                            : <span className="text-slate-400 font-normal italic">Not Provided</span>
                                        }
                                    </p>
                                </div>
                                <div className="md:col-span-2 pt-2 border-t border-slate-100">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Residential Address</span>
                                    <p className="text-xs font-medium text-slate-700 leading-relaxed">
                                        {rawEmployee?.address || <span className="text-slate-400 font-normal italic">No residential address recorded. Click &quot;Update Info&quot; to add.</span>}
                                    </p>
                                </div>
                            </div>
                        </Card>

                        {/* ── SECTION 2: Banking & Statutory Registration ── */}
                        <Card className="border border-slate-200/80 shadow-sm rounded-3xl bg-white p-7">
                            <CardHeader className="px-0 pt-0 pb-5 border-b border-slate-100 mb-6 flex flex-row items-center justify-between">
                                <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-800 flex items-center gap-2.5">
                                    <div className="h-8 w-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                        <CreditCard className="h-4 w-4" />
                                    </div>
                                    <span>Bank Account & Statutory Identifiers</span>
                                </CardTitle>
                            </CardHeader>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                                <div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Bank Name</span>
                                    <p className="text-xs font-bold text-slate-900 uppercase">
                                        {rawEmployee?.bank_name || <span className="text-slate-400 font-normal italic">Not Provided</span>}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Account Number</span>
                                    <p className="text-xs font-mono font-bold text-slate-900 tracking-wider">
                                        {rawEmployee?.bank_account_number || <span className="text-slate-400 font-normal italic font-sans">Not Provided</span>}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">IFSC Code</span>
                                    <p className="text-xs font-mono font-bold text-slate-900 uppercase tracking-wider">
                                        {rawEmployee?.ifsc_code || <span className="text-slate-400 font-normal italic font-sans">Not Provided</span>}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">PAN Number</span>
                                    <p className="text-xs font-mono font-bold text-slate-900 uppercase tracking-widest">
                                        {rawEmployee?.pan_number || <span className="text-slate-400 font-normal italic font-sans">Not Provided</span>}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Aadhaar Number</span>
                                    <p className="text-xs font-mono font-bold text-slate-900 tracking-wider">
                                        {rawEmployee?.aadhaar_number || <span className="text-slate-400 font-normal italic font-sans">Not Provided</span>}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">UAN / Universal Account Number</span>
                                    <p className="text-xs font-mono font-bold text-slate-900 tracking-wider">
                                        {rawEmployee?.uan || <span className="text-slate-400 font-normal italic font-sans">Not Assigned</span>}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">PF Number</span>
                                    <p className="text-xs font-mono font-bold text-slate-900 uppercase tracking-wider">
                                        {rawEmployee?.pf_number || <span className="text-slate-400 font-normal italic font-sans">Not Assigned</span>}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">ESIC IP / Insured Person</span>
                                    <p className="text-xs font-mono font-bold text-slate-900">
                                        {rawEmployee?.esic_number || rawEmployee?.lic_details || (rawEmployee?.esic_applicable ? "Applicable" : <span className="text-slate-400 font-normal italic font-sans">Not Applicable</span>)}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Payment Mode</span>
                                    <p className="text-xs font-bold text-slate-900">
                                        {rawEmployee?.payment_mode || "Bank Transfer"}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">PF Employment Date</span>
                                    <p className="text-xs font-bold text-slate-900">
                                        {rawEmployee?.pf_employment_date ? formatDate(rawEmployee.pf_employment_date) : (rawEmployee?.pf_applicable ? "With Joining Date" : "—")}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Associated Entity / Company</span>
                                    <p className="text-xs font-bold text-slate-900">
                                        {rawEmployee?.company?.name || rawEmployee?.company_name || "Main Company"}
                                    </p>
                                </div>
                            </div>
                        </Card>

                        {/* ── SECTION 3: Salary Breakdown Engine & Compliance Setup ── */}
                        <Card className="border border-slate-200/80 shadow-sm rounded-3xl bg-white p-7">
                            <CardHeader className="px-0 pt-0 pb-5 border-b border-slate-100 mb-6 flex flex-row items-center justify-between">
                                <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-800 flex items-center gap-2.5">
                                    <div className="h-8 w-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                                        <Banknote className="h-4 w-4" />
                                    </div>
                                    <span>Salary Structure & Compliance Engine</span>
                                </CardTitle>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => router.push("/payroll")}
                                    className="h-8 px-3 rounded-lg text-xs font-bold text-indigo-700 bg-indigo-50/50 hover:bg-indigo-100/60 border-indigo-200"
                                >
                                    Configure in Payroll
                                </Button>
                            </CardHeader>

                            {salaryMetrics ? (
                                <div className="space-y-6">
                                    {/* 4 Summary Metric Cards */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
                                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Monthly CTC</span>
                                            <p className="text-base font-black text-slate-900 mt-1">{formatCurrency(salaryMetrics.monthlyGross)}</p>
                                            <span className="text-[9px] font-semibold text-slate-500">Gross Rate / mo</span>
                                        </div>
                                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
                                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Annual CTC</span>
                                            <p className="text-base font-black text-slate-900 mt-1">{formatCurrency(salaryMetrics.annualCtc)}</p>
                                            <span className="text-[9px] font-semibold text-slate-500">Annual Gross</span>
                                        </div>
                                        <div className="p-4 rounded-2xl bg-rose-50/50 border border-rose-100">
                                            <span className="text-[10px] uppercase font-bold text-rose-500 block">Est. Deductions</span>
                                            <p className="text-base font-black text-rose-700 mt-1">{formatCurrency(salaryMetrics.totalDeductions)}</p>
                                            <span className="text-[9px] font-semibold text-rose-600/80">PF + ESIC + PT</span>
                                        </div>
                                        <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100">
                                            <span className="text-[10px] uppercase font-bold text-emerald-600 block">Net Take Home</span>
                                            <p className="text-base font-black text-emerald-800 mt-1">{formatCurrency(salaryMetrics.netTakeHomeMonthly)}</p>
                                            <span className="text-[9px] font-semibold text-emerald-700/80">Est. Monthly In-hand</span>
                                        </div>
                                    </div>

                                    {/* Compliance Badges */}
                                    <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-50 via-indigo-50/30 to-slate-50 border border-slate-200/80">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-2">Statutory Compliance Status</span>
                                        <div className="flex flex-wrap items-center gap-2">
                                            {salaryMetrics.complianceBadges.map((b, i) => (
                                                <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs shadow-xs">
                                                    <span className={cn(
                                                        "h-2 w-2 rounded-full",
                                                        b.active ? "bg-emerald-500" : "bg-slate-300"
                                                    )} />
                                                    <span className="font-bold text-slate-800">{b.label}:</span>
                                                    <span className="text-slate-500 font-medium">{b.detail}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Earnings Breakdown Table */}
                                    <div>
                                        <div className="flex items-center justify-between mb-2.5">
                                            <span className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                                                <TrendingUp className="h-3.5 w-3.5 text-emerald-600" /> 1. Monthly Earnings (Standard Rate)
                                            </span>
                                            <span className="text-xs font-black text-slate-900">{formatCurrency(salaryMetrics.monthlyGross)}</span>
                                        </div>
                                        <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 bg-white">
                                            {salaryMetrics.earnings.map((e, idx) => (
                                                <div key={idx} className="p-3.5 flex items-center justify-between hover:bg-slate-50/60 transition-colors">
                                                    <div>
                                                        <p className="text-xs font-bold text-slate-900">{e.component}</p>
                                                        <p className="text-[10px] text-slate-500">{e.description}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="text-xs font-black text-slate-900">{formatCurrency(e.amount)}</span>
                                                        <span className="block text-[9px] font-bold text-emerald-600 uppercase">Earning</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Deductions Breakdown Table */}
                                    <div>
                                        <div className="flex items-center justify-between mb-2.5">
                                            <span className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                                                <Receipt className="h-3.5 w-3.5 text-rose-600" /> 2. Estimated Statutory Employee Deductions
                                            </span>
                                            <span className="text-xs font-black text-rose-600">-{formatCurrency(salaryMetrics.totalDeductions)}</span>
                                        </div>
                                        <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 bg-white">
                                            {salaryMetrics.deductions.map((d, idx) => (
                                                <div key={idx} className="p-3.5 flex items-center justify-between hover:bg-slate-50/60 transition-colors">
                                                    <div>
                                                        <p className="text-xs font-bold text-slate-900">{d.component}</p>
                                                        <p className="text-[10px] text-slate-500">{d.note}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="text-xs font-black text-slate-900">{formatCurrency(d.amount)}</span>
                                                        <span className="block text-[9px] font-bold text-slate-400 uppercase">Rate: {d.rate}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Employer Contributions Table */}
                                    {salaryMetrics.employerContributions.length > 0 && (
                                        <div>
                                            <div className="flex items-center justify-between mb-2.5">
                                                <span className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                                                    <Building2 className="h-3.5 w-3.5 text-indigo-600" /> 3. Employer Statutory Contributions (Company Cost)
                                                </span>
                                                <span className="text-xs font-black text-indigo-700">{formatCurrency(salaryMetrics.totalEmployerCost)}</span>
                                            </div>
                                            <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 bg-white">
                                                {salaryMetrics.employerContributions.map((ec, idx) => (
                                                    <div key={idx} className="p-3.5 flex items-center justify-between hover:bg-slate-50/60 transition-colors">
                                                        <div>
                                                            <p className="text-xs font-bold text-slate-900">{ec.component}</p>
                                                            <p className="text-[10px] text-slate-500">{ec.note}</p>
                                                        </div>
                                                        <div className="text-right">
                                                            <span className="text-xs font-black text-slate-900">{formatCurrency(ec.amount)}</span>
                                                            <span className="block text-[9px] font-bold text-indigo-600 uppercase">Employer Share</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-10 space-y-3">
                                    <div className="h-12 w-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                                        <Banknote className="h-6 w-6" />
                                    </div>
                                    <p className="text-xs font-bold text-slate-500">No salary structure configured for this employee yet.</p>
                                    <Button
                                        size="sm"
                                        onClick={() => router.push(`/onboarding?editId=${employee.employeeId}`)}
                                        className="h-8 rounded-xl text-xs font-bold bg-indigo-600 text-white"
                                    >
                                        Setup Salary Structure
                                    </Button>
                                </div>
                            )}
                        </Card>
                    </div>

                    {/* ════════ RIGHT COLUMN (4 cols): Muster, Leaves, Docs, Activity ════════ */}
                    <div className="lg:col-span-4 space-y-8">

                        {/* ── CARD 1: Attendance Muster Metrics ── */}
                        <Card className="border border-slate-200/80 shadow-sm rounded-3xl bg-white p-6">
                            <CardHeader className="px-0 pt-0 pb-4 border-b border-slate-100 mb-4 flex flex-row items-center justify-between">
                                <CardTitle className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                                    <Clock className="h-4 w-4 text-indigo-600" /> Attendance Muster
                                </CardTitle>
                                <Badge className={cn("text-[9px] font-bold uppercase border", attendanceMetrics.statusBadge.color)}>
                                    {attendanceMetrics.statusBadge.text}
                                </Badge>
                            </CardHeader>

                            <div className="space-y-4">
                                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                                    <div>
                                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Current Cycle Rate</span>
                                        <p className="text-2xl font-black text-slate-900 mt-0.5">{attendanceMetrics.percentage}</p>
                                    </div>
                                    <div className="h-10 w-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-indigo-600 shadow-xs">
                                        <Percent className="h-5 w-5" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                                        <span className="text-[9px] font-bold uppercase text-slate-400 block">Present Days</span>
                                        <span className="font-bold text-slate-800">{attendanceMetrics.presentDays}</span>
                                    </div>
                                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                                        <span className="text-[9px] font-bold uppercase text-slate-400 block">Working Days</span>
                                        <span className="font-bold text-slate-800">{attendanceMetrics.workingDays}</span>
                                    </div>
                                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                                        <span className="text-[9px] font-bold uppercase text-slate-400 block">Half Days</span>
                                        <span className="font-bold text-slate-800">{attendanceMetrics.halfDays}</span>
                                    </div>
                                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                                        <span className="text-[9px] font-bold uppercase text-slate-400 block">Absent / LWP</span>
                                        <span className="font-bold text-rose-600">{attendanceMetrics.absentDays}</span>
                                    </div>
                                </div>

                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => router.push(`/attendance`)}
                                    className="w-full h-8 text-xs font-bold border-slate-200 text-slate-700 hover:bg-slate-50"
                                >
                                    View Full Attendance Register
                                </Button>
                            </div>
                        </Card>

                        {/* ── CARD 2: Leave Balances & Entitlements ── */}
                        <Card className="border border-slate-200/80 shadow-sm rounded-3xl bg-white p-6">
                            <CardHeader className="px-0 pt-0 pb-4 border-b border-slate-100 mb-4 flex flex-row items-center justify-between">
                                <CardTitle className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                                    <Award className="h-4 w-4 text-emerald-600" /> Leave Entitlements
                                </CardTitle>
                                <span className="text-[10px] font-bold font-mono text-slate-400">Year {leaveMetrics.year}</span>
                            </CardHeader>

                            <div className="space-y-3">
                                {/* Casual Leave CL */}
                                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                                    <div>
                                        <span className="text-xs font-bold text-slate-900 block">Casual Leave (CL)</span>
                                        <span className="text-[10px] text-slate-500">Allocated: {leaveMetrics.clAllocated} | Used: {leaveMetrics.clUsed}</span>
                                    </div>
                                    <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                                        {leaveMetrics.clAvailable} left
                                    </Badge>
                                </div>

                                {/* Earned / Privilege Leave EL */}
                                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                                    <div>
                                        <span className="text-xs font-bold text-slate-900 block">Earned Leave (EL/PL)</span>
                                        <span className="text-[10px] text-slate-500">
                                            Alloc: {leaveMetrics.elAllocated} {leaveMetrics.elCarriedForward > 0 ? `+ CF: ${leaveMetrics.elCarriedForward}` : ""} | Used: {leaveMetrics.elUsed}
                                        </span>
                                    </div>
                                    <Badge className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-bold">
                                        {leaveMetrics.elAvailable} left
                                    </Badge>
                                </div>

                                {/* Total Summary */}
                                <div className="p-3 rounded-xl bg-slate-100/70 flex items-center justify-between text-xs font-bold text-slate-700">
                                    <span>Total Balance Available</span>
                                    <span className="text-slate-900 font-black">{leaveMetrics.totalAvailable} Days</span>
                                </div>

                                <Link href="/leave" className="block pt-1">
                                    <Button variant="outline" className="w-full h-10 rounded-2xl border-slate-200/80 text-[10px] font-black uppercase tracking-wider text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-2 transition-all">
                                        <History className="h-3.5 w-3.5 text-indigo-600" /> View Full Leave History & Audit
                                    </Button>
                                </Link>
                            </div>
                        </Card>

                        {/* ── CARD 3: Verified Documents Hub ── */}
                        <Card className="border border-slate-200/80 shadow-sm rounded-3xl bg-white p-6">
                            <CardHeader className="px-0 pt-0 pb-4 border-b border-slate-100 mb-4 flex flex-row items-center justify-between">
                                <CardTitle className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                                    <FileCheck className="h-4 w-4 text-indigo-600" /> Employee Documents
                                </CardTitle>
                                <span className="text-[10px] font-bold text-slate-400">{documents.length} files</span>
                            </CardHeader>

                            <div className="space-y-2.5">
                                {documents.length > 0 ? (
                                    documents.map((doc) => {
                                        const docUrl = getDocumentUrl(doc.file_path);
                                        return (
                                            <div
                                                key={doc.id}
                                                className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 hover:bg-white hover:border-slate-300 transition-all flex items-center justify-between group"
                                            >
                                                <div className="flex items-center gap-3 overflow-hidden">
                                                    <div className="h-8 w-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-500 group-hover:text-indigo-600 shrink-0 shadow-xs">
                                                        <FileText className="h-4 w-4" />
                                                    </div>
                                                    <div className="overflow-hidden">
                                                        <p className="text-xs font-bold text-slate-800 truncate">{formatDocType(doc.type)}</p>
                                                        <p className="text-[10px] font-mono text-slate-400 truncate">{doc.name}</p>
                                                    </div>
                                                </div>

                                                {docUrl && (
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => window.open(docUrl, "_blank")}
                                                        className="h-8 w-8 p-0 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg shrink-0"
                                                        title="Open in new tab"
                                                    >
                                                        <ExternalLink className="h-3.5 w-3.5" />
                                                    </Button>
                                                )}
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="text-center py-6 space-y-1">
                                        <p className="text-xs font-bold text-slate-400">No documents submitted yet</p>
                                        <p className="text-[10px] text-slate-400">Documents uploaded in self-onboarding will appear here.</p>
                                    </div>
                                )}
                            </div>
                        </Card>

                        {/* ── CARD 4: Lifecycle & Activity Log ── */}
                        <Card className="border border-slate-200/80 shadow-sm rounded-3xl bg-white p-6">
                            <CardHeader className="px-0 pt-0 pb-4 border-b border-slate-100 mb-4">
                                <CardTitle className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                                    <Compass className="h-4 w-4 text-indigo-600" /> Lifecycle & Status Log
                                </CardTitle>
                            </CardHeader>

                            <div className="space-y-4 text-xs">
                                <div className="flex items-start gap-3">
                                    <div className="h-6 w-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-800">Employee Created</p>
                                        <p className="text-[10px] text-slate-500 mt-0.5">{formatDate(rawEmployee?.created_at || rawEmployee?.date_of_joining)}</p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <div className="h-6 w-6 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
                                        <Activity className="h-3.5 w-3.5" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-800">Employment Status</p>
                                        <p className="text-[10px] text-slate-500 mt-0.5">Currently {employee.status}</p>
                                    </div>
                                </div>

                                {latestReview && (
                                    <div className="flex items-start gap-3">
                                        <div className="h-6 w-6 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 mt-0.5">
                                            <Award className="h-3.5 w-3.5" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-800">Performance Review</p>
                                            <p className="text-[10px] text-slate-500 mt-0.5">
                                                {latestReview.review_period} — Score: {Number(latestReview.overall_score).toFixed(1)}/5.0
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </Card>
                    </div>
                </div>
            </div>

            {/* ── ID Card Modal ── */}
            <Dialog open={idCardOpen} onOpenChange={setIdCardOpen}>
                <DialogContent className="sm:max-w-[420px] p-6 rounded-3xl bg-white border-none shadow-2xl">
                    <DialogHeader className="pb-3 border-b border-slate-100 text-left">
                        <DialogTitle className="text-sm font-black uppercase tracking-wider text-slate-800">
                            Employee ID Card Preview
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-500">
                            Official company identity badge
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-4">
                        <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-900 to-indigo-950 text-white p-6 shadow-xl space-y-4">
                            <div className="flex items-center justify-between border-b border-white/10 pb-3">
                                <div>
                                    <p className="text-xs font-black uppercase tracking-wider text-indigo-300">
                                        {rawEmployee?.company?.name || rawEmployee?.company_name || "Company HRMS"}
                                    </p>
                                    <p className="text-[9px] text-slate-400">Identity Verification Card</p>
                                </div>
                                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                            </div>

                            <div className="flex items-center gap-4 py-2">
                                <div className="h-16 w-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-xl font-black text-[#D9F99D]">
                                    {employee.name?.slice(0, 2).toUpperCase()}
                                </div>
                                <div>
                                    <h4 className="font-black text-base text-white tracking-tight">{employee.name}</h4>
                                    <p className="text-xs font-semibold text-indigo-200">{designationDisplay}</p>
                                    <p className="text-[10px] font-mono text-slate-400 mt-0.5">{employee.id}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-[10px] pt-3 border-t border-white/10 text-slate-300">
                                <div>
                                    <span className="text-slate-400 block text-[8px] uppercase">Department</span>
                                    <span className="font-bold text-white">{rawEmployee?.department || "General"}</span>
                                </div>
                                <div>
                                    <span className="text-slate-400 block text-[8px] uppercase">Office</span>
                                    <span className="font-bold text-white">{officeDisplay}</span>
                                </div>
                                <div>
                                    <span className="text-slate-400 block text-[8px] uppercase">Phone</span>
                                    <span className="font-bold text-white">{employee.phone || "—"}</span>
                                </div>
                                <div>
                                    <span className="text-slate-400 block text-[8px] uppercase">Joined</span>
                                    <span className="font-bold text-white">{joiningDateDisplay}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIdCardOpen(false)}
                            className="h-9 px-4 rounded-xl text-xs font-bold"
                        >
                            Close
                        </Button>
                        <Button
                            type="button"
                            onClick={() => window.print()}
                            className="h-9 px-4 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5"
                        >
                            <Download className="h-3.5 w-3.5" />
                            <span>Print Card</span>
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ── Global Action Processing Overlay ── */}
            {actionLoading && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-100 flex flex-col items-center gap-4 max-w-sm w-full text-center">
                        <div className="h-16 w-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-inner">
                            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-base font-black text-slate-800 tracking-tight">Processing Operation</h3>
                            <p className="text-xs font-semibold text-slate-500 leading-relaxed">{actionLoading}</p>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden mt-1">
                            <div className="bg-indigo-600 h-full rounded-full animate-pulse w-3/4" />
                        </div>
                    </div>
                </div>
            )}
        </ProtectedRoute>
    );
}
