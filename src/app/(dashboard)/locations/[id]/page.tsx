"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import { apiGet } from "@/lib/api-client";
import {
    MapPin,
    ArrowLeft,
    Users,
    Activity,
    Shield,
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
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableHeader } from "@/components/ui/table";

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
    company?: { id: number; name: string } | null;
    employee_count?: number;
    active_employee_count?: number;
}

interface LiveLogEntry {
    id: string;
    name: string;
    designation: string;
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

    const [office, setOffice] = useState<OfficeDetail | null>(null);
    const [liveData, setLiveData] = useState<LiveAttendanceData | null>(null);
    const [loading, setLoading] = useState(true);
    const [liveLoading, setLiveLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // ── Fetch office detail ────────────────────────────────────
    const fetchOffice = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await apiGet<OfficeDetail>(`/offices/${id}`);
            setOffice(data);
        } catch (err: any) {
            const msg = err?.response?.data?.message || err?.message || "Failed to load location details";
            setError(msg);
        } finally {
            setLoading(false);
        }
    }, [id]);

    // ── Fetch live attendance ──────────────────────────────────
    const fetchLiveAttendance = useCallback(async () => {
        if (!office) return;
        setLiveLoading(true);
        try {
            const data = await apiGet<LiveAttendanceData>(
                `/attendance/admin/live?branch=${encodeURIComponent(office.name)}&limit=50`
            );
            setLiveData(data);
        } catch {
            // Live data is optional — fail silently
            setLiveData(null);
        } finally {
            setLiveLoading(false);
        }
    }, [office]);

    useEffect(() => {
        fetchOffice();
    }, [fetchOffice]);

    useEffect(() => {
        if (office) {
            fetchLiveAttendance();
        }
    }, [office, fetchLiveAttendance]);

    // ── Derived metrics ─────────────────────────────────────────
    const attendanceRate = liveData?.stats.total
        ? `${Math.round(((liveData.stats.present) / liveData.stats.total) * 100)}%`
        : "---";

    const lateIncidents = liveData?.stats.late ?? 0;
    const totalActiveEmployees = office?.active_employee_count ?? office?.employee_count ?? 0;

    // ── Loading state ───────────────────────────────────────────
    if (loading) {
        return (
            <div className="flex items-center justify-center py-32">
                <Loader2 className="h-10 w-10 animate-spin text-slate-300" />
            </div>
        );
    }

    // ── Error state ─────────────────────────────────────────────
    if (error || !office) {
        return (
            <div className="flex flex-col items-center justify-center py-32 space-y-4">
                <AlertCircle className="h-12 w-12 text-rose-300" />
                <p className="text-sm font-bold text-slate-500">{error || "Location not found"}</p>
                <Button
                    variant="outline"
                    onClick={() => router.back()}
                    className="rounded-2xl h-10 font-black text-[9px] uppercase tracking-widest"
                >
                    <ArrowLeft className="h-4 w-4 mr-2" /> Go Back
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-8 pb-20 animate-in fade-in duration-500">
            {/* ── Header / Breadcrumb ──────────────────────────── */}
            <div className="flex items-center gap-4">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => router.back()}
                    className="h-10 w-10 rounded-xl bg-white shadow-sm border border-slate-100 hover:bg-slate-50 transition-all"
                >
                    <ArrowLeft className="h-4 w-4 text-slate-600" />
                </Button>
                <div>
                    <h1 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter flex items-center gap-2">
                        {office.name}
                        <Badge
                            className={cn(
                                "font-black text-[7px] uppercase tracking-widest border-none",
                                office.is_active
                                    ? "bg-emerald-50 text-emerald-600"
                                    : "bg-slate-100 text-slate-500"
                            )}
                        >
                            {office.is_active ? "Operational" : "Inactive"}
                        </Badge>
                    </h1>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 pt-1">
                        <Building2 className="h-3 w-3" />
                        {office.company?.name || "No Company"} •
                        <MapPin className="h-3 w-3" />
                        {[office.city, office.state].filter(Boolean).join(", ") || "N/A"} •
                        ID: {office.code || office.id}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                {/* ── Left Column: Stats & Logs ────────────────── */}
                <div className="xl:col-span-2 space-y-8">
                    {/* Key Metrics Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {[
                            {
                                label: "Total Active Employees",
                                value: totalActiveEmployees,
                                icon: Users,
                                color: "blue",
                                trend: "Assigned",
                            },
                            {
                                label: "Attendance",
                                value: attendanceRate,
                                icon: Activity,
                                color: "emerald",
                                trend: "Today",
                            },
                            {
                                label: "Late Incidents",
                                value: lateIncidents,
                                icon: Shield,
                                color: "rose",
                                trend: "Today",
                            },
                        ].map((stat, i) => (
                            <Card
                                key={i}
                                className="border-none bg-white rounded-2xl p-6 shadow-sm group hover:shadow-md transition-all relative overflow-hidden"
                            >
                                <div
                                    className={cn(
                                        "absolute top-0 right-0 h-20 w-20 translate-x-8 -translate-y-8 rounded-full opacity-[0.03]",
                                        `bg-${stat.color}-500`
                                    )}
                                />
                                <div className="space-y-3 relative z-10">
                                    <div className="flex items-center justify-between">
                                        <div
                                            className={cn(
                                                "h-10 w-10 rounded-xl flex items-center justify-center",
                                                stat.color === "blue"
                                                    ? "bg-blue-50 text-blue-500"
                                                    : stat.color === "emerald"
                                                        ? "bg-emerald-50 text-emerald-500"
                                                        : "bg-rose-50 text-rose-500"
                                            )}
                                        >
                                            <stat.icon className="h-5 w-5" />
                                        </div>
                                        {stat.trend && (
                                            <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest">
                                                {stat.trend}
                                            </span>
                                        )}
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                            {stat.label}
                                        </p>
                                        <h3 className="text-2xl font-black text-slate-900 italic tracking-tighter mt-1">
                                            {stat.value}
                                        </h3>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>

                    {/* Branch Activity / Performance Chart */}
                    <Card className="border-none bg-white rounded-[2.5rem] p-1 shadow-sm overflow-hidden">
                        <CardHeader className="p-8 pb-4 border-none">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-lg font-black italic uppercase text-slate-900 tracking-tighter">
                                        Operational Analytics
                                    </CardTitle>
                                    <CardDescription className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                        Live Status Overview
                                    </CardDescription>
                                </div>
                                <div className="flex items-center gap-2">
                                    {liveData && (
                                        <Badge className="bg-slate-900 text-[#D9F99D] border-none font-black text-[7px] uppercase px-3 h-6 rounded-lg shadow-sm tracking-widest flex items-center gap-2">
                                            <TrendingUp className="h-3 w-3" />
                                            Present: {liveData.stats.present}/{liveData.stats.total}
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-8 pt-4">
                            <div className="h-64 w-full bg-slate-50/50 rounded-3xl border border-slate-100 flex items-end justify-center gap-6 p-6 relative overflow-hidden group">
                                {liveData ? (
                                    <>
                                        {/* Present bar */}
                                        <div className="flex flex-col items-center gap-3 flex-1 max-w-[120px]">
                                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                                                {liveData.stats.present}
                                            </span>
                                            <div
                                                className="w-full bg-emerald-400 rounded-t-xl transition-all duration-700 group-hover:bg-emerald-300"
                                                style={{
                                                    height: `${Math.max(
                                                        8,
                                                        (liveData.stats.present / Math.max(liveData.stats.total, 1)) * 160
                                                    )}px`,
                                                }}
                                            />
                                            <span className="text-[8px] font-black text-emerald-600 uppercase tracking-widest">
                                                Present
                                            </span>
                                        </div>
                                        {/* Late bar */}
                                        <div className="flex flex-col items-center gap-3 flex-1 max-w-[120px]">
                                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                                                {liveData.stats.late}
                                            </span>
                                            <div
                                                className="w-full bg-amber-400 rounded-t-xl transition-all duration-700 group-hover:bg-amber-300"
                                                style={{
                                                    height: `${Math.max(
                                                        8,
                                                        (liveData.stats.late / Math.max(liveData.stats.total, 1)) * 160
                                                    )}px`,
                                                }}
                                            />
                                            <span className="text-[8px] font-black text-amber-600 uppercase tracking-widest">
                                                Late
                                            </span>
                                        </div>
                                        {/* Absent bar */}
                                        <div className="flex flex-col items-center gap-3 flex-1 max-w-[120px]">
                                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                                                {liveData.stats.absent}
                                            </span>
                                            <div
                                                className="w-full bg-rose-300 rounded-t-xl transition-all duration-700 group-hover:bg-rose-200"
                                                style={{
                                                    height: `${Math.max(
                                                        8,
                                                        (liveData.stats.absent / Math.max(liveData.stats.total, 1)) * 160
                                                    )}px`,
                                                }}
                                            />
                                            <span className="text-[8px] font-black text-rose-500 uppercase tracking-widest">
                                                Absent
                                            </span>
                                        </div>
                                    </>
                                ) : (
                                    <p className="text-xs font-bold text-slate-400">No attendance data for today</p>
                                )}
                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.02)_0,transparent_100%)] pointer-events-none" />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Live Status Table */}
                    <Card className="border-none bg-white rounded-[2.5rem] shadow-sm overflow-hidden">
                        <CardHeader className="p-8 pb-4 border-none flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="text-lg font-black italic uppercase text-slate-900 tracking-tighter underline underline-offset-4 decoration-[#D9F99D]">
                                    Live Status Table
                                </CardTitle>
                                <CardDescription className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                    {liveLoading ? "Loading…" : `Today's Attendance Log — ${office.name}`}
                                </CardDescription>
                            </div>
                            <Button
                                variant="outline"
                                onClick={() => router.push("/attendance")}
                                className="h-10 px-6 rounded-xl border-slate-100 font-black text-[9px] uppercase tracking-widest hover:bg-slate-50"
                            >
                                <ExternalLink className="h-4 w-4 mr-2" /> View Attendance
                            </Button>
                        </CardHeader>
                        <CardContent className="p-0">
                            {liveLoading ? (
                                <div className="flex items-center justify-center py-16">
                                    <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
                                </div>
                            ) : !liveData || liveData.rows.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-center">
                                    <Users className="h-10 w-10 text-slate-200 mb-3" />
                                    <p className="text-sm font-bold text-slate-400">No attendance data</p>
                                    <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest mt-1">
                                        No records found for today
                                    </p>
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <tr className="bg-slate-50/50 border-b border-slate-100">
                                            <th className="text-left py-5 px-8 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                                Employee
                                            </th>
                                            <th className="text-left py-5 px-8 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                                Clock In
                                            </th>
                                            <th className="text-left py-5 px-8 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                                Device
                                            </th>
                                            <th className="text-left py-5 px-8 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                                Status
                                            </th>
                                        </tr>
                                    </TableHeader>
                                    <TableBody>
                                        {liveData.rows.slice(0, 20).map((log, i) => (
                                            <tr
                                                key={i}
                                                className="border-b border-slate-50 hover:bg-slate-50/30 transition-colors group"
                                            >
                                                <td className="py-5 px-8">
                                                    <div className="flex items-center gap-3">
                                                        <Avatar className="h-8 w-8 rounded-lg shadow-sm border border-white">
                                                            <AvatarFallback className="bg-slate-900 text-white text-[8px] font-black uppercase tracking-tighter">
                                                                {getInitials(log.name)}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <div className="flex flex-col">
                                                            <span className="text-[11px] font-black text-slate-900 italic uppercase tracking-tighter">
                                                                {log.name}
                                                            </span>
                                                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                                                {log.id}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-5 px-8">
                                                    <div className="flex items-center gap-2">
                                                        <Timer className="h-3 w-3 text-slate-300" />
                                                        <span className="text-[10px] font-black text-slate-700 tracking-tighter italic">
                                                            {formatTime(log.punchIn)}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="py-5 px-8">
                                                    <div className="flex items-center gap-2">
                                                        <Smartphone className="h-3 w-3 text-slate-400" />
                                                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                                                            {log.device}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="py-5 px-8">
                                                    <Badge
                                                        className={cn(
                                                            "font-black text-[8px] uppercase tracking-widest px-3 h-6 rounded-lg shadow-sm border-none",
                                                            log.status === "Present"
                                                                ? "bg-emerald-50 text-emerald-600"
                                                                : log.status === "Late"
                                                                    ? "bg-amber-50 text-amber-600"
                                                                    : "bg-rose-50 text-rose-600"
                                                        )}
                                                    >
                                                        {log.status}
                                                    </Badge>
                                                </td>
                                            </tr>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                            {liveData && liveData.rows.length > 20 && (
                                <div className="p-8 bg-slate-50/50 border-t border-slate-100 text-center">
                                    <Button
                                        variant="ghost"
                                        onClick={() => router.push("/attendance")}
                                        className="text-[9px] font-black uppercase text-slate-400 hover:text-slate-900 tracking-widest"
                                    >
                                        Load All Logs ({liveData.stats.total} Total)
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* ── Right Column: Settings & Details ──────────── */}
                <div className="space-y-8">
                    {/* Branch Details Card */}
                    <Card className="border-none bg-white rounded-[2.5rem] shadow-sm overflow-hidden p-8 space-y-8">
                        <div className="space-y-2">
                            <h3 className="text-sm font-black italic uppercase text-slate-900 tracking-tighter">
                                Branch Configuration
                            </h3>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                                Static information and technical parameters for this node.
                            </p>
                        </div>

                        <div className="space-y-6">
                            {/* Geo-fence */}
                            <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50/50 border border-slate-100 group hover:bg-white hover:shadow-md transition-all">
                                <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center group-hover:bg-blue-500 group-hover:text-white transition-colors shrink-0">
                                    <Navigation className="h-5 w-5" />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                                        Geo-Fence Coordinates
                                    </p>
                                    <p className="text-[11px] font-bold text-slate-900 tracking-widest font-mono">
                                        LAT: {Number(office.latitude).toFixed(4)}
                                    </p>
                                    <p className="text-[11px] font-bold text-slate-900 tracking-widest font-mono">
                                        LONG: {Number(office.longitude).toFixed(4)}
                                    </p>
                                    <Badge className="bg-slate-900 text-white border-none font-black text-[7px] uppercase px-2 h-4 mt-2">
                                        Radius: {office.radius_meters}m
                                    </Badge>
                                </div>
                            </div>

                            {/* Contact */}
                            <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50/50 border border-slate-100 group hover:bg-white hover:shadow-md transition-all">
                                <div className="h-10 w-10 rounded-xl bg-rose-50 flex items-center justify-center group-hover:bg-rose-500 group-hover:text-white transition-colors shrink-0">
                                    <User className="h-5 w-5" />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                                        Contact Person
                                    </p>
                                    <p className="text-sm font-black text-slate-900 italic tracking-tighter uppercase">
                                        {office.contact_person || "Not assigned"}
                                    </p>
                                    {office.contact_phone && (
                                        <p className="text-[10px] font-bold text-slate-400 flex items-center gap-2 pt-1 uppercase">
                                            <Phone className="h-3 w-3" /> {office.contact_phone}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Address */}
                            <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50/50 border border-slate-100 group hover:bg-white hover:shadow-md transition-all">
                                <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-white transition-colors shrink-0">
                                    <MapPin className="h-5 w-5" />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                                        Address
                                    </p>
                                    <p className="text-xs font-bold text-slate-700 leading-relaxed">
                                        {office.address || "No address provided"}
                                    </p>
                                    {office.city && office.state && (
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">
                                            {office.city}, {office.state}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Company Info */}
                            <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50/50 border border-slate-100 group hover:bg-white hover:shadow-md transition-all">
                                <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center group-hover:bg-indigo-500 group-hover:text-white transition-colors shrink-0">
                                    <Building2 className="h-5 w-5" />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                                        Parent Company
                                    </p>
                                    <p className="text-sm font-black text-slate-900 italic tracking-tighter uppercase">
                                        {office.company?.name || "Unassigned"}
                                    </p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">
                                        Code: {office.code || "N/A"} • {office.employee_count ?? 0} employees
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="pt-4 flex flex-col gap-3">
                            {isAdmin && (
                                <Button
                                    onClick={() => router.push(`/locations?edit=${office.id}`)}
                                    className="w-full h-12 rounded-2xl bg-slate-900 text-white font-black text-[9px] uppercase tracking-[0.2em] shadow-xl hover:translate-y-[-2px] transition-all"
                                >
                                    <Pencil className="h-4 w-4 mr-2" /> Edit Configuration
                                </Button>
                            )}
                            <Button
                                variant="outline"
                                onClick={() => router.push("/locations")}
                                className="w-full h-12 rounded-2xl border-slate-200 text-slate-600 font-black text-[9px] uppercase tracking-[0.2em] hover:bg-slate-50 transition-all"
                            >
                                <ArrowLeft className="h-4 w-4 mr-2" /> Back to Locations
                            </Button>
                        </div>
                    </Card>

                    {/* Operational Alerts */}
                    <Card className="border-none bg-[#FEF2F2] rounded-[2.5rem] shadow-sm p-8 space-y-6">
                        <div className="flex items-center gap-3 text-rose-600">
                            <AlertCircle className="h-5 w-5" />
                            <h3 className="text-sm font-black uppercase italic tracking-tighter">Status</h3>
                        </div>
                        <div className="space-y-4">
                            {[
                                {
                                    text: `Geo-fence radius: ${office.radius_meters}m — employees must be within this range to punch in/out.`,
                                    active: true,
                                },
                                {
                                    text: office.is_active
                                        ? "Location is active and accepting punches."
                                        : "Location is currently inactive. Employees cannot punch from here.",
                                    active: office.is_active,
                                },
                                {
                                    text: `${office.employee_count ?? 0} employees assigned to this location.`,
                                    active: true,
                                },
                            ].map((alert, i) => (
                                <div
                                    key={i}
                                    className="flex items-start gap-3 p-3 bg-white/50 rounded-xl border border-rose-100/50"
                                >
                                    <div
                                        className={cn(
                                            "h-1.5 w-1.5 rounded-full mt-1.5 shrink-0",
                                            alert.active ? "bg-emerald-500" : "bg-rose-500"
                                        )}
                                    />
                                    <p className="text-[10px] font-bold text-slate-600 leading-relaxed uppercase">
                                        {alert.text}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}
