"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import { apiGet, apiPut } from "@/lib/api-client";
import {
    MapPin,
    ArrowLeft,
    Users,
    Activity,
    Building2,
    Timer,
    Navigation,
    User,
    Phone,
    AlertCircle,
    TrendingUp,
    Smartphone,
    Loader2,
    Target,
    Pencil,
    ShieldCheck,
    ShieldOff,
    ExternalLink,
    Search,
    CheckCircle2,
    X,
    Sparkles,
    Calendar,
    Clock,
    RefreshCw,
    Copy,
    Check,
    Layers,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
    Sheet,
    SheetClose,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

const GeoFenceMap = dynamic(() => import("@/components/GeoFenceMap"), {
    ssr: false,
    loading: () => (
        <div className="w-full h-full flex items-center justify-center bg-slate-100">
            <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 border-2 border-slate-300 border-t-indigo-600 rounded-full animate-spin" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Loading geo-fence map…
                </span>
            </div>
        </div>
    ),
});

const LocationPickerMap = dynamic(() => import("@/components/LocationPickerMap"), {
    ssr: false,
    loading: () => (
        <div className="w-full h-[320px] flex items-center justify-center bg-slate-100 rounded-2xl border border-slate-200">
            <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 border-2 border-slate-300 border-t-indigo-600 rounded-full animate-spin" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Loading map…
                </span>
            </div>
        </div>
    ),
});

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

interface OfficeDetail {
    id: number;
    company_id: number | null;
    code: string | null;
    name: string;
    address: string | null;
    city: string | null;
    state: string | null;
    latitude: number;
    longitude: number;
    radius_meters: number;
    contact_person: string | null;
    contact_phone: string | null;
    is_active: boolean;
    createdAt?: string;
    updatedAt?: string;
    company?: { id: number; name: string; code?: string } | null;
    employee_count?: number;
    active_employee_count?: number;
}

interface LiveLogEntry {
    id: string; // emp_code
    name: string;
    designation: string;
    department?: string;
    status: "Present" | "Late" | "Absent" | "Half Day";
    punchIn: string | null;
    device: string;
    checkInLat: number | null;
    checkInLon: number | null;
    profileImage: string | null;
}

interface LiveAttendanceData {
    rows: LiveLogEntry[];
    stats: {
        total: number;
        present: number;
        absent: number;
        late: number;
    };
}

interface BranchEmployee {
    id: number;
    emp_code: string;
    name: string;
    email: string | null;
    phone: string | null;
    designation: string | null;
    department: string | null;
    status: string;
    shift_start_time: string | null;
    shift_end_time: string | null;
    weekly_off_days: any;
    date_of_joining: string | null;
}

const RADIUS_PRESETS = [
    { value: "25", label: "25m (Compact Biometric / Small Room)" },
    { value: "50", label: "50m (Standard Corporate Office / Floor)" },
    { value: "100", label: "100m (Commercial Building / Multi-floor)" },
    { value: "150", label: "150m (Office Campus / Complex)" },
    { value: "200", label: "200m (Standard Depot / Branch Facility)" },
    { value: "250", label: "250m (Distribution Center / Warehouse)" },
    { value: "300", label: "300m (Large Logistics Hub / Depot)" },
    { value: "500", label: "500m (Expansive Industrial Yard)" },
];

function getInitials(name: string): string {
    return name
        .split(" ")
        .map((w) => w[0])
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase();
}

function formatTime(time: string | null): string {
    if (!time || time === "---") return "---";
    try {
        const [h, m] = time.split(":").map(Number);
        const ampm = h >= 12 ? "PM" : "AM";
        const dh = h % 12 || 12;
        return `${String(dh).padStart(2, "0")}:${String(m).padStart(2, "0")} ${ampm}`;
    } catch {
        return time;
    }
}

// ──────────────────────────────────────────────────────────────
// Page Component
// ──────────────────────────────────────────────────────────────

export default function LocationDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { user } = useAuth();
    const id = params.id as string;

    const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

    // Main States
    const [office, setOffice] = useState<OfficeDetail | null>(null);
    const [liveData, setLiveData] = useState<LiveAttendanceData | null>(null);
    const [branchStaff, setBranchStaff] = useState<BranchEmployee[]>([]);
    const [loading, setLoading] = useState(true);
    const [liveLoading, setLiveLoading] = useState(true);
    const [staffLoading, setStaffLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Active workspace tab: "live" | "staff" | "specs"
    const [activeTab, setActiveTab] = useState<"live" | "staff" | "specs">("live");

    // Live Attendance Table filter
    const [liveStatusFilter, setLiveStatusFilter] = useState<"all" | "present" | "late" | "absent">("all");

    // Staff Directory search
    const [staffSearch, setStaffSearch] = useState("");

    // Geo-Fence Visualizer Dialog
    const [geoFenceModalOpen, setGeoFenceModalOpen] = useState(false);

    // Copy to clipboard indicator
    const [copiedCode, setCopiedCode] = useState(false);

    // Edit sheet state
    const [editSheetOpen, setEditSheetOpen] = useState(false);
    const [editForm, setEditForm] = useState<Record<string, string>>({});
    const [editSaving, setEditSaving] = useState(false);
    const [editErrors, setEditErrors] = useState<Record<string, string>>({});
    const [generatingCode, setGeneratingCode] = useState(false);
    const [fetchingLocation, setFetchingLocation] = useState(false);

    // Toast message
    const [toast, setToast] = useState<{ text: string; variant: "success" | "error" } | null>(null);

    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(() => setToast(null), 3500);
        return () => clearTimeout(t);
    }, [toast]);

    // ── Fetch Office Details ──────────────────────────────────
    const fetchOffice = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await apiGet<OfficeDetail>(`/offices/${id}`);
            setOffice(data);
        } catch (err: any) {
            const msg = err?.response?.data?.message || err?.message || "Failed to load branch location";
            setError(msg);
        } finally {
            setLoading(false);
        }
    }, [id]);

    // ── Fetch Live Attendance Strictly for THIS Branch ────────
    const fetchLiveAttendance = useCallback(async () => {
        if (!id) return;
        setLiveLoading(true);
        try {
            // Note: must pass office_id so it only pulls employees assigned to this office!
            const data = await apiGet<LiveAttendanceData>(
                `/attendance/admin/live?office_id=${id}&limit=100`
            );
            setLiveData(data);
        } catch {
            setLiveData(null);
        } finally {
            setLiveLoading(false);
        }
    }, [id]);

    // ── Fetch Branch Assigned Staff Directory ─────────────────
    const fetchBranchStaff = useCallback(async () => {
        if (!id) return;
        setStaffLoading(true);
        try {
            const res = await apiGet<{ data: BranchEmployee[] } | BranchEmployee[]>(
                `/employees?office_id=${id}&limit=100`
            );
            const staffList = Array.isArray(res) ? res : (res as any)?.data || [];
            setBranchStaff(staffList);
        } catch {
            setBranchStaff([]);
        } finally {
            setStaffLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetchOffice();
        fetchLiveAttendance();
        fetchBranchStaff();
    }, [fetchOffice, fetchLiveAttendance, fetchBranchStaff]);

    // ── Copy Code to Clipboard ────────────────────────────────
    const handleCopyCode = () => {
        if (!office?.code) return;
        navigator.clipboard.writeText(office.code);
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
        setToast({ text: `Copied branch code: ${office.code}`, variant: "success" });
    };

    // ── Edit Sheet Form Handlers ──────────────────────────────
    const openEditSheet = () => {
        if (!office) return;
        setEditForm({
            name: office.name || "",
            code: office.code || "",
            company_id: office.company_id ? String(office.company_id) : "",
            city: office.city || "",
            state: office.state || "",
            address: office.address || "",
            latitude: String(office.latitude || ""),
            longitude: String(office.longitude || ""),
            radius_meters: String(office.radius_meters || "50"),
            contact_person: office.contact_person || "",
            contact_phone: office.contact_phone || "",
            is_active: office.is_active ? "true" : "false",
        });
        setEditErrors({});
        setEditSheetOpen(true);
    };

    const handleAutoGenerateCode = async () => {
        if (!office?.company_id && !editForm.company_id) return;
        setGeneratingCode(true);
        try {
            const cId = editForm.company_id || office?.company_id;
            const res = await apiGet<{ code: string }>(
                `/offices/generate-code?company_id=${cId}&city=${encodeURIComponent(editForm.city || "")}&name=${encodeURIComponent(editForm.name || "")}`
            );
            if (res?.code) {
                setEditForm((prev) => ({ ...prev, code: res.code }));
                setToast({ text: `Generated code: ${res.code}`, variant: "success" });
            }
        } catch {
            setToast({ text: "Could not generate code", variant: "error" });
        } finally {
            setGeneratingCode(false);
        }
    };

    const handleGetCurrentLocation = () => {
        if (!navigator.geolocation) {
            setToast({ text: "Geolocation is not supported by your browser", variant: "error" });
            return;
        }
        setFetchingLocation(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const lat = pos.coords.latitude.toFixed(6);
                const lng = pos.coords.longitude.toFixed(6);
                setEditForm((prev) => ({ ...prev, latitude: lat, longitude: lng }));
                setToast({ text: `Captured GPS: ${lat}, ${lng}`, variant: "success" });
                setFetchingLocation(false);
            },
            () => {
                setFetchingLocation(false);
                setToast({ text: "Location permission denied or timed out", variant: "error" });
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

    const handleSaveEdit = async () => {
        const errs: Record<string, string> = {};
        if (!editForm.name?.trim()) errs.name = "Branch name is required";
        if (!editForm.latitude || isNaN(Number(editForm.latitude))) errs.latitude = "Valid latitude required";
        if (!editForm.longitude || isNaN(Number(editForm.longitude))) errs.longitude = "Valid longitude required";

        if (Object.keys(errs).length > 0) {
            setEditErrors(errs);
            return;
        }

        setEditSaving(true);
        try {
            const payload = {
                name: editForm.name.trim(),
                code: editForm.code?.trim() ? editForm.code.trim().toUpperCase() : null,
                address: editForm.address?.trim() || null,
                city: editForm.city?.trim() || null,
                state: editForm.state?.trim() || null,
                latitude: Number(editForm.latitude),
                longitude: Number(editForm.longitude),
                radius_meters: Number(editForm.radius_meters || 50),
                contact_person: editForm.contact_person?.trim() || null,
                contact_phone: editForm.contact_phone?.trim() || null,
                is_active: editForm.is_active === "true",
            };

            await apiPut(`/offices/${id}`, payload);
            setToast({ text: "Branch configuration updated successfully", variant: "success" });
            setEditSheetOpen(false);
            await fetchOffice();
            await fetchLiveAttendance();
        } catch (err: any) {
            const msg = err?.response?.data?.message || err?.message || "Failed to update branch";
            setToast({ text: msg, variant: "error" });
        } finally {
            setEditSaving(false);
        }
    };

    // ── Filtered Live Attendance Rows ─────────────────────────
    const filteredLiveRows = useMemo(() => {
        if (!liveData?.rows) return [];
        if (liveStatusFilter === "all") return liveData.rows;
        if (liveStatusFilter === "present") return liveData.rows.filter((r) => r.status === "Present");
        if (liveStatusFilter === "late") return liveData.rows.filter((r) => r.status === "Late");
        if (liveStatusFilter === "absent") return liveData.rows.filter((r) => r.status === "Absent");
        return liveData.rows;
    }, [liveData, liveStatusFilter]);

    // ── Filtered Branch Staff Directory ───────────────────────
    const filteredStaff = useMemo(() => {
        if (!branchStaff) return [];
        if (!staffSearch.trim()) return branchStaff;
        const q = staffSearch.toLowerCase();
        return branchStaff.filter(
            (e) =>
                e.name.toLowerCase().includes(q) ||
                e.emp_code.toLowerCase().includes(q) ||
                (e.department && e.department.toLowerCase().includes(q)) ||
                (e.designation && e.designation.toLowerCase().includes(q))
        );
    }, [branchStaff, staffSearch]);

    // ── Derived Metrics ───────────────────────────────────────
    const activeStaffCount = office?.active_employee_count ?? office?.employee_count ?? branchStaff.length;
    const presentCount = liveData?.stats?.present ?? 0;
    const lateCount = liveData?.stats?.late ?? 0;
    const absentCount = liveData?.stats?.absent ?? Math.max(0, activeStaffCount - presentCount);
    const totalTodayRoster = liveData?.stats?.total ?? activeStaffCount;
    const attendancePct = totalTodayRoster > 0 ? Math.round((presentCount / totalTodayRoster) * 100) : 0;

    // ── Loading & Error States ────────────────────────────────
    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-36 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    Loading branch command hub…
                </span>
            </div>
        );
    }

    if (error || !office) {
        return (
            <div className="flex flex-col items-center justify-center py-32 space-y-4">
                <div className="h-14 w-14 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-500">
                    <AlertCircle className="h-7 w-7" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">{error || "Branch Location Not Found"}</h3>
                <p className="text-xs text-slate-400">The requested branch node does not exist or was deleted.</p>
                <Button
                    variant="outline"
                    onClick={() => router.push("/locations")}
                    className="rounded-xl h-10 text-xs font-bold"
                >
                    <ArrowLeft className="h-4 w-4 mr-2" /> Back to Locations Hub
                </Button>
            </div>
        );
    }

    return (
        <ProtectedRoute module="LOCATIONS" action="READ">
            <div className="space-y-6 pb-24 animate-in fade-in duration-300">
                {/* ── Toast Notification ─────────────────────── */}
                {toast && (
                    <div
                        className={cn(
                            "fixed top-6 right-6 z-[9999] px-4 py-3 rounded-2xl shadow-2xl text-xs font-bold flex items-center gap-2.5 animate-in slide-in-from-right-4 border",
                            toast.variant === "success"
                                ? "bg-slate-900 text-white border-slate-700"
                                : "bg-red-50 text-red-700 border-red-200"
                        )}
                    >
                        {toast.variant === "success" ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                        ) : (
                            <ShieldOff className="h-4 w-4 text-red-500 shrink-0" />
                        )}
                        <span>{toast.text}</span>
                        <button onClick={() => setToast(null)} className="ml-2 hover:opacity-75">
                            <X className="h-3.5 w-3.5" />
                        </button>
                    </div>
                )}

                {/* ── Top Navigation & Breadcrumb ────────────── */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-1">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                            <button
                                type="button"
                                onClick={() => router.push("/locations")}
                                className="hover:text-indigo-600 transition-colors flex items-center gap-1 cursor-pointer"
                            >
                                <ArrowLeft className="h-3.5 w-3.5" />
                                <span>Locations</span>
                            </button>
                            <span>/</span>
                            <span className="text-slate-600 font-bold">{office.company?.name || "Corporate"}</span>
                            <span>/</span>
                            <span className="text-slate-900 font-bold">{office.name}</span>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 pt-1">
                            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                                {office.name}
                            </h1>

                            {/* Location Code Pill with Click-to-Copy */}
                            <button
                                type="button"
                                onClick={handleCopyCode}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100/80 border border-indigo-200 text-indigo-800 text-xs font-mono font-bold transition-all cursor-pointer shadow-2xs"
                                title="Click to copy location code"
                            >
                                <span>ID: {office.code || `LOC-${office.id}`}</span>
                                {copiedCode ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3 text-indigo-400" />}
                            </button>

                            {/* Status Badge */}
                            <span
                                className={cn(
                                    "px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                                    office.is_active
                                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                        : "bg-slate-100 text-slate-500 border border-slate-200"
                                )}
                            >
                                {office.is_active ? "Operational" : "Suspended"}
                            </span>
                        </div>
                    </div>

                    {/* Quick Action Toolbar */}
                    <div className="flex items-center gap-2 self-start lg:self-auto">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                fetchOffice();
                                fetchLiveAttendance();
                                fetchBranchStaff();
                                setToast({ text: "Branch biometric muster synchronized", variant: "success" });
                            }}
                            className="h-9 px-3 rounded-xl border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 shadow-2xs"
                        >
                            <RefreshCw className={cn("h-3.5 w-3.5 text-slate-500", liveLoading && "animate-spin")} />
                            <span>Sync Muster</span>
                        </Button>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setGeoFenceModalOpen(true)}
                            className="h-9 px-3.5 rounded-xl border-indigo-200 bg-indigo-50/60 hover:bg-indigo-100 text-xs font-bold text-indigo-700 flex items-center gap-1.5 shadow-2xs"
                        >
                            <Target className="h-3.5 w-3.5 text-indigo-600" />
                            <span>Perimeter Map</span>
                        </Button>

                        {isAdmin && (
                            <Button
                                size="sm"
                                onClick={openEditSheet}
                                className="h-9 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-bold text-white flex items-center gap-1.5 shadow-xs"
                            >
                                <Pencil className="h-3.5 w-3.5" />
                                <span>Edit Branch</span>
                            </Button>
                        )}
                    </div>
                </div>

                {/* ── Key Operational Metrics Bar ─────────────── */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                    {/* Active Staff Assigned */}
                    <Card className="border border-slate-200/80 bg-white rounded-2xl p-4 shadow-xs">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                Assigned Staff
                            </span>
                            <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                                <Users className="h-4 w-4" />
                            </div>
                        </div>
                        <div className="mt-3 flex items-baseline gap-2">
                            <span className="text-2xl font-black text-slate-900">{activeStaffCount}</span>
                            <span className="text-[11px] text-slate-500 font-medium">Employees at Node</span>
                        </div>
                    </Card>

                    {/* Today's Attendance Rate */}
                    <Card className="border border-slate-200/80 bg-white rounded-2xl p-4 shadow-xs">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                Today Attendance
                            </span>
                            <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                                <Activity className="h-4 w-4" />
                            </div>
                        </div>
                        <div className="mt-3 flex items-baseline gap-2">
                            <span className="text-2xl font-black text-emerald-600">{presentCount} / {totalTodayRoster}</span>
                            <span className="text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded">
                                {attendancePct}% Present
                            </span>
                        </div>
                    </Card>

                    {/* Geo-Fence Radius */}
                    <Card className="border border-slate-200/80 bg-white rounded-2xl p-4 shadow-xs">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                Geo-Fence Radius
                            </span>
                            <div className="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                                <Target className="h-4 w-4" />
                            </div>
                        </div>
                        <div className="mt-3 flex items-baseline gap-2">
                            <span className="text-2xl font-black text-indigo-600">{office.radius_meters}m</span>
                            <span className="text-[11px] text-slate-500 font-medium">
                                {office.radius_meters <= 50 ? "Strict Office" : office.radius_meters <= 200 ? "Standard Facility" : "Logistics Hub"}
                            </span>
                        </div>
                    </Card>

                    {/* Site Manager / Contact */}
                    <Card className="border border-slate-200/80 bg-white rounded-2xl p-4 shadow-xs">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                Site In-Charge
                            </span>
                            <div className="h-8 w-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
                                <User className="h-4 w-4" />
                            </div>
                        </div>
                        <div className="mt-2.5">
                            <div className="text-sm font-bold text-slate-900 truncate">
                                {office.contact_person || "Operations Lead"}
                            </div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                                <Phone className="h-3 w-3 text-slate-400 shrink-0" />
                                {office.contact_phone ? (
                                    <a href={`tel:${office.contact_phone}`} className="hover:text-indigo-600 hover:underline">
                                        {office.contact_phone}
                                    </a>
                                ) : (
                                    <span>No direct line</span>
                                )}
                            </div>
                        </div>
                    </Card>
                </div>

                {/* ── Interactive Geo-Fence Perimeter Card ─────── */}
                <Card className="border border-slate-200/90 bg-white rounded-3xl shadow-xs overflow-hidden">
                    <div className="p-5 bg-slate-50/70 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-xl bg-indigo-100/70 text-indigo-700 flex items-center justify-center">
                                <Navigation className="h-4 w-4" />
                            </div>
                            <div>
                                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                                    Physical Geo-Fence Boundary & GPS Coordinates
                                </h3>
                                <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                                    Center: {Number(office.latitude).toFixed(6)}, {Number(office.longitude).toFixed(6)} • Perimeter: {office.radius_meters}m
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 self-start sm:self-auto">
                            <a
                                href={`https://www.google.com/maps?q=${office.latitude},${office.longitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="h-8 px-3 rounded-xl border border-slate-200 hover:bg-white text-xs font-bold text-slate-700 inline-flex items-center gap-1.5 shadow-2xs transition-colors"
                            >
                                <ExternalLink className="h-3.5 w-3.5 text-slate-500" />
                                <span>Satellite View</span>
                            </a>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setGeoFenceModalOpen(true)}
                                className="h-8 px-3 rounded-xl border-indigo-200 bg-white hover:bg-indigo-50 text-xs font-bold text-indigo-700"
                            >
                                Full Screen
                            </Button>
                        </div>
                    </div>

                    <div className="w-full h-[260px] bg-slate-100 relative">
                        <GeoFenceMap
                            latitude={Number(office.latitude)}
                            longitude={Number(office.longitude)}
                            radius={Number(office.radius_meters)}
                            officeName={office.name}
                        />
                    </div>
                </Card>

                {/* ── Workspace Tabs: Live Muster vs Staff Directory vs Specs ── */}
                <div className="space-y-4">
                    {/* Tab Navigation Pill Bar */}
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setActiveTab("live")}
                                className={cn(
                                    "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer",
                                    activeTab === "live"
                                        ? "bg-slate-900 text-white shadow-xs"
                                        : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                                )}
                            >
                                <Activity className="h-3.5 w-3.5 text-emerald-400" />
                                <span>Today's Live Attendance ({presentCount}/{totalTodayRoster})</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setActiveTab("staff")}
                                className={cn(
                                    "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer",
                                    activeTab === "staff"
                                        ? "bg-slate-900 text-white shadow-xs"
                                        : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                                )}
                            >
                                <Users className="h-3.5 w-3.5 text-indigo-400" />
                                <span>Branch Staff Directory ({branchStaff.length})</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setActiveTab("specs")}
                                className={cn(
                                    "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer",
                                    activeTab === "specs"
                                        ? "bg-slate-900 text-white shadow-xs"
                                        : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                                )}
                            >
                                <Layers className="h-3.5 w-3.5 text-amber-400" />
                                <span>Node Specifications</span>
                            </button>
                        </div>

                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push("/attendance")}
                            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50"
                        >
                            Open Monthly Muster Grid <ExternalLink className="h-3 w-3 ml-1" />
                        </Button>
                    </div>

                    {/* ══════════════════════════════════════════════════════
                       TAB 1: TODAY'S LIVE ATTENDANCE MUSTER
                       ══════════════════════════════════════════════════════ */}
                    {activeTab === "live" && (
                        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
                            {/* Live Attendance Filter Pills */}
                            <div className="p-4 bg-slate-50/70 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
                                <div className="flex items-center gap-1.5">
                                    <button
                                        type="button"
                                        onClick={() => setLiveStatusFilter("all")}
                                        className={cn(
                                            "px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer",
                                            liveStatusFilter === "all"
                                                ? "bg-white text-slate-900 border border-slate-300 shadow-2xs"
                                                : "text-slate-500 hover:text-slate-800"
                                        )}
                                    >
                                        All Staff ({totalTodayRoster})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setLiveStatusFilter("present")}
                                        className={cn(
                                            "px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer",
                                            liveStatusFilter === "present"
                                                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                                : "text-slate-500 hover:text-emerald-700"
                                        )}
                                    >
                                        Present ({presentCount})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setLiveStatusFilter("late")}
                                        className={cn(
                                            "px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer",
                                            liveStatusFilter === "late"
                                                ? "bg-amber-50 text-amber-800 border border-amber-200"
                                                : "text-slate-500 hover:text-amber-700"
                                        )}
                                    >
                                        Late ({lateCount})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setLiveStatusFilter("absent")}
                                        className={cn(
                                            "px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer",
                                            liveStatusFilter === "absent"
                                                ? "bg-rose-50 text-rose-800 border border-rose-200"
                                                : "text-slate-500 hover:text-rose-700"
                                        )}
                                    >
                                        Absent / Pending ({absentCount})
                                    </button>
                                </div>

                                <span className="text-[11px] text-slate-400 font-medium">
                                    Showing live biometric logs strictly for {office.name}
                                </span>
                            </div>

                            {/* Table */}
                            {liveLoading ? (
                                <div className="flex items-center justify-center py-16">
                                    <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
                                </div>
                            ) : filteredLiveRows.length === 0 ? (
                                <div className="py-16 text-center text-xs text-slate-400">
                                    No employees match the selected status filter for today.
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-slate-50/50 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                            <tr>
                                                <th className="py-3 px-5">Employee</th>
                                                <th className="py-3 px-5">Designation & Dept</th>
                                                <th className="py-3 px-5">Clock-In Time</th>
                                                <th className="py-3 px-5">Punch Device</th>
                                                <th className="py-3 px-5">Geo-Fence Compliance</th>
                                                <th className="py-3 px-5 text-center">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {filteredLiveRows.map((log) => (
                                                <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                                                    {/* Employee Avatar + Name + Code */}
                                                    <td className="py-3.5 px-5">
                                                        <div className="flex items-center gap-3">
                                                            <Avatar className="h-8 w-8 rounded-lg bg-slate-900 text-white shrink-0">
                                                                <AvatarFallback className="text-[9px] font-bold bg-slate-900 text-white">
                                                                    {getInitials(log.name)}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                            <div>
                                                                <span className="font-bold text-slate-900 block">{log.name}</span>
                                                                <span className="text-[10px] font-mono text-slate-400">{log.id}</span>
                                                            </div>
                                                        </div>
                                                    </td>

                                                    {/* Designation */}
                                                    <td className="py-3.5 px-5">
                                                        <span className="text-slate-800 font-medium block">
                                                            {log.designation || "Staff"}
                                                        </span>
                                                        {log.department && (
                                                            <span className="text-[10px] text-slate-400 font-medium">
                                                                {log.department}
                                                            </span>
                                                        )}
                                                    </td>

                                                    {/* Clock-In */}
                                                    <td className="py-3.5 px-5">
                                                        <div className="flex items-center gap-1.5 font-mono text-slate-700 font-semibold">
                                                            <Timer className="h-3 w-3 text-slate-400" />
                                                            <span>{formatTime(log.punchIn)}</span>
                                                        </div>
                                                    </td>

                                                    {/* Punch Device */}
                                                    <td className="py-3.5 px-5">
                                                        <div className="flex items-center gap-1.5 text-slate-600">
                                                            <Smartphone className="h-3 w-3 text-slate-400" />
                                                            <span>{log.device || "Mobile Biometric"}</span>
                                                        </div>
                                                    </td>

                                                    {/* Geo-Fence Compliance */}
                                                    <td className="py-3.5 px-5">
                                                        {log.status === "Present" || log.status === "Late" ? (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                                <CheckCircle2 className="h-3 w-3" />
                                                                Verified (Within {office.radius_meters}m)
                                                            </span>
                                                        ) : (
                                                            <span className="text-[10px] text-slate-400 font-medium">
                                                                Awaiting punch
                                                            </span>
                                                        )}
                                                    </td>

                                                    {/* Status Badge */}
                                                    <td className="py-3.5 px-5 text-center">
                                                        <span
                                                            className={cn(
                                                                "px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase",
                                                                log.status === "Present"
                                                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                                                    : log.status === "Late"
                                                                    ? "bg-amber-50 text-amber-700 border border-amber-200"
                                                                    : "bg-rose-50 text-rose-700 border border-rose-200"
                                                            )}
                                                        >
                                                            {log.status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ══════════════════════════════════════════════════════
                       TAB 2: BRANCH ASSIGNED STAFF DIRECTORY
                       ══════════════════════════════════════════════════════ */}
                    {activeTab === "staff" && (
                        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
                            {/* Search bar inside staff tab */}
                            <div className="p-4 bg-slate-50/70 border-b border-slate-200/80 flex items-center justify-between gap-3">
                                <div className="relative w-72">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                                    <Input
                                        placeholder="Search assigned staff by name or code…"
                                        value={staffSearch}
                                        onChange={(e) => setStaffSearch(e.target.value)}
                                        className="h-9 pl-9 pr-8 text-xs bg-white rounded-xl border-slate-200"
                                    />
                                </div>
                                <span className="text-xs text-slate-500 font-medium">
                                    Total {branchStaff.length} employees officially assigned to {office.name}
                                </span>
                            </div>

                            {staffLoading ? (
                                <div className="flex items-center justify-center py-16">
                                    <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
                                </div>
                            ) : filteredStaff.length === 0 ? (
                                <div className="py-16 text-center text-xs text-slate-400">
                                    No employees found for this search.
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-slate-50/50 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                            <tr>
                                                <th className="py-3 px-5">Employee</th>
                                                <th className="py-3 px-5">Department & Role</th>
                                                <th className="py-3 px-5">Configured Shift</th>
                                                <th className="py-3 px-5">Designated Weekly Off</th>
                                                <th className="py-3 px-5">Contact Details</th>
                                                <th className="py-3 px-5 text-right">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {filteredStaff.map((emp) => {
                                                const offs = Array.isArray(emp.weekly_off_days)
                                                    ? (emp.weekly_off_days.length > 0 ? emp.weekly_off_days.join(", ") : "0 Offs (7d)")
                                                    : "Sunday";
                                                const shiftStr = emp.shift_start_time && emp.shift_end_time
                                                    ? `${emp.shift_start_time.slice(0, 5)} - ${emp.shift_end_time.slice(0, 5)}`
                                                    : "09:30 - 18:30";

                                                return (
                                                    <tr key={emp.id} className="hover:bg-slate-50/70 transition-colors">
                                                        <td className="py-3.5 px-5">
                                                            <div className="flex items-center gap-3">
                                                                <Avatar className="h-8 w-8 rounded-lg bg-slate-900 text-white shrink-0">
                                                                    <AvatarFallback className="text-[9px] font-bold bg-slate-900 text-white">
                                                                        {getInitials(emp.name)}
                                                                    </AvatarFallback>
                                                                </Avatar>
                                                                <div>
                                                                    <span className="font-bold text-slate-900 block">{emp.name}</span>
                                                                    <span className="text-[10px] font-mono text-slate-400">{emp.emp_code}</span>
                                                                </div>
                                                            </div>
                                                        </td>

                                                        <td className="py-3.5 px-5">
                                                            <span className="font-semibold text-slate-800 block">
                                                                {emp.designation || "Staff"}
                                                            </span>
                                                            <span className="text-[10px] text-slate-400 font-medium">
                                                                {emp.department || "General"}
                                                            </span>
                                                        </td>

                                                        <td className="py-3.5 px-5">
                                                            <div className="flex items-center gap-1.5 font-mono text-slate-700 font-medium">
                                                                <Clock className="h-3 w-3 text-slate-400" />
                                                                <span>{shiftStr}</span>
                                                            </div>
                                                        </td>

                                                        <td className="py-3.5 px-5">
                                                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                                                                {offs}
                                                            </span>
                                                        </td>

                                                        <td className="py-3.5 px-5">
                                                            <span className="text-slate-600 block">{emp.phone || "---"}</span>
                                                            <span className="text-[10px] text-slate-400">{emp.email || "---"}</span>
                                                        </td>

                                                        <td className="py-3.5 px-5 text-right">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => router.push(`/employees/${emp.id}`)}
                                                                className="h-7 px-2.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50"
                                                            >
                                                                View Profile
                                                            </Button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ══════════════════════════════════════════════════════
                       TAB 3: NODE SPECIFICATIONS & GEO-FENCE RULES
                       ══════════════════════════════════════════════════════ */}
                    {activeTab === "specs" && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            {/* Physical & Technical Specs Card */}
                            <Card className="border border-slate-200/90 bg-white rounded-3xl p-6 shadow-xs space-y-4">
                                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                                    <Building2 className="h-4 w-4 text-indigo-600" />
                                    Branch Infrastructure & Address
                                </h3>

                                <div className="space-y-3 divide-y divide-slate-100 text-xs">
                                    <div className="pt-2 flex justify-between">
                                        <span className="text-slate-400 font-medium">Official Branch Name</span>
                                        <span className="font-bold text-slate-900">{office.name}</span>
                                    </div>
                                    <div className="pt-2 flex justify-between">
                                        <span className="text-slate-400 font-medium">Location ID Code</span>
                                        <span className="font-mono font-bold text-indigo-700">{office.code || `LOC-${office.id}`}</span>
                                    </div>
                                    <div className="pt-2 flex justify-between">
                                        <span className="text-slate-400 font-medium">Parent Corporate Entity</span>
                                        <span className="font-bold text-slate-900">{office.company?.name || "Unassigned"}</span>
                                    </div>
                                    <div className="pt-2 flex justify-between">
                                        <span className="text-slate-400 font-medium">Registered Address</span>
                                        <span className="font-medium text-slate-700 text-right max-w-[240px]">
                                            {office.address || "12/3, MG Road, Vijay Nagar"}
                                        </span>
                                    </div>
                                    <div className="pt-2 flex justify-between">
                                        <span className="text-slate-400 font-medium">City & State</span>
                                        <span className="font-bold text-slate-800">
                                            {[office.city, office.state].filter(Boolean).join(", ")}
                                        </span>
                                    </div>
                                    <div className="pt-2 flex justify-between">
                                        <span className="text-slate-400 font-medium">Site Supervisor</span>
                                        <span className="font-bold text-slate-800">
                                            {office.contact_person || "Not assigned"} ({office.contact_phone || "No phone"})
                                        </span>
                                    </div>
                                </div>
                            </Card>

                            {/* Geo-fence Enforcement Parameters */}
                            <Card className="border border-slate-200/90 bg-white rounded-3xl p-6 shadow-xs space-y-4">
                                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                                    <Target className="h-4 w-4 text-emerald-600" />
                                    Biometric & Geo-Fence Rules
                                </h3>

                                <div className="space-y-3 divide-y divide-slate-100 text-xs">
                                    <div className="pt-2 flex justify-between">
                                        <span className="text-slate-400 font-medium">GPS Latitude</span>
                                        <span className="font-mono font-bold text-slate-900">{Number(office.latitude).toFixed(6)}</span>
                                    </div>
                                    <div className="pt-2 flex justify-between">
                                        <span className="text-slate-400 font-medium">GPS Longitude</span>
                                        <span className="font-mono font-bold text-slate-900">{Number(office.longitude).toFixed(6)}</span>
                                    </div>
                                    <div className="pt-2 flex justify-between">
                                        <span className="text-slate-400 font-medium">Max Allowed Distance</span>
                                        <span className="font-bold text-indigo-700">{office.radius_meters} meters</span>
                                    </div>
                                    <div className="pt-2 flex justify-between">
                                        <span className="text-slate-400 font-medium">Validation Algorithm</span>
                                        <span className="font-medium text-slate-700">Haversine Great-Circle Formula</span>
                                    </div>
                                    <div className="pt-2 flex justify-between">
                                        <span className="text-slate-400 font-medium">Biometric Punch Enforcement</span>
                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700">
                                            Strict Hardware & Mobile GPS
                                        </span>
                                    </div>
                                    <div className="pt-2 flex justify-between">
                                        <span className="text-slate-400 font-medium">Node Operational Status</span>
                                        <span className="font-bold text-emerald-600">
                                            {office.is_active ? "🟢 Active & Punching Allowed" : "🔴 Inactive"}
                                        </span>
                                    </div>
                                </div>
                            </Card>
                        </div>
                    )}
                </div>

                {/* ── Geo-Fence Modal Dialog ──────────────────── */}
                <Dialog open={geoFenceModalOpen} onOpenChange={setGeoFenceModalOpen}>
                    <DialogContent className="sm:max-w-[700px] border-none shadow-2xl rounded-3xl p-0 overflow-hidden">
                        <DialogHeader className="p-5 bg-slate-50 border-b border-slate-100 flex-shrink-0">
                            <div className="flex items-center justify-between">
                                <div>
                                    <DialogTitle className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                                        <Target className="h-4 w-4 text-indigo-600" />
                                        Perimeter Visualizer — {office.name}
                                    </DialogTitle>
                                    <DialogDescription className="text-xs text-slate-500 mt-0.5">
                                        Exact biometric radius: {office.radius_meters}m • Code: {office.code || `LOC-${office.id}`}
                                    </DialogDescription>
                                </div>
                                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                    {office.radius_meters}m Radius
                                </span>
                            </div>
                        </DialogHeader>

                        <div className="w-full h-[400px] bg-slate-100">
                            <GeoFenceMap
                                latitude={Number(office.latitude)}
                                longitude={Number(office.longitude)}
                                radius={Number(office.radius_meters)}
                                officeName={office.name}
                            />
                        </div>

                        <div className="p-4 bg-white flex items-center justify-between border-t border-slate-100">
                            <div className="text-xs font-mono text-slate-500">
                                Lat: {Number(office.latitude).toFixed(6)} • Lng: {Number(office.longitude).toFixed(6)}
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setGeoFenceModalOpen(false)}
                                className="h-8 px-3 rounded-xl text-xs font-bold text-slate-600"
                            >
                                Close
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* ── Quick Edit Branch Sheet ─────────────────── */}
                <Sheet open={editSheetOpen} onOpenChange={setEditSheetOpen}>
                    <SheetContent className="sm:max-w-[540px] border-none shadow-2xl p-0 overflow-y-auto">
                        <div className="p-7 space-y-6">
                            <SheetHeader className="text-left space-y-1">
                                <SheetTitle className="text-lg font-black text-slate-900 tracking-tight">
                                    Edit Branch Configuration
                                </SheetTitle>
                                <SheetDescription className="text-xs text-slate-500">
                                    Update branch name, unique code, site in-charge & GPS geo-fence perimeter
                                </SheetDescription>
                            </SheetHeader>

                            <div className="space-y-4 pt-1">
                                {/* Branch Name */}
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-bold text-slate-700">
                                        Branch Name <span className="text-rose-500">*</span>
                                    </Label>
                                    <Input
                                        value={editForm.name || ""}
                                        onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                                        placeholder="e.g. BP Marketing — Indore HQ"
                                        className="rounded-xl border-slate-200 h-10 text-xs"
                                    />
                                    {editErrors.name && (
                                        <p className="text-[11px] font-semibold text-rose-500">{editErrors.name}</p>
                                    )}
                                </div>

                                {/* Unique Location Code */}
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-xs font-bold text-slate-700">
                                            Unique Location ID / Code
                                        </Label>
                                        <button
                                            type="button"
                                            onClick={handleAutoGenerateCode}
                                            disabled={generatingCode}
                                            className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                                        >
                                            <Sparkles className={cn("h-3 w-3", generatingCode && "animate-spin")} />
                                            <span>{generatingCode ? "Generating…" : "Auto-Generate"}</span>
                                        </button>
                                    </div>
                                    <Input
                                        value={editForm.code || ""}
                                        onChange={(e) => setEditForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
                                        placeholder="e.g. BPM-IND"
                                        className="rounded-xl border-slate-200 h-10 text-xs font-mono font-bold uppercase"
                                    />
                                </div>

                                {/* City & State */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-bold text-slate-700">City</Label>
                                        <Input
                                            value={editForm.city || ""}
                                            onChange={(e) => setEditForm((prev) => ({ ...prev, city: e.target.value }))}
                                            placeholder="City"
                                            className="rounded-xl border-slate-200 h-10 text-xs"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-bold text-slate-700">State</Label>
                                        <Input
                                            value={editForm.state || ""}
                                            onChange={(e) => setEditForm((prev) => ({ ...prev, state: e.target.value }))}
                                            placeholder="State"
                                            className="rounded-xl border-slate-200 h-10 text-xs"
                                        />
                                    </div>
                                </div>

                                {/* Address */}
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-bold text-slate-700">Full Address</Label>
                                    <Input
                                        value={editForm.address || ""}
                                        onChange={(e) => setEditForm((prev) => ({ ...prev, address: e.target.value }))}
                                        placeholder="Street / Facility Address"
                                        className="rounded-xl border-slate-200 h-10 text-xs"
                                    />
                                </div>

                                {/* GPS Coordinates & Radius */}
                                <div className="pt-2 border-t border-slate-100 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                                            <Target className="h-3.5 w-3.5 text-indigo-600" />
                                            GPS & Radius Calibration
                                        </Label>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            disabled={fetchingLocation}
                                            onClick={handleGetCurrentLocation}
                                            className="h-7 px-2.5 rounded-lg border-indigo-200 bg-indigo-50/50 text-indigo-700 text-[10px] font-bold"
                                        >
                                            {fetchingLocation ? "Capturing…" : "Get My GPS"}
                                        </Button>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <Label className="text-[11px] font-bold text-slate-600">Latitude</Label>
                                            <Input
                                                type="number"
                                                step="any"
                                                value={editForm.latitude || ""}
                                                onChange={(e) => setEditForm((prev) => ({ ...prev, latitude: e.target.value }))}
                                                className="rounded-xl border-slate-200 h-9 text-xs font-mono"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[11px] font-bold text-slate-600">Longitude</Label>
                                            <Input
                                                type="number"
                                                step="any"
                                                value={editForm.longitude || ""}
                                                onChange={(e) => setEditForm((prev) => ({ ...prev, longitude: e.target.value }))}
                                                className="rounded-xl border-slate-200 h-9 text-xs font-mono"
                                            />
                                        </div>
                                    </div>

                                    {/* Map Pin Adjuster */}
                                    <div className="space-y-1">
                                        <LocationPickerMap
                                            initialLat={Number(editForm.latitude) || 22.7196}
                                            initialLng={Number(editForm.longitude) || 75.8577}
                                            radius={Number(editForm.radius_meters) || 50}
                                            onChange={(lat: number, lng: number) => {
                                                setEditForm((prev) => ({
                                                    ...prev,
                                                    latitude: String(lat),
                                                    longitude: String(lng),
                                                }));
                                            }}
                                        />
                                    </div>

                                    {/* Geo-fence Radius Select */}
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-bold text-slate-700">Radius Preset</Label>
                                        <Select
                                            value={editForm.radius_meters || "50"}
                                            onValueChange={(v) => setEditForm((prev) => ({ ...prev, radius_meters: v }))}
                                        >
                                            <SelectTrigger className="rounded-xl border-slate-200 h-10 text-xs">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                                                {RADIUS_PRESETS.map((p) => (
                                                    <SelectItem key={p.value} value={p.value}>
                                                        {p.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                {/* Site In-Charge Contact */}
                                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                                    <div className="space-y-1">
                                        <Label className="text-xs font-bold text-slate-700">Contact Person</Label>
                                        <Input
                                            value={editForm.contact_person || ""}
                                            onChange={(e) => setEditForm((prev) => ({ ...prev, contact_person: e.target.value }))}
                                            placeholder="Site Manager"
                                            className="rounded-xl border-slate-200 h-10 text-xs"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs font-bold text-slate-700">Phone</Label>
                                        <Input
                                            value={editForm.contact_phone || ""}
                                            onChange={(e) => setEditForm((prev) => ({ ...prev, contact_phone: e.target.value }))}
                                            placeholder="+91-XXXXX XXXXX"
                                            className="rounded-xl border-slate-200 h-10 text-xs"
                                        />
                                    </div>
                                </div>

                                {/* Status */}
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-bold text-slate-700">Status</Label>
                                    <Select
                                        value={editForm.is_active || "true"}
                                        onValueChange={(v) => setEditForm((prev) => ({ ...prev, is_active: v }))}
                                    >
                                        <SelectTrigger className="rounded-xl border-slate-200 h-10 text-xs">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                                            <SelectItem value="true">Active (Accepting Punches)</SelectItem>
                                            <SelectItem value="false">Inactive (Suspended)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <SheetFooter className="flex flex-col sm:flex-row gap-2.5 pt-4 border-t border-slate-100">
                                <SheetClose asChild>
                                    <Button variant="ghost" className="rounded-xl h-10 text-slate-600 font-bold text-xs">
                                        Cancel
                                    </Button>
                                </SheetClose>
                                <Button
                                    onClick={handleSaveEdit}
                                    disabled={editSaving}
                                    className="flex-1 h-10 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-sm"
                                >
                                    {editSaving ? "Saving Changes…" : "Update Branch"}
                                </Button>
                            </SheetFooter>
                        </div>
                    </SheetContent>
                </Sheet>
            </div>
        </ProtectedRoute>
    );
}
