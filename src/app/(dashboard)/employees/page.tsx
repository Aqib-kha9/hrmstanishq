"use client";

import { cn } from "@/lib/utils";
import { useRole } from "@/context/RoleContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useState, useEffect } from "react";
import Link from "next/link";
import {
    Users,
    Search,
    Filter,
    UserPlus,
    Mail,
    Phone,
    MapPin,
    MoreVertical,
    LayoutGrid,
    List,
    ChevronDown,
    Briefcase,
    Building2,
    ArrowUpRight,
    User,
    Plus,
    UserCheck,
    Clock,
    UserX,
    Check,
    KeyRound,
    Copy,
    ClipboardCheck,
    Loader2,
    CheckCircle2,
    FileSpreadsheet
} from "lucide-react";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuLabel,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog";
import { apiGet, apiPatch, apiDelete, apiPut, apiPost } from "@/lib/api-client";
import { toFrontendEmployee, type BackendEmployee, type FrontendEmployee } from "@/lib/transform";
import { BulkImportModal } from "@/components/BulkImportModal";

export default function EmployeesPage() {
    const { hasPermission } = useRole();
    const [searchTerm, setSearchTerm] = useState("");
    const [personnel, setPersonnel] = useState<FrontendEmployee[]>([]);
    const [recentEmployees, setRecentEmployees] = useState<any[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [companies, setCompanies] = useState<{ id: number; name: string }[]>([]);
    const [offices, setOffices] = useState<{ id: number; name: string }[]>([]);
    const [selectedCompanyId, setSelectedCompanyId] = useState("");
    const [selectedOfficeId, setSelectedOfficeId] = useState("");
    const itemsPerPage = 8;

    // Admin password reset state
    const [resetDialogOpen, setResetDialogOpen] = useState(false);
    const [resetLoading, setResetLoading] = useState(false);
    const [resetResult, setResetResult] = useState<{ name: string; password: string; copied: boolean } | null>(null);
    const [resetTarget, setResetTarget] = useState<FrontendEmployee | null>(null);
    const [customPassword, setCustomPassword] = useState("");

    // Operation action loading state
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    // Bulk Import state
    const [importDialogOpen, setImportDialogOpen] = useState(false);

    // Re-hire state (Req 23)
    const [rehireDialogOpen, setRehireDialogOpen] = useState(false);
    const [resignedEmployees, setResignedEmployees] = useState<any[]>([]);
    const [rehireLoading, setRehireLoading] = useState(false);
    const [selectedResignedId, setSelectedResignedId] = useState("");
    const [rehireForm, setRehireForm] = useState({
        designation: "",
        department: "",
        fixed_gross: "",
        office_id: "",
        date_of_joining: new Date().toISOString().split("T")[0],
        notes: "",
    });

    useEffect(() => {
        async function fetchLookups() {
            try {
                const [compData, offData, recentData] = await Promise.all([
                    apiGet<{ id: number; name: string }[]>("/companies"),
                    apiGet<{ id: number; name: string }[]>("/offices", { limit: 100 }),
                    apiGet<any[]>("/employees/recently-added?limit=5").catch(() => []),
                ]);
                setCompanies(compData || []);
                setOffices(offData || []);
                setRecentEmployees(recentData || []);
            } catch (err) {
                console.error("Failed to load lookup data:", err);
            }
        }
        fetchLookups();
    }, []);

    const fetchResignedEmployees = async () => {
        try {
            const data = await apiGet<any[]>("/employees", { status: "resigned,inactive", limit: 100 });
            setResignedEmployees(data || []);
        } catch (err) {
            console.error("Failed to fetch resigned employees:", err);
        }
    };

    const handleOpenRehire = () => {
        fetchResignedEmployees();
        setSelectedResignedId("");
        setRehireDialogOpen(true);
    };

    const executeRehire = async () => {
        if (!selectedResignedId) {
            alert("Please select a resigned employee to re-hire.");
            return;
        }
        setRehireLoading(true);
        try {
            await apiPost(`/employees/${selectedResignedId}/rehire`, {
                designation: rehireForm.designation || undefined,
                department: rehireForm.department || undefined,
                fixed_gross: rehireForm.fixed_gross ? Number(rehireForm.fixed_gross) : undefined,
                office_id: rehireForm.office_id ? Number(rehireForm.office_id) : undefined,
                date_of_joining: rehireForm.date_of_joining || undefined,
                notes: rehireForm.notes || undefined,
            });
            alert("Employee re-hired successfully! Status updated to active.");
            setRehireDialogOpen(false);
            window.location.reload();
        } catch (err: any) {
            console.error("Failed to re-hire:", err);
            alert(err?.message || "Failed to re-hire employee.");
        } finally {
            setRehireLoading(false);
        }
    };

    useEffect(() => {
        async function fetchEmployees() {
            try {
                setLoading(true);
                const params: Record<string, string | number> = { limit: 1000 };
                if (selectedCompanyId) params.company_id = selectedCompanyId;
                if (selectedOfficeId) params.office_id = selectedOfficeId;
                const data = await apiGet<BackendEmployee[]>("/employees", params);
                const transformed = data.map(toFrontendEmployee);
                setPersonnel(transformed);
            } catch (err) {
                console.error("Failed to load employees:", err);
                setPersonnel([]);
            } finally {
                setLoading(false);
            }
        }
        fetchEmployees();
    }, [selectedCompanyId, selectedOfficeId]);

    const filteredPersonnel = personnel.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.dept.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Pagination Logic
    const totalPages = Math.ceil(filteredPersonnel.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedPersonnel = filteredPersonnel.slice(startIndex, startIndex + itemsPerPage);

    const updateStatus = async (emp: FrontendEmployee, newStatus: 'active' | 'inactive' | 'resigned') => {
        try {
            await apiPatch(`/employees/${emp.employeeId}/status`, { status: newStatus });
            const displayMap: Record<string, string> = {
                active: "Active",
                inactive: "Inactive",
                resigned: "Resigned",
            };
            setPersonnel(prev => prev.map(p =>
                p.employeeId === emp.employeeId
                    ? { ...p, status: displayMap[newStatus] || "Active" }
                    : p
            ));
        } catch (err) {
            console.error("Failed to update status:", err);
            alert("Failed to update employee status");
        }
    };

    const toggleStatus = async (emp: FrontendEmployee) => {
        const currentBackendStatus = emp.status === "Active" ? "active" : "inactive";
        const newBackendStatus = currentBackendStatus === "active" ? "inactive" : "active";
        setActionLoading(`Updating status to ${newBackendStatus} for ${emp.name}...`);
        try {
            await apiPatch(`/employees/${emp.employeeId}/status`, { status: newBackendStatus });
            setPersonnel(prev => prev.map(p =>
                p.employeeId === emp.employeeId
                    ? { ...p, status: newBackendStatus === "active" ? "Active" : "Inactive" }
                    : p
            ));
        } catch (err: any) {
            console.error("Failed to update status:", err);
            const msg = err.response?.data?.message || err.message || "Failed to update employee status.";
            alert(msg);
        } finally {
            setActionLoading(null);
        }
    };

    const deleteEmployee = async (emp: FrontendEmployee) => {
        if (!window.confirm(`HARD DELETE ${emp.name} (${emp.id})? This is for TESTING ONLY. All associated records will be permanently destroyed.`)) return;
        setActionLoading(`Deleting employee ${emp.name} (${emp.id}). Please wait...`);
        try {
            await apiDelete(`/employees/${emp.employeeId}`);
            setPersonnel(prev => prev.filter(p => p.employeeId !== emp.employeeId));
        } catch (err: any) {
            console.error("Failed to delete employee:", err);
            const msg = err.response?.data?.message || err.message || "Failed to delete employee.";
            alert(msg);
        } finally {
            setActionLoading(null);
        }
    };

    const handleAdminResetPassword = (emp: FrontendEmployee) => {
        setResetTarget(emp);
        setResetResult(null);
        setCustomPassword("");
        setResetDialogOpen(true);
    };

    const executeAdminResetPassword = async (useCustom: boolean) => {
        if (!resetTarget) return;
        if (useCustom && !customPassword) {
            alert("Please enter a custom password.");
            return;
        }
        setResetLoading(true);
        try {
            const data = await apiPut<{ employee_id: number; emp_code: string; name: string; new_password: string }>(
                `/employees/${resetTarget.employeeId}/admin-reset-password`,
                { customPassword: useCustom ? customPassword : null }
            );
            setResetResult({ name: data.name, password: data.new_password, copied: false });
        } catch (err) {
            console.error("Failed to reset password:", err);
            setResetResult({ name: resetTarget.name, password: "", copied: false });
            alert("Failed to reset password. Make sure you have admin privileges.");
            setResetDialogOpen(false);
        } finally {
            setResetLoading(false);
        }
    };

    const copyToClipboard = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setResetResult(prev => prev ? { ...prev, copied: true } : null);
            setTimeout(() => {
                setResetResult(prev => prev ? { ...prev, copied: false } : null);
            }, 2000);
        } catch {
            // Fallback
            const textArea = document.createElement("textarea");
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand("copy");
            document.body.removeChild(textArea);
            setResetResult(prev => prev ? { ...prev, copied: true } : null);
            setTimeout(() => {
                setResetResult(prev => prev ? { ...prev, copied: false } : null);
            }, 2000);
        }
    };

    return (
        <ProtectedRoute module="EMPLOYEES" action="READ">
            <div className="space-y-8 pb-20">
                {/* Simple Header */}
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between px-2 pt-4">
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 italic uppercase tracking-tighter underline underline-offset-8 decoration-[#D9F99D] decoration-4">Employee List</h1>
                        <p className="text-[10px] font-bold text-slate-400 mt-4 uppercase tracking-[0.2em]">Manage your team members and their information.</p>
                    </div>

                    {hasPermission('EMPLOYEES', 'CREATE') && (
                        <div className="flex items-center gap-3">
                            <Button 
                                onClick={handleOpenRehire}
                                variant="outline" 
                                className="border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100 font-black uppercase text-[10px] tracking-widest px-5 h-12 rounded-xl shadow-sm transition-all flex items-center gap-2"
                            >
                                <UserCheck className="h-4 w-4 text-amber-600" /> Re-Hire Employee
                            </Button>
                            <Button 
                                onClick={() => setImportDialogOpen(true)}
                                variant="outline" 
                                className="border-slate-200 text-slate-600 hover:bg-slate-50 font-black uppercase text-[10px] tracking-widest px-6 h-12 rounded-xl shadow-sm transition-all flex items-center gap-2"
                            >
                                <FileSpreadsheet className="h-4 w-4" /> Import Excel
                            </Button>
                            <Link href="/onboarding">
                                <Button className="bg-slate-900 text-white hover:bg-black font-black uppercase text-[10px] tracking-widest px-8 h-12 rounded-xl shadow-lg transition-all flex items-center gap-3">
                                    <Plus className="h-5 w-5 stroke-[3]" /> Add New Employee
                                </Button>
                            </Link>
                        </div>
                    )}
                </div>

                {/* Req 1.1: Recently Added Employees Section */}
                {recentEmployees.length > 0 && (
                    <div className="px-2">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                <h3 className="text-xs font-black uppercase tracking-[0.18em] text-slate-700">Recently Added Team Members</h3>
                                <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2 py-0.5">
                                    New
                                </Badge>
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Latest {recentEmployees.length} onboards</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                            {recentEmployees.map((emp) => (
                                <Link 
                                    href={`/employees/${emp.id}`}
                                    key={emp.id}
                                    className="group relative bg-white border border-slate-200/80 hover:border-slate-900 rounded-2xl p-4 transition-all duration-300 shadow-sm hover:shadow-md flex flex-col justify-between"
                                >
                                    <div>
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-slate-900 to-slate-700 text-white font-black text-xs flex items-center justify-center shadow">
                                                {emp.name?.slice(0, 2).toUpperCase()}
                                            </div>
                                            <Badge className="bg-slate-100 text-slate-700 border-none font-mono text-[9px] font-bold">
                                                {emp.emp_code}
                                            </Badge>
                                        </div>
                                        <h4 className="font-black text-sm text-slate-900 truncate group-hover:text-indigo-600 transition-colors">
                                            {emp.name}
                                        </h4>
                                        <p className="text-[11px] font-bold text-slate-500 truncate mt-0.5">
                                            {emp.designation || "Staff"}
                                        </p>
                                        <p className="text-[10px] text-slate-400 truncate">
                                            {emp.department || "General"}
                                        </p>
                                    </div>
                                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px]">
                                        <span className="text-slate-400 font-medium">
                                            {emp.date_of_joining ? new Date(emp.date_of_joining).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "Recent"}
                                        </span>
                                        <span className="font-bold text-slate-600 truncate max-w-[80px]">
                                            {emp.office?.name || emp.location || "Office"}
                                        </span>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}

                {/* Search & Filter Bar */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center px-2">
                    <div className="lg:col-span-5 relative group">
                        <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 group-focus-within:text-slate-900 transition-colors" />
                        <Input
                            placeholder="Search by name, ID, or department..."
                            className="w-full bg-white border-slate-100 pl-14 h-14 rounded-2xl font-bold text-xs shadow-sm focus-visible:ring-1 focus-visible:ring-[#D9F99D]"
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setCurrentPage(1);
                            }}
                        />
                    </div>
                    <div className="lg:col-span-2 flex items-center gap-2 bg-white px-3 h-14 rounded-2xl border border-slate-100 shadow-sm">
                        <Building2 className="h-4 w-4 text-slate-300 shrink-0" />
                        <select
                            value={selectedCompanyId}
                            onChange={(e) => { setSelectedCompanyId(e.target.value); setCurrentPage(1); }}
                            className="bg-transparent border-none text-[10px] font-black uppercase text-slate-500 outline-none w-full"
                        >
                            <option value="">All Companies</option>
                            {companies.map((c) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="lg:col-span-2 flex items-center gap-2 bg-white px-3 h-14 rounded-2xl border border-slate-100 shadow-sm">
                        <MapPin className="h-4 w-4 text-slate-300 shrink-0" />
                        <select
                            value={selectedOfficeId}
                            onChange={(e) => { setSelectedOfficeId(e.target.value); setCurrentPage(1); }}
                            className="bg-transparent border-none text-[10px] font-black uppercase text-slate-500 outline-none w-full"
                        >
                            <option value="">All Offices</option>
                            {offices.map((o) => (
                                <option key={o.id} value={o.id}>{o.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="lg:col-span-3 flex items-center justify-between bg-white px-8 h-14 rounded-2xl border border-slate-100 shadow-sm">
                        <div className="text-center">
                            <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Total</p>
                            <p className="text-sm font-black italic text-slate-900">{personnel.length}</p>
                        </div>
                        <div className="h-6 w-[1px] bg-slate-100" />
                        <div className="text-center">
                            <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Active</p>
                            <p className="text-sm font-black italic text-emerald-500">{personnel.filter(p => p.status === 'Active').length}</p>
                        </div>
                        <div className="h-6 w-[1px] bg-slate-100" />
                        <div className="text-center">
                            <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-0.5">On Leave</p>
                            <p className="text-sm font-black italic text-amber-500">{personnel.filter(p => p.status !== 'Active').length}</p>
                        </div>
                    </div>
                </div>

                {/* Main Table View */}
                <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden mx-2">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 space-y-4">
                            <Users className="h-12 w-12 text-slate-100 animate-pulse" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">Loading Personnel...</p>
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse min-w-[800px]">
                                    <thead>
                                        <tr className="bg-slate-50/50 border-b border-slate-100">
                                            <th className="text-left py-5 px-8 text-[9px] font-black text-slate-400 uppercase tracking-widest">Employee</th>
                                            <th className="text-left py-5 px-8 text-[9px] font-black text-slate-400 uppercase tracking-widest">Contact Info</th>
                                            <th className="text-left py-5 px-8 text-[9px] font-black text-slate-400 uppercase tracking-widest">Job Details</th>
                                            <th className="text-left py-5 px-8 text-[9px] font-black text-slate-400 uppercase tracking-widest">Company</th>
                                            <th className="text-left py-5 px-8 text-[9px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                                            <th className="text-right py-5 px-8 text-[9px] font-black text-slate-400 uppercase tracking-widest">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginatedPersonnel.map((emp) => (
                                            <tr key={emp.employeeId} className="border-b border-slate-50 hover:bg-slate-50/30 transition-colors group">
                                                <td className="py-5 px-8">
                                                    <div className="flex items-center gap-4">
                                                        <div className={cn(
                                                            "h-10 w-10 rounded-xl flex items-center justify-center font-black italic text-sm shadow-sm border border-white",
                                                            emp.color === 'blue' ? "bg-blue-50 text-blue-500" : emp.color === 'amber' ? "bg-amber-50 text-amber-500" : emp.color === 'indigo' ? "bg-indigo-50 text-indigo-500" : "bg-emerald-50 text-emerald-500"
                                                        )}>
                                                            {emp.name.charAt(0)}
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <Link href={`/employees/${emp.employeeId}`} className="hover:underline">
                                                                <span className="text-xs font-black text-slate-900 italic uppercase tracking-tighter cursor-pointer">{emp.name}</span>
                                                            </Link>
                                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">ID: {emp.id}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-5 px-8">
                                                    <div className="space-y-1">
                                                        <p className="text-[10px] font-bold text-slate-700 lowercase flex items-center gap-2"><Mail className="h-3 w-3 text-slate-300" /> {emp.email}</p>
                                                        <p className="text-[10px] font-bold text-slate-400 flex items-center gap-2"><Phone className="h-3 w-3 text-slate-300" /> {emp.phone}</p>
                                                    </div>
                                                </td>
                                                <td className="py-5 px-8">
                                                    <div className="space-y-1">
                                                        <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest">{emp.jobTitle || "Team Member"}</p>
                                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2"><MapPin className="h-3 w-3 text-slate-300" /> {emp.location}</p>
                                                    </div>
                                                </td>
                                                <td className="py-5 px-8">
                                                    <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest">{emp.company}</p>
                                                </td>
                                                <td className="py-5 px-8">
                                                    <Badge className={cn(
                                                        "font-black text-[8px] uppercase tracking-widest px-3 py-1 rounded-lg border-none",
                                                        emp.status === 'Active' ? "bg-emerald-50 text-emerald-600" : emp.status === 'Resigned' ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-600"
                                                    )}>
                                                        {emp.status}
                                                    </Badge>
                                                </td>
                                                <td className="py-5 px-8 text-right">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl hover:bg-slate-100">
                                                                <MoreVertical className="h-4 w-4 text-slate-300" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="rounded-2xl p-2 border-slate-100 shadow-xl w-48">
                                                            <Link href={`/employees/${emp.employeeId}`}>
                                                                <DropdownMenuItem className="font-bold text-[9px] uppercase tracking-widest p-2.5 rounded-xl cursor-pointer">View Profile</DropdownMenuItem>
                                                            </Link>
                                                            {hasPermission('EMPLOYEES', 'UPDATE') && (
                                                                emp.status === 'Active' ? (
                                                                    <>
                                                                        <DropdownMenuItem onClick={() => updateStatus(emp, 'inactive')} className="font-bold text-[9px] uppercase tracking-widest p-2.5 rounded-xl cursor-pointer text-amber-600">
                                                                            Deactivate Employee
                                                                        </DropdownMenuItem>
        
                                                                        <DropdownMenuItem onClick={() => updateStatus(emp, 'resigned')} className="font-bold text-[9px] uppercase tracking-widest p-2.5 rounded-xl cursor-pointer text-rose-600">
                                                                            Mark as Resigned
                                                                        </DropdownMenuItem>
        
                                                                    </>
                                                                ) : (
                                                                    <DropdownMenuItem onClick={() => updateStatus(emp, 'active')} className="font-bold text-[9px] uppercase tracking-widest p-2.5 rounded-xl cursor-pointer text-emerald-600">
                                                                        Activate Employee
                                                                    </DropdownMenuItem>
    
                                                                )



                                                            )}
                                                            {hasPermission('EMPLOYEES', 'UPDATE') && (
                                                                <DropdownMenuItem onClick={() => handleAdminResetPassword(emp)} className="font-bold text-[9px] uppercase tracking-widest p-2.5 rounded-xl cursor-pointer text-indigo-600">
                                                                    <KeyRound className="mr-2 h-3 w-3" />
                                                                    Reset Password
                                                                </DropdownMenuItem>

                                                            )}
                                                            {hasPermission('EMPLOYEES', 'DELETE') && (
                                                                <DropdownMenuItem onClick={() => deleteEmployee(emp)} className="font-bold text-[9px] uppercase tracking-widest p-2.5 rounded-xl text-rose-500 cursor-pointer">Hard Delete (Testing)</DropdownMenuItem>
                                                            )}
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination Controls */}
                            <div className="bg-slate-50/50 px-8 py-4 border-t border-slate-100 flex items-center justify-between">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                    Showing <span className="text-slate-900">{startIndex + 1}</span> to <span className="text-slate-900">{Math.min(startIndex + itemsPerPage, filteredPersonnel.length)}</span> of <span className="text-slate-900">{filteredPersonnel.length}</span> Employees
                                </p>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={currentPage === 1}
                                        onClick={() => setCurrentPage(currentPage - 1)}
                                        className="h-9 px-4 rounded-xl border-slate-200 font-black text-[9px] uppercase tracking-widest hover:bg-white disabled:opacity-30 transition-all"
                                    >
                                        Previous
                                    </Button>
                                    <div className="flex items-center gap-1">
                                        {[...Array(totalPages)].map((_, i) => (
                                            <Button
                                                key={i}
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setCurrentPage(i + 1)}
                                                className={cn(
                                                    "h-9 w-9 rounded-xl font-black text-[9px] transition-all",
                                                    currentPage === i + 1 ? "bg-slate-900 text-white hover:bg-black" : "text-slate-400 hover:bg-white"
                                                )}
                                            >
                                                {i + 1}
                                            </Button>
                                        ))}
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={currentPage === totalPages}
                                        onClick={() => setCurrentPage(currentPage + 1)}
                                        className="h-9 px-4 rounded-xl border-slate-200 font-black text-[9px] uppercase tracking-widest hover:bg-white disabled:opacity-30 transition-all"
                                    >
                                        Next
                                    </Button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Admin Reset Password Dialog */}
            <Dialog open={resetDialogOpen} onOpenChange={(open) => { if (!open) { setResetDialogOpen(false); setResetResult(null); setResetTarget(null); setCustomPassword(""); } }}>
                <DialogContent className="sm:max-w-[460px] border-none shadow-2xl rounded-3xl p-8">
                    {resetLoading ? (
                        <div className="flex flex-col items-center justify-center py-12 space-y-4">
                            <div className="h-12 w-12 rounded-full bg-indigo-100 flex items-center justify-center">
                                <Loader2 className="h-6 w-6 text-indigo-600 animate-spin" />
                            </div>
                            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Resetting Password...</p>
                            <p className="text-[10px] text-slate-400">Updating password for {resetTarget?.name}</p>
                        </div>
                    ) : resetResult ? (
                        <>
                            <DialogHeader className="space-y-2 text-center">
                                <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
                                    <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                                </div>
                                <DialogTitle className="text-xl font-black text-slate-900">Password Reset!</DialogTitle>
                                <p className="text-xs text-slate-500">
                                    A new password has been generated for <span className="font-bold text-slate-700">{resetResult.name}</span>.
                                    Please communicate it securely.
                                </p>
                            </DialogHeader>
                            <div className="mt-6 bg-slate-50 rounded-2xl p-6 border border-slate-100">
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-3">New Password</p>
                                <div className="flex items-center gap-3">
                                    <code className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-lg font-mono font-bold text-slate-900 text-center tracking-wider select-all">
                                        {resetResult.password}
                                    </code>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={() => copyToClipboard(resetResult.password)}
                                        className="h-11 w-11 rounded-xl border-slate-200 shrink-0 hover:bg-indigo-50 hover:border-indigo-200 transition-all"
                                        title="Copy to clipboard"
                                    >
                                        {resetResult.copied ? (
                                            <ClipboardCheck className="h-4 w-4 text-emerald-500" />
                                        ) : (
                                            <Copy className="h-4 w-4 text-slate-400" />
                                        )}
                                    </Button>
                                </div>
                                {resetResult.copied && (
                                    <p className="text-[9px] font-bold text-emerald-500 mt-2 text-center">Copied to clipboard!</p>
                                )}
                            </div>
                            <DialogFooter className="mt-6 sm:justify-center">
                                <Button
                                    onClick={() => { setResetDialogOpen(false); setResetResult(null); setResetTarget(null); }}
                                    className="bg-slate-900 text-white hover:bg-black font-black uppercase text-[9px] tracking-widest px-8 h-11 rounded-xl shadow-lg"
                                >
                                    Done
                                </Button>
                            </DialogFooter>
                        </>
                    ) : resetTarget ? (
                        <>
                            <DialogHeader className="space-y-2 text-center">
                                <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100">
                                    <KeyRound className="h-6 w-6 text-indigo-600" />
                                </div>
                                <DialogTitle className="text-xl font-black text-slate-900">Reset Password</DialogTitle>
                                <p className="text-xs text-slate-500">
                                    Reset password for <span className="font-bold text-slate-700">{resetTarget.name}</span>
                                </p>
                            </DialogHeader>
                            <div className="mt-6 space-y-4">
                                <div>
                                    <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Custom Password (Optional)</Label>
                                    <Input
                                        type="text"
                                        placeholder="Enter custom password..."
                                        value={customPassword}
                                        onChange={(e) => setCustomPassword(e.target.value)}
                                        className="h-12 rounded-xl bg-slate-50 border-slate-100 font-bold"
                                    />
                                </div>
                                <div className="flex flex-col gap-3 pt-2">
                                    <Button
                                        onClick={() => executeAdminResetPassword(true)}
                                        disabled={!customPassword}
                                        className="bg-indigo-600 text-white hover:bg-indigo-700 font-black uppercase text-[10px] tracking-widest h-12 rounded-xl shadow-lg transition-all"
                                    >
                                        Set Custom Password
                                    </Button>
                                    <div className="relative flex items-center py-2">
                                        <div className="flex-grow border-t border-slate-100"></div>
                                        <span className="flex-shrink-0 mx-4 text-[10px] font-black text-slate-300 uppercase tracking-widest">OR</span>
                                        <div className="flex-grow border-t border-slate-100"></div>
                                    </div>
                                    <Button
                                        onClick={() => executeAdminResetPassword(false)}
                                        variant="outline"
                                        className="border-slate-200 text-slate-600 hover:bg-slate-50 font-black uppercase text-[10px] tracking-widest h-12 rounded-xl transition-all"
                                    >
                                        Auto-Generate Password
                                    </Button>
                                </div>
                            </div>
                        </>
                    ) : null}
                </DialogContent>
            </Dialog>

            {/* Re-hire Resigned Employee Modal (Req 23) */}
            <Dialog open={rehireDialogOpen} onOpenChange={setRehireDialogOpen}>
                <DialogContent className="sm:max-w-[500px] p-6 rounded-3xl bg-white border-none shadow-2xl">
                    <DialogHeader className="space-y-2 text-left">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 mb-2">
                            <UserCheck className="h-6 w-6 stroke-[2.5]" />
                        </div>
                        <DialogTitle className="text-xl font-black text-slate-900 tracking-tight">Re-Hire Former / Resigned Employee</DialogTitle>
                        <p className="text-xs text-slate-500">
                            Re-activate a previously resigned or inactive employee with updated role, department, salary, or branch while preserving their audit history.
                        </p>
                    </DialogHeader>

                    <div className="space-y-4 py-3">
                        <div>
                            <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">
                                Select Former Employee (Resigned / Inactive) *
                            </Label>
                            <select
                                value={selectedResignedId}
                                onChange={(e) => {
                                    const id = e.target.value;
                                    setSelectedResignedId(id);
                                    const match = resignedEmployees.find(r => r.id.toString() === id);
                                    if (match) {
                                        setRehireForm({
                                            designation: match.designation || "",
                                            department: match.department || "",
                                            fixed_gross: match.fixed_gross?.toString() || "",
                                            office_id: match.office_id?.toString() || "",
                                            date_of_joining: new Date().toISOString().split("T")[0],
                                            notes: "",
                                        });
                                    }
                                }}
                                className="w-full h-12 rounded-xl bg-slate-50 border border-slate-200 px-3 text-xs font-bold text-slate-900 outline-none"
                            >
                                <option value="">-- Select from former / resigned employees ({resignedEmployees.length}) --</option>
                                {resignedEmployees.map((r) => (
                                    <option key={r.id} value={r.id}>
                                        {r.name} ({r.emp_code}) — {r.department || r.designation || "Staff"} [{r.status ? r.status.toUpperCase() : "INACTIVE"}]
                                    </option>
                                ))}
                            </select>
                            {resignedEmployees.length === 0 && (
                                <p className="text-[10px] text-slate-400 mt-1">No employees currently have status &apos;resigned&apos; or &apos;inactive&apos;.</p>
                            )}
                        </div>

                        {selectedResignedId && (
                            <>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">New Designation</Label>
                                        <Input
                                            value={rehireForm.designation}
                                            onChange={(e) => setRehireForm(f => ({ ...f, designation: e.target.value }))}
                                            className="h-10 rounded-xl bg-slate-50 font-bold text-xs"
                                            placeholder="e.g. Senior Manager"
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Department</Label>
                                        <Input
                                            value={rehireForm.department}
                                            onChange={(e) => setRehireForm(f => ({ ...f, department: e.target.value }))}
                                            className="h-10 rounded-xl bg-slate-50 font-bold text-xs"
                                            placeholder="e.g. Operations"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Monthly Gross CTC (₹)</Label>
                                        <Input
                                            type="number"
                                            value={rehireForm.fixed_gross}
                                            onChange={(e) => setRehireForm(f => ({ ...f, fixed_gross: e.target.value }))}
                                            className="h-10 rounded-xl bg-slate-50 font-bold text-xs"
                                            placeholder="e.g. 50000"
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Re-joining Date</Label>
                                        <Input
                                            type="date"
                                            value={rehireForm.date_of_joining}
                                            onChange={(e) => setRehireForm(f => ({ ...f, date_of_joining: e.target.value }))}
                                            className="h-10 rounded-xl bg-slate-50 font-bold text-xs"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Assigned Office / Hub</Label>
                                    <select
                                        value={rehireForm.office_id}
                                        onChange={(e) => setRehireForm(f => ({ ...f, office_id: e.target.value }))}
                                        className="w-full h-10 rounded-xl bg-slate-50 border border-slate-200 px-3 text-xs font-bold text-slate-900 outline-none"
                                    >
                                        <option value="">Keep current office</option>
                                        {offices.map((o) => (
                                            <option key={o.id} value={o.id}>{o.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Re-Hiring Notes / Approval Reason</Label>
                                    <Input
                                        value={rehireForm.notes}
                                        onChange={(e) => setRehireForm(f => ({ ...f, notes: e.target.value }))}
                                        className="h-10 rounded-xl bg-slate-50 text-xs"
                                        placeholder="e.g. Re-hired after approved re-application"
                                    />
                                </div>
                            </>
                        )}
                    </div>

                    <DialogFooter className="mt-4 gap-2">
                        <Button
                            variant="outline"
                            onClick={() => setRehireDialogOpen(false)}
                            className="h-11 rounded-xl text-xs font-bold"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={executeRehire}
                            disabled={rehireLoading || !selectedResignedId}
                            className="bg-amber-600 text-white hover:bg-amber-700 font-black uppercase text-[10px] tracking-widest px-6 h-11 rounded-xl shadow-lg transition-all"
                        >
                            {rehireLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm Re-Hire"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Bulk Import Modal */}
            {hasPermission('EMPLOYEES', 'CREATE') && (
                <BulkImportModal 
                    open={importDialogOpen} 
                    onOpenChange={setImportDialogOpen} 
                    companies={companies} 
                    offices={offices} 
                    onSuccess={() => window.location.reload()} 
                />
            )}

            {/* Global Action Processing Overlay */}
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
