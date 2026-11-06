"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { apiGet, apiPost, apiPatch } from "@/lib/api-client";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import {
    CalendarDays,
    Plus,
    History,
    UserCheck,
    UserX,
    Clock,
    Info,
    Plane,
    ArrowUpRight,
    MoreVertical,
    MapPin,
    Calendar,
    Search,
    Download,
    User,
    Activity,
    Loader2,
    Gift,
    TrendingUp,
    TrendingDown,
    ShieldAlert,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
    SheetFooter,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";

interface LeaveBalance {
    id: number;
    employee_id: number;
    year?: number;
    cl_allocated?: number;
    cl_used?: number;
    cl_balance?: number;
    el_allocated?: number;
    el_carried_forward?: number;
    el_used?: number;
    el_balance?: number;
    total_entitled?: number;
    total_balance?: number;
    total_used?: number;
    available?: number;
    used?: number;
    admin_granted?: number;
    lapsed?: number;
    last_accrual_month?: string;
    consecutive_no_usage_months?: number;
}

export default function LeavePage() {
    const { user } = useAuth();
    const isAdmin = user?.role === "ADMIN";

    const [activeTab, setActiveTab] = useState("requests");
    const [isApplyOpen, setIsApplyOpen] = useState(false);
    const [selectedBranch, setSelectedBranch] = useState("All Branches");
    const [searchTerm, setSearchTerm] = useState("");
    const [historyFrom, setHistoryFrom] = useState("");
    const [historyTo, setHistoryTo] = useState("");
    const [departments, setDepartments] = useState<string[]>([]);
    const [isActionDialogOpen, setIsActionDialogOpen] = useState(false);
    const [selectedLog, setSelectedLog] = useState<any>(null);
    const [pendingStatus, setPendingStatus] = useState("");
    const [adminRemarks, setAdminRemarks] = useState("");
    const [payrollTreatment, setPayrollTreatment] = useState<"paid" | "unpaid" | "adjusted_balance" | "carry_forward_next">("paid");
    const [loading, setLoading] = useState(false);

    // Leave History Drawer State (Req 9.3)
    const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);
    const [historyEmployee, setHistoryEmployee] = useState<any>(null);
    const [employeeHistoryRecords, setEmployeeHistoryRecords] = useState<any[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    const [balance, setBalance] = useState<LeaveBalance | null>(null);
    const [logs, setLogs] = useState<any[]>([]);

    // New application form state (Req 9.1: CL / EL)
    const [applyLeaveType, setApplyLeaveType] = useState<"cl" | "el">("cl");
    const [applyDays, setApplyDays] = useState(1);
    const [applyFrom, setApplyFrom] = useState("");
    const [applyTo, setApplyTo] = useState("");
    const [applyReason, setApplyReason] = useState("");
    const [applySubmitting, setApplySubmitting] = useState(false);
    const [formErrors, setFormErrors] = useState<{ from_date?: string; to_date?: string; days?: string; reason?: string; employee_id?: string }>({});
    const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
    const [employees, setEmployees] = useState<any[]>([]);
    const [loadingEmployees, setLoadingEmployees] = useState(false);

    // Grant leaves form state
    const [isGrantOpen, setIsGrantOpen] = useState(false);
    const [grantEmployeeId, setGrantEmployeeId] = useState("");
    const [grantCount, setGrantCount] = useState(1);
    const [grantReason, setGrantReason] = useState("");
    const [grantSubmitting, setGrantSubmitting] = useState(false);
    const [grantErrors, setGrantErrors] = useState<{ employeeId?: string; count?: string; reason?: string }>({});

    const fetchEmployeeHistory = async (emp: any) => {
        setHistoryEmployee(emp);
        setHistoryDrawerOpen(true);
        setLoadingHistory(true);
        try {
            const empId = emp.employee_id || emp.id;
            const data: any = await apiGet(`/leave/history/${empId}`);
            setEmployeeHistoryRecords(Array.isArray(data) ? data : (data.rows || data.history || []));
        } catch (err) {
            console.error("Failed to fetch employee leave history:", err);
            setEmployeeHistoryRecords([]);
        } finally {
            setLoadingHistory(false);
        }
    };

    const todayStr = new Date().toISOString().split('T')[0];

    // Auto-calculate business days from date range
    useEffect(() => {
        if (applyFrom && applyTo) {
            const f = new Date(applyFrom);
            const t = new Date(applyTo);
            if (f <= t) {
                const diff = Math.ceil((t.getTime() - f.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                setApplyDays(diff > 0 ? diff : 1);
            }
        }
    }, [applyFrom, applyTo]);

    const validateLeaveForm = (): boolean => {
        const errors: { from_date?: string; to_date?: string; days?: string; reason?: string; employee_id?: string } = {};
        if (isAdmin && !selectedEmployeeId) errors.employee_id = 'Please select an employee';
        if (!applyFrom) errors.from_date = 'Start date is required';
        else if (applyFrom < todayStr) errors.from_date = 'Start date cannot be in the past';
        if (!applyTo) errors.to_date = 'End date is required';
        else if (applyTo < todayStr) errors.to_date = 'End date cannot be in the past';
        else if (applyTo < applyFrom) errors.to_date = 'End date must be after start date';
        if (!applyDays || applyDays < 1) errors.days = 'Duration must be at least 1 day';
        else if (balance && selectedEmployeeId === "" && applyDays > (balance.available ?? balance.total_balance ?? 0)) errors.days = `Insufficient balance (${balance.available ?? balance.total_balance ?? 0} available)`;
        if (!applyReason || applyReason.trim().length < 10) errors.reason = 'Reason must be at least 10 characters';
        else if (applyReason.length > 500) errors.reason = 'Reason must be under 500 characters';
        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    // Fetch employees list for admin employee selector
    const fetchEmployees = useCallback(async () => {
        if (!isAdmin) return;
        setLoadingEmployees(true);
        try {
            const data: any = await apiGet("/employees", { limit: 200 });
            const list = Array.isArray(data) ? data : (data.data || data.rows || []);
            setEmployees(list);
        } catch (err) {
            console.error("Failed to fetch employees:", err);
        } finally {
            setLoadingEmployees(false);
        }
    }, [isAdmin]);

    // Fetch leave balance
    const fetchBalance = useCallback(async () => {
        try {
            const data: any = await apiGet("/leave/balance");
            setBalance(data);
        } catch (err) {
            console.error("Failed to fetch leave balance:", err);
        }
    }, []);

    // Fetch departments list for branch filter
    useEffect(() => {
        const fetchDepartments = async () => {
            try {
                const data: any = await apiGet("/leave/departments");
                setDepartments(Array.isArray(data) ? data : []);
            } catch (err) {
                console.error("Failed to fetch departments:", err);
            }
        };
        fetchDepartments();
    }, []);

    // Export to CSV
    const exportToCSV = () => {
        if (!logs || logs.length === 0) return;
        const headers = ["Employee", "Branch", "Applied On", "Date Range", "Type", "Duration", "Status", "Reason"];
        const csv = [
            headers.join(","),
            ...logs.map((row: any) =>
                headers.map((h) => {
                    let val = "";
                    switch (h) {
                        case "Employee": val = row.personnel; break;
                        case "Branch": val = row.branch; break;
                        case "Applied On": val = row.appliedOn; break;
                        case "Date Range": val = row.range; break;
                        case "Type": val = row.type; break;
                        case "Duration": val = String(row.duration); break;
                        case "Status": val = row.status; break;
                        case "Reason": val = row.reason; break;
                    }
                    return `"${(val ?? "").toString().replace(/"/g, '""')}"`;
                }).join(",")
            ),
        ].join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `leave_requests_${new Date().toISOString().split("T")[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // Fetch leave requests
    const fetchRequests = useCallback(async () => {
        setLoading(true);
        try {
            const params: any = {};
            if (activeTab === "requests") params.status = "pending";
            if (selectedBranch !== "All Branches") params.department = selectedBranch;
            if (searchTerm) params.search = searchTerm;
            if (historyFrom) params.from = historyFrom;
            if (historyTo) params.to = historyTo;

            const endpoint = isAdmin || user?.role === "MANAGER"
                ? "/leave/requests"
                : "/leave/my-requests";

            const data: any = await apiGet(endpoint, params);
            const rows = (Array.isArray(data) ? data : (data.data || data.rows || [])).map((r: any) => {
                const emp = r.employee || {};
                return {
                    id: r.id,
                    employee_id: r.employee_id,
                    personnel: emp.name || "You",
                    branch: emp.department || "—",
                    appliedOn: r.created_at ? new Date(r.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—",
                    range: r.from_date && r.to_date ? `${new Date(r.from_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} - ${new Date(r.to_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : "—",
                    type: (r.leave_type || "EL").toUpperCase(),
                    payrollTreatment: r.payroll_treatment,
                    status: r.status ? r.status.charAt(0).toUpperCase() + r.status.slice(1) : "Pending",
                    color: r.status === "approved" ? "emerald" : r.status === "rejected" ? "rose" : r.status === "cancelled" ? "slate" : "amber",
                    duration: r.duration || 1,
                    reason: r.reason || "",
                    actionBy: r.approved_by ? `Admin #${r.approved_by}` : "—",
                    remarks: r.remarks || "",
                    empCode: emp.emp_code || "",
                    employeeInitials: (emp.name || "U").charAt(0).toUpperCase(),
                };
            });
            setLogs(rows);
        } catch (err) {
            console.error("Failed to fetch leave requests:", err);
        } finally {
            setLoading(false);
        }
    }, [activeTab, selectedBranch, searchTerm, historyFrom, historyTo, isAdmin, user?.role]);

    // Load data on mount and tab switch
    useEffect(() => { fetchBalance(); }, [fetchBalance]);
    useEffect(() => { fetchRequests(); }, [fetchRequests]);

    const openActionDialog = (log: any, status: string) => {
        setSelectedLog(log);
        setPendingStatus(status);
        setIsActionDialogOpen(true);
        setAdminRemarks("");
        setPayrollTreatment("paid");
    };

    const confirmAction = async () => {
        if (!selectedLog) return;
        try {
            const action = pendingStatus === "Approved" ? "approved" : "rejected";
            await apiPatch(`/leave/approve/${selectedLog.id}`, {
                action,
                remarks: adminRemarks || undefined,
                payroll_treatment: pendingStatus === "Approved" ? payrollTreatment : undefined,
            });
            setIsActionDialogOpen(false);
            fetchRequests();
            fetchBalance();
        } catch (err: any) {
            alert(err?.response?.data?.message || "Failed to process leave request");
        }
    };

    // Submit new leave application
    const handleApplySubmit = async () => {
        if (!validateLeaveForm()) return;
        setApplySubmitting(true);
        try {
            const payload: any = {
                leave_type: applyLeaveType,
                from_date: applyFrom,
                to_date: applyTo,
                duration: applyDays,
                reason: applyReason.trim(),
            };
            if (isAdmin && selectedEmployeeId) {
                payload.employee_id = Number(selectedEmployeeId);
            }
            await apiPost("/leave/apply", payload);
            setIsApplyOpen(false);
            resetApplyForm();
            fetchRequests();
            fetchBalance();
        } catch (err: any) {
            // Parse backend validation field-level errors
            const backendErrors = err?.response?.data?.errors;
            if (backendErrors && Array.isArray(backendErrors)) {
                const mapped: Record<string, string> = {};
                backendErrors.forEach((e: { field: string; message: string }) => {
                    mapped[e.field] = e.message;
                });
                setFormErrors((prev) => ({ ...prev, ...mapped }));
            } else {
                setFormErrors((prev) => ({ ...prev, reason: err?.response?.data?.message || "Failed to submit leave application" }));
            }
        } finally {
            setApplySubmitting(false);
        }
    };

    const resetApplyForm = () => {
        setApplyFrom("");
        setApplyTo("");
        setApplyDays(1);
        setApplyReason("");
        setFormErrors({});
        setSelectedEmployeeId("");
    };

    const handleGrantSubmit = async () => {
        const errors: any = {};
        if (!grantEmployeeId) errors.employeeId = "Please select an employee";
        if (!grantCount || grantCount < 1) errors.count = "Count must be at least 1";
        if (!grantReason || grantReason.trim().length < 5) errors.reason = "Reason must be at least 5 characters";
        setGrantErrors(errors);
        if (Object.keys(errors).length > 0) return;

        setGrantSubmitting(true);
        try {
            await apiPost("/leave/grant", {
                employeeId: Number(grantEmployeeId),
                count: Number(grantCount),
                reason: grantReason.trim(),
            });
            setIsGrantOpen(false);
            setGrantEmployeeId("");
            setGrantCount(1);
            setGrantReason("");
            setGrantErrors({});
            fetchRequests();
            fetchBalance();
        } catch (err: any) {
            setGrantErrors({ reason: err?.response?.data?.message || "Failed to grant leave" });
        } finally {
            setGrantSubmitting(false);
        }
    };

    return (
        <ProtectedRoute module="LEAVE" action="READ">
            <div className="space-y-10 pb-20 animate-in fade-in duration-500">
                {/* Header Area */}
                <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between px-2">
                    <div className="space-y-2">
                        <h1 className="text-2xl font-black text-slate-900 italic uppercase tracking-tighter underline underline-offset-8 decoration-[#D9F99D] decoration-4">Leave Control</h1>
                        <p className="text-[10px] font-bold text-slate-400 mt-4 uppercase tracking-[0.2em]">Employee Absence Tracking & Approvals</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                        {/* Tab Switcher */}
                        <div className="flex bg-slate-100 p-1 rounded-2xl shadow-inner">
                            <Button
                                onClick={() => setActiveTab("requests")}
                                variant="ghost"
                                className={cn(
                                    "h-11 px-6 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all",
                                    activeTab === "requests" ? "bg-white shadow-sm text-slate-900" : "text-slate-400"
                                )}
                            >
                                Pending Requests
                            </Button>
                            <Button
                                onClick={() => setActiveTab("history")}
                                variant="ghost"
                                className={cn(
                                    "h-11 px-6 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all",
                                    activeTab === "history" ? "bg-white shadow-sm text-slate-900" : "text-slate-400"
                                )}
                            >
                                Archive History
                            </Button>
                        </div>

                        {isAdmin && (
                            <Sheet open={isGrantOpen} onOpenChange={(v) => { setIsGrantOpen(v); if (!v) { setGrantEmployeeId(""); setGrantCount(1); setGrantReason(""); setGrantErrors({}); } else { fetchEmployees(); } }}>
                                <SheetTrigger asChild>
                                    <Button className="bg-[#D1FAE5] text-emerald-800 hover:bg-[#A7F3D0] font-black uppercase text-[9px] tracking-widest px-8 h-11 rounded-2xl shadow-sm transition-all border border-emerald-200">
                                        <Gift className="h-4 w-4 mr-2" /> Grant Leave
                                    </Button>
                                </SheetTrigger>
                                <SheetContent className="sm:max-w-[540px] border-none shadow-2xl p-0 overflow-y-auto">
                                    <div className="h-2 bg-[#D1FAE5]" />
                                    <div className="p-8 space-y-10">
                                        <SheetHeader className="text-left space-y-2">
                                            <div className="h-12 w-12 rounded-2xl bg-slate-50 flex items-center justify-center">
                                                <Gift className="h-6 w-6 text-emerald-500" />
                                            </div>
                                            <SheetTitle className="text-2xl font-black italic uppercase text-slate-900 tracking-tighter">Grant Extra Leave</SheetTitle>
                                            <SheetDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-loose">
                                                Grant bonus leaves to an employee. These leaves never expire.
                                            </SheetDescription>
                                        </SheetHeader>
                                        <div className="grid gap-8">
                                            <div className="space-y-6">
                                                <div className="space-y-2">
                                                    <Label className={cn("text-[9px] font-black uppercase tracking-widest", grantErrors.employeeId ? "text-rose-500" : "text-slate-400")}>Select Employee</Label>
                                                    <select
                                                        value={grantEmployeeId}
                                                        onChange={(e) => { setGrantEmployeeId(e.target.value); setGrantErrors((prev) => ({ ...prev, employeeId: undefined })); }}
                                                        className={cn(
                                                            "w-full h-12 rounded-xl px-4 font-bold text-[11px] outline-none border transition-all appearance-none bg-no-repeat",
                                                            grantErrors.employeeId ? "bg-rose-50 border-rose-200 text-rose-600" : "bg-slate-50 border-slate-100 text-slate-700"
                                                        )}
                                                        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")", backgroundPosition: "right 12px center" }}
                                                    >
                                                        <option value="" className="font-bold">Choose an employee...</option>
                                                        {employees.map((emp: any) => (
                                                            <option key={emp.id} value={emp.id} className="font-bold">
                                                                {emp.name} - {emp.emp_code}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    {grantErrors.employeeId && (
                                                        <p className="text-[8px] font-bold text-rose-500 uppercase tracking-wider flex items-center gap-1">
                                                            <ShieldAlert className="h-2.5 w-2.5" /> {grantErrors.employeeId}
                                                        </p>
                                                    )}
                                                </div>

                                                <div className="space-y-2">
                                                    <Label className={cn("text-[9px] font-black uppercase tracking-widest", grantErrors.count ? "text-rose-500" : "text-slate-400")}>Leave Count (Days)</Label>
                                                    <Input
                                                        type="number"
                                                        min={1}
                                                        max={30}
                                                        value={grantCount}
                                                        onChange={(e) => { setGrantCount(Number(e.target.value)); setGrantErrors((prev) => ({ ...prev, count: undefined })); }}
                                                        className={cn(
                                                            "h-12 rounded-xl font-bold text-[11px] transition-all",
                                                            grantErrors.count ? "bg-rose-50 border-rose-200 text-rose-600 focus-visible:ring-rose-200" : "bg-slate-50 border-slate-100"
                                                        )}
                                                    />
                                                    {grantErrors.count && (
                                                        <p className="text-[8px] font-bold text-rose-500 uppercase tracking-wider flex items-center gap-1">
                                                            <ShieldAlert className="h-2.5 w-2.5" /> {grantErrors.count}
                                                        </p>
                                                    )}
                                                </div>

                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <Label className={cn("text-[9px] font-black uppercase tracking-widest", grantErrors.reason ? "text-rose-500" : "text-slate-400")}>Reason for Grant</Label>
                                                    </div>
                                                    <textarea
                                                        className={cn(
                                                            "w-full h-32 rounded-xl p-4 font-bold text-[11px] outline-none border transition-all resize-none",
                                                            grantErrors.reason ? "bg-rose-50 border-rose-200 text-rose-600 focus:border-rose-300 placeholder:text-rose-300" : "bg-slate-50 border-slate-100 focus:border-slate-300 placeholder:text-slate-300"
                                                        )}
                                                        placeholder="Describe the reason for granting these leaves (min 5 characters)..."
                                                        value={grantReason}
                                                        onChange={(e) => { setGrantReason(e.target.value); setGrantErrors((prev) => ({ ...prev, reason: undefined })); }}
                                                        maxLength={500}
                                                    />
                                                    {grantErrors.reason && (
                                                        <p className="text-[8px] font-bold text-rose-500 uppercase tracking-wider flex items-center gap-1">
                                                            <ShieldAlert className="h-2.5 w-2.5" /> {grantErrors.reason}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <SheetFooter className="flex gap-3 pt-6">
                                            <Button variant="outline" onClick={() => { setIsGrantOpen(false); setGrantEmployeeId(""); setGrantCount(1); setGrantReason(""); setGrantErrors({}); }} className="flex-1 h-12 rounded-2xl border-slate-100 font-black uppercase text-[9px] tracking-widest">Cancel</Button>
                                            <Button onClick={handleGrantSubmit} disabled={grantSubmitting} className="flex-1 h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[9px] tracking-widest shadow-xl">
                                                {grantSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                                                {grantSubmitting ? "Submitting..." : "Grant Leaves"}
                                            </Button>
                                        </SheetFooter>
                                    </div>
                                </SheetContent>
                            </Sheet>
                        )}

                        <Sheet open={isApplyOpen} onOpenChange={(v) => { setIsApplyOpen(v); if (!v) { resetApplyForm(); } else if (isAdmin) { fetchEmployees(); } }}>
                            <SheetTrigger asChild>
                                <Button className="bg-slate-900 text-white hover:bg-black font-black uppercase text-[9px] tracking-widest px-8 h-11 rounded-2xl shadow-xl transition-all">
                                    <Plus className="h-4 w-4 mr-2" /> Apply Leave
                                </Button>
                            </SheetTrigger>
                            <SheetContent className="sm:max-w-[540px] border-none shadow-2xl p-0 overflow-y-auto">
                                <div className="h-2 bg-[#D9F99D]" />
                                <div className="p-8 space-y-10">
                                    <SheetHeader className="text-left space-y-2">
                                        <div className="h-12 w-12 rounded-2xl bg-slate-50 flex items-center justify-center">
                                            <Plane className="h-6 w-6 text-indigo-500" />
                                        </div>
                                        <SheetTitle className="text-2xl font-black italic uppercase text-slate-900 tracking-tighter">Apply for Leave</SheetTitle>
                                        <SheetDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-loose">
                                            Earned Leave (EL) — 2 leaves per month. Max 2 leaves per calendar month.
                                        </SheetDescription>
                                    </SheetHeader>
                                    <div className="grid gap-8">
                                        <div className="space-y-6">
                                            <div className="flex items-center gap-3 p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                                                <Info className="h-5 w-5 text-indigo-500 shrink-0" />
                                                <p className="text-[10px] font-bold text-indigo-700 uppercase tracking-wide leading-relaxed">
                                                    You earn 2 EL per month. Unused leaves carry forward for up to 3 months, then lapse if still unused.
                                                </p>
                                            </div>
                                            {isAdmin && (
                                                <div className="space-y-2">
                                                    <Label className={cn("text-[9px] font-black uppercase tracking-widest", formErrors.employee_id ? "text-rose-500" : "text-slate-400")}>Select Employee</Label>
                                                    <select
                                                        value={selectedEmployeeId}
                                                        onChange={(e) => { setSelectedEmployeeId(e.target.value); setFormErrors((prev) => ({ ...prev, employee_id: undefined })); }}
                                                        className={cn(
                                                            "w-full h-12 rounded-xl px-4 font-bold text-[11px] outline-none border transition-all appearance-none bg-no-repeat",
                                                            formErrors.employee_id ? "bg-rose-50 border-rose-200 text-rose-600" : "bg-slate-50 border-slate-100 text-slate-700"
                                                        )}
                                                        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")", backgroundPosition: "right 12px center" }}
                                                    >
                                                        <option value="" className="font-bold">Choose an employee...</option>
                                                        {employees.map((emp: any) => (
                                                            <option key={emp.id} value={emp.id} className="font-bold">
                                                                {emp.name} - {emp.emp_code}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    {loadingEmployees && (
                                                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                                            <Loader2 className="h-2.5 w-2.5 animate-spin" /> Loading employees...
                                                        </p>
                                                    )}
                                                    {formErrors.employee_id && (
                                                        <p className="text-[8px] font-bold text-rose-500 uppercase tracking-wider flex items-center gap-1">
                                                            <ShieldAlert className="h-2.5 w-2.5" /> {formErrors.employee_id}
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Leave Type (Req 9.1)</Label>
                                                    <select
                                                        value={applyLeaveType}
                                                        onChange={(e: any) => setApplyLeaveType(e.target.value)}
                                                        className="h-12 w-full rounded-xl bg-slate-50 border border-slate-100 px-4 font-bold text-[11px] text-slate-700 outline-none cursor-pointer"
                                                    >
                                                        <option value="cl">Casual Leave (CL) — 12 / yr (No Carryover)</option>
                                                        <option value="el">Earned Leave (EL) — 12 / yr (Carryover Permitted)</option>
                                                    </select>
                                                </div>
                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Duration</Label>
                                                        <span className="text-[8px] font-bold text-slate-300 uppercase tracking-wider">Auto-calculated</span>
                                                    </div>
                                                    <div className={cn(
                                                        "h-12 rounded-xl border flex items-center px-4 font-bold text-[11px] transition-all",
                                                        formErrors.days ? "bg-rose-50 border-rose-200 text-rose-600" : "bg-indigo-50/50 border-indigo-100 text-indigo-700"
                                                    )}>
                                                        <CalendarDays className="h-4 w-4 mr-2 opacity-50" />
                                                        {applyFrom && applyTo ? `${applyDays} day${applyDays !== 1 ? 's' : ''}` : "—"}
                                                    </div>
                                                    {formErrors.days && (
                                                        <p className="text-[8px] font-bold text-rose-500 uppercase tracking-wider flex items-center gap-1">
                                                            <ShieldAlert className="h-2.5 w-2.5" /> {formErrors.days}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label className={cn("text-[9px] font-black uppercase tracking-widest", formErrors.from_date ? "text-rose-500" : "text-slate-400")}>Start Date</Label>
                                                    <Input
                                                        type="date"
                                                        min={todayStr}
                                                        value={applyFrom}
                                                        onChange={(e) => { setApplyFrom(e.target.value); setFormErrors((prev) => ({ ...prev, from_date: undefined, days: undefined })); }}
                                                        className={cn(
                                                            "h-12 rounded-xl font-bold text-[11px] transition-all",
                                                            formErrors.from_date ? "bg-rose-50 border-rose-200 text-rose-600 focus-visible:ring-rose-200" : "bg-slate-50 border-slate-100"
                                                        )}
                                                    />
                                                    {formErrors.from_date && (
                                                        <p className="text-[8px] font-bold text-rose-500 uppercase tracking-wider flex items-center gap-1">
                                                            <ShieldAlert className="h-2.5 w-2.5" /> {formErrors.from_date}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="space-y-2">
                                                    <Label className={cn("text-[9px] font-black uppercase tracking-widest", formErrors.to_date ? "text-rose-500" : "text-slate-400")}>End Date</Label>
                                                    <Input
                                                        type="date"
                                                        min={applyFrom || todayStr}
                                                        value={applyTo}
                                                        onChange={(e) => { setApplyTo(e.target.value); setFormErrors((prev) => ({ ...prev, to_date: undefined, days: undefined })); }}
                                                        className={cn(
                                                            "h-12 rounded-xl font-bold text-[11px] transition-all",
                                                            formErrors.to_date ? "bg-rose-50 border-rose-200 text-rose-600 focus-visible:ring-rose-200" : "bg-slate-50 border-slate-100"
                                                        )}
                                                    />
                                                    {formErrors.to_date && (
                                                        <p className="text-[8px] font-bold text-rose-500 uppercase tracking-wider flex items-center gap-1">
                                                            <ShieldAlert className="h-2.5 w-2.5" /> {formErrors.to_date}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <Label className={cn("text-[9px] font-black uppercase tracking-widest", formErrors.reason ? "text-rose-500" : "text-slate-400")}>Reason for Leave</Label>
                                                    <span className={cn("text-[8px] font-bold uppercase tracking-wider", applyReason.length > 500 ? "text-rose-500" : applyReason.length >= 10 ? "text-emerald-500" : "text-slate-300")}>
                                                        {applyReason.length}/500
                                                    </span>
                                                </div>
                                                <textarea
                                                    className={cn(
                                                        "w-full h-32 rounded-xl p-4 font-bold text-[11px] outline-none border transition-all resize-none",
                                                        formErrors.reason ? "bg-rose-50 border-rose-200 text-rose-600 focus:border-rose-300 placeholder:text-rose-300" : "bg-slate-50 border-slate-100 focus:border-slate-300 placeholder:text-slate-300"
                                                    )}
                                                    placeholder="Describe the reason for your leave request (min 10 characters)..."
                                                    value={applyReason}
                                                    onChange={(e) => { setApplyReason(e.target.value); setFormErrors((prev) => ({ ...prev, reason: undefined })); }}
                                                    maxLength={500}
                                                />
                                                {formErrors.reason && (
                                                    <p className="text-[8px] font-bold text-rose-500 uppercase tracking-wider flex items-center gap-1">
                                                        <ShieldAlert className="h-2.5 w-2.5" /> {formErrors.reason}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <SheetFooter className="flex gap-3 pt-6">
                                        <Button variant="outline" onClick={() => { setIsApplyOpen(false); resetApplyForm(); }} className="flex-1 h-12 rounded-2xl border-slate-100 font-black uppercase text-[9px] tracking-widest">Cancel</Button>
                                        <Button onClick={handleApplySubmit} disabled={applySubmitting} className="flex-1 h-12 rounded-2xl bg-slate-900 text-white font-black uppercase text-[9px] tracking-widest shadow-xl">
                                            {applySubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                                            {applySubmitting ? "Submitting..." : "Submit Request"}
                                        </Button>
                                    </SheetFooter>
                                </div>
                            </SheetContent>
                        </Sheet>
                    </div>
                </div>

                {/* Annual Leave Structure Cards (Req 9.1, 9.2: 12 CL + 12 EL = 24 Total) */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 px-2">
                    {/* Casual Leave (CL) */}
                    <Card className="bg-[#E0E7FF] border-none rounded-2xl p-6 shadow-sm flex flex-col justify-between h-36 group hover:shadow-lg transition-all">
                        <div className="flex items-center justify-between">
                            <div className="h-8 w-8 bg-white/50 rounded-lg flex items-center justify-center">
                                <CalendarDays className="h-4 w-4 text-indigo-600" />
                            </div>
                            <Badge className="bg-white/30 text-indigo-900 border-none font-black text-[7px] uppercase tracking-widest px-2 h-5 rounded-md italic">No Carryover</Badge>
                        </div>
                        <div>
                            <div className="flex items-center justify-between">
                                <p className="text-[8px] font-black text-indigo-500 uppercase tracking-widest mb-0.5">Casual Leave (CL)</p>
                                <span className="text-[8px] font-bold text-indigo-600">{balance?.cl_allocated ?? 12} / Yr</span>
                            </div>
                            <h3 className="text-2xl font-black text-indigo-900 italic tracking-tighter">
                                {balance?.cl_balance ?? (balance?.available ? Math.min(12, balance.available) : 12)} <span className="text-[9px] uppercase font-bold text-indigo-400 not-italic ml-1">Days Rem.</span>
                            </h3>
                        </div>
                    </Card>

                    {/* Earned Leave (EL) */}
                    <Card className="bg-[#DCFCE7] border-none rounded-2xl p-6 shadow-sm flex flex-col justify-between h-36 group hover:shadow-lg transition-all">
                        <div className="flex items-center justify-between">
                            <div className="h-8 w-8 bg-white/50 rounded-lg flex items-center justify-center">
                                <Plane className="h-4 w-4 text-emerald-600" />
                            </div>
                            <Badge className="bg-white/30 text-emerald-900 border-none font-black text-[7px] uppercase tracking-widest px-2 h-5 rounded-md italic">Carryover Permitted</Badge>
                        </div>
                        <div>
                            <div className="flex items-center justify-between">
                                <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest mb-0.5">Earned Leave (EL)</p>
                                <span className="text-[8px] font-bold text-emerald-700">+{balance?.el_carried_forward ?? 0} Carried Over</span>
                            </div>
                            <h3 className="text-2xl font-black text-emerald-900 italic tracking-tighter">
                                {balance?.el_balance ?? (balance?.available ? Math.max(0, balance.available - 12) : 12)} <span className="text-[9px] uppercase font-bold text-emerald-500 not-italic ml-1">Days Rem.</span>
                            </h3>
                        </div>
                    </Card>

                    {/* Total Annual Entitlement */}
                    <Card className="bg-[#FEF3C7] border-none rounded-2xl p-6 shadow-sm flex flex-col justify-between h-36 group hover:shadow-lg transition-all">
                        <div className="flex items-center justify-between">
                            <div className="h-8 w-8 bg-white/50 rounded-lg flex items-center justify-center">
                                <TrendingUp className="h-4 w-4 text-amber-600" />
                            </div>
                            <Badge className="bg-white/30 text-amber-900 border-none font-black text-[7px] uppercase tracking-widest px-2 h-5 rounded-md italic">Annual Total</Badge>
                        </div>
                        <div>
                            <p className="text-[8px] font-black text-amber-600 uppercase tracking-widest mb-0.5">Total Entitled (12 CL + 12 EL)</p>
                            <h3 className="text-2xl font-black text-amber-950 italic tracking-tighter">
                                {balance?.total_balance ?? (balance?.available ?? 24)} <span className="text-[9px] uppercase font-bold text-amber-600 not-italic ml-1">/ {balance?.total_entitled ?? 24} Days</span>
                            </h3>
                        </div>
                    </Card>

                    {/* Used / Consumed */}
                    <Card className="bg-[#FEE2E2] border-none rounded-2xl p-6 shadow-sm flex flex-col justify-between h-36 group hover:shadow-lg transition-all">
                        <div className="flex items-center justify-between">
                            <div className="h-8 w-8 bg-white/50 rounded-lg flex items-center justify-center">
                                <TrendingDown className="h-4 w-4 text-rose-600" />
                            </div>
                            <Badge className="bg-white/30 text-rose-900 border-none font-black text-[7px] uppercase tracking-widest px-2 h-5 rounded-md italic">Used</Badge>
                        </div>
                        <div>
                            <p className="text-[8px] font-black text-rose-500 uppercase tracking-widest mb-0.5">Total Consumed</p>
                            <h3 className="text-2xl font-black text-rose-900 italic tracking-tighter">
                                {balance?.total_used ?? (balance?.used ?? 0)} <span className="text-[9px] uppercase font-bold text-rose-400 not-italic ml-1">Days</span>
                            </h3>
                        </div>
                    </Card>
                </div>

                {/* Enterprise Leave Policy Notice (Req 9.1, 10) */}
                <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100 mx-2">
                    <Info className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                    <div className="space-y-1">
                        <p className="text-[10px] font-black text-slate-600 uppercase tracking-wide">Enterprise Annual Leave Structure (Req 9.1, 9.2)</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase leading-relaxed">
                            24 Total Annual Days • 12 Casual Leaves (CL - no carryover) • 12 Earned Leaves (EL - carryover permitted) • Pending unapproved leaves do not trigger automatic salary deductions until Admin reviews & decides treatment
                        </p>
                    </div>
                </div>

                {/* Content Area */}
                <div className="space-y-6">
                    {/* Search & Filters */}
                    <Card className="border-none shadow-sm rounded-[2rem] bg-white p-2 mx-2">
                        <div className="flex flex-wrap items-center justify-between gap-4">
                            <div className="flex flex-wrap items-center gap-3">
                                <div className="flex items-center gap-2 bg-slate-50 px-3 h-10 rounded-xl border border-slate-200">
                                    <MapPin className="h-3.5 w-3.5 text-rose-400" />
                                    <select
                                        className="bg-transparent border-none text-[9px] font-black uppercase outline-none pr-2 h-full"
                                        value={selectedBranch}
                                        onChange={(e) => setSelectedBranch(e.target.value)}
                                    >
                                        <option>All Branches</option>
                                        {departments.map((dept) => (
                                            <option key={dept} value={dept}>{dept}</option>
                                        ))}
                                    </select>
                                </div>
                                {activeTab === "history" && (
                                    <div className="flex items-center gap-2 bg-slate-50 px-3 h-10 rounded-xl border border-slate-200">
                                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                                        <Input type="date" value={historyFrom} onChange={(e) => setHistoryFrom(e.target.value)} className="h-full w-24 bg-transparent border-none text-[9px] font-bold uppercase p-0 focus-visible:ring-0" />
                                        <span className="text-[8px] font-black text-slate-300">TO</span>
                                        <Input type="date" value={historyTo} onChange={(e) => setHistoryTo(e.target.value)} className="h-full w-24 bg-transparent border-none text-[9px] font-bold uppercase p-0 focus-visible:ring-0" />
                                    </div>
                                )}
                                <div className="relative group min-w-[200px]">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                                    <Input
                                        placeholder="Search Employee..."
                                        className="h-10 pl-9 pr-4 w-full bg-slate-50 border-none rounded-xl text-[10px] font-bold focus:bg-white transition-all"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button variant="outline" className="h-10 px-6 rounded-xl border-slate-100 font-black text-[9px] uppercase tracking-widest" onClick={exportToCSV}>
                                    <Download className="h-4 w-4 mr-2" /> Export
                                </Button>
                            </div>
                        </div>
                    </Card>

                    <Card className="border-none shadow-sm rounded-[2.5rem] bg-white overflow-hidden mx-2">
                        <CardHeader className="p-8 pb-4 border-none">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-xl font-black italic uppercase text-slate-900 tracking-tighter underline underline-offset-4 decoration-[#D9F99D]">
                                        {activeTab === "requests" ? "Pending Approval Queue" : "Historical Absence Archive"}
                                    </CardTitle>
                                    <CardDescription className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                        {activeTab === "requests" ? "Process new applications for the current shift" : "Audit trail of all past leave events"}
                                    </CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <tr className="bg-slate-50/50 border-b border-slate-100">
                                        <th className="text-left py-5 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Employee & Branch</th>
                                        <th className="text-left py-5 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Type & Duration</th>
                                        <th className="text-left py-5 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Leave Range</th>
                                        <th className="text-left py-5 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Reason / Remarks</th>
                                        <th className="text-left py-5 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Action By</th>
                                        <th className="text-left py-5 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                                        <th className="text-right py-5 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Control</th>
                                    </tr>
                                </TableHeader>
                                <TableBody>
                                    {loading ? (
                                        <tr>
                                            <td colSpan={7} className="py-20 text-center">
                                                <Loader2 className="h-8 w-8 text-slate-300 animate-spin mx-auto mb-3" />
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Loading leave data...</p>
                                            </td>
                                        </tr>
                                    ) : logs.map((row) => (
                                        <TableRow key={row.id} className="group border-none hover:bg-slate-50/30 transition-all border-b border-slate-50 last:border-none">
                                            <td className="py-5 px-4">
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-8 w-8 rounded-lg border border-white shadow-sm">
                                                        <AvatarFallback className="bg-slate-900 text-white text-[8px] font-black">{row.employeeInitials}</AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex flex-col">
                                                        <span className="text-[11px] font-black text-slate-900 italic uppercase tracking-tighter">{row.personnel}</span>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                                                <MapPin className="h-2 w-2" /> {row.branch}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-5 px-4">
                                                <div className="flex flex-col gap-1.5">
                                                    <span className="w-fit text-[9px] font-black text-slate-600 uppercase tracking-tight italic bg-slate-50 px-2.5 py-1 rounded-md border border-slate-100">
                                                        EL
                                                    </span>
                                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{row.duration} Day{row.duration > 1 ? 's' : ''}</span>
                                                </div>
                                            </td>
                                            <td className="py-5 px-4">
                                                <div className="space-y-1">
                                                    <p className="text-[10px] font-black text-slate-900 italic tracking-tighter">{row.range}</p>
                                                    <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                                        <Clock className="h-2 w-2" /> Applied: {row.appliedOn}
                                                    </p>
                                                </div>
                                            </td>
                                            <td className="py-5 px-4">
                                                <div className="space-y-1">
                                                    <p className="text-[8px] font-bold text-slate-500 max-w-[160px] truncate uppercase tracking-widest italic leading-relaxed">
                                                        &ldquo;{row.reason}&rdquo;
                                                    </p>
                                                    {row.remarks && (
                                                        <p className={cn(
                                                            "text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded w-fit",
                                                            row.status === 'Approved' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                                                        )}>
                                                            Admin: {row.remarks}
                                                        </p>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-5 px-4">
                                                <div className="flex items-center gap-2">
                                                    <User className="h-3 w-3 text-slate-300" />
                                                    <span className="text-[9px] font-black text-slate-700 uppercase tracking-tighter italic">{row.actionBy}</span>
                                                </div>
                                            </td>
                                            <td className="py-5 px-4">
                                                <Badge className={cn(
                                                    "border-none font-black text-[8px] uppercase tracking-widest px-3 h-6 rounded-lg shadow-sm",
                                                    row.status === 'Approved' || row.status === 'Verified' ? 'bg-[#D1FAE5] text-emerald-600' :
                                                        row.status === 'Pending' ? 'bg-[#FEF3C7] text-amber-600' : 'bg-rose-50 text-rose-600'
                                                )}>
                                                    {row.status}
                                                </Badge>
                                            </td>
                                            <td className="py-5 px-4 text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all">
                                                            <MoreVertical className="h-4 w-4 text-slate-300" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="rounded-xl p-2 border-slate-100 shadow-xl w-44">
                                                        <DropdownMenuItem
                                                            onClick={() => openActionDialog(row, 'Approved')}
                                                            className="flex items-center gap-2.5 p-2 rounded-lg cursor-pointer hover:bg-emerald-50"
                                                        >
                                                            <UserCheck className="h-3.5 w-3.5 text-emerald-600" />
                                                            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-700">Approve</span>
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            onClick={() => openActionDialog(row, 'Rejected')}
                                                            className="flex items-center gap-2.5 p-2 rounded-lg cursor-pointer hover:bg-rose-50"
                                                        >
                                                            <UserX className="h-3.5 w-3.5 text-rose-600" />
                                                            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-700">Reject</span>
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            onClick={() => fetchEmployeeHistory(row)}
                                                            className="flex items-center gap-2.5 p-2 rounded-lg cursor-pointer hover:bg-indigo-50"
                                                        >
                                                            <History className="h-3.5 w-3.5 text-indigo-600" />
                                                            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-700">Leave History</span>
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </td>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                            {!loading && logs.length === 0 && (
                                <div className="py-20 text-center space-y-3">
                                    <div className="h-16 w-16 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-slate-100 shadow-sm">
                                        <Activity className="h-8 w-8 text-slate-200" />
                                    </div>
                                    <h3 className="text-sm font-black uppercase text-slate-400 italic tracking-widest">No entries found</h3>
                                    <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">Try adjusting your filters or search term</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Action Confirmation Dialog */}
                <Dialog open={isActionDialogOpen} onOpenChange={setIsActionDialogOpen}>
                    <DialogContent className="sm:max-w-[425px] border-none shadow-2xl rounded-3xl p-8">
                        <DialogHeader className="space-y-3">
                            <div className={cn(
                                "h-12 w-12 rounded-2xl flex items-center justify-center mb-2",
                                pendingStatus === 'Approved' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                            )}>
                                {pendingStatus === 'Approved' ? <UserCheck className="h-6 w-6" /> : <UserX className="h-6 w-6" />}
                            </div>
                            <DialogTitle className="text-xl font-black italic uppercase text-slate-900 tracking-tighter">
                                {pendingStatus === 'Approved' ? 'Confirm Approval' : 'Confirm Rejection'}
                            </DialogTitle>
                            <DialogDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-loose">
                                Are you sure you want to {pendingStatus.toLowerCase()} leave for <span className="text-slate-900 font-black italic">{selectedLog?.personnel}</span>?
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-4">
                            {pendingStatus === 'Approved' && (
                                <div className="space-y-2">
                                    <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">
                                        Payroll Treatment (Req 10)
                                    </Label>
                                    <select
                                        value={payrollTreatment}
                                        onChange={(e: any) => setPayrollTreatment(e.target.value)}
                                        className="w-full h-11 px-3 rounded-xl bg-slate-50 border border-slate-100 font-bold text-[10px] uppercase outline-none focus:ring-2 ring-emerald-100 cursor-pointer"
                                    >
                                        <option value="paid">Paid Leave (Deduct from Annual Balance, No Salary Cut)</option>
                                        <option value="unpaid">Loss of Pay / Unpaid (Salary Deduction in Payroll)</option>
                                        <option value="adjusted_balance">Adjust Against Balance (Decoupled from Cut)</option>
                                        <option value="carry_forward_next">Carry Forward Adjustment to Next Month</option>
                                    </select>
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Admin Remarks (Optional)</Label>
                                <textarea
                                    value={adminRemarks}
                                    onChange={(e) => setAdminRemarks(e.target.value)}
                                    placeholder="Add a reason or message for the employee..."
                                    className="w-full min-h-[90px] p-4 rounded-xl bg-slate-50 border-slate-100 font-bold text-[11px] focus:bg-white transition-all outline-none border"
                                />
                            </div>
                        </div>

                        <DialogFooter className="gap-3 sm:justify-start">
                            <Button
                                className={cn(
                                    "flex-1 h-12 rounded-2xl font-black uppercase text-[9px] tracking-widest shadow-lg transition-all",
                                    pendingStatus === 'Approved' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-rose-600 hover:bg-rose-700 text-white'
                                )}
                                onClick={confirmAction}
                            >
                                Confirm {pendingStatus}
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => setIsActionDialogOpen(false)}
                                className="flex-1 h-12 rounded-2xl border-slate-100 font-black uppercase text-[9px] tracking-widest"
                            >
                                Cancel
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Employee Leave History Drawer (Req 9.3) */}
                <Sheet open={historyDrawerOpen} onOpenChange={setHistoryDrawerOpen}>
                    <SheetContent className="sm:max-w-[580px] border-none shadow-2xl p-0 overflow-y-auto">
                        <div className="h-2 bg-indigo-500" />
                        <div className="p-8 space-y-6">
                            <SheetHeader className="text-left space-y-1">
                                <div className="flex items-center gap-2">
                                    <History className="h-5 w-5 text-indigo-600" />
                                    <SheetTitle className="text-xl font-black italic uppercase text-slate-900 tracking-tight">
                                        Employee Leave History
                                    </SheetTitle>
                                </div>
                                <SheetDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                    Complete leave audit log for <span className="text-slate-900 font-black">{historyEmployee?.personnel}</span> ({historyEmployee?.empCode || '—'})
                                </SheetDescription>
                            </SheetHeader>

                            {loadingHistory ? (
                                <div className="py-20 text-center">
                                    <Loader2 className="h-8 w-8 text-slate-300 animate-spin mx-auto mb-2" />
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Loading leave history...</p>
                                </div>
                            ) : employeeHistoryRecords.length === 0 ? (
                                <div className="py-16 text-center text-slate-400">
                                    <Activity className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                                    <p className="text-xs font-bold uppercase">No leave history records found</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {employeeHistoryRecords.map((item: any, i: number) => (
                                        <div key={item.id || i} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <Badge className="bg-slate-900 text-white font-black text-[8px] uppercase">
                                                        {(item.leave_type || 'EL').toUpperCase()}
                                                    </Badge>
                                                    <span className="text-xs font-black text-slate-800">
                                                        {item.duration || 1} Day{item.duration > 1 ? 's' : ''}
                                                    </span>
                                                    <Badge className={cn(
                                                        "text-[8px] font-black uppercase",
                                                        item.status === 'approved' ? 'bg-emerald-100 text-emerald-800' :
                                                        item.status === 'rejected' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                                                    )}>
                                                        {item.status}
                                                    </Badge>
                                                </div>
                                                <p className="text-[10px] font-bold text-slate-600">
                                                    {new Date(item.from_date).toLocaleDateString('en-GB')} – {new Date(item.to_date).toLocaleDateString('en-GB')}
                                                </p>
                                                <p className="text-[9px] text-slate-400 italic">
                                                    &ldquo;{item.reason}&rdquo;
                                                </p>
                                            </div>
                                            <div className="text-right text-[8px] font-bold uppercase text-slate-400 space-y-1">
                                                {item.payroll_treatment && (
                                                    <div className="text-indigo-600 font-black">
                                                        Payroll: {item.payroll_treatment.replace(/_/g, ' ')}
                                                    </div>
                                                )}
                                                <div>Applied: {new Date(item.created_at).toLocaleDateString('en-GB')}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </SheetContent>
                </Sheet>

            </div>
        </ProtectedRoute>
    );
}
