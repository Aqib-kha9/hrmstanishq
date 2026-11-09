"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { apiGet, apiPost, apiPatch, apiPut } from "@/lib/api-client";
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
    CheckCircle2,
    Sparkles,
    SlidersHorizontal,
    Award,
    Shield,
    Check,
    Settings2,
    RefreshCw,
    FileSpreadsheet,
    CalendarCheck,
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
    // Privilege Leave (PL)
    pl_allocated?: number;
    pl_carried_forward?: number;
    pl_used?: number;
    pl_lapsed?: number;
    pl_balance?: number;
    // Earned Leave (EL)
    el_allocated?: number;
    el_carried_forward?: number;
    el_used?: number;
    el_lapsed?: number;
    el_balance?: number;
    // Casual Leave (CL)
    cl_allocated?: number;
    cl_carried_forward?: number;
    cl_used?: number;
    cl_lapsed?: number;
    cl_balance?: number;
    // Comp-off
    comp_off_balance?: number;
    // Totals
    total_annual_entitlement?: number;
    total_paid_entitlement?: number;
    total_remaining_balance?: number;
    total_entitled?: number;
    total_balance?: number;
    total_used?: number;
    available?: number;
    used?: number;
    admin_granted?: number;
    lapsed?: number;
    pending_requests?: number;
    carry_forward_info?: any;
    lapse_info?: any;
}

const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

export default function LeavePage() {
    const { user } = useAuth();
    const isAdmin = user?.role === "ADMIN";

    // Tab state: "requests" | "history" | "balances" (Req 2.6)
    const [activeTab, setActiveTab] = useState<"requests" | "history" | "balances">("requests");
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

    // Leave History Drawer State with Month-wise review (Req 2.6)
    const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);
    const [historyEmployee, setHistoryEmployee] = useState<any>(null);
    const [employeeHistoryRecords, setEmployeeHistoryRecords] = useState<any[]>([]);
    const [historySummary, setHistorySummary] = useState<any>(null);
    const [historyBalance, setHistoryBalance] = useState<any>(null);
    const [historyMonthlyDistribution, setHistoryMonthlyDistribution] = useState<any[]>([]);
    const [historySelectedMonth, setHistorySelectedMonth] = useState<number | "all">("all");
    const [historySelectedMonthData, setHistorySelectedMonthData] = useState<any>(null);
    const [historyFilterTab, setHistoryFilterTab] = useState<"all" | "approved" | "pending" | "rejected">("all");
    const [loadingHistory, setLoadingHistory] = useState(false);

    // Staff Balances & History Master Table State (Req 2.6)
    const [staffSummaryList, setStaffSummaryList] = useState<any[]>([]);
    const [staffSummaryLoading, setStaffSummaryLoading] = useState(false);
    const [staffSelectedMonth, setStaffSelectedMonth] = useState<number | "all">("all");
    const [staffSearchTerm, setStaffSearchTerm] = useState("");

    // Leave Policy Configuration Dialog (Req 2.6)
    const [isPolicyOpen, setIsPolicyOpen] = useState(false);
    const [policyLoading, setPolicyLoading] = useState(false);
    const [policySaving, setPolicySaving] = useState(false);
    const [rolloverRunning, setRolloverRunning] = useState(false);
    const [policyConfig, setPolicyConfig] = useState<any>({
        pl: { entitlement: 12, carry_forward: true, max_carry_forward: 15, lapse: false },
        el: { entitlement: 12, carry_forward: true, max_carry_forward: 30, lapse: false },
        cl: { entitlement: 12, carry_forward: false, max_carry_forward: 0, lapse: true },
    });

    // Audit History Picker for Admins
    const [isAuditPickerOpen, setIsAuditPickerOpen] = useState(false);
    const [auditSelectedEmpId, setAuditSelectedEmpId] = useState("");
    const [auditEmpPreviewBalance, setAuditEmpPreviewBalance] = useState<any>(null);
    const [loadingAuditBalance, setLoadingAuditBalance] = useState(false);

    // Leave & Payroll Treatment Dialog (Req 10)
    const [isTreatmentDialogOpen, setIsTreatmentDialogOpen] = useState(false);
    const [selectedTreatmentLog, setSelectedTreatmentLog] = useState<any>(null);
    const [editTreatmentValue, setEditTreatmentValue] = useState<"paid" | "unpaid" | "adjusted_balance" | "carry_forward_next">("paid");
    const [editTreatmentRemarks, setEditTreatmentRemarks] = useState("");
    const [updatingTreatment, setUpdatingTreatment] = useState(false);

    const [balance, setBalance] = useState<LeaveBalance | null>(null);
    const [logs, setLogs] = useState<any[]>([]);

    // Application form state (Req 2.6: PL / EL / CL / Comp-Off / LWP)
    const [applyLeaveType, setApplyLeaveType] = useState<"pl" | "el" | "cl" | "lwp" | "comp_off">("cl");
    const [isHalfDay, setIsHalfDay] = useState(false);
    const [halfDaySession, setHalfDaySession] = useState<"first_half" | "second_half">("first_half");
    const [applyDays, setApplyDays] = useState(1);
    const [applyFrom, setApplyFrom] = useState("");
    const [applyTo, setApplyTo] = useState("");
    const [applyReason, setApplyReason] = useState("");
    const [applySubmitting, setApplySubmitting] = useState(false);
    const [formErrors, setFormErrors] = useState<{ from_date?: string; to_date?: string; days?: string; reason?: string; employee_id?: string }>({});
    const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
    const [selectedEmpBalance, setSelectedEmpBalance] = useState<any>(null);
    const [employees, setEmployees] = useState<any[]>([]);
    const [loadingEmployees, setLoadingEmployees] = useState(false);

    // Grant leaves form state
    const [isGrantOpen, setIsGrantOpen] = useState(false);
    const [grantEmployeeId, setGrantEmployeeId] = useState("");
    const [grantCount, setGrantCount] = useState(1);
    const [grantReason, setGrantReason] = useState("");
    const [grantSubmitting, setGrantSubmitting] = useState(false);
    const [grantErrors, setGrantErrors] = useState<{ employeeId?: string; count?: string; reason?: string }>({});

    // Fetch employee balance when selected by Admin in Apply Sheet
    useEffect(() => {
        if (selectedEmployeeId) {
            apiGet(`/leave/balance/${selectedEmployeeId}`)
                .then((data: any) => setSelectedEmpBalance(data))
                .catch(() => setSelectedEmpBalance(null));
        } else {
            setSelectedEmpBalance(null);
        }
    }, [selectedEmployeeId]);

    // Fetch employee preview balance when selected in Audit Picker
    useEffect(() => {
        if (auditSelectedEmpId) {
            setLoadingAuditBalance(true);
            apiGet(`/leave/balance/${auditSelectedEmpId}`)
                .then((res: any) => setAuditEmpPreviewBalance(res))
                .catch(() => setAuditEmpPreviewBalance(null))
                .finally(() => setLoadingAuditBalance(false));
        } else {
            setAuditEmpPreviewBalance(null);
        }
    }, [auditSelectedEmpId]);

    // Fetch complete employee leave history with optional month filter (Req 2.6)
    const fetchEmployeeHistory = async (emp: any, targetMonth: number | "all" | null = null) => {
        const empId = emp.employee_id || emp.id;
        if (!empId) return;
        setHistoryEmployee(emp);
        setHistoryDrawerOpen(true);
        setLoadingHistory(true);
        setHistoryFilterTab("all");
        const monthVal = targetMonth != null ? targetMonth : historySelectedMonth;
        setHistorySelectedMonth(monthVal);

        try {
            const params: any = {};
            if (monthVal && monthVal !== "all") {
                params.month = monthVal;
            }
            const data: any = await apiGet(`/leave/history/${empId}`, params);
            if (data && typeof data === "object") {
                setEmployeeHistoryRecords(data.history || (Array.isArray(data) ? data : (data.rows || [])));
                setHistorySummary(data.summary || null);
                setHistoryBalance(data.balance || null);
                setHistoryMonthlyDistribution(data.monthly_distribution || []);
                setHistorySelectedMonthData(data.selected_month || null);
                if (data.employee) {
                    setHistoryEmployee((prev: any) => ({
                        ...prev,
                        ...data.employee,
                        personnel: data.employee.name,
                        empCode: data.employee.emp_code,
                        department: data.employee.department,
                        designation: data.employee.designation,
                    }));
                }
            } else {
                setEmployeeHistoryRecords([]);
                setHistorySummary(null);
                setHistoryBalance(null);
                setHistoryMonthlyDistribution([]);
                setHistorySelectedMonthData(null);
            }
        } catch (err) {
            console.error("Failed to fetch employee leave history:", err);
            setEmployeeHistoryRecords([]);
            setHistorySummary(null);
            setHistoryBalance(null);
            setHistoryMonthlyDistribution([]);
            setHistorySelectedMonthData(null);
        } finally {
            setLoadingHistory(false);
        }
    };

    // Handle month filter switch in the history drawer
    const handleHistoryMonthSwitch = async (m: number | "all") => {
        setHistorySelectedMonth(m);
        if (!historyEmployee) return;
        const empId = historyEmployee.employee_id || historyEmployee.id;
        setLoadingHistory(true);
        try {
            const params: any = {};
            if (m !== "all") params.month = m;
            const data: any = await apiGet(`/leave/history/${empId}`, params);
            if (data && typeof data === "object") {
                setEmployeeHistoryRecords(data.history || []);
                setHistorySummary(data.summary || null);
                setHistoryBalance(data.balance || null);
                setHistoryMonthlyDistribution(data.monthly_distribution || []);
                setHistorySelectedMonthData(data.selected_month || null);
            }
        } catch (err) {
            console.error("Failed to update history for month:", err);
        } finally {
            setLoadingHistory(false);
        }
    };

    // Fetch Staff Balances & History Master Table (Req 2.6)
    const fetchStaffSummary = useCallback(async () => {
        setStaffSummaryLoading(true);
        try {
            const params: any = {};
            if (staffSelectedMonth !== "all") params.month = staffSelectedMonth;
            if (selectedBranch !== "All Branches") params.department = selectedBranch;
            if (staffSearchTerm) params.search = staffSearchTerm;

            const res: any = await apiGet("/leave/employees-summary", params);
            const list = Array.isArray(res) ? res : (res.data || res.rows || []);
            setStaffSummaryList(list);
        } catch (err) {
            console.error("Failed to fetch staff summary:", err);
            setStaffSummaryList([]);
        } finally {
            setStaffSummaryLoading(false);
        }
    }, [staffSelectedMonth, selectedBranch, staffSearchTerm]);

    // Fetch Leave Policy Configuration (Req 2.6)
    const fetchPolicyConfig = async () => {
        setPolicyLoading(true);
        try {
            const data: any = await apiGet("/leave/policy");
            if (data) {
                setPolicyConfig(data);
            }
        } catch (err) {
            console.error("Failed to fetch leave policy:", err);
        } finally {
            setPolicyLoading(false);
        }
    };

    // Save Leave Policy Configuration
    const handleSavePolicy = async () => {
        setPolicySaving(true);
        try {
            await apiPut("/leave/policy", policyConfig);
            alert("Leave policy configuration updated successfully!");
            setIsPolicyOpen(false);
            fetchBalance();
            if (activeTab === "balances") fetchStaffSummary();
        } catch (err: any) {
            alert(err?.response?.data?.message || "Failed to update leave policy");
        } finally {
            setPolicySaving(false);
        }
    };

    // Execute Year-End Rollover & Lapse
    const handleRunRollover = async () => {
        const confirmMsg = "Are you sure you want to run Annual Leave Rollover? This will carry forward eligible PL and EL balances (subject to policy caps) and lapse all unused CL balances for all employees.";
        if (!confirm(confirmMsg)) return;

        setRolloverRunning(true);
        try {
            const currentYear = new Date().getFullYear();
            const res: any = await apiPost("/leave/policy/rollover", {
                fromYear: currentYear,
                toYear: currentYear + 1,
            });
            alert(res?.message || "Annual rollover executed successfully!");
            fetchBalance();
            if (activeTab === "balances") fetchStaffSummary();
        } catch (err: any) {
            alert(err?.response?.data?.message || "Failed to execute rollover");
        } finally {
            setRolloverRunning(false);
        }
    };

    const handleOpenAuditFromPicker = () => {
        if (!auditSelectedEmpId) return;
        const emp = employees.find((e) => String(e.id) === String(auditSelectedEmpId));
        setIsAuditPickerOpen(false);
        if (emp) {
            fetchEmployeeHistory(emp);
        } else {
            fetchEmployeeHistory({ id: Number(auditSelectedEmpId), personnel: `Employee #${auditSelectedEmpId}` });
        }
    };

    const todayStr = new Date().toISOString().split("T")[0];

    // Auto-calculate business days from date range
    useEffect(() => {
        if (isHalfDay) {
            setApplyDays(0.5);
            return;
        }
        if (applyFrom && applyTo) {
            const f = new Date(applyFrom);
            const t = new Date(applyTo);
            if (f <= t) {
                const diff = Math.ceil((t.getTime() - f.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                setApplyDays(diff > 0 ? diff : 1);
            }
        }
    }, [applyFrom, applyTo, isHalfDay]);

    const validateLeaveForm = (): boolean => {
        const errors: { from_date?: string; to_date?: string; days?: string; reason?: string; employee_id?: string } = {};
        if (isAdmin && !selectedEmployeeId) errors.employee_id = "Please select an employee";
        if (!applyFrom) errors.from_date = "Start date is required";
        else if (applyFrom < todayStr) errors.from_date = "Start date cannot be in the past";
        if (!applyTo) errors.to_date = "End date is required";
        else if (applyTo < todayStr) errors.to_date = "End date cannot be in the past";
        else if (applyTo < applyFrom) errors.to_date = "End date must be after start date";

        // Check available annual balance for selected type (Req 2.6: PL / EL / CL / Comp-Off)
        const targetBalance = selectedEmployeeId ? selectedEmpBalance : balance;
        let availableForType = 12;
        if (applyLeaveType === "pl") {
            availableForType = targetBalance?.pl_balance ?? 12;
        } else if (applyLeaveType === "el") {
            availableForType = targetBalance?.el_balance ?? 12;
        } else if (applyLeaveType === "cl") {
            availableForType = targetBalance?.cl_balance ?? 12;
        } else if (applyLeaveType === "comp_off") {
            availableForType = targetBalance?.comp_off_balance ?? 0;
        } else if (applyLeaveType === "lwp") {
            availableForType = 999;
        }

        const durationVal = isHalfDay ? 0.5 : applyDays;
        if (durationVal <= 0) {
            errors.days = "Duration must be at least 0.5 days";
        } else if (applyLeaveType !== "lwp" && targetBalance && durationVal > availableForType) {
            errors.days = `Insufficient ${applyLeaveType.toUpperCase()} balance (${availableForType} days available, ${durationVal} requested)`;
        }

        if (!applyReason || applyReason.trim().length < 10) errors.reason = "Reason must be at least 10 characters";
        else if (applyReason.length > 500) errors.reason = "Reason must be under 500 characters";
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
        if (activeTab === "balances") {
            fetchStaffSummary();
            return;
        }
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
                    type: (r.leave_type || "CL").toUpperCase(),
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
    }, [activeTab, selectedBranch, searchTerm, historyFrom, historyTo, isAdmin, user?.role, fetchStaffSummary]);

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

    const handleUpdateTreatment = async () => {
        if (!selectedTreatmentLog) return;
        setUpdatingTreatment(true);
        try {
            await apiPatch(`/leave/${selectedTreatmentLog.id}/payroll-treatment`, {
                payroll_treatment: editTreatmentValue,
                remarks: editTreatmentRemarks || undefined,
                is_paid: editTreatmentValue !== "unpaid",
            });
            setIsTreatmentDialogOpen(false);
            fetchRequests();
            fetchBalance();
            if (historyDrawerOpen && historyEmployee) {
                fetchEmployeeHistory(historyEmployee);
            }
        } catch (err: any) {
            alert(err?.response?.data?.message || "Failed to update payroll treatment");
        } finally {
            setUpdatingTreatment(false);
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
                to_date: isHalfDay ? applyFrom : applyTo,
                duration: isHalfDay ? 0.5 : applyDays,
                reason: applyReason.trim(),
                is_half_day: isHalfDay,
                half_day_session: isHalfDay ? halfDaySession : undefined,
            };
            if (isAdmin && selectedEmployeeId) {
                payload.employee_id = Number(selectedEmployeeId);
            }
            await apiPost("/leave/apply", payload);
            setIsApplyOpen(false);
            resetApplyForm();
            fetchRequests();
            fetchBalance();
            if (activeTab === "balances") fetchStaffSummary();
        } catch (err: any) {
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
        setIsHalfDay(false);
        setHalfDaySession("first_half");
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
            if (activeTab === "balances") fetchStaffSummary();
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
                        <h1 className="text-2xl font-black text-slate-900 italic uppercase tracking-tighter underline underline-offset-8 decoration-[#D9F99D] decoration-4">
                            Leave Management
                        </h1>
                        <p className="text-[10px] font-bold text-slate-400 mt-4 uppercase tracking-[0.2em]">
                            PL (Privilege) • EL (Earned) • CL (Casual) • Absences & Policy Tracking
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        {/* Tab Switcher (Req 2.6: Requests / Archive / Staff Balances & History) */}
                        <div className="flex bg-slate-100 p-1 rounded-2xl shadow-inner">
                            <Button
                                onClick={() => setActiveTab("requests")}
                                variant="ghost"
                                className={cn(
                                    "h-11 px-5 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all",
                                    activeTab === "requests" ? "bg-white shadow-sm text-slate-900" : "text-slate-400"
                                )}
                            >
                                Pending Requests
                            </Button>
                            <Button
                                onClick={() => setActiveTab("history")}
                                variant="ghost"
                                className={cn(
                                    "h-11 px-5 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all",
                                    activeTab === "history" ? "bg-white shadow-sm text-slate-900" : "text-slate-400"
                                )}
                            >
                                Archive History
                            </Button>
                            <Button
                                onClick={() => { setActiveTab("balances"); fetchStaffSummary(); }}
                                variant="ghost"
                                className={cn(
                                    "h-11 px-5 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all",
                                    activeTab === "balances" ? "bg-white shadow-sm text-slate-900" : "text-slate-400"
                                )}
                            >
                                Staff Balances & History
                            </Button>
                        </div>

                        {isAdmin && (
                            <Button
                                onClick={() => { setIsPolicyOpen(true); fetchPolicyConfig(); }}
                                variant="outline"
                                className="h-11 px-4 rounded-2xl border-slate-200 bg-white hover:bg-slate-50 font-black uppercase text-[9px] tracking-widest shadow-sm transition-all text-slate-700"
                            >
                                <SlidersHorizontal className="h-4 w-4 mr-2 text-indigo-600" /> Leave Policy
                            </Button>
                        )}

                        {isAdmin && (
                            <Button
                                onClick={() => { setIsAuditPickerOpen(true); fetchEmployees(); }}
                                variant="outline"
                                className="h-11 px-4 rounded-2xl border-slate-200 bg-white hover:bg-slate-50 font-black uppercase text-[9px] tracking-widest shadow-sm transition-all text-slate-700"
                            >
                                <History className="h-4 w-4 mr-2 text-indigo-600" /> Audit History
                            </Button>
                        )}

                        {isAdmin && (
                            <Sheet open={isGrantOpen} onOpenChange={(v) => { setIsGrantOpen(v); if (!v) { setGrantEmployeeId(""); setGrantCount(1); setGrantReason(""); setGrantErrors({}); } else { fetchEmployees(); } }}>
                                <SheetTrigger asChild>
                                    <Button className="bg-[#D1FAE5] text-emerald-800 hover:bg-[#A7F3D0] font-black uppercase text-[9px] tracking-widest px-6 h-11 rounded-2xl shadow-sm transition-all border border-emerald-200">
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
                                                Grant bonus leaves to an employee. These leaves are credited to comp-off balance.
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
                                                    <Label className={cn("text-[9px] font-black uppercase tracking-widest", grantErrors.reason ? "text-rose-500" : "text-slate-400")}>Reason for Grant</Label>
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
                            <SheetContent className="sm:max-w-[560px] border-none shadow-2xl p-0 overflow-y-auto">
                                <div className="h-2 bg-[#D9F99D]" />
                                <div className="p-8 space-y-8">
                                    <SheetHeader className="text-left space-y-2">
                                        <div className="h-12 w-12 rounded-2xl bg-slate-50 flex items-center justify-center">
                                            <Plane className="h-6 w-6 text-indigo-500" />
                                        </div>
                                        <SheetTitle className="text-2xl font-black italic uppercase text-slate-900 tracking-tighter">Apply for Leave</SheetTitle>
                                        <SheetDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-loose">
                                            Annual Entitlement: 12 PL + 12 EL + 12 CL = 36 Total Paid Days/Year (Req 2.6)
                                        </SheetDescription>
                                    </SheetHeader>
                                    <div className="grid gap-6">
                                        <div className="space-y-5">
                                            <div className="flex items-start gap-3 p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                                                <Info className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />
                                                <div className="space-y-1">
                                                    <p className="text-[10px] font-black text-indigo-900 uppercase tracking-wide">
                                                        Leave Categories & Entitlements (Req 2.6)
                                                    </p>
                                                    <p className="text-[9px] font-bold text-indigo-700 uppercase tracking-wide leading-relaxed">
                                                        • <strong>PL (Privilege Leave):</strong> 12 days/yr • Carry-forward permitted.<br />
                                                        • <strong>EL (Earned Leave):</strong> 12 days/yr • Carry-forward permitted.<br />
                                                        • <strong>CL (Casual Leave):</strong> 12 days/yr • Resets / Lapses annually.<br />
                                                        • Total Paid Entitlement: <strong>36 Days / Year</strong> (+ Carried Forward).
                                                    </p>
                                                </div>
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
                                                    <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Leave Category (Req 2.6)</Label>
                                                    <select
                                                        value={applyLeaveType}
                                                        onChange={(e: any) => setApplyLeaveType(e.target.value)}
                                                        className="h-12 w-full rounded-xl bg-slate-50 border border-slate-100 px-4 font-bold text-[11px] text-slate-700 outline-none cursor-pointer"
                                                    >
                                                        <option value="pl">PL — Privilege Leave (12/yr, Carryover)</option>
                                                        <option value="el">EL — Earned Leave (12/yr, Carryover)</option>
                                                        <option value="cl">CL — Casual Leave (12/yr, Lapses)</option>
                                                        <option value="comp_off">Comp-Off (From Weekend Work)</option>
                                                        <option value="lwp">LWP — Leave Without Pay (Unpaid)</option>
                                                    </select>
                                                </div>

                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Duration</Label>
                                                        <span className="text-[8px] font-bold text-slate-300 uppercase tracking-wider">{isHalfDay ? "Half Day (0.5)" : "Auto-calculated"}</span>
                                                    </div>
                                                    <div className={cn(
                                                        "h-12 rounded-xl border flex items-center px-4 font-bold text-[11px] transition-all",
                                                        formErrors.days ? "bg-rose-50 border-rose-200 text-rose-600" : "bg-indigo-50/50 border-indigo-100 text-indigo-700"
                                                    )}>
                                                        <CalendarDays className="h-4 w-4 mr-2 opacity-50" />
                                                        {isHalfDay ? "0.5 Day (Half Day)" : (applyFrom && applyTo ? `${applyDays} day${applyDays !== 1 ? 's' : ''}` : "—")}
                                                    </div>
                                                    {formErrors.days && (
                                                        <p className="text-[8px] font-bold text-rose-500 uppercase tracking-wider flex items-center gap-1">
                                                            <ShieldAlert className="h-2.5 w-2.5" /> {formErrors.days}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Half-Day Toggle (Req 2.6) */}
                                            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="checkbox"
                                                        id="isHalfDayCheck"
                                                        checked={isHalfDay}
                                                        onChange={(e) => setIsHalfDay(e.target.checked)}
                                                        className="h-4 w-4 text-indigo-600 rounded cursor-pointer"
                                                    />
                                                    <label htmlFor="isHalfDayCheck" className="text-[10px] font-black uppercase tracking-wider text-slate-700 cursor-pointer">
                                                        Half Day Leave (0.5 Day)
                                                    </label>
                                                </div>
                                                {isHalfDay && (
                                                    <select
                                                        value={halfDaySession}
                                                        onChange={(e: any) => setHalfDaySession(e.target.value)}
                                                        className="h-8 px-2 rounded-lg bg-white border border-slate-200 text-[9px] font-bold uppercase outline-none"
                                                    >
                                                        <option value="first_half">First Half</option>
                                                        <option value="second_half">Second Half</option>
                                                    </select>
                                                )}
                                            </div>

                                            {/* Live Balance indicator for selected type (Req 2.6) */}
                                            {(() => {
                                                const targetBalance = selectedEmployeeId ? selectedEmpBalance : balance;
                                                let curBal = 12;
                                                let allocated = 12;
                                                let typeLabel = "Privilege Leave (PL)";
                                                let carryRule = "Carryover Permitted";

                                                if (applyLeaveType === "pl") {
                                                    curBal = targetBalance?.pl_balance ?? 12;
                                                    allocated = (targetBalance?.pl_allocated ?? 12) + (targetBalance?.pl_carried_forward ?? 0);
                                                    typeLabel = "Privilege Leave (PL)";
                                                    carryRule = "Carryover Permitted";
                                                } else if (applyLeaveType === "el") {
                                                    curBal = targetBalance?.el_balance ?? 12;
                                                    allocated = (targetBalance?.el_allocated ?? 12) + (targetBalance?.el_carried_forward ?? 0);
                                                    typeLabel = "Earned Leave (EL)";
                                                    carryRule = "Carryover Permitted";
                                                } else if (applyLeaveType === "cl") {
                                                    curBal = targetBalance?.cl_balance ?? 12;
                                                    allocated = targetBalance?.cl_allocated ?? 12;
                                                    typeLabel = "Casual Leave (CL)";
                                                    carryRule = "Lapses Annually at Year-End";
                                                } else if (applyLeaveType === "comp_off") {
                                                    curBal = targetBalance?.comp_off_balance ?? 0;
                                                    allocated = curBal;
                                                    typeLabel = "Compensatory Off";
                                                    carryRule = "Earned from Weekend Work";
                                                } else {
                                                    curBal = 999;
                                                    allocated = 999;
                                                    typeLabel = "Leave Without Pay (LWP)";
                                                    carryRule = "Subject to Payroll Deduction";
                                                }

                                                return (
                                                    <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80">
                                                        <div className="space-y-0.5">
                                                            <span className="text-[9px] font-black uppercase tracking-wider text-slate-700 block">
                                                                {typeLabel} Balance
                                                            </span>
                                                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                                                                {applyLeaveType === 'lwp' ? 'Unpaid absence' : `${curBal} remaining of ${allocated} annual days • ${carryRule}`}
                                                            </span>
                                                        </div>
                                                        <Badge className={cn(
                                                            "font-black text-[10px] uppercase border-none px-3 h-6 rounded-lg shadow-xs",
                                                            curBal > 0 || applyLeaveType === 'lwp' ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                                                        )}>
                                                            {applyLeaveType === 'lwp' ? 'Uncapped' : `${curBal} Day${curBal !== 1 ? 's' : ''} Avail.`}
                                                        </Badge>
                                                    </div>
                                                );
                                            })()}

                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label className={cn("text-[9px] font-black uppercase tracking-widest", formErrors.from_date ? "text-rose-500" : "text-slate-400")}>Start Date</Label>
                                                    <Input
                                                        type="date"
                                                        min={todayStr}
                                                        value={applyFrom}
                                                        onChange={(e) => {
                                                            setApplyFrom(e.target.value);
                                                            if (isHalfDay) setApplyTo(e.target.value);
                                                            setFormErrors((prev) => ({ ...prev, from_date: undefined, days: undefined }));
                                                        }}
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
                                                        disabled={isHalfDay}
                                                        value={isHalfDay ? applyFrom : applyTo}
                                                        onChange={(e) => { setApplyTo(e.target.value); setFormErrors((prev) => ({ ...prev, to_date: undefined, days: undefined })); }}
                                                        className={cn(
                                                            "h-12 rounded-xl font-bold text-[11px] transition-all",
                                                            formErrors.to_date ? "bg-rose-50 border-rose-200 text-rose-600 focus-visible:ring-rose-200" : "bg-slate-50 border-slate-100",
                                                            isHalfDay ? "opacity-60 cursor-not-allowed" : ""
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

                {/* Annual Leave Structure Cards (Req 2.6: 12 PL + 12 EL + 12 CL = 36 Total) */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 px-2">
                    {/* Privilege Leave (PL) */}
                    <Card className="bg-[#EEF2FF] border-none rounded-2xl p-5 shadow-sm flex flex-col justify-between h-36 group hover:shadow-md transition-all">
                        <div className="flex items-center justify-between">
                            <div className="h-8 w-8 bg-white/70 rounded-lg flex items-center justify-center">
                                <Award className="h-4 w-4 text-indigo-600" />
                            </div>
                            <Badge className="bg-indigo-600 text-white border-none font-black text-[7px] uppercase tracking-widest px-2 h-5 rounded-md">CF Allowed</Badge>
                        </div>
                        <div>
                            <div className="flex items-center justify-between">
                                <p className="text-[8px] font-black text-indigo-500 uppercase tracking-widest mb-0.5">Privilege (PL)</p>
                                <span className="text-[8px] font-bold text-indigo-700">+{balance?.pl_carried_forward ?? 0} CF</span>
                            </div>
                            <h3 className="text-xl font-black text-indigo-950 italic tracking-tighter">
                                {balance?.pl_balance ?? 12} <span className="text-[9px] uppercase font-bold text-indigo-400 not-italic ml-1">/ {balance?.pl_allocated ?? 12} d</span>
                            </h3>
                        </div>
                    </Card>

                    {/* Earned Leave (EL) */}
                    <Card className="bg-[#DCFCE7] border-none rounded-2xl p-5 shadow-sm flex flex-col justify-between h-36 group hover:shadow-md transition-all">
                        <div className="flex items-center justify-between">
                            <div className="h-8 w-8 bg-white/70 rounded-lg flex items-center justify-center">
                                <Plane className="h-4 w-4 text-emerald-600" />
                            </div>
                            <Badge className="bg-emerald-600 text-white border-none font-black text-[7px] uppercase tracking-widest px-2 h-5 rounded-md">CF Allowed</Badge>
                        </div>
                        <div>
                            <div className="flex items-center justify-between">
                                <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest mb-0.5">Earned (EL)</p>
                                <span className="text-[8px] font-bold text-emerald-700">+{balance?.el_carried_forward ?? 0} CF</span>
                            </div>
                            <h3 className="text-xl font-black text-emerald-950 italic tracking-tighter">
                                {balance?.el_balance ?? 12} <span className="text-[9px] uppercase font-bold text-emerald-500 not-italic ml-1">/ {balance?.el_allocated ?? 12} d</span>
                            </h3>
                        </div>
                    </Card>

                    {/* Casual Leave (CL) */}
                    <Card className="bg-[#F3E8FF] border-none rounded-2xl p-5 shadow-sm flex flex-col justify-between h-36 group hover:shadow-md transition-all">
                        <div className="flex items-center justify-between">
                            <div className="h-8 w-8 bg-white/70 rounded-lg flex items-center justify-center">
                                <CalendarDays className="h-4 w-4 text-purple-600" />
                            </div>
                            <Badge className="bg-purple-600 text-white border-none font-black text-[7px] uppercase tracking-widest px-2 h-5 rounded-md">Lapses</Badge>
                        </div>
                        <div>
                            <div className="flex items-center justify-between">
                                <p className="text-[8px] font-black text-purple-500 uppercase tracking-widest mb-0.5">Casual (CL)</p>
                                <span className="text-[8px] font-bold text-purple-600">No Carry</span>
                            </div>
                            <h3 className="text-xl font-black text-purple-950 italic tracking-tighter">
                                {balance?.cl_balance ?? 12} <span className="text-[9px] uppercase font-bold text-purple-400 not-italic ml-1">/ {balance?.cl_allocated ?? 12} d</span>
                            </h3>
                        </div>
                    </Card>

                    {/* Total Annual Entitlement */}
                    <Card className="bg-[#FEF3C7] border-none rounded-2xl p-5 shadow-sm flex flex-col justify-between h-36 group hover:shadow-md transition-all">
                        <div className="flex items-center justify-between">
                            <div className="h-8 w-8 bg-white/70 rounded-lg flex items-center justify-center">
                                <TrendingUp className="h-4 w-4 text-amber-600" />
                            </div>
                            <Badge className="bg-amber-600 text-white border-none font-black text-[7px] uppercase tracking-widest px-2 h-5 rounded-md">Annual Total</Badge>
                        </div>
                        <div>
                            <p className="text-[8px] font-black text-amber-600 uppercase tracking-widest mb-0.5">Paid Entitlement</p>
                            <h3 className="text-xl font-black text-amber-950 italic tracking-tighter">
                                {balance?.total_paid_entitlement ?? balance?.total_annual_entitlement ?? 36} <span className="text-[9px] uppercase font-bold text-amber-600 not-italic ml-1">Days</span>
                            </h3>
                            <p className="text-[7px] font-bold text-amber-700 uppercase tracking-wider mt-0.5">12 PL + 12 EL + 12 CL</p>
                        </div>
                    </Card>

                    {/* Total Leave Taken */}
                    <Card className="bg-[#FEE2E2] border-none rounded-2xl p-5 shadow-sm flex flex-col justify-between h-36 group hover:shadow-md transition-all">
                        <div className="flex items-center justify-between">
                            <div className="h-8 w-8 bg-white/70 rounded-lg flex items-center justify-center">
                                <TrendingDown className="h-4 w-4 text-rose-600" />
                            </div>
                            <Badge className="bg-rose-600 text-white border-none font-black text-[7px] uppercase tracking-widest px-2 h-5 rounded-md">Consumed</Badge>
                        </div>
                        <div>
                            <p className="text-[8px] font-black text-rose-500 uppercase tracking-widest mb-0.5">Leave Taken</p>
                            <h3 className="text-xl font-black text-rose-900 italic tracking-tighter">
                                {balance?.total_used ?? balance?.used ?? 0} <span className="text-[9px] uppercase font-bold text-rose-400 not-italic ml-1">Days</span>
                            </h3>
                            <p className="text-[7px] font-bold text-rose-600 uppercase tracking-wider mt-0.5">Approved Absences</p>
                        </div>
                    </Card>

                    {/* Remaining Leave Balance */}
                    <Card className="bg-[#E0F2FE] border-none rounded-2xl p-5 shadow-sm flex flex-col justify-between h-36 group hover:shadow-md transition-all">
                        <div className="flex items-center justify-between">
                            <div className="h-8 w-8 bg-white/70 rounded-lg flex items-center justify-center">
                                <CheckCircle2 className="h-4 w-4 text-sky-600" />
                            </div>
                            <Badge className="bg-sky-600 text-white border-none font-black text-[7px] uppercase tracking-widest px-2 h-5 rounded-md">Usable</Badge>
                        </div>
                        <div>
                            <p className="text-[8px] font-black text-sky-600 uppercase tracking-widest mb-0.5">Remaining Balance</p>
                            <h3 className="text-xl font-black text-sky-950 italic tracking-tighter">
                                {balance?.total_remaining_balance ?? balance?.available ?? 36} <span className="text-[9px] uppercase font-bold text-sky-500 not-italic ml-1">Days</span>
                            </h3>
                            <p className="text-[7px] font-bold text-sky-700 uppercase tracking-wider mt-0.5">PL + EL + CL + Comp</p>
                        </div>
                    </Card>
                </div>

                {/* Enterprise Leave Policy Notice (Req 2.6) */}
                <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100 mx-2">
                    <Info className="h-4 w-4 text-indigo-500 mt-0.5 shrink-0" />
                    <div className="space-y-1">
                        <p className="text-[10px] font-black text-slate-800 uppercase tracking-wide">Enterprise Annual Leave Policy (Req 2.6)</p>
                        <p className="text-[9px] font-bold text-slate-500 uppercase leading-relaxed">
                            36 Total Annual Paid Leave Days • 12 Privilege Leaves (PL - Carry-forward permitted) • 12 Earned Leaves (EL - Carry-forward permitted) • 12 Casual Leaves (CL - Lapses annually at year-end) • Half-day (0.5 d) and Leave Without Pay (LWP) are tracked separately.
                        </p>
                    </div>
                </div>

                {/* ── TAB CONTENT: STAFF BALANCES & HISTORY MASTER TABLE (Req 2.6) ── */}
                {activeTab === "balances" ? (
                    <div className="space-y-6">
                        {/* Search & Month Filter Toolbar */}
                        <Card className="border-none shadow-sm rounded-[2rem] bg-white p-3 mx-2">
                            <div className="flex flex-wrap items-center justify-between gap-4">
                                <div className="flex flex-wrap items-center gap-3">
                                    {/* Month Selector for Reviewing Monthly Days Taken (Req 2.6: Historical months such as October and November) */}
                                    <div className="flex items-center gap-2 bg-slate-50 px-3 h-10 rounded-xl border border-slate-200">
                                        <CalendarCheck className="h-3.5 w-3.5 text-indigo-500" />
                                        <select
                                            className="bg-transparent border-none text-[9px] font-black uppercase outline-none pr-2 h-full cursor-pointer text-slate-800"
                                            value={staffSelectedMonth}
                                            onChange={(e) => {
                                                const val = e.target.value === "all" ? "all" : Number(e.target.value);
                                                setStaffSelectedMonth(val);
                                            }}
                                        >
                                            <option value="all">Annual (All Months)</option>
                                            {MONTH_NAMES.map((name, idx) => (
                                                <option key={name} value={idx + 1}>
                                                    Month: {name} (Review Days Off)
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Branch Filter */}
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

                                    {/* Search by Employee ID or Name */}
                                    <div className="relative group min-w-[220px]">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                                        <Input
                                            placeholder="Search by ID or Name..."
                                            className="h-10 pl-9 pr-4 w-full bg-slate-50 border-none rounded-xl text-[10px] font-bold focus:bg-white transition-all"
                                            value={staffSearchTerm}
                                            onChange={(e) => setStaffSearchTerm(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <Button
                                        onClick={fetchStaffSummary}
                                        variant="outline"
                                        className="h-10 px-4 rounded-xl border-slate-200 font-black text-[9px] uppercase tracking-widest text-slate-700"
                                    >
                                        <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", staffSummaryLoading && "animate-spin")} /> Refresh
                                    </Button>
                                </div>
                            </div>
                        </Card>

                        {/* Master Table of Employee Leave History & Balances */}
                        <Card className="border-none shadow-sm rounded-[2.5rem] bg-white overflow-hidden mx-2">
                            <CardHeader className="p-8 pb-4 border-none">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="text-xl font-black italic uppercase text-slate-900 tracking-tighter underline underline-offset-4 decoration-[#D9F99D]">
                                            Employee Leave History & Balances (Req 2.6)
                                        </CardTitle>
                                        <CardDescription className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                            {staffSelectedMonth !== "all"
                                                ? `Reviewing days taken off in ${MONTH_NAMES[(staffSelectedMonth as number) - 1]} & annual category balances`
                                                : "Master overview of annual entitlements, PL/EL/CL quotas, taken and remaining balances"}
                                        </CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader>
                                        <tr className="bg-slate-50/50 border-b border-slate-100">
                                            <th className="text-left py-4 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Employee ID</th>
                                            <th className="text-left py-4 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Employee & Dept</th>
                                            <th className="text-center py-4 px-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Paid Entitlement</th>
                                            <th className="text-center py-4 px-3 text-[9px] font-black text-indigo-600 uppercase tracking-widest">PL Balance</th>
                                            <th className="text-center py-4 px-3 text-[9px] font-black text-emerald-600 uppercase tracking-widest">EL Balance</th>
                                            <th className="text-center py-4 px-3 text-[9px] font-black text-purple-600 uppercase tracking-widest">CL Balance</th>
                                            <th className="text-center py-4 px-3 text-[9px] font-black text-rose-600 uppercase tracking-widest">Total Taken</th>
                                            <th className="text-center py-4 px-3 text-[9px] font-black text-sky-600 uppercase tracking-widest">Remaining</th>
                                            {staffSelectedMonth !== "all" && (
                                                <th className="text-center py-4 px-3 text-[9px] font-black text-amber-700 uppercase tracking-widest bg-amber-50/50">
                                                    {MONTH_NAMES[(staffSelectedMonth as number) - 1]} Days Off
                                                </th>
                                            )}
                                            <th className="text-left py-4 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Carry-Forward / Lapse</th>
                                            <th className="text-right py-4 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">History Log</th>
                                        </tr>
                                    </TableHeader>
                                    <TableBody>
                                        {staffSummaryLoading ? (
                                            <tr>
                                                <td colSpan={11} className="py-20 text-center">
                                                    <Loader2 className="h-8 w-8 text-indigo-500 animate-spin mx-auto mb-3" />
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Loading employee leave records...</p>
                                                </td>
                                            </tr>
                                        ) : staffSummaryList.map((emp) => (
                                            <TableRow key={emp.id} className="group border-none hover:bg-slate-50/40 transition-all border-b border-slate-50 last:border-none">
                                                {/* Employee ID */}
                                                <td className="py-4 px-4">
                                                    <Badge variant="outline" className="font-mono font-black text-[10px] text-slate-700 bg-slate-50 border-slate-200">
                                                        {emp.emp_code}
                                                    </Badge>
                                                </td>

                                                {/* Employee & Dept */}
                                                <td className="py-4 px-4">
                                                    <div className="flex flex-col">
                                                        <span className="text-[11px] font-black text-slate-900 uppercase italic tracking-tight">{emp.name}</span>
                                                        <div className="flex items-center gap-1.5 text-[8px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                                                            <span>{emp.department}</span>
                                                            <span>•</span>
                                                            <span>{emp.designation}</span>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Total Paid Entitlement */}
                                                <td className="py-4 px-3 text-center">
                                                    <span className="font-black text-xs text-amber-900 bg-amber-50 px-2 py-1 rounded-md border border-amber-200/80">
                                                        {emp.total_paid_entitlement} d
                                                    </span>
                                                </td>

                                                {/* PL Balance */}
                                                <td className="py-4 px-3 text-center">
                                                    <div className="inline-flex flex-col items-center">
                                                        <span className="font-black text-xs text-indigo-700">
                                                            {emp.pl_balance}
                                                        </span>
                                                        <span className="text-[7px] font-bold text-slate-400">/ {emp.pl_allocated} d</span>
                                                    </div>
                                                </td>

                                                {/* EL Balance */}
                                                <td className="py-4 px-3 text-center">
                                                    <div className="inline-flex flex-col items-center">
                                                        <span className="font-black text-xs text-emerald-700">
                                                            {emp.el_balance}
                                                        </span>
                                                        <span className="text-[7px] font-bold text-slate-400">/ {emp.el_allocated} d</span>
                                                    </div>
                                                </td>

                                                {/* CL Balance */}
                                                <td className="py-4 px-3 text-center">
                                                    <div className="inline-flex flex-col items-center">
                                                        <span className="font-black text-xs text-purple-700">
                                                            {emp.cl_balance}
                                                        </span>
                                                        <span className="text-[7px] font-bold text-slate-400">/ {emp.cl_allocated} d</span>
                                                    </div>
                                                </td>

                                                {/* Total Leave Taken */}
                                                <td className="py-4 px-3 text-center">
                                                    <span className="font-black text-xs text-rose-700">
                                                        {emp.total_leave_taken} d
                                                    </span>
                                                </td>

                                                {/* Remaining Leave Balance */}
                                                <td className="py-4 px-3 text-center">
                                                    <span className="font-black text-xs text-sky-800 bg-sky-50 px-2 py-1 rounded-md border border-sky-200">
                                                        {emp.remaining_leave_balance} d
                                                    </span>
                                                </td>

                                                {/* Selected Month Days Off (e.g. October / November review) */}
                                                {staffSelectedMonth !== "all" && (
                                                    <td className="py-4 px-3 text-center bg-amber-50/30">
                                                        <Badge className={cn(
                                                            "font-black text-[9px] border-none px-2 py-0.5",
                                                            (emp.selected_month_data?.days_taken ?? 0) > 0 ? "bg-amber-500 text-white" : "bg-slate-100 text-slate-500"
                                                        )}>
                                                            {emp.selected_month_data?.days_taken ?? 0} d
                                                        </Badge>
                                                    </td>
                                                )}

                                                {/* Carry-Forward / Lapse Information */}
                                                <td className="py-4 px-4">
                                                    <div className="flex flex-wrap items-center gap-1 text-[7px] font-black uppercase">
                                                        <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
                                                            PL: +{emp.pl_carried_forward} CF
                                                        </Badge>
                                                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                                                            EL: +{emp.el_carried_forward} CF
                                                        </Badge>
                                                        <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                                                            CL: Lapses
                                                        </Badge>
                                                    </div>
                                                </td>

                                                {/* Action: Month-wise review */}
                                                <td className="py-4 px-4 text-right">
                                                    <Button
                                                        onClick={() => fetchEmployeeHistory(emp, staffSelectedMonth !== "all" ? staffSelectedMonth : null)}
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-8 px-3 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-black text-[8px] uppercase tracking-wider"
                                                    >
                                                        <History className="h-3 w-3 mr-1 text-indigo-600" />
                                                        {staffSelectedMonth !== "all" ? `${MONTH_NAMES[(staffSelectedMonth as number) - 1]} Review` : "History"}
                                                    </Button>
                                                </td>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                                {!staffSummaryLoading && staffSummaryList.length === 0 && (
                                    <div className="py-20 text-center space-y-3">
                                        <div className="h-16 w-16 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-slate-100 shadow-sm">
                                            <Activity className="h-8 w-8 text-slate-200" />
                                        </div>
                                        <h3 className="text-sm font-black uppercase text-slate-400 italic tracking-widest">No staff records found</h3>
                                        <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">Try adjusting your branch or search filters</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                ) : (
                    /* ── TAB CONTENT: REQUESTS & ARCHIVE QUEUE ── */
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
                                                        {row.type === 'PL' ? (
                                                            <span className="w-fit text-[9px] font-black text-indigo-700 uppercase tracking-tight italic bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-200 shadow-xs">
                                                                PL (Privilege)
                                                            </span>
                                                        ) : row.type === 'EL' ? (
                                                            <span className="w-fit text-[9px] font-black text-emerald-700 uppercase tracking-tight italic bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 shadow-xs">
                                                                EL (Earned)
                                                            </span>
                                                        ) : row.type === 'CL' ? (
                                                            <span className="w-fit text-[9px] font-black text-purple-700 uppercase tracking-tight italic bg-purple-50 px-2.5 py-1 rounded-md border border-purple-200 shadow-xs">
                                                                CL (Casual)
                                                            </span>
                                                        ) : row.type === 'LWP' ? (
                                                            <span className="w-fit text-[9px] font-black text-rose-700 uppercase tracking-tight italic bg-rose-50 px-2.5 py-1 rounded-md border border-rose-200 shadow-xs">
                                                                LWP (Unpaid)
                                                            </span>
                                                        ) : (
                                                            <span className="w-fit text-[9px] font-black text-slate-700 uppercase tracking-tight italic bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200 shadow-xs">
                                                                {row.type}
                                                            </span>
                                                        )}
                                                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                                                            {row.duration === 0.5 ? "0.5 Day (Half Day)" : `${row.duration} Day${row.duration > 1 ? 's' : ''}`}
                                                        </span>
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
                                                            {isAdmin && (
                                                                <DropdownMenuItem
                                                                    onClick={() => {
                                                                        setSelectedTreatmentLog(row);
                                                                        setEditTreatmentValue((row.payrollTreatment as any) || (row.type === 'LWP' ? 'unpaid' : 'adjusted_balance'));
                                                                        setEditTreatmentRemarks(row.remarks || "");
                                                                        setIsTreatmentDialogOpen(true);
                                                                    }}
                                                                    className="flex items-center gap-2.5 p-2 rounded-lg cursor-pointer hover:bg-indigo-50 border-t border-slate-100"
                                                                >
                                                                    <SlidersHorizontal className="h-3.5 w-3.5 text-indigo-600" />
                                                                    <span className="text-[9px] font-bold uppercase tracking-widest text-slate-700">Payroll Treatment</span>
                                                                </DropdownMenuItem>
                                                            )}
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
                )}

                {/* ── LEAVE POLICY CONFIGURATION DIALOG (Req 2.6) ── */}
                <Dialog open={isPolicyOpen} onOpenChange={setIsPolicyOpen}>
                    <DialogContent className="sm:max-w-[560px] border-none shadow-2xl rounded-3xl p-8 max-h-[90vh] overflow-y-auto">
                        <DialogHeader className="space-y-3">
                            <div className="h-12 w-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-1">
                                <SlidersHorizontal className="h-6 w-6" />
                            </div>
                            <DialogTitle className="text-xl font-black italic uppercase text-slate-900 tracking-tighter">
                                Leave Policy Configuration (Req 2.6)
                            </DialogTitle>
                            <DialogDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                                Configure annual entitlements, carry-forward rules, and lapse behavior for PL, EL, and CL categories.
                            </DialogDescription>
                        </DialogHeader>

                        {policyLoading ? (
                            <div className="py-12 text-center">
                                <Loader2 className="h-7 w-7 text-indigo-500 animate-spin mx-auto mb-2" />
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Loading policy...</span>
                            </div>
                        ) : (
                            <div className="space-y-6 py-3">
                                {/* PL Section */}
                                <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-black uppercase tracking-wider text-indigo-950 flex items-center gap-1.5">
                                            <Award className="h-4 w-4 text-indigo-600" /> Privilege Leave (PL)
                                        </span>
                                        <Badge className="bg-indigo-600 text-white font-black text-[8px] uppercase">Carry-Forward Enabled</Badge>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <Label className="text-[8px] font-black uppercase tracking-widest text-slate-400">Annual Entitlement (Days)</Label>
                                            <Input
                                                type="number"
                                                min={0}
                                                max={30}
                                                value={policyConfig.pl?.entitlement ?? 12}
                                                onChange={(e) => setPolicyConfig({
                                                    ...policyConfig,
                                                    pl: { ...policyConfig.pl, entitlement: Number(e.target.value) }
                                                })}
                                                className="h-10 rounded-xl bg-white text-xs font-bold"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[8px] font-black uppercase tracking-widest text-slate-400">Max Carry-Forward Cap (Days)</Label>
                                            <Input
                                                type="number"
                                                min={0}
                                                max={60}
                                                value={policyConfig.pl?.max_carry_forward ?? 15}
                                                onChange={(e) => setPolicyConfig({
                                                    ...policyConfig,
                                                    pl: { ...policyConfig.pl, max_carry_forward: Number(e.target.value) }
                                                })}
                                                className="h-10 rounded-xl bg-white text-xs font-bold"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* EL Section */}
                                <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-black uppercase tracking-wider text-emerald-950 flex items-center gap-1.5">
                                            <Plane className="h-4 w-4 text-emerald-600" /> Earned Leave (EL)
                                        </span>
                                        <Badge className="bg-emerald-600 text-white font-black text-[8px] uppercase">Carry-Forward Enabled</Badge>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <Label className="text-[8px] font-black uppercase tracking-widest text-slate-400">Annual Entitlement (Days)</Label>
                                            <Input
                                                type="number"
                                                min={0}
                                                max={30}
                                                value={policyConfig.el?.entitlement ?? 12}
                                                onChange={(e) => setPolicyConfig({
                                                    ...policyConfig,
                                                    el: { ...policyConfig.el, entitlement: Number(e.target.value) }
                                                })}
                                                className="h-10 rounded-xl bg-white text-xs font-bold"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[8px] font-black uppercase tracking-widest text-slate-400">Max Carry-Forward Cap (Days)</Label>
                                            <Input
                                                type="number"
                                                min={0}
                                                max={60}
                                                value={policyConfig.el?.max_carry_forward ?? 30}
                                                onChange={(e) => setPolicyConfig({
                                                    ...policyConfig,
                                                    el: { ...policyConfig.el, max_carry_forward: Number(e.target.value) }
                                                })}
                                                className="h-10 rounded-xl bg-white text-xs font-bold"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* CL Section */}
                                <div className="p-4 rounded-2xl bg-purple-50/50 border border-purple-100 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-black uppercase tracking-wider text-purple-950 flex items-center gap-1.5">
                                            <CalendarDays className="h-4 w-4 text-purple-600" /> Casual Leave (CL)
                                        </span>
                                        <Badge className="bg-purple-600 text-white font-black text-[8px] uppercase">Lapses Annually</Badge>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <Label className="text-[8px] font-black uppercase tracking-widest text-slate-400">Annual Entitlement (Days)</Label>
                                            <Input
                                                type="number"
                                                min={0}
                                                max={30}
                                                value={policyConfig.cl?.entitlement ?? 12}
                                                onChange={(e) => setPolicyConfig({
                                                    ...policyConfig,
                                                    cl: { ...policyConfig.cl, entitlement: Number(e.target.value) }
                                                })}
                                                className="h-10 rounded-xl bg-white text-xs font-bold"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[8px] font-black uppercase tracking-widest text-slate-400">Lapse Policy</Label>
                                            <div className="h-10 px-3 rounded-xl bg-white border border-slate-200 flex items-center text-xs font-bold text-slate-600">
                                                Lapses at Year-End (No Carry)
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Rollover Execution Utility */}
                                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-800 block">
                                            Execute Year-End Rollover & Lapse
                                        </span>
                                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block">
                                            Carry forward PL & EL up to policy cap and lapse all CL balances
                                        </span>
                                    </div>
                                    <Button
                                        onClick={handleRunRollover}
                                        disabled={rolloverRunning}
                                        variant="outline"
                                        className="h-9 px-4 rounded-xl border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-black text-[8px] uppercase tracking-wider shrink-0"
                                    >
                                        {rolloverRunning ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
                                        Run Rollover
                                    </Button>
                                </div>
                            </div>
                        )}

                        <DialogFooter className="gap-3 sm:justify-start">
                            <Button
                                disabled={policySaving || policyLoading}
                                onClick={handleSavePolicy}
                                className="flex-1 h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase text-[9px] tracking-widest shadow-xl transition-all"
                            >
                                {policySaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                                Save Policy Configuration
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => setIsPolicyOpen(false)}
                                className="flex-1 h-12 rounded-2xl border-slate-100 font-black uppercase text-[9px] tracking-widest"
                            >
                                Cancel
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* ── EMPLOYEE LEAVE HISTORY DRAWER WITH MONTH-WISE REVIEW (Req 2.6) ── */}
                <Sheet open={historyDrawerOpen} onOpenChange={setHistoryDrawerOpen}>
                    <SheetContent className="sm:max-w-[680px] border-none shadow-2xl p-0 overflow-y-auto">
                        <div className="h-2 bg-indigo-500" />
                        <div className="p-8 space-y-6">
                            <SheetHeader className="text-left space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="h-9 w-9 rounded-xl bg-indigo-50 flex items-center justify-center">
                                            <History className="h-5 w-5 text-indigo-600" />
                                        </div>
                                        <div>
                                            <SheetTitle className="text-xl font-black italic uppercase text-slate-900 tracking-tight">
                                                Employee Leave History & Audit
                                            </SheetTitle>
                                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                                                Month-Wise Leave History, PL/EL/CL Quotas & Audit Trail (Req 2.6)
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Employee Card */}
                                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-xl bg-slate-900 text-white font-black text-sm flex items-center justify-center">
                                            {(historyEmployee?.personnel || historyEmployee?.name || "E").charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-black text-slate-900 uppercase italic tracking-tight">
                                                {historyEmployee?.personnel || historyEmployee?.name || "Employee"}
                                            </h4>
                                            <div className="flex items-center gap-2 text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                                <span className="font-mono text-slate-600">{historyEmployee?.empCode || historyEmployee?.emp_code || `EMP#${historyEmployee?.id}`}</span>
                                                <span>•</span>
                                                <span>{historyEmployee?.department || "Department —"}</span>
                                                <span>•</span>
                                                <span>{historyEmployee?.designation || "Staff"}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <Badge className="bg-amber-100 text-amber-900 font-black text-[9px] border-none">
                                        36 d Entitled
                                    </Badge>
                                </div>
                            </SheetHeader>

                            {loadingHistory ? (
                                <div className="py-24 text-center space-y-3">
                                    <Loader2 className="h-8 w-8 text-indigo-500 animate-spin mx-auto" />
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Loading leave history & balances...</p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {/* ── CARD 1: Annual Leave Balances & Entitlements (Req 2.6) ── */}
                                    <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-50/80 via-white to-slate-50 border border-indigo-100/80 shadow-xs space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Sparkles className="h-4 w-4 text-indigo-600" />
                                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-900">
                                                    Paid Leave Entitlement & Balance Quotas (Req 2.6)
                                                </span>
                                            </div>
                                            <Badge className="bg-indigo-600 text-white font-black text-[8px] uppercase px-2 h-5 rounded-md">
                                                Year {historyBalance?.year || new Date().getFullYear()}
                                            </Badge>
                                        </div>

                                        <div className="grid grid-cols-4 gap-2">
                                            {/* Privilege Leave */}
                                            <div className="p-3 rounded-xl bg-white border border-slate-200/80 space-y-1">
                                                <span className="text-[8px] font-bold text-indigo-600 uppercase tracking-wider block">Privilege (PL)</span>
                                                <div className="text-base font-black text-slate-900">
                                                    {historyBalance?.pl_balance ?? 12}
                                                    <span className="text-[8px] font-bold text-slate-400 not-italic ml-1">/ {historyBalance?.pl_allocated ?? 12}</span>
                                                </div>
                                                <span className="text-[7px] font-bold text-indigo-600 uppercase tracking-tight block">
                                                    +{historyBalance?.pl_carried_forward ?? 0} CF
                                                </span>
                                            </div>

                                            {/* Earned Leave */}
                                            <div className="p-3 rounded-xl bg-white border border-slate-200/80 space-y-1">
                                                <span className="text-[8px] font-bold text-emerald-600 uppercase tracking-wider block">Earned (EL)</span>
                                                <div className="text-base font-black text-slate-900">
                                                    {historyBalance?.el_balance ?? 12}
                                                    <span className="text-[8px] font-bold text-slate-400 not-italic ml-1">/ {historyBalance?.el_allocated ?? 12}</span>
                                                </div>
                                                <span className="text-[7px] font-bold text-emerald-600 uppercase tracking-tight block">
                                                    +{historyBalance?.el_carried_forward ?? 0} CF
                                                </span>
                                            </div>

                                            {/* Casual Leave */}
                                            <div className="p-3 rounded-xl bg-white border border-slate-200/80 space-y-1">
                                                <span className="text-[8px] font-bold text-purple-600 uppercase tracking-wider block">Casual (CL)</span>
                                                <div className="text-base font-black text-slate-900">
                                                    {historyBalance?.cl_balance ?? 12}
                                                    <span className="text-[8px] font-bold text-slate-400 not-italic ml-1">/ {historyBalance?.cl_allocated ?? 12}</span>
                                                </div>
                                                <span className="text-[7px] font-bold text-purple-600 uppercase tracking-tight block">Lapses Annually</span>
                                            </div>

                                            {/* Total Available Balance */}
                                            <div className="p-3 rounded-xl bg-indigo-600 text-white space-y-1 shadow-sm">
                                                <span className="text-[8px] font-black uppercase tracking-wider text-indigo-200 block">Remaining</span>
                                                <div className="text-base font-black">
                                                    {historyBalance?.total_remaining_balance ?? historyBalance?.available ?? 36}
                                                    <span className="text-[8px] font-bold text-indigo-200 ml-1">Days</span>
                                                </div>
                                                <span className="text-[7px] font-black uppercase text-indigo-200 tracking-tight block">
                                                    Of {historyBalance?.total_paid_entitlement ?? 36} d
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* ── CARD 2: Carry-Forward & Lapse Information (Req 2.6) ── */}
                                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-700 block">
                                            Applicable Carry-Forward / Lapse Information (Req 2.6)
                                        </span>
                                        <div className="grid grid-cols-3 gap-2 text-[8px] font-bold uppercase">
                                            <div className="p-2.5 rounded-xl bg-white border border-slate-100 space-y-1">
                                                <span className="text-indigo-600 block">PL Policy</span>
                                                <span className="text-slate-800 font-black block">Carry-Forward: Active</span>
                                                <span className="text-slate-400 block">{historyBalance?.pl_carried_forward ?? 0} days carried over</span>
                                            </div>
                                            <div className="p-2.5 rounded-xl bg-white border border-slate-100 space-y-1">
                                                <span className="text-emerald-600 block">EL Policy</span>
                                                <span className="text-slate-800 font-black block">Carry-Forward: Active</span>
                                                <span className="text-slate-400 block">{historyBalance?.el_carried_forward ?? 0} days carried over</span>
                                            </div>
                                            <div className="p-2.5 rounded-xl bg-white border border-slate-100 space-y-1">
                                                <span className="text-purple-600 block">CL Policy</span>
                                                <span className="text-slate-800 font-black block">Lapse at Year-End</span>
                                                <span className="text-slate-400 block">{historyBalance?.cl_lapsed ?? 0} days lapsed</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* ── CARD 3: Month-Wise Leave History Review (Req 2.6: October, November, etc.) ── */}
                                    <div className="p-5 rounded-2xl bg-amber-50/40 border border-amber-200/80 space-y-4">
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                            <div className="flex items-center gap-2">
                                                <CalendarCheck className="h-4 w-4 text-amber-700" />
                                                <span className="text-[10px] font-black uppercase tracking-wider text-amber-950">
                                                    Month-Wise Leave History (Req 2.6)
                                                </span>
                                            </div>

                                            {/* Month Filter Selector */}
                                            <select
                                                value={historySelectedMonth}
                                                onChange={(e) => {
                                                    const val = e.target.value === "all" ? "all" : Number(e.target.value);
                                                    handleHistoryMonthSwitch(val);
                                                }}
                                                className="h-8 px-3 rounded-xl bg-white border border-amber-200 text-[9px] font-black uppercase text-amber-900 outline-none cursor-pointer"
                                            >
                                                <option value="all">All Months (Annual)</option>
                                                {MONTH_NAMES.map((name, idx) => (
                                                    <option key={name} value={idx + 1}>
                                                        {name} {name === "October" || name === "November" ? "(Key Audit Month)" : ""}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* 12-Month Interactive Matrix */}
                                        <div className="grid grid-cols-6 gap-1.5">
                                            {historyMonthlyDistribution.map((m) => {
                                                const isSelected = historySelectedMonth === m.month;
                                                const hasLeaves = (m.total_days_off || 0) > 0;
                                                return (
                                                    <button
                                                        key={m.month}
                                                        onClick={() => handleHistoryMonthSwitch(m.month)}
                                                        className={cn(
                                                            "p-2 rounded-xl border text-center transition-all cursor-pointer flex flex-col justify-between",
                                                            isSelected ? "bg-amber-500 text-white border-amber-600 shadow-sm" :
                                                            hasLeaves ? "bg-amber-100/70 border-amber-300 text-amber-950 hover:bg-amber-200" :
                                                            "bg-white border-slate-200/80 text-slate-600 hover:bg-slate-50"
                                                        )}
                                                    >
                                                        <span className={cn("text-[8px] font-black uppercase tracking-wider block", isSelected ? "text-amber-100" : "text-slate-500")}>
                                                            {m.month_name.slice(0, 3)}
                                                        </span>
                                                        <span className="text-xs font-black mt-1 block">
                                                            {m.total_days_off} d
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        {/* Selected Month Detail Breakdown */}
                                        {historySelectedMonth !== "all" && historySelectedMonthData && (
                                            <div className="p-3.5 rounded-xl bg-white border border-amber-200 space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[10px] font-black uppercase text-amber-950">
                                                        {historySelectedMonthData.month_name} Summary:
                                                    </span>
                                                    <Badge className="bg-amber-500 text-white font-black text-[9px] border-none">
                                                        Total: {historySelectedMonthData.total_days_off} Days Off
                                                    </Badge>
                                                </div>
                                                <div className="grid grid-cols-5 gap-2 text-center text-[8px] font-black uppercase">
                                                    <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100">
                                                        PL: {historySelectedMonthData.pl_days} d
                                                    </div>
                                                    <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100">
                                                        EL: {historySelectedMonthData.el_days} d
                                                    </div>
                                                    <div className="p-1.5 rounded-lg bg-purple-50 text-purple-700 border border-purple-100">
                                                        CL: {historySelectedMonthData.cl_days} d
                                                    </div>
                                                    <div className="p-1.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-100">
                                                        LWP: {historySelectedMonthData.lwp_days} d
                                                    </div>
                                                    <div className="p-1.5 rounded-lg bg-slate-50 text-slate-700 border border-slate-200">
                                                        Half-Days: {historySelectedMonthData.half_days}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* ── Status Filter Tabs ── */}
                                    <div className="flex bg-slate-100 p-1 rounded-xl">
                                        {(["all", "approved", "pending", "rejected"] as const).map((tab) => {
                                            const count = tab === "all"
                                                ? employeeHistoryRecords.length
                                                : tab === "approved"
                                                ? (historySummary?.approved_count ?? employeeHistoryRecords.filter((r) => r.status === "approved").length)
                                                : tab === "pending"
                                                ? (historySummary?.pending_count ?? employeeHistoryRecords.filter((r) => r.status === "pending").length)
                                                : (historySummary?.rejected_count ?? employeeHistoryRecords.filter((r) => r.status === "rejected").length);

                                            return (
                                                <button
                                                    key={tab}
                                                    onClick={() => setHistoryFilterTab(tab)}
                                                    className={cn(
                                                        "flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all",
                                                        historyFilterTab === tab ? "bg-white text-slate-900 shadow-xs" : "text-slate-400 hover:text-slate-600"
                                                    )}
                                                >
                                                    {tab} ({count})
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* ── History Records List ── */}
                                    {(() => {
                                        let filtered = employeeHistoryRecords.filter((r: any) => {
                                            if (historyFilterTab === "all") return true;
                                            return (r.status || "").toLowerCase() === historyFilterTab;
                                        });

                                        // If month filter is applied, only show records overlapping that month
                                        if (historySelectedMonth !== "all") {
                                            const mNum = historySelectedMonth as number;
                                            const mStr = String(mNum).padStart(2, "0");
                                            filtered = filtered.filter((r: any) => {
                                                const fromMonth = r.from_date?.slice(5, 7);
                                                const toMonth = r.to_date?.slice(5, 7);
                                                return fromMonth === mStr || toMonth === mStr;
                                            });
                                        }

                                        if (filtered.length === 0) {
                                            return (
                                                <div className="py-14 text-center text-slate-400 space-y-2 border border-dashed border-slate-200 rounded-2xl">
                                                    <Activity className="h-7 w-7 text-slate-300 mx-auto" />
                                                    <p className="text-xs font-bold uppercase tracking-wider">
                                                        No {historyFilterTab !== "all" ? historyFilterTab : ""} leave records found {historySelectedMonth !== "all" ? `for ${MONTH_NAMES[(historySelectedMonth as number) - 1]}` : ""}
                                                    </p>
                                                </div>
                                            );
                                        }

                                        return (
                                            <div className="space-y-3">
                                                {filtered.map((item: any, i: number) => {
                                                    const leaveType = (item.leave_type || "cl").toUpperCase();
                                                    const isApproved = item.status === "approved";
                                                    const isRejected = item.status === "rejected";
                                                    const isPending = item.status === "pending";

                                                    return (
                                                        <div
                                                            key={item.id || i}
                                                            className={cn(
                                                                "p-4 rounded-2xl border transition-all space-y-3",
                                                                isApproved ? "bg-white border-slate-200/80 shadow-xs" :
                                                                isPending ? "bg-amber-50/30 border-amber-200" :
                                                                "bg-slate-50 border-slate-200/80 opacity-90"
                                                            )}
                                                        >
                                                            {/* Top badges */}
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex items-center gap-2">
                                                                    {leaveType === "PL" ? (
                                                                        <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 font-black text-[8px] uppercase">
                                                                            PL (Privilege Leave)
                                                                        </Badge>
                                                                    ) : leaveType === "EL" ? (
                                                                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 font-black text-[8px] uppercase">
                                                                            EL (Earned Leave)
                                                                        </Badge>
                                                                    ) : leaveType === "CL" ? (
                                                                        <Badge className="bg-purple-50 text-purple-700 border-purple-200 font-black text-[8px] uppercase">
                                                                            CL (Casual Leave)
                                                                        </Badge>
                                                                    ) : leaveType === "LWP" ? (
                                                                        <Badge className="bg-rose-50 text-rose-700 border-rose-200 font-black text-[8px] uppercase">
                                                                            LWP (Unpaid)
                                                                        </Badge>
                                                                    ) : (
                                                                        <Badge className="bg-slate-50 text-slate-700 border-slate-200 font-black text-[8px] uppercase">
                                                                            {leaveType}
                                                                        </Badge>
                                                                    )}

                                                                    <span className="text-xs font-black text-slate-900">
                                                                        {item.duration === 0.5 ? "0.5 Day (Half Day)" : `${item.duration || 1} Day${(item.duration || 1) > 1 ? "s" : ""}`}
                                                                    </span>
                                                                </div>

                                                                <Badge className={cn(
                                                                    "text-[8px] font-black uppercase px-2.5 h-5 rounded-md border-none",
                                                                    isApproved ? "bg-emerald-100 text-emerald-800" :
                                                                    isRejected ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800"
                                                                )}>
                                                                    {item.status}
                                                                </Badge>
                                                            </div>

                                                            {/* Date range & Applied On */}
                                                            <div className="flex items-center justify-between text-xs">
                                                                <div className="flex items-center gap-1.5 font-bold text-slate-800">
                                                                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                                                                    <span>
                                                                        {new Date(item.from_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                                                                        {" – "}
                                                                        {new Date(item.to_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                                                                    </span>
                                                                </div>
                                                                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                                                                    Applied: {new Date(item.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                                                                </span>
                                                            </div>

                                                            {/* Reason */}
                                                            {item.reason && (
                                                                <p className="text-[10px] text-slate-600 italic bg-slate-50 p-2.5 rounded-xl border border-slate-100 leading-relaxed">
                                                                    &ldquo;{item.reason}&rdquo;
                                                                </p>
                                                            )}

                                                            {/* Action / Remarks & Payroll Treatment (Req 10) */}
                                                            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 text-[8px] font-bold uppercase tracking-wider">
                                                                <div>
                                                                    {item.approver ? (
                                                                        <span className="text-slate-500">
                                                                            {isApproved ? "Approved by" : "Reviewed by"}: <strong className="text-slate-800">{item.approver.name}</strong>
                                                                        </span>
                                                                    ) : isPending ? (
                                                                        <span className="text-amber-700 font-bold">
                                                                            Awaiting Admin Review • No salary cut pending approval
                                                                        </span>
                                                                    ) : null}

                                                                    {item.remarks && (
                                                                        <span className="ml-2 text-slate-600 font-semibold italic">
                                                                            (Remarks: {item.remarks})
                                                                        </span>
                                                                    )}
                                                                </div>

                                                                <div className="flex items-center gap-2">
                                                                    {item.payroll_treatment && (
                                                                        <Badge variant="outline" className="text-[8px] font-black uppercase text-indigo-700 bg-indigo-50/50 border-indigo-200">
                                                                            Payroll: {item.payroll_treatment.replace(/_/g, " ")}
                                                                        </Badge>
                                                                    )}
                                                                    {isAdmin && (
                                                                        <button
                                                                            onClick={() => {
                                                                                setSelectedTreatmentLog({
                                                                                    id: item.id,
                                                                                    personnel: historyEmployee?.personnel || historyEmployee?.name || "Employee",
                                                                                    type: (item.leave_type || "cl").toUpperCase(),
                                                                                    duration: item.duration || 1,
                                                                                    status: item.status,
                                                                                    range: `${new Date(item.from_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – ${new Date(item.to_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`,
                                                                                    remarks: item.remarks || "",
                                                                                    payrollTreatment: item.payroll_treatment,
                                                                                });
                                                                                setEditTreatmentValue((item.payroll_treatment as any) || (item.leave_type === "lwp" ? "unpaid" : "adjusted_balance"));
                                                                                setEditTreatmentRemarks(item.remarks || "");
                                                                                setIsTreatmentDialogOpen(true);
                                                                            }}
                                                                            className="text-[8px] font-black uppercase text-indigo-600 hover:text-indigo-800 underline underline-offset-2 cursor-pointer inline-flex items-center gap-1 ml-1"
                                                                        >
                                                                            <SlidersHorizontal className="h-2.5 w-2.5" /> Edit
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })()}
                                </div>
                            )}
                        </div>
                    </SheetContent>
                </Sheet>

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

                {/* Audit History Picker Dialog */}
                <Dialog open={isAuditPickerOpen} onOpenChange={setIsAuditPickerOpen}>
                    <DialogContent className="sm:max-w-[480px] border-none shadow-2xl rounded-3xl p-8">
                        <DialogHeader className="space-y-3">
                            <div className="h-12 w-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-1">
                                <History className="h-6 w-6" />
                            </div>
                            <DialogTitle className="text-xl font-black italic uppercase text-slate-900 tracking-tighter">
                                Employee Leave Audit
                            </DialogTitle>
                            <DialogDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                                Select an employee to inspect their annual leave entitlement, PL/EL/CL quotas, and historical requests.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-5 py-4">
                            <div className="space-y-2">
                                <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Select Employee</Label>
                                <select
                                    value={auditSelectedEmpId}
                                    onChange={(e) => setAuditSelectedEmpId(e.target.value)}
                                    className="w-full h-12 rounded-xl px-4 font-bold text-[11px] outline-none border transition-all appearance-none bg-no-repeat bg-slate-50 border-slate-100 text-slate-700"
                                    style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")", backgroundPosition: "right 12px center" }}
                                >
                                    <option value="" className="font-bold">Choose an employee to audit...</option>
                                    {employees.map((emp: any) => (
                                        <option key={emp.id} value={emp.id} className="font-bold">
                                            {emp.name} — {emp.emp_code} ({emp.department || "No Dept"})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {loadingAuditBalance && (
                                <div className="py-4 text-center">
                                    <Loader2 className="h-5 w-5 text-indigo-500 animate-spin mx-auto mb-1" />
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Loading annual balance...</span>
                                </div>
                            )}

                            {auditEmpPreviewBalance && !loadingAuditBalance && (
                                <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[9px] font-black uppercase tracking-wider text-indigo-900">Annual Leave Entitlement</span>
                                        <Badge className="bg-indigo-600 text-white font-black text-[9px] border-none px-2 h-5 rounded-md">
                                            Year {auditEmpPreviewBalance.year || new Date().getFullYear()}
                                        </Badge>
                                    </div>
                                    <div className="grid grid-cols-4 gap-2 text-center">
                                        <div className="p-2 rounded-xl bg-white border border-indigo-100">
                                            <span className="text-[7px] font-bold text-slate-400 uppercase block">PL</span>
                                            <span className="text-xs font-black text-indigo-950">{auditEmpPreviewBalance.pl_balance ?? 12} d</span>
                                        </div>
                                        <div className="p-2 rounded-xl bg-white border border-indigo-100">
                                            <span className="text-[7px] font-bold text-slate-400 uppercase block">EL</span>
                                            <span className="text-xs font-black text-emerald-950">{auditEmpPreviewBalance.el_balance ?? 12} d</span>
                                        </div>
                                        <div className="p-2 rounded-xl bg-white border border-indigo-100">
                                            <span className="text-[7px] font-bold text-slate-400 uppercase block">CL</span>
                                            <span className="text-xs font-black text-purple-950">{auditEmpPreviewBalance.cl_balance ?? 12} d</span>
                                        </div>
                                        <div className="p-2 rounded-xl bg-indigo-600 text-white">
                                            <span className="text-[7px] font-bold text-indigo-200 uppercase block">Remaining</span>
                                            <span className="text-xs font-black">{auditEmpPreviewBalance.total_remaining_balance ?? 36} d</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <DialogFooter className="gap-3 sm:justify-start">
                            <Button
                                disabled={!auditSelectedEmpId}
                                onClick={handleOpenAuditFromPicker}
                                className="flex-1 h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase text-[9px] tracking-widest shadow-xl transition-all disabled:opacity-50"
                            >
                                Open Leave History Log
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => { setIsAuditPickerOpen(false); setAuditSelectedEmpId(""); }}
                                className="flex-1 h-12 rounded-2xl border-slate-100 font-black uppercase text-[9px] tracking-widest"
                            >
                                Cancel
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Payroll Treatment Dialog (Req 10) */}
                <Dialog open={isTreatmentDialogOpen} onOpenChange={setIsTreatmentDialogOpen}>
                    <DialogContent className="sm:max-w-[440px] border-none shadow-2xl rounded-3xl p-8">
                        <DialogHeader className="space-y-3">
                            <div className="h-12 w-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-1">
                                <SlidersHorizontal className="h-6 w-6" />
                            </div>
                            <DialogTitle className="text-xl font-black italic uppercase text-slate-900 tracking-tighter">
                                Payroll Treatment Control
                            </DialogTitle>
                            <DialogDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                                Determine final payroll treatment & deduction for <span className="text-slate-900 font-black italic">{selectedTreatmentLog?.personnel}</span> (Req 10).
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-4">
                            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                                <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                                    <span>{selectedTreatmentLog?.type} Leave ({selectedTreatmentLog?.duration} Day{selectedTreatmentLog?.duration !== 1 ? 's' : ''})</span>
                                    <Badge variant="outline" className="text-[8px] uppercase">{selectedTreatmentLog?.status}</Badge>
                                </div>
                                <p className="text-[10px] text-slate-500">{selectedTreatmentLog?.range}</p>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Payroll Treatment Decision (Req 10)</Label>
                                <select
                                    value={editTreatmentValue}
                                    onChange={(e: any) => setEditTreatmentValue(e.target.value)}
                                    className="w-full h-11 px-3 rounded-xl bg-slate-50 border border-slate-100 font-bold text-[10px] uppercase outline-none focus:ring-2 ring-indigo-100 cursor-pointer text-slate-800"
                                >
                                    <option value="paid">Paid Leave (Deduct from Annual Balance, No Salary Cut)</option>
                                    <option value="unpaid">Loss of Pay / Unpaid (Salary Deduction in Current Payroll)</option>
                                    <option value="adjusted_balance">Adjust Against Annual Leave Balance (Decoupled from Cut)</option>
                                    <option value="carry_forward_next">Carry Forward Adjustment to Following Month</option>
                                </select>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Admin Audit Remarks</Label>
                                <textarea
                                    value={editTreatmentRemarks}
                                    onChange={(e) => setEditTreatmentRemarks(e.target.value)}
                                    placeholder="Add reason for payroll treatment decision..."
                                    className="w-full min-h-[80px] p-3 rounded-xl bg-slate-50 border border-slate-100 font-bold text-[11px] focus:bg-white transition-all outline-none"
                                />
                            </div>
                        </div>

                        <DialogFooter className="gap-3 sm:justify-start">
                            <Button
                                disabled={updatingTreatment}
                                onClick={handleUpdateTreatment}
                                className="flex-1 h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase text-[9px] tracking-widest shadow-xl transition-all"
                            >
                                {updatingTreatment ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                                Save Decision
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => setIsTreatmentDialogOpen(false)}
                                className="flex-1 h-12 rounded-2xl border-slate-100 font-black uppercase text-[9px] tracking-widest"
                            >
                                Cancel
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

            </div>
        </ProtectedRoute>
    );
}
