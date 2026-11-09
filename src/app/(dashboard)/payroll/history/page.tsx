"use client";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import {
    Wallet,
    ArrowLeft,
    Search,
    Filter,
    FileDown,
    Calendar,
    History as HistoryIcon,
    ArrowUpRight,
    TrendingUp,
    Users,
    ChevronRight,
    Building2,
    CheckCircle2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Link from "next/link";
import * as XLSX from "xlsx";
import { apiGetPaginated } from "@/lib/api-client";

export default function PayrollHistoryPage() {
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedYear, setSelectedYear] = useState("All");
    const [selectedCompany, setSelectedCompany] = useState("All");
    const [companies, setCompanies] = useState<string[]>(["All"]);
    const [loading, setLoading] = useState(true);

    // Monthly Aggregated Data — loaded from backend
    const [historyData, setHistoryData] = useState<any[]>([]);

    useEffect(() => {
        const load = async () => {
            try {
                const params: Record<string, unknown> = { limit: 50 };
                if (selectedYear !== "All") params.year = parseInt(selectedYear);
                if (selectedCompany !== "All") params.company = selectedCompany;
                const data = await apiGetPaginated<any>("/payroll/history", params);
                const items = data.data || [];
                setHistoryData(items);

                // Collect companies across items
                const compSet = new Set<string>();
                items.forEach((item: any) => {
                    (item.companies || []).forEach((c: any) => {
                        if (c.name) compSet.add(c.name);
                    });
                });
                setCompanies(["All", ...Array.from(compSet)]);
            } catch (e) {
                console.error("Failed to load history:", e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [selectedYear, selectedCompany]);

    const filteredHistory = historyData.filter(item => {
        const matchesSearch = item.monthName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.monthId.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesYear = selectedYear === "All" || item.monthId.includes(selectedYear);
        const matchesCompany = selectedCompany === "All" || (item.companies || []).some((c: any) => c.name === selectedCompany || c.code === selectedCompany);
        return matchesSearch && matchesYear && matchesCompany;
    });

    const completedHistory = filteredHistory.filter(h => h.status === "Completed");

    const handleExport = () => {
        const rows = completedHistory.map(item => ({
            "Payroll Month": item.monthName,
            "Cycle ID": item.monthId,
            "Status": item.status,
            "Total Staff Paid": item.totalStaff,
            "Total Disbursement": item.totalPayout,
            "Disbursement Date": item.disbursementDate,
            "Branches Paid": (item.branches || []).length,
            "Company Breakdown": (item.companies || []).map((c: any) => `${c.name || c.code}: ₹${c.payout || 0} (${c.staff || 0} staff)`).join('; ')
        }));
        
        const worksheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Audit Ledger");
        const compTag = selectedCompany !== "All" ? `_${selectedCompany.replace(/[^a-zA-Z0-9]/g, '_')}` : "";
        XLSX.writeFile(workbook, `Master_Audit_Ledger_${selectedYear === "All" ? "All_Years" : selectedYear}${compTag}.xlsx`);
    };

    return (
        <ProtectedRoute module="PAYROLL" action="READ">
            <div className="space-y-8 pb-20">
                {/* Top Nav */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <Link href="/payroll">
                            <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl border-slate-100 hover:bg-slate-50">
                                <ArrowLeft className="h-4 w-4 text-slate-900" />
                            </Button>
                        </Link>
                        <div>
                            <h1 className="text-2xl font-black text-slate-900 italic uppercase tracking-tighter underline underline-offset-8 decoration-[#D9F99D] decoration-4">
                                Disbursement Vault
                            </h1>
                            <p className="text-[10px] font-black text-slate-400 mt-4 uppercase tracking-[0.4em]">Monthly Consolidated Audit Trail</p>
                        </div>
                    </div>
                    <Button 
                        onClick={handleExport}
                        className="bg-slate-900 text-white hover:bg-black font-black uppercase text-[9px] tracking-widest px-6 h-11 rounded-xl shadow-xl transition-all hover:translate-y-[-2px]"
                    >
                        <FileDown className="h-4 w-4 mr-2" /> Export Master Ledger
                    </Button>
                </div>

                {/* Dynamic Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 px-2">
                    {[
                        {
                            label: `Total Paid (${selectedYear === "All" ? "All" : selectedYear})`,
                            val: `₹${completedHistory.reduce((acc, curr) => acc + curr.totalPayout, 0).toLocaleString()}`,
                            icon: Wallet,
                            color: "bg-[#D1FAE5]",
                            textColor: "text-emerald-900"
                        },
                        {
                            label: "Avg. Monthly Burn",
                            val: `₹${completedHistory.length > 0 ? Math.round(completedHistory.reduce((acc, curr) => acc + curr.totalPayout, 0) / completedHistory.length).toLocaleString() : 0}`,
                            icon: TrendingUp,
                            color: "bg-[#E0E7FF]",
                            textColor: "text-indigo-900"
                        },
                        {
                            label: "Peak Staff Count",
                            val: `${completedHistory.reduce((acc, curr) => Math.max(acc, curr.totalStaff), 0)} Staff`,
                            icon: Users,
                            color: "bg-[#FEF3C7]",
                            textColor: "text-amber-900"
                        },
                        {
                            label: "Last Payout Date",
                            val: completedHistory.length > 0 ? completedHistory[0].disbursementDate : "N/A",
                            icon: Calendar,
                            color: "bg-[#FEE2E2]",
                            textColor: "text-rose-900"
                        },
                    ].map((s, i) => (
                        <Card key={i} className={cn(s.color, "border-none shadow-sm rounded-2xl p-6 flex flex-col justify-between h-36 group hover:shadow-md transition-all")}>
                            <div className="flex items-start justify-between">
                                <div className="bg-white/50 p-2.5 rounded-xl group-hover:scale-110 transition-transform">
                                    <s.icon className={cn("h-5 w-5", s.textColor)} />
                                </div>
                            </div>
                            <div>
                                <h4 className={cn("text-2xl font-black italic tracking-tighter uppercase", s.textColor)}>{s.val}</h4>
                                <p className="text-[9px] font-bold text-slate-600 mt-1 uppercase tracking-widest">{s.label}</p>
                            </div>
                        </Card>
                    ))}
                </div>

                {/* Filters */}
                <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-100 flex flex-col lg:flex-row gap-2 mx-2">
                    <div className="relative flex-1 group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                        <Input
                            placeholder="Search by Month Name (e.g. April 2026)..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="h-12 w-full pl-12 rounded-xl bg-slate-50 border-none font-bold text-[11px] focus:ring-2 ring-indigo-100 focus:bg-white transition-all"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                            <SelectTrigger className="h-12 w-[180px] rounded-xl bg-slate-50 border-none font-black text-[9px] uppercase tracking-widest">
                                <Building2 className="h-3.5 w-3.5 mr-1.5 text-indigo-500" />
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="border-none shadow-xl rounded-2xl max-h-60">
                                {companies.map(c => (
                                    <SelectItem key={c} value={c} className="text-[10px] font-bold uppercase truncate max-w-[220px]">
                                        {c === "All" ? "All Companies" : c}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={selectedYear} onValueChange={setSelectedYear}>
                            <SelectTrigger className="h-12 w-[140px] rounded-xl bg-slate-50 border-none font-black text-[9px] uppercase tracking-widest">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="border-none shadow-xl rounded-2xl">
                                <SelectItem value="All" className="text-[10px] font-bold uppercase">All Years</SelectItem>
                                <SelectItem value="2026" className="text-[10px] font-bold uppercase">2026</SelectItem>
                                <SelectItem value="2025" className="text-[10px] font-bold uppercase">2025</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Consolidated Ledger Table */}
                <Card className="border-none shadow-sm rounded-[2.5rem] bg-white overflow-hidden p-1 mx-2">
                    <CardHeader className="p-6 pb-4 border-none">
                        <CardTitle className="text-lg font-black italic text-slate-900 uppercase tracking-tighter">Monthly Audit Ledger</CardTitle>
                    </CardHeader>
                    <Table>
                        <TableHeader>
                            <TableRow className="border-none bg-slate-50/50 hover:bg-slate-50/50">
                                <TableHead className="pl-8 h-16 text-[9px] font-black uppercase tracking-widest text-slate-400">Payroll Month</TableHead>
                                <TableHead className="h-16 text-[9px] font-black uppercase tracking-widest text-slate-400">Total Disbursement</TableHead>
                                <TableHead className="h-16 text-[9px] font-black uppercase tracking-widest text-slate-400 w-[340px]">Company & Branch Breakdown</TableHead>
                                <TableHead className="h-16 text-[9px] font-black uppercase tracking-widest text-slate-400">Status & Date</TableHead>
                                <TableHead className="h-16 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right pr-8">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredHistory.map((item) => (
                                <TableRow key={item.monthId} className="group border-b border-dashed border-slate-100 hover:bg-slate-50/30 transition-all h-auto last:border-none">
                                    <TableCell className="pl-8 py-6">
                                        <div className="flex flex-col">
                                            <span className="text-base font-black text-slate-900 italic tracking-tighter uppercase">{item.monthName}</span>
                                            <div className="flex items-center gap-1.5 mt-1">
                                                <Badge className="bg-slate-100 text-slate-500 border-none font-black text-[7px] h-4 px-1.5 rounded uppercase tracking-widest">{item.monthId}</Badge>
                                            </div>
                                        </div>
                                    </TableCell>

                                    <TableCell className="py-6">
                                        <div className="flex flex-col">
                                            <span className="text-lg font-black text-emerald-600 italic tracking-tighter">₹{item.totalPayout.toLocaleString()}</span>
                                            <div className="flex items-center gap-1 mt-1">
                                                <Users className="h-3 w-3 text-slate-400" />
                                                <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">{item.totalStaff} Staff Paid</span>
                                            </div>
                                        </div>
                                    </TableCell>

                                    <TableCell className="py-6 pr-8">
                                        <div className="flex flex-col gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                                            {item.companies && item.companies.length > 0 && (
                                                <div className="flex flex-wrap gap-1 pb-1.5 border-b border-slate-200/60">
                                                    {item.companies.map((c: any, cidx: number) => (
                                                        <Badge key={cidx} className="bg-slate-900 text-white font-black text-[7px] px-1.5 h-4 uppercase tracking-wider">
                                                            {c.code || (c.name ? c.name.split(' ')[0] : 'APA')}: ₹{(Number(c.payout) / 1000).toFixed(0)}k ({c.staff})
                                                        </Badge>
                                                    ))}
                                                </div>
                                            )}
                                            {(item.branches || []).map((b: { name: string; payout: number; staff: number }, idx: number) => (
                                                <div key={idx} className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <Building2 className="h-3 w-3 text-slate-400" />
                                                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-600">{b.name}</span>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{b.staff} Staff</span>
                                                        <span className="text-[10px] font-black italic text-slate-900 w-16 text-right">₹{(Number(b.payout) / 1000).toFixed(0)}k</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </TableCell>

                                    <TableCell className="py-6">
                                        <div className="flex flex-col gap-2 items-start">
                                            <Badge className={cn(
                                                "border-none font-black text-[8px] h-6 px-3 rounded-lg uppercase tracking-widest flex items-center gap-1.5 shadow-sm",
                                                item.status === 'Completed' ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                                            )}>
                                                {item.status === 'Completed' && <CheckCircle2 className="h-3 w-3" />}
                                                {item.status}
                                            </Badge>
                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">{item.disbursementDate}</span>
                                        </div>
                                    </TableCell>

                                    <TableCell className="pr-8 py-6 text-right align-middle">
                                        <Link href={`/payroll/history/${item.id}`}>
                                            <Button
                                                variant="outline"
                                                className="h-10 rounded-xl border-slate-200 font-black uppercase text-[8px] tracking-widest px-6 hover:bg-slate-900 hover:text-white transition-all shadow-sm"
                                            >
                                                View Details <ChevronRight className="h-3.5 w-3.5 ml-2" />
                                            </Button>
                                        </Link>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Card>
            </div>
        </ProtectedRoute>
    );
}
