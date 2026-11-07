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
    const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Fetch companies, offices, departments and late threshold for filter dropdowns (Req 5.3)
    useEffect(() => {
        Promise.all([
            apiGet<{ id: number; name: string }[]>("/companies"),
            apiGet<{ id: number; name: string }[]>("/offices", { limit: 100 }),
            apiGet<string[]>("/leave/departments"),
            apiGet<any>("/config/late-threshold").catch(() => null),
        ])
            .then(([compRes, offRes, deptRes, lateRes]) => {
                setCompanies(Array.isArray(compRes) ? compRes : []);
                setOffices(Array.isArray(offRes) ? offRes : []);
                setDepartments(Array.isArray(deptRes) ? deptRes : []);
                if (lateRes && lateRes.lateThresholdMinutes) {
                    setLateThresholdMinutes(lateRes.lateThresholdMinutes);
                    setTempLateThreshold(lateRes.lateThresholdMinutes);
                }
            })
            .catch(() => { setCompanies([]); setOffices([]); setDepartments([]); });
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

    // Synchronized scrollbar refs & state (Req 7 - Usability Improvements)
    const tableContainerRef = useRef<HTMLDivElement>(null);
    const topScrollRef = useRef<HTMLDivElement>(null);
    const [scrollWidth, setScrollWidth] = useState(0);
    const [scrollLeftPos, setScrollLeftPos] = useState(0);
    const [maxScrollLeft, setMaxScrollLeft] = useState(1);
    const isSyncingScroll = useRef(false);

    // Desktop Mouse Drag-to-Pan State (Req 7)
    const [isPanning, setIsPanning] = useState(false);
    const dragStartX = useRef(0);
    const dragScrollLeft = useRef(0);
    const hasDragged = useRef(false);

    const updateScrollMetrics = useCallback(() => {
        if (tableContainerRef.current) {
            const { scrollLeft, scrollWidth: sw, clientWidth } = tableContainerRef.current;
            setScrollLeftPos(scrollLeft);
            setScrollWidth(sw);
            setMaxScrollLeft(Math.max(1, sw - clientWidth));
        }
    }, []);

    const handleTopScroll = () => {
        if (isSyncingScroll.current) return;
        isSyncingScroll.current = true;
        if (tableContainerRef.current && topScrollRef.current) {
            tableContainerRef.current.scrollLeft = topScrollRef.current.scrollLeft;
            updateScrollMetrics();
        }
        requestAnimationFrame(() => { isSyncingScroll.current = false; });
    };

    const handleTableScroll = () => {
        if (isSyncingScroll.current) return;
        isSyncingScroll.current = true;
        if (topScrollRef.current && tableContainerRef.current) {
            topScrollRef.current.scrollLeft = tableContainerRef.current.scrollLeft;
            updateScrollMetrics();
        }
        requestAnimationFrame(() => { isSyncingScroll.current = false; });
    };

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

    const handleScrubberChange = (value: number) => {
        if (tableContainerRef.current) {
            const target = (value / 100) * maxScrollLeft;
            tableContainerRef.current.scrollLeft = target;
            if (topScrollRef.current) topScrollRef.current.scrollLeft = target;
            setScrollLeftPos(target);
        }
    };

    // Mouse Drag Panning Handlers
    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button !== 0) return; // Only primary mouse button
        const target = e.target as HTMLElement;
        if (target.closest('button') || target.closest('a') || target.closest('input') || target.closest('select')) {
            return;
        }
        setIsPanning(true);
        hasDragged.current = false;
        dragStartX.current = e.clientX;
        dragScrollLeft.current = tableContainerRef.current?.scrollLeft || 0;
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isPanning || !tableContainerRef.current) return;
        const delta = e.clientX - dragStartX.current;
        if (Math.abs(delta) > 3) {
            hasDragged.current = true;
        }
        tableContainerRef.current.scrollLeft = dragScrollLeft.current - delta;
    };

    const handleMouseUp = () => {
        setIsPanning(false);
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
            const colWidth = 34;
            const targetLeft = Math.max(0, todayIdx * colWidth - (tableContainerRef.current.clientWidth / 2) + 200);
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

    // Manual & Authorized Attendance State (Req 5.1, 5.2)
    const [isManualEntryOpen, setIsManualEntryOpen] = useState(false);
    const [manualEmpId, setManualEmpId] = useState("");
    const [manualDate, setManualDate] = useState("");
    const [manualStatus, setManualStatus] = useState("Present");
    const [manualReason, setManualReason] = useState("");
    const [manualIsOutdoor, setManualIsOutdoor] = useState(false);
    const [manualCheckInTime, setManualCheckInTime] = useState("");
    const [manualCheckOutTime, setManualCheckOutTime] = useState("");
    const [manualSubmitting, setManualSubmitting] = useState(false);

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

    // Update scroll metrics when rows, dates, or active tab change (Req 7)
    useEffect(() => {
        updateScrollMetrics();
        const handleResize = () => updateScrollMetrics();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [monthlyRows, cycleDates, activeTab, updateScrollMetrics]);

    // Load data on tab switch
    useEffect(() => { if (activeTab === "live") fetchLiveAttendance(); }, [activeTab, fetchLiveAttendance]);
    useEffect(() => { if (activeTab === "history") { setHistoryPage(1); fetchHistory(1); } }, [activeTab]);
    useEffect(() => { if (activeTab === "history") { setHistoryPage(1); fetchHistory(1); } }, [historyFrom, historyTo, selectedCompanyId, selectedOfficeId, historyDebouncedSearch, selectedDepartment]);
    useEffect(() => { if (activeTab === "monthly") fetchMonthly(); }, [activeTab, selectedMonth, selectedYear, cycleType, fetchMonthly]);

    // Manual & Authorized entry submit (Req 5.1 & 5.2)
    const handleManualSubmit = async () => {
        if (!manualEmpId || !manualDate || !manualStatus) return;
        setManualSubmitting(true);
        try {
            const isOutdoorDuty = manualIsOutdoor || manualStatus === "Present - Outdoor";
            const normalizedStatus = manualStatus === "Present - Outdoor" ? "Present" : manualStatus;
            await apiPost("/attendance/admin/manual-entry", {
                employeeId: manualEmpId,
                date: manualDate,
                status: normalizedStatus,
                reason: manualReason,
                is_outdoor: isOutdoorDuty,
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
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                            <Card className="bg-slate-900 text-white rounded-2xl p-4 shadow-sm border-none">
                                <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Total Staff</p>
                                <h4 className="text-2xl font-black italic tracking-tighter mt-1">{monthlyRows.length}</h4>
                                <span className="text-[8px] text-slate-400 font-bold uppercase">In View</span>
                            </Card>
                            <Card className="bg-blue-50/80 rounded-2xl p-4 shadow-sm border-none">
                                <p className="text-[8px] font-black uppercase tracking-widest text-blue-600">1. Muster / Total Days</p>
                                <h4 className="text-2xl font-black italic tracking-tighter text-blue-950 mt-1">{daysInSelectedMonth}</h4>
                                <span className="text-[8px] text-blue-500 font-bold uppercase">{cycleType === "payroll" ? "26th - 25th Cycle" : "Calendar Month"}</span>
                            </Card>
                            <Card className="bg-emerald-50/80 rounded-2xl p-4 shadow-sm border-none">
                                <p className="text-[8px] font-black uppercase tracking-widest text-emerald-600">Total Present Days</p>
                                <h4 className="text-2xl font-black italic tracking-tighter text-emerald-950 mt-1">
                                    {monthlyRows.reduce((sum, r) => sum + (r.present || 0), 0)}
                                </h4>
                                <span className="text-[8px] text-emerald-600 font-bold uppercase">Recorded Staff Days</span>
                            </Card>
                            <Card className="bg-indigo-50/80 rounded-2xl p-4 shadow-sm border-none">
                                <p className="text-[8px] font-black uppercase tracking-widest text-indigo-600">2. Payable Days</p>
                                <h4 className="text-2xl font-black italic tracking-tighter text-indigo-950 mt-1">
                                    {monthlyRows.reduce((sum, r) => sum + ((r.present || 0) + (r.woff || 0) + (r.leave || 0) + (r.holiday || 0) + (r.tour || 0)), 0)}
                                </h4>
                                <span className="text-[8px] text-indigo-600 font-bold uppercase">Present + WO + H + L + Tour</span>
                            </Card>
                            <Card className="bg-rose-50/80 rounded-2xl p-4 shadow-sm border-none">
                                <p className="text-[8px] font-black uppercase tracking-widest text-rose-600">3. LWP (Loss of Pay)</p>
                                <h4 className="text-2xl font-black italic tracking-tighter text-rose-950 mt-1">
                                    {monthlyRows.reduce((sum, r) => sum + (r.absent || 0), 0)}
                                </h4>
                                <span className="text-[8px] text-rose-600 font-bold uppercase">Salary Deducted Days</span>
                            </Card>
                        </div>

                        {/* Attendance & Payroll Calculation Relationship Bridge (Req 8) */}
                        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-slate-700 shadow-sm">
                            <div className="flex flex-wrap items-center gap-3 text-[10px]">
                                <div className="flex items-center gap-1.5 font-black uppercase tracking-wider text-slate-900">
                                    <Info className="h-4 w-4 text-indigo-600 shrink-0" />
                                    <span>Payroll Relationship:</span>
                                </div>
                                <div className="flex items-center gap-1.5 font-bold">
                                    <span className="bg-blue-100 text-blue-900 px-2 py-0.5 rounded-md font-black">Muster Days ({daysInSelectedMonth})</span>
                                    <span className="text-slate-400 font-black">=</span>
                                    <span className="bg-indigo-100 text-indigo-900 px-2 py-0.5 rounded-md font-black">Payable Days</span>
                                    <span className="text-slate-400 font-black">+</span>
                                    <span className="bg-rose-100 text-rose-900 px-2 py-0.5 rounded-md font-black">LWP Days</span>
                                </div>
                                <div className="hidden lg:inline text-slate-300">|</div>
                                <span className="text-slate-500 font-semibold hidden sm:inline">
                                    Per-Day Rate = Fixed Gross ÷ Muster Days • Gross Payout = Payable Days × Daily Rate
                                </span>
                            </div>
                            <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                                Click any Payable or LWP badge for breakdown
                            </div>
                        </div>

                        {/* Executive Month & Day Information Banner (Req 6.3) */}
                        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-3xl p-5 sm:p-6 shadow-md border border-slate-800/80 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
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

                        <Card className="border-none shadow-sm rounded-[2.5rem] bg-white overflow-hidden">
                            <CardHeader className="p-8 pb-6 border-b border-slate-50 flex flex-col xl:flex-row xl:items-start xl:justify-between gap-6">
                                <div>
                                    <div className="flex flex-wrap items-center gap-3">
                                        <CardTitle className="text-xl font-black italic uppercase text-slate-900 tracking-tighter">Monthly Attendance Grid</CardTitle>
                                        <MonthYearPicker
                                            month={selectedMonth}
                                            year={selectedYear}
                                            onChange={(m, y) => { setSelectedMonth(m); setSelectedYear(y); }}
                                        />
                                        {/* Cycle Switcher (Req 6.2) */}
                                        <div className="flex bg-slate-100 p-1 rounded-2xl ml-2">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                onClick={() => setCycleType("payroll")}
                                                className={cn(
                                                    "h-8 px-4 rounded-xl font-black text-[9px] uppercase tracking-wider transition-all",
                                                    cycleType === "payroll" ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-900"
                                                )}
                                            >
                                                Payroll Cycle (26th - 25th)
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                onClick={() => setCycleType("calendar")}
                                                className={cn(
                                                    "h-8 px-4 rounded-xl font-black text-[9px] uppercase tracking-wider transition-all",
                                                    cycleType === "calendar" ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-900"
                                                )}
                                            >
                                                Calendar Month (1st - End)
                                            </Button>
                                        </div>
                                    </div>
                                    <CardDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2 leading-relaxed">
                                        {formatCycleRange()} • Dynamic {daysInSelectedMonth}-day grid ({cycleType === "payroll" ? "26th prev month to 25th" : "1st to month-end"}). <br />
                                        <span className="text-emerald-500 font-bold">Payable Days</span> = Present + Paid Leave + Weekly Off + Holiday + Tour
                                    </CardDescription>
                                    {/* Monthly Filters */}
                                    <div className="flex flex-wrap items-center gap-3 mt-4">
                                        <div className="flex items-center gap-2 bg-slate-50 px-3 h-9 rounded-xl border border-slate-100">
                                            <Building2 className="h-3.5 w-3.5 text-slate-400" />
                                            <select
                                                value={selectedCompanyId}
                                                onChange={(e) => setSelectedCompanyId(e.target.value)}
                                                className="bg-transparent border-none text-[9px] font-black uppercase outline-none pr-2 h-full cursor-pointer"
                                            >
                                                <option value="">All Companies</option>
                                                {companies.map((c) => (
                                                    <option key={c.id} value={c.id.toString()}>{c.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="flex items-center gap-2 bg-slate-50 px-3 h-9 rounded-xl border border-slate-100">
                                            <MapPin className="h-3.5 w-3.5 text-slate-400" />
                                            <select
                                                value={selectedOfficeId}
                                                onChange={(e) => setSelectedOfficeId(e.target.value)}
                                                className="bg-transparent border-none text-[9px] font-black uppercase outline-none pr-2 h-full cursor-pointer"
                                            >
                                                <option value="">All Offices</option>
                                                {offices.map((o) => (
                                                    <option key={o.id} value={o.id.toString()}>{o.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="flex items-center gap-2 bg-slate-50 px-3 h-9 rounded-xl border border-slate-100">
                                            <Users2 className="h-3.5 w-3.5 text-slate-400" />
                                            <select
                                                value={selectedDepartment}
                                                onChange={(e) => setSelectedDepartment(e.target.value)}
                                                className="bg-transparent border-none text-[9px] font-black uppercase outline-none pr-2 h-full cursor-pointer"
                                            >
                                                <option value="">All Departments</option>
                                                {departments.map((d) => (
                                                    <option key={d} value={d}>{d}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="relative group">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-300 group-focus-within:text-slate-900 transition-colors" />
                                            <Input
                                                placeholder="Search Staff..."
                                                className="h-9 w-40 pl-9 bg-slate-50 border-none rounded-xl font-bold text-[9px] focus-visible:ring-1 focus-visible:ring-[#D9F99D]"
                                                value={monthlySearch}
                                                onChange={(e) => handleMonthlySearchChange(e.target.value)}
                                            />
                                        </div>
                                        <Button
                                            variant="outline"
                                            className="h-9 px-4 rounded-xl border-slate-100 font-black text-[9px] uppercase tracking-widest disabled:opacity-50"
                                            onClick={() => {
                                                setExportType("monthly");
                                                setExportDeptSelection(selectedDepartment || "All");
                                                setIsExportDialogOpen(true);
                                            }}
                                            disabled={exportingMonthly}
                                        >
                                            {exportingMonthly ? (
                                                <span className="flex items-center gap-1">
                                                    <svg className="animate-spin h-3.5 w-3.5 text-emerald-500" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                                    </svg>
                                                    Exporting...
                                                </span>
                                            ) : (
                                                <>
                                                    <FileSpreadsheet className="h-4 w-4 mr-2 text-emerald-500" /> Export
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-3">
                                    <div className="flex items-center gap-4 bg-slate-50 py-2 px-4 rounded-xl border border-slate-100">
                                        <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div><span className="text-[8px] font-black uppercase tracking-widest text-slate-500">Present</span></div>
                                        <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]"></div><span className="text-[8px] font-black uppercase tracking-widest text-slate-500">Absent/LWP</span></div>
                                        <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"></div><span className="text-[8px] font-black uppercase tracking-widest text-slate-500">Leave</span></div>
                                        <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-slate-300"></div><span className="text-[8px] font-black uppercase tracking-widest text-slate-500">WOff</span></div>
                                        <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div><span className="text-[8px] font-black uppercase tracking-widest text-slate-500">Holiday</span></div>
                                    </div>
                                    {/* Fast Navigation Scroll Controls (Req 7) */}
                                    <div className="flex flex-wrap items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                                        <span className="text-[8px] font-black uppercase text-slate-400">Scroll:</span>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={scrollToStart}
                                            className="h-7 w-7 p-0 rounded-lg border-slate-200 hover:bg-slate-200 text-slate-700"
                                            title="Jump to Start (Day 1)"
                                        >
                                            <ChevronsLeft className="h-3.5 w-3.5 text-slate-700" />
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => scrollTable(-280)}
                                            className="h-7 w-7 p-0 rounded-lg border-slate-200 hover:bg-slate-200 text-slate-700"
                                            title="Scroll Left (Prev Week)"
                                        >
                                            <ChevronLeft className="h-3.5 w-3.5 text-slate-700" />
                                        </Button>
                                        {isTodayInCycle && (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={scrollToToday}
                                                className="h-7 px-2 rounded-lg border-emerald-300 bg-emerald-50 hover:bg-emerald-100 font-black text-[8px] uppercase tracking-wider text-emerald-800 shadow-sm"
                                                title={`Jump to Today (${currentDate.getDate()} ${monthNames[currentDate.getMonth()].slice(0, 3)})`}
                                            >
                                                <Target className="h-3 w-3 mr-1 text-emerald-600" />
                                                Today
                                            </Button>
                                        )}
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => scrollTable(280)}
                                            className="h-7 w-7 p-0 rounded-lg border-slate-200 hover:bg-slate-200 text-slate-700"
                                            title="Scroll Right (Next Week)"
                                        >
                                            <ChevronRight className="h-3.5 w-3.5 text-slate-700" />
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={scrollToEnd}
                                            className="h-7 w-7 p-0 rounded-lg border-slate-200 hover:bg-slate-200 text-slate-700"
                                            title={`Jump to End (Day ${daysInSelectedMonth})`}
                                        >
                                            <ChevronsRight className="h-3.5 w-3.5 text-slate-700" />
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>

                            {/* Synchronized Top Horizontal Scrollbar (Req 7 - no need to scroll to bottom) */}
                            <div
                                ref={topScrollRef}
                                onScroll={handleTopScroll}
                                className="overflow-x-auto border-b border-slate-100 bg-slate-50/70 scrollbar-thin scrollbar-thumb-slate-300"
                                style={{ height: '14px' }}
                            >
                                <div style={{ width: scrollWidth || '100%', height: '1px' }} />
                            </div>

                            <CardContent
                                ref={tableContainerRef}
                                onScroll={handleTableScroll}
                                onMouseDown={handleMouseDown}
                                onMouseMove={handleMouseMove}
                                onMouseUp={handleMouseUp}
                                onMouseLeave={handleMouseUp}
                                className={cn(
                                    "p-0 overflow-auto max-h-[calc(100vh-270px)] min-h-[460px] scrollbar-thin select-none",
                                    isPanning ? "cursor-grabbing" : "cursor-grab"
                                )}
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
                                            <tr><td colSpan={daysInSelectedMonth + 6} className="py-20 text-center"><p className="text-[10px] font-bold text-slate-400 animate-pulse">Loading monthly data...</p></td></tr>
                                        ) : monthlyRows.length === 0 ? (
                                            <tr><td colSpan={daysInSelectedMonth + 6} className="py-20 text-center"><p className="text-[10px] font-bold text-slate-400">No monthly attendance records found</p></td></tr>
                                        ) : monthlyRows.map((emp, idx) => {
                                            const payable = (emp.present ?? 0) + (emp.woff ?? 0) + (emp.leave ?? 0) + (emp.holiday ?? 0) + (emp.tour ?? 0);
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
                                                            title={`Employee: ${emp.name}\nFixed Gross: ₹${(emp.salary || 0).toLocaleString('en-IN')}\nPer-Day Rate: ₹${dailyRate.toLocaleString('en-IN')}\n────────────────\nMuster Days: ${emp.muster_days ?? daysInSelectedMonth}\n• Present: ${emp.present ?? 0}\n• Weekly Off: ${emp.woff ?? 0}\n• Holiday: ${emp.holiday ?? 0}\n• Paid Leave: ${emp.leave ?? 0}\n• Tour (Paid): ${emp.tour ?? 0}\n────────────────\nPayable Days: ${payable}\nEstimated Gross Payout: ₹${(payable * dailyRate).toLocaleString('en-IN')}\n\n(Click to view full payroll calculation breakdown)`}
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
                                                    {/* Day cells */}
                                                    {cycleDates.map((dateObj, dayIdx) => {
                                                        const status = (emp.grid && emp.grid[dayIdx]) ? emp.grid[dayIdx] : '-';
                                                        const isToday =
                                                            dateObj.getDate() === currentDate.getDate() &&
                                                            dateObj.getMonth() === currentDate.getMonth() &&
                                                            dateObj.getFullYear() === currentDate.getFullYear();

                                                        const earnedForDay = status === 'A' || status === '-' ? 0 : dailyRate;
                                                        const tooltipLines = `${dateObj.toLocaleDateString('en-GB')}: ${status === 'P' ? 'Present' : status === 'A' ? 'Absent/LWP' : status === 'W' ? 'Weekly Off' : status === 'H' ? 'Holiday' : status === 'T' ? 'Tour' : status === 'L' ? 'Leave' : 'No Data'} (₹${earnedForDay.toLocaleString('en-IN')})`;

                                                        return (
                                                            <td key={dayIdx} className={cn("py-3 px-1 text-center transition-all", isToday ? "bg-indigo-50/30" : "")}>
                                                                <div
                                                                    title={tooltipLines}
                                                                    className={cn(
                                                                        "h-6 w-6 mx-auto rounded-md flex items-center justify-center text-[8px] font-black transition-transform hover:scale-110 cursor-help shadow-sm border",
                                                                        status === 'P' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                                                                            status === 'A' ? "bg-rose-500 text-white shadow-rose-200 border-rose-600" :
                                                                                status === 'W' ? "bg-slate-100 text-slate-400 border-slate-200 opacity-60" :
                                                                                    status === 'H' ? "bg-blue-500 text-white shadow-blue-200 border-blue-600" :
                                                                                        status === 'T' ? "bg-violet-100 text-violet-700 border-violet-200" :
                                                                                            status === 'L' ? "bg-amber-100 text-amber-700 border-amber-200" :
                                                                                                "bg-white text-slate-300 border-dashed border-slate-200"
                                                                    )}
                                                                >
                                                                    {status}
                                                                </div>
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </CardContent>

                            {/* Sticky Bottom Desktop Horizontal Navigation Controller (Req 7) */}
                            <div className="sticky bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 px-5 py-2.5 shadow-[0_-6px_20px_-4px_rgba(0,0,0,0.06)] flex flex-col md:flex-row md:items-center justify-between gap-3 select-none">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1">
                                        <MoveHorizontal className="h-3 w-3 text-slate-400" />
                                        Quick Jump:
                                    </span>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={scrollToStart}
                                        className="h-8 px-2.5 rounded-xl border-slate-200 hover:bg-slate-100 font-black text-[9px] uppercase tracking-wider text-slate-700 shadow-sm"
                                        title="Jump to Start of Cycle (Day 1)"
                                    >
                                        <ChevronsLeft className="h-3.5 w-3.5 mr-1 text-slate-500" />
                                        Start (01)
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => scrollTable(-280)}
                                        className="h-8 px-2.5 rounded-xl border-slate-200 hover:bg-slate-100 font-black text-[9px] uppercase tracking-wider text-slate-700 shadow-sm"
                                        title="Scroll 1 Week Left (-7 Days)"
                                    >
                                        <ChevronLeft className="h-3.5 w-3.5 mr-1 text-slate-500" />
                                        -7 Days
                                    </Button>

                                    {isTodayInCycle && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={scrollToToday}
                                            className="h-8 px-3 rounded-xl border-emerald-300 bg-emerald-50/90 hover:bg-emerald-100 font-black text-[9px] uppercase tracking-wider text-emerald-800 shadow-sm transition-all hover:scale-105"
                                            title={`Jump directly to Today (${currentDate.getDate()} ${monthNames[currentDate.getMonth()].slice(0, 3)})`}
                                        >
                                            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-ping mr-1.5" />
                                            <Target className="h-3.5 w-3.5 mr-1 text-emerald-600" />
                                            Jump to Today ({String(currentDate.getDate()).padStart(2, '0')})
                                        </Button>
                                    )}

                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => scrollTable(280)}
                                        className="h-8 px-2.5 rounded-xl border-slate-200 hover:bg-slate-100 font-black text-[9px] uppercase tracking-wider text-slate-700 shadow-sm"
                                        title="Scroll 1 Week Right (+7 Days)"
                                    >
                                        +7 Days
                                        <ChevronRight className="h-3.5 w-3.5 ml-1 text-slate-500" />
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={scrollToEnd}
                                        className="h-8 px-2.5 rounded-xl border-slate-200 hover:bg-slate-100 font-black text-[9px] uppercase tracking-wider text-slate-700 shadow-sm"
                                        title={`Jump to End (Day ${daysInSelectedMonth})`}
                                    >
                                        End ({daysInSelectedMonth})
                                        <ChevronsRight className="h-3.5 w-3.5 ml-1 text-slate-500" />
                                    </Button>
                                </div>

                                {/* Center: Interactive Visual Scrubber Track */}
                                <div className="flex items-center gap-3 flex-1 max-w-xs md:max-w-md">
                                    <span className="text-[8px] font-black uppercase text-slate-400 shrink-0">Scrub Cycle:</span>
                                    <input
                                        type="range"
                                        min={0}
                                        max={100}
                                        value={Math.round((scrollLeftPos / (maxScrollLeft || 1)) * 100)}
                                        onChange={(e) => handleScrubberChange(Number(e.target.value))}
                                        className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 transition-all hover:h-2"
                                        title="Drag to smoothly scrub across all dates in cycle"
                                    />
                                    <span className="text-[9px] font-bold text-slate-600 shrink-0 tabular-nums">
                                        {Math.round((scrollLeftPos / (maxScrollLeft || 1)) * 100)}%
                                    </span>
                                </div>

                                {/* Right Tips & Shortcuts */}
                                <div className="hidden lg:flex items-center gap-2">
                                    <span className="text-[8px] font-bold text-slate-400 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
                                        🖐️ Drag Grid to Pan • ⌨️ Shift + Wheel to Scroll
                                    </span>
                                </div>
                            </div>
                        </Card>
                    </div>
                )}
            </div>

            {/* Attendance & Payroll Calculation Breakdown Dialog (Req 8) */}
            <Dialog open={isPayrollBreakdownOpen} onOpenChange={setIsPayrollBreakdownOpen}>
                <DialogContent className="sm:max-w-[560px] rounded-[2rem] p-0 overflow-hidden bg-white border-none shadow-2xl">
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
                            <div>
                                <div className="bg-slate-900 p-7 text-white relative overflow-hidden">
                                    <div className="absolute inset-0 opacity-10">
                                        <div className="absolute inset-0 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]" />
                                    </div>
                                    <div className="relative z-10 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="h-12 w-12 bg-white/10 rounded-2xl flex items-center justify-center font-black italic text-lg text-[#D9F99D] shadow-md">
                                                {emp.name.charAt(0)}
                                            </div>
                                            <div>
                                                <DialogTitle className="text-xl font-black italic tracking-tight text-white">
                                                    {emp.name}
                                                </DialogTitle>
                                                <DialogDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                                    {emp.id} • {emp.role} • {emp.company || "Company"}
                                                </DialogDescription>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 block">Fixed Gross CTC</span>
                                            <span className="text-base font-black text-emerald-400">₹{fixedGross.toLocaleString('en-IN')}/mo</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-7 space-y-5">
                                    {/* 3 Core Fields Requirement 8 Summary Cards */}
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="bg-blue-50/70 border border-blue-100 rounded-2xl p-3 text-center">
                                            <span className="text-[8px] font-black uppercase tracking-wider text-blue-600 block">1. Muster Days</span>
                                            <span className="text-2xl font-black text-blue-950 block mt-1">{musterDays}</span>
                                            <span className="text-[8px] text-blue-500 font-bold uppercase">Total In Period</span>
                                        </div>
                                        <div className="bg-emerald-50/70 border border-emerald-100 rounded-2xl p-3 text-center">
                                            <span className="text-[8px] font-black uppercase tracking-wider text-emerald-600 block">2. Payable Days</span>
                                            <span className="text-2xl font-black text-emerald-950 block mt-1">{payableDays}</span>
                                            <span className="text-[8px] text-emerald-600 font-bold uppercase">Salary Payable</span>
                                        </div>
                                        <div className="bg-rose-50/70 border border-rose-100 rounded-2xl p-3 text-center">
                                            <span className="text-[8px] font-black uppercase tracking-wider text-rose-600 block">3. LWP (Unpaid)</span>
                                            <span className="text-2xl font-black text-rose-950 block mt-1">{lwpDays}</span>
                                            <span className="text-[8px] text-rose-600 font-bold uppercase">Loss of Pay Days</span>
                                        </div>
                                    </div>

                                    {/* Approved Payroll Relationship Equation */}
                                    <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-2">
                                        <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider">
                                            <span className="text-slate-500">Payroll Balance Equation:</span>
                                            <Badge className={cn("text-[9px] font-black uppercase px-2 py-0.5", isBalanced ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800")}>
                                                {isBalanced ? "✓ Balanced (P + LWP = M)" : "⚠️ Cycle Incomplete"}
                                            </Badge>
                                        </div>
                                        <div className="flex items-center justify-between text-xs font-mono font-bold bg-white p-2.5 rounded-xl border border-slate-100 text-slate-800">
                                            <span>Muster ({musterDays})</span>
                                            <span className="text-slate-400">=</span>
                                            <span className="text-emerald-700">Payable ({payableDays})</span>
                                            <span className="text-slate-400">+</span>
                                            <span className="text-rose-700">LWP ({lwpDays})</span>
                                        </div>
                                        <p className="text-[9px] text-slate-400 leading-relaxed">
                                            Per-Day Rate: <strong className="text-slate-700">₹{fixedGross.toLocaleString('en-IN')} ÷ {musterDays} = ₹{dailyRate.toLocaleString('en-IN')}/day</strong>.
                                        </p>
                                    </div>

                                    {/* Detailed Component Breakdown */}
                                    <div className="space-y-2">
                                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">Attendance Component Breakdown</span>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                                            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex justify-between items-center">
                                                <span className="text-slate-500 font-medium">Present:</span>
                                                <span className="font-black text-slate-800">{present} days</span>
                                            </div>
                                            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex justify-between items-center">
                                                <span className="text-slate-500 font-medium">Week Offs:</span>
                                                <span className="font-black text-slate-800">{woff} days</span>
                                            </div>
                                            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex justify-between items-center">
                                                <span className="text-slate-500 font-medium">Holidays:</span>
                                                <span className="font-black text-slate-800">{holiday} days</span>
                                            </div>
                                            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex justify-between items-center">
                                                <span className="text-slate-500 font-medium">Paid Leaves:</span>
                                                <span className="font-black text-slate-800">{leave} days</span>
                                            </div>
                                            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex justify-between items-center">
                                                <span className="text-slate-500 font-medium">Tours / Outdoor:</span>
                                                <span className="font-black text-slate-800">{tour} days</span>
                                            </div>
                                            <div className="p-2.5 rounded-xl bg-rose-50/60 border border-rose-100 flex justify-between items-center">
                                                <span className="text-rose-600 font-medium">LWP / Absent:</span>
                                                <span className="font-black text-rose-900">{lwpDays} days</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Final Financial Treatment Preview */}
                                    <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100 flex items-center justify-between">
                                        <div>
                                            <span className="text-[9px] font-black uppercase tracking-widest text-indigo-600 block">Gross Salary Payable</span>
                                            <span className="text-lg font-black text-indigo-950 block">₹{grossEarned.toLocaleString('en-IN')}</span>
                                            <span className="text-[8px] text-slate-400 font-medium">{payableDays} days × ₹{dailyRate.toLocaleString('en-IN')}/day</span>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-[9px] font-black uppercase tracking-widest text-rose-600 block">LWP Deduction</span>
                                            <span className="text-lg font-black text-rose-900 block">-₹{lwpDeduction.toLocaleString('en-IN')}</span>
                                            <span className="text-[8px] text-slate-400 font-medium">{lwpDays} days × ₹{dailyRate.toLocaleString('en-IN')}/day</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-end gap-3 pt-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => setIsPayrollBreakdownOpen(false)}
                                            className="h-10 px-5 rounded-xl border-slate-200 font-black text-[10px] uppercase tracking-wider"
                                        >
                                            Close
                                        </Button>
                                        <Button
                                            type="button"
                                            onClick={() => {
                                                setIsPayrollBreakdownOpen(false);
                                                window.location.href = `/payroll`;
                                            }}
                                            className="h-10 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-[10px] uppercase tracking-wider shadow-md"
                                        >
                                            Open in Payroll Ledger <ArrowUpRight className="h-3.5 w-3.5 ml-1.5" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
                </DialogContent>
            </Dialog>

            {/* Authorized Attendance & Outdoor Duty Dialog (Req 5.1 & 5.2) */}
            <Dialog open={isManualEntryOpen} onOpenChange={setIsManualEntryOpen}>
                <DialogContent className="sm:max-w-[500px] rounded-[2rem] p-0 overflow-hidden bg-white border-none shadow-2xl">
                    <div className="bg-slate-900 p-8 text-center relative overflow-hidden">
                        <div className="absolute inset-0 opacity-10">
                            <div className="absolute inset-0 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]" />
                        </div>
                        <div className="relative z-10 flex flex-col items-center">
                            <div className="h-14 w-14 bg-white/10 rounded-2xl flex items-center justify-center mb-3">
                                <UserCheck className="h-7 w-7 text-[#D9F99D]" />
                            </div>
                            <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter text-white">Authorized Marking</DialogTitle>
                            <DialogDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                Mark Attendance on Employee's Behalf & Outdoor Duty
                            </DialogDescription>
                        </div>
                    </div>

                    <div className="p-8 space-y-4">
                        <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-100 text-[10px] text-indigo-950">
                            <p className="font-bold">Administrative Access Control (Req 5.1 & 5.2):</p>
                            <p className="text-slate-600 text-[9px] mt-0.5">
                                Logged under your authorized credentials with audit history. For outdoor duties or field operations, geofence checks are automatically bypassed.
                            </p>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Employee Code or Numeric ID</Label>
                            <Input
                                placeholder="e.g. EMP118196 or 6"
                                value={manualEmpId}
                                onChange={(e) => setManualEmpId(e.target.value)}
                                className="h-11 rounded-xl bg-slate-50 border-none font-bold text-xs uppercase"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Date</Label>
                                <Input
                                    type="date"
                                    value={manualDate}
                                    onChange={(e) => setManualDate(e.target.value)}
                                    className="h-11 rounded-xl bg-slate-50 border-none font-bold text-xs uppercase"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Status</Label>
                                <select
                                    value={manualStatus}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setManualStatus(val);
                                        if (val === "Present - Outdoor") {
                                            setManualIsOutdoor(true);
                                        }
                                    }}
                                    className="h-11 w-full px-3 rounded-xl bg-slate-50 border-none font-bold text-[10px] uppercase outline-none focus:ring-2 ring-indigo-100"
                                >
                                    <option value="Present">Present (Standard In-Office)</option>
                                    <option value="Present - Outdoor">Present (Outdoor / Field Duty)</option>
                                    <option value="Late">Late Arrival</option>
                                    <option value="Half Day">Half Day</option>
                                    <option value="Absent">Absent</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Check-In Time</Label>
                                <Input
                                    type="time"
                                    value={manualCheckInTime}
                                    onChange={(e) => setManualCheckInTime(e.target.value)}
                                    className="h-10 rounded-xl bg-slate-50 border-none font-bold text-xs"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Check-Out Time</Label>
                                <Input
                                    type="time"
                                    value={manualCheckOutTime}
                                    onChange={(e) => setManualCheckOutTime(e.target.value)}
                                    className="h-10 rounded-xl bg-slate-50 border-none font-bold text-xs"
                                />
                            </div>
                        </div>

                        {/* Outdoor / Field Duty Geofence Bypass Option (Req 5.1) */}
                        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-100 cursor-pointer" onClick={() => setManualIsOutdoor(!manualIsOutdoor)}>
                            <input
                                type="checkbox"
                                id="manualIsOutdoor"
                                checked={manualIsOutdoor}
                                onChange={(e) => setManualIsOutdoor(e.target.checked)}
                                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                            <div className="flex flex-col cursor-pointer">
                                <label htmlFor="manualIsOutdoor" className="text-[10px] font-black uppercase tracking-wider text-slate-900 cursor-pointer flex items-center gap-1.5">
                                    <Compass className="h-3 w-3 text-emerald-600" /> Outdoor / Field Duty Punch
                                </label>
                                <span className="text-[8px] font-bold text-slate-400">Bypasses office geofence verification (for client visits, audits, site work)</span>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Authorized Reason / Audit Rationale</Label>
                            <textarea
                                placeholder="State reason for marking on behalf (e.g. Client site meeting at Delhi Branch, field duty authorization)..."
                                value={manualReason}
                                onChange={(e) => setManualReason(e.target.value)}
                                className="w-full h-18 p-3 rounded-xl bg-slate-50 border-none font-bold text-xs resize-none outline-none focus:ring-2 ring-indigo-100"
                            />
                        </div>
                    </div>

                    <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                            <ShieldCheck className="h-3.5 w-3.5 text-indigo-500" /> Recorded in Audit Log
                        </span>
                        <div className="flex gap-3">
                            <Button variant="ghost" onClick={() => setIsManualEntryOpen(false)} className="text-[9px] font-black uppercase tracking-widest text-slate-500 rounded-xl hover:bg-slate-200">Cancel</Button>
                            <Button onClick={handleManualSubmit} disabled={manualSubmitting} className="bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase text-[9px] tracking-widest rounded-xl px-6 shadow-md transition-all hover:translate-y-[-2px] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0">
                                {manualSubmitting ? "Submitting..." : "Authorize Entry"}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Late Attendance Policy & Threshold Dialog (Req 5.3) */}
            <Dialog open={isLateThresholdOpen} onOpenChange={setIsLateThresholdOpen}>
                <DialogContent className="sm:max-w-[460px] rounded-[2rem] p-0 overflow-hidden bg-white border-none shadow-2xl">
                    <div className="bg-amber-500 p-8 text-center relative overflow-hidden">
                        <div className="absolute inset-0 opacity-10">
                            <div className="absolute inset-0 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]" />
                        </div>
                        <div className="relative z-10 flex flex-col items-center">
                            <div className="h-14 w-14 bg-white/20 rounded-2xl flex items-center justify-center mb-3">
                                <Clock className="h-7 w-7 text-white" />
                            </div>
                            <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter text-white">Late Attendance Rule</DialogTitle>
                            <DialogDescription className="text-[10px] font-bold text-amber-100 uppercase tracking-widest mt-1">
                                Configurable Grace Period Threshold (Req 5.3)
                            </DialogDescription>
                        </div>
                    </div>

                    <div className="p-8 space-y-5">
                        <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/60 text-[10px] text-amber-950 leading-relaxed">
                            <p className="font-bold">Threshold Calculation Logic:</p>
                            <p className="text-slate-600 text-[10px] mt-0.5">
                                Employees punching in up to <strong>{tempLateThreshold} minutes</strong> ({Math.round((tempLateThreshold / 60) * 10) / 10} hours) after their shift start time are treated within grace. Any punch beyond this threshold is automatically categorized as <strong>Late</strong>.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Select Standard Grace Buffer</Label>
                            <div className="grid grid-cols-3 gap-2">
                                {[15, 30, 45, 60, 90, 120].map((mins) => (
                                    <Button
                                        key={mins}
                                        type="button"
                                        variant="outline"
                                        onClick={() => setTempLateThreshold(mins)}
                                        className={cn(
                                            "h-11 rounded-xl font-black text-xs transition-all",
                                            tempLateThreshold === mins
                                                ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                                                : "bg-slate-50 border-slate-100 text-slate-700 hover:bg-slate-100"
                                        )}
                                    >
                                        {mins} mins {mins === 60 ? "(1 hr)" : mins === 120 ? "(2 hrs)" : ""}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Custom Threshold (Minutes)</Label>
                            <Input
                                type="number"
                                min={0}
                                max={360}
                                value={tempLateThreshold}
                                onChange={(e) => setTempLateThreshold(Math.max(0, parseInt(e.target.value) || 0))}
                                className="h-11 rounded-xl bg-slate-50 border-none font-bold text-xs"
                            />
                            <p className="text-[8px] font-bold text-slate-400 ml-1">Company standard: 60 minutes (1 hour) grace window</p>
                        </div>
                    </div>

                    <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">
                            Current: {lateThresholdMinutes} mins
                        </span>
                        <div className="flex gap-3">
                            <Button variant="ghost" onClick={() => setIsLateThresholdOpen(false)} className="text-[9px] font-black uppercase tracking-widest text-slate-500 rounded-xl hover:bg-slate-200">Cancel</Button>
                            <Button
                                onClick={() => handleUpdateLateThreshold(tempLateThreshold)}
                                disabled={lateThresholdSaving}
                                className="bg-slate-900 hover:bg-black text-[#D9F99D] font-black uppercase text-[9px] tracking-widest rounded-xl px-6 shadow-md transition-all disabled:opacity-50"
                            >
                                {lateThresholdSaving ? "Saving..." : "Save Late Rule"}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Mark Tour Dialog */}
            <Dialog open={isTourOpen} onOpenChange={setIsTourOpen}>
                <DialogContent className="sm:max-w-[480px] rounded-[2rem] p-0 overflow-hidden bg-white border-none shadow-2xl">
                    <div className="bg-slate-900 p-8 text-center relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-6 opacity-10">
                            <Plane className="h-24 w-24 text-white" />
                        </div>
                        <div className="relative z-10 flex flex-col items-center">
                            <div className="h-14 w-14 bg-white/10 rounded-2xl flex items-center justify-center mb-4">
                                <Plane className="h-7 w-7 text-violet-300" />
                            </div>
                            <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter text-white">Mark Tour</DialogTitle>
                            <DialogDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">
                                Auto-mark attendance as Tour for date range
                            </DialogDescription>
                        </div>
                    </div>

                    <div className="p-8 space-y-5 max-h-[55vh] overflow-y-auto">
                        <div className="space-y-2">
                            <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Employee ID</Label>
                            <Input
                                placeholder="e.g. EMP005"
                                value={tourEmpId}
                                onChange={(e) => setTourEmpId(e.target.value)}
                                className="h-12 rounded-xl bg-slate-50 border-none font-bold text-xs uppercase"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Tour Title</Label>
                            <Input
                                placeholder="e.g. Client Visit - Mumbai"
                                value={tourTitle}
                                onChange={(e) => setTourTitle(e.target.value)}
                                className="h-12 rounded-xl bg-slate-50 border-none font-bold text-xs"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400">From Location</Label>
                                <Input
                                    placeholder="e.g. Delhi"
                                    value={tourFromLocation}
                                    onChange={(e) => setTourFromLocation(e.target.value)}
                                    className="h-12 rounded-xl bg-slate-50 border-none font-bold text-xs"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400">To Location</Label>
                                <Input
                                    placeholder="e.g. Mumbai"
                                    value={tourToLocation}
                                    onChange={(e) => setTourToLocation(e.target.value)}
                                    className="h-12 rounded-xl bg-slate-50 border-none font-bold text-xs"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Start Date</Label>
                                <Input
                                    type="date"
                                    value={tourStartDate}
                                    onChange={(e) => setTourStartDate(e.target.value)}
                                    className="h-12 rounded-xl bg-slate-50 border-none font-bold text-xs uppercase"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400">End Date</Label>
                                <Input
                                    type="date"
                                    value={tourEndDate}
                                    onChange={(e) => setTourEndDate(e.target.value)}
                                    className="h-12 rounded-xl bg-slate-50 border-none font-bold text-xs uppercase"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Description (Optional)</Label>
                            <textarea
                                placeholder="Tour purpose & details..."
                                value={tourDescription}
                                onChange={(e) => setTourDescription(e.target.value)}
                                className="w-full h-20 p-4 rounded-xl bg-slate-50 border-none font-bold text-xs resize-none outline-none focus:ring-2 ring-violet-100"
                            />
                        </div>
                    </div>

                    <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                            <Info className="h-3 w-3" /> Tour days = Paid
                        </span>
                        <div className="flex gap-3">
                            <Button variant="ghost" onClick={() => setIsTourOpen(false)} className="text-[9px] font-black uppercase tracking-widest text-slate-500 rounded-xl hover:bg-slate-200">Cancel</Button>
                            <Button onClick={handleTourSubmit} disabled={tourSubmitting} className="bg-violet-600 hover:bg-violet-700 text-white font-black uppercase text-[9px] tracking-widest rounded-xl px-6 shadow-md transition-all hover:translate-y-[-2px] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0">
                                {tourSubmitting ? (
                                    <span className="flex items-center gap-2">
                                        <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                        Submitting...
                                    </span>
                                ) : (
                                    "Mark Tour"
                                )}
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
