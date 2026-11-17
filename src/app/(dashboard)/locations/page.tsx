"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
    Sparkles,
    LayoutGrid,
    List,
    Building,
    RefreshCw,
    SlidersHorizontal,
    CheckCircle2,
    ArrowUpRight,
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
    code?: string | null;
    email?: string | null;
    phone?: string | null;
    website?: string | null;
    city?: string | null;
    state?: string | null;
    address?: string | null;
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
    active_employee_count?: number;
}

interface OfficeStats {
    total_offices: number;
    active_offices: number;
    inactive_offices: number;
    total_employees: number;
    total_active_employees?: number;
    per_office?: Array<{
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

const PAGE_SIZE = 100; // Load ample branches so company grouping has full picture

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

// ──────────────────────────────────────────────────────────────
// Helpers
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

function deriveClientOfficeCode(
    companyName: string,
    companyCode: string | null | undefined,
    city: string,
    name: string
): string {
    let comp = (companyCode || "").trim().toUpperCase();
    if (!comp || comp.length < 2) {
        if (/^bp\s*marketing/i.test(companyName)) comp = "BPM";
        else if (/^apaar\s*logistics/i.test(companyName)) comp = "APR";
        else if (/^ae\s*solutions/i.test(companyName)) comp = "AES";
        else if (/^pj\s*enterprises/i.test(companyName)) comp = "PJE";
        else {
            const words = companyName.replace(/[^a-zA-Z0-9\s]/g, "").trim().split(/\s+/).filter(Boolean);
            if (words.length >= 3) comp = (words[0][0] + words[1][0] + words[2][0]).toUpperCase();
            else if (words.length === 2) comp = (words[0].slice(0, 2) + words[1][0]).toUpperCase();
            else if (words.length === 1) comp = words[0].slice(0, 3).toUpperCase();
            else comp = "LOC";
        }
    }

    const target = (city && city.trim()) ? city.trim() : (name && name.trim()) ? name.trim() : "";
    if (!target) return `${comp}-LOC`;

    const clean = target.replace(/[^a-zA-Z0-9\s]/g, "").trim().toUpperCase();
    const cityMap: Record<string, string> = {
        INDORE: "IND",
        RATLAM: "RTM",
        UJJAIN: "UJJ",
        NOIDA: "NOI",
        GURGAON: "GGN",
        GURUGRAM: "GGN",
        MUMBAI: "MUM",
        DELHI: "DEL",
        BANGALORE: "BLR",
        BENGALURU: "BLR",
        PUNE: "PUN",
        BHOPAL: "BPL",
        GWALIOR: "GWL",
        JABALPUR: "JBP",
        JAIPUR: "JAI",
        LUCKNOW: "LKO",
        KANPUR: "KNP",
        HYDERABAD: "HYD",
    };
    const cityCode = cityMap[clean] || (clean.length >= 3 ? clean.slice(0, 3) : clean.padEnd(3, "X"));
    return `${comp}-${cityCode}`;
}

// ──────────────────────────────────────────────────────────────
// Page Component
// ──────────────────────────────────────────────────────────────

export default function LocationsPage() {
    const router = useRouter();
    const { user } = useAuth();

    const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
    const canDelete = user?.role === "SUPER_ADMIN";

    // ── View Mode: Grouped by Company vs Dense Table vs Grid Cards ──
    const [viewMode, setViewMode] = useState<"by_company" | "table" | "grid">("by_company");

    // ── Main Data State ──────────────────────────────────────
    const [offices, setOffices] = useState<OfficeRecord[]>([]);
    const [stats, setStats] = useState<OfficeStats | null>(null);
    const [companies, setCompanies] = useState<CompanyRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [statsLoading, setStatsLoading] = useState(true);

    // Filters
    const [search, setSearch] = useState("");
    const [companyFilter, setCompanyFilter] = useState("all");
    const [cityFilter, setCityFilter] = useState("all");
    const [statusFilter, setStatusFilter] = useState("all");

    // Create / Edit Location Sheet
    const [sheetOpen, setSheetOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [form, setForm] = useState<Record<string, string>>({ ...EMPTY_FORM });
    const [saving, setSaving] = useState(false);
    const [generatingCode, setGeneratingCode] = useState(false);
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});

    // Delete dialog
    const [deleteTarget, setDeleteTarget] = useState<OfficeRecord | null>(null);
    const [deleting, setDeleting] = useState(false);

    // Geo-fence map dialog
    const [geoFenceTarget, setGeoFenceTarget] = useState<OfficeRecord | null>(null);

    // GPS location fetching
    const [fetchingLocation, setFetchingLocation] = useState(false);

    // Company management state
    const [companySheetOpen, setCompanySheetOpen] = useState(false);
    const [companyForm, setCompanyForm] = useState({
        name: "",
        code: "",
        email: "",
        phone: "",
        website: "",
        city: "",
        state: "",
        address: "",
    });
    const [companyEditingId, setCompanyEditingId] = useState<number | null>(null);
    const [companySaving, setCompanySaving] = useState(false);
    const [companyDeleteTarget, setCompanyDeleteTarget] = useState<CompanyRecord | null>(null);
    const [companyDeleting, setCompanyDeleting] = useState(false);

    // Toast
    const [toast, setToast] = useState<{ text: string; variant: "success" | "error" } | null>(null);

    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(() => setToast(null), 4000);
        return () => clearTimeout(t);
    }, [toast]);

    // ── Fetch stats ───────────────────────────────────────────
    const fetchStats = useCallback(async () => {
        setStatsLoading(true);
        try {
            const data = await apiGet<OfficeStats>("/offices/stats");
            setStats(data);
        } catch {
            // stats fail silently
        } finally {
            setStatsLoading(false);
        }
    }, []);

    // ── Fetch companies ───────────────────────────────────────
    const fetchCompanies = useCallback(async () => {
        try {
            const data = await apiGet<CompanyRecord[]>("/companies");
            setCompanies(data || []);
        } catch {}
    }, []);

    // ── Fetch offices ─────────────────────────────────────────
    const fetchOffices = useCallback(async () => {
        setLoading(true);
        try {
            const params: Record<string, unknown> = {
                page: 1,
                limit: PAGE_SIZE,
            };
            if (search.trim()) params.search = search.trim();
            if (companyFilter !== "all") params.company_id = Number(companyFilter);
            if (cityFilter !== "all") params.city = cityFilter;
            if (statusFilter !== "all") {
                params.is_active = statusFilter === "active";
            }

            const result = await apiGetPaginated<OfficeRecord>("/offices", params);
            setOffices(result.data || []);
        } catch {
            setOffices([]);
        } finally {
            setLoading(false);
        }
    }, [search, companyFilter, cityFilter, statusFilter]);

    useEffect(() => {
        fetchCompanies();
        fetchStats();
    }, [fetchCompanies, fetchStats]);

    useEffect(() => {
        fetchOffices();
    }, [fetchOffices]);

    // ── Dynamically derived lists for filters ──────────────────
    const availableCities = useMemo(() => {
        const set = new Set<string>();
        offices.forEach((o) => {
            if (o.city && o.city.trim()) set.add(o.city.trim());
        });
        return Array.from(set).sort();
    }, [offices]);

    // ── Grouped Offices by Company ────────────────────────────
    const groupedOffices = useMemo(() => {
        const map = new Map<number, { company: CompanyRecord; offices: OfficeRecord[] }>();
        const unassigned: OfficeRecord[] = [];

        // Seed with all known companies so empty companies also show
        companies.forEach((comp) => {
            map.set(comp.id, { company: comp, offices: [] });
        });

        offices.forEach((office) => {
            if (office.company_id && map.has(office.company_id)) {
                map.get(office.company_id)!.offices.push(office);
            } else if (office.company_id && office.company) {
                map.set(office.company_id, { company: office.company, offices: [office] });
            } else {
                unassigned.push(office);
            }
        });

        // Filter out empty companies if search or filter is active
        const groups = Array.from(map.values());
        if (companyFilter !== "all") {
            const targetId = Number(companyFilter);
            return groups.filter((g) => g.company.id === targetId);
        }
        return groups;
    }, [companies, offices, companyFilter]);

    // ── Form handlers & Live Code Generation ──────────────────
    const handleGenerateCode = async (compIdStr?: string, cityStr?: string, nameStr?: string) => {
        const cId = compIdStr !== undefined ? compIdStr : form.company_id;
        const cCity = cityStr !== undefined ? cityStr : form.city;
        const cName = nameStr !== undefined ? nameStr : form.name;

        if (!cId) {
            setToast({ text: "Please select a company first to generate its branch code", variant: "error" });
            return;
        }

        const selectedComp = companies.find((c) => String(c.id) === String(cId));
        // Instant client-side fallback
        const clientCode = deriveClientOfficeCode(
            selectedComp?.name || "",
            selectedComp?.code,
            cCity,
            cName
        );

        setGeneratingCode(true);
        try {
            const res = await apiGet<{ code: string }>(
                `/offices/generate-code?company_id=${cId}&city=${encodeURIComponent(cCity || "")}&name=${encodeURIComponent(cName || "")}`
            );
            if (res?.code) {
                setForm((prev) => ({ ...prev, code: res.code }));
            } else {
                setForm((prev) => ({ ...prev, code: clientCode }));
            }
        } catch {
            setForm((prev) => ({ ...prev, code: clientCode }));
        } finally {
            setGeneratingCode(false);
        }
    };

    const openCreateSheet = (defaultCompanyId?: number) => {
        setEditingId(null);
        const baseForm = { ...EMPTY_FORM };
        if (defaultCompanyId) {
            baseForm.company_id = String(defaultCompanyId);
            const comp = companies.find((c) => c.id === defaultCompanyId);
            if (comp) {
                baseForm.code = deriveClientOfficeCode(comp.name, comp.code, "", "");
            }
        }
        setForm(baseForm);
        setFormErrors({});
        setSheetOpen(true);

        if (defaultCompanyId) {
            handleGenerateCode(String(defaultCompanyId), "", "");
        }
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
        setForm((prev) => {
            const next = { ...prev, [key]: value };
            // If user changes company and code was empty or auto-derived, auto-refresh code
            if (key === "company_id" && value && !editingId) {
                handleGenerateCode(value, next.city, next.name);
            }
            return next;
        });
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
                setToast({
                    text: `GPS coordinates captured: ${lat}, ${lng}`,
                    variant: "success",
                });
                setFetchingLocation(false);
            },
            (err) => {
                setFetchingLocation(false);
                let msg = "Failed to get location";
                if (err.code === 1) msg = "Location permission denied. Please allow location access.";
                else if (err.code === 2) msg = "Location unavailable. Check device GPS settings.";
                else if (err.code === 3) msg = "Location request timed out. Please try again.";
                setToast({ text: msg, variant: "error" });
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    };

    const validateForm = (): boolean => {
        const errs: Record<string, string> = {};

        if (!form.company_id) errs.company_id = "Company selection is required";
        if (!form.name?.trim()) errs.name = "Branch location name is required";
        if (!form.latitude || isNaN(Number(form.latitude))) errs.latitude = "Valid latitude required";
        if (!form.longitude || isNaN(Number(form.longitude))) errs.longitude = "Valid longitude required";

        const rad = Number(form.radius_meters);
        if (!form.radius_meters || isNaN(rad) || rad < 10 || rad > 5000) {
            errs.radius_meters = "Radius must be between 10m and 5000m";
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
                code: form.code?.trim() ? form.code.trim().toUpperCase() : null,
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
                setToast({ text: "Location created successfully with unique code", variant: "success" });
            }

            setSheetOpen(false);
            await fetchOffices();
            await fetchStats();
        } catch (err: any) {
            const msg =
                err?.response?.data?.message ||
                err?.message ||
                "Failed to save location";
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
    const openCompanyCreateSheet = () => {
        setCompanyEditingId(null);
        setCompanyForm({ name: "", code: "", email: "", phone: "", website: "", city: "", state: "", address: "" });
        setCompanySheetOpen(true);
    };

    const openCompanyEditSheet = (company: any) => {
        setCompanyEditingId(company.id);
        setCompanyForm({
            name: company.name,
            code: company.code || "",
            email: company.email || "",
            phone: company.phone || "",
            website: company.website || "",
            city: company.city || "",
            state: company.state || "",
            address: company.address || "",
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
                code: companyForm.code?.trim() ? companyForm.code.trim().toUpperCase() : null,
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

    // ── Metric Cards ──────────────────────────────────────────
    const totalLocations = statsLoading ? "…" : stats?.total_offices ?? offices.length;
    const activeLocations = statsLoading ? "…" : stats?.active_offices ?? offices.filter((o) => o.is_active).length;
    const totalStaff = statsLoading ? "…" : stats?.total_active_employees ?? stats?.total_employees ?? 0;
    const totalCompanies = companies.length;

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

                {/* ── Header ───────────────────────────────── */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2">
                    <div>
                        <div className="flex items-center gap-2.5">
                            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                                Locations & Geo-Fence Hub
                            </h1>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                                Multi-Company Roster
                            </span>
                        </div>
                        <p className="text-xs font-medium text-slate-500 mt-1">
                            Organize enterprise branch offices, generate unique location codes & configure biometric geo-fencing radius
                        </p>
                    </div>

                    <div className="flex items-center gap-2.5">
                        {isAdmin && (
                            <Button
                                variant="outline"
                                onClick={openCompanyCreateSheet}
                                className="border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs h-10 px-4 rounded-xl shadow-xs flex items-center gap-2"
                            >
                                <Building2 className="h-4 w-4 text-indigo-600" />
                                Manage Companies
                            </Button>
                        )}
                        {isAdmin && (
                            <Button
                                onClick={() => openCreateSheet()}
                                className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs h-10 px-5 rounded-xl shadow-sm flex items-center gap-2 transition-all hover:shadow"
                            >
                                <Plus className="h-4 w-4 stroke-[2.5]" />
                                Add Location
                            </Button>
                        )}
                    </div>
                </div>

                {/* ── Metric Cards ────────────────────────────── */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                    <Card className="border border-slate-200/80 bg-white rounded-2xl p-4 shadow-xs">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                Total Locations
                            </span>
                            <div className="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                                <MapPinned className="h-4 w-4" />
                            </div>
                        </div>
                        <div className="mt-3 flex items-baseline gap-2">
                            <span className="text-2xl font-black text-slate-900">{totalLocations}</span>
                            <span className="text-[11px] text-slate-500 font-medium">Across {totalCompanies} Companies</span>
                        </div>
                    </Card>

                    <Card className="border border-slate-200/80 bg-white rounded-2xl p-4 shadow-xs">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                Active Geo-Fences
                            </span>
                            <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                                <ShieldCheck className="h-4 w-4" />
                            </div>
                        </div>
                        <div className="mt-3 flex items-baseline gap-2">
                            <span className="text-2xl font-black text-emerald-600">{activeLocations}</span>
                            <span className="text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded">
                                Biometrics Ready
                            </span>
                        </div>
                    </Card>

                    <Card className="border border-slate-200/80 bg-white rounded-2xl p-4 shadow-xs">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                Active Staff
                            </span>
                            <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                                <Users className="h-4 w-4" />
                            </div>
                        </div>
                        <div className="mt-3 flex items-baseline gap-2">
                            <span className="text-2xl font-black text-slate-900">{totalStaff}</span>
                            <span className="text-[11px] text-slate-500 font-medium">Assigned to Branches</span>
                        </div>
                    </Card>

                    <Card className="border border-slate-200/80 bg-white rounded-2xl p-4 shadow-xs">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                Registered Companies
                            </span>
                            <div className="h-8 w-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
                                <Building2 className="h-4 w-4" />
                            </div>
                        </div>
                        <div className="mt-3 flex items-baseline gap-2">
                            <span className="text-2xl font-black text-slate-900">{totalCompanies}</span>
                            <span className="text-[11px] text-slate-500 font-medium">Parent Entities</span>
                        </div>
                    </Card>
                </div>

                {/* ── Filters & View Switcher ─────────────────── */}
                <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col lg:flex-row items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto flex-1">
                        {/* Search input */}
                        <div className="relative flex-1 min-w-[220px]">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                            <Input
                                placeholder="Search branch, code (e.g. BPM-IND), city…"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="h-9 pl-9 pr-8 text-xs bg-slate-50 border-slate-200 rounded-xl focus:bg-white"
                            />
                            {search && (
                                <button
                                    onClick={() => setSearch("")}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            )}
                        </div>

                        {/* Company filter */}
                        <div className="w-[170px]">
                            <Select value={companyFilter} onValueChange={setCompanyFilter}>
                                <SelectTrigger className="h-9 text-xs rounded-xl border-slate-200 bg-slate-50">
                                    <Building2 className="h-3 w-3 text-slate-400 mr-1.5 shrink-0" />
                                    <SelectValue placeholder="All Companies" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-slate-200 shadow-lg">
                                    <SelectItem value="all">All Companies</SelectItem>
                                    {companies.map((c) => (
                                        <SelectItem key={c.id} value={String(c.id)}>
                                            {c.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Dynamic City filter */}
                        <div className="w-[140px]">
                            <Select value={cityFilter} onValueChange={setCityFilter}>
                                <SelectTrigger className="h-9 text-xs rounded-xl border-slate-200 bg-slate-50">
                                    <MapPin className="h-3 w-3 text-slate-400 mr-1.5 shrink-0" />
                                    <SelectValue placeholder="All Cities" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-slate-200 shadow-lg">
                                    <SelectItem value="all">All Cities</SelectItem>
                                    {availableCities.map((city) => (
                                        <SelectItem key={city} value={city}>
                                            {city}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Status filter */}
                        <div className="w-[120px]">
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="h-9 text-xs rounded-xl border-slate-200 bg-slate-50">
                                    <Filter className="h-3 w-3 text-slate-400 mr-1.5 shrink-0" />
                                    <SelectValue placeholder="All Status" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-slate-200 shadow-lg">
                                    <SelectItem value="all">All Status</SelectItem>
                                    <SelectItem value="active">Active Only</SelectItem>
                                    <SelectItem value="inactive">Inactive Only</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* View Switcher Controls */}
                    <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl self-end lg:self-auto shrink-0">
                        <button
                            type="button"
                            onClick={() => setViewMode("by_company")}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                                viewMode === "by_company"
                                    ? "bg-white text-slate-900 shadow-xs"
                                    : "text-slate-600 hover:text-slate-900"
                            )}
                        >
                            <Building className="h-3.5 w-3.5 text-indigo-600" />
                            <span>By Company</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode("table")}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                                viewMode === "table"
                                    ? "bg-white text-slate-900 shadow-xs"
                                    : "text-slate-600 hover:text-slate-900"
                            )}
                        >
                            <List className="h-3.5 w-3.5 text-slate-600" />
                            <span>Table View</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode("grid")}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                                viewMode === "grid"
                                    ? "bg-white text-slate-900 shadow-xs"
                                    : "text-slate-600 hover:text-slate-900"
                            )}
                        >
                            <LayoutGrid className="h-3.5 w-3.5 text-slate-600" />
                            <span>All Cards</span>
                        </button>
                    </div>
                </div>

                {/* ── Main Content Area ───────────────────────── */}
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-3">
                        <Loader2 className="h-7 w-7 animate-spin text-indigo-600" />
                        <span className="text-xs font-semibold text-slate-400">Loading branch locations…</span>
                    </div>
                ) : offices.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 text-center bg-white rounded-3xl border border-slate-200/80 p-8">
                        <div className="h-14 w-14 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 mb-3">
                            <MapPinned className="h-7 w-7" />
                        </div>
                        <h3 className="text-sm font-bold text-slate-800">No matching branch locations found</h3>
                        <p className="text-xs text-slate-400 max-w-sm mt-1">
                            {search || companyFilter !== "all" || cityFilter !== "all" || statusFilter !== "all"
                                ? "Try resetting your search query or company filters."
                                : "Click 'Add Location' above to configure your first company branch."}
                        </p>
                    </div>
                ) : viewMode === "by_company" ? (
                    /* ══════════════════════════════════════════════════════
                       VIEW 1: GROUPED BY COMPANY HIERARCHY (ORGANIZED)
                       ══════════════════════════════════════════════════════ */
                    <div className="space-y-6">
                        {groupedOffices.map(({ company, offices: companyOffices }) => {
                            const activeCount = companyOffices.filter((o) => o.is_active).length;
                            const staffTotal = companyOffices.reduce(
                                (acc, o) => acc + (o.active_employee_count ?? o.employee_count ?? 0),
                                0
                            );

                            return (
                                <div
                                    key={company.id}
                                    className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden transition-all hover:border-slate-300"
                                >
                                    {/* Company Banner Header */}
                                    <div className="bg-slate-50/80 border-b border-slate-200/70 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                        <div className="flex items-center gap-3.5">
                                            <div className="h-11 w-11 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-sm shadow-xs">
                                                {company.code || getInitials(company.name)}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h2 className="text-base font-black text-slate-900 tracking-tight">
                                                        {company.name}
                                                    </h2>
                                                    {company.code && (
                                                        <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-indigo-100/70 text-indigo-800 border border-indigo-200">
                                                            Code: {company.code}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-3 text-xs text-slate-500 font-medium mt-0.5">
                                                    <span>{companyOffices.length} Branch Locations ({activeCount} Active)</span>
                                                    <span>•</span>
                                                    <span>{staffTotal} Assigned Staff</span>
                                                    {company.city && (
                                                        <>
                                                            <span>•</span>
                                                            <span className="text-slate-400">HQ: {company.city}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {isAdmin && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => openCreateSheet(company.id)}
                                                className="h-8 px-3 rounded-xl border-slate-300 hover:border-indigo-400 text-slate-700 hover:text-indigo-600 hover:bg-white text-xs font-bold transition-all shadow-2xs self-start sm:self-auto flex items-center gap-1.5"
                                            >
                                                <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
                                                Add Branch to {company.name.split(" ")[0]}
                                            </Button>
                                        )}
                                    </div>

                                    {/* Company's Branch Offices Grid */}
                                    <div className="p-6">
                                        {companyOffices.length === 0 ? (
                                            <div className="py-8 text-center text-xs text-slate-400 font-medium border border-dashed border-slate-200 rounded-2xl">
                                                No branch locations added for this company yet.
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                                {companyOffices.map((office) => (
                                                    <BranchCard
                                                        key={office.id}
                                                        office={office}
                                                        isAdmin={isAdmin}
                                                        canDelete={canDelete}
                                                        onViewDetail={() => router.push(`/locations/${office.id}`)}
                                                        onViewGeoFence={() => setGeoFenceTarget(office)}
                                                        onEdit={() => openEditSheet(office)}
                                                        onDelete={() => setDeleteTarget(office)}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : viewMode === "table" ? (
                    /* ══════════════════════════════════════════════════════
                       VIEW 2: DENSE ENTERPRISE TABLE VIEW
                       ══════════════════════════════════════════════════════ */
                    <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                    <tr>
                                        <th className="py-3.5 px-4">Branch & Location ID</th>
                                        <th className="py-3.5 px-4">Company</th>
                                        <th className="py-3.5 px-4">City & State</th>
                                        <th className="py-3.5 px-4">Geo-Fence Radius</th>
                                        <th className="py-3.5 px-4">GPS Coordinates</th>
                                        <th className="py-3.5 px-4">Site Manager</th>
                                        <th className="py-3.5 px-4 text-center">Active Staff</th>
                                        <th className="py-3.5 px-4 text-center">Status</th>
                                        <th className="py-3.5 px-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {offices.map((office) => {
                                        const staff = office.active_employee_count ?? office.employee_count ?? 0;
                                        return (
                                            <tr key={office.id} className="hover:bg-slate-50/70 transition-colors group">
                                                {/* Branch & Code */}
                                                <td className="py-3.5 px-4">
                                                    <div className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                                                        {office.name}
                                                    </div>
                                                    <div className="mt-0.5 flex items-center gap-1.5">
                                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                                            {office.code || `LOC-${office.id}`}
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* Company */}
                                                <td className="py-3.5 px-4">
                                                    <span className="font-bold text-slate-800 block">
                                                        {office.company?.name || "Unassigned"}
                                                    </span>
                                                    {office.company?.code && (
                                                        <span className="text-[10px] text-slate-400 font-mono">
                                                            {office.company.code}
                                                        </span>
                                                    )}
                                                </td>

                                                {/* City & State */}
                                                <td className="py-3.5 px-4 text-slate-600 font-medium">
                                                    {[office.city, office.state].filter(Boolean).join(", ") || "---"}
                                                </td>

                                                {/* Geo-Fence Radius */}
                                                <td className="py-3.5 px-4">
                                                    <button
                                                        type="button"
                                                        onClick={() => setGeoFenceTarget(office)}
                                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors cursor-pointer"
                                                        title="Click to preview geo-fence perimeter on map"
                                                    >
                                                        <Target className="h-3 w-3 text-indigo-500" />
                                                        <span>{office.radius_meters}m</span>
                                                    </button>
                                                </td>

                                                {/* Coordinates */}
                                                <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">
                                                    <a
                                                        href={`https://www.google.com/maps?q=${office.latitude},${office.longitude}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1 hover:text-indigo-600 hover:underline"
                                                        title="Open in Google Maps"
                                                    >
                                                        <span>
                                                            {Number(office.latitude).toFixed(4)}, {Number(office.longitude).toFixed(4)}
                                                        </span>
                                                        <ArrowUpRight className="h-3 w-3 text-slate-400" />
                                                    </a>
                                                </td>

                                                {/* Site Manager */}
                                                <td className="py-3.5 px-4 text-slate-600 font-medium">
                                                    {office.contact_person ? (
                                                        <div>
                                                            <div className="font-bold text-slate-800">{office.contact_person}</div>
                                                            {office.contact_phone && (
                                                                <div className="text-[10px] text-slate-400">{office.contact_phone}</div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-300">---</span>
                                                    )}
                                                </td>

                                                {/* Active Staff */}
                                                <td className="py-3.5 px-4 text-center">
                                                    <span className={cn(
                                                        "inline-flex items-center justify-center px-2 py-0.5 rounded-full font-bold text-xs",
                                                        staff > 0 ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-400"
                                                    )}>
                                                        {staff}
                                                    </span>
                                                </td>

                                                {/* Status */}
                                                <td className="py-3.5 px-4 text-center">
                                                    <span
                                                        className={cn(
                                                            "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                                                            office.is_active
                                                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                                                : "bg-slate-100 text-slate-500 border border-slate-200"
                                                        )}
                                                    >
                                                        {office.is_active ? "Active" : "Inactive"}
                                                    </span>
                                                </td>

                                                {/* Actions */}
                                                <td className="py-3.5 px-4 text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 rounded-lg hover:bg-indigo-50 text-slate-500 hover:text-indigo-600"
                                                            onClick={() => router.push(`/locations/${office.id}`)}
                                                            title="View Branch Live Muster"
                                                        >
                                                            <ExternalLink className="h-3.5 w-3.5" />
                                                        </Button>
                                                        {isAdmin && (
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 rounded-lg hover:bg-amber-50 text-slate-500 hover:text-amber-600"
                                                                onClick={() => openEditSheet(office)}
                                                                title="Edit Location & Geo-fence"
                                                            >
                                                                <Pencil className="h-3.5 w-3.5" />
                                                            </Button>
                                                        )}
                                                        {canDelete && (
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 rounded-lg hover:bg-rose-50 text-slate-500 hover:text-rose-600"
                                                                onClick={() => setDeleteTarget(office)}
                                                                title="Delete Location"
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    /* ══════════════════════════════════════════════════════
                       VIEW 3: FLAT GRID CARDS VIEW
                       ══════════════════════════════════════════════════════ */
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                        {offices.map((office) => (
                            <BranchCard
                                key={office.id}
                                office={office}
                                isAdmin={isAdmin}
                                canDelete={canDelete}
                                onViewDetail={() => router.push(`/locations/${office.id}`)}
                                onViewGeoFence={() => setGeoFenceTarget(office)}
                                onEdit={() => openEditSheet(office)}
                                onDelete={() => setDeleteTarget(office)}
                            />
                        ))}
                    </div>
                )}

                {/* ── Add / Edit Location Sheet ────────────────── */}
                <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                    <SheetContent className="sm:max-w-[560px] border-none shadow-2xl p-0 overflow-y-auto">
                        <div className="p-7 space-y-6">
                            <SheetHeader className="text-left space-y-1">
                                <SheetTitle className="text-lg font-black text-slate-900 tracking-tight">
                                    {editingId ? "Edit Branch Location" : "New Branch Location"}
                                </SheetTitle>
                                <SheetDescription className="text-xs text-slate-500">
                                    Configure company assignment, auto-generated location code & GPS geo-fence perimeter
                                </SheetDescription>
                            </SheetHeader>

                            <div className="space-y-4 pt-1">
                                {/* Company Selector */}
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-bold text-slate-700">
                                        Parent Company <span className="text-rose-500">*</span>
                                    </Label>
                                    <Select
                                        value={form.company_id}
                                        onValueChange={(v) => updateForm("company_id", v)}
                                    >
                                        <SelectTrigger
                                            className={cn(
                                                "rounded-xl border-slate-200 h-10 text-xs font-medium",
                                                formErrors.company_id && "border-rose-400 bg-rose-50/50"
                                            )}
                                        >
                                            <SelectValue placeholder="Select parent company" />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                                            {companies.map((c) => (
                                                <SelectItem key={c.id} value={String(c.id)}>
                                                    {c.name} {c.code ? `(${c.code})` : ""}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {formErrors.company_id && (
                                        <p className="text-[11px] font-semibold text-rose-500">{formErrors.company_id}</p>
                                    )}
                                </div>

                                {/* Unique Location Code + Auto-generate Button */}
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-xs font-bold text-slate-700">
                                            Location ID / Branch Code <span className="text-rose-500">*</span>
                                        </Label>
                                        <button
                                            type="button"
                                            onClick={() => handleGenerateCode()}
                                            disabled={generatingCode || !form.company_id}
                                            className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer disabled:opacity-40"
                                        >
                                            <Sparkles className={cn("h-3 w-3", generatingCode && "animate-spin")} />
                                            <span>{generatingCode ? "Generating…" : "Auto-Generate Code"}</span>
                                        </button>
                                    </div>
                                    <div className="relative">
                                        <Input
                                            value={form.code}
                                            onChange={(e) => updateForm("code", e.target.value.toUpperCase())}
                                            placeholder="e.g. BPM-IND, APR-RTM, AES-NOI"
                                            className={cn(
                                                "rounded-xl border-slate-200 h-10 text-xs font-mono font-bold uppercase tracking-wider",
                                                formErrors.code && "border-rose-400 bg-rose-50"
                                            )}
                                        />
                                    </div>
                                    <p className="text-[10px] text-slate-400 leading-tight">
                                        Unique identifier automatically generated from Company & City prefix (e.g. <span className="font-mono text-slate-600 font-bold">BPM-IND</span>, <span className="font-mono text-slate-600 font-bold">BPM-IND-02</span>).
                                    </p>
                                </div>

                                {/* Branch Name */}
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-bold text-slate-700">
                                        Branch / Office Name <span className="text-rose-500">*</span>
                                    </Label>
                                    <Input
                                        value={form.name}
                                        onChange={(e) => updateForm("name", e.target.value)}
                                        placeholder="e.g. Indore HQ, Ratlam Depot, Noida Office"
                                        className={cn(
                                            "rounded-xl border-slate-200 h-10 text-xs",
                                            formErrors.name && "border-rose-400 bg-rose-50"
                                        )}
                                    />
                                    {formErrors.name && (
                                        <p className="text-[11px] font-semibold text-rose-500">{formErrors.name}</p>
                                    )}
                                </div>

                                {/* City + State */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-bold text-slate-700">City</Label>
                                        <Input
                                            value={form.city}
                                            onChange={(e) => updateForm("city", e.target.value)}
                                            placeholder="e.g. Indore"
                                            className="rounded-xl border-slate-200 h-10 text-xs"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-bold text-slate-700">State</Label>
                                        <Input
                                            value={form.state}
                                            onChange={(e) => updateForm("state", e.target.value)}
                                            placeholder="e.g. Madhya Pradesh"
                                            className="rounded-xl border-slate-200 h-10 text-xs"
                                        />
                                    </div>
                                </div>

                                {/* Address */}
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-bold text-slate-700">Street Address</Label>
                                    <Input
                                        value={form.address}
                                        onChange={(e) => updateForm("address", e.target.value)}
                                        placeholder="Full address / landmark"
                                        className="rounded-xl border-slate-200 h-10 text-xs"
                                    />
                                </div>

                                {/* GPS Coordinates & Radius */}
                                <div className="pt-2 border-t border-slate-100 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                                            <Target className="h-3.5 w-3.5 text-indigo-600" />
                                            GPS & Geo-Fencing Configuration
                                        </Label>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            disabled={fetchingLocation}
                                            onClick={getCurrentLocation}
                                            className="h-7 px-2.5 rounded-lg border-indigo-200 bg-indigo-50/50 text-indigo-700 hover:bg-indigo-100 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                                        >
                                            {fetchingLocation ? (
                                                <>
                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                    Capturing…
                                                </>
                                            ) : (
                                                <>
                                                    <Navigation className="h-3 w-3" />
                                                    Get Current GPS
                                                </>
                                            )}
                                        </Button>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <Label className="text-[11px] font-bold text-slate-600">
                                                Latitude <span className="text-rose-500">*</span>
                                            </Label>
                                            <Input
                                                type="number"
                                                step="any"
                                                value={form.latitude}
                                                onChange={(e) => updateForm("latitude", e.target.value)}
                                                placeholder="e.g. 22.7196"
                                                className={cn(
                                                    "rounded-xl border-slate-200 h-9 text-xs font-mono",
                                                    formErrors.latitude && "border-rose-400 bg-rose-50"
                                                )}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[11px] font-bold text-slate-600">
                                                Longitude <span className="text-rose-500">*</span>
                                            </Label>
                                            <Input
                                                type="number"
                                                step="any"
                                                value={form.longitude}
                                                onChange={(e) => updateForm("longitude", e.target.value)}
                                                placeholder="e.g. 75.8577"
                                                className={cn(
                                                    "rounded-xl border-slate-200 h-9 text-xs font-mono",
                                                    formErrors.longitude && "border-rose-400 bg-rose-50"
                                                )}
                                            />
                                        </div>
                                    </div>

                                    {/* Interactive Map Picker */}
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                                            <span>Click or drag pin to adjust coordinates</span>
                                        </div>
                                        <LocationPickerMap
                                            initialLat={
                                                isNaN(Number(form.latitude)) || !form.latitude
                                                    ? 22.7196
                                                    : Number(form.latitude)
                                            }
                                            initialLng={
                                                isNaN(Number(form.longitude)) || !form.longitude
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
                                    </div>

                                    {/* Geo-fence Radius Selection */}
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-xs font-bold text-slate-700">
                                                Allowed Punch Radius <span className="text-rose-500">*</span>
                                            </Label>
                                            <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                                                {form.radius_meters} meters
                                            </span>
                                        </div>
                                        <Select
                                            value={form.radius_meters}
                                            onValueChange={(v) => updateForm("radius_meters", v)}
                                        >
                                            <SelectTrigger className="rounded-xl border-slate-200 h-10 text-xs">
                                                <SelectValue placeholder="Select radius preset" />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                                                {RADIUS_PRESETS.map((o) => (
                                                    <SelectItem key={o.value} value={o.value}>
                                                        {o.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        {formErrors.radius_meters && (
                                            <p className="text-[11px] font-semibold text-rose-500">
                                                {formErrors.radius_meters}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Site In-Charge Contact */}
                                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                                    <div className="space-y-1">
                                        <Label className="text-xs font-bold text-slate-700">Site In-Charge</Label>
                                        <Input
                                            value={form.contact_person}
                                            onChange={(e) => updateForm("contact_person", e.target.value)}
                                            placeholder="Manager name"
                                            className="rounded-xl border-slate-200 h-10 text-xs"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs font-bold text-slate-700">Contact Phone</Label>
                                        <Input
                                            value={form.contact_phone}
                                            onChange={(e) => updateForm("contact_phone", e.target.value)}
                                            placeholder="+91-XXXXX XXXXX"
                                            className="rounded-xl border-slate-200 h-10 text-xs"
                                        />
                                    </div>
                                </div>

                                {/* Status */}
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-bold text-slate-700">Branch Status</Label>
                                    <Select
                                        value={form.is_active}
                                        onValueChange={(v) => updateForm("is_active", v)}
                                    >
                                        <SelectTrigger className="rounded-xl border-slate-200 h-10 text-xs">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                                            <SelectItem value="true">Active (Punching Enabled)</SelectItem>
                                            <SelectItem value="false">Inactive (Suspended)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <SheetFooter className="flex flex-col sm:flex-row gap-2.5 pt-4 border-t border-slate-100">
                                <SheetClose asChild>
                                    <Button
                                        variant="ghost"
                                        className="rounded-xl h-10 text-slate-600 font-bold text-xs"
                                    >
                                        Cancel
                                    </Button>
                                </SheetClose>
                                <Button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="flex-1 h-10 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-sm disabled:opacity-50"
                                >
                                    {saving ? (
                                        <span className="flex items-center gap-2">
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            Saving Location…
                                        </span>
                                    ) : editingId ? (
                                        "Update Location"
                                    ) : (
                                        "Save Branch Location"
                                    )}
                                </Button>
                            </SheetFooter>
                        </div>
                    </SheetContent>
                </Sheet>

                {/* ── Geo-Fence Visualizer Map Dialog ──────────── */}
                <Dialog open={!!geoFenceTarget} onOpenChange={(v) => { if (!v) setGeoFenceTarget(null); }}>
                    <DialogContent className="sm:max-w-[700px] border-none shadow-2xl rounded-3xl p-0 overflow-hidden">
                        <DialogHeader className="p-5 flex-shrink-0 bg-slate-50 border-b border-slate-100">
                            <div className="flex items-center justify-between">
                                <div>
                                    <DialogTitle className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                                        <Target className="h-4 w-4 text-indigo-600" />
                                        Geo-Fence: {geoFenceTarget?.name}
                                    </DialogTitle>
                                    <DialogDescription className="text-xs text-slate-500 mt-0.5">
                                        {geoFenceTarget?.company?.name || "Company Branch"} • Code: {geoFenceTarget?.code || `LOC-${geoFenceTarget?.id}`}
                                    </DialogDescription>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                        {geoFenceTarget?.radius_meters}m Perimeter
                                    </span>
                                </div>
                            </div>
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

                        <div className="p-4 bg-white flex items-center justify-between border-t border-slate-100">
                            <div className="flex items-center gap-3 text-xs text-slate-500 font-mono">
                                <span>Lat: {Number(geoFenceTarget?.latitude).toFixed(6)}</span>
                                <span>•</span>
                                <span>Lng: {Number(geoFenceTarget?.longitude).toFixed(6)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                {geoFenceTarget && (
                                    <a
                                        href={`https://www.google.com/maps?q=${geoFenceTarget.latitude},${geoFenceTarget.longitude}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="h-8 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 inline-flex items-center gap-1.5 transition-colors"
                                    >
                                        <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
                                        Open in Google Maps
                                    </a>
                                )}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setGeoFenceTarget(null)}
                                    className="h-8 px-3 rounded-xl text-xs font-bold text-slate-600"
                                >
                                    Close
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* ── Delete Confirmation Dialog ────────────────── */}
                <Dialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
                    <DialogContent className="sm:max-w-[420px] border-none shadow-2xl rounded-3xl p-6">
                        <DialogHeader className="space-y-2">
                            <DialogTitle className="text-base font-black text-slate-900 tracking-tight">
                                Delete Branch Location
                            </DialogTitle>
                            <DialogDescription className="text-xs text-slate-500 leading-relaxed">
                                Are you sure you want to delete <span className="font-bold text-slate-900">{deleteTarget?.name}</span>?
                                If active staff are assigned to this location, you must reassign them to another branch first.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter className="flex gap-2.5 pt-4">
                            <Button
                                variant="ghost"
                                onClick={() => setDeleteTarget(null)}
                                className="rounded-xl h-10 text-slate-600 font-bold text-xs flex-1"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleDelete}
                                disabled={deleting}
                                className="flex-1 h-10 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-sm"
                            >
                                {deleting ? "Deleting…" : "Confirm Delete"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* ── Manage Companies Sheet ────────────────────── */}
                <Sheet open={companySheetOpen} onOpenChange={setCompanySheetOpen}>
                    <SheetContent className="sm:max-w-[500px] border-none shadow-2xl p-0 overflow-y-auto">
                        <div className="p-7 space-y-6">
                            <SheetHeader className="text-left space-y-1">
                                <SheetTitle className="text-lg font-black text-slate-900 tracking-tight">
                                    {companyEditingId ? "Edit Company" : "Registered Companies"}
                                </SheetTitle>
                                <SheetDescription className="text-xs text-slate-500">
                                    Manage corporate entities & company-specific employee ID prefixes
                                </SheetDescription>
                            </SheetHeader>

                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-bold text-slate-700">
                                        Company Name <span className="text-rose-500">*</span>
                                    </Label>
                                    <Input
                                        value={companyForm.name}
                                        onChange={(e) => setCompanyForm((prev) => ({ ...prev, name: e.target.value }))}
                                        placeholder="e.g. Apaar Logistics"
                                        className="rounded-xl border-slate-200 h-10 text-xs"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-xs font-bold text-slate-700">Company Code / Prefix</Label>
                                        <span className="text-[10px] text-slate-400 font-medium">Auto-derived if blank</span>
                                    </div>
                                    <Input
                                        value={companyForm.code}
                                        onChange={(e) => setCompanyForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
                                        placeholder="e.g. AL, BM, AS, PE"
                                        maxLength={6}
                                        className="rounded-xl border-slate-200 h-10 text-xs font-mono font-bold uppercase"
                                    />
                                    <p className="text-[10px] text-slate-400">
                                        Used for generating Employee IDs (e.g. {companyForm.code ? `${companyForm.code}001` : "AL001, BM001"}) and location codes.
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <Label className="text-xs font-bold text-slate-700">Email</Label>
                                        <Input
                                            value={companyForm.email}
                                            onChange={(e) => setCompanyForm((prev) => ({ ...prev, email: e.target.value }))}
                                            placeholder="hr@example.com"
                                            className="rounded-xl border-slate-200 h-10 text-xs"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs font-bold text-slate-700">Phone</Label>
                                        <Input
                                            value={companyForm.phone}
                                            onChange={(e) => setCompanyForm((prev) => ({ ...prev, phone: e.target.value }))}
                                            placeholder="+91-XXXXX XXXXX"
                                            className="rounded-xl border-slate-200 h-10 text-xs"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <Label className="text-xs font-bold text-slate-700">HQ City</Label>
                                        <Input
                                            value={companyForm.city}
                                            onChange={(e) => setCompanyForm((prev) => ({ ...prev, city: e.target.value }))}
                                            placeholder="e.g. Indore"
                                            className="rounded-xl border-slate-200 h-10 text-xs"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs font-bold text-slate-700">State</Label>
                                        <Input
                                            value={companyForm.state}
                                            onChange={(e) => setCompanyForm((prev) => ({ ...prev, state: e.target.value }))}
                                            placeholder="e.g. Madhya Pradesh"
                                            className="rounded-xl border-slate-200 h-10 text-xs"
                                        />
                                    </div>
                                </div>

                                {/* List existing companies */}
                                {!companyEditingId && companies.length > 0 && (
                                    <div className="space-y-2 pt-3 border-t border-slate-100">
                                        <Label className="text-xs font-bold text-slate-700">Configured Companies ({companies.length})</Label>
                                        <div className="max-h-[220px] overflow-y-auto space-y-1.5 rounded-2xl border border-slate-100 p-2 bg-slate-50/50">
                                            {companies.map((c) => (
                                                <div
                                                    key={c.id}
                                                    className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-slate-100 shadow-2xs group"
                                                >
                                                    <div className="flex items-center gap-2.5">
                                                        <div className="h-8 w-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-xs">
                                                            {c.code || getInitials(c.name)}
                                                        </div>
                                                        <div>
                                                            <div className="text-xs font-bold text-slate-800">{c.name}</div>
                                                            <div className="text-[10px] text-slate-400 font-mono">
                                                                Prefix: {c.code || "AUTO"}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-7 w-7 rounded-lg hover:bg-amber-50 text-slate-500 hover:text-amber-600"
                                                            onClick={() => openCompanyEditSheet(c)}
                                                        >
                                                            <Pencil className="h-3 w-3" />
                                                        </Button>
                                                        {canDelete && (
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-7 w-7 rounded-lg hover:bg-rose-50 text-slate-500 hover:text-rose-600"
                                                                onClick={() => {
                                                                    setCompanySheetOpen(false);
                                                                    setCompanyDeleteTarget(c);
                                                                }}
                                                            >
                                                                <Trash2 className="h-3 w-3" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <SheetFooter className="flex flex-col sm:flex-row gap-2.5 pt-4 border-t border-slate-100">
                                <SheetClose asChild>
                                    <Button variant="ghost" className="rounded-xl h-10 text-slate-600 font-bold text-xs">
                                        Cancel
                                    </Button>
                                </SheetClose>
                                <Button
                                    onClick={handleCompanySave}
                                    disabled={companySaving}
                                    className="flex-1 h-10 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-sm"
                                >
                                    {companySaving ? "Saving…" : companyEditingId ? "Update Company" : "Save Company"}
                                </Button>
                            </SheetFooter>
                        </div>
                    </SheetContent>
                </Sheet>

                {/* ── Company Delete Confirmation Dialog ─────────── */}
                <Dialog open={!!companyDeleteTarget} onOpenChange={(v) => { if (!v) setCompanyDeleteTarget(null); }}>
                    <DialogContent className="sm:max-w-[420px] border-none shadow-2xl rounded-3xl p-6">
                        <DialogHeader className="space-y-2">
                            <DialogTitle className="text-base font-black text-slate-900 tracking-tight">
                                Delete Company Entity
                            </DialogTitle>
                            <DialogDescription className="text-xs text-slate-500">
                                Are you sure you want to delete <span className="font-bold text-slate-900">{companyDeleteTarget?.name}</span>?
                                Any locations belonging to this company will become unassigned.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter className="flex gap-2.5 pt-4">
                            <Button
                                variant="ghost"
                                onClick={() => setCompanyDeleteTarget(null)}
                                className="rounded-xl h-10 text-slate-600 font-bold text-xs flex-1"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleCompanyDelete}
                                disabled={companyDeleting}
                                className="flex-1 h-10 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-sm"
                            >
                                {companyDeleting ? "Deleting…" : "Delete Company"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </ProtectedRoute>
    );
}

// ──────────────────────────────────────────────────────────────
// Reusable Branch Card Component
// ──────────────────────────────────────────────────────────────

interface BranchCardProps {
    office: OfficeRecord;
    isAdmin: boolean;
    canDelete: boolean;
    onViewDetail: () => void;
    onViewGeoFence: () => void;
    onEdit: () => void;
    onDelete: () => void;
}

function BranchCard({
    office,
    isAdmin,
    canDelete,
    onViewDetail,
    onViewGeoFence,
    onEdit,
    onDelete,
}: BranchCardProps) {
    const activeStaff = office.active_employee_count ?? office.employee_count ?? 0;

    return (
        <Card className="border border-slate-200/80 bg-white rounded-2xl p-5 shadow-xs hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between gap-4 group">
            <div className="space-y-3.5">
                {/* Header row: Name, Code badge & Active badge */}
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h3 className="text-sm font-black text-slate-900 tracking-tight truncate group-hover:text-indigo-600 transition-colors">
                            {office.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                {office.code || `LOC-${office.id}`}
                            </span>
                            {office.company?.name && (
                                <span className="text-[11px] text-slate-400 font-medium truncate">
                                    {office.company.name}
                                </span>
                            )}
                        </div>
                    </div>
                    <Badge
                        className={cn(
                            "shrink-0 font-bold text-[9px] uppercase tracking-wider border-none px-2 py-0.5",
                            office.is_active
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-slate-100 text-slate-500"
                        )}
                    >
                        {office.is_active ? "Active" : "Inactive"}
                    </Badge>
                </div>

                {/* City & Address */}
                {(office.city || office.state || office.address) && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-600">
                        <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">
                            {[office.address, office.city, office.state].filter(Boolean).join(", ")}
                        </span>
                    </div>
                )}

                {/* Geo-fence Badge (Clickable) */}
                <div className="flex items-center flex-wrap gap-2 pt-1">
                    <button
                        type="button"
                        onClick={onViewGeoFence}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors cursor-pointer"
                        title="Click to view geo-fence on map"
                    >
                        <Target className="h-3.5 w-3.5 text-indigo-500" />
                        <span>{office.radius_meters}m Geo-fence</span>
                    </button>

                    <a
                        href={`https://www.google.com/maps?q=${office.latitude},${office.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-400 hover:text-indigo-600 hover:underline"
                        title="Open GPS in Google Maps"
                    >
                        <span>({Number(office.latitude).toFixed(4)}, {Number(office.longitude).toFixed(4)})</span>
                        <ArrowUpRight className="h-3 w-3 text-slate-300" />
                    </a>
                </div>

                {/* Site In-Charge Contact */}
                {(office.contact_person || office.contact_phone) && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 pt-0.5">
                        <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">
                            {office.contact_person}
                            {office.contact_person && office.contact_phone && " • "}
                            {office.contact_phone}
                        </span>
                    </div>
                )}
            </div>

            {/* Footer row: Staff assigned + Quick Action buttons */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-emerald-600" />
                    <span className="text-xs font-bold text-slate-700">
                        {activeStaff} <span className="font-normal text-slate-400">active staff</span>
                    </span>
                </div>

                <div className="flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg hover:bg-indigo-50 text-slate-500 hover:text-indigo-600"
                        onClick={onViewDetail}
                        title="View Hub Biometrics & Details"
                    >
                        <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                    {isAdmin && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-lg hover:bg-amber-50 text-slate-500 hover:text-amber-600"
                            onClick={onEdit}
                            title="Edit Location"
                        >
                            <Pencil className="h-3.5 w-3.5" />
                        </Button>
                    )}
                    {canDelete && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-lg hover:bg-rose-50 text-slate-500 hover:text-rose-600"
                            onClick={onDelete}
                            title="Delete Location"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                    )}
                </div>
            </div>
        </Card>
    );
}
