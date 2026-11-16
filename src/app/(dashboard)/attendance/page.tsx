"use client";

import { useRole } from "@/context/RoleContext";
import MonthYearPicker from "@/components/MonthYearPicker";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useState, useEffect, useCallback, useRef } from "react";
import { apiGet, apiPost, apiPut } from "@/lib/api-client";
import dynamic from "next/dynamic";
import {
    Clock,
    Calendar,
    Search,
    Filter,
    Download,
    ArrowUpRight,
    CheckCircle2,
    XCircle,
    AlertCircle,
    MoreHorizontal,
    LayoutGrid,
    Users2,
    Check,
    UserCheck,
    Ban,
    UserX,
    MapPin,
    ShieldCheck,
    Activity,
    UserPlus,
    Settings,
    History,
    Zap,
    Map as MapIcon,
    Globe,
    ChevronLeft,
    ChevronRight,
    Plus,
    FileSpreadsheet,
    Navigation,
    RefreshCw,
    Smartphone,
    Timer,
    Info,
    Building2,
    Plane,
    Compass,
    Sliders,
    ChevronsLeft,
    ChevronsRight,
    MoveHorizontal,
    Target,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuLabel,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

const AttendanceMap = dynamic(() => import("@/components/AttendanceMap"), {
    ssr: false,
    loading: () => (
        <div className="w-full h-full flex items-center justify-center bg-slate-100">
            <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Loading map…
                </span>
            </div>
        </div>
    ),
});

export default function AttendancePage() {
    const { hasPermission } = useRole();
    const [activeTab, setActiveTab] = useState<"live" | "history" | "monthly">("monthly");
    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [selectedCompanyId, setSelectedCompanyId] = useState("");
    const [selectedOfficeId, setSelectedOfficeId] = useState("");
    const [selectedStatus, setSelectedStatus] = useState<"All" | "Present" | "Absent" | "Late">("All");
    const [companies, setCompanies] = useState<{ id: number; name: string }[]>([]);
    const [offices, setOffices] = useState<{ id: number; name: string }[]>([]);
    const [departments, setDepartments] = useState<string[]>([]);
    const [selectedDepartment, setSelectedDepartment] = useState("");
    const [allEmployees, setAllEmployees] = useState<any[]>([]);
    const [manualInputMode, setManualInputMode] = useState<"dropdown" | "custom">("dropdown");
    const [tourInputMode, setTourInputMode] = useState<"dropdown" | "custom">("dropdown");
    const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Fetch companies, offices, departments, late threshold and active employees for selector (Req 5.3)
    useEffect(() => {
        Promise.all([
            apiGet<{ id: number; name: string }[]>("/companies"),
            apiGet<{ id: number; name: string }[]>("/offices", { limit: 100 }),
            apiGet<string[]>("/leave/departments"),
            apiGet<any>("/config/late-threshold").catch(() => null),
            apiGet<any>("/employees?limit=500&status=active").catch(() => null),
        ])
            .then(([compRes, offRes, deptRes, lateRes, empRes]) => {
                setCompanies(Array.isArray(compRes) ? compRes : []);
                setOffices(Array.isArray(offRes) ? offRes : []);
                setDepartments(Array.isArray(deptRes) ? deptRes : []);
                if (empRes) {
                    const list = Array.isArray(empRes) ? empRes : (empRes.data || empRes.employees || []);
                    setAllEmployees(list);
                }
                if (lateRes && lateRes.lateThresholdMinutes) {
                    setLateThresholdMinutes(lateRes.lateThresholdMinutes);
                    setTempLateThreshold(lateRes.lateThresholdMinutes);
                }
            })
            .catch(() => { setCompanies([]); setOffices([]); setDepartments([]); setAllEmployees([]); });
    }, []);

    const handleUpdateLateThreshold = async (minutes: number) => {
        setLateThresholdSaving(true);
        try {
            await apiPut("/config/late-threshold", { lateThresholdMinutes: minutes });
            setLateThresholdMinutes(minutes);
            setTempLateThreshold(minutes);
            setIsLateThresholdOpen(false);
        } catch (err: any) {
            console.error("Failed to update late threshold:", err);
            alert(err?.response?.data?.message || "Failed to update late threshold.");
        } finally {
            setLateThresholdSaving(false);
        }
    };

    // Debounced search
    const handleSearchChange = (value: string) => {
        setSearchTerm(value);
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        searchTimerRef.current = setTimeout(() => {
            setDebouncedSearch(value);
        }, 400);
    };

    // Export CSV helper
    const exportToCSV = (rows: any[], filename: string) => {
        if (!rows || rows.length === 0) return;
        const headers = Object.keys(rows[0]);
        const csv = [
            headers.join(","),
            ...rows.map((row) =>
                headers.map((h) => {
                    const val = (row[h] ?? "").toString().replace(/"/g, '""');
                    return `"${val}"`;
                }).join(",")
            ),
        ].join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${filename}_${new Date().toISOString().split("T")[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // Dynamic Calendar & Cycle State (Req 6.1, 6.2)
    const [cycleType, setCycleType] = useState<"payroll" | "calendar">("payroll");
    const [currentDate] = useState(new Date());
    const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth());
    const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());

    // Table horizontal & vertical scroll ref
    const tableContainerRef = useRef<HTMLDivElement>(null);
    const hasAutoScrolledToday = useRef(false);

    const scrollTable = (offset: number) => {
        if (tableContainerRef.current) {
            tableContainerRef.current.scrollBy({ left: offset, behavior: 'smooth' });
        }
    };

    const scrollToStart = () => {
        if (tableContainerRef.current) {
            tableContainerRef.current.scrollTo({ left: 0, behavior: 'smooth' });
        }
    };

    const scrollToEnd = () => {
        if (tableContainerRef.current) {
            tableContainerRef.current.scrollTo({ left: tableContainerRef.current.scrollWidth, behavior: 'smooth' });
        }
    };

    // Helper to get dates dynamically based on cycle (calendar: 1st-end, payroll: 26th-25th)
    const getDatesInCycle = (month: number, year: number, cycle: "payroll" | "calendar") => {
        const dates: Date[] = [];
        if (cycle === "calendar") {
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            for (let d = 1; d <= daysInMonth; d++) {
                dates.push(new Date(year, month, d));
            }
        } else {
            let prevMonthYear = year;
            let prevMonth = month - 1;
            if (prevMonth < 0) {
                prevMonth = 11;
                prevMonthYear = year - 1;
            }
            const start = new Date(prevMonthYear, prevMonth, 26);
            const end = new Date(year, month, 25);
            const current = new Date(start);
            while (current <= end) {
                dates.push(new Date(current));
                current.setDate(current.getDate() + 1);
            }
        }
        return dates;
    };
    const cycleDates = getDatesInCycle(selectedMonth, selectedYear, cycleType);
    const daysInSelectedMonth = cycleDates.length;
    const formatCycleRange = () => {
        if (!cycleDates || cycleDates.length === 0) return "";
        const start = cycleDates[0];
        const end = cycleDates[cycleDates.length - 1];
        const options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' };
        return `${start.toLocaleDateString('en-GB', options)} - ${end.toLocaleDateString('en-GB', options)} (${cycleDates.length} Days)`;
    };

    const isTodayInCycle = cycleDates.some(
        (d) =>
            d.getDate() === currentDate.getDate() &&
            d.getMonth() === currentDate.getMonth() &&
            d.getFullYear() === currentDate.getFullYear()
    );

    const scrollToToday = () => {
        const todayIdx = cycleDates.findIndex(
            (d) =>
                d.getDate() === currentDate.getDate() &&
                d.getMonth() === currentDate.getMonth() &&
                d.getFullYear() === currentDate.getFullYear()
        );
        if (todayIdx !== -1 && tableContainerRef.current) {
            const colWidth = 36;
            const targetLeft = Math.max(0, todayIdx * colWidth - 80);
            tableContainerRef.current.scrollTo({ left: targetLeft, behavior: "smooth" });
        }
    };
    const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

    const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    // Export monthly attendance with dynamic per-day columns (Req 6.1, 6.2, 6.4)
    // Dynamically uses cycleDates so that:
    // - 28/29 day February has exactly 28/29 columns
    // - 30-day months (Apr, Jun, Sep, Nov) have exactly 30 columns (Zero phantom 31st date)
    // - 31-day months have 31 columns
    // - Payroll cycle (26th to 25th) correctly maps dates across month boundaries
    const exportMonthlyToCSV = (rows: any[], filename: string) => {
        if (!rows || rows.length === 0) return;
        const daysInMonth = cycleDates.length;
        const baseHeaders = [
            "Emp Code", "Name", "Role", "Department", "Hub", "Company",
            "Muster Days", "Present Days", "Week Off", "Paid Leave", "Holiday", "Tour (Paid)",
            "Payable Days", "LWP Days", "Fixed Gross (INR)", "Estimated Payout (INR)"
        ];
        const dayHeaders = cycleDates.map((date) => {
            const yyyy = date.getFullYear();
            const mm = String(date.getMonth() + 1).padStart(2, '0');
            const dd = String(date.getDate()).padStart(2, '0');
            const dayStr = dayNames[date.getDay()];
            return `${yyyy}-${mm}-${dd} (${dayStr})`;
        });
        const headers = [...baseHeaders, ...dayHeaders];

        const csv = [
            headers.join(","),
            ...rows.map((row) => {
                const grid = row.grid || "";
                const dayValues = cycleDates.map((_, i) => {
                    const ch = grid[i] || "-";
                    switch (ch) {
                        case "P": return "P";
                        case "A": return "A";
                        case "W": return "WO";
                        case "H": return "H";
                        case "T": return "T";
                        case "L": return "L";
                        case "-": return "-";
                        default: return ch;
                    }
                });
                const musterDays = row.muster_days ?? daysInMonth;
                const payableDays = (row.present ?? 0) + (row.woff ?? 0) + (row.leave ?? 0) + (row.holiday ?? 0) + (row.tour ?? 0);
                const lwpDays = row.absent ?? 0;
                const salary = row.salary || 0;
                const dailyRate = Math.round(salary / (musterDays || 1));
                const estimatedPayout = payableDays * dailyRate;

                const baseValues = [
                    row.id ?? "",
                    row.name ?? "",
                    row.role ?? "",
                    row.department ?? "---",
                    row.hub ?? "",
                    row.company ?? "",
                    musterDays,
                    row.present ?? 0,
                    row.woff ?? 0,
                    row.leave ?? 0,
                    row.holiday ?? 0,
                    row.tour ?? 0,
                    payableDays,
                    lwpDays,
                    salary,
                    estimatedPayout,
                ];
                const allValues = [...baseValues, ...dayValues];
                return allValues.map((v) => `"${(v ?? "").toString().replace(/"/g, '""')}"`).join(",");
            }),
        ].join("\n");

        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const cycleLabel = cycleType === "payroll" ? "PayrollCycle_26-25" : "CalendarMonth";
        a.download = `${filename}_${cycleLabel}_${monthNames[selectedMonth]}_${selectedYear}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 8;

    // Map State
    const [isMapOpen, setIsMapOpen] = useState(false);
    const [selectedMapLog, setSelectedMapLog] = useState<any>(null);

    const openMap = (log: any) => {
        setSelectedMapLog(log);
        setIsMapOpen(true);
    };

    // Attendance to Payroll Breakdown Dialog State (Req 8)
    const [selectedPayrollBreakdown, setSelectedPayrollBreakdown] = useState<any | null>(null);
    const [isPayrollBreakdownOpen, setIsPayrollBreakdownOpen] = useState(false);

    const openPayrollBreakdown = (emp: any) => {
        setSelectedPayrollBreakdown(emp);
        setIsPayrollBreakdownOpen(true);
    };

    // Manual & Authorized Attendance State (Req 5.1, 5.2, 2.5 B, 2.5 D)
    const [isManualEntryOpen, setIsManualEntryOpen] = useState(false);
    const [manualEmpId, setManualEmpId] = useState("");
    const [manualDate, setManualDate] = useState("");
    const [manualStatus, setManualStatus] = useState("Present");
    const [manualReason, setManualReason] = useState("");
    const [manualIsOutdoor, setManualIsOutdoor] = useState(false);
    const [manualCheckInTime, setManualCheckInTime] = useState("");
    const [manualCheckOutTime, setManualCheckOutTime] = useState("");
    const [manualWoComp, setManualWoComp] = useState<"additional_payable_day" | "comp_off">("additional_payable_day");
    const [manualSubmitting, setManualSubmitting] = useState(false);

    // Quick Attendance Adjustment Modal (from Monthly Grid Cell click) (Req 2.5 B & D)
    const [isCellAdjustOpen, setIsCellAdjustOpen] = useState(false);
    const [selectedCellAdjust, setSelectedCellAdjust] = useState<{
        emp: any;
        date: string;
        dayIdx: number;
        dateObj: Date;
        currentStatus: string;
        cellDetail?: any;
    } | null>(null);
    const [cellAdjustStatus, setCellAdjustStatus] = useState<"Present" | "Absent" | "Half Day" | "Weekly Off Worked">("Present");
    const [cellAdjustWoComp, setCellAdjustWoComp] = useState<"additional_payable_day" | "comp_off">("additional_payable_day");
    const [cellAdjustCheckIn, setCellAdjustCheckIn] = useState("10:00");
    const [cellAdjustCheckOut, setCellAdjustCheckOut] = useState("19:00");
    const [cellAdjustReason, setCellAdjustReason] = useState("");
    const [cellAdjustSubmitting, setCellAdjustSubmitting] = useState(false);

    // Rotational & Fixed Weekly-Off Schedule Modal (Req 2.5 C)
    const [isWeeklyOffModalOpen, setIsWeeklyOffModalOpen] = useState(false);
    const [weeklyOffEmpSearch, setWeeklyOffEmpSearch] = useState("");
    const [editingEmpWeeklyOff, setEditingEmpWeeklyOff] = useState<any | null>(null);
    const [editOffDays, setEditOffDays] = useState<string[]>(["Sunday"]);
    const [editRotationalOff, setEditRotationalOff] = useState(false);
    const [weeklyOffSaving, setWeeklyOffSaving] = useState(false);

    // Late Attendance Threshold State (Req 5.3)
    const [lateThresholdMinutes, setLateThresholdMinutes] = useState(60);
    const [isLateThresholdOpen, setIsLateThresholdOpen] = useState(false);
    const [tempLateThreshold, setTempLateThreshold] = useState(60);
    const [lateThresholdSaving, setLateThresholdSaving] = useState(false);

    // Tour Management State
    const [isTourOpen, setIsTourOpen] = useState(false);
    const [tourEmpId, setTourEmpId] = useState("");
    const [tourTitle, setTourTitle] = useState("");
    const [tourDescription, setTourDescription] = useState("");
    const [tourFromLocation, setTourFromLocation] = useState("");
    const [tourToLocation, setTourToLocation] = useState("");
    const [tourStartDate, setTourStartDate] = useState("");
    const [tourEndDate, setTourEndDate] = useState("");
    const [tourSubmitting, setTourSubmitting] = useState(false);

    // Live tab data
    const [stats, setStats] = useState({ total: 0, present: 0, absent: 0, late: 0 });
    const [liveLoading, setLiveLoading] = useState(false);
    const [livePagination, setLivePagination] = useState({ total: 0, totalPages: 1 });
    const [liveTotalFiltered, setLiveTotalFiltered] = useState(0);
    const [exportingLive, setExportingLive] = useState(false);

    // History tab data
    const [historyData, setHistoryData] = useState<any[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyFrom, setHistoryFrom] = useState("");
    const [historyTo, setHistoryTo] = useState("");
    const [historySearch, setHistorySearch] = useState("");
    const [historyDebouncedSearch, setHistoryDebouncedSearch] = useState("");
    const [historyPage, setHistoryPage] = useState(1);
    const [historyPagination, setHistoryPagination] = useState({ total: 0, totalPages: 0 });
    const [historyStats, setHistoryStats] = useState({
        avgAttendance: 0, totalRecords: 0, presentRecords: 0,
        lateRecords: 0, absentRecords: 0, totalWorkHours: 0,
        totalOvertimeHours: 0, activeEmployees: 0,
    });
    const historySearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Debounced history search
    const handleHistorySearchChange = (value: string) => {
        setHistorySearch(value);
        if (historySearchTimerRef.current) clearTimeout(historySearchTimerRef.current);
        historySearchTimerRef.current = setTimeout(() => {
            setHistoryDebouncedSearch(value);
        }, 400);
    };

    // Monthly tab data
    const [monthlyRows, setMonthlyRows] = useState<any[]>([]);
    const [monthlyDaysInMonth, setMonthlyDaysInMonth] = useState(daysInSelectedMonth);
    const [monthlyLoading, setMonthlyLoading] = useState(false);
    const [monthlySearch, setMonthlySearch] = useState("");
    const [monthlyDebouncedSearch, setMonthlyDebouncedSearch] = useState("");
    const monthlySearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleMonthlySearchChange = (value: string) => {
        setMonthlySearch(value);
        if (monthlySearchTimerRef.current) clearTimeout(monthlySearchTimerRef.current);
        monthlySearchTimerRef.current = setTimeout(() => {
            setMonthlyDebouncedSearch(value);
        }, 400);
    };

    // Export Monthly/Live/History Attendance Dialog State
    const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
    const [exportDeptSelection, setExportDeptSelection] = useState("All");
    const [exportingMonthly, setExportingMonthly] = useState(false);
    const [exportingHistory, setExportingHistory] = useState(false);
    const [exportType, setExportType] = useState<"live" | "monthly" | "history">("monthly");

    const handleMonthlyExport = async () => {
        setIsExportDialogOpen(false);
        setExportingMonthly(true);
        try {
            const data: any = await apiGet("/attendance/admin/monthly-all", {
                month: selectedMonth + 1,
                year: selectedYear,
                cycle_type: cycleType,
                cycle: cycleType,
                company_id: selectedCompanyId || undefined,
                office_id: selectedOfficeId || undefined,
                search: monthlyDebouncedSearch || undefined,
                department: exportDeptSelection === "All" ? undefined : exportDeptSelection,
            });
            const rowsToExport = data.rows || [];
            if (rowsToExport.length === 0) {
                alert("No records found to export.");
                return;
            }
            exportMonthlyToCSV(rowsToExport, `Monthly_Attendance_Report_${exportDeptSelection.replace(/\s/g, "_")}`);
        } catch (err) {
            console.error("Failed to export monthly attendance:", err);
            alert("Failed to export monthly attendance.");
        } finally {
            setExportingMonthly(false);
        }
    };

    // Fetch live attendance
    const fetchLiveAttendance = useCallback(async () => {
        setLiveLoading(true);
        try {
            const data: any = await apiGet("/attendance/admin/live", {
                company_id: selectedCompanyId || undefined,
                office_id: selectedOfficeId || undefined,
                status: selectedStatus === "All" ? undefined : selectedStatus,
                search: debouncedSearch || undefined,
                page: currentPage,
                limit: itemsPerPage,
                department: selectedDepartment || undefined,
            });
            setStats(data.stats || { total: 0, present: 0, absent: 0, late: 0 });
            setAttendanceLogs(data.rows || []);
            setLivePagination(data.pagination || { total: 0, totalPages: 1 });
            setLiveTotalFiltered((data.pagination && data.pagination.total) || 0);
        } catch (err) {
            console.error("Failed to fetch live attendance:", err);
        } finally {
            setLiveLoading(false);
        }
    }, [selectedCompanyId, selectedOfficeId, selectedStatus, debouncedSearch, currentPage, selectedDepartment]);

    // Export ALL live attendance records for a specific department (not just the current page).
    // Loops through every page with the backend's max allowed limit (100)
    // so the downloaded CSV contains every matching employee regardless of
    // which page is currently open. No backend restart required.
    const exportLiveAttendance = async (selectedDept: string) => {
        setIsExportDialogOpen(false);
        setExportingLive(true);
        try {
            const baseParams = {
                company_id: selectedCompanyId || undefined,
                office_id: selectedOfficeId || undefined,
                status: selectedStatus === "All" ? undefined : selectedStatus,
                search: debouncedSearch || undefined,
                department: selectedDept === "All" ? undefined : selectedDept,
            };
            // Fetch the first page to discover total page count.
            const first: any = await apiGet("/attendance/admin/live", {
                ...baseParams,
                page: 1,
                limit: 100,
            });
            let allRows: any[] = first.rows || [];
            const totalPages = first.pagination?.totalPages || 1;
            // Fetch any remaining pages in parallel.
            if (totalPages > 1) {
                const remaining = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
                const results = await Promise.all(
                    remaining.map((p) =>
                        apiGet("/attendance/admin/live", { ...baseParams, page: p, limit: 100 })
                    )
                );
                results.forEach((r: any) => {
                    allRows = allRows.concat(r.rows || []);
                });
            }
            if (allRows.length === 0) {
                alert("No records found to export.");
                return;
            }
            exportToCSV(allRows, `Live_Attendance_Report_${selectedDept.replace(/\s/g, "_")}`);
        } catch (err) {
            console.error("Failed to export live attendance:", err);
            alert("Failed to export live attendance.");
        } finally {
            setExportingLive(false);
        }
    };

    // Fetch history
    const fetchHistory = useCallback(async (page = historyPage) => {
        setHistoryLoading(true);
        try {
            const data: any = await apiGet("/attendance/admin/history-all", {
                page,
                limit: 50,
                from: historyFrom || undefined,
                to: historyTo || undefined,
                company_id: selectedCompanyId || undefined,
                office_id: selectedOfficeId || undefined,
                search: historyDebouncedSearch || undefined,
                department: selectedDepartment || undefined,
            });
            setHistoryData(data.rows || []);
            setHistoryPagination(data.pagination || { total: 0, totalPages: 0 });
            if (data.stats) setHistoryStats(data.stats);
        } catch (err) {
            console.error("Failed to fetch history:", err);
        } finally {
            setHistoryLoading(false);
        }
    }, [historyPage, historyFrom, historyTo, selectedCompanyId, selectedOfficeId, historyDebouncedSearch, selectedDepartment]);

    // Export ALL history attendance records for a specific department (not just the current page).
    // Loops through every page with the backend's max allowed limit (100)
    // so the downloaded CSV contains every matching employee.
    const exportHistoryAttendance = async (selectedDept: string) => {
        setIsExportDialogOpen(false);
        setExportingHistory(true);
        try {
            const baseParams = {
                from: historyFrom || undefined,
                to: historyTo || undefined,
                company_id: selectedCompanyId || undefined,
                office_id: selectedOfficeId || undefined,
                search: historyDebouncedSearch || undefined,
                department: selectedDept === "All" ? undefined : selectedDept,
            };
            // Fetch the first page to discover total page count.
            const first: any = await apiGet("/attendance/admin/history-all", {
                ...baseParams,
                page: 1,
                limit: 100,
            });
            let allRows: any[] = first.rows || [];
            const totalPages = first.pagination?.totalPages || 1;
            // Fetch any remaining pages in parallel.
            if (totalPages > 1) {
                const remaining = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
                const results = await Promise.all(
                    remaining.map((p) =>
                        apiGet("/attendance/admin/history-all", { ...baseParams, page: p, limit: 100 })
                    )
                );
                results.forEach((r: any) => {
                    allRows = allRows.concat(r.rows || []);
                });
            }
            if (allRows.length === 0) {
                alert("No records found to export.");
                return;
            }
            exportToCSV(allRows, `Attendance_History_Report_${selectedDept.replace(/\s/g, "_")}`);
        } catch (err) {
            console.error("Failed to export history attendance:", err);
            alert("Failed to export history attendance.");
        } finally {
            setExportingHistory(false);
        }
    };

    // Fetch monthly grid
    const fetchMonthly = useCallback(async () => {
        setMonthlyLoading(true);
        try {
            const data: any = await apiGet("/attendance/admin/monthly-all", {
                month: selectedMonth + 1,
                year: selectedYear,
                cycle_type: cycleType,
                cycle: cycleType,
                company_id: selectedCompanyId || undefined,
                office_id: selectedOfficeId || undefined,
                search: monthlyDebouncedSearch || undefined,
                department: selectedDepartment || undefined,
            });
            setMonthlyRows(data.rows || []);
            if (data.daysInMonth) setMonthlyDaysInMonth(data.daysInMonth);
        } catch (err) {
            console.error("Failed to fetch monthly attendance:", err);
        } finally {
            setMonthlyLoading(false);
        }
    }, [selectedMonth, selectedYear, cycleType, selectedCompanyId, selectedOfficeId, monthlyDebouncedSearch, selectedDepartment]);

    // Auto-scroll to today once when monthly records are loaded
    useEffect(() => {
        if (!monthlyLoading && monthlyRows.length > 0 && isTodayInCycle && !hasAutoScrolledToday.current) {
            hasAutoScrolledToday.current = true;
            const timer = setTimeout(() => {
                scrollToToday();
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [monthlyLoading, monthlyRows.length, isTodayInCycle]);

    // Load data on tab switch
    useEffect(() => { if (activeTab === "live") fetchLiveAttendance(); }, [activeTab, fetchLiveAttendance]);
    useEffect(() => { if (activeTab === "history") { setHistoryPage(1); fetchHistory(1); } }, [activeTab]);
    useEffect(() => { if (activeTab === "history") { setHistoryPage(1); fetchHistory(1); } }, [historyFrom, historyTo, selectedCompanyId, selectedOfficeId, historyDebouncedSearch, selectedDepartment]);
    useEffect(() => { if (activeTab === "monthly") fetchMonthly(); }, [activeTab, selectedMonth, selectedYear, cycleType, fetchMonthly]);

    // Manual & Authorized entry submit (Req 5.1, 5.2, 2.5 B, 2.5 D)
    const handleManualSubmit = async () => {
        if (!manualEmpId || !manualEmpId.trim()) {
            alert("Please select or enter an employee.");
            return;
        }
        if (!manualDate) {
            alert("Please select an attendance date.");
            return;
        }
        if (!manualStatus) {
            alert("Please select an attendance status.");
            return;
        }
        setManualSubmitting(true);
        try {
            const isOutdoorDuty = manualIsOutdoor || manualStatus === "Present - Outdoor";
            const isWoWorked = manualStatus === "Weekly Off Worked";
            const normalizedStatus = manualStatus === "Present - Outdoor" ? "Present" : manualStatus;
            await apiPost("/attendance/admin/manual-entry", {
                employeeId: manualEmpId,
                date: manualDate,
                status: normalizedStatus,
                reason: manualReason,
                is_outdoor: isOutdoorDuty,
                is_weekly_off_worked: isWoWorked,
                weekly_off_compensation: isWoWorked ? manualWoComp : "none",
                check_in_time: manualCheckInTime || undefined,
                check_out_time: manualCheckOutTime || undefined,
            });
            setIsManualEntryOpen(false);
            setManualEmpId("");
            setManualDate("");
            setManualStatus("Present");
            setManualReason("");
            setManualIsOutdoor(false);
            setManualCheckInTime("");
            setManualCheckOutTime("");
            setManualWoComp("additional_payable_day");
            if (activeTab === "live") fetchLiveAttendance();
            if (activeTab === "history") fetchHistory();
            if (activeTab === "monthly") fetchMonthly();
        } catch (err: any) {
            console.error("Manual entry failed:", err);
            alert(err?.response?.data?.message || "Failed to submit manual entry. Check employee ID.");
        } finally {
            setManualSubmitting(false);
        }
    };

    // Quick Attendance Adjustment directly from Grid Cell Click (Req 2.5 B & D)
    const openCellAdjust = (emp: any, dayIdx: number, dateObj: Date) => {
        const yyyy = dateObj.getFullYear();
        const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
        const dd = String(dateObj.getDate()).padStart(2, '0');
        const dateStr = `${yyyy}-${mm}-${dd}`;
        const detail = emp.grid_details ? emp.grid_details[dayIdx] : null;
        const currentCode = detail?.display_code || (emp.grid ? emp.grid[dayIdx] : '-');

        setSelectedCellAdjust({
            emp,
            dayIdx,
            date: dateStr,
            dateObj,
            currentStatus: currentCode,
            cellDetail: detail,
        });

        if (currentCode === 'A') setCellAdjustStatus('Absent');
        else if (currentCode === 'HD') setCellAdjustStatus('Half Day');
        else if (currentCode === 'WO' || detail?.is_weekly_off_worked) setCellAdjustStatus('Weekly Off Worked');
        else setCellAdjustStatus('Present');

        setCellAdjustWoComp(detail?.compensation === 'comp_off' ? 'comp_off' : 'additional_payable_day');
        setCellAdjustCheckIn(detail?.check_in_time ? detail.check_in_time.slice(0, 5) : (emp.shift_start_time ? emp.shift_start_time.slice(0, 5) : "10:00"));
        setCellAdjustCheckOut(detail?.check_out_time ? detail.check_out_time.slice(0, 5) : (emp.shift_end_time ? emp.shift_end_time.slice(0, 5) : "19:00"));
        setCellAdjustReason(detail?.remarks || "");
        setIsCellAdjustOpen(true);
    };

    const handleCellAdjustSubmit = async () => {
        if (!selectedCellAdjust) return;
        setCellAdjustSubmitting(true);
        try {
            const isWo = cellAdjustStatus === "Weekly Off Worked";
            await apiPost("/attendance/admin/manual-entry", {
                employeeId: selectedCellAdjust.emp.employee_id || selectedCellAdjust.emp.id,
                date: selectedCellAdjust.date,
                status: isWo ? "Weekly Off Worked" : cellAdjustStatus,
                is_weekly_off_worked: isWo,
                weekly_off_compensation: isWo ? cellAdjustWoComp : "none",
                check_in_time: cellAdjustCheckIn ? `${cellAdjustCheckIn}:00` : undefined,
                check_out_time: cellAdjustCheckOut ? `${cellAdjustCheckOut}:00` : undefined,
                reason: cellAdjustReason || (isWo ? `Weekly off worked (${cellAdjustWoComp})` : `Admin adjusted to ${cellAdjustStatus}`),
            });
            setIsCellAdjustOpen(false);
            setSelectedCellAdjust(null);
            await fetchMonthly();
        } catch (err: any) {
            console.error("Cell adjust error:", err);
            alert(err?.response?.data?.message || "Failed to adjust attendance. Please try again.");
        } finally {
            setCellAdjustSubmitting(false);
        }
    };

    // Rotational & Fixed Weekly-Off Schedule Handlers (Req 2.5 C)
    const openWeeklyOffEdit = (emp: any) => {
        setEditingEmpWeeklyOff(emp);
        let offs = emp.weekly_off_days;
        if (typeof offs === "string") {
            try { offs = JSON.parse(offs); } catch (e) { offs = [offs]; }
        }
        setEditOffDays(Array.isArray(offs) && offs.length > 0 ? offs : ["Sunday"]);
        setEditRotationalOff(Boolean(emp.rotational_weekly_off));
    };

    const toggleEditOffDay = (dayName: string) => {
        if (editOffDays.includes(dayName)) {
            if (editOffDays.length === 1) {
                alert("At least one weekly off day must be selected.");
                return;
            }
            setEditOffDays(editOffDays.filter(d => d !== dayName));
        } else {
            setEditOffDays([...editOffDays, dayName]);
        }
    };

    const handleSaveWeeklyOffSchedule = async () => {
        if (!editingEmpWeeklyOff) return;
        setWeeklyOffSaving(true);
        try {
            await apiPut("/attendance/admin/weekly-off-config", {
                employeeId: editingEmpWeeklyOff.employee_id || editingEmpWeeklyOff.id,
                weekly_off_days: editOffDays,
                rotational_weekly_off: editRotationalOff,
                weekly_off_type: editRotationalOff ? "rotational" : "fixed",
            });
            setEditingEmpWeeklyOff(null);
            await fetchMonthly();
        } catch (err: any) {
            console.error("Save weekly off schedule error:", err);
            alert(err?.response?.data?.message || "Failed to update weekly off schedule.");
        } finally {
            setWeeklyOffSaving(false);
        }
    };

    // Tour submit — marks employee on tour for a date range (paid, no salary deduction)
    const handleTourSubmit = async () => {
        if (!tourEmpId || !tourTitle || !tourStartDate || !tourEndDate) {
            alert("Employee ID, Title, Start Date and End Date are required.");
            return;
        }
        if (new Date(tourEndDate) < new Date(tourStartDate)) {
            alert("End date cannot be before start date.");
            return;
        }
        setTourSubmitting(true);
        try {
            await apiPost("/attendance/admin/tours", {
                employeeId: /^\d+$/.test(tourEmpId) ? Number(tourEmpId) : tourEmpId,
                title: tourTitle,
                description: tourDescription || undefined,
                fromLocation: tourFromLocation || undefined,
                toLocation: tourToLocation || undefined,
                startDate: tourStartDate,
                endDate: tourEndDate,
            });
            setIsTourOpen(false);
            setTourEmpId("");
            setTourTitle("");
            setTourDescription("");
            setTourFromLocation("");
            setTourToLocation("");
            setTourStartDate("");
            setTourEndDate("");
            if (activeTab === "live") fetchLiveAttendance();
            if (activeTab === "history") fetchHistory();
            if (activeTab === "monthly") fetchMonthly();
        } catch (err: any) {
            console.error("Tour mark failed:", err);
            alert(err?.response?.data?.message || "Failed to mark tour. Check employee ID.");
        } finally {
            setTourSubmitting(false);
        }
    };

    const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]);

    return (
        <ProtectedRoute module="ATTENDANCE" action="READ">
            <div className="space-y-8 pb-20">
                {/* Header */}
                <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between px-2 pt-4">
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 italic uppercase tracking-tighter underline underline-offset-8 decoration-[#D9F99D] decoration-4">Attendance Control</h1>
                        <p className="text-[10px] font-bold text-slate-400 mt-4 uppercase tracking-[0.2em]">Real-time GPS Monitoring & Deep Intelligence</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        {/* Late Attendance Rule / Config Trigger (Req 5.3) */}
                        <Button
                            onClick={() => {
                                setTempLateThreshold(lateThresholdMinutes);
                                setIsLateThresholdOpen(true);
                            }}
                            variant="outline"
                            className="border-amber-200 bg-amber-50/70 hover:bg-amber-100 text-amber-900 font-black uppercase text-[9px] tracking-widest px-4 h-11 rounded-2xl shadow-xs transition-all gap-2"
                            title="Configure Late Attendance Threshold Rule (Req 5.3)"
                        >
                            <Clock className="h-4 w-4 text-amber-600" />
                            <span>Late Rule: {lateThresholdMinutes}m</span>
                        </Button>
                        <Button
                            onClick={() => setIsWeeklyOffModalOpen(true)}
                            variant="outline"
                            className="border-purple-200 bg-purple-50/70 hover:bg-purple-100 text-purple-900 font-black uppercase text-[9px] tracking-widest px-4 h-11 rounded-2xl shadow-xs transition-all gap-2"
                            title="Configure Fixed & Rotational Weekly Off Schedule (Req 2.5 C)"
                        >
                            <Sliders className="h-4 w-4 text-purple-600" />
                            <span>Weekly Offs</span>
                        </Button>
                        <Button
                            onClick={() => setIsTourOpen(true)}
                            className="bg-indigo-600 text-white hover:bg-indigo-700 font-black uppercase text-[9px] tracking-widest px-5 h-11 rounded-2xl shadow-md transition-all hover:translate-y-[-2px]"
                        >
                            <Plane className="h-4 w-4 mr-2 text-[#D9F99D]" /> Mark Tour
                        </Button>
                        <Button
                            onClick={() => {
                                setManualEmpId("");
                                setManualDate(new Date().toISOString().split('T')[0]);
                                setManualStatus("Present");
                                setManualReason("");
                                setManualIsOutdoor(false);
                                setManualCheckInTime("10:00");
                                setManualCheckOutTime("19:00");
                                setIsManualEntryOpen(true);
                            }}
                            className="bg-slate-900 text-white hover:bg-black font-black uppercase text-[9px] tracking-widest px-5 h-11 rounded-2xl shadow-md transition-all hover:translate-y-[-2px]"
                        >
                            <UserCheck className="h-4 w-4 mr-2 text-[#D9F99D]" /> Authorized Mark
                        </Button>
                        <div className="flex bg-slate-100 p-1 rounded-2xl">
                            <Button
                                onClick={() => setActiveTab("live")}
                                variant="ghost"
                                className={cn(
                                    "h-10 px-6 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all",
                                    activeTab === "live" ? "bg-white shadow-sm text-slate-900" : "text-slate-400 hover:text-slate-900"
                                )}
                            >
                                <Zap className="h-4 w-4 mr-2" /> Live Status
                            </Button>
                            <Button
                                onClick={() => setActiveTab("history")}
                                variant="ghost"
                                className={cn(
                                    "h-10 px-6 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all",
                                    activeTab === "history" ? "bg-white shadow-sm text-slate-900" : "text-slate-400 hover:text-slate-900"
                                )}
                            >
                                <History className="h-4 w-4 mr-2" /> History
                            </Button>
                            <Button
                                onClick={() => setActiveTab("monthly")}
                                variant="ghost"
                                className={cn(
                                    "h-10 px-6 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all",
                                    activeTab === "monthly" ? "bg-white shadow-sm text-slate-900" : "text-slate-400 hover:text-slate-900"
                                )}
                            >
                                <Calendar className="h-4 w-4 mr-2" /> Monthly Grid
                            </Button>
                        </div>
                    </div>
                </div>

                {activeTab === "live" && (
                    <>
                        {/* Stats Overview */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 px-2">
                            {[
                                { label: "Total Staff", value: stats.total, icon: Users2, trend: "Active", color: "bg-[#E0E7FF]", unit: "Staff", statusFilter: "All" },
                                { label: "Present Today", value: stats.present, icon: UserCheck, trend: "82%", color: "bg-[#D1FAE5]", unit: "Online", statusFilter: "Present" },
                                { label: "Absent Today", value: stats.absent, icon: UserX, trend: "10%", color: "bg-[#FEE2E2]", unit: "Offline", statusFilter: "Absent" },
                                { label: "Late Arrivals", value: stats.late, icon: Clock, trend: "8%", color: "bg-[#FEF3C7]", unit: "Delayed", statusFilter: "Late" },
                            ].map((s, i) => (
                                <Card
                                    key={i}
                                    onClick={() => {
                                        setSelectedStatus(s.statusFilter as "All" | "Present" | "Absent" | "Late");
                                        setCurrentPage(1);
                                    }}
                                    className={cn(
                                        s.color,
                                        "border-none rounded-2xl p-6 shadow-sm flex flex-col justify-between h-36 group hover:shadow-lg transition-all cursor-pointer",
                                        selectedStatus === s.statusFilter ? "scale-[1.02] shadow-md" : "hover:scale-[1.02]"
                                    )}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="h-8 w-8 bg-white/50 rounded-lg flex items-center justify-center">
                                            <s.icon className="h-4 w-4 text-slate-600" />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {selectedStatus === s.statusFilter && (
                                                <div className="h-2 w-2 rounded-full bg-slate-900 shadow-sm" />
                                            )}
                                            <Badge className="bg-white/30 text-slate-900 border-none font-black text-[7px] uppercase tracking-widest px-2 h-5 rounded-md italic">{s.trend}</Badge>
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-0.5">{s.label}</p>
                                        <h3 className="text-2xl font-black text-slate-900 italic tracking-tighter">
                                            {s.value} <span className="text-[9px] uppercase font-bold text-slate-400 not-italic ml-1">{s.unit}</span>
                                        </h3>
                                    </div>
                                </Card>
                            ))}
                        </div>

                        {/* Live Monitoring Table */}
                        <Card className="border-none shadow-sm rounded-[2.5rem] bg-white overflow-hidden mx-2">
                            <CardHeader className="p-8 pb-4 border-none flex flex-col xl:flex-row xl:items-center xl:justify-between gap-6">
                                <div>
                                    <CardTitle className="text-xl font-black italic uppercase text-slate-900 tracking-tighter">Live Attendance Hub</CardTitle>
                                    <CardDescription className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Real-time Staff Tracking</CardDescription>
                                </div>
                                <div className="flex flex-nowrap items-center gap-2 overflow-x-auto pb-2 -mb-2 scrollbar-none w-full xl:w-auto">
                                    <div className="flex items-center gap-2 bg-slate-50 px-3 shrink-0 rounded-xl border border-slate-100">
                                        <Building2 className="h-3.5 w-3.5 text-slate-400" />
                                        <select
                                            className="bg-transparent border-none text-[9px] font-black uppercase tracking-widest outline-none pr-2 h-10 cursor-pointer"
                                            value={selectedCompanyId}
                                            onChange={(e) => { setSelectedCompanyId(e.target.value); setCurrentPage(1); }}
                                        >
                                            <option value="">All Companies</option>
                                            {companies.map((c) => (
                                                <option key={c.id} value={c.id.toString()}>{c.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="flex items-center gap-2 bg-slate-50 px-3 shrink-0 rounded-xl border border-slate-100">
                                        <MapPin className="h-3.5 w-3.5 text-slate-400" />
                                        <select
                                            className="bg-transparent border-none text-[9px] font-black uppercase tracking-widest outline-none pr-2 h-10 cursor-pointer"
                                            value={selectedOfficeId}
                                            onChange={(e) => { setSelectedOfficeId(e.target.value); setCurrentPage(1); }}
                                        >
                                            <option value="">All Offices</option>
                                            {offices.map((o) => (
                                                <option key={o.id} value={o.id.toString()}>{o.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="flex items-center gap-2 bg-slate-50 px-3 shrink-0 rounded-xl border border-slate-100">
                                        <Filter className="h-3.5 w-3.5 text-slate-400" />
                                        <select
                                            className="bg-transparent border-none text-[9px] font-black uppercase tracking-widest outline-none pr-2 h-10 cursor-pointer"
                                            value={selectedStatus}
                                            onChange={(e) => {
                                                setSelectedStatus(e.target.value as any);
                                                setCurrentPage(1);
                                            }}
                                        >
                                            <option value="All">All Status</option>
                                            <option value="Present">Present</option>
                                            <option value="Absent">Absent</option>
                                            <option value="Late">Late</option>
                                        </select>
                                    </div>
                                    <div className="flex items-center gap-2 bg-slate-50 px-3 shrink-0 rounded-xl border border-slate-100">
                                        <Users2 className="h-3.5 w-3.5 text-slate-400" />
                                        <select
                                            className="bg-transparent border-none text-[9px] font-black uppercase tracking-widest outline-none pr-2 h-10 cursor-pointer"
                                            value={selectedDepartment}
                                            onChange={(e) => {
                                                setSelectedDepartment(e.target.value);
                                                setCurrentPage(1);
                                            }}
                                        >
                                            <option value="">All Departments</option>
                                            {departments.map((d) => (
                                                <option key={d} value={d}>{d}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="relative group shrink-0">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-300 group-focus-within:text-slate-900 transition-colors" />
                                        <Input
                                            placeholder="Search Staff..."
                                            className="h-10 w-36 pl-9 bg-slate-50 border-none rounded-xl font-bold text-[9px] focus-visible:ring-1 focus-visible:ring-[#D9F99D]"
                                            value={searchTerm}
                                            onChange={(e) => handleSearchChange(e.target.value)}
                                        />
                                    </div>
                                    <Button variant="outline" className="h-10 w-10 p-0 shrink-0 rounded-xl border-slate-100 hover:bg-slate-50 transition-all" onClick={() => fetchLiveAttendance()}>
                                        <RefreshCw className={cn("h-4 w-4 text-slate-400", liveLoading && "animate-spin")} />
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="h-10 px-4 shrink-0 rounded-xl border-slate-100 font-black text-[9px] uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
                                        onClick={() => {
                                            setExportType("live");
                                            setExportDeptSelection(selectedDepartment || "All");
                                            setIsExportDialogOpen(true);
                                        }}
                                        disabled={exportingLive}
                                    >
                                        {exportingLive ? (
                                            <svg className="animate-spin h-4 w-4 mr-2 text-emerald-500" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                            </svg>
                                        ) : (
                                            <FileSpreadsheet className="h-4 w-4 mr-2 text-emerald-500" />
                                        )}
                                        {exportingLive ? "Exporting..." : "Export"}
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader>
                                        <tr className="bg-slate-50/50 border-b border-slate-100">
                                            <th className="text-left py-5 px-8 text-[9px] font-black text-slate-400 uppercase tracking-widest">Employee</th>
                                            <th className="text-left py-5 px-8 text-[9px] font-black text-slate-400 uppercase tracking-widest">In/Out & Device</th>
                                            <th className="text-left py-5 px-8 text-[9px] font-black text-slate-400 uppercase tracking-widest">Location</th>
                                            <th className="text-left py-5 px-8 text-[9px] font-black text-slate-400 uppercase tracking-widest">Company</th>
                                            <th className="text-left py-5 px-8 text-[9px] font-black text-slate-400 uppercase tracking-widest">Shift & Hours</th>
                                            <th className="text-left py-5 px-8 text-[9px] font-black text-slate-400 uppercase tracking-widest">Remarks</th>
                                            <th className="text-left py-5 px-8 text-[9px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                                        </tr>
                                    </TableHeader>
                                    <TableBody>
                                        {liveLoading ? (
                                            <tr><td colSpan={7} className="py-20 text-center"><p className="text-[10px] font-bold text-slate-400 animate-pulse">Loading live data...</p></td></tr>
                                        ) : attendanceLogs.length === 0 ? (
                                            <tr><td colSpan={7} className="py-20 text-center"><p className="text-[10px] font-bold text-slate-400">No attendance records found</p></td></tr>
                                        ) : attendanceLogs.map((log) => (
                                            <tr key={log.id} className="border-b border-slate-50 hover:bg-slate-50/30 transition-colors group">
                                                <td className="py-5 px-8">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-9 w-9 bg-slate-50 rounded-xl flex items-center justify-center font-black italic text-xs text-slate-400 border border-white shadow-sm">
                                                            {log.name.charAt(0)}
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-xs font-black text-slate-900 italic uppercase tracking-tighter">{log.name}</span>
                                                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{log.id}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-5 px-8">
                                                    <div className="space-y-1.5">
                                                        <div className="flex flex-col">
                                                            <span className="text-[10px] font-black text-slate-700 italic">IN: {log.punchIn}</span>
                                                            <span className="text-[10px] font-black text-slate-400 italic">OUT: {log.punchOut}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            {log.isOutdoor ? (
                                                                <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200/60 font-black text-[7px] px-1.5 h-4 rounded uppercase tracking-wider flex items-center gap-1 shadow-xs">
                                                                    <Compass className="h-2.5 w-2.5 text-emerald-600" /> Outdoor Duty
                                                                </Badge>
                                                            ) : (
                                                                <div className="flex items-center gap-1.5 opacity-60">
                                                                    <Smartphone className="h-2.5 w-2.5 text-slate-400" />
                                                                    <span className="text-[8px] font-bold uppercase tracking-widest text-slate-400">{log.device}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-5 px-8">
                                                    <div className="space-y-2">
                                                        <div className="flex items-center gap-2 group/loc">
                                                            <MapPin className="h-3 w-3 text-rose-400" />
                                                            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">{log.location}</span>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-6 w-6 rounded-md bg-blue-50/50 hover:bg-blue-100 transition-colors ml-1"
                                                                onClick={() => openMap(log)}
                                                                title="View on Map"
                                                            >
                                                                <MapIcon className="h-3.5 w-3.5 text-blue-500" />
                                                            </Button>
                                                        </div>
                                                        <span className="text-[8px] font-bold text-slate-400">{log.distance}</span>
                                                    </div>
                                                </td>
                                                <td className="py-5 px-8">
                                                    <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">{log.company}</span>
                                                </td>
                                                <td className="py-5 px-8">
                                                    <div className="space-y-1.5">
                                                        <p className="text-[10px] font-black text-slate-900 uppercase italic tracking-tighter">{log.shift}</p>
                                                        <div className="flex items-center gap-1.5">
                                                            <Timer className="h-3 w-3 text-slate-300" />
                                                            <span className="text-[10px] font-bold text-slate-600">{log.hours}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-5 px-8">
                                                    <div className="space-y-1">
                                                        {log.remarks ? (
                                                            <p className="text-[9px] font-bold text-slate-700 leading-tight max-w-[200px] truncate" title={log.remarks}>
                                                                {log.remarks}
                                                            </p>
                                                        ) : (
                                                            <span className="text-[9px] font-bold text-slate-300 italic">No remarks</span>
                                                        )}
                                                        {log.markedBy && (
                                                            <Badge className="bg-indigo-50 text-indigo-700 border-none font-bold text-[7px] px-1.5 h-3.5 rounded uppercase tracking-wider block w-fit">
                                                                Authorized by {log.markedBy.name}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="py-5 px-8">
                                                    <div className="flex items-center gap-2 group/status">
                                                        <Badge className={cn(
                                                            "font-black text-[8px] uppercase tracking-widest px-3 py-1 rounded-lg border-none shadow-sm cursor-pointer hover:opacity-80 transition-opacity",
                                                            log.status === 'Present' ? "bg-emerald-50 text-emerald-600" :
                                                                log.status === 'Late' ? "bg-amber-50 text-amber-600" :
                                                                    log.status === 'Half Day' ? "bg-blue-50 text-blue-600" :
                                                                        log.status === 'Tour' ? "bg-violet-50 text-violet-600" :
                                                                            log.status === 'Weekend' ? "bg-slate-100 text-slate-500" :
                                                                                log.status === 'Holiday' ? "bg-purple-50 text-purple-600" : "bg-rose-50 text-rose-600"
                                                        )}
                                                            onClick={() => {
                                                                setManualEmpId(log.id);
                                                                setIsManualEntryOpen(true);
                                                            }}>
                                                            {log.status}
                                                        </Badge>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6 rounded-md opacity-0 group-hover/status:opacity-100 transition-opacity"
                                                            onClick={() => {
                                                                setManualEmpId(log.id);
                                                                setIsManualEntryOpen(true);
                                                            }}
                                                        >
                                                            <Settings className="h-3 w-3 text-slate-400" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </TableBody>
                                </Table>

                                {/* Pagination Controls */}
                                <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">
                                        Showing Page {currentPage} of {livePagination.totalPages || 1} ({liveTotalFiltered} total)
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                            disabled={currentPage === 1}
                                            className="h-9 px-4 rounded-xl border-slate-200 font-black text-[9px] uppercase tracking-widest disabled:opacity-30"
                                        >
                                            Prev
                                        </Button>
                                        {[...Array(livePagination.totalPages || 1)].map((_, i) => (
                                            <Button
                                                key={i}
                                                variant={currentPage === i + 1 ? "default" : "outline"}
                                                size="sm"
                                                onClick={() => setCurrentPage(i + 1)}
                                                className={cn(
                                                    "h-9 w-9 rounded-xl font-black text-[9px] border-slate-200",
                                                    currentPage === i + 1 ? "bg-slate-900 text-white" : "text-slate-400 hover:bg-white"
                                                )}
                                            >
                                                {i + 1}
                                            </Button>
                                        ))}
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setCurrentPage(prev => Math.min(livePagination.totalPages || 1, prev + 1))}
                                            disabled={currentPage === (livePagination.totalPages || 1)}
                                            className="h-9 px-4 rounded-xl border-slate-200 font-black text-[9px] uppercase tracking-widest disabled:opacity-30"
                                        >
                                            Next
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </>
                )}

                {activeTab === "history" && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 mx-2">
                        {/* History Search & Filters */}
                        <Card className="border-none shadow-sm rounded-[2rem] bg-white ">
                            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-8">
                                <div className="space-y-2">
                                </div>
                                <div className="flex flex-wrap items-center justify-between gap-4">
                                    <div className="flex flex-wrap items-center gap-3">
                                        {/* Date Picker Group */}
                                        <div className="flex items-center gap-2 bg-slate-50 px-3 h-10 rounded-xl border border-slate-200 shadow-sm">
                                            <Calendar className="h-3.5 w-3.5 text-slate-400" />
                                            <Input type="date" value={historyFrom} onChange={(e) => setHistoryFrom(e.target.value)} className="h-full w-28 bg-transparent border-none text-[9px] font-bold uppercase p-0 focus-visible:ring-0" />
                                            <span className="text-[8px] font-black text-slate-300">TO</span>
                                            <Input type="date" value={historyTo} onChange={(e) => setHistoryTo(e.target.value)} className="h-full w-28 bg-transparent border-none text-[9px] font-bold uppercase p-0 focus-visible:ring-0" />
                                        </div>

                                        {/* Company + Office Filters */}
                                        <div className="flex items-center gap-2 bg-slate-50 px-3 h-10 rounded-xl border border-slate-200 shadow-sm">
                                            <Building2 className="h-3.5 w-3.5 text-indigo-400" />
                                            <select value={selectedCompanyId} onChange={(e) => setSelectedCompanyId(e.target.value)} className="bg-transparent border-none text-[9px] font-black uppercase outline-none pr-2 h-full">
                                                <option value="">All Companies</option>
                                                {companies.map((c) => (
                                                    <option key={c.id} value={c.id.toString()}>{c.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="flex items-center gap-2 bg-slate-50 px-3 h-10 rounded-xl border border-slate-200 shadow-sm">
                                            <MapPin className="h-3.5 w-3.5 text-rose-400" />
                                            <select value={selectedOfficeId} onChange={(e) => setSelectedOfficeId(e.target.value)} className="bg-transparent border-none text-[9px] font-black uppercase outline-none pr-2 h-full">
                                                <option value="">All Offices</option>
                                                {offices.map((o) => (
                                                    <option key={o.id} value={o.id.toString()}>{o.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="flex items-center gap-2 bg-slate-50 px-3 h-10 rounded-xl border border-slate-200 shadow-sm">
                                            <Users2 className="h-3.5 w-3.5 text-indigo-400" />
                                            <select value={selectedDepartment} onChange={(e) => setSelectedDepartment(e.target.value)} className="bg-transparent border-none text-[9px] font-black uppercase outline-none pr-2 h-full">
                                                <option value="">All Departments</option>
                                                {departments.map((d) => (
                                                    <option key={d} value={d}>{d}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Search Input */}
                                        <div className="relative group min-w-[200px]">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                                            <Input
                                                placeholder="Search Employee..."
                                                value={historySearch}
                                                onChange={(e) => handleHistorySearchChange(e.target.value)}
                                                className="h-10 pl-9 pr-4 w-full bg-slate-50 border-slate-200 rounded-xl text-[10px] font-bold focus:bg-white transition-all shadow-sm"
                                            />
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2">
                                        <Button onClick={() => { setHistoryPage(1); fetchHistory(1); }} className="h-10 px-6 rounded-xl bg-slate-900 text-white font-black text-[9px] uppercase tracking-widest shadow-lg hover:bg-black transition-all">
                                            {historyLoading ? "Loading..." : "Fetch Data"}
                                        </Button>
                                        <Button
                                            variant="outline"
                                            className="h-10 w-10 rounded-xl border-slate-200 bg-white shadow-sm hover:bg-slate-50 transition-all flex items-center justify-center disabled:opacity-50"
                                            onClick={() => {
                                                setExportType("history");
                                                setExportDeptSelection(selectedDepartment || "All");
                                                setIsExportDialogOpen(true);
                                            }}
                                            disabled={exportingHistory}
                                            title="Export CSV"
                                        >
                                            {exportingHistory ? (
                                                <svg className="animate-spin h-4 w-4 text-emerald-500" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                                </svg>
                                            ) : (
                                                <Download className="h-4 w-4 text-slate-400" />
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </Card>

                        {/* History Stats Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {[
                                { label: "Avg Attendance", value: `${historyStats.avgAttendance}%`, desc: "Consistency Rate", icon: Activity, color: "emerald", trend: `${historyStats.presentRecords} present`, barWidth: historyStats.totalRecords > 0 ? Math.round((historyStats.presentRecords / historyStats.totalRecords) * 100) : 0 },
                                { label: "Late Incidents", value: `${historyStats.lateRecords}`, desc: "Total Lates", icon: AlertCircle, color: "rose", trend: `${historyStats.absentRecords} absent`, barWidth: historyStats.totalRecords > 0 ? Math.round((historyStats.lateRecords / historyStats.totalRecords) * 100) : 0 },
                                { label: "Active Employees", value: `${historyStats.activeEmployees}`, desc: "Head Count", icon: Globe, color: "blue", trend: `${historyStats.totalRecords} records`, barWidth: historyStats.activeEmployees > 0 ? 100 : 0 },
                                { label: "Work Hours", value: (historyStats.totalWorkHours ?? 0).toLocaleString(), desc: "Total Production", icon: Timer, color: "amber", trend: `${historyStats.totalOvertimeHours ?? 0}h OT`, barWidth: (historyStats.totalWorkHours ?? 0) > 0 ? 75 : 0 },
                            ].map((stat, i) => (
                                <Card key={i} className="border-none shadow-sm rounded-[2rem] bg-white p-6 relative overflow-hidden group">
                                    <div className={cn("absolute top-0 right-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full opacity-[0.03] transition-transform group-hover:scale-110", `bg-${stat.color}-500`)} />
                                    <div className="space-y-4 relative z-10">
                                        <div className="flex items-center justify-between">
                                            <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center",
                                                stat.color === 'emerald' ? "bg-emerald-50 text-emerald-500" :
                                                    stat.color === 'rose' ? "bg-rose-50 text-rose-500" :
                                                        stat.color === 'blue' ? "bg-blue-50 text-blue-500" : "bg-amber-50 text-amber-500"
                                            )}>
                                                <stat.icon className="h-5 w-5" />
                                            </div>
                                            <Badge className="bg-slate-50 text-slate-500 font-black text-[7px] uppercase tracking-widest border-none">{stat.trend}</Badge>
                                        </div>
                                        <div>
                                            <p className="text-2xl font-black italic text-slate-900">{stat.value}</p>
                                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">{stat.label}</p>
                                        </div>
                                        <div className="h-1 w-full bg-slate-50 rounded-full overflow-hidden">
                                            <div className={cn("h-full rounded-full transition-all duration-500",
                                                stat.color === 'emerald' ? "bg-emerald-400" :
                                                    stat.color === 'rose' ? "bg-rose-400" :
                                                        stat.color === 'blue' ? "bg-blue-400" : "bg-amber-400"
                                            )} style={{ width: `${Math.max(stat.barWidth, 4)}%` }} />
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>

                        {/* Detailed History Table */}
                        <Card className="border-none shadow-sm rounded-[2.5rem] bg-white overflow-hidden">
                            <CardHeader className="p-8 pb-4 border-none flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle className="text-lg font-black italic uppercase text-slate-900 tracking-tighter">Historical Data Logs</CardTitle>
                                    <CardDescription className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Audit trail of all attendance events</CardDescription>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="flex -space-x-2">
                                        {(function () {
                                            const uniqueEmployees = Array.from(new Map(historyData.map((row: any) => [row.id, row])).values()).slice(0, 4);
                                            return uniqueEmployees.map((row: any, i: number) => (
                                                <div key={i} className="h-7 w-7 rounded-full border-2 border-white bg-indigo-100 flex items-center justify-center text-[8px] font-black text-indigo-600 shadow-sm" title={row.name}>
                                                    {row.name ? row.name.charAt(0).toUpperCase() : '?'}
                                                </div>
                                            ));
                                        })()}
                                        {(function () {
                                            const uniqueCount = new Set(historyData.map((row: any) => row.id)).size;
                                            return uniqueCount > 4 ? (
                                                <div className="h-7 w-7 rounded-full border-2 border-white bg-slate-900 flex items-center justify-center text-[7px] font-black text-[#D9F99D] shadow-sm">+{uniqueCount - 4}</div>
                                            ) : null;
                                        })()}
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader>
                                        <tr className="bg-slate-50/50 border-b border-slate-100">
                                            <th className="text-left py-5 px-8 text-[9px] font-black text-slate-400 uppercase tracking-widest">Date & Employee</th>
                                            <th className="text-left py-5 px-8 text-[9px] font-black text-slate-400 uppercase tracking-widest">In/Out & Device</th>
                                            <th className="text-left py-5 px-8 text-[9px] font-black text-slate-400 uppercase tracking-widest">Location</th>
                                            <th className="text-left py-5 px-8 text-[9px] font-black text-slate-400 uppercase tracking-widest">Company</th>
                                            <th className="text-left py-5 px-8 text-[9px] font-black text-slate-400 uppercase tracking-widest">Shift & Hours</th>
                                            <th className="text-left py-5 px-8 text-[9px] font-black text-slate-400 uppercase tracking-widest">Remarks</th>
                                            <th className="text-left py-5 px-8 text-[9px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                                        </tr>
                                    </TableHeader>
                                    <TableBody>
                                        {historyLoading ? (
                                            <tr><td colSpan={7} className="py-20 text-center"><p className="text-[10px] font-bold text-slate-400 animate-pulse">Loading history...</p></td></tr>
                                        ) : historyData.length === 0 ? (
                                            <tr><td colSpan={7} className="py-20 text-center"><p className="text-[10px] font-bold text-slate-400">No history records found</p></td></tr>
                                        ) : historyData.map((row, i) => (
                                            <tr key={row.record_id || i} className="border-b border-slate-50 hover:bg-slate-50/30 transition-colors group">
                                                <td className="py-5 px-8">
                                                    <div className="flex flex-col">
                                                        <span className="text-[11px] font-black text-slate-900 italic uppercase tracking-tighter">{row.name}</span>
                                                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{row.date} • {row.id}</span>
                                                    </div>
                                                </td>
                                                <td className="py-5 px-8">
                                                    <div className="space-y-1.5">
                                                        <div className="flex flex-col">
                                                            <span className="text-[10px] font-black text-slate-700 italic">IN: {row.in}</span>
                                                            <span className="text-[10px] font-black text-slate-400 italic">OUT: {row.out}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 opacity-60">
                                                            <Smartphone className="h-2.5 w-2.5 text-slate-400" />
                                                            <span className="text-[8px] font-bold uppercase tracking-widest text-slate-400">{row.device}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-5 px-8">
                                                    <div className="space-y-2">
                                                        <div className="flex items-center gap-2">
                                                            <MapPin className="h-3 w-3 text-rose-400" />
                                                            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">{row.hub}</span>
                                                        </div>
                                                        <span className="text-[8px] font-bold text-slate-400">{row.dist}</span>
                                                    </div>
                                                </td>
                                                <td className="py-5 px-8">
                                                    <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">{row.company}</span>
                                                </td>
                                                <td className="py-5 px-8">
                                                    <div className="space-y-1.5">
                                                        <p className="text-[10px] font-black text-slate-900 uppercase italic tracking-tighter">{row.shift}</p>
                                                        <div className="flex items-center gap-1.5">
                                                            <Timer className="h-3 w-3 text-slate-300" />
                                                            <span className="text-[10px] font-bold text-slate-600">{row.hours}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-5 px-8">
                                                    <div className="space-y-1.5">
                                                        <span className="text-[9px] font-bold text-slate-400 italic">No special remarks</span>
                                                    </div>
                                                </td>
                                                <td className="py-5 px-8">
                                                    <div className="flex items-center gap-2 group/status">
                                                        <Badge className={cn(
                                                            "font-black text-[8px] uppercase tracking-widest px-3 py-1 rounded-lg border-none shadow-sm cursor-pointer hover:opacity-80 transition-opacity",
                                                            row.status === 'Present' ? "bg-emerald-50 text-emerald-600" :
                                                                row.status === 'Late' ? "bg-amber-50 text-amber-600" :
                                                                    row.status === 'Half Day' ? "bg-blue-50 text-blue-600" :
                                                                        row.status === 'Tour' ? "bg-violet-50 text-violet-600" :
                                                                            row.status === 'Weekend' ? "bg-slate-100 text-slate-500" :
                                                                                row.status === 'Holiday' ? "bg-purple-50 text-purple-600" : "bg-rose-50 text-rose-600"
                                                        )}
                                                            onClick={() => {
                                                                setManualEmpId(row.id);
                                                                setIsManualEntryOpen(true);
                                                            }}>
                                                            {row.status}
                                                        </Badge>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6 rounded-md opacity-0 group-hover/status:opacity-100 transition-opacity"
                                                            onClick={() => {
                                                                setManualEmpId(row.id);
                                                                setIsManualEntryOpen(true);
                                                            }}
                                                        >
                                                            <Settings className="h-3 w-3 text-slate-400" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </TableBody>
                                </Table>
                                <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">
                                        Showing Page {historyPage} of {historyPagination.totalPages || 1} ({historyPagination.total} total)
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => { const p = Math.max(1, historyPage - 1); setHistoryPage(p); fetchHistory(p); }}
                                            disabled={historyPage === 1}
                                            className="h-9 px-4 rounded-xl border-slate-200 font-black text-[9px] uppercase tracking-widest disabled:opacity-30"
                                        >
                                            Prev
                                        </Button>
                                        {(() => {
                                            const totalPages = historyPagination.totalPages || 1;
                                            const current = historyPage;
                                            const pages: (number | string)[] = [];
                                            if (totalPages <= 7) {
                                                for (let i = 1; i <= totalPages; i++) pages.push(i);
                                            } else {
                                                pages.push(1);
                                                if (current > 3) pages.push("...");
                                                for (let i = Math.max(2, current - 1); i <= Math.min(totalPages - 1, current + 1); i++) pages.push(i);
                                                if (current < totalPages - 2) pages.push("...");
                                                pages.push(totalPages);
                                            }
                                            return pages.map((p, i) =>
                                                p === "..." ? (
                                                    <span key={`ellipsis-${i}`} className="px-1 text-[9px] font-black text-slate-300">...</span>
                                                ) : (
                                                    <Button
                                                        key={p}
                                                        variant={historyPage === p ? "default" : "outline"}
                                                        size="sm"
                                                        onClick={() => { setHistoryPage(p as number); fetchHistory(p as number); }}
                                                        className={cn(
                                                            "h-9 w-9 rounded-xl font-black text-[9px] border-slate-200",
                                                            historyPage === p ? "bg-slate-900 text-white" : "text-slate-400 hover:bg-white"
                                                        )}
                                                    >
                                                        {p}
                                                    </Button>
                                                )
                                            );
                                        })()}
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => { const p = Math.min(historyPagination.totalPages || 1, historyPage + 1); setHistoryPage(p); fetchHistory(p); }}
                                            disabled={historyPage === (historyPagination.totalPages || 1)}
                                            className="h-9 px-4 rounded-xl border-slate-200 font-black text-[9px] uppercase tracking-widest disabled:opacity-30"
                                        >
                                            Next
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {activeTab === "monthly" && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 mx-2">
                        {/* Monthly Attendance Summary Metrics Cards (Req 6.4, 8) */}
                        {/* Monthly Attendance Summary Metrics Cards (Req 2.5 A) */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                            {/* Card 1: Payable Days */}
                            <Card className="bg-emerald-950 text-white rounded-2xl p-4 shadow-sm border-none relative overflow-hidden">
                                <div className="flex items-center justify-between">
                                    <p className="text-[8px] font-black uppercase tracking-widest text-emerald-400">1. Payable Days</p>
                                    <Badge className="bg-emerald-500/20 text-emerald-300 font-bold text-[8px] px-1.5 py-0 border-none uppercase">Salary Paid</Badge>
                                </div>
                                <h4 className="text-2xl font-black italic tracking-tighter text-white mt-1">
                                    {monthlyRows.reduce((sum, r) => sum + (r.payable_days ?? ((r.present || 0) + (r.woff || 0) + (r.leave || 0) + (r.holiday || 0) + (r.tour || 0))), 0)}
                                </h4>
                                <span className="text-[8px] text-emerald-400/80 font-bold uppercase block mt-0.5">Present + WO + H + Leaves + Tour</span>
                            </Card>

                            {/* Card 2: Leave Without Pay (LWP) */}
                            <Card className="bg-rose-50/90 rounded-2xl p-4 shadow-sm border border-rose-100">
                                <div className="flex items-center justify-between">
                                    <p className="text-[8px] font-black uppercase tracking-widest text-rose-600">2. Leave Without Pay (LWP)</p>
                                    <Badge className="bg-rose-100 text-rose-800 font-bold text-[8px] px-1.5 py-0 border-none uppercase">Unpaid</Badge>
                                </div>
                                <h4 className="text-2xl font-black italic tracking-tighter text-rose-950 mt-1">
                                    {monthlyRows.reduce((sum, r) => sum + (r.lwp_days ?? (r.absent || 0)), 0)}
                                </h4>
                                <span className="text-[8px] text-rose-600 font-bold uppercase block mt-0.5">Unexcused / Loss of Pay Days</span>
                            </Card>

                            {/* Card 3: Total Leave Taken */}
                            <Card className="bg-indigo-50/90 rounded-2xl p-4 shadow-sm border border-indigo-100">
                                <div className="flex items-center justify-between">
                                    <p className="text-[8px] font-black uppercase tracking-widest text-indigo-600">3. Total Leave Taken</p>
                                    <Badge className="bg-indigo-100 text-indigo-800 font-bold text-[8px] px-1.5 py-0 border-none uppercase">All Leaves</Badge>
                                </div>
                                <h4 className="text-2xl font-black italic tracking-tighter text-indigo-950 mt-1">
                                    {monthlyRows.reduce((sum, r) => sum + (r.total_leaves_taken ?? ((r.leave || 0) + (r.absent || 0))), 0)}
                                </h4>
                                <span className="text-[8px] text-indigo-600 font-bold uppercase block mt-0.5">Paid Leaves + LWP Combined</span>
                            </Card>

                            {/* Card 4: Paid Leave Taken */}
                            <Card className="bg-violet-50/90 rounded-2xl p-4 shadow-sm border border-violet-100">
                                <div className="flex items-center justify-between">
                                    <p className="text-[8px] font-black uppercase tracking-widest text-violet-600">4. Paid Leave Taken</p>
                                    <Badge className="bg-violet-100 text-violet-800 font-bold text-[8px] px-1.5 py-0 border-none uppercase">Approved</Badge>
                                </div>
                                <h4 className="text-2xl font-black italic tracking-tighter text-violet-950 mt-1">
                                    {monthlyRows.reduce((sum, r) => sum + (r.paid_leaves_taken ?? (r.leave || 0)), 0)}
                                </h4>
                                <span className="text-[8px] text-violet-600 font-bold uppercase block mt-0.5">CL & EL Approved Balance</span>
                            </Card>

                            {/* Card 5: Remaining Leave Balance */}
                            <Card className="bg-amber-50/90 rounded-2xl p-4 shadow-sm border border-amber-100">
                                <div className="flex items-center justify-between">
                                    <p className="text-[8px] font-black uppercase tracking-widest text-amber-700">5. Remaining Leave Balance</p>
                                    <Badge className="bg-amber-100 text-amber-800 font-bold text-[8px] px-1.5 py-0 border-none uppercase">Available</Badge>
                                </div>
                                <h4 className="text-2xl font-black italic tracking-tighter text-amber-950 mt-1">
                                    {monthlyRows.reduce((sum, r) => sum + (r.remaining_leave_balance || 0), 0)}
                                </h4>
                                <span className="text-[8px] text-amber-700 font-bold uppercase block mt-0.5">Total Days Available in Ledger</span>
                            </Card>
                        </div>

                        {/* Approved Policy & Separate Tracking Banner (Req 2.5 A & D) */}
                        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-slate-700 shadow-sm">
                            <div className="flex flex-wrap items-center gap-3 text-[10px]">
                                <div className="flex items-center gap-1.5 font-black uppercase tracking-wider text-slate-900">
                                    <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                                    <span>Approved Leave Policy:</span>
                                </div>
                                <div className="flex items-center gap-1.5 font-bold">
                                    <span className="bg-blue-100 text-blue-900 px-2 py-0.5 rounded-md font-black">Muster ({daysInSelectedMonth})</span>
                                    <span className="text-slate-400 font-black">=</span>
                                    <span className="bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded-md font-black">Payable</span>
                                    <span className="text-slate-400 font-black">+</span>
                                    <span className="bg-rose-100 text-rose-900 px-2 py-0.5 rounded-md font-black">LWP</span>
                                </div>
                                <div className="hidden lg:inline text-slate-300">|</div>
                                <span className="text-slate-600 font-semibold text-[9px]">
                                    Paid Leave and LWP are tracked separately. Unapproved leave is never auto-treated as LWP without applying policy.
                                </span>
                                {monthlyRows.some(r => (r.weekly_off_worked_days || 0) > 0) && (
                                    <Badge className="bg-purple-100 text-purple-900 font-black text-[9px] px-2 py-0.5 border border-purple-200">
                                        ⚡ {monthlyRows.reduce((sum, r) => sum + (r.weekly_off_worked_days || 0), 0)} Weekly Off / Sunday Worked (Compensated)
                                    </Badge>
                                )}
                            </div>
                            <div className="text-[8px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                                Click any cell to manually adjust attendance
                            </div>
                        </div>

                        {/* Executive Month & Day Information Banner (Req 6.3) */}
                        <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-sm border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                            <div className="flex flex-wrap items-center gap-6 sm:gap-8">
                                <div>
                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">Selected Month</span>
                                    <div className="flex items-center gap-2.5 mt-1.5">
                                        <div className="h-8 w-8 rounded-xl bg-white/10 flex items-center justify-center">
                                            <Calendar className="h-4 w-4 text-[#D9F99D]" />
                                        </div>
                                        <div>
                                            <span className="text-lg sm:text-xl font-black italic tracking-tight text-white block leading-none">
                                                {monthNames[selectedMonth]} {selectedYear}
                                            </span>
                                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                                                {cycleType === "payroll" ? "Payroll Cycle Mode" : "Calendar Month Mode"}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="h-10 w-px bg-slate-700/60 hidden sm:block" />

                                <div>
                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">Applicable Dates / Period</span>
                                    <div className="flex items-center gap-2.5 mt-1.5">
                                        <div className="h-8 w-8 rounded-xl bg-sky-500/10 flex items-center justify-center">
                                            <Clock className="h-4 w-4 text-sky-400" />
                                        </div>
                                        <div>
                                            <span className="text-sm sm:text-base font-black tracking-wide text-slate-100 block leading-none">
                                                {cycleDates.length > 0
                                                    ? `${cycleDates[0].toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} — ${cycleDates[cycleDates.length - 1].toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`
                                                    : "---"}
                                            </span>
                                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                                                {cycleType === "payroll" ? "From 26th previous month to 25th current month" : "From 1st to final calendar day of month"}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="h-10 w-px bg-slate-700/60 hidden sm:block" />

                                <div>
                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">Total Calendar Days</span>
                                    <div className="flex items-center gap-2.5 mt-1.5">
                                        <div className="h-8 w-8 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                                            <span className="text-base font-black text-emerald-400">{daysInSelectedMonth}</span>
                                        </div>
                                        <div>
                                            <span className="text-base sm:text-lg font-black tracking-tight text-emerald-400 block leading-none">
                                                {daysInSelectedMonth} Days
                                            </span>
                                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                                                Active Working/Calendar Period
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row items-start lg:items-end gap-2">
                                <Badge className="bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[9px] font-black uppercase px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                                    Dynamic Grid: {daysInSelectedMonth} Columns Active
                                </Badge>
                                <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">
                                    {cycleType === "calendar" && daysInSelectedMonth === 30 && "30-day month (No phantom 31st date)"}
                                    {cycleType === "calendar" && daysInSelectedMonth === 28 && "28-day February (Exact 28 columns)"}
                                    {cycleType === "calendar" && daysInSelectedMonth === 29 && "Leap February (Exact 29 columns)"}
                                    {cycleType === "calendar" && daysInSelectedMonth === 31 && "31-day month (Full 31 columns)"}
                                    {cycleType === "payroll" && `Payroll Cycle (26th to 25th: ${daysInSelectedMonth} days)`}
                                </span>
                            </div>
                        </div>

                        <Card className="border border-slate-200 shadow-sm rounded-2xl bg-white overflow-hidden">
                            <CardHeader className="p-6 pb-5 border-b border-slate-100 flex flex-col xl:flex-row xl:items-start xl:justify-between gap-5">
                                <div>
                                    <div className="flex flex-wrap items-center gap-3">
                                        <CardTitle className="text-xl font-black italic uppercase text-slate-900 tracking-tighter">Monthly Attendance Grid</CardTitle>
                                        <MonthYearPicker
                                            month={selectedMonth}
                                            year={selectedYear}
                                            onChange={(m, y) => { setSelectedMonth(m); setSelectedYear(y); }}
                                        />
                                        {/* Cycle Switcher (Req 6.2) */}
                                        <div className="flex bg-slate-100 p-1 rounded-xl ml-2">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                onClick={() => setCycleType("payroll")}
                                                className={cn(
                                                    "h-8 px-3.5 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all",
                                                    cycleType === "payroll" ? "bg-white shadow-xs text-slate-900" : "text-slate-500 hover:text-slate-900"
                                                )}
                                            >
                                                Payroll Cycle (26th - 25th)
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                onClick={() => setCycleType("calendar")}
                                                className={cn(
                                                    "h-8 px-3.5 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all",
                                                    cycleType === "calendar" ? "bg-white shadow-xs text-slate-900" : "text-slate-500 hover:text-slate-900"
                                                )}
                                            >
                                                Calendar Month (1st - End)
                                            </Button>
                                        </div>
                                    </div>
                                    <CardDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2 leading-relaxed">
                                        {formatCycleRange()} • Dynamic {daysInSelectedMonth}-day grid ({cycleType === "payroll" ? "26th prev month to 25th" : "1st to month-end"}). <br />
                                        <span className="text-emerald-600 font-bold">Payable Days</span> = Present + Paid Leave + Weekly Off + Holiday + Tour
                                    </CardDescription>
                                    {/* Monthly Filters */}
                                    <div className="flex flex-wrap items-center gap-2.5 mt-3.5">
                                        <div className="flex items-center gap-2 bg-slate-50 px-3 h-9 rounded-xl border border-slate-200">
                                            <Building2 className="h-3.5 w-3.5 text-slate-400" />
                                            <select
                                                value={selectedCompanyId}
                                                onChange={(e) => setSelectedCompanyId(e.target.value)}
                                                className="bg-transparent border-none text-[10px] font-bold text-slate-700 outline-none pr-2 h-full cursor-pointer"
                                            >
                                                <option value="">All Companies</option>
                                                {companies.map((c) => (
                                                    <option key={c.id} value={c.id.toString()}>{c.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="flex items-center gap-2 bg-slate-50 px-3 h-9 rounded-xl border border-slate-200">
                                            <MapPin className="h-3.5 w-3.5 text-slate-400" />
                                            <select
                                                value={selectedOfficeId}
                                                onChange={(e) => setSelectedOfficeId(e.target.value)}
                                                className="bg-transparent border-none text-[10px] font-bold text-slate-700 outline-none pr-2 h-full cursor-pointer"
                                            >
                                                <option value="">All Offices</option>
                                                {offices.map((o) => (
                                                    <option key={o.id} value={o.id.toString()}>{o.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="flex items-center gap-2 bg-slate-50 px-3 h-9 rounded-xl border border-slate-200">
                                            <Users2 className="h-3.5 w-3.5 text-slate-400" />
                                            <select
                                                value={selectedDepartment}
                                                onChange={(e) => setSelectedDepartment(e.target.value)}
                                                className="bg-transparent border-none text-[10px] font-bold text-slate-700 outline-none pr-2 h-full cursor-pointer"
                                            >
                                                <option value="">All Departments</option>
                                                {departments.map((d) => (
                                                    <option key={d} value={d}>{d}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="relative group">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 group-focus-within:text-slate-900 transition-colors" />
                                            <Input
                                                placeholder="Search Staff..."
                                                className="h-9 w-44 pl-9 bg-slate-50 border-slate-200 rounded-xl font-bold text-xs"
                                                value={monthlySearch}
                                                onChange={(e) => handleMonthlySearchChange(e.target.value)}
                                            />
                                        </div>
                                        <Button
                                            variant="outline"
                                            className="h-9 px-3.5 rounded-xl border-slate-200 font-bold text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                            onClick={() => {
                                                setExportType("monthly");
                                                setExportDeptSelection(selectedDepartment || "All");
                                                setIsExportDialogOpen(true);
                                            }}
                                            disabled={exportingMonthly}
                                        >
                                            {exportingMonthly ? (
                                                <span className="flex items-center gap-1.5">
                                                    <svg className="animate-spin h-3.5 w-3.5 text-emerald-500" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                                    </svg>
                                                    Exporting...
                                                </span>
                                            ) : (
                                                <>
                                                    <FileSpreadsheet className="h-4 w-4 mr-1.5 text-emerald-600" /> Export CSV
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-3">
                                    {/* Clean Status Legend */}
                                    <div className="flex items-center gap-3 bg-slate-50 py-1.5 px-3 rounded-xl border border-slate-200">
                                        <div className="flex items-center gap-1.5"><div className="h-2.5 w-2.5 rounded-full bg-emerald-500"></div><span className="text-[10px] font-bold text-slate-600">Present</span></div>
                                        <div className="flex items-center gap-1.5"><div className="h-2.5 w-2.5 rounded-full bg-rose-500"></div><span className="text-[10px] font-bold text-slate-600">Absent/LWP</span></div>
                                        <div className="flex items-center gap-1.5"><div className="h-2.5 w-2.5 rounded-full bg-amber-500"></div><span className="text-[10px] font-bold text-slate-600">Leave</span></div>
                                        <div className="flex items-center gap-1.5"><div className="h-2.5 w-2.5 rounded-full bg-slate-400"></div><span className="text-[10px] font-bold text-slate-600">WOff</span></div>
                                        <div className="flex items-center gap-1.5"><div className="h-2.5 w-2.5 rounded-full bg-blue-500"></div><span className="text-[10px] font-bold text-slate-600">Holiday</span></div>
                                    </div>
                                    {/* Date Navigation & Jump Controls */}
                                    <div className="flex items-center gap-2">
                                        {isTodayInCycle && (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={scrollToToday}
                                                className="h-8 px-3 rounded-lg border-indigo-200 bg-indigo-50 hover:bg-indigo-100 font-bold text-[10px] text-indigo-700 shadow-xs cursor-pointer"
                                                title={`Jump to Today (${currentDate.getDate()} ${monthNames[currentDate.getMonth()].slice(0, 3)})`}
                                            >
                                                <Target className="h-3.5 w-3.5 mr-1.5 text-indigo-600" />
                                                Jump to Today
                                            </Button>
                                        )}
                                        <div className="flex items-center border border-slate-200 rounded-lg p-0.5 bg-slate-50">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={scrollToStart}
                                                className="h-7 w-7 p-0 rounded text-slate-600 hover:bg-white cursor-pointer"
                                                title="Jump to Start (Day 1)"
                                            >
                                                <ChevronsLeft className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => scrollTable(-240)}
                                                className="h-7 w-7 p-0 rounded text-slate-600 hover:bg-white cursor-pointer"
                                                title="Scroll Left"
                                            >
                                                <ChevronLeft className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => scrollTable(240)}
                                                className="h-7 w-7 p-0 rounded text-slate-600 hover:bg-white cursor-pointer"
                                                title="Scroll Right"
                                            >
                                                <ChevronRight className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={scrollToEnd}
                                                className="h-7 w-7 p-0 rounded text-slate-600 hover:bg-white cursor-pointer"
                                                title={`Jump to End (Day ${daysInSelectedMonth})`}
                                            >
                                                <ChevronsRight className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </CardHeader>

                            <CardContent
                                ref={tableContainerRef}
                                className="p-0 overflow-auto max-h-[calc(100vh-270px)] min-h-[460px] border-t border-slate-200 scrollbar-thin scrollbar-thumb-slate-300"
                            >
                                <Table className="w-max min-w-full">
                                    <TableHeader className="sticky top-0 z-30 bg-white shadow-sm">
                                        <tr className="bg-white border-b border-slate-100">
                                            <th className="text-left py-4 px-6 text-[9px] font-black text-slate-400 uppercase tracking-widest sticky left-0 top-0 bg-white z-40 w-56 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.05)] border-r border-slate-50">
                                                Employee Details
                                            </th>
                                            <th className="text-center py-4 px-3 text-[9px] font-black text-slate-400 uppercase tracking-widest min-w-[70px] border-r border-slate-50 bg-white sticky top-0 z-30">
                                                Company
                                            </th>
                                            <th className="text-center py-4 px-3 text-[9px] font-black text-blue-600 uppercase tracking-widest min-w-[65px] bg-blue-50/90 border-r border-slate-50 sticky top-0 z-30">
                                                Muster
                                            </th>
                                            <th className="text-center py-4 px-3 text-[9px] font-black text-emerald-600 uppercase tracking-widest min-w-[65px] bg-emerald-50/90 border-r border-slate-50 sticky top-0 z-30">
                                                Present
                                            </th>
                                            <th className="text-center py-4 px-3 text-[9px] font-black text-emerald-700 uppercase tracking-widest min-w-[70px] bg-emerald-50/90 border-r border-slate-50 sticky top-0 z-30">
                                                Payable
                                            </th>
                                            <th className="text-center py-4 px-3 text-[9px] font-black text-rose-600 uppercase tracking-widest min-w-[65px] bg-rose-50/90 border-r border-slate-50 sticky top-0 z-30">
                                                LWP
                                            </th>
                                            <th className="text-center py-4 px-2 text-[9px] font-black text-amber-700 uppercase tracking-widest min-w-[70px] bg-amber-50/90 border-r border-slate-50 sticky top-0 z-30" title="Remaining Leave Balance (CL + EL + Comp-Off)">
                                                Leave Bal
                                            </th>
                                            <th className="text-center py-4 px-2 text-[9px] font-black text-purple-700 uppercase tracking-widest min-w-[75px] bg-purple-50/90 border-r border-slate-50 sticky top-0 z-30" title="Configured Weekly Off Day (Fixed / Rotational)">
                                                Off Day
                                            </th>
                                            {/* Dynamic Day Columns with '01 Wed' format (Req 6.1, 6.3) */}
                                            {cycleDates.map((dateObj, i) => {
                                                const isToday =
                                                    dateObj.getDate() === currentDate.getDate() &&
                                                    dateObj.getMonth() === currentDate.getMonth() &&
                                                    dateObj.getFullYear() === currentDate.getFullYear();
                                                const isWeekend = dateObj.getDay() === 0;

                                                return (
                                                    <th key={i} className={cn("text-center py-3 px-1 min-w-[34px] transition-all sticky top-0 z-30 bg-white", isToday ? "bg-indigo-50 border-b-2 border-b-indigo-500" : isWeekend ? "bg-slate-50/90" : "bg-white")}>
                                                        <div className="flex flex-col items-center gap-0.5">
                                                            <span className={cn("text-[9px] font-black", isToday ? "text-indigo-700" : isWeekend ? "text-slate-400" : "text-slate-900")}>
                                                                {String(dateObj.getDate()).padStart(2, '0')}
                                                            </span>
                                                            <span className={cn("text-[6px] font-bold uppercase", isToday ? "text-indigo-500" : isWeekend ? "text-rose-400" : "text-slate-400")}>
                                                                {dayNames[dateObj.getDay()]}
                                                            </span>
                                                        </div>
                                                    </th>
                                                );
                                            })}
                                        </tr>
                                    </TableHeader>
                                    <TableBody>
                                        {monthlyLoading ? (
                                            <tr><td colSpan={daysInSelectedMonth + 8} className="py-20 text-center"><p className="text-[10px] font-bold text-slate-400 animate-pulse">Loading monthly data...</p></td></tr>
                                        ) : monthlyRows.length === 0 ? (
                                            <tr><td colSpan={daysInSelectedMonth + 8} className="py-20 text-center"><p className="text-[10px] font-bold text-slate-400">No monthly attendance records found</p></td></tr>
                                        ) : monthlyRows.map((emp, idx) => {
                                            const payable = emp.payable_days ?? ((emp.present ?? 0) + (emp.woff ?? 0) + (emp.leave ?? 0) + (emp.holiday ?? 0) + (emp.tour ?? 0));
                                            const dailyRate = Math.round((emp.salary || 0) / daysInSelectedMonth);
                                            return (
                                                <tr key={emp.employee_id || idx} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors group">
                                                    <td className="py-3 px-6 sticky left-0 bg-white group-hover:bg-slate-50/50 transition-colors z-10 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.05)] border-r border-slate-50">
                                                        <div className="flex items-center gap-3">
                                                            <div className="h-8 w-8 bg-slate-900 rounded-lg flex items-center justify-center font-black italic text-[10px] text-white shadow-md">
                                                                {emp.name.charAt(0)}
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="text-[10px] font-black text-slate-900 italic uppercase tracking-tighter truncate w-32">{emp.name}</span>
                                                                <span className="text-[7px] font-bold text-slate-400 uppercase tracking-widest">{emp.id}</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-3 text-center border-r border-slate-50 bg-white">
                                                        <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">{emp.company}</span>
                                                    </td>
                                                    {/* Muster Days (Req 6.4, 8) */}
                                                    <td className="py-3 px-3 text-center border-r border-slate-50 bg-blue-50/10">
                                                        <span className="text-[10px] font-black text-slate-700">{emp.muster_days ?? daysInSelectedMonth}</span>
                                                    </td>
                                                    {/* Present Days */}
                                                    <td className="py-3 px-3 text-center border-r border-slate-50 bg-emerald-50/10">
                                                        <span className="text-[10px] font-black text-emerald-700">{emp.present ?? 0}</span>
                                                    </td>
                                                    {/* Payable Days */}
                                                    <td className="py-3 px-3 text-center border-r border-slate-50 bg-emerald-50/20">
                                                        <div
                                                            onClick={() => openPayrollBreakdown(emp)}
                                                            className="flex flex-col items-center justify-center gap-0.5 cursor-pointer group/badge"
                                                            title={`Employee: ${emp.name}\nFixed Gross: ₹${(emp.salary || 0).toLocaleString('en-IN')}\nPer-Day Rate: ₹${dailyRate.toLocaleString('en-IN')}\n────────────────\nMuster Days: ${emp.muster_days ?? daysInSelectedMonth}\n• Present: ${emp.present ?? 0}\n• Weekly Off: ${emp.woff ?? 0}\n• Holiday: ${emp.holiday ?? 0}\n• Paid Leave: ${emp.leave ?? 0}\n• Tour (Paid): ${emp.tour ?? 0}\n• Weekly Off Worked: ${emp.weekly_off_worked_days ?? 0}\n────────────────\nPayable Days: ${payable}\nEstimated Gross Payout: ₹${(payable * dailyRate).toLocaleString('en-IN')}\n\n(Click to view full payroll calculation breakdown)`}
                                                        >
                                                            <Badge className="bg-emerald-500 text-white font-black text-[10px] h-6 px-2.5 rounded-md shadow-sm group-hover/badge:bg-emerald-600 transition-transform group-hover/badge:scale-105">{payable}</Badge>
                                                        </div>
                                                    </td>
                                                    {/* LWP / Absent Days */}
                                                    <td className="py-3 px-3 text-center border-r border-slate-50 bg-rose-50/10">
                                                        <div
                                                            onClick={() => openPayrollBreakdown(emp)}
                                                            className="cursor-pointer group/badge"
                                                            title={`Employee: ${emp.name}\nFixed Gross: ₹${(emp.salary || 0).toLocaleString('en-IN')}\nPer-Day Rate: ₹${dailyRate.toLocaleString('en-IN')}\n────────────────\nMuster Days: ${emp.muster_days ?? daysInSelectedMonth}\nPayable Days: ${payable}\nLWP / Absent: ${emp.absent ?? 0}\n────────────────\nEquation: ${emp.muster_days ?? daysInSelectedMonth} (Muster) = ${payable} (Payable) + ${emp.absent ?? 0} (LWP)\nSalary Deduction: ₹${((emp.absent || 0) * dailyRate).toLocaleString('en-IN')}\n\n(Click to view full payroll calculation breakdown)`}
                                                        >
                                                            <Badge className={cn("font-black text-[10px] h-6 px-2.5 rounded-md shadow-sm transition-transform group-hover/badge:scale-105", (emp.absent || 0) > 0 ? "bg-rose-500 text-white group-hover/badge:bg-rose-600" : "bg-slate-100 text-slate-400 group-hover/badge:bg-slate-200")}>{emp.absent ?? 0}</Badge>
                                                        </div>
                                                    </td>
                                                    {/* Remaining Leave Balance (Req 2.5 A) */}
                                                    <td className="py-3 px-2 text-center border-r border-slate-50 bg-amber-50/10">
                                                        <Badge className="bg-amber-100 text-amber-900 border border-amber-200 font-black text-[9px] h-6 px-2 rounded-md shadow-xs">
                                                            {emp.remaining_leave_balance != null ? `${emp.remaining_leave_balance}d` : "24d"}
                                                        </Badge>
                                                    </td>
                                                    {/* Configured Weekly Off Day (Req 2.5 C) */}
                                                    <td className="py-3 px-2 text-center border-r border-slate-50 bg-purple-50/10">
                                                        <div
                                                            onClick={() => {
                                                                openWeeklyOffEdit(emp);
                                                                setIsWeeklyOffModalOpen(true);
                                                            }}
                                                            className="cursor-pointer group/off"
                                                            title={`Click to configure weekly off schedule for ${emp.name}`}
                                                        >
                                                            <Badge className={cn("text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md transition-transform group-hover/off:scale-105", emp.rotational_weekly_off ? "bg-purple-100 text-purple-900 border border-purple-200" : "bg-slate-100 text-slate-700")}>
                                                                {Array.isArray(emp.weekly_off_days) ? emp.weekly_off_days.map((d: string) => d.slice(0, 3)).join(",") : "Sun"}
                                                                {emp.rotational_weekly_off ? " (Rot)" : ""}
                                                            </Badge>
                                                        </div>
                                                    </td>
                                                    {/* Day cells (Req 2.5 B, D, E) */}
                                                    {cycleDates.map((dateObj, dayIdx) => {
                                                        const detail = emp.grid_details ? emp.grid_details[dayIdx] : null;
                                                        const status = detail ? detail.display_code : ((emp.grid && emp.grid[dayIdx]) ? emp.grid[dayIdx] : '-');
                                                        const isToday =
                                                            dateObj.getDate() === currentDate.getDate() &&
                                                            dateObj.getMonth() === currentDate.getMonth() &&
                                                            dateObj.getFullYear() === currentDate.getFullYear();

                                                        const isHalfDay = status === 'HD';
                                                        const isWoWorked = status === 'WO' || detail?.is_weekly_off_worked;
                                                        const earnedForDay = (status === 'A' || status === '-') ? 0 : (isHalfDay ? Math.round(dailyRate * 0.5) : dailyRate);
                                                        const statusLabel =
                                                            status === 'P' ? 'Present' :
                                                            status === 'HD' ? 'Half Day' :
                                                            status === 'WO' ? `Weekly Off Worked (${detail?.compensation === 'comp_off' ? 'Comp-Off Credit' : '+1 Payable Day Compensated'})` :
                                                            status === 'A' ? 'Absent / Loss of Pay (LWP)' :
                                                            status === 'W' ? 'Weekly Off' :
                                                            status === 'H' ? 'Public Holiday' :
                                                            status === 'T' ? 'Tour / Field Duty' :
                                                            status === 'L' ? 'Paid Leave' : 'No Record';

                                                        const tooltipLines = `${dateObj.toLocaleDateString('en-GB')}: ${statusLabel} (₹${earnedForDay.toLocaleString('en-IN')})\nClick to adjust attendance`;

                                                        const isWeekend = dateObj.getDay() === 0;

                                                        return (
                                                            <td key={dayIdx} className={cn("py-2.5 px-1 text-center border-r border-slate-50 transition-colors", isToday ? "bg-indigo-50/40" : isWeekend ? "bg-slate-50/60" : "")}>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => openCellAdjust(emp, dayIdx, dateObj)}
                                                                    title={tooltipLines}
                                                                    className={cn(
                                                                        "h-6 w-6 mx-auto rounded-md flex items-center justify-center text-[9px] font-black transition-all cursor-pointer border",
                                                                        status === 'P' ? "bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100" :
                                                                        status === 'HD' ? "bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100" :
                                                                        status === 'WO' ? "bg-purple-50 text-purple-900 border-purple-300 hover:bg-purple-100" :
                                                                        status === 'A' ? "bg-rose-500 text-white border-rose-600 hover:bg-rose-600" :
                                                                        status === 'W' ? "bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200" :
                                                                        status === 'H' ? "bg-blue-500 text-white border-blue-600 hover:bg-blue-600" :
                                                                        status === 'T' ? "bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100" :
                                                                        status === 'L' ? "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100" :
                                                                        "bg-white text-slate-300 border-dashed border-slate-200 hover:border-slate-400"
                                                                    )}
                                                                >
                                                                    {status}
                                                                </button>
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </CardContent>


                        </Card>
                    </div>
                )}
            </div>

            {/* Attendance & Payroll Calculation Breakdown Dialog (Req 8) */}
            <Dialog open={isPayrollBreakdownOpen} onOpenChange={setIsPayrollBreakdownOpen}>
                <DialogContent className="sm:max-w-[560px] max-h-[90vh] flex flex-col rounded-2xl p-0 overflow-hidden bg-white border border-slate-200 shadow-xl">
                    {selectedPayrollBreakdown && (() => {
                        const emp = selectedPayrollBreakdown;
                        const musterDays = emp.muster_days ?? daysInSelectedMonth;
                        const present = emp.present ?? 0;
                        const woff = emp.woff ?? 0;
                        const holiday = emp.holiday ?? 0;
                        const leave = emp.leave ?? 0;
                        const tour = emp.tour ?? 0;
                        const payableDays = present + woff + holiday + leave + tour;
                        const lwpDays = emp.absent ?? 0;
                        const fixedGross = emp.salary || 0;
                        const dailyRate = Math.round(fixedGross / (musterDays || 1));
                        const grossEarned = payableDays * dailyRate;
                        const lwpDeduction = lwpDays * dailyRate;
                        const isBalanced = (payableDays + lwpDays) === musterDays;

                        return (
                            <div className="flex flex-col h-full overflow-hidden">
                                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center font-bold text-sm text-slate-800 shrink-0">
                                            {emp.name.charAt(0)}
                                        </div>
                                        <div>
                                            <DialogTitle className="text-base font-bold text-slate-900 tracking-tight">
                                                {emp.name}
                                            </DialogTitle>
                                            <DialogDescription className="text-xs text-slate-500 font-normal mt-0.5">
                                                {emp.id} • {emp.role} • {emp.company || "Company Entity"}
                                            </DialogDescription>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[10px] text-slate-400 font-medium uppercase block">Monthly CTC</span>
                                        <span className="text-sm font-bold text-slate-900">₹{fixedGross.toLocaleString('en-IN')}</span>
                                    </div>
                                </div>

                                <div className="p-6 space-y-4 overflow-y-auto flex-1">
                                    {/* 3 Main Stat Cards */}
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                                            <span className="text-[10px] font-semibold uppercase text-slate-500 block">Muster Days</span>
                                            <span className="text-xl font-bold text-slate-900 block mt-1">{musterDays}</span>
                                            <span className="text-[10px] text-slate-400">Total in cycle</span>
                                        </div>
                                        <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 text-center">
                                            <span className="text-[10px] font-semibold uppercase text-emerald-700 block">Payable Days</span>
                                            <span className="text-xl font-bold text-emerald-900 block mt-1">{payableDays}</span>
                                            <span className="text-[10px] text-emerald-600 font-medium">Salary eligible</span>
                                        </div>
                                        <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-3 text-center">
                                            <span className="text-[10px] font-semibold uppercase text-rose-700 block">LWP Days</span>
                                            <span className="text-xl font-bold text-rose-900 block mt-1">{lwpDays}</span>
                                            <span className="text-[10px] text-rose-600 font-medium">Unpaid absence</span>
                                        </div>
                                    </div>

                                    {/* Payroll Balance Equation */}
                                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="font-semibold text-slate-700">Cycle Reconciliation:</span>
                                            <Badge variant="outline" className={cn("text-[10px] font-semibold px-2 py-0.5", isBalanced ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-800 border-amber-200")}>
                                                {isBalanced ? "✓ Balanced (Payable + LWP = Muster)" : "⚠️ Cycle Incomplete"}
                                            </Badge>
                                        </div>
                                        <div className="flex items-center justify-between text-xs font-mono font-semibold bg-white p-2.5 rounded-lg border border-slate-200 text-slate-800">
                                            <span>Muster: {musterDays}d</span>
                                            <span className="text-slate-400">=</span>
                                            <span className="text-emerald-700">Payable: {payableDays}d</span>
                                            <span className="text-slate-400">+</span>
                                            <span className="text-rose-700">LWP: {lwpDays}d</span>
                                        </div>
                                        <p className="text-[11px] text-slate-500">
                                            Per-Day Rate: <strong className="text-slate-700">₹{fixedGross.toLocaleString('en-IN')} ÷ {musterDays} = ₹{dailyRate.toLocaleString('en-IN')}/day</strong>
                                        </p>
                                    </div>

                                    {/* Component Breakdown */}
                                    <div className="space-y-2">
                                        <span className="text-xs font-semibold text-slate-700 block">Attendance Breakdown</span>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                                            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex justify-between items-center">
                                                <span className="text-slate-500">Present:</span>
                                                <span className="font-bold text-slate-800">{present} days</span>
                                            </div>
                                            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex justify-between items-center">
                                                <span className="text-slate-500">Weekly Offs:</span>
                                                <span className="font-bold text-slate-800">{woff} days</span>
                                            </div>
                                            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex justify-between items-center">
                                                <span className="text-slate-500">Holidays:</span>
                                                <span className="font-bold text-slate-800">{holiday} days</span>
                                            </div>
                                            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex justify-between items-center">
                                                <span className="text-slate-500">Paid Leaves:</span>
                                                <span className="font-bold text-slate-800">{leave} days</span>
                                            </div>
                                            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex justify-between items-center">
                                                <span className="text-slate-500">Tours:</span>
                                                <span className="font-bold text-slate-800">{tour} days</span>
                                            </div>
                                            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 flex justify-between items-center">
                                                <span className="text-rose-700">LWP:</span>
                                                <span className="font-bold text-rose-900">{lwpDays} days</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Financial Treatment Preview */}
                                    <div className="p-3.5 rounded-xl bg-slate-900 text-white flex items-center justify-between">
                                        <div>
                                            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Gross Earned</span>
                                            <span className="text-base font-bold text-white">₹{grossEarned.toLocaleString('en-IN')}</span>
                                            <span className="text-[10px] text-slate-400 font-normal">{payableDays}d × ₹{dailyRate}/d</span>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-[10px] text-rose-400 uppercase font-semibold block">LWP Deducted</span>
                                            <span className="text-base font-bold text-rose-400">-₹{lwpDeduction.toLocaleString('en-IN')}</span>
                                            <span className="text-[10px] text-slate-400 font-normal">{lwpDays}d × ₹{dailyRate}/d</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 px-6 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5 shrink-0">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setIsPayrollBreakdownOpen(false)}
                                        className="h-9 px-4 rounded-lg border-slate-200 text-xs font-medium text-slate-700"
                                    >
                                        Close
                                    </Button>
                                    <Button
                                        type="button"
                                        onClick={() => {
                                            setIsPayrollBreakdownOpen(false);
                                            window.location.href = `/payroll`;
                                        }}
                                        className="h-9 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs"
                                    >
                                        Open in Payroll Ledger <ArrowUpRight className="h-3.5 w-3.5 ml-1.5" />
                                    </Button>
                                </div>
                            </div>
                        );
                    })()}
                </DialogContent>
            </Dialog>

            {/* Authorized Attendance & Outdoor Duty Dialog (Req 5.1 & 5.2) */}
            <Dialog open={isManualEntryOpen} onOpenChange={setIsManualEntryOpen}>
                <DialogContent className="sm:max-w-[560px] max-h-[90vh] flex flex-col rounded-2xl p-0 overflow-hidden bg-white border border-slate-200 shadow-xl">
                    {/* Clean Pinned Header */}
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-800 shrink-0">
                                <UserCheck className="h-5 w-5" />
                            </div>
                            <div>
                                <DialogTitle className="text-base font-bold text-slate-900 tracking-tight">Authorized Attendance Marking</DialogTitle>
                                <DialogDescription className="text-xs text-slate-500 font-normal mt-0.5">
                                    Mark on employee's behalf, record outdoor duty, or override punches
                                </DialogDescription>
                            </div>
                        </div>
                        <Badge variant="outline" className="text-[11px] font-semibold text-slate-600 bg-slate-50 border-slate-200 px-2.5 py-1">
                            Req 5.1 & 5.2
                        </Badge>
                    </div>

                    {/* Scrollable Form Body */}
                    <div className="p-6 space-y-4 overflow-y-auto flex-1">
                        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 leading-relaxed">
                            <p className="font-semibold text-slate-900 mb-0.5">Administrative Access Control:</p>
                            Logged under your authorized credentials with audit history. For outdoor duties or field operations, geofence checks are automatically bypassed.
                        </div>

                        {/* Employee Selector */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs font-semibold text-slate-700">Select Employee *</Label>
                                <button
                                    type="button"
                                    onClick={() => setManualInputMode(m => m === "dropdown" ? "custom" : "dropdown")}
                                    className="text-xs font-medium text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
                                >
                                    {manualInputMode === "dropdown" ? "Type ID manually" : "Select from roster"}
                                </button>
                            </div>
                            {manualInputMode === "dropdown" && allEmployees.length > 0 ? (
                                <select
                                    value={manualEmpId}
                                    onChange={(e) => setManualEmpId(e.target.value)}
                                    className="h-10 w-full px-3 rounded-lg bg-white border border-slate-200 text-xs font-medium text-slate-800 outline-none focus:border-slate-900 cursor-pointer"
                                >
                                    <option value="">-- Choose Employee (Name / Code) --</option>
                                    {allEmployees.map((emp: any) => (
                                        <option key={emp.id} value={emp.emp_code || emp.id}>
                                            {emp.emp_code} — {emp.name} ({emp.department || "Operations"})
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <Input
                                    placeholder="Enter Emp Code (e.g. APA001) or Numeric ID"
                                    value={manualEmpId}
                                    onChange={(e) => setManualEmpId(e.target.value)}
                                    className="h-10 rounded-lg bg-white border border-slate-200 text-xs uppercase"
                                />
                            )}
                            {/* Selected Employee Preview */}
                            {(function () {
                                const selected = allEmployees.find(e => 
                                    String(e.id) === String(manualEmpId) || 
                                    (e.emp_code && e.emp_code.toUpperCase() === String(manualEmpId).toUpperCase())
                                );
                                if (!selected) return null;
                                return (
                                    <div className="mt-1.5 p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-2">
                                            <div className="h-6 w-6 rounded-md bg-slate-900 text-white flex items-center justify-center font-bold text-[10px]">
                                                {selected.name?.charAt(0).toUpperCase()}
                                            </div>
                                            <span className="font-semibold text-slate-800">{selected.name}</span>
                                            <span className="font-mono text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200 text-[11px]">{selected.emp_code}</span>
                                        </div>
                                        <span className="text-slate-500">{selected.department || "Operations"}</span>
                                    </div>
                                );
                            })()}
                        </div>

                        {/* Date & Status */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-slate-700">Date *</Label>
                                <Input
                                    type="date"
                                    value={manualDate}
                                    onChange={(e) => setManualDate(e.target.value)}
                                    className="h-10 rounded-lg bg-white border border-slate-200 text-xs font-medium"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-slate-700">Status *</Label>
                                <select
                                    value={manualStatus}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setManualStatus(val);
                                        if (val === "Present - Outdoor") {
                                            setManualIsOutdoor(true);
                                            if (!manualCheckInTime) setManualCheckInTime("10:00");
                                            if (!manualCheckOutTime) setManualCheckOutTime("19:00");
                                        } else if (val === "Absent") {
                                            setManualCheckInTime("");
                                            setManualCheckOutTime("");
                                            setManualIsOutdoor(false);
                                        } else if (val === "Half Day") {
                                            setManualCheckInTime("10:00");
                                            setManualCheckOutTime("14:30");
                                        } else if (val === "Late") {
                                            setManualCheckInTime("10:45");
                                            setManualCheckOutTime("19:00");
                                        } else {
                                            if (!manualCheckInTime) setManualCheckInTime("10:00");
                                            if (!manualCheckOutTime) setManualCheckOutTime("19:00");
                                        }
                                    }}
                                    className="h-10 w-full px-3 rounded-lg bg-white border border-slate-200 text-xs font-medium outline-none focus:border-slate-900 cursor-pointer"
                                >
                                    <option value="Present">Present (Standard In-Office)</option>
                                    <option value="Present - Outdoor">Present (Outdoor / Field Duty)</option>
                                    <option value="Late">Late Arrival</option>
                                    <option value="Half Day">Half Day (0.5)</option>
                                    <option value="Absent">Absent (LWP)</option>
                                    <option value="Weekly Off Worked">Weekly Off Worked (Compensated)</option>
                                </select>
                            </div>
                        </div>

                        {/* Weekly Off Compensation Selector (Req 2.5 D) */}
                        {manualStatus === "Weekly Off Worked" && (
                            <div className="space-y-1.5 p-3 rounded-xl bg-purple-50 border border-purple-200 text-xs">
                                <Label className="font-semibold text-purple-900 block">
                                    Weekly Off Compensation Method (Req 2.5 D)
                                </Label>
                                <select
                                    value={manualWoComp}
                                    onChange={(e: any) => setManualWoComp(e.target.value)}
                                    className="h-9 w-full px-3 rounded-lg bg-white border border-purple-200 text-xs font-medium outline-none cursor-pointer"
                                >
                                    <option value="additional_payable_day">Additional Payable Day (+1 Day Payout in Salary)</option>
                                    <option value="comp_off">Compensatory Off (+1 Day Credited to Leave Balance)</option>
                                </select>
                            </div>
                        )}

                        {/* Check-In and Check-Out Time */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-slate-700">Check-In Time</Label>
                                <Input
                                    type="time"
                                    value={manualCheckInTime}
                                    onChange={(e) => setManualCheckInTime(e.target.value)}
                                    className="h-10 rounded-lg bg-white border border-slate-200 text-xs font-mono"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-slate-700">Check-Out Time</Label>
                                <Input
                                    type="time"
                                    value={manualCheckOutTime}
                                    onChange={(e) => setManualCheckOutTime(e.target.value)}
                                    className="h-10 rounded-lg bg-white border border-slate-200 text-xs font-mono"
                                />
                            </div>
                        </div>

                        {/* Outdoor / Field Duty Geofence Bypass Option (Req 5.1) */}
                        <div
                            className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-all cursor-pointer"
                            onClick={() => setManualIsOutdoor(!manualIsOutdoor)}
                        >
                            <input
                                type="checkbox"
                                id="manualIsOutdoor"
                                checked={manualIsOutdoor}
                                onChange={(e) => setManualIsOutdoor(e.target.checked)}
                                className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                            />
                            <div className="flex flex-col cursor-pointer">
                                <label htmlFor="manualIsOutdoor" className="text-xs font-semibold text-slate-900 cursor-pointer flex items-center gap-1.5">
                                    <Compass className="h-4 w-4 text-emerald-600" /> Outdoor / Field Duty Punch
                                </label>
                                <span className="text-[11px] text-slate-500">Bypasses office geofence verification (for client visits, audits, site work)</span>
                            </div>
                        </div>

                        {/* Authorized Reason / Audit Rationale */}
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-slate-700">Authorized Reason / Audit Rationale</Label>
                            <textarea
                                placeholder="State reason for marking on behalf (e.g. Client site meeting at Delhi Branch, field duty authorization)..."
                                value={manualReason}
                                onChange={(e) => setManualReason(e.target.value)}
                                rows={2}
                                className="w-full p-2.5 rounded-lg bg-white border border-slate-200 text-xs outline-none focus:border-slate-900 resize-none"
                            />
                        </div>
                    </div>

                    {/* Pinned Footer */}
                    <div className="p-4 px-6 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
                        <span className="text-xs text-slate-500 flex items-center gap-1.5">
                            <ShieldCheck className="h-4 w-4 text-emerald-600" /> Recorded in Audit Log
                        </span>
                        <div className="flex gap-2.5">
                            <Button
                                variant="outline"
                                onClick={() => setIsManualEntryOpen(false)}
                                className="h-9 px-4 rounded-lg border-slate-200 text-xs font-medium text-slate-700"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleManualSubmit}
                                disabled={manualSubmitting}
                                className="h-9 px-5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs disabled:opacity-50"
                            >
                                {manualSubmitting ? "Submitting..." : "Authorize Entry"}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Quick Attendance Adjustment Dialog (Req 2.5 B & D) */}
            <Dialog open={isCellAdjustOpen} onOpenChange={setIsCellAdjustOpen}>
                <DialogContent className="sm:max-w-[480px] rounded-2xl p-0 overflow-hidden bg-white border border-slate-200 shadow-xl">
                    {selectedCellAdjust && (
                        <div>
                            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
                                <div>
                                    <DialogTitle className="text-base font-bold text-slate-900 tracking-tight">
                                        Adjust Attendance
                                    </DialogTitle>
                                    <DialogDescription className="text-xs text-slate-500 font-normal mt-0.5">
                                        {selectedCellAdjust.emp.name} ({selectedCellAdjust.emp.id}) • {selectedCellAdjust.dateObj.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' })}
                                    </DialogDescription>
                                </div>
                                <Badge variant="outline" className="text-xs font-medium text-slate-600 bg-slate-50 border-slate-200">
                                    Current: {selectedCellAdjust.currentStatus}
                                </Badge>
                            </div>

                            <div className="p-6 space-y-4">
                                {/* Status Selection Buttons (Req 2.5 B) */}
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold text-slate-700">Select Status</Label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setCellAdjustStatus("Present")}
                                            className={cn(
                                                "h-10 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all border",
                                                cellAdjustStatus === "Present"
                                                    ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                                                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                                            )}
                                        >
                                            <CheckCircle2 className="h-3.5 w-3.5" /> Present
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setCellAdjustStatus("Absent")}
                                            className={cn(
                                                "h-10 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all border",
                                                cellAdjustStatus === "Absent"
                                                    ? "bg-rose-600 text-white border-rose-600 shadow-xs"
                                                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                                            )}
                                        >
                                            <XCircle className="h-3.5 w-3.5" /> Absent (LWP)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setCellAdjustStatus("Half Day")}
                                            className={cn(
                                                "h-10 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all border",
                                                cellAdjustStatus === "Half Day"
                                                    ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                                                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                                            )}
                                        >
                                            <Clock className="h-3.5 w-3.5" /> Half Day (0.5)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setCellAdjustStatus("Weekly Off Worked")}
                                            className={cn(
                                                "h-10 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all border",
                                                cellAdjustStatus === "Weekly Off Worked"
                                                    ? "bg-purple-600 text-white border-purple-600 shadow-xs"
                                                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                                            )}
                                        >
                                            <Activity className="h-3.5 w-3.5" /> Weekly Off Worked
                                        </button>
                                    </div>
                                </div>

                                {/* Weekly Off Compensation Options (Req 2.5 D) */}
                                {cellAdjustStatus === "Weekly Off Worked" && (
                                    <div className="p-3.5 rounded-xl bg-purple-50 border border-purple-200 space-y-2 text-xs">
                                        <Label className="font-semibold text-purple-900 block">
                                            Compensation Treatment (Req 2.5 D)
                                        </Label>
                                        <div className="space-y-1.5">
                                            <label className={cn("p-2.5 rounded-lg border flex items-center gap-2.5 cursor-pointer text-xs font-medium transition-all", cellAdjustWoComp === "additional_payable_day" ? "bg-white border-purple-500 text-purple-950 shadow-xs" : "bg-purple-50/50 border-purple-100 text-purple-800")}>
                                                <input
                                                    type="radio"
                                                    name="woComp"
                                                    checked={cellAdjustWoComp === "additional_payable_day"}
                                                    onChange={() => setCellAdjustWoComp("additional_payable_day")}
                                                    className="text-purple-600"
                                                />
                                                <div>
                                                    <span className="block font-semibold">Additional Payable Day (+1)</span>
                                                    <span className="block text-[11px] text-purple-600">Adds 1 full day payout to monthly salary</span>
                                                </div>
                                            </label>
                                            <label className={cn("p-2.5 rounded-lg border flex items-center gap-2.5 cursor-pointer text-xs font-medium transition-all", cellAdjustWoComp === "comp_off" ? "bg-white border-purple-500 text-purple-950 shadow-xs" : "bg-purple-50/50 border-purple-100 text-purple-800")}>
                                                <input
                                                    type="radio"
                                                    name="woComp"
                                                    checked={cellAdjustWoComp === "comp_off"}
                                                    onChange={() => setCellAdjustWoComp("comp_off")}
                                                    className="text-purple-600"
                                                />
                                                <div>
                                                    <span className="block font-semibold">Compensatory Off (+1)</span>
                                                    <span className="block text-[11px] text-purple-600">Credited directly to employee's leave ledger</span>
                                                </div>
                                            </label>
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold text-slate-700">Audit Reason / Justification</Label>
                                    <Input
                                        placeholder="Reason for adjustment (e.g. Biometric failed, HR authorized)..."
                                        value={cellAdjustReason}
                                        onChange={(e) => setCellAdjustReason(e.target.value)}
                                        className="h-10 rounded-lg bg-white border border-slate-200 text-xs"
                                    />
                                </div>
                            </div>

                            <div className="p-4 px-6 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5 shrink-0">
                                <Button
                                    variant="outline"
                                    onClick={() => setIsCellAdjustOpen(false)}
                                    className="h-9 px-4 rounded-lg border-slate-200 text-xs font-medium text-slate-700"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleCellAdjustSubmit}
                                    disabled={cellAdjustSubmitting}
                                    className="h-9 px-5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs disabled:opacity-50"
                                >
                                    {cellAdjustSubmitting ? "Saving..." : "Apply Adjustment"}
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Rotational & Fixed Weekly-Off Schedule Configuration Dialog (Req 2.5 C) */}
            <Dialog open={isWeeklyOffModalOpen} onOpenChange={setIsWeeklyOffModalOpen}>
                <DialogContent className="sm:max-w-[650px] rounded-2xl p-0 overflow-hidden bg-white border border-slate-200 shadow-xl max-h-[90vh] flex flex-col">
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-700 shrink-0">
                                <Sliders className="h-5 w-5" />
                            </div>
                            <div>
                                <DialogTitle className="text-base font-bold text-slate-900 tracking-tight">
                                    Weekly-Off Schedule Control
                                </DialogTitle>
                                <DialogDescription className="text-xs text-slate-500 font-normal mt-0.5">
                                    Configure fixed or rotational off days per employee (Req 2.5 C)
                                </DialogDescription>
                            </div>
                        </div>
                        <Badge variant="outline" className="text-[11px] font-semibold text-purple-700 bg-purple-50 border-purple-200 px-2.5 py-1">
                            Req 2.5 C
                        </Badge>
                    </div>

                    <div className="p-6 space-y-4 overflow-y-auto flex-1">
                        {editingEmpWeeklyOff ? (
                            /* Edit screen for selected employee */
                            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <span className="text-xs font-bold text-slate-900">{editingEmpWeeklyOff.name}</span>
                                        <span className="text-[11px] text-slate-500 block">{editingEmpWeeklyOff.id} • {editingEmpWeeklyOff.role}</span>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setEditingEmpWeeklyOff(null)}
                                        className="text-xs font-medium text-slate-600 hover:text-slate-900"
                                    >
                                        Back to Staff List
                                    </Button>
                                </div>

                                {/* Rotational Toggle */}
                                <div className="p-3.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between">
                                    <div>
                                        <span className="text-xs font-semibold text-slate-900 block">Rotational Weekly Off Schedule</span>
                                        <span className="text-[11px] text-slate-500">Enable for employees whose weekly offs rotate</span>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={editRotationalOff}
                                        onChange={(e) => setEditRotationalOff(e.target.checked)}
                                        className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                                    />
                                </div>

                                {/* Off Days Selector */}
                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold text-slate-700">Designated Weekly Off Days</Label>
                                    <div className="grid grid-cols-7 gap-1.5">
                                        {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day) => {
                                            const isSelected = editOffDays.includes(day);
                                            return (
                                                <button
                                                    key={day}
                                                    type="button"
                                                    onClick={() => toggleEditOffDay(day)}
                                                    className={cn(
                                                        "h-10 rounded-lg text-xs font-semibold transition-all border flex flex-col items-center justify-center",
                                                        isSelected
                                                            ? "bg-purple-600 text-white border-purple-600 shadow-xs"
                                                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                                                    )}
                                                >
                                                    <span>{day.slice(0, 3)}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <p className="text-[11px] text-slate-500 mt-1">
                                        Current Off Days: <strong className="text-purple-700">{editOffDays.join(", ")}</strong>. Attendance recalculates automatically.
                                    </p>
                                </div>

                                <div className="flex justify-end gap-2 pt-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setEditingEmpWeeklyOff(null)}
                                        className="h-9 px-4 rounded-lg border-slate-200 text-xs font-medium text-slate-700"
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        type="button"
                                        onClick={handleSaveWeeklyOffSchedule}
                                        disabled={weeklyOffSaving}
                                        className="h-9 px-5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs"
                                    >
                                        {weeklyOffSaving ? "Saving..." : "Save Schedule"}
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            /* List of employees */
                            <div className="space-y-3">
                                <div className="relative">
                                    <Search className="h-4 w-4 absolute left-3 top-3 text-slate-400" />
                                    <Input
                                        placeholder="Search employee by name or ID..."
                                        value={weeklyOffEmpSearch}
                                        onChange={(e) => setWeeklyOffEmpSearch(e.target.value)}
                                        className="h-10 pl-9 rounded-lg bg-slate-50 border-slate-200 text-xs"
                                    />
                                </div>

                                <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-[360px] overflow-y-auto">
                                    {monthlyRows
                                        .filter(emp => !weeklyOffEmpSearch || emp.name.toLowerCase().includes(weeklyOffEmpSearch.toLowerCase()) || (emp.id && emp.id.toLowerCase().includes(weeklyOffEmpSearch.toLowerCase())))
                                        .map((emp) => {
                                            const currentOffs = Array.isArray(emp.weekly_off_days) ? emp.weekly_off_days.join(", ") : "Sunday";
                                            return (
                                                <div key={emp.employee_id || emp.id} className="p-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                                                    <div className="flex items-center gap-2.5">
                                                        <div className="h-8 w-8 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center font-bold text-xs">
                                                            {emp.name.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <span className="text-xs font-semibold text-slate-900 block leading-tight">{emp.name}</span>
                                                            <span className="text-[11px] text-slate-500">{emp.id} • {emp.department}</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <div className="text-right">
                                                            <span className="text-[10px] text-slate-400 font-medium block">Weekly Off</span>
                                                            <Badge variant="outline" className={cn("text-[10px] font-medium px-2 py-0.5", emp.rotational_weekly_off ? "bg-purple-50 text-purple-700 border-purple-200" : "bg-slate-50 text-slate-700 border-slate-200")}>
                                                                {currentOffs} {emp.rotational_weekly_off ? "(Rotational)" : "(Fixed)"}
                                                            </Badge>
                                                        </div>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => openWeeklyOffEdit(emp)}
                                                            className="h-8 px-3 rounded-lg border-slate-200 hover:bg-slate-100 text-slate-800 text-xs font-medium"
                                                        >
                                                            Configure
                                                        </Button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="p-4 px-6 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                        <span>Configured schedule applies immediately to attendance & payroll</span>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsWeeklyOffModalOpen(false)}
                            className="h-9 px-4 rounded-lg border-slate-200 text-xs font-medium text-slate-700"
                        >
                            Close
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Late Attendance Policy & Threshold Dialog (Req 5.3) */}
            <Dialog open={isLateThresholdOpen} onOpenChange={setIsLateThresholdOpen}>
                <DialogContent className="sm:max-w-[480px] max-h-[90vh] flex flex-col rounded-2xl p-0 overflow-hidden bg-white border border-slate-200 shadow-xl">
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                                <Clock className="h-5 w-5" />
                            </div>
                            <div>
                                <DialogTitle className="text-base font-bold text-slate-900 tracking-tight">Late Attendance Grace Rule</DialogTitle>
                                <DialogDescription className="text-xs text-slate-500 font-normal mt-0.5">
                                    Configurable grace period threshold before flagging as Late (Req 5.3)
                                </DialogDescription>
                            </div>
                        </div>
                        <Badge variant="outline" className="text-[11px] font-semibold text-amber-700 bg-amber-50 border-amber-200 px-2.5 py-1">
                            Req 5.3 Standard
                        </Badge>
                    </div>

                    <div className="p-6 space-y-4 overflow-y-auto flex-1">
                        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 leading-relaxed">
                            <p className="font-semibold text-slate-900 mb-0.5">Threshold Calculation Policy:</p>
                            Employees punching in up to <strong>{tempLateThreshold} minutes</strong> ({Math.round((tempLateThreshold / 60) * 10) / 10} hrs) after shift start are within grace. Any punch beyond this threshold is automatically categorized as <strong>Late</strong>.
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-semibold text-slate-700">Select Standard Grace Buffer</Label>
                            <div className="grid grid-cols-3 gap-2">
                                {[15, 30, 45, 60, 90, 120].map((mins) => (
                                    <button
                                        key={mins}
                                        type="button"
                                        onClick={() => setTempLateThreshold(mins)}
                                        className={cn(
                                            "h-10 rounded-lg text-xs font-semibold transition-all border cursor-pointer",
                                            tempLateThreshold === mins
                                                ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                                                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                                        )}
                                    >
                                        {mins} mins {mins === 60 ? "(1 hr)" : mins === 120 ? "(2 hrs)" : ""}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-slate-700">Custom Threshold (Minutes)</Label>
                            <Input
                                type="number"
                                min={0}
                                max={360}
                                value={tempLateThreshold}
                                onChange={(e) => setTempLateThreshold(Math.max(0, parseInt(e.target.value) || 0))}
                                className="h-10 rounded-lg bg-white border border-slate-200 text-xs font-medium"
                            />
                            <p className="text-[11px] text-slate-400">Company default standard: 60 minutes (1 hour) grace window</p>
                        </div>
                    </div>

                    <div className="p-4 px-6 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
                        <span className="text-xs text-slate-500">
                            Current active: <strong className="text-slate-800">{lateThresholdMinutes} mins</strong>
                        </span>
                        <div className="flex gap-2.5">
                            <Button
                                variant="outline"
                                onClick={() => setIsLateThresholdOpen(false)}
                                className="h-9 px-4 rounded-lg border-slate-200 text-xs font-medium text-slate-700"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={() => handleUpdateLateThreshold(tempLateThreshold)}
                                disabled={lateThresholdSaving}
                                className="h-9 px-5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs disabled:opacity-50"
                            >
                                {lateThresholdSaving ? "Saving..." : "Save Late Rule"}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Mark Tour Dialog */}
            <Dialog open={isTourOpen} onOpenChange={setIsTourOpen}>
                <DialogContent className="sm:max-w-[540px] max-h-[90vh] flex flex-col rounded-2xl p-0 overflow-hidden bg-white border border-slate-200 shadow-xl">
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                                <Plane className="h-5 w-5" />
                            </div>
                            <div>
                                <DialogTitle className="text-base font-bold text-slate-900 tracking-tight">Mark Official Tour</DialogTitle>
                                <DialogDescription className="text-xs text-slate-500 font-normal mt-0.5">
                                    Auto-mark attendance as Tour for specified date range (Req 5.1 & 5.2)
                                </DialogDescription>
                            </div>
                        </div>
                        <Badge variant="outline" className="text-[11px] font-semibold text-slate-600 bg-slate-50 border-slate-200 px-2.5 py-1">
                            100% Payable
                        </Badge>
                    </div>

                    <div className="p-6 space-y-4 overflow-y-auto flex-1">
                        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 leading-relaxed">
                            <p className="font-semibold text-slate-900 mb-0.5">Official Tour Policy (Req 5.1 & 5.2):</p>
                            Attendance in this date range is recorded as Tour, bypassing office geofence checks and counted as 100% Payable Working Days in payroll.
                        </div>

                        {/* Employee Selector */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs font-semibold text-slate-700">Select Employee *</Label>
                                <button
                                    type="button"
                                    onClick={() => setTourInputMode(m => m === "dropdown" ? "custom" : "dropdown")}
                                    className="text-xs font-medium text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
                                >
                                    {tourInputMode === "dropdown" ? "Type ID manually" : "Select from roster"}
                                </button>
                            </div>
                            {tourInputMode === "dropdown" && allEmployees.length > 0 ? (
                                <select
                                    value={tourEmpId}
                                    onChange={(e) => setTourEmpId(e.target.value)}
                                    className="h-10 w-full px-3 rounded-lg bg-white border border-slate-200 text-xs font-medium text-slate-800 outline-none focus:border-slate-900 cursor-pointer"
                                >
                                    <option value="">-- Choose Employee (Name / Code) --</option>
                                    {allEmployees.map((emp: any) => (
                                        <option key={emp.id} value={emp.emp_code || emp.id}>
                                            {emp.emp_code} — {emp.name} ({emp.department || "Operations"})
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <Input
                                    placeholder="Enter Emp Code (e.g. APA001) or Numeric ID"
                                    value={tourEmpId}
                                    onChange={(e) => setTourEmpId(e.target.value)}
                                    className="h-10 rounded-lg bg-white border border-slate-200 text-xs uppercase"
                                />
                            )}
                            {/* Selected Employee Preview */}
                            {(function () {
                                const selected = allEmployees.find(e => 
                                    String(e.id) === String(tourEmpId) || 
                                    (e.emp_code && e.emp_code.toUpperCase() === String(tourEmpId).toUpperCase())
                                );
                                if (!selected) return null;
                                return (
                                    <div className="mt-1.5 p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-2">
                                            <div className="h-6 w-6 rounded-md bg-slate-900 text-white flex items-center justify-center font-bold text-[10px]">
                                                {selected.name?.charAt(0).toUpperCase()}
                                            </div>
                                            <span className="font-semibold text-slate-800">{selected.name}</span>
                                            <span className="font-mono text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200 text-[11px]">{selected.emp_code}</span>
                                        </div>
                                        <span className="text-slate-500">{selected.department || "Operations"}</span>
                                    </div>
                                );
                            })()}
                        </div>

                        {/* Tour Title */}
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-slate-700">Tour Title *</Label>
                            <Input
                                placeholder="e.g. Client Site Audit / Depot Inspection"
                                value={tourTitle}
                                onChange={(e) => setTourTitle(e.target.value)}
                                className="h-10 rounded-lg bg-white border border-slate-200 text-xs"
                            />
                        </div>

                        {/* From & To Location */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-slate-700">From Location</Label>
                                <Input
                                    placeholder="e.g. Indore HQ"
                                    value={tourFromLocation}
                                    onChange={(e) => setTourFromLocation(e.target.value)}
                                    className="h-10 rounded-lg bg-white border border-slate-200 text-xs"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-slate-700">To Location</Label>
                                <Input
                                    placeholder="e.g. Mumbai Depot"
                                    value={tourToLocation}
                                    onChange={(e) => setTourToLocation(e.target.value)}
                                    className="h-10 rounded-lg bg-white border border-slate-200 text-xs"
                                />
                            </div>
                        </div>

                        {/* Start & End Date */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-slate-700">Start Date *</Label>
                                <Input
                                    type="date"
                                    value={tourStartDate}
                                    onChange={(e) => setTourStartDate(e.target.value)}
                                    className="h-10 rounded-lg bg-white border border-slate-200 text-xs font-medium"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-slate-700">End Date *</Label>
                                <Input
                                    type="date"
                                    value={tourEndDate}
                                    onChange={(e) => setTourEndDate(e.target.value)}
                                    className="h-10 rounded-lg bg-white border border-slate-200 text-xs font-medium"
                                />
                            </div>
                        </div>

                        {/* Description */}
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-slate-700">Tour Purpose & Details (Optional)</Label>
                            <textarea
                                placeholder="State purpose, meeting schedule, or travel notes..."
                                value={tourDescription}
                                onChange={(e) => setTourDescription(e.target.value)}
                                rows={2}
                                className="w-full p-2.5 rounded-lg bg-white border border-slate-200 text-xs outline-none focus:border-slate-900 resize-none"
                            />
                        </div>
                    </div>

                    <div className="p-4 px-6 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
                        <span className="text-xs text-slate-500 flex items-center gap-1.5">
                            <ShieldCheck className="h-4 w-4 text-emerald-600" /> Tour Days = 100% Payable
                        </span>
                        <div className="flex gap-2.5">
                            <Button
                                variant="outline"
                                onClick={() => setIsTourOpen(false)}
                                className="h-9 px-4 rounded-lg border-slate-200 text-xs font-medium text-slate-700"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleTourSubmit}
                                disabled={tourSubmitting}
                                className="h-9 px-5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs disabled:opacity-50"
                            >
                                {tourSubmitting ? "Submitting..." : "Mark Tour"}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Map Dialog — shows employee punch location */}
            <Dialog open={isMapOpen} onOpenChange={setIsMapOpen}>
                <DialogContent className="sm:max-w-[680px] border-none shadow-2xl rounded-3xl p-0 overflow-hidden">
                    <DialogHeader className="p-6 flex-shrink-0">
                        <DialogTitle className="text-xl font-black italic uppercase text-slate-900 tracking-tighter flex items-center gap-2">
                            <MapPin className="h-5 w-5 text-rose-500" /> {selectedMapLog?.name}'s Punch Location
                        </DialogTitle>
                        <DialogDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            Recorded from: {selectedMapLog?.location || 'Unknown'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="w-full h-[420px] bg-slate-100">
                        <AttendanceMap
                            latitude={selectedMapLog?.checkInLatitude ?? null}
                            longitude={selectedMapLog?.checkInLongitude ?? null}
                            location={selectedMapLog?.location || 'Unknown'}
                            employeeName={selectedMapLog?.name || 'Employee'}
                            officeLat={selectedMapLog?.officeLatitude ?? null}
                            officeLon={selectedMapLog?.officeLongitude ?? null}
                            officeRadius={selectedMapLog?.officeRadius ?? null}
                        />
                    </div>
                    <div className="p-4 flex justify-end border-t border-slate-100">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-9 px-4 rounded-xl text-[10px] font-bold text-slate-500 hover:text-slate-900 uppercase tracking-widest flex items-center gap-2"
                            onClick={() =>
                                window.open(
                                    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedMapLog?.location || '')}`,
                                    '_blank'
                                )
                            }
                        >
                            <Globe className="h-3.5 w-3.5" />
                            Open in Google Maps
                            <ArrowUpRight className="h-3 w-3" />
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
            {/* Export Department Dialog */}
            <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
                <DialogContent className="sm:max-w-[420px] border-none shadow-2xl rounded-3xl p-0 overflow-hidden">
                    <DialogHeader className="p-8 pb-4">
                        <DialogTitle className="text-xl font-black italic uppercase text-slate-900 tracking-tighter flex items-center gap-2">
                            <Download className="h-5 w-5 text-indigo-600" /> Export {exportType === "live" ? "Live Attendance" : exportType === "history" ? "Attendance History" : "Monthly Report"}
                        </DialogTitle>
                        <DialogDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                            Choose department data to include in the Excel file
                        </DialogDescription>
                    </DialogHeader>

                    <div className="p-8 pt-0 space-y-4">
                        <div className="space-y-2">
                            <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Department</Label>
                            <div className="flex items-center gap-2 bg-slate-50 px-3 h-12 rounded-xl border border-slate-100">
                                <Users2 className="h-3.5 w-3.5 text-slate-400" />
                                <select
                                    value={exportDeptSelection}
                                    onChange={(e) => setExportDeptSelection(e.target.value)}
                                    className="bg-transparent border-none text-xs font-bold outline-none w-full h-full cursor-pointer"
                                >
                                    <option value="All">All Departments (Combined)</option>
                                    {departments.map((d) => (
                                        <option key={d} value={d}>{d}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
                        <Button variant="ghost" onClick={() => setIsExportDialogOpen(false)} className="text-[9px] font-black uppercase tracking-widest text-slate-500 rounded-xl hover:bg-slate-200">
                            Cancel
                        </Button>
                        <Button
                            onClick={() => {
                                if (exportType === "live") {
                                    exportLiveAttendance(exportDeptSelection);
                                } else if (exportType === "history") {
                                    exportHistoryAttendance(exportDeptSelection);
                                } else {
                                    handleMonthlyExport();
                                }
                            }}
                            className="bg-slate-900 hover:bg-black text-[#D9F99D] font-black uppercase text-[9px] tracking-widest rounded-xl px-6 h-10 shadow-md"
                        >
                            Export Excel
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

        </ProtectedRoute>
    );
}
