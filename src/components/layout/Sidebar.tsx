"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    Users,
    UserPlus,
    Clock,
    CalendarDays,
    Wallet,
    TrendingUp,
    Settings,
    LogOut,
    MapPin,
    BarChart3,
    FileType,
    UserCircle,
    Shield,
    PieChart,
    Plane,
    Landmark
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useRole, ModuleName } from "@/context/RoleContext";
import { useAuth } from "@/context/AuthContext";

const navigation: { name: string, href: string, icon: any, module: ModuleName }[] = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard, module: 'DASHBOARD' },
    { name: "Employees", href: "/employees", icon: Users, module: 'EMPLOYEES' },
    { name: "Onboarding", href: "/onboarding", icon: UserPlus, module: 'EMPLOYEES' },
    { name: "Attendance", href: "/attendance", icon: Clock, module: 'ATTENDANCE' },
    { name: "Locations", href: "/locations", icon: MapPin, module: 'LOCATIONS' },
    { name: "Leave", href: "/leave", icon: CalendarDays, module: 'LEAVE' },
    { name: "Payroll", href: "/payroll", icon: Wallet, module: 'PAYROLL' },
    { name: "Analytics", href: "/payroll/analytics", icon: PieChart, module: 'PAYROLL' },
    { name: "Loans", href: "/loans", icon: Landmark, module: 'LOANS' },
    { name: "Letters", href: "/letters", icon: FileType, module: 'LETTERS' },
    { name: "Tour Expenses", href: "/tour-expenses", icon: Plane, module: 'TOUR_EXPENSES' },
    { name: "Reports", href: "/reports", icon: BarChart3, module: 'REPORTS' },
    { name: "Settings", href: "/settings", icon: Settings, module: 'SETTINGS' },
    { name: "Role Mgmt", href: "/settings/roles", icon: Shield, module: 'ROLE_MGMT' },
];

export function Sidebar() {
    const pathname = usePathname();
    const { role, hasPermission } = useRole();
    const auth = useAuth();
    const { logout } = auth;

    const filteredNavigation = navigation.filter(item => hasPermission(item.module, 'READ'));

    return (
        <aside className="hidden lg:flex h-full w-64 flex-col bg-white border-r border-slate-100 shrink-0">
            <div className="flex h-14 items-center px-6">
                <Link href="/" className="flex items-center gap-2">
                    <div className="h-8 w-8 flex items-center justify-center rounded-lg overflow-hidden bg-slate-50">
                        <img
                            src="/company_logopng.png"
                            alt="Company Logo"
                            className="h-7 w-7 object-contain"
                        />
                    </div>
                    <span className="font-bold text-lg tracking-tight text-slate-900 italic underline underline-offset-4 decoration-[#D9F99D]">HRMS</span>
                </Link>
            </div>

            <div className="px-4 py-3 mt-1">
                <div className="bg-slate-50/80 rounded-2xl p-3 border border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="h-8 w-8 rounded-xl bg-slate-900 text-[#D9F99D] flex items-center justify-center font-black text-xs shrink-0 shadow-sm">
                            {(auth.user?.name || "U").charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-black uppercase text-slate-800 truncate tracking-tight">
                                {auth.user?.name || "Authenticated User"}
                            </p>
                            <span className="text-[7.5px] font-bold text-slate-400 block truncate uppercase tracking-widest mt-0.5">
                                {auth.user?.department || "Operations"}
                            </span>
                        </div>
                    </div>
                    <Badge className={cn(
                        "text-[7px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border-none shrink-0",
                        (role || "").toUpperCase().includes("ADMIN")
                            ? "bg-indigo-50 text-indigo-700"
                            : (role || "").toUpperCase() === "HR"
                            ? "bg-emerald-50 text-emerald-700"
                            : (role || "").toUpperCase() === "MANAGER"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-slate-200 text-slate-700"
                    )}>
                        {role.replace(/_/g, " ")}
                    </Badge>
                </div>
            </div>

            <nav className="flex-1 space-y-1 px-4 py-2 overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-slate-300">
                {filteredNavigation.map((item) => (
                    <Link
                        key={item.name}
                        href={item.href}
                        className={cn(
                            "group flex items-center rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all duration-300",
                            pathname === item.href
                                ? "bg-[#D9F99D] text-slate-900 shadow-md shadow-[#D9F99D]/20 translate-x-1"
                                : "text-slate-400 hover:bg-slate-50 hover:text-slate-900"
                        )}
                    >
                        <item.icon className={cn(
                            "mr-3 h-3.5 w-3.5 transition-colors stroke-[2.5]",
                            pathname === item.href ? "text-slate-900" : "text-slate-300 group-hover:text-slate-900"
                        )} />
                        {item.name}
                    </Link>
                ))}
            </nav>

            <div className="p-4 mt-auto">
                <Button onClick={() => logout()} variant="ghost" className="w-full justify-start gap-3 h-10 rounded-xl text-slate-400 font-black uppercase text-[9px] tracking-widest px-4 hover:bg-rose-50 hover:text-rose-600 transition-all border border-transparent hover:border-rose-100">
                    <LogOut className="h-4 w-4 stroke-[2.5]" />
                    Log Out
                </Button>
            </div>
        </aside>
    );
}

export function MobileSidebar({ isOpen, onOpenChange }: { isOpen: boolean, onOpenChange: (open: boolean) => void }) {
    const pathname = usePathname();
    const { role, hasPermission } = useRole();
    const { logout } = useAuth();

    const filteredNavigation = navigation.filter(item => hasPermission(item.module, 'READ'));

    return (
        <nav className="flex flex-col h-full py-10 px-6 bg-white">
            <div className="flex items-center gap-3 mb-12 px-2">
                <div className="h-10 w-10 flex items-center justify-center bg-slate-900 rounded-2xl">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2L14.83 8.39L21.78 9.53L16.89 14.47L17.94 21.39L12 18.27L6.06 21.39L7.11 14.47L2.22 9.53L9.17 8.39L12 2Z" fill="white" />
                    </svg>
                </div>
                <span className="font-black text-xl tracking-tight text-slate-900 italic">HRMS</span>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-slate-300">
                {filteredNavigation.map((item) => (
                    <Link
                        key={item.name}
                        href={item.href}
                        onClick={() => onOpenChange(false)}
                        className={cn(
                            "group flex items-center rounded-2xl px-6 py-4 text-xs font-black uppercase tracking-widest transition-all",
                            pathname === item.href
                                ? "bg-[#D9F99D] text-slate-900 shadow-xl shadow-[#D9F99D]/20 animate-in fade-in slide-in-from-left-4"
                                : "text-slate-400 hover:bg-slate-50"
                        )}
                    >
                        <item.icon className={cn(
                            "mr-4 h-5 w-5 stroke-[2.5]",
                            pathname === item.href ? "text-slate-900" : "text-slate-300"
                        )} />
                        {item.name}
                    </Link>
                ))}
            </div>

            <div className="mt-auto pt-10">
                <Button onClick={() => { logout(); onOpenChange(false); }} variant="ghost" className="w-full justify-start gap-4 h-16 rounded-2xl text-rose-500 font-black uppercase text-[10px] tracking-widest px-8 bg-rose-50 border border-rose-100">
                    <LogOut className="h-5 w-5" />
                    Logout
                </Button>
            </div>
        </nav>
    );
}
