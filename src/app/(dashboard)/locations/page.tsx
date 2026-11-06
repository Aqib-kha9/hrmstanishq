"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import {
    apiGet,
    apiPost,
    apiPut,
    apiDelete,
    apiGetPaginated,
} from "@/lib/api-client";
import {
    Search,
    Plus,
    MapPin,
    Building2,
    Users,
    MapPinned,
    Target,
    Phone,
    User,
    ShieldCheck,
    ShieldOff,
    Pencil,
    Trash2,
    ChevronLeft,
    ChevronRight,
    Loader2,
    X,
    Filter,
    Navigation,
    ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    SheetTrigger,
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
    DialogFooter,
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
                    Loading map…
                </span>
            </div>
        </div>
    ),
});

const LocationPickerMap = dynamic(() => import("@/components/LocationPickerMap"), {
    ssr: false,
    loading: () => (
        <div className="w-full h-[360px] flex items-center justify-center bg-slate-100 rounded-2xl border border-slate-200">
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

interface CompanyRecord {
    id: number;
    name: string;
    address: string | null;
    is_active: boolean;
}

interface OfficeRecord {
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
    company?: CompanyRecord | null;
    employee_count?: number;
}

interface OfficeStats {
    total_offices: number;
    active_offices: number;
    inactive_offices: number;
    total_employees: number;
    per_office: Array<{
        office_id: number;
        office_name: string;
        employee_count: number;
    }>;
}

interface PaginationMeta {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
}

// ──────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────

const PAGE_SIZE = 9;

const EMPTY_FORM: Record<string, string> = {
    company_id: "",
    code: "",
    name: "",
    address: "",
    city: "",
    state: "",
    latitude: "",
    longitude: "",
    radius_meters: "50",
    contact_person: "",
    contact_phone: "",
    is_active: "true",
};

const RADIUS_OPTIONS = [
    { value: "10", label: "10 meters" },
    { value: "20", label: "20 meters" },
    { value: "30", label: "30 meters" },
    { value: "40", label: "40 meters" },
    { value: "50", label: "50 meters (Default)" },
    { value: "60", label: "60 meters" },
    { value: "70", label: "70 meters" },
    { value: "80", label: "80 meters" },
    { value: "90", label: "90 meters" },
    { value: "100", label: "100 meters (Max)" },
];

// ──────────────────────────────────────────────────────────────
// Helper
// ──────────────────────────────────────────────────────────────

function getInitials(name: string): string {
    return name
        .split(" ")
        .map((w) => w[0])
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase();
}

function getCityColor(city: string): string {
    const map: Record<string, string> = {
        Mumbai: "bg-blue-50 text-blue-700",
        Bangalore: "bg-violet-50 text-violet-700",
        Bengaluru: "bg-violet-50 text-violet-700",
        Pune: "bg-amber-50 text-amber-700",
        Gurgaon: "bg-rose-50 text-rose-700",
        Gurugram: "bg-rose-50 text-rose-700",
    };
    return map[city] || "bg-slate-50 text-slate-700";
}

// ──────────────────────────────────────────────────────────────
// Toast helper (no library — inline state)
// ──────────────────────────────────────────────────────────────

interface ToastMsg {
    text: string;
    variant: "success" | "error";
}

// ──────────────────────────────────────────────────────────────
// Page Component
// ──────────────────────────────────────────────────────────────

export default function LocationsPage() {
    const router = useRouter();
    const { user } = useAuth();

    const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
    const canDelete = user?.role === "SUPER_ADMIN";

    // ── State ────────────────────────────────────────────────

    const [offices, setOffices] = useState<OfficeRecord[]>([]);
    const [stats, setStats] = useState<OfficeStats | null>(null);
    const [companies, setCompanies] = useState<CompanyRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [statsLoading, setStatsLoading] = useState(true);

    // Pagination
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState<PaginationMeta>({
        total: 0,
        page: 1,
        limit: PAGE_SIZE,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
    });

    // Filters
    const [search, setSearch] = useState("");
    const [companyFilter, setCompanyFilter] = useState("all");
    const [cityFilter, setCityFilter] = useState("all");
    const [statusFilter, setStatusFilter] = useState("all");

    // Sheet (create / edit)
    const [sheetOpen, setSheetOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [form, setForm] = useState<Record<string, string>>({ ...EMPTY_FORM });
    const [saving, setSaving] = useState(false);
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});

    // Delete dialog
    const [deleteTarget, setDeleteTarget] = useState<OfficeRecord | null>(null);
    const [deleting, setDeleting] = useState(false);

    // Geo-fence map dialog
    const [geoFenceTarget, setGeoFenceTarget] = useState<OfficeRecord | null>(null);

    // GPS location fetching
    const [fetchingLocation, setFetchingLocation] = useState(false);

    // ── Company management state ────────────────────────────
    const [companySheetOpen, setCompanySheetOpen] = useState(false);
    const [companyForm, setCompanyForm] = useState({ name: "", email: "", phone: "", website: "", city: "", state: "", address: "" });
    const [companyEditingId, setCompanyEditingId] = useState<number | null>(null);
    const [companySaving, setCompanySaving] = useState(false);
    const [companyDeleteTarget, setCompanyDeleteTarget] = useState<CompanyRecord | null>(null);
    const [companyDeleting, setCompanyDeleting] = useState(false);

    // Toast
    const [toast, setToast] = useState<ToastMsg | null>(null);

    // ── Toast auto-dismiss ────────────────────────────────────

    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(() => setToast(null), 3500);
        return () => clearTimeout(t);
    }, [toast]);

    // ── Fetch stats ───────────────────────────────────────────

    const fetchStats = useCallback(async () => {
        setStatsLoading(true);
        try {
            const data = await apiGet<OfficeStats>("/offices/stats");
            setStats(data);
        } catch {
            // stats fail silently — not critical
        } finally {
            setStatsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    // ── Fetch offices ─────────────────────────────────────────

    const fetchOffices = useCallback(async () => {
        setLoading(true);
        try {
            const params: Record<string, unknown> = {
                page,
                limit: PAGE_SIZE,
            };
            if (search.trim()) params.search = search.trim();
            if (companyFilter !== "all") params.company_id = Number(companyFilter);
            if (cityFilter !== "all") params.city = cityFilter;
            if (statusFilter !== "all") {
                params.is_active = statusFilter === "active";
            }

            const result = await apiGetPaginated<OfficeRecord>("/offices", params);
            setOffices(result.data);
            setPagination(result.pagination);
        } catch {
            setOffices([]);
        } finally {
            setLoading(false);
        }
    }, [page, search, companyFilter, cityFilter, statusFilter]);

    useEffect(() => {
        fetchOffices();
    }, [fetchOffices]);

    // Reset to page 1 when filters change
    useEffect(() => {
        setPage(1);
    }, [search, companyFilter, cityFilter, statusFilter]);

    // ── Form handlers ─────────────────────────────────────────

    const openCreateSheet = () => {
        setEditingId(null);
        setForm({ ...EMPTY_FORM });
        setFormErrors({});
        setSheetOpen(true);
    };

    const openEditSheet = (office: OfficeRecord) => {
        setEditingId(office.id);
        setForm({
            company_id: office.company_id != null ? String(office.company_id) : "",
            code: office.code || "",
            name: office.name,
            address: office.address || "",
            city: office.city || "",
            state: office.state || "",
            latitude: String(office.latitude),
            longitude: String(office.longitude),
            radius_meters: String(office.radius_meters),
            contact_person: office.contact_person || "",
            contact_phone: office.contact_phone || "",
            is_active: office.is_active ? "true" : "false",
        });
        setFormErrors({});
        setSheetOpen(true);
    };

    const updateForm = (key: string, value: string) => {
        setForm((prev) => ({ ...prev, [key]: value }));
        // clear error on change
        setFormErrors((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
    };

    const getCurrentLocation = () => {
        if (!navigator.geolocation) {
            setToast({ text: "Geolocation is not supported by your browser", variant: "error" });
            return;
        }
        setFetchingLocation(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const lat = pos.coords.latitude.toFixed(6);
                const lng = pos.coords.longitude.toFixed(6);
                setForm((prev) => ({
                    ...prev,
                    latitude: lat,
                    longitude: lng,
                }));
                setFormErrors((prev) => {
                    const next = { ...prev };
                    delete next.latitude;
                    delete next.longitude;
                    return next;
                });
                // Warn: browser geolocation on laptops/desktops without GPS hardware
                // uses IP geolocation or Wi-Fi triangulation, which can be inaccurate.
                setToast({
                    text: `Captured: ${parseFloat(lat).toFixed(4)}, ${parseFloat(lng).toFixed(4)} — ⚠️ Verify on a GPS device if this seems incorrect.`,
                    variant: "success",
                });
                setFetchingLocation(false);
            },
            (err) => {
                setFetchingLocation(false);
                let msg = "Failed to get location";
                if (err.code === 1) msg = "Location permission denied. Please allow location access.";
                else if (err.code === 2) msg = "Location unavailable. Check your device settings.";
                else if (err.code === 3) msg = "Location request timed out. Try again.";
                setToast({ text: msg, variant: "error" });
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    };

    const validateForm = (): boolean => {
        const errs: Record<string, string> = {};

        if (!editingId && !form.company_id) errs.company_id = "Company is required";
        if (!form.code?.trim()) errs.code = "Location code is required";
        if (!form.name?.trim()) errs.name = "Name is required";
        if (!form.latitude || isNaN(Number(form.latitude))) errs.latitude = "Valid latitude required";
        if (!form.longitude || isNaN(Number(form.longitude))) errs.longitude = "Valid longitude required";
        if (!form.radius_meters || Number(form.radius_meters) < 10 || Number(form.radius_meters) > 100) {
            errs.radius_meters = "Radius must be 10–100 meters";
        }

        const lat = Number(form.latitude);
        const lng = Number(form.longitude);
        if (lat < -90 || lat > 90) errs.latitude = "Latitude must be -90 to 90";
        if (lng < -180 || lng > 180) errs.longitude = "Longitude must be -180 to 180";

        setFormErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleSave = async () => {
        if (!validateForm()) return;

        setSaving(true);
        try {
            const payload = {
                company_id: form.company_id ? Number(form.company_id) : null,
                code: form.code?.trim() || null,
                name: form.name.trim(),
                address: form.address?.trim() || null,
                city: form.city?.trim() || null,
                state: form.state?.trim() || null,
                latitude: Number(form.latitude),
                longitude: Number(form.longitude),
                radius_meters: Number(form.radius_meters),
                contact_person: form.contact_person?.trim() || null,
                contact_phone: form.contact_phone?.trim() || null,
                is_active: form.is_active === "true",
            };

            if (editingId) {
                await apiPut(`/offices/${editingId}`, payload);
                setToast({ text: "Location updated successfully", variant: "success" });
            } else {
                await apiPost("/offices", payload);
                setToast({ text: "Location created successfully", variant: "success" });
            }

            setSheetOpen(false);
            await fetchOffices();
            await fetchStats();
        } catch (err: any) {
            const msg =
                err?.response?.data?.message ||
                err?.message ||
                "Something went wrong";
            setToast({ text: msg, variant: "error" });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await apiDelete(`/offices/${deleteTarget.id}`);
            setToast({ text: "Location deleted successfully", variant: "success" });
            setDeleteTarget(null);
            await fetchOffices();
            await fetchStats();
        } catch (err: any) {
            const msg =
                err?.response?.data?.message ||
                err?.message ||
                "Failed to delete location";
            setToast({ text: msg, variant: "error" });
            setDeleteTarget(null);
        } finally {
            setDeleting(false);
        }
    };

    // ── Company management handlers ───────────────────────────

    const fetchCompanies = useCallback(async () => {
        try {
            const data = await apiGet<CompanyRecord[]>("/companies");
            setCompanies(data);
        } catch { }
    }, []);

    const openCompanyCreateSheet = () => {
        setCompanyEditingId(null);
        setCompanyForm({ name: "", email: "", phone: "", website: "", city: "", state: "", address: "" });
        setCompanySheetOpen(true);
    };

    const openCompanyEditSheet = (company: any) => {
        setCompanyEditingId(company.id);
        setCompanyForm({ 
            name: company.name, 
            email: company.email || "",
            phone: company.phone || "",
            website: company.website || "",
            city: company.city || "",
            state: company.state || "",
            address: company.address || "" 
        });
        setCompanySheetOpen(true);
    };

    const handleCompanySave = async () => {
        if (!companyForm.name?.trim()) {
            setToast({ text: "Company name is required", variant: "error" });
            return;
        }
        setCompanySaving(true);
        try {
            const payload = {
                name: companyForm.name.trim(),
                email: companyForm.email?.trim() || null,
                phone: companyForm.phone?.trim() || null,
                website: companyForm.website?.trim() || null,
                city: companyForm.city?.trim() || null,
                state: companyForm.state?.trim() || null,
                address: companyForm.address?.trim() || null,
            };

            if (companyEditingId) {
                await apiPut(`/companies/${companyEditingId}`, payload);
                setToast({ text: "Company updated successfully", variant: "success" });
            } else {
                await apiPost("/companies", payload);
                setToast({ text: "Company created successfully", variant: "success" });
            }
            setCompanySheetOpen(false);
            await fetchCompanies();
            await fetchOffices();
        } catch (err: any) {
            const msg = err?.response?.data?.message || err?.message || "Something went wrong";
            setToast({ text: msg, variant: "error" });
        } finally {
            setCompanySaving(false);
        }
    };

    const handleCompanyDelete = async () => {
        if (!companyDeleteTarget) return;
        setCompanyDeleting(true);
        try {
            await apiDelete(`/companies/${companyDeleteTarget.id}`);
            setToast({ text: "Company deleted successfully", variant: "success" });
            setCompanyDeleteTarget(null);
            await fetchCompanies();
            await fetchOffices();
            await fetchStats();
        } catch (err: any) {
            const msg = err?.response?.data?.message || err?.message || "Failed to delete company";
            setToast({ text: msg, variant: "error" });
            setCompanyDeleteTarget(null);
        } finally {
            setCompanyDeleting(false);
        }
    };

    // ── Fetch companies on mount ───────────────────────────────

    useEffect(() => {
        fetchCompanies();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Derived stats ─────────────────────────────────────────

    const statCards = [
        {
            label: "Total Locations",
            value: statsLoading ? "…" : stats?.total_offices ?? 0,
            icon: MapPinned,
            color: "indigo",
        },
        {
            label: "Active Locations",
            value: statsLoading ? "…" : stats?.active_offices ?? 0,
            icon: ShieldCheck,
            color: "emerald",
        },
        {
            label: "Total Employees",
            value: statsLoading ? "…" : stats?.total_employees ?? 0,
            icon: Users,
            color: "blue",
        },
        {
            label: "Inactive",
            value: statsLoading ? "…" : stats?.inactive_offices ?? 0,
            icon: ShieldOff,
            color: "rose",
        },
    ];

    // ── Render ────────────────────────────────────────────────

    return (
        <ProtectedRoute module="LOCATIONS" action="READ">
        <div className="space-y-8 pb-20 animate-in fade-in duration-500">
            {/* ── Toast ─────────────────────────────────────── */}
            {toast && (
                <div
                    className={cn(
                        "fixed top-6 right-6 z-[9999] px-5 py-3 rounded-2xl shadow-xl text-sm font-bold flex items-center gap-2 animate-in slide-in-from-right-4",
                        toast.variant === "success"
                            ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                            : "bg-red-50 text-red-700 border border-red-200"
                    )}
                >
                    <span>{toast.text}</span>
                    <button
                        onClick={() => setToast(null)}
                        className="ml-3 hover:opacity-70"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            )}

            {/* ── Header ───────────────────────────────────── */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-2 pt-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 italic uppercase tracking-tighter underline underline-offset-8 decoration-[#D9F99D] decoration-4">
                        Locations & Geo-Fence
                    </h1>
                    <p className="text-[10px] font-bold text-slate-400 mt-4 uppercase tracking-[0.2em]">
                        Manage branches, assign companies & configure geo-fencing radius
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    {isAdmin && (
                        <Button
                            variant="outline"
                            onClick={openCompanyCreateSheet}
                            className="border-slate-200 text-slate-600 hover:bg-slate-50 font-black uppercase text-[10px] tracking-widest px-6 h-12 rounded-xl shadow-sm transition-all flex items-center gap-2"
                        >
                            <Building2 className="h-4 w-4" />
                            Manage Companies
                        </Button>
                    )}
                    {isAdmin && (
                        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                            <SheetTrigger asChild>
                                <Button
                                    onClick={openCreateSheet}
                                    className="bg-slate-900 text-white hover:bg-black font-black uppercase text-[10px] tracking-widest px-8 h-12 rounded-xl shadow-lg transition-all flex items-center gap-3"
                                >
                                    <Plus className="h-5 w-5 stroke-[3]" /> Add Location
                                </Button>
                            </SheetTrigger>

                            {/* ── Create / Edit Sheet ──────────── */}
                            <SheetContent className="sm:max-w-[560px] border-none shadow-2xl p-0 overflow-y-auto">
                                <div className="p-8 space-y-10">
                                    <SheetHeader className="text-left space-y-2">
                                        <SheetTitle className="text-lg font-black text-slate-900 uppercase italic tracking-tighter">
                                            {editingId ? "Edit Location" : "New Location"}
                                        </SheetTitle>
                                        <SheetDescription className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                            {editingId
                                                ? "Update branch details & geo-fence settings"
                                                : "Add a company branch with geo-fencing configuration"}
                                        </SheetDescription>
                                    </SheetHeader>

                                    <div className="space-y-5">
                                        {/* Company */}
                                        {!editingId && (
                                            <div className="space-y-2">
                                                <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                                    Company <span className="text-red-400">*</span>
                                                </Label>
                                                <Select
                                                    value={form.company_id}
                                                    onValueChange={(v) => updateForm("company_id", v)}
                                                >
                                                    <SelectTrigger
                                                        className={cn(
                                                            "rounded-xl border-slate-200 h-11 text-sm",
                                                            formErrors.company_id && "border-red-400 bg-red-50"
                                                        )}
                                                    >
                                                        <SelectValue placeholder="Select company" />
                                                    </SelectTrigger>
                                                    <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                                                        {companies.map((c) => (
                                                            <SelectItem key={c.id} value={String(c.id)}>
                                                                {c.name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                {formErrors.company_id && (
                                                    <p className="text-[10px] font-bold text-red-500">{formErrors.company_id}</p>
                                                )}
                                            </div>
                                        )}

                                        {/* Code + Name row */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                                    Code <span className="text-red-400">*</span>
                                                </Label>
                                                <Input
                                                    value={form.code}
                                                    onChange={(e) => updateForm("code", e.target.value)}
                                                    placeholder="e.g. LOC-MUM"
                                                    className={cn(
                                                        "rounded-xl border-slate-200 h-11 text-sm",
                                                        formErrors.code && "border-red-400 bg-red-50"
                                                    )}
                                                />
                                                {formErrors.code && (
                                                    <p className="text-[10px] font-bold text-red-500">{formErrors.code}</p>
                                                )}
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                                    Name <span className="text-red-400">*</span>
                                                </Label>
                                                <Input
                                                    value={form.name}
                                                    onChange={(e) => updateForm("name", e.target.value)}
                                                    placeholder="Branch name"
                                                    className={cn(
                                                        "rounded-xl border-slate-200 h-11 text-sm",
                                                        formErrors.name && "border-red-400 bg-red-50"
                                                    )}
                                                />
                                                {formErrors.name && (
                                                    <p className="text-[10px] font-bold text-red-500">{formErrors.name}</p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Address */}
                                        <div className="space-y-2">
                                            <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                                Address
                                            </Label>
                                            <Input
                                                value={form.address}
                                                onChange={(e) => updateForm("address", e.target.value)}
                                                placeholder="Full address"
                                                className="rounded-xl border-slate-200 h-11 text-sm"
                                            />
                                        </div>

                                        {/* City + State */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                                    City
                                                </Label>
                                                <Input
                                                    value={form.city}
                                                    onChange={(e) => updateForm("city", e.target.value)}
                                                    placeholder="City"
                                                    className="rounded-xl border-slate-200 h-11 text-sm"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                                    State
                                                </Label>
                                                <Input
                                                    value={form.state}
                                                    onChange={(e) => updateForm("state", e.target.value)}
                                                    placeholder="State"
                                                    className="rounded-xl border-slate-200 h-11 text-sm"
                                                />
                                            </div>
                                        </div>

                                        {/* Geo-fence: Lat / Long */}
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            disabled={fetchingLocation}
                                            onClick={getCurrentLocation}
                                            className="w-full h-9 rounded-xl border-indigo-200 bg-indigo-50/50 text-indigo-600 hover:bg-indigo-100 hover:text-indigo-700 text-[10px] font-black uppercase tracking-widest mb-1"
                                        >
                                            {fetchingLocation ? (
                                                <>
                                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                    Capturing…
                                                </>
                                            ) : (
                                                <>
                                                    <Navigation className="h-3.5 w-3.5" />
                                                    Get Current Location
                                                </>
                                            )}
                                        </Button>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                                    Latitude <span className="text-red-400">*</span>
                                                </Label>
                                                <Input
                                                    type="number"
                                                    step="any"
                                                    value={form.latitude}
                                                    onChange={(e) => updateForm("latitude", e.target.value)}
                                                    placeholder="22.7196"
                                                    className={cn(
                                                        "rounded-xl border-slate-200 h-11 text-sm",
                                                        formErrors.latitude && "border-red-400 bg-red-50"
                                                    )}
                                                />
                                                {formErrors.latitude && (
                                                    <p className="text-[10px] font-bold text-red-500">{formErrors.latitude}</p>
                                                )}
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                                    Longitude <span className="text-red-400">*</span>
                                                </Label>
                                                <Input
                                                    type="number"
                                                    step="any"
                                                    value={form.longitude}
                                                    onChange={(e) => updateForm("longitude", e.target.value)}
                                                    placeholder="75.8577"
                                                    className={cn(
                                                        "rounded-xl border-slate-200 h-11 text-sm",
                                                        formErrors.longitude && "border-red-400 bg-red-50"
                                                    )}
                                                />
                                                {formErrors.longitude && (
                                                    <p className="text-[10px] font-bold text-red-500">{formErrors.longitude}</p>
                                                )}
                                            </div>
                                        </div>

                                        {/* ── Interactive Map for pin-pointing ── */}
                                        <div className="space-y-3">
                                            <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                                📍 Pin the Office Location
                                            </Label>
                                            <LocationPickerMap
                                                initialLat={
                                                    isNaN(Number(form.latitude))
                                                        ? 22.7196
                                                        : Number(form.latitude)
                                                }
                                                initialLng={
                                                    isNaN(Number(form.longitude))
                                                        ? 75.8577
                                                        : Number(form.longitude)
                                                }
                                                radius={
                                                    isNaN(Number(form.radius_meters))
                                                        ? 50
                                                        : Number(form.radius_meters)
                                                }
                                                onChange={(lat: number, lng: number) => {
                                                    setForm((prev) => ({
                                                        ...prev,
                                                        latitude: String(lat),
                                                        longitude: String(lng),
                                                    }));
                                                    setFormErrors((prev) => {
                                                        const next = { ...prev };
                                                        delete next.latitude;
                                                        delete next.longitude;
                                                        return next;
                                                    });
                                                }}
                                            />
                                            <p className="text-[9px] text-slate-400 leading-relaxed">
                                                Drag the pin or click anywhere on the map to set the exact geo-fence center coordinates.
                                            </p>
                                        </div>

                                        {/* Radius */}
                                        <div className="space-y-2">
                                            <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                                Geo-Fence Radius <span className="text-red-400">*</span>
                                            </Label>
                                            <Select
                                                value={form.radius_meters}
                                                onValueChange={(v) => updateForm("radius_meters", v)}
                                            >
                                                <SelectTrigger
                                                    className={cn(
                                                        "rounded-xl border-slate-200 h-11 text-sm",
                                                        formErrors.radius_meters && "border-red-400 bg-red-50"
                                                    )}
                                                >
                                                    <SelectValue placeholder="Select radius" />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                                                    {RADIUS_OPTIONS.map((o) => (
                                                        <SelectItem key={o.value} value={o.value}>
                                                            {o.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            {formErrors.radius_meters && (
                                                <p className="text-[10px] font-bold text-red-500">
                                                    {formErrors.radius_meters}
                                                </p>
                                            )}
                                        </div>

                                        {/* Contact Person + Phone */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                                    Contact Person
                                                </Label>
                                                <Input
                                                    value={form.contact_person}
                                                    onChange={(e) => updateForm("contact_person", e.target.value)}
                                                    placeholder="Manager name"
                                                    className="rounded-xl border-slate-200 h-11 text-sm"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                                    Contact Phone
                                                </Label>
                                                <Input
                                                    value={form.contact_phone}
                                                    onChange={(e) => updateForm("contact_phone", e.target.value)}
                                                    placeholder="+91 9876543210"
                                                    className="rounded-xl border-slate-200 h-11 text-sm"
                                                />
                                            </div>
                                        </div>

                                        {/* Active toggle */}
                                        <div className="space-y-2">
                                            <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                                Status
                                            </Label>
                                            <Select
                                                value={form.is_active}
                                                onValueChange={(v) => updateForm("is_active", v)}
                                            >
                                                <SelectTrigger className="rounded-xl border-slate-200 h-11 text-sm">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                                                    <SelectItem value="true">Active</SelectItem>
                                                    <SelectItem value="false">Inactive</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    <SheetFooter className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-slate-50">
                                        <SheetClose asChild>
                                            <Button
                                                variant="ghost"
                                                className="rounded-2xl h-11 text-slate-600 font-black text-[9px] uppercase tracking-widest"
                                            >
                                                Cancel
                                            </Button>
                                        </SheetClose>
                                        <Button
                                            onClick={handleSave}
                                            disabled={saving}
                                            className="flex-1 h-11 rounded-2xl bg-slate-900 text-white font-black uppercase text-[9px] tracking-widest shadow-lg transition-all hover:translate-y-[-2px] disabled:opacity-50"
                                        >
                                            {saving ? (
                                                <span className="flex items-center gap-2">
                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                    Saving…
                                                </span>
                                            ) : editingId ? (
                                                "Update Location"
                                            ) : (
                                                "Create Location"
                                            )}
                                        </Button>
                                    </SheetFooter>
                                </div>
                            </SheetContent>
                        </Sheet>
                    )}
                </div>
            </div>

            {/* ── Stats ────────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {statCards.map((stat, i) => {
                    const Icon = stat.icon;
                    return (
                        <Card
                            key={i}
                            className="border-none bg-white rounded-2xl p-5 shadow-sm flex flex-col justify-between min-h-[9rem] gap-4 group hover:shadow-md transition-all"
                        >
                            <div className="flex items-center justify-between">
                                <div
                                    className={cn(
                                        "h-10 w-10 rounded-xl flex items-center justify-center",
                                        stat.color === "indigo" && "bg-indigo-50",
                                        stat.color === "emerald" && "bg-emerald-50",
                                        stat.color === "blue" && "bg-blue-50",
                                        stat.color === "rose" && "bg-rose-50"
                                    )}
                                >
                                    <Icon
                                        className={cn(
                                            "h-5 w-5",
                                            stat.color === "indigo" && "text-indigo-600",
                                            stat.color === "emerald" && "text-emerald-600",
                                            stat.color === "blue" && "text-blue-600",
                                            stat.color === "rose" && "text-rose-600"
                                        )}
                                    />
                                </div>
                            </div>
                            <div className="min-w-0">
                                <p className="text-3xl font-black text-slate-900 tracking-tight truncate">
                                    {stat.value}
                                </p>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest truncate">
                                    {stat.label}
                                </p>
                            </div>
                        </Card>
                    );
                })}
            </div>

            {/* ── Filters + Search ────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center px-2">
                {/* Search */}
                <div className="lg:col-span-5 relative group">
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 group-focus-within:text-slate-900 transition-colors" />
                    <Input
                        placeholder="Search location name, code, or city…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full bg-white border-slate-100 pl-14 h-14 rounded-2xl font-bold text-xs shadow-sm focus-visible:ring-1 focus-visible:ring-[#D9F99D]"
                    />
                    {search && (
                        <button
                            onClick={() => setSearch("")}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>

                {/* Company filter */}
                <div className="lg:col-span-2 flex items-center gap-2 bg-white px-3 h-14 rounded-2xl border border-slate-100 shadow-sm">
                    <Building2 className="h-4 w-4 text-slate-300 shrink-0" />
                    <select
                        value={companyFilter}
                        onChange={(e) => setCompanyFilter(e.target.value)}
                        className="bg-transparent border-none text-[10px] font-black uppercase text-slate-500 outline-none w-full cursor-pointer"
                    >
                        <option value="all">All Companies</option>
                        {companies.map((c) => (
                            <option key={c.id} value={String(c.id)}>
                                {c.name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* City filter */}
                <div className="lg:col-span-2 flex items-center gap-2 bg-white px-3 h-14 rounded-2xl border border-slate-100 shadow-sm">
                    <MapPin className="h-4 w-4 text-slate-300 shrink-0" />
                    <select
                        value={cityFilter}
                        onChange={(e) => setCityFilter(e.target.value)}
                        className="bg-transparent border-none text-[10px] font-black uppercase text-slate-500 outline-none w-full cursor-pointer"
                    >
                        <option value="all">All Cities</option>
                        <option value="Mumbai">Mumbai</option>
                        <option value="Bangalore">Bangalore</option>
                        <option value="Pune">Pune</option>
                        <option value="Gurgaon">Gurgaon</option>
                    </select>
                </div>

                {/* Status filter */}
                <div className="lg:col-span-2 flex items-center gap-2 bg-white px-3 h-14 rounded-2xl border border-slate-100 shadow-sm">
                    <Filter className="h-4 w-4 text-slate-300 shrink-0" />
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="bg-transparent border-none text-[10px] font-black uppercase text-slate-500 outline-none w-full cursor-pointer"
                    >
                        <option value="all">All Status</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                    </select>
                </div>

                {/* Refresh */}
                <div className="lg:col-span-1 flex justify-end">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                            fetchOffices();
                            fetchStats();
                        }}
                        className="h-14 w-14 rounded-2xl bg-white border border-slate-100 shadow-sm cursor-pointer"
                    >
                        <Loader2 className={cn("h-5 w-5 text-slate-400", loading && "animate-spin")} />
                    </Button>
                </div>
            </div>

            {/* ── Office Cards Grid ────────────────────────── */}
            {loading ? (
                <div className="flex items-center justify-center py-24">
                    <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                </div>
            ) : offices.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                    <MapPinned className="h-12 w-12 text-slate-200 mb-4" />
                    <p className="text-sm font-bold text-slate-400">No locations found</p>
                    <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest mt-1">
                        {search || companyFilter !== "all" || cityFilter !== "all" || statusFilter !== "all"
                            ? "Try adjusting your filters"
                            : "Add your first location to get started"}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 px-2">
                    {offices.map((office) => (
                        <Card
                            key={office.id}
                            className="border border-slate-100 bg-white rounded-[2rem] p-6 shadow-sm group hover:shadow-xl hover:border-slate-200 transition-all duration-500"
                        >

                            <div className="space-y-5">
                                {/* Header row */}
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <Avatar className="h-12 w-12 rounded-xl ring-2 ring-slate-50 shrink-0">
                                            <AvatarFallback className="bg-slate-900 text-white text-xs font-black rounded-xl">
                                                {getInitials(office.name)}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="min-w-0">
                                            <h3 className="text-sm font-black text-slate-900 tracking-tight truncate">
                                                {office.name}
                                            </h3>
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 truncate">
                                                <Building2 className="h-3 w-3 shrink-0" />
                                                <span className="truncate">
                                                    {office.company?.name || "Unassigned"}
                                                    {office.code && ` • ${office.code}`}
                                                </span>
                                            </p>
                                        </div>
                                    </div>
                                    <Badge
                                        className={cn(
                                            "shrink-0 font-black text-[7px] uppercase tracking-widest border-none",
                                            office.is_active
                                                ? "bg-emerald-50 text-emerald-600"
                                                : "bg-slate-100 text-slate-500"
                                        )}
                                    >
                                        {office.is_active ? "Active" : "Inactive"}
                                    </Badge>
                                </div>

                                {/* Location info */}
                                <div className="space-y-2">
                                    {(office.city || office.state) && (
                                        <div className="flex items-center gap-2">
                                            <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                            <span className="text-xs font-medium text-slate-600 truncate">
                                                {[office.city, office.state].filter(Boolean).join(", ")}
                                            </span>
                                        </div>
                                    )}

                                    {/* Geo-fence pill — clickable to open map */}
                                    <div
                                        className="flex items-center flex-wrap gap-2 group/geofence cursor-pointer"
                                        onClick={() => setGeoFenceTarget(office)}
                                        title="Click to view geo-fence on map"
                                    >
                                        <Target className="h-3.5 w-3.5 text-indigo-400 shrink-0 group-hover/geofence:text-indigo-600 transition-colors" />
                                        <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full group-hover/geofence:bg-indigo-100 transition-colors">
                                            {office.radius_meters}m Geo-fence
                                        </span>
                                        <span className="text-[9px] font-medium text-slate-400 group-hover/geofence:text-indigo-500 transition-colors">
                                            ({Number(office.latitude).toFixed(4)}, {Number(office.longitude).toFixed(4)})
                                        </span>
                                        <Navigation className="h-3 w-3 text-slate-300 group-hover/geofence:text-indigo-500 transition-colors shrink-0" />
                                    </div>

                                    {/* Contact */}
                                    {(office.contact_person || office.contact_phone) && (
                                        <div className="flex items-center gap-2">
                                            <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                            <span className="text-xs text-slate-500 truncate">
                                                {office.contact_person}
                                                {office.contact_person && office.contact_phone && " • "}
                                                {office.contact_phone}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Footer: employee count + actions */}
                                <div className="pt-4 flex items-center justify-between border-t border-slate-50">
                                    <div className="flex items-center gap-2">
                                        <Users className="h-4 w-4 text-slate-400" />
                                        <span className="text-xs font-bold text-slate-600">
                                            {office.employee_count ?? 0}{" "}
                                            <span className="font-medium text-slate-400">employees</span>
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 rounded-xl hover:bg-indigo-50 transition-colors"
                                            onClick={() => router.push(`/locations/${office.id}`)}
                                        >
                                            <ExternalLink className="h-3.5 w-3.5 text-slate-500" />
                                        </Button>

                                        {isAdmin && (
                                            <>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 rounded-xl hover:bg-amber-50 transition-colors"
                                                    onClick={() => openEditSheet(office)}
                                                >
                                                    <Pencil className="h-3.5 w-3.5 text-amber-600" />
                                                </Button>

                                                {canDelete && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 rounded-xl hover:bg-red-50 transition-colors"
                                                        onClick={() => setDeleteTarget(office)}
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                                                    </Button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            {/* ── Pagination ────────────────────────────────── */}
            {pagination.totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        disabled={page <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        className="h-10 w-10 rounded-xl"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>

                    {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => (
                        <Button
                            key={p}
                            variant={p === page ? "default" : "ghost"}
                            size="icon"
                            onClick={() => setPage(p)}
                            className={cn(
                                "h-10 w-10 rounded-xl text-xs font-black",
                                p === page
                                    ? "bg-slate-900 text-white hover:bg-slate-800"
                                    : "text-slate-500 hover:bg-slate-100"
                            )}
                        >
                            {p}
                        </Button>
                    ))}

                    <Button
                        variant="ghost"
                        size="icon"
                        disabled={page >= pagination.totalPages}
                        onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                        className="h-10 w-10 rounded-xl"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            )}

            {/* ── Delete Confirmation Dialog ────────────────── */}
            <Dialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
                <DialogContent className="sm:max-w-[425px] border-none shadow-2xl rounded-3xl p-8">
                    <DialogHeader className="space-y-3">
                        <DialogTitle className="text-lg font-black text-slate-900 uppercase italic tracking-tighter">
                            Delete Location
                        </DialogTitle>
                        <DialogDescription className="text-xs font-bold text-slate-500">
                            Are you sure you want to permanently delete{" "}
                            <span className="text-slate-900">{deleteTarget?.name}</span>?
                            This action cannot be undone. Employees currently assigned to this
                            location will become unassigned.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex gap-3 pt-4">
                        <Button
                            variant="ghost"
                            onClick={() => setDeleteTarget(null)}
                            className="rounded-2xl h-11 text-slate-600 font-black text-[9px] uppercase tracking-widest flex-1"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleDelete}
                            disabled={deleting}
                            className="flex-1 h-11 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-black uppercase text-[9px] tracking-widest shadow-lg disabled:opacity-50"
                        >
                            {deleting ? (
                                <span className="flex items-center gap-2">
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    Deleting…
                                </span>
                            ) : (
                                "Delete"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Geo-Fence Map Dialog ────────────────────────── */}
            <Dialog open={!!geoFenceTarget} onOpenChange={(v) => { if (!v) setGeoFenceTarget(null); }}>
                <DialogContent className="sm:max-w-[680px] border-none shadow-2xl rounded-[2rem] p-0 overflow-hidden">
                    <DialogHeader className="p-6 flex-shrink-0">
                        <DialogTitle className="text-base font-black text-slate-900 uppercase tracking-tighter flex items-center gap-2">
                            <Target className="h-5 w-5 text-indigo-500" />
                            Geo-Fence: {geoFenceTarget?.name || "Office"}
                        </DialogTitle>
                        <DialogDescription className="text-[10px] font-bold text-slate-400 flex items-center gap-3 pt-1">
                            <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {Number(geoFenceTarget?.latitude).toFixed(4)}, {Number(geoFenceTarget?.longitude).toFixed(4)}
                            </span>
                            <span className="flex items-center gap-1 bg-indigo-50 text-indigo-600 px-2.5 py-0.5 rounded-full text-[10px] font-black">
                                {geoFenceTarget?.radius_meters}m radius
                            </span>
                        </DialogDescription>
                    </DialogHeader>
                    <div className="w-full h-[420px] bg-slate-100">
                        {geoFenceTarget && (
                            <GeoFenceMap
                                latitude={Number(geoFenceTarget.latitude)}
                                longitude={Number(geoFenceTarget.longitude)}
                                radius={Number(geoFenceTarget.radius_meters)}
                                officeName={geoFenceTarget.name}
                            />
                        )}
                    </div>
                    <div className="p-4 flex justify-end border-t border-slate-100">
                        <Button
                            variant="ghost"
                            onClick={() => setGeoFenceTarget(null)}
                            className="h-9 rounded-xl text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600"
                        >
                            Close
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ── Company Management Sheet ──────────────────── */}
            <Sheet open={companySheetOpen} onOpenChange={setCompanySheetOpen}>
                <SheetContent className="sm:max-w-[500px] border-none shadow-2xl p-0 overflow-y-auto">
                    <div className="p-8 space-y-10">
                        <SheetHeader className="text-left space-y-2">
                            <SheetTitle className="text-lg font-black text-slate-900 uppercase italic tracking-tighter">
                                {companyEditingId ? "Edit Company" : "New Company"}
                            </SheetTitle>
                            <SheetDescription className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                {companyEditingId
                                    ? "Update company details"
                                    : "Add a new company entity"}
                            </SheetDescription>
                        </SheetHeader>

                        <div className="space-y-5">
                            <div className="space-y-2">
                                <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                    Company Name <span className="text-red-400">*</span>
                                </Label>
                                <Input
                                    value={companyForm.name}
                                    onChange={(e) => setCompanyForm((prev) => ({ ...prev, name: e.target.value }))}
                                    placeholder="e.g. Acme Corporation"
                                    className="rounded-xl border-slate-200 h-11 text-sm"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                        Email
                                    </Label>
                                    <Input
                                        value={companyForm.email}
                                        onChange={(e) => setCompanyForm((prev) => ({ ...prev, email: e.target.value }))}
                                        placeholder="hr@example.com"
                                        className="rounded-xl border-slate-200 h-11 text-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                        Phone
                                    </Label>
                                    <Input
                                        value={companyForm.phone}
                                        onChange={(e) => setCompanyForm((prev) => ({ ...prev, phone: e.target.value }))}
                                        placeholder="+91-XXXXX XXXXX"
                                        className="rounded-xl border-slate-200 h-11 text-sm"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                        City
                                    </Label>
                                    <Input
                                        value={companyForm.city}
                                        onChange={(e) => setCompanyForm((prev) => ({ ...prev, city: e.target.value }))}
                                        placeholder="City"
                                        className="rounded-xl border-slate-200 h-11 text-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                        State
                                    </Label>
                                    <Input
                                        value={companyForm.state}
                                        onChange={(e) => setCompanyForm((prev) => ({ ...prev, state: e.target.value }))}
                                        placeholder="State"
                                        className="rounded-xl border-slate-200 h-11 text-sm"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                    Website
                                </Label>
                                <Input
                                    value={companyForm.website}
                                    onChange={(e) => setCompanyForm((prev) => ({ ...prev, website: e.target.value }))}
                                    placeholder="www.example.com"
                                    className="rounded-xl border-slate-200 h-11 text-sm"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                    Full Address
                                </Label>
                                <Input
                                    value={companyForm.address}
                                    onChange={(e) => setCompanyForm((prev) => ({ ...prev, address: e.target.value }))}
                                    placeholder="Registered office address"
                                    className="rounded-xl border-slate-200 h-11 text-sm"
                                />
                            </div>

                            {/* List existing companies */}
                            {!companyEditingId && companies.length > 0 && (
                                <div className="space-y-2 pt-2">
                                    <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                        Existing Companies
                                    </Label>
                                    <div className="max-h-[200px] overflow-y-auto space-y-1.5 rounded-xl border border-slate-100 p-2">
                                        {companies.map((c) => (
                                            <div
                                                key={c.id}
                                                className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-50 group"
                                            >
                                                <div className="flex items-center gap-2.5">
                                                    <div className="h-7 w-7 rounded-lg bg-slate-100 flex items-center justify-center text-[9px] font-black text-slate-600">
                                                        {getInitials(c.name)}
                                                    </div>
                                                    <span className="text-xs font-bold text-slate-700">{c.name}</span>
                                                </div>
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7 rounded-lg hover:bg-amber-50"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            openCompanyEditSheet(c);
                                                        }}
                                                    >
                                                        <Pencil className="h-3 w-3 text-amber-600" />
                                                    </Button>
                                                    {canDelete && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-7 w-7 rounded-lg hover:bg-red-50"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setCompanySheetOpen(false);
                                                                setCompanyDeleteTarget(c);
                                                            }}
                                                        >
                                                            <Trash2 className="h-3 w-3 text-red-500" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <SheetFooter className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-slate-50">
                            <SheetClose asChild>
                                <Button
                                    variant="ghost"
                                    className="rounded-2xl h-11 text-slate-600 font-black text-[9px] uppercase tracking-widest"
                                >
                                    Cancel
                                </Button>
                            </SheetClose>
                            <Button
                                onClick={handleCompanySave}
                                disabled={companySaving}
                                className="flex-1 h-11 rounded-2xl bg-slate-900 text-white font-black uppercase text-[9px] tracking-widest shadow-lg transition-all hover:translate-y-[-2px] disabled:opacity-50"
                            >
                                {companySaving ? (
                                    <span className="flex items-center gap-2">
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                        Saving…
                                    </span>
                                ) : companyEditingId ? (
                                    "Update Company"
                                ) : (
                                    "Create Company"
                                )}
                            </Button>
                        </SheetFooter>
                    </div>
                </SheetContent>
            </Sheet>

            {/* ── Company Delete Confirmation Dialog ─────────── */}
            <Dialog open={!!companyDeleteTarget} onOpenChange={(v) => { if (!v) setCompanyDeleteTarget(null); }}>
                <DialogContent className="sm:max-w-[425px] border-none shadow-2xl rounded-3xl p-8">
                    <DialogHeader className="space-y-3">
                        <DialogTitle className="text-lg font-black text-slate-900 uppercase italic tracking-tighter">
                            Delete Company
                        </DialogTitle>
                        <DialogDescription className="text-xs font-bold text-slate-500">
                            Are you sure you want to permanently delete{" "}
                            <span className="text-slate-900">{companyDeleteTarget?.name}</span>?
                            All locations under this company will become unassigned. This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex gap-3 pt-4">
                        <Button
                            variant="ghost"
                            onClick={() => setCompanyDeleteTarget(null)}
                            className="rounded-2xl h-11 text-slate-600 font-black text-[9px] uppercase tracking-widest flex-1"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleCompanyDelete}
                            disabled={companyDeleting}
                            className="flex-1 h-11 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-black uppercase text-[9px] tracking-widest shadow-lg disabled:opacity-50"
                        >
                            {companyDeleting ? (
                                <span className="flex items-center gap-2">
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    Deleting…
                                </span>
                            ) : (
                                "Delete Company"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
        </ProtectedRoute>
    );
}
