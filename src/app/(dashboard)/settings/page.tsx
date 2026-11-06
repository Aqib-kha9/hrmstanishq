"use client";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/context/ThemeContext";
import { apiGet, apiPut } from "@/lib/api-client";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

import {
    User,
    Settings as SettingsIcon,
    Bell,
    Lock,
    Shield,
    Globe,
    Smartphone,
    Save,
    HelpCircle,
    CreditCard,
    ArrowUpRight,
    Star
} from "lucide-react";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

export default function SettingsPage() {
    const { fontSize, setFontSize, contrastLevel, setContrastLevel } = useTheme();
    const [isHolidayModalOpen, setIsHolidayModalOpen] = useState(false);
    const [selectedHoliday, setSelectedHoliday] = useState<any>(null);
    const [ptSlabs, setPtSlabs] = useState<any[]>([]);
    const [ptLoading, setPtLoading] = useState(false);
    const [ptSaving, setPtSaving] = useState(false);
    const [ptMessage, setPtMessage] = useState("");

    useEffect(() => {
        async function fetchSlabs() {
            try {
                setPtLoading(true);
                const res = await apiGet<any>("/config/pt-slabs");
                const data = res?.data || res || [];
                setPtSlabs(Array.isArray(data) ? data : []);
            } catch (err) {
                console.error("Failed to fetch PT slabs:", err);
            } finally {
                setPtLoading(false);
            }
        }
        fetchSlabs();
    }, []);

    const handleAddSlab = () => {
        setPtSlabs([...ptSlabs, { from: 0, to: null, amount: 0 }]);
    };

    const handleRemoveSlab = (idx: number) => {
        setPtSlabs(ptSlabs.filter((_, i) => i !== idx));
    };

    const handleUpdateSlab = (idx: number, key: string, val: any) => {
        const next = [...ptSlabs];
        next[idx] = { ...next[idx], [key]: val };
        setPtSlabs(next);
    };

    const handleSaveSlabs = async () => {
        try {
            setPtSaving(true);
            setPtMessage("");
            const parsed = ptSlabs.map(s => ({
                from: Number(s.from),
                to: s.to === "" || s.to === null || s.to === "null" || s.to === undefined ? null : Number(s.to),
                amount: Number(s.amount)
            }));
            await apiPut("/config/pt-slabs", { slabs: parsed });
            setPtMessage("PT Slabs saved successfully!");
            setTimeout(() => setPtMessage(""), 3000);
        } catch (err: any) {
            console.error("Failed to save PT slabs:", err);
            setPtMessage(err.message || "Failed to save PT slabs.");
        } finally {
            setPtSaving(false);
        }
    };

    const handleOpenModal = (holiday?: any) => {
        setSelectedHoliday(holiday || null);
        setIsHolidayModalOpen(true);
    };

    return (
        <ProtectedRoute module="SETTINGS" action="READ">
        <div className="space-y-10 max-w-6xl mx-auto pb-20">
            {/* Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between px-2">
                <div>
                    <h1 className="text-xl md:text-2xl font-black text-slate-900 flex items-center gap-4 italic underline underline-offset-8 decoration-[#D9F99D] decoration-2 uppercase tracking-tighter">
                        <SettingsIcon className="h-7 w-7 text-slate-400 stroke-[2.5]" /> Settings
                    </h1>
                    <p className="text-[8px] md:text-[9px] font-black text-slate-400 mt-6 uppercase tracking-[0.3em]">Manage your account and system settings.</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="bg-white px-6 py-2 rounded-xl border border-slate-100 shadow-sm">
                        <span className="text-[10px] font-black uppercase tracking-widest text-[#D9F99D] mix-blend-difference">Admin</span>
                    </div>
                </div>
            </div>

            <Tabs defaultValue="profile" className="space-y-10">
                <div className="bg-white p-1.5 rounded-2xl border border-slate-100 shadow-sm inline-flex">
                    <TabsList className="bg-transparent h-auto p-0 border-none gap-1.5">
                        {[
                            { value: 'profile', label: 'My Profile', icon: User },
                            { value: 'notifications', label: 'Notifications', icon: Bell },
                            { value: 'security', label: 'Security', icon: Shield },
                            { value: 'system', label: 'System', icon: SettingsIcon },
                            { value: 'pt_slabs', label: 'PT Slabs', icon: CreditCard },
                            { value: 'holidays', label: 'Company Holidays', icon: Globe },
                        ].map((tab) => (
                            <TabsTrigger
                                key={tab.value}
                                value={tab.value}
                                className="data-[state=active]:bg-[#D9F99D] data-[state=active]:text-slate-900 px-6 py-3 rounded-xl transition-all font-black text-[9px] uppercase tracking-widest gap-2"
                            >
                                <tab.icon className="h-3.5 w-3.5" /> {tab.label}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                    <div className="ml-4 pl-4 border-l border-slate-100 flex items-center">
                        <Button 
                            variant="ghost" 
                            className="font-black text-[9px] uppercase tracking-widest text-slate-500 hover:text-slate-900 gap-2"
                            onClick={() => window.location.href = '/settings/signatures'}
                        >
                            <SettingsIcon className="h-3.5 w-3.5" /> Manage Signatories
                        </Button>
                    </div>
                </div>

                <TabsContent value="profile" className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden p-1.5">
                        <div className="h-40 bg-[#E0E7FF] rounded-2xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-white/20 blur-3xl rounded-full" />
                            <div className="absolute bottom-6 right-10">
                                <Button variant="ghost" className="bg-white/40 hover:bg-white/60 text-indigo-900 font-bold text-[9px] uppercase tracking-widest h-9 px-5 rounded-lg backdrop-blur-md transition-all">
                                    Change Cover
                                </Button>
                            </div>
                        </div>
                        <CardHeader className="relative pt-0 px-8">
                            <div className="flex flex-col md:flex-row md:items-end gap-6 -mt-16">
                                <Avatar className="h-32 w-32 border-8 border-white shadow-xl rounded-3xl">
                                    <AvatarFallback className="text-3xl font-black bg-slate-100 text-slate-900 italic">JD</AvatarFallback>
                                </Avatar>
                                <div className="pb-4 space-y-1">
                                    <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase italic">John Doe</h2>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2 italic">
                                        <Star className="h-3.5 w-3.5 text-[#D9F99D] fill-[#D9F99D]" /> HR Director • Apaar Logistics
                                    </p>
                                </div>
                                <div className="md:ml-auto pb-4">
                                    <Button className="h-10 px-6 rounded-xl bg-slate-50 text-slate-400 hover:text-slate-900 font-bold text-[9px] uppercase tracking-widest border border-slate-100 transition-all">Verify Profile</Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-12 pt-16 px-10">
                            <div className="grid gap-12 md:grid-cols-2">
                                {[
                                    { label: 'Display Name', id: 'displayName', value: 'John Doe', type: 'text' },
                                    { label: 'Email Address', id: 'email', value: 'john.doe@antigravity.io', type: 'email', readonly: true },
                                    { label: 'Phone Number', id: 'phone', value: '+91 98765 43210', type: 'tel' },
                                    { label: 'Time Zone', id: 'timezone', value: 'GMT +5:30 (IST)', type: 'text' },
                                ].map((field) => (
                                    <div key={field.id} className="space-y-3">
                                        <Label htmlFor={field.id} className="text-[9px] font-black uppercase tracking-widest text-slate-400 italic">{field.label}</Label>
                                        <Input
                                            id={field.id}
                                            defaultValue={field.value}
                                            readOnly={field.readonly}
                                            className={cn(
                                                "h-11 rounded-xl border-none font-bold text-xs px-6 transition-all",
                                                field.readonly ? "bg-slate-50 text-slate-300" : "bg-slate-50/50 hover:bg-slate-50 focus-visible:ring-1 focus-visible:ring-[#D9F99D]"
                                            )}
                                        />
                                    </div>
                                ))}
                            </div>
                            <div className="space-y-3">
                                <Label htmlFor="bio" className="text-[9px] font-black uppercase tracking-widest text-slate-400 italic">About You</Label>
                                <textarea
                                    id="bio"
                                    className="flex min-h-[120px] w-full rounded-2xl border-none bg-slate-50/50 p-5 text-xs font-bold ring-offset-transparent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#D9F99D] transition-all"
                                    defaultValue="Senior HR Specialist with expertise in team management and scaling operations."
                                />
                            </div>
                        </CardContent>
                        <CardFooter className="px-8 pb-10 pt-4 flex justify-end gap-4 bg-transparent">
                            <Button variant="ghost" className="h-11 px-8 rounded-xl text-[9px] font-black uppercase tracking-widest text-slate-300 hover:text-slate-900 transition-all">Cancel</Button>
                            <Button className="bg-[#D9F99D] text-slate-900 hover:bg-[#c8ea8a] font-black text-[9px] uppercase tracking-widest px-10 h-11 rounded-xl shadow-xl hover:translate-y-[-2px] transition-all">
                                <Save className="mr-3 h-4 w-4 stroke-[3]" /> Save Changes
                            </Button>
                        </CardFooter>
                    </Card>
                </TabsContent>

                <TabsContent value="notifications" className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden p-1.5">
                        <CardHeader className="p-8 border-none">
                            <CardTitle className="text-xl font-black italic text-slate-900 underline underline-offset-8 decoration-[#FEF3C7] decoration-2 uppercase tracking-tighter">Manage Notifications</CardTitle>
                            <p className="text-[8px] font-bold text-slate-400 mt-6 uppercase tracking-[0.2em]">Choose what updates you want to receive.</p>
                        </CardHeader>
                        <CardContent className="p-0 border-t border-slate-50 mt-2">
                            {[
                                { title: "Leave Requests", desc: "Real-time alerts for incoming time-off requests.", default: true },
                                { title: "Performance Reviews", desc: "Automated prompts for periodic review completion.", default: true },
                                { title: "Salary Updates", desc: "Critical alerts when payment cycles are ready.", default: false },
                                { title: "Daily Attendance Reports", desc: "Consolidated morning reports on team availability.", default: false },
                            ].map((item, i) => (
                                <div key={i} className="flex items-center justify-between p-8 hover:bg-slate-50 transition-all border-b last:border-none border-slate-50">
                                    <div className="space-y-1">
                                        <p className="text-sm font-black text-slate-900 italic tracking-tight">{item.title}</p>
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{item.desc}</p>
                                    </div>
                                    <Switch defaultChecked={item.default} className="data-[state=checked]:bg-[#D9F99D] data-[state=checked]:border-transparent" />
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="security" className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden p-8">
                        <div className="space-y-10">
                            <div>
                                <h3 className="text-xl font-black italic text-slate-900 underline underline-offset-8 decoration-[#FEE2E2] decoration-2 uppercase tracking-tighter">Change Password</h3>
                                <p className="text-[8px] font-bold text-slate-400 mt-6 uppercase tracking-widest">Update your password regularly for better security.</p>
                            </div>
                            <div className="grid gap-6 max-w-xl">
                                {[
                                    { label: 'Current Password', id: 'curPass' },
                                    { label: 'New Password', id: 'newPass' },
                                ].map((s) => (
                                    <div key={s.id} className="space-y-3">
                                        <Label htmlFor={s.id} className="text-[9px] font-black uppercase tracking-widest text-slate-300 italic">{s.label}</Label>
                                        <Input id={s.id} type="password" placeholder="••••••••" className="h-11 rounded-xl bg-slate-50 border-none px-6 font-black" />
                                    </div>
                                ))}
                                <Button className="bg-slate-900 text-white font-black text-[9px] uppercase tracking-[0.2em] px-8 h-11 rounded-xl w-fit shadow-xl hover:bg-black transition-all">Update Password</Button>
                            </div>
                        </div>
                    </Card>

                    <div className="bg-[#FEE2E2]/60 rounded-3xl p-1.5 border-4 border-white shadow-xl group">
                        <Card className="border-none shadow-sm bg-white rounded-2xl p-8">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
                                <div className="flex items-center gap-6">
                                    <div className="h-14 w-14 rounded-xl bg-rose-600 flex items-center justify-center text-white shadow-xl shadow-rose-200 group-hover:rotate-6 transition-transform">
                                        <Lock className="h-7 w-7 stroke-[2.5]" />
                                    </div>
                                    <div className="space-y-1">
                                        <h3 className="text-xl font-black text-rose-950 italic tracking-tighter uppercase">Two-Factor Authentication</h3>
                                        <p className="text-[9px] font-bold text-rose-400 uppercase tracking-[0.2em]">Add an extra layer of security.</p>
                                    </div>
                                </div>
                                <Button className="h-11 px-8 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-[9px] uppercase tracking-widest shadow-xl transition-all">Enable 2FA</Button>
                            </div>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="system" className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <Card className="border-none shadow-sm rounded-3xl bg-white p-8 space-y-8">
                            <div>
                                <h3 className="text-lg font-black italic tracking-tighter uppercase flex items-center gap-3"><Globe className="h-5 w-5 text-indigo-400" /> Region & Language</h3>
                                <p className="text-[8px] font-bold text-slate-300 mt-2 uppercase tracking-widest italic">Language and currency settings</p>
                            </div>
                            <div className="space-y-5">
                                {[
                                    { label: 'Language', value: 'English (India)' },
                                    { label: 'Currency', value: 'INR (₹)' },
                                ].map((l, i) => (
                                    <div key={i} className="space-y-2">
                                        <Label className="text-[9px] uppercase font-black text-slate-400 tracking-widest">{l.label}</Label>
                                        <Input defaultValue={l.value} className="h-11 border-none bg-slate-50 rounded-lg font-bold text-xs px-6" />
                                    </div>
                                ))}
                                <div className="space-y-2">
                                    <Label className="text-[9px] uppercase font-black text-slate-400 tracking-widest">Global Font Size</Label>
                                    <Select value={fontSize.toString()} onValueChange={(v) => setFontSize(parseInt(v))}>
                                        <SelectTrigger className="h-11 border-none bg-slate-50 rounded-lg font-bold text-xs px-6 shadow-none">
                                            <SelectValue placeholder="Select Font Size" />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl border-slate-100 bg-white">
                                            <SelectItem value="12" className="text-xs font-bold">Small (12px)</SelectItem>
                                            <SelectItem value="14" className="text-xs font-bold">Medium (14px)</SelectItem>
                                            <SelectItem value="16" className="text-xs font-bold">Default (16px)</SelectItem>
                                            <SelectItem value="18" className="text-xs font-bold">Large (18px)</SelectItem>
                                            <SelectItem value="20" className="text-xs font-bold">Extra Large (20px)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex flex-col gap-4 bg-slate-50 p-4 rounded-lg">
                                    <div className="space-y-1">
                                        <div className="flex justify-between items-center">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-900">Text Contrast Level</p>
                                            <span className="text-[9px] font-black text-slate-500 bg-white px-2 py-1 rounded-md shadow-sm border border-slate-100">{contrastLevel}%</span>
                                        </div>
                                        <p className="text-[9px] font-bold text-slate-400">Adjust the slider to make text darker for better readability</p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="text-[9px] font-black uppercase text-slate-300">Default</span>
                                        <input
                                            type="range"
                                            min="0"
                                            max="100"
                                            step="5"
                                            value={contrastLevel}
                                            onChange={(e) => setContrastLevel(Number(e.target.value))}
                                            className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-900"
                                        />
                                        <span className="text-[9px] font-black uppercase text-slate-900">Dark</span>
                                    </div>
                                </div>
                            </div>
                        </Card>

                        <Card className="border-none shadow-sm rounded-3xl bg-slate-900 text-white p-8 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-[#D9F99D] blur-3xl opacity-10 group-hover:opacity-20 transition-opacity" />
                            <div className="relative z-10 flex flex-col h-full justify-between">
                                <div className="space-y-6">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center">
                                            <CreditCard className="h-5 w-5 text-[#D9F99D]" />
                                        </div>
                                        <h3 className="text-[9px] font-black uppercase tracking-[0.4em] text-[#D9F99D]">Current Plan</h3>
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-3xl font-black tracking-tighter italic">Enterprise Pro</p>
                                        <div className="flex items-center gap-2 pt-1">
                                            <Badge className="bg-[#D9F99D] text-slate-900 text-[7px] font-black px-2 h-4 uppercase">UNLIMITED STAFF</Badge>
                                            <Badge variant="outline" className="border-white/20 text-white text-[7px] font-black px-2 h-4 uppercase">PRIORITY SUPPORT</Badge>
                                        </div>
                                    </div>
                                </div>
                                <Button variant="link" className="p-0 h-auto font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors mt-8 self-start underline-offset-8 text-[9px]">Billing History</Button>
                            </div>
                        </Card>
                    </div>

                    <div className="bg-[#D9F99D] rounded-3xl p-1.5 border-4 border-white shadow-xl group">
                        <div className="bg-slate-900 rounded-2xl p-8 flex flex-col md:flex-row items-center justify-between gap-8">
                            <div className="flex items-center gap-8">
                                <div className="h-14 w-14 bg-white rounded-xl flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform">
                                    <HelpCircle className="h-7 w-7 text-slate-900" />
                                </div>
                                <div className="space-y-1">
                                    <h3 className="text-xl font-black text-white italic tracking-tighter uppercase underline underline-offset-8 decoration-[#D9F99D] decoration-2">Help & Support</h3>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] italic">24/7 priority support is active.</p>
                                </div>
                            </div>
                            <Button className="h-12 px-10 rounded-xl bg-white text-slate-900 hover:bg-slate-50 font-black text-[9px] uppercase tracking-widest shadow-xl transition-all">Contact Support</Button>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="pt_slabs" className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Professional Tax Slabs Card */}
                    <Card className="border-none shadow-sm rounded-3xl bg-white p-8 space-y-8">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h3 className="text-lg font-black italic tracking-tighter uppercase flex items-center gap-3">
                                    <SettingsIcon className="h-5 w-5 text-indigo-400" /> Professional Tax (PT) Slabs
                                </h3>
                                <p className="text-[8px] font-bold text-slate-300 mt-2 uppercase tracking-widest italic">
                                    Configure slab rates for Professional Tax (TDS) calculations
                                </p>
                            </div>
                            <Button
                                onClick={handleAddSlab}
                                className="h-9 px-4 rounded-xl bg-slate-900 text-[#D9F99D] hover:bg-black font-black text-[9px] uppercase tracking-widest shadow-xl transition-all"
                            >
                                + Add New Slab
                            </Button>
                        </div>

                        {ptLoading ? (
                            <p className="text-xs font-bold text-slate-400">Loading slabs...</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-100">
                                            <th className="py-4 px-6 text-[9px] font-black text-slate-400 uppercase tracking-widest">Gross From (₹)</th>
                                            <th className="py-4 px-6 text-[9px] font-black text-slate-400 uppercase tracking-widest">Gross To (₹)</th>
                                            <th className="py-4 px-6 text-[9px] font-black text-slate-400 uppercase tracking-widest">Monthly Tax Amount (₹)</th>
                                            <th className="py-4 px-6 text-right text-[9px] font-black text-slate-400 uppercase tracking-widest">Controls</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {ptSlabs.map((slab, idx) => (
                                            <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                                <td className="py-4 px-6">
                                                    <Input
                                                        type="number"
                                                        value={slab.from}
                                                        onChange={(e) => handleUpdateSlab(idx, "from", parseFloat(e.target.value))}
                                                        className="h-9 w-32 rounded-lg bg-slate-50 border-none font-bold text-xs"
                                                    />
                                                </td>
                                                <td className="py-4 px-6">
                                                    <Input
                                                        type="text"
                                                        placeholder="No Upper Limit"
                                                        value={slab.to === null || slab.to === undefined ? "" : slab.to}
                                                        onChange={(e) => handleUpdateSlab(idx, "to", e.target.value === "" ? null : parseFloat(e.target.value))}
                                                        className="h-9 w-32 rounded-lg bg-slate-50 border-none font-bold text-xs"
                                                    />
                                                </td>
                                                <td className="py-4 px-6">
                                                    <Input
                                                        type="number"
                                                        value={slab.amount}
                                                        onChange={(e) => handleUpdateSlab(idx, "amount", parseFloat(e.target.value))}
                                                        className="h-9 w-32 rounded-lg bg-slate-50 border-none font-bold text-xs"
                                                    />
                                                </td>
                                                <td className="py-4 px-6 text-right">
                                                    <Button
                                                        onClick={() => handleRemoveSlab(idx)}
                                                        variant="ghost"
                                                        className="h-8 px-3 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 flex items-center justify-center p-0 ml-auto font-black text-[9px] uppercase tracking-widest"
                                                    >
                                                        Remove
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                            {ptMessage && (
                                <p className="text-[10px] font-black uppercase text-emerald-500 tracking-widest">{ptMessage}</p>
                            )}
                            <Button
                                onClick={handleSaveSlabs}
                                disabled={ptSaving}
                                className="bg-[#D9F99D] text-slate-900 hover:bg-[#c8ea8a] font-black text-[9px] uppercase tracking-widest px-8 h-11 rounded-xl shadow-xl transition-all ml-auto flex items-center gap-2"
                            >
                                <Save className="h-3.5 w-3.5" /> {ptSaving ? "Saving..." : "Save PT Slabs"}
                            </Button>
                        </div>
                    </Card>
                </TabsContent>
                <TabsContent value="holidays" className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden p-1.5">
                        <CardHeader className="p-8 border-none flex flex-col md:flex-row md:items-start justify-between gap-6">
                            <div>
                                <CardTitle className="text-xl font-black italic text-slate-900 underline underline-offset-8 decoration-[#D9F99D] decoration-2 uppercase tracking-tighter">Holiday Calendar</CardTitle>
                                <CardDescription className="text-[10px] font-bold text-slate-400 mt-4 uppercase tracking-[0.2em] leading-relaxed">
                                    Configure annual public holidays for the company. <br/> These will automatically mark 'H' in the attendance grid.
                                </CardDescription>
                            </div>
                            <Button className="h-11 px-6 rounded-xl bg-slate-900 text-[#D9F99D] hover:bg-black font-black text-[9px] uppercase tracking-widest shadow-xl transition-all flex items-center gap-2">
                                <Globe className="h-4 w-4" /> Fetch API Data (2026)
                            </Button>
                        </CardHeader>
                        <CardContent className="p-0 border-t border-slate-50 mt-2">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-100">
                                            <th className="py-5 px-8 text-[9px] font-black text-slate-400 uppercase tracking-widest">Holiday Name</th>
                                            <th className="py-5 px-8 text-[9px] font-black text-slate-400 uppercase tracking-widest">Date Range</th>
                                            <th className="py-5 px-8 text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Days</th>
                                            <th className="py-5 px-8 text-right text-[9px] font-black text-slate-400 uppercase tracking-widest">Controls</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {[
                                            { name: "Republic Day", date: "Jan 26, 2026", days: 1, status: "Active" },
                                            { name: "Holi Festival", date: "Mar 25 - Mar 26, 2026", days: 2, status: "Active" },
                                            { name: "Eid-ul-Fitr", date: "Mar 21, 2026", days: 1, status: "Disabled" },
                                            { name: "Independence Day", date: "Aug 15, 2026", days: 1, status: "Active" },
                                            { name: "Diwali Grand Festival", date: "Nov 08 - Nov 11, 2026", days: 4, status: "Active" },
                                            { name: "Christmas Week", date: "Dec 25 - Dec 26, 2026", days: 2, status: "Active" },
                                        ].map((holiday, idx) => (
                                            <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors group">
                                                <td className="py-5 px-8">
                                                    <span className="text-sm font-black text-slate-900 italic tracking-tighter uppercase">{holiday.name}</span>
                                                </td>
                                                <td className="py-5 px-8">
                                                    <span className="text-[10px] font-bold text-slate-500 tracking-widest uppercase">{holiday.date}</span>
                                                </td>
                                                <td className="py-5 px-8">
                                                    <Badge className="bg-slate-100 text-slate-600 border-none font-black text-[10px] uppercase">{holiday.days} Days</Badge>
                                                </td>
                                                <td className="py-5 px-8">
                                                    <div className="flex items-center justify-end gap-6">
                                                        <Button 
                                                            onClick={() => handleOpenModal(holiday)}
                                                            variant="ghost" 
                                                            className="h-8 px-4 rounded-lg bg-slate-50 opacity-0 group-hover:opacity-100 transition-opacity text-[8px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-900"
                                                        >
                                                            Modify Dates
                                                        </Button>
                                                        <Switch defaultChecked={holiday.status === "Active"} className="data-[state=checked]:bg-[#D9F99D] data-[state=checked]:border-transparent" />
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="p-8 border-t border-slate-50 bg-slate-50/30 flex justify-center">
                                <Button 
                                    onClick={() => handleOpenModal()}
                                    variant="outline" 
                                    className="h-11 px-8 rounded-xl border-slate-200 border-dashed text-slate-600 font-black text-[9px] uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2"
                                >
                                    + Add Custom Holiday
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Holiday Modal */}
                    <Dialog open={isHolidayModalOpen} onOpenChange={setIsHolidayModalOpen}>
                        <DialogContent className="sm:max-w-[425px] border-none shadow-2xl rounded-3xl p-8">
                            <DialogHeader className="space-y-3">
                                <div className="h-12 w-12 rounded-2xl flex items-center justify-center mb-2 bg-indigo-50 text-indigo-600">
                                    <Globe className="h-6 w-6" />
                                </div>
                                <DialogTitle className="text-xl font-black italic uppercase text-slate-900 tracking-tighter">
                                    {selectedHoliday ? 'Modify Holiday Dates' : 'Add Custom Holiday'}
                                </DialogTitle>
                                <DialogDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-loose">
                                    Configure the date range for this holiday. It will automatically reflect in the attendance grid.
                                </DialogDescription>
                            </DialogHeader>
                            
                            <div className="space-y-6 py-4">
                                <div className="space-y-2">
                                    <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Holiday Name</Label>
                                    <Input 
                                        defaultValue={selectedHoliday?.name || ""}
                                        placeholder="e.g. Foundation Day" 
                                        className="h-12 rounded-xl bg-slate-50 border-none font-bold text-[11px] px-4"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Start Date</Label>
                                        <Input 
                                            type="date"
                                            className="h-12 rounded-xl bg-slate-50 border-none font-bold text-[11px] px-4"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">End Date</Label>
                                        <Input 
                                            type="date"
                                            className="h-12 rounded-xl bg-slate-50 border-none font-bold text-[11px] px-4"
                                        />
                                    </div>
                                </div>
                            </div>

                            <DialogFooter className="gap-3 sm:justify-start">
                                <Button 
                                    className="flex-1 h-12 rounded-2xl font-black uppercase text-[9px] tracking-widest shadow-lg transition-all bg-slate-900 hover:bg-black text-[#D9F99D]"
                                    onClick={() => setIsHolidayModalOpen(false)}
                                >
                                    Save Config
                                </Button>
                                <Button 
                                    variant="outline" 
                                    onClick={() => setIsHolidayModalOpen(false)}
                                    className="flex-1 h-12 rounded-2xl border-slate-100 font-black uppercase text-[9px] tracking-widest"
                                >
                                    Cancel
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </TabsContent>
            </Tabs>
        </div>
        </ProtectedRoute>
    );
}

