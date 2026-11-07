"use client";

import { useRole, ModuleName } from "@/context/RoleContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
    PowerOff
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { apiGet, apiDelete, apiPatch } from "@/lib/api-client";
import { toFrontendEmployee, type BackendEmployee, type FrontendEmployee } from "@/lib/transform";

// ── Types for additional API responses ──

interface SalaryStructure {
    id: number;
    employee_id: number;
    fixed_gross: number;
    basic_salary: number;
    hra: number;
    special_allowance: number;
    other_allowance: number;
    conveyance: number;
    medical_allowance: number;
    pf_applicable: boolean;
    pf_ceiling: boolean;
    pf_contribution_mode: string | null;
    esic_applicable: boolean;
    esic_contribution_mode: string | null;
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
    available: number;
    used: number;
    admin_granted: number;
    lapsed: number;
    last_accrual_month: string;
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
    total_working_days: number;
    attendance_percentage: number;
}

interface AttendanceStats {
    monthly: MonthlyAttendanceRecord | null;
    daily: unknown[];
}

interface ProfileData {
    salary: SalaryResponse | null;
    documents: DocumentItem[];
    reviews: PerformanceReview[];
    leaveBalance: LeaveBalance | null;
    attendance: AttendanceStats | null;
}

// ── Helpers ──

const formatDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return "N/A";
    try {
        const d = new Date(dateStr);
        return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    } catch {
        return dateStr;
    }
};

const formatCurrency = (amount: number | null | undefined): string => {
    if (amount == null || isNaN(amount)) return "₹0";
    return "₹" + amount.toLocaleString("en-IN");
};

const formatDocType = (type: string): string => {
    const map: Record<string, string> = {
        id_proof: "ID Proof",
        address_proof: "Address Proof",
        certificate: "Certificate",
        offer_letter: "Offer Letter",
        contract: "Contract",
        other: "Document",
    };
    return map[type.toLowerCase()] || type;
};


const starRating = (score: number): number[] => {
    const full = Math.floor(score);
    const partial = score - full >= 0.5 ? 1 : 0;
    return Array.from({ length: 5 }, (_, i) => (i < full ? 2 : i < full + partial ? 1 : 0));
    // 2 = full star, 1 = half, 0 = empty
};

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

    // ── Derived values ──

    const currentSalary = salary?.current;
    const salaryBreakdown = currentSalary
        ? [
            { component: "Basic Salary", amount: currentSalary.basic_salary, type: "Earning" },
            { component: "HRA (House Rent)", amount: currentSalary.hra, type: "Earning" },
            ...(currentSalary.special_allowance ? [{ component: "Special Allowance", amount: currentSalary.special_allowance, type: "Earning" }] : []),
            ...(currentSalary.other_allowance ? [{ component: "Other Allowances", amount: currentSalary.other_allowance, type: "Earning" }] : []),
            ...(currentSalary.conveyance ? [{ component: "Conveyance", amount: currentSalary.conveyance, type: "Earning" }] : []),
            ...(currentSalary.medical_allowance ? [{ component: "Medical Allowance", amount: currentSalary.medical_allowance, type: "Earning" }] : []),
        ]
        : [];

    const latestReview = reviews.length > 0 ? reviews[0] : null;
    const reviewScore = latestReview?.overall_score != null ? Number(latestReview.overall_score) : 0;
    const reviewStars = starRating(reviewScore);

    const totalLeaveAvailable = leaveBalance?.available ?? 0;
    const attendancePct = attendanceStats?.monthly?.attendance_percentage ?? null;
    const attendancePctDisplay = attendancePct != null ? `${Number(attendancePct).toFixed(1)}%` : "N/A";

    const grossDisplay = currentSalary?.fixed_gross ?? rawEmployee?.fixed_gross;

    // ── Loading / Error ──

    if (loading) return (
        <div className="h-[60vh] flex flex-col items-center justify-center space-y-4">
            <Activity className="h-12 w-12 text-slate-100 animate-pulse" />
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">Loading Profile...</p>
        </div>
    );

    if (!employee) return (
        <div className="h-[60vh] flex flex-col items-center justify-center space-y-4">
            <Activity className="h-12 w-12 text-slate-100 animate-pulse" />
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">Employee Not Found</p>
        </div>
    );

    return (
        <ProtectedRoute module="EMPLOYEES" action="READ">
            <div className="space-y-10 pb-20 max-w-6xl mx-auto px-4 md:px-0">
                {/* Top Action Bar */}
                <div className="flex items-center justify-between">
                    <Button
                        variant="ghost"
                        onClick={() => router.back()}
                        className="h-10 rounded-xl gap-2 text-slate-400 hover:text-slate-900 font-black uppercase tracking-widest text-[9px]"
                    >
                        <ArrowLeft className="h-3.5 w-3.5" /> Back to Fleet
                    </Button>
                    <div className="flex items-center gap-3">
                        {hasPermission('EMPLOYEES', 'UPDATE') && (
                            <Button 
                                onClick={() => router.push(`/onboarding?editId=${employee.employeeId}`)}
                                className="bg-slate-900 text-white hover:bg-black font-black text-[9px] uppercase tracking-widest px-8 h-10 rounded-xl shadow-xl transition-all flex items-center gap-2"
                            >
                                <Edit3 className="h-3.5 w-3.5" /> Edit Profile
                            </Button>
                        )}
                        <Button variant="outline" className="h-10 rounded-xl border-slate-100 text-slate-600 font-black text-[9px] uppercase tracking-widest px-6">
                            <Download className="h-3.5 w-3.5 mr-2" /> ID Card
                        </Button>
                        {hasPermission('EMPLOYEES', 'UPDATE') && (
                            <Button 
                                variant="outline"
                                onClick={async () => {
                                    const currentBackendStatus = employee.status === "Active" ? "active" : "inactive";
                                    const newBackendStatus = currentBackendStatus === "active" ? "inactive" : "active";
                                    try {
                                        await apiPatch(`/employees/${employee.employeeId}/status`, { status: newBackendStatus });
                                        setEmployee({ ...employee, status: newBackendStatus === "active" ? "Active" : "Inactive" });
                                    } catch (err) {
                                        console.error("Failed to update status:", err);
                                        alert("Failed to update employee status.");
                                    }
                                }}
                                className={cn(
                                    "h-10 rounded-xl border-slate-100 font-black text-[9px] uppercase tracking-widest px-6 flex items-center gap-2",
                                    employee.status === "Active" ? "text-amber-600 hover:bg-amber-50 hover:border-amber-200" : "text-emerald-600 hover:bg-emerald-50 hover:border-emerald-200"
                                )}
                            >
                                {employee.status === "Active" ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                                {employee.status === "Active" ? "Deactivate" : "Activate"}
                            </Button>
                        )}
                        {hasPermission('EMPLOYEES', 'DELETE') && (
                            <Button
                                variant="outline"
                                onClick={() => {
                                    if (!window.confirm(`HARD DELETE ${employee.name} (${employee.id})? This is for TESTING ONLY and cannot be undone.`)) return;
                                    apiDelete(`/employees/${employee.employeeId}`)
                                        .then(() => router.push("/employees"))
                                        .catch((err) => { console.error("Delete failed:", err); alert("Failed to delete. Admin privileges required."); });
                                }}
                                className="h-10 rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50 font-black text-[9px] uppercase tracking-widest px-6 flex items-center gap-2"
                                title="Use Deactivate instead for normal offboarding"
                            >
                                <Trash2 className="h-3.5 w-3.5" /> Hard Delete
                            </Button>
                        )}
                    </div>
                </div>

                {/* Profile Header Card */}
                <Card className="border-none shadow-sm rounded-[3rem] bg-white overflow-hidden">
                    <div className="h-32 bg-slate-900 w-full relative">
                        <div className="absolute -bottom-16 left-12 h-32 w-32 rounded-[2.5rem] bg-white p-2 shadow-2xl">
                            <div className={cn(
                                "h-full w-full rounded-[2rem] flex items-center justify-center text-3xl font-black italic uppercase",
                                employee.color === 'blue' ? "bg-blue-50 text-blue-500" : employee.color === 'amber' ? "bg-amber-50 text-amber-500" : employee.color === 'indigo' ? "bg-indigo-50 text-indigo-500" : "bg-emerald-50 text-emerald-500"
                            )}>
                                {employee.name.charAt(0)}
                            </div>
                        </div>
                    </div>
                    <CardContent className="pt-20 pb-12 px-12">
                        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                            <div className="space-y-2">
                                <div className="flex items-center gap-3">
                                    <h1 className="text-3xl font-black text-slate-900 italic uppercase tracking-tighter">{employee.name}</h1>
                                    <Badge className={cn(
                                        "font-black text-[8px] uppercase tracking-widest px-3 py-1 rounded-lg border-none",
                                        employee.status === 'Active' ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                                    )}>
                                        {employee.status}
                                    </Badge>
                                </div>
                                <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                                    <div className="flex items-center gap-2 text-slate-400">
                                        <Briefcase className="h-3.5 w-3.5" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">{employee.jobTitle || "Protocol Member"}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-slate-400">
                                        <MapPin className="h-3.5 w-3.5" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">{employee.location} Node</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-slate-400">
                                        <Calendar className="h-3.5 w-3.5" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Joined {formatDate(rawEmployee?.date_of_joining)}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <div className="text-center px-6 py-4 bg-slate-50 rounded-2xl border border-white">
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Attendance</p>
                                    <p className="text-xl font-black italic text-slate-900">{attendancePctDisplay}</p>
                                </div>
                                <div className="text-center px-6 py-4 bg-slate-50 rounded-2xl border border-white">
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Leave Balance</p>
                                    <p className="text-xl font-black italic text-slate-900">{totalLeaveAvailable} Days</p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Left Column: Details */}
                    <div className="lg:col-span-8 space-y-8">
                        {/* Information Grid */}
                        <Card className="border-none shadow-sm rounded-[2.5rem] bg-white p-10">
                            <CardHeader className="px-0 pt-0 pb-8 border-b border-slate-50 mb-8">
                                <CardTitle className="text-sm font-black uppercase tracking-widest italic flex items-center gap-3">
                                    <User className="h-4 w-4 text-indigo-500" /> Employee Profile
                                </CardTitle>
                            </CardHeader>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
                                <div className="space-y-1">
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Email Address</p>
                                    <p className="text-xs font-black text-slate-900">{employee.email}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Phone Number</p>
                                    <p className="text-xs font-black text-slate-900">{employee.phone || "N/A"}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Employee Code</p>
                                    <p className="text-xs font-black text-slate-900 tracking-widest">{rawEmployee?.emp_code || "N/A"}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">PAN Number</p>
                                    <p className="text-xs font-black text-slate-900 uppercase tracking-widest">{rawEmployee?.pan_number || "N/A"}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Aadhaar Number</p>
                                    <p className="text-xs font-black text-slate-900 tracking-widest">{rawEmployee?.aadhaar_number || "N/A"}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Department</p>
                                    <p className="text-xs font-black text-slate-900 uppercase tracking-widest">{employee.dept || "N/A"}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">System Role</p>
                                    <Badge className="bg-slate-900 text-[#D9F99D] font-black text-[8px] uppercase tracking-widest h-6 px-3">
                                        {employee.role || "EMPLOYEE"}
                                    </Badge>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Date of Birth</p>
                                    <p className="text-xs font-black text-slate-900">{formatDate(rawEmployee?.date_of_birth)}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Gender</p>
                                    <p className="text-xs font-black text-slate-900 uppercase tracking-widest">{rawEmployee?.gender || "N/A"}</p>
                                </div>
                                {rawEmployee?.address && (
                                    <div className="space-y-1 md:col-span-2">
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Address</p>
                                        <p className="text-xs font-black text-slate-900">{rawEmployee.address}</p>
                                    </div>
                                )}
                                {rawEmployee?.emergency_contact_name && (
                                    <div className="space-y-1">
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Emergency Contact</p>
                                        <p className="text-xs font-black text-slate-900">{rawEmployee.emergency_contact_name} ({rawEmployee.emergency_contact_relation || "N/A"})</p>
                                    </div>
                                )}
                            </div>
                        </Card>

                        {/* Bank & PF Details */}
                        <Card className="border-none shadow-sm rounded-[2.5rem] bg-white p-10">
                            <CardHeader className="px-0 pt-0 pb-8 border-b border-slate-50 mb-8">
                                <CardTitle className="text-sm font-black uppercase tracking-widest italic flex items-center gap-3">
                                    <Banknote className="h-4 w-4 text-emerald-500" /> Bank & PF Details
                                </CardTitle>
                            </CardHeader>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
                                <div className="space-y-1">
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Bank Name</p>
                                    <p className="text-xs font-black text-slate-900 italic uppercase">{rawEmployee?.bank_name || "N/A"}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Account Number</p>
                                    <p className="text-xs font-black text-slate-900 tracking-widest">{rawEmployee?.bank_account_number || "N/A"}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">IFSC Code</p>
                                    <p className="text-xs font-black text-slate-900 uppercase tracking-widest">{rawEmployee?.ifsc_code || "N/A"}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">UAN ID</p>
                                    <p className="text-xs font-black text-slate-900 tracking-widest">{rawEmployee?.uan || "N/A"}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">PF Number</p>
                                    <p className="text-xs font-black text-slate-900 uppercase tracking-widest">{rawEmployee?.pf_number || "N/A"}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Company</p>
                                    <p className="text-xs font-black text-slate-900 uppercase tracking-widest">{rawEmployee?.company_name || "N/A"}</p>
                                </div>
                            </div>
                        </Card>

                        {/* Salary & Compliance Setup */}
                        <Card className="border-none shadow-sm rounded-[2.5rem] bg-white p-10">
                            <CardHeader className="px-0 pt-0 pb-8 border-b border-slate-50 mb-8 flex flex-row items-center justify-between">
                                <CardTitle className="text-sm font-black uppercase tracking-widest italic flex items-center gap-3">
                                    <Banknote className="h-4 w-4 text-emerald-500" /> Salary & Compliance Setup
                                </CardTitle>
                                <Badge className="bg-indigo-50 text-indigo-500 font-black text-[8px] uppercase tracking-widest h-6 px-3 border-none">Configure in Payroll</Badge>
                            </CardHeader>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                                <div className="bg-slate-50 rounded-2xl p-6 border border-white">
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Fixed CTC (Gross)</p>
                                    <p className="text-xl font-black italic text-slate-900">{formatCurrency(grossDisplay)} <span className="text-[9px] font-bold text-slate-400 not-italic">/mo</span></p>
                                </div>
                                <div className="bg-slate-50 rounded-2xl p-6 border border-white">
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Payment Mode</p>
                                    <p className="text-xl font-black italic text-slate-900">Bank Transfer</p>
                                </div>
                                <div className="bg-indigo-50 rounded-2xl p-6 border border-white">
                                    <p className="text-[8px] font-black text-indigo-400 uppercase tracking-widest mb-1">Compliance Status</p>
                                    <div className="flex gap-2 mt-2">
                                        <Badge className={cn(
                                            "border-none font-black text-[7px] uppercase tracking-widest px-2",
                                            rawEmployee?.pf_applicable
                                                ? "bg-slate-900 text-white"
                                                : "bg-slate-200 text-slate-500"
                                        )}>
                                            PF {rawEmployee?.pf_contribution_mode ? `(${rawEmployee.pf_contribution_mode})` : rawEmployee?.pf_applicable ? "(Full)" : "(No)"}
                                        </Badge>
                                        <Badge className={cn(
                                            "border-none font-black text-[7px] uppercase tracking-widest px-2",
                                            rawEmployee?.esic_applicable
                                                ? "bg-slate-900 text-white"
                                                : "bg-slate-200 text-slate-500"
                                        )}>
                                            ESIC {rawEmployee?.esic_applicable ? "(Yes)" : "(No)"}
                                        </Badge>
                                        <Badge className={cn(
                                            "border-none font-black text-[7px] uppercase tracking-widest px-2",
                                            currentSalary?.pt_applicable !== false
                                                ? "bg-slate-900 text-white"
                                                : "bg-slate-200 text-slate-500"
                                        )}>
                                            PT {currentSalary?.pt_applicable !== false ? "(Yes)" : "(No)"}
                                        </Badge>
                                    </div>
                                </div>
                            </div>

                            {salaryBreakdown.length > 0 && (
                                <div>
                                    <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-4">Salary Breakdown Engine</p>
                                    <div className="space-y-2">
                                        {salaryBreakdown.map((p, i) => (
                                            <div key={i} className="flex items-center justify-between p-4 bg-slate-50/50 hover:bg-slate-50 rounded-2xl transition-colors">
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-black italic uppercase text-slate-900 tracking-tighter">{p.component}</span>
                                                </div>
                                                <div className="flex items-center gap-6">
                                                    <div className="text-right">
                                                        <span className="block text-[9px] font-black uppercase text-slate-400">Fixed Amount</span>
                                                        <span className="text-sm font-black italic text-slate-900">{formatCurrency(p.amount)}</span>
                                                    </div>
                                                    <Badge className="bg-emerald-50 text-emerald-600 font-black text-[7px] uppercase tracking-widest h-5 px-2 border-none">
                                                        {p.type}
                                                    </Badge>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {salaryBreakdown.length === 0 && (
                                <div className="text-center py-8">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No salary structure configured yet</p>
                                </div>
                            )}
                        </Card>

                        {/* Performance & Appraisals */}
                        <Card className="border-none shadow-sm rounded-[2.5rem] bg-white p-10">
                            <CardHeader className="px-0 pt-0 pb-8 border-b border-slate-50 mb-8">
                                <CardTitle className="text-sm font-black uppercase tracking-widest italic flex items-center gap-3">
                                    <TrendingUp className="h-4 w-4 text-indigo-500" /> Performance & Appraisals
                                </CardTitle>
                            </CardHeader>
                            {latestReview ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-6">
                                        <div>
                                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">Overall Rating ({latestReview.review_period})</p>
                                            <div className="flex items-center gap-2">
                                                <div className="flex items-center text-amber-400">
                                                    {reviewStars.map((s, i) => (
                                                        <Award key={i} className={cn("h-5 w-5", s === 2 ? "fill-current" : s === 1 ? "fill-current opacity-50" : "text-slate-200")} />
                                                    ))}
                                                </div>
                                                <span className="text-lg font-black italic text-slate-900 ml-2">{Number(reviewScore).toFixed(1)}<span className="text-[10px] text-slate-400 not-italic">/5.0</span></span>
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Last Appraisal Date</p>
                                            <p className="text-xs font-black text-slate-900 tracking-widest">{formatDate(latestReview.reviewed_at)}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Quality Score</p>
                                            <p className="text-xs font-black text-slate-900 tracking-widest">{latestReview.quality_score != null ? Number(latestReview.quality_score).toFixed(1) : "N/A"}/5.0</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Delivery Score</p>
                                            <p className="text-xs font-black text-slate-900 tracking-widest">{latestReview.delivery_score != null ? Number(latestReview.delivery_score).toFixed(1) : "N/A"}/5.0</p>
                                        </div>
                                    </div>
                                    <div className="bg-slate-50 p-6 rounded-2xl border border-white space-y-4">
                                        <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Reviewer Remarks</p>
                                        <p className="text-[10px] font-bold text-slate-500 leading-relaxed">
                                            {latestReview.comments || "No comments provided."}
                                        </p>
                                        <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                                            <div className="h-5 w-5 rounded-full bg-slate-200 flex items-center justify-center text-[7px] font-black text-slate-600">
                                                {latestReview.reviewer?.name?.charAt(0) || "R"}
                                            </div>
                                            <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Reviewed by {latestReview.reviewer?.name || "Manager"}</span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No performance reviews yet</p>
                                </div>
                            )}
                        </Card>
                    </div>

                    {/* Right Column: Documentation & Timeline */}
                    <div className="lg:col-span-4 space-y-8">
                        {/* Documentation Hub */}
                        <Card className="border-none shadow-sm rounded-[2.5rem] bg-white p-8">
                            <CardHeader className="px-0 pt-0 pb-6 border-b border-slate-50 mb-6">
                                <CardTitle className="text-sm font-black uppercase tracking-widest italic">Documents</CardTitle>
                            </CardHeader>
                            <div className="space-y-4">
                                {documents.length > 0 ? (
                                    documents.map((doc) => (
                                        <div
                                            key={doc.id}
                                            className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-white hover:bg-white hover:border-slate-100 transition-all cursor-pointer group"
                                            onClick={() => doc.file_path && window.open(doc.file_path, "_blank")}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="h-8 w-8 rounded-xl bg-white flex items-center justify-center shadow-sm">
                                                    <FileText className="h-4 w-4 text-slate-300 group-hover:text-slate-900" />
                                                </div>
                                                <div>
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-600">{formatDocType(doc.type)}</span>
                                                    <p className="text-[7px] font-bold text-slate-400">{doc.name}</p>
                                                </div>
                                            </div>
                                            <ExternalLink className="h-3.5 w-3.5 text-slate-200 group-hover:text-slate-900" />
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-6">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">No documents uploaded</p>
                                    </div>
                                )}
                            </div>
                        </Card>

                        {/* Leave Balances */}
                        <Card className="border-none shadow-sm rounded-[2.5rem] bg-white p-8">
                            <CardHeader className="px-0 pt-0 pb-6 border-b border-slate-50 mb-6">
                                <CardTitle className="text-sm font-black uppercase tracking-widest italic">Leave Balances</CardTitle>
                            </CardHeader>
                            <div className="space-y-3">
                                {leaveBalance ? (
                                    <>
                                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-white">
                                            <div>
                                                <p className="text-[9px] font-black text-slate-900 uppercase tracking-widest">
                                                    Earned Leave (EL)
                                                </p>
                                                <p className="text-[7px] font-bold text-slate-400">Used: {leaveBalance.used}</p>
                                            </div>
                                            <Badge className={cn(
                                                "border-none font-black text-[8px] uppercase tracking-widest px-2 h-5",
                                                leaveBalance.available > 0 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"
                                            )}>
                                                {leaveBalance.available} left
                                            </Badge>
                                        </div>
                                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-white">
                                            <p className="text-[9px] font-black text-slate-900 uppercase tracking-widest">Admin Granted</p>
                                            <Badge className="border-none font-black text-[8px] uppercase tracking-widest px-2 h-5 bg-blue-50 text-blue-600">
                                                {leaveBalance.admin_granted}
                                            </Badge>
                                        </div>
                                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-white">
                                            <p className="text-[9px] font-black text-slate-900 uppercase tracking-widest">Lapsed</p>
                                            <Badge className="border-none font-black text-[8px] uppercase tracking-widest px-2 h-5 bg-amber-50 text-amber-600">
                                                {leaveBalance.lapsed}
                                            </Badge>
                                        </div>
                                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-white">
                                            <p className="text-[9px] font-black text-slate-900 uppercase tracking-widest">Last Accrual</p>
                                            <p className="text-[8px] font-bold text-slate-400">{leaveBalance.last_accrual_month}</p>
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-center py-4">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">No leave data</p>
                                    </div>
                                )}
                            </div>
                        </Card>

                        {/* Lifecycle Activity */}
                        <Card className="border-none shadow-sm rounded-[2.5rem] bg-white p-8">
                            <CardHeader className="px-0 pt-0 pb-6 border-b border-slate-50 mb-6">
                                <CardTitle className="text-sm font-black uppercase tracking-widest italic">Activity Log</CardTitle>
                            </CardHeader>
                            <div className="space-y-6 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-50">
                                <div className="relative pl-8">
                                    <div className="absolute left-0 top-1.5 h-6 w-6 rounded-lg bg-[#D9F99D] flex items-center justify-center shadow-sm">
                                        <Award className="h-3.5 w-3.5 text-slate-900" />
                                    </div>
                                    <p className="text-[10px] font-black text-slate-900 uppercase">Employee Added</p>
                                    <p className="text-[8px] font-bold text-slate-400 mt-1">{formatDate(rawEmployee?.date_of_joining)}</p>
                                </div>
                                <div className="relative pl-8">
                                    <div className="absolute left-0 top-1.5 h-6 w-6 rounded-lg bg-slate-50 flex items-center justify-center shadow-sm">
                                        <Activity className="h-3.5 w-3.5 text-slate-300" />
                                    </div>
                                    <p className="text-[10px] font-black text-slate-900 uppercase">Status</p>
                                    <p className="text-[8px] font-bold text-slate-400 mt-1">Currently {employee.status}</p>
                                </div>
                                {latestReview && (
                                    <div className="relative pl-8">
                                        <div className="absolute left-0 top-1.5 h-6 w-6 rounded-lg bg-amber-50 flex items-center justify-center shadow-sm">
                                            <Award className="h-3.5 w-3.5 text-amber-400" />
                                        </div>
                                        <p className="text-[10px] font-black text-slate-900 uppercase">Last Review</p>
                                        <p className="text-[8px] font-bold text-slate-400 mt-1">{formatDate(latestReview.reviewed_at)} — Score: {Number(reviewScore).toFixed(1)}</p>
                                    </div>
                                )}
                            </div>
                        </Card>
                    </div>
                </div>
            </div>
        </ProtectedRoute>
    );
}
