"use client";

import React, { useState, useRef } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { apiPatch } from "@/lib/api-client";
import type { BackendEmployee, FrontendEmployee } from "@/lib/transform";
import {
    Printer,
    Camera,
    Upload,
    RotateCcw,
    ShieldCheck,
    Building2,
    Phone,
    Mail,
    Heart,
    Sparkles,
    Check,
    QrCode,
    Download,
    Eye,
    Layers,
    User,
    Loader2,
} from "lucide-react";

interface EmployeeIdCardModalProps {
    isOpen: boolean;
    onClose: () => void;
    employee: FrontendEmployee;
    rawEmployee: BackendEmployee | null;
    onPhotoUpdated?: (newPhotoUrl: string) => void;
}

// ── Vector Barcode Generator ──
function VectorBarcode({ text, className = "h-8" }: { text: string; className?: string }) {
    const bars: { width: number; isSpace: boolean }[] = [];
    // Start guards
    bars.push({ width: 2, isSpace: false }, { width: 1, isSpace: true }, { width: 2, isSpace: false });
    for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);
        bars.push({ width: (code % 3) + 1, isSpace: false });
        bars.push({ width: ((code * 2) % 2) + 1, isSpace: true });
        bars.push({ width: ((code * 3) % 3) + 1, isSpace: false });
        bars.push({ width: 1, isSpace: true });
    }
    // End guards
    bars.push({ width: 2, isSpace: false }, { width: 1, isSpace: true }, { width: 2, isSpace: false });

    return (
        <div className="flex flex-col items-center">
            <svg className={cn("w-full max-w-[210px]", className)} viewBox="0 0 160 28" preserveAspectRatio="none">
                {(() => {
                    let x = 6;
                    return bars.map((b, idx) => {
                        const curX = x;
                        x += b.width * 2;
                        if (b.isSpace) return null;
                        return (
                            <rect
                                key={idx}
                                x={curX}
                                y={0}
                                width={b.width * 1.5}
                                height={28}
                                fill="currentColor"
                            />
                        );
                    });
                })()}
            </svg>
            <span className="font-mono text-[9px] tracking-[0.22em] font-black uppercase text-center mt-0.5 opacity-80">
                *{text}*
            </span>
        </div>
    );
}

// ── Corporate Seal Graphic ──
function CorporateSeal({ companyName }: { companyName: string }) {
    return (
        <div className="relative w-14 h-14 rounded-full border border-amber-400/50 flex items-center justify-center p-1 shadow-inner bg-amber-500/5 text-amber-400">
            <div className="w-full h-full rounded-full border border-dashed border-amber-400/60 flex flex-col items-center justify-center text-center p-0.5">
                <ShieldCheck className="h-4 w-4 text-amber-400" />
                <span className="text-[5.5px] font-black uppercase tracking-widest text-amber-300 leading-tight mt-0.5">
                    OFFICIAL
                </span>
                <span className="text-[4.5px] font-bold text-amber-400/80 uppercase tracking-tighter">
                    VERIFIED
                </span>
            </div>
        </div>
    );
}

// ── Smart Card Chip Graphic ──
function SmartCardChip() {
    return (
        <div className="w-9 h-7 rounded-md bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 border border-amber-300 p-0.5 shadow-md flex items-center justify-center">
            <div className="w-full h-full rounded border border-amber-700/40 grid grid-cols-2 grid-rows-2 gap-0.5 p-0.5 opacity-90">
                <div className="border-r border-b border-amber-800/50" />
                <div className="border-b border-amber-800/50" />
                <div className="border-r border-amber-800/50" />
                <div />
            </div>
        </div>
    );
}

export function EmployeeIdCardModal({
    isOpen,
    onClose,
    employee,
    rawEmployee,
    onPhotoUpdated,
}: EmployeeIdCardModalProps) {
    const [viewMode, setViewMode] = useState<"front" | "back" | "both">("both");
    const [cardTheme, setCardTheme] = useState<"navy" | "white">("navy");
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const [localPhoto, setLocalPhoto] = useState<string | null>(rawEmployee?.profile_image || null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Sync if rawEmployee changes
    React.useEffect(() => {
        if (rawEmployee?.profile_image) {
            setLocalPhoto(rawEmployee.profile_image);
        }
    }, [rawEmployee?.profile_image]);

    // Handle Image Upload
    const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            alert("Please choose an image under 5MB.");
            return;
        }

        const reader = new FileReader();
        reader.onload = async () => {
            const base64Data = reader.result as string;
            setLocalPhoto(base64Data);
            setUploadingPhoto(true);

            try {
                await apiPatch(`/employees/${employee.employeeId}`, {
                    profile_image: base64Data,
                });
                onPhotoUpdated?.(base64Data);
            } catch (err: any) {
                console.error("Failed to upload ID photo:", err);
                alert("Failed to save profile photo: " + (err.message || "Unknown error"));
            } finally {
                setUploadingPhoto(false);
            }
        };
        reader.readAsDataURL(file);
    };

    // Formatted Dates
    const formatDate = (dateStr: string | null | undefined): string => {
        if (!dateStr) return "N/A";
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return String(dateStr);
            return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
        } catch {
            return String(dateStr);
        }
    };

    const joiningDate = formatDate(rawEmployee?.date_of_joining || rawEmployee?.created_at);
    const validTill = rawEmployee?.date_of_joining
        ? (() => {
              const d = new Date(rawEmployee.date_of_joining);
              d.setFullYear(d.getFullYear() + 3);
              return formatDate(d.toISOString());
          })()
        : "Permanent";

    const companyName = rawEmployee?.company?.name || rawEmployee?.company_name || "Apaar Logistics & Cold Supply Chain Pvt Ltd";
    const officeName = employee.location && employee.location !== "Unknown"
        ? employee.location
        : rawEmployee?.office?.name || "Ujjain Central Hub";
    const designation = employee.jobTitle || rawEmployee?.designation || "Operations Executive";
    const department = rawEmployee?.department || "Operations";
    const bloodGroup = rawEmployee?.blood_group || "B+";
    const empCode = rawEmployee?.emp_code || employee.id || "APA001";
    const phone = employee.phone || rawEmployee?.phone || "—";
    const emergencyName = rawEmployee?.emergency_contact_name || "HR Operations Cell";
    const emergencyPhone = rawEmployee?.emergency_contact_phone || "8601677140";
    const emergencyRelation = rawEmployee?.emergency_contact_relation ? `(${rawEmployee.emergency_contact_relation})` : "";
    const uan = rawEmployee?.uan || "—";

    const handlePrint = () => {
        window.print();
    };

    // ── FRONT CARD COMPONENT ──
    const renderFrontCard = (isPrint = false) => {
        const isNavy = cardTheme === "navy" && !isPrint;
        return (
            <div
                className={cn(
                    "relative w-[320px] h-[500px] rounded-[24px] shadow-2xl flex flex-col justify-between overflow-hidden border transition-all duration-300 select-none",
                    isNavy
                        ? "bg-gradient-to-b from-[#0B1329] via-[#111C44] to-[#0A0F24] text-white border-slate-700/80 shadow-indigo-950/50"
                        : "bg-white text-slate-900 border-slate-300/80 shadow-slate-300/50",
                    isPrint && "border-slate-400 shadow-none"
                )}
            >
                {/* Background decorative security micro-pattern */}
                <div className="absolute inset-0 opacity-[0.035] pointer-events-none bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:12px_12px]" />

                {/* Top Badge Lanyard Slot Hole */}
                <div className="pt-3 pb-1 flex justify-center z-10">
                    <div
                        className={cn(
                            "w-14 h-2.5 rounded-full border shadow-inner flex items-center justify-center",
                            isNavy ? "bg-slate-950/90 border-slate-700" : "bg-slate-200 border-slate-300"
                        )}
                    >
                        <div className="w-8 h-1 rounded-full bg-slate-800/40" />
                    </div>
                </div>

                {/* ── CARD HEADER ── */}
                <div className="px-5 pt-1 pb-2 z-10">
                    <div className="flex items-center justify-between border-b pb-2 border-white/10">
                        <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-amber-400 to-amber-200 text-slate-950 font-black flex items-center justify-center shadow-md">
                                <Building2 className="h-4 w-4" />
                            </div>
                            <div>
                                <h3 className={cn("text-[11px] font-black uppercase tracking-tight leading-tight", isNavy ? "text-white" : "text-slate-900")}>
                                    {companyName}
                                </h3>
                                <p className="text-[7.5px] font-bold text-amber-400 uppercase tracking-widest leading-none mt-0.5">
                                    Official Identity Badge
                                </p>
                            </div>
                        </div>
                        <div className="flex flex-col items-end">
                            <span className="flex h-2 w-2 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                            </span>
                            <span className="text-[6.5px] font-bold uppercase tracking-widest text-emerald-400 mt-1">
                                ACTIVE
                            </span>
                        </div>
                    </div>
                </div>

                {/* ── EMPLOYEE PHOTO & IDENTITY ── */}
                <div className="px-5 flex flex-col items-center text-center z-10 -mt-1">
                    {/* Photo Container */}
                    <div className="relative group">
                        <div
                            className={cn(
                                "w-24 h-28 rounded-2xl p-1 shadow-xl border-2 transition-transform duration-200 flex items-center justify-center overflow-hidden",
                                isNavy
                                    ? "bg-gradient-to-b from-amber-300/30 via-slate-800 to-slate-900 border-amber-400/60 shadow-amber-500/10"
                                    : "bg-slate-100 border-slate-300 shadow-sm"
                            )}
                        >
                            {localPhoto ? (
                                <img
                                    src={localPhoto}
                                    alt={employee.name}
                                    className="w-full h-full object-cover rounded-xl"
                                />
                            ) : (
                                <div className="w-full h-full rounded-xl bg-gradient-to-br from-indigo-900 to-slate-900 flex flex-col items-center justify-center text-white">
                                    <span className="text-2xl font-black italic tracking-tighter text-amber-300">
                                        {employee.name?.slice(0, 2).toUpperCase()}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Quick Photo Upload Trigger Overlay */}
                        {!isPrint && (
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                title="Upload/Change Employee Photo"
                                className="absolute -bottom-1.5 -right-1.5 h-7 w-7 rounded-full bg-amber-400 hover:bg-amber-300 text-slate-950 flex items-center justify-center shadow-lg border-2 border-white transition-transform hover:scale-110 cursor-pointer"
                            >
                                {uploadingPhoto ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                    <Camera className="h-3.5 w-3.5 stroke-[2.5]" />
                                )}
                            </button>
                        )}
                    </div>

                    {/* Name & Designation */}
                    <div className="mt-2.5 space-y-0.5">
                        <h2 className={cn("text-base font-black uppercase tracking-tight", isNavy ? "text-white" : "text-slate-900")}>
                            {employee.name}
                        </h2>
                        <div className="inline-block px-2.5 py-0.5 rounded-full bg-amber-400/15 border border-amber-400/40 text-amber-400 text-[8.5px] font-black uppercase tracking-wider">
                            {designation}
                        </div>
                    </div>
                </div>

                {/* ── METADATA GRID ── */}
                <div className="px-5 py-2 z-10">
                    <div
                        className={cn(
                            "rounded-xl p-2.5 border grid grid-cols-2 gap-x-2 gap-y-1.5 text-[8.5px]",
                            isNavy ? "bg-white/[0.04] border-white/10" : "bg-slate-50 border-slate-200 text-slate-700"
                        )}
                    >
                        <div>
                            <span className="block text-[7px] font-bold text-slate-400 uppercase tracking-widest">
                                Employee Code
                            </span>
                            <span className="font-mono font-black text-amber-300 text-[10px] tracking-wider">
                                {empCode}
                            </span>
                        </div>
                        <div>
                            <span className="block text-[7px] font-bold text-slate-400 uppercase tracking-widest">
                                Department
                            </span>
                            <span className={cn("font-bold truncate block", isNavy ? "text-slate-200" : "text-slate-800")}>
                                {department}
                            </span>
                        </div>
                        <div>
                            <span className="block text-[7px] font-bold text-slate-400 uppercase tracking-widest">
                                Blood Group
                            </span>
                            <span className="font-bold text-rose-400 flex items-center gap-1">
                                <Heart className="h-2.5 w-2.5 fill-rose-500 text-rose-500" />
                                {bloodGroup}
                            </span>
                        </div>
                        <div>
                            <span className="block text-[7px] font-bold text-slate-400 uppercase tracking-widest">
                                Office / Hub
                            </span>
                            <span className={cn("font-bold truncate block", isNavy ? "text-slate-200" : "text-slate-800")}>
                                {officeName}
                            </span>
                        </div>
                        <div>
                            <span className="block text-[7px] font-bold text-slate-400 uppercase tracking-widest">
                                Date of Joining
                            </span>
                            <span className={cn("font-bold block", isNavy ? "text-slate-300" : "text-slate-700")}>
                                {joiningDate}
                            </span>
                        </div>
                        <div>
                            <span className="block text-[7px] font-bold text-slate-400 uppercase tracking-widest">
                                Valid Till
                            </span>
                            <span className="font-bold text-emerald-400 block">
                                {validTill}
                            </span>
                        </div>
                    </div>
                </div>

                {/* ── CARD FOOTER & BARCODE ── */}
                <div
                    className={cn(
                        "px-5 pt-1.5 pb-3 border-t z-10 flex flex-col items-center justify-center",
                        isNavy ? "border-white/10 bg-black/20 text-slate-200" : "border-slate-200 bg-slate-50 text-slate-800"
                    )}
                >
                    <VectorBarcode text={empCode} className={isNavy ? "text-slate-200" : "text-slate-800"} />
                </div>
            </div>
        );
    };

    // ── BACK CARD COMPONENT ──
    const renderBackCard = (isPrint = false) => {
        const isNavy = cardTheme === "navy" && !isPrint;
        return (
            <div
                className={cn(
                    "relative w-[320px] h-[500px] rounded-[24px] shadow-2xl flex flex-col justify-between overflow-hidden border transition-all duration-300 select-none",
                    isNavy
                        ? "bg-gradient-to-b from-[#0B1329] via-[#111C44] to-[#0A0F24] text-white border-slate-700/80 shadow-indigo-950/50"
                        : "bg-white text-slate-900 border-slate-300/80 shadow-slate-300/50",
                    isPrint && "border-slate-400 shadow-none"
                )}
            >
                {/* Background pattern */}
                <div className="absolute inset-0 opacity-[0.035] pointer-events-none bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:12px_12px]" />

                {/* Top Badge Lanyard Slot Hole */}
                <div className="pt-3 pb-1 flex justify-center z-10">
                    <div
                        className={cn(
                            "w-14 h-2.5 rounded-full border shadow-inner flex items-center justify-center",
                            isNavy ? "bg-slate-950/90 border-slate-700" : "bg-slate-200 border-slate-300"
                        )}
                    >
                        <div className="w-8 h-1 rounded-full bg-slate-800/40" />
                    </div>
                </div>

                {/* Magnetic Stripe Visual */}
                <div className="h-8 w-full bg-gradient-to-r from-neutral-950 via-slate-900 to-neutral-950 border-y border-white/10 flex items-center justify-end px-4">
                    <span className="font-mono text-[6.5px] font-black uppercase tracking-[0.25em] text-white/40">
                        MAGNETIC ENCODED PERSONNEL ID
                    </span>
                </div>

                {/* ── INSTRUCTIONS & LEGAL TERMS ── */}
                <div className="px-5 pt-2 z-10 space-y-1.5 text-[7.5px] leading-relaxed text-slate-300">
                    <p className="font-black uppercase tracking-wider text-amber-400 text-[8px]">
                        Terms & Guidelines:
                    </p>
                    <ul className="list-disc pl-3.5 space-y-0.5 opacity-90">
                        <li>This card is company property and strictly non-transferable.</li>
                        <li>Must be visibly displayed at all times within company premises & duty sites.</li>
                        <li>Loss of this card must be immediately reported to HR operations.</li>
                        <li>If found, kindly drop in nearest post box or return to corporate headquarters.</li>
                    </ul>
                </div>

                {/* ── EMERGENCY & VERIFICATION DETAILS ── */}
                <div className="px-5 py-1 z-10">
                    <div
                        className={cn(
                            "rounded-xl p-2.5 border space-y-1.5 text-[8px]",
                            isNavy ? "bg-white/[0.04] border-white/10" : "bg-slate-50 border-slate-200"
                        )}
                    >
                        <div className="flex items-center justify-between border-b pb-1 border-white/10">
                            <span className="text-[7px] font-bold text-slate-400 uppercase tracking-wider">
                                Emergency Contact:
                            </span>
                            <span className="font-black text-rose-400">
                                {emergencyName} {emergencyRelation}
                            </span>
                        </div>
                        <div className="flex items-center justify-between border-b pb-1 border-white/10">
                            <span className="text-[7px] font-bold text-slate-400 uppercase tracking-wider">
                                Emergency Phone:
                            </span>
                            <span className="font-mono font-black text-white">
                                {emergencyPhone}
                            </span>
                        </div>
                        <div className="flex items-center justify-between border-b pb-1 border-white/10">
                            <span className="text-[7px] font-bold text-slate-400 uppercase tracking-wider">
                                Blood Group / UAN:
                            </span>
                            <span className="font-mono font-bold text-amber-300">
                                {bloodGroup} • UAN: {uan !== "—" ? `${uan.slice(0, 4)}XXXX${uan.slice(-4)}` : "NA"}
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-[7px] font-bold text-slate-400 uppercase tracking-wider">
                                Workplace Phone:
                            </span>
                            <span className="font-mono font-bold text-slate-200">
                                {phone}
                            </span>
                        </div>
                    </div>
                </div>

                {/* ── CORPORATE ADDRESS & CONTACT ── */}
                <div className="px-5 text-[7px] text-slate-400 space-y-0.5 z-10">
                    <p className="font-black uppercase text-amber-300 text-[7.5px]">
                        Corporate Headquarters & Logistics Center:
                    </p>
                    <p className="leading-tight">
                        {companyName} • Regd. Office: {officeName}
                    </p>
                    <p className="font-mono text-slate-300">
                        Helpdesk: support@apaarlogistics.com • Web: www.apaarlogistics.com
                    </p>
                </div>

                {/* ── AUTHORIZED SIGNATURE & SEAL ── */}
                <div className="px-5 py-1 z-10 flex items-center justify-between">
                    <div>
                        <div className="h-7 w-24 border-b border-white/40 flex items-end justify-center pb-0.5">
                            <span className="font-serif italic text-amber-200 text-[10px] tracking-wider select-none">
                                Sunil Parekh
                            </span>
                        </div>
                        <span className="text-[6.5px] font-black uppercase tracking-widest text-slate-400 block mt-0.5">
                            Authorised Signatory
                        </span>
                    </div>

                    <CorporateSeal companyName={companyName} />
                </div>

                {/* ── FOOTER BAR ── */}
                <div
                    className={cn(
                        "px-5 py-2 border-t z-10 flex items-center justify-between text-[7px] font-mono",
                        isNavy ? "border-white/10 bg-black/20 text-slate-400" : "border-slate-200 bg-slate-50 text-slate-600"
                    )}
                >
                    <span>ID: {empCode}</span>
                    <span className="uppercase">ISO 9001:2015 CERTIFIED</span>
                </div>
            </div>
        );
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-[760px] p-0 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl text-white overflow-hidden">
                {/* ── MODAL HEADER ── */}
                <div className="p-6 pb-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-950/60">
                    <div>
                        <DialogTitle className="text-base font-black uppercase tracking-wider text-white flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-amber-400" />
                            Official Corporate Identity Badge
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-400 mt-0.5">
                            Dual-sided CR80 badge design ready for high-resolution plastic card printing
                        </DialogDescription>
                    </div>

                    {/* View switcher buttons */}
                    <div className="flex items-center gap-1.5 bg-slate-800/80 p-1 rounded-xl border border-slate-700">
                        <button
                            type="button"
                            onClick={() => setViewMode("both")}
                            className={cn(
                                "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                                viewMode === "both" ? "bg-amber-400 text-slate-950 shadow-md" : "text-slate-400 hover:text-white"
                            )}
                        >
                            Both Sides
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode("front")}
                            className={cn(
                                "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                                viewMode === "front" ? "bg-amber-400 text-slate-950 shadow-md" : "text-slate-400 hover:text-white"
                            )}
                        >
                            Front
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode("back")}
                            className={cn(
                                "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                                viewMode === "back" ? "bg-amber-400 text-slate-950 shadow-md" : "text-slate-400 hover:text-white"
                            )}
                        >
                            Back
                        </button>
                    </div>
                </div>

                {/* ── CONTROLS TOOLBAR ── */}
                <div className="px-6 py-2.5 bg-slate-950/30 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                    {/* Theme selector */}
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Card Theme:</span>
                        <button
                            type="button"
                            onClick={() => setCardTheme("navy")}
                            className={cn(
                                "px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border flex items-center gap-1.5 transition-all",
                                cardTheme === "navy"
                                    ? "bg-indigo-950 text-indigo-300 border-indigo-500/50 shadow"
                                    : "bg-slate-800 text-slate-400 border-slate-700 hover:text-white"
                            )}
                        >
                            <span className="h-2 w-2 rounded-full bg-indigo-500" />
                            Navy Executive
                        </button>
                        <button
                            type="button"
                            onClick={() => setCardTheme("white")}
                            className={cn(
                                "px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border flex items-center gap-1.5 transition-all",
                                cardTheme === "white"
                                    ? "bg-white text-slate-900 border-white shadow"
                                    : "bg-slate-800 text-slate-400 border-slate-700 hover:text-white"
                            )}
                        >
                            <span className="h-2 w-2 rounded-full bg-slate-300" />
                            Classic White
                        </button>
                    </div>

                    {/* Photo upload trigger button */}
                    <div className="flex items-center gap-2">
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handlePhotoSelect}
                            accept="image/*"
                            className="hidden"
                        />
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={uploadingPhoto}
                            onClick={() => fileInputRef.current?.click()}
                            className="h-8 px-3 rounded-xl border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-slate-200 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5"
                        >
                            {uploadingPhoto ? (
                                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            ) : (
                                <Upload className="h-3 w-3 text-amber-400" />
                            )}
                            {localPhoto ? "Change Photo" : "Upload Photo"}
                        </Button>
                    </div>
                </div>

                {/* ── CARD PREVIEW CANVAS ── */}
                <div className="p-6 md:p-8 flex items-center justify-center bg-slate-950/80 overflow-x-auto min-h-[540px]">
                    <div className="flex flex-wrap items-center justify-center gap-8">
                        {(viewMode === "front" || viewMode === "both") && (
                            <div className="flex flex-col items-center gap-2">
                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 bg-slate-800/60 px-3 py-1 rounded-full border border-slate-700/60">
                                    Front Side (CR80)
                                </span>
                                {renderFrontCard(false)}
                            </div>
                        )}

                        {(viewMode === "back" || viewMode === "both") && (
                            <div className="flex flex-col items-center gap-2">
                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 bg-slate-800/60 px-3 py-1 rounded-full border border-slate-700/60">
                                    Back Side (CR80)
                                </span>
                                {renderBackCard(false)}
                            </div>
                        )}
                    </div>
                </div>

                {/* ── PRINT-ONLY CONTAINER (Invisible on screen, styled specifically for @media print) ── */}
                <div id="id-card-print-container" className="hidden print:flex">
                    <div className="print-card-wrapper">
                        {renderFrontCard(true)}
                    </div>
                    <div className="print-cut-guide">
                        <div className="cut-line" />
                        <span className="cut-text">✂ FOLD / CUT GUIDE ✂</span>
                        <div className="cut-line" />
                    </div>
                    <div className="print-card-wrapper">
                        {renderBackCard(true)}
                    </div>
                </div>

                {/* ── MODAL FOOTER ── */}
                <div className="p-5 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
                    <p className="text-[10px] text-slate-400 hidden sm:block">
                        Tip: Click <b>Print Card</b> to print Front & Back together on A4 or badge card printer.
                    </p>

                    <div className="flex items-center gap-2.5 ml-auto">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                            className="h-10 px-5 rounded-xl border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs"
                        >
                            Close
                        </Button>
                        <Button
                            type="button"
                            onClick={handlePrint}
                            className="h-10 px-6 rounded-xl font-black text-xs uppercase tracking-wider bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-lg shadow-amber-400/20 flex items-center gap-2"
                        >
                            <Printer className="h-4 w-4 stroke-[2.5]" />
                            Print Card
                        </Button>
                    </div>
                </div>

                {/* ── GLOBAL PRINT STYLES ── */}
                <style jsx global>{`
                    @media print {
                        @page {
                            size: A4 portrait;
                            margin: 15mm;
                        }
                        body * {
                            visibility: hidden !important;
                        }
                        #id-card-print-container,
                        #id-card-print-container * {
                            visibility: visible !important;
                        }
                        #id-card-print-container {
                            position: fixed !important;
                            left: 0 !important;
                            top: 0 !important;
                            width: 100vw !important;
                            height: 100vh !important;
                            display: flex !important;
                            flex-direction: row !important;
                            justify-content: center !important;
                            align-items: center !important;
                            gap: 12mm !important;
                            background: #ffffff !important;
                            padding: 20mm !important;
                            margin: 0 !important;
                            z-index: 999999 !important;
                            -webkit-print-color-adjust: exact !important;
                            print-color-adjust: exact !important;
                        }
                        .print-card-wrapper {
                            page-break-inside: avoid;
                        }
                        .print-cut-guide {
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            justify-content: center;
                            gap: 8px;
                            color: #94a3b8;
                            font-size: 8px;
                            font-family: monospace;
                        }
                        .cut-line {
                            width: 1px;
                            height: 120px;
                            border-left: 1px dashed #cbd5e1;
                        }
                        .cut-text {
                            writing-mode: vertical-rl;
                            letter-spacing: 2px;
                            font-weight: bold;
                        }
                    }
                `}</style>
            </DialogContent>
        </Dialog>
    );
}
