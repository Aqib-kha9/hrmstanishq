"use client";

import React, { useState, useRef, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { apiPatch } from "@/lib/api-client";
import type { BackendEmployee, FrontendEmployee } from "@/lib/transform";
import {
    Printer,
    Camera,
    Upload,
    Phone,
    Heart,
    ShieldCheck,
    Loader2,
    Edit2,
    Check,
    RotateCcw,
    Sparkles,
} from "lucide-react";

interface EmployeeIdCardModalProps {
    isOpen: boolean;
    onClose: () => void;
    employee: FrontendEmployee;
    rawEmployee: BackendEmployee | null;
    onPhotoUpdated?: (newPhotoUrl: string) => void;
}

export function EmployeeIdCardModal({
    isOpen,
    onClose,
    employee,
    rawEmployee,
    onPhotoUpdated,
}: EmployeeIdCardModalProps) {
    const [viewMode, setViewMode] = useState<"front" | "back" | "both">("both");
    const [isEditing, setIsEditing] = useState(false);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const [localPhoto, setLocalPhoto] = useState<string | null>(rawEmployee?.profile_image || null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Format Date helper
    const formatDate = (dateStr: string | null | undefined): string => {
        if (!dateStr) return "14/01/1990";
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return String(dateStr);
            const day = String(d.getDate()).padStart(2, "0");
            const month = String(d.getMonth() + 1).padStart(2, "0");
            const year = d.getFullYear();
            return `${day}/${month}/${year}`;
        } catch {
            return String(dateStr);
        }
    };

    // Editable Card Data State matching the exact design
    const [cardData, setCardData] = useState({
        orgName: "AKHIL BHARAT HINDU MAHASABHA",
        unitName: "MADHYA PRADESH UNIT",
        name: "RAM KUMAR SINGH",
        designation: "DISTRICT MEMBER",
        fatherName: "SHRI SURESH SINGH",
        dob: "14/01/1990",
        address: "108, SHIV NAGAR, MP NAGAR, BHOPAL, MADHYA PRADESH",
        phone: "+91 98765 43210",
        bloodGroup: "B+VE",
        status: "ACTIVE",
        memberId: "ABHM-MP-2024-1008",
        stateUnit: "MADHYA PRADESH",
        tagline: "SANGATHIT HINDU - SAMARTH BHARAT",
        website: "WWW.ABHM-MP.ORG",
    });

    // Sync from employee / rawEmployee on load
    useEffect(() => {
        if (employee) {
            const empName = (rawEmployee?.name || employee.name || "RAM KUMAR SINGH").toUpperCase();
            const empDesig = (rawEmployee?.designation || employee.jobTitle || "DISTRICT MEMBER").toUpperCase();
            const empCode = rawEmployee?.emp_code || employee.id || "ABHM-MP-2024-1008";
            const empPhone = rawEmployee?.phone || employee.phone || "+91 98765 43210";
            const empFather = (rawEmployee?.father_or_husband_name || "SHRI SURESH SINGH").toUpperCase();
            const empDob = rawEmployee?.date_of_birth ? formatDate(rawEmployee.date_of_birth) : "14/01/1990";
            const empAddr = (rawEmployee?.address || "108, SHIV NAGAR, MP NAGAR, BHOPAL, MADHYA PRADESH").toUpperCase();
            const empBlood = (rawEmployee?.blood_group || "B+VE").toUpperCase().replace("POSITIVE", "+VE").replace("POS", "+VE");
            const empLocation = (employee.location && employee.location !== "Unknown" ? employee.location : rawEmployee?.office?.name || "MADHYA PRADESH").toUpperCase();
            const org = (rawEmployee?.company?.name || rawEmployee?.company_name || "AKHIL BHARAT HINDU MAHASABHA").toUpperCase();

            setCardData({
                orgName: org,
                unitName: "MADHYA PRADESH UNIT",
                name: empName,
                designation: empDesig,
                fatherName: empFather,
                dob: empDob,
                address: empAddr,
                phone: empPhone.startsWith("+") ? empPhone : `+91 ${empPhone}`,
                bloodGroup: empBlood.includes("+") || empBlood.includes("-") ? empBlood : `${empBlood}+VE`,
                status: (rawEmployee?.status || employee.status || "ACTIVE").toUpperCase(),
                memberId: empCode,
                stateUnit: empLocation,
                tagline: "SANGATHIT HINDU - SAMARTH BHARAT",
                website: "WWW.ABHM-MP.ORG",
            });
        }
        if (rawEmployee?.profile_image) {
            setLocalPhoto(rawEmployee.profile_image);
        }
    }, [employee, rawEmployee]);

    // Handle Photo Upload
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

    // ── FALLBACK VECTOR QR CODE SVG (Rendered in vibrant orange #EA580C) ──
    const renderOrangeQRCode = () => {
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&color=ea580c&bgcolor=ffffff&data=${encodeURIComponent(
            `ID:${cardData.memberId}|NAME:${cardData.name}|UNIT:${cardData.stateUnit}|STATUS:${cardData.status}`
        )}`;

        return (
            <div className="w-[105px] h-[105px] rounded-xl p-1 bg-white border border-orange-200/60 shadow-sm flex items-center justify-center overflow-hidden">
                <img
                    src={qrUrl}
                    alt="Verification QR Code"
                    className="w-full h-full object-contain"
                    onError={(e) => {
                        // Fallback SVG representation if network image is blocked
                        const target = e.currentTarget;
                        target.style.display = "none";
                        const parent = target.parentElement;
                        if (parent) {
                            parent.innerHTML = `
                                <svg viewBox="0 0 100 100" class="w-full h-full text-orange-600">
                                    <rect width="100" height="100" fill="#ffffff" />
                                    <rect x="10" y="10" width="28" height="28" fill="#ea580c" />
                                    <rect x="15" y="15" width="18" height="18" fill="#ffffff" />
                                    <rect x="19" y="19" width="10" height="10" fill="#ea580c" />
                                    <rect x="62" y="10" width="28" height="28" fill="#ea580c" />
                                    <rect x="67" y="15" width="18" height="18" fill="#ffffff" />
                                    <rect x="71" y="19" width="10" height="10" fill="#ea580c" />
                                    <rect x="10" y="62" width="28" height="28" fill="#ea580c" />
                                    <rect x="15" y="67" width="18" height="18" fill="#ffffff" />
                                    <rect x="19" y="71" width="10" height="10" fill="#ea580c" />
                                    <rect x="44" y="14" width="8" height="16" fill="#ea580c" />
                                    <rect x="14" y="44" width="16" height="8" fill="#ea580c" />
                                    <rect x="44" y="44" width="12" height="12" fill="#ea580c" />
                                    <rect x="64" y="44" width="14" height="8" fill="#ea580c" />
                                    <rect x="44" y="64" width="8" height="22" fill="#ea580c" />
                                    <rect x="60" y="64" width="16" height="8" fill="#ea580c" />
                                    <rect x="70" y="76" width="16" height="12" fill="#ea580c" />
                                </svg>
                            `;
                        }
                    }}
                />
            </div>
        );
    };

    // ── FRONT SIDE CARD (Matches Image 2 exactly) ──
    const renderFrontCard = (isPrint = false) => {
        return (
            <div
                className={cn(
                    "relative w-[480px] h-[305px] rounded-[28px] overflow-hidden bg-white shadow-xl border border-slate-200/90 flex flex-col justify-between select-none",
                    isPrint && "shadow-none border-slate-300"
                )}
            >
                {/* ── TOP HEADER (Diagonal Split Black & Orange) ── */}
                <div className="relative h-[54px] w-full shrink-0 overflow-hidden">
                    {/* Background SVG with Diagonal Cut */}
                    <svg viewBox="0 0 480 54" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
                        {/* Right Orange Section */}
                        <rect x="0" y="0" width="480" height="54" fill="#E65100" />
                        {/* Left Black Angled Section (polygon points: 0,0 -> 350,0 -> 332,54 -> 0,54) */}
                        <polygon points="0,0 350,0 332,54 0,54" fill="#0A0A0A" />
                    </svg>

                    {/* Content inside Header */}
                    <div className="relative z-10 flex items-center justify-between h-full px-4">
                        {/* Left Logo + Text */}
                        <div className="flex items-center gap-2.5 max-w-[325px]">
                            {/* Circular Orange Emblem Logo matching reference */}
                            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-orange-600 via-amber-500 to-orange-500 border-2 border-white shadow-md flex items-center justify-center shrink-0 p-0.5">
                                <div className="w-full h-full rounded-full border border-white/80 flex flex-col items-center justify-center bg-orange-600 relative overflow-hidden">
                                    <svg viewBox="0 0 100 100" className="w-full h-full">
                                        <circle cx="50" cy="50" r="48" fill="#E65100" />
                                        <circle cx="50" cy="50" r="38" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeDasharray="4 2" />
                                        <path id="badgePath" d="M 50,50 m -30,0 a 30,30 0 1,1 60,0 a 30,30 0 1,1 -60,0" fill="none" />
                                        <text fill="#FFFFFF" fontSize="8.5" fontWeight="900" letterSpacing="0.5">
                                            <textPath href="#badgePath" startOffset="50%" textAnchor="middle">
                                                जय हिन्दू राष्ट्र
                                            </textPath>
                                        </text>
                                        <polygon points="46,40 58,46 46,52" fill="#FFA726" stroke="#FFFFFF" strokeWidth="0.8" />
                                        <line x1="46" y1="37" x2="46" y2="61" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
                                    </svg>
                                </div>
                            </div>

                            {/* Organization & Unit Titles */}
                            <div className="flex flex-col justify-center leading-tight">
                                <span className="text-[10px] font-black tracking-wider text-white uppercase truncate">
                                    {cardData.orgName}
                                </span>
                                <span className="text-[13px] font-black tracking-wide text-[#FF7043] uppercase truncate">
                                    {cardData.unitName}
                                </span>
                            </div>
                        </div>

                        {/* Right Flag Graphic matching reference */}
                        <div className="flex items-center justify-end pr-2.5">
                            <svg viewBox="0 0 46 30" className="w-11 h-7 drop-shadow">
                                <line x1="6" y1="3" x2="6" y2="28" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
                                <circle cx="6" cy="3" r="1.5" fill="#FFFFFF" />
                                <path d="M7,5 L42,13 L7,21 Z" fill="#FFA726" />
                                <line x1="7" y1="5" x2="42" y2="13" stroke="#FFFFFF" strokeWidth="0.8" />
                                <line x1="42" y1="13" x2="7" y2="21" stroke="#FFFFFF" strokeWidth="0.8" />
                                <text x="18" y="14" fill="#FFFFFF" fontSize="8" fontWeight="900" textAnchor="middle" dominantBaseline="middle">卐</text>
                            </svg>
                        </div>
                    </div>
                </div>

                {/* ── MIDDLE BODY (Left Oval Photo + Right Details) ── */}
                <div className="flex items-center px-4 py-2 gap-4 grow">
                    {/* Left Column: Oval Photo + Status */}
                    <div className="flex flex-col items-center shrink-0">
                        {/* Oval Photo Frame */}
                        <div className="relative group">
                            <div className="w-[115px] h-[142px] rounded-[48px] border-2 border-[#FED7AA] overflow-hidden bg-slate-100 shadow-sm flex items-center justify-center">
                                {localPhoto ? (
                                    <img
                                        src={localPhoto}
                                        alt={cardData.name}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full bg-gradient-to-br from-slate-200 to-slate-300 flex flex-col items-center justify-center text-slate-500">
                                        <span className="text-3xl font-black italic tracking-tighter text-slate-700">
                                            {cardData.name.slice(0, 2).toUpperCase()}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Quick Photo Upload Button */}
                            {!isPrint && (
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    title="Upload / Change Photo"
                                    className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-[#EA580C] hover:bg-[#C2410C] text-white flex items-center justify-center shadow-md border-2 border-white transition-transform hover:scale-110 cursor-pointer"
                                >
                                    {uploadingPhoto ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                        <Camera className="h-3.5 w-3.5 stroke-[2.5]" />
                                    )}
                                </button>
                            )}
                        </div>

                        {/* Status Label below photo */}
                        <span className="text-[10px] font-black text-[#EA580C] uppercase tracking-wider text-center mt-1.5 leading-none">
                            STATUS: {cardData.status}
                        </span>
                    </div>

                    {/* Right Column: Name, Designation & Data Grid */}
                    <div className="flex flex-col justify-center grow space-y-1 pr-1">
                        {/* Name */}
                        <h2 className="text-[17px] font-black text-slate-900 tracking-tight leading-none uppercase">
                            {cardData.name}
                        </h2>

                        {/* Designation / Role in Orange */}
                        <div className="text-[11.5px] font-black text-[#EA580C] uppercase tracking-wider leading-none pb-1">
                            {cardData.designation}
                        </div>

                        {/* Fields Table */}
                        <div className="space-y-1 text-[10px]">
                            {/* S/O */}
                            <div className="flex items-start">
                                <span className="font-black text-slate-500 uppercase w-12 shrink-0">
                                    S/O:
                                </span>
                                <span className="font-black text-slate-900 uppercase tracking-tight truncate">
                                    {cardData.fatherName}
                                </span>
                            </div>

                            {/* DOB */}
                            <div className="flex items-start">
                                <span className="font-black text-slate-500 uppercase w-12 shrink-0">
                                    DOB:
                                </span>
                                <span className="font-black text-slate-900 uppercase">
                                    {cardData.dob}
                                </span>
                            </div>

                            {/* ADDR */}
                            <div className="flex items-start">
                                <span className="font-black text-slate-500 uppercase w-12 shrink-0 pt-0.5">
                                    ADDR:
                                </span>
                                <span className="font-black text-slate-800 uppercase leading-[1.2] text-[9.5px] line-clamp-2">
                                    {cardData.address}
                                </span>
                            </div>

                            {/* Contact Row: Phone & Blood Group */}
                            <div className="flex items-center justify-between pt-1">
                                <div className="flex items-center gap-1.5 text-slate-900 font-black text-[10.5px]">
                                    <Phone className="h-3.5 w-3.5 text-[#EA580C] shrink-0" />
                                    <span>{cardData.phone}</span>
                                </div>
                                <div className="flex items-center gap-1 text-slate-900 font-black text-[10.5px]">
                                    <Heart className="h-3.5 w-3.5 text-rose-600 fill-rose-600 shrink-0" />
                                    <span>B: {cardData.bloodGroup}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── BOTTOM FOOTER BAR ── */}
                <div className="h-[46px] w-full bg-[#F1F5F9] border-t border-slate-200/90 px-5 flex items-center justify-between shrink-0">
                    {/* Left: Member ID */}
                    <div className="flex flex-col">
                        <span className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest leading-none">
                            MEMBER ID
                        </span>
                        <span className="text-[12px] font-black text-slate-900 uppercase tracking-wider font-mono mt-0.5 leading-tight">
                            {cardData.memberId}
                        </span>
                    </div>

                    {/* Right: State Unit */}
                    <div className="flex flex-col items-end">
                        <span className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest leading-none">
                            STATE UNIT
                        </span>
                        <span className="text-[12px] font-black text-[#EA580C] uppercase tracking-wider mt-0.5 leading-tight">
                            {cardData.stateUnit}
                        </span>
                    </div>
                </div>
            </div>
        );
    };

    // ── BACK SIDE CARD (Matches Image 3 exactly) ──
    const renderBackCard = (isPrint = false) => {
        return (
            <div
                className={cn(
                    "relative w-[480px] h-[305px] rounded-[28px] overflow-hidden bg-white shadow-xl border border-slate-200/90 flex flex-col justify-between select-none",
                    isPrint && "shadow-none border-slate-300"
                )}
            >
                {/* Center Faint Watermark Logo */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.07]">
                    <svg viewBox="0 0 200 200" className="w-56 h-56 text-[#E65100]">
                        <circle cx="100" cy="100" r="90" fill="none" stroke="currentColor" strokeWidth="4" />
                        <circle cx="100" cy="100" r="76" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 3" />
                        <circle cx="100" cy="100" r="54" fill="none" stroke="currentColor" strokeWidth="2" />
                        <path id="watermarkPath" d="M 100,100 m -64,0 a 64,64 0 1,1 128,0 a 64,64 0 1,1 -128,0" fill="none" />
                        <text fill="currentColor" fontSize="10" fontWeight="900" letterSpacing="1.5">
                            <textPath href="#watermarkPath" startOffset="50%" textAnchor="middle">
                                अखिल भारत हिन्दू महासभा
                            </textPath>
                        </text>
                        <polygon points="90,75 125,92 90,110" fill="currentColor" />
                        <line x1="90" y1="70" x2="90" y2="135" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                        <text x="100" y="94" fill="#FFFFFF" fontSize="12" fontWeight="900" textAnchor="middle" dominantBaseline="middle">卐</text>
                    </svg>
                </div>

                {/* ── MAIN CONTENT (Instructions + Orange QR Code) ── */}
                <div className="p-6 pb-2 grow flex items-start justify-between gap-4 z-10">
                    {/* Left: General Instructions */}
                    <div className="flex flex-col space-y-2 max-w-[310px]">
                        <h3 className="text-[13.5px] font-black uppercase tracking-wider text-slate-900 border-b pb-1.5 border-slate-200">
                            GENERAL INSTRUCTIONS
                        </h3>
                        <ul className="space-y-1.5 text-[9.5px] font-black text-slate-800 uppercase leading-snug">
                            <li className="flex items-start gap-2">
                                <span className="text-[#EA580C] text-[11px] leading-none shrink-0 mt-0.5">▪</span>
                                <span>THIS CARD IS NON-TRANSFERABLE.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-[#EA580C] text-[11px] leading-none shrink-0 mt-0.5">▪</span>
                                <span>VALID ONLY WITH OFFICIAL SIGNATURE.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-[#EA580C] text-[11px] leading-none shrink-0 mt-0.5">▪</span>
                                <span>REPORT LOSS IMMEDIATELY TO STATE UNIT.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-[#EA580C] text-[11px] leading-none shrink-0 mt-0.5">▪</span>
                                <span>VERIFICATION AVAILABLE AT {cardData.website.replace("WWW.", "")}.</span>
                            </li>
                        </ul>
                    </div>

                    {/* Right: Orange QR Code */}
                    <div className="flex flex-col items-center shrink-0 pt-1">
                        {renderOrangeQRCode()}
                        <span className="text-[7.5px] font-black uppercase tracking-widest text-slate-500 text-center mt-1 leading-tight">
                            SCAN TO VERIFY<br />AUTHENTICITY
                        </span>
                    </div>
                </div>

                {/* ── BOTTOM FOOTER (Signature & State Unit Info) ── */}
                <div className="h-[62px] w-full bg-[#F8FAFC] border-t border-slate-200/90 px-6 flex items-center justify-between shrink-0 z-10">
                    {/* Left: Issuing Authority Signature */}
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-400 shadow-sm shrink-0">
                            <ShieldCheck className="h-5 w-5 text-slate-400 stroke-[1.5]" />
                        </div>
                        <div className="flex flex-col">
                            <div className="w-28 h-[1px] bg-slate-300 mt-2 mb-1" />
                            <span className="text-[7.5px] font-black uppercase tracking-widest text-slate-500 leading-none">
                                ISSUING AUTHORITY SIGNATURE
                            </span>
                        </div>
                    </div>

                    {/* Right: State Unit Titles & Website */}
                    <div className="flex flex-col items-end leading-tight">
                        <span className="text-[11px] font-black text-slate-900 uppercase tracking-tight">
                            {cardData.stateUnit} STATE UNIT
                        </span>
                        <span className="text-[8.5px] font-black text-[#EA580C] uppercase tracking-wider mt-0.5">
                            {cardData.tagline}
                        </span>
                        <span className="text-[8px] font-bold text-slate-500 underline uppercase mt-0.5">
                            {cardData.website}
                        </span>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-[1060px] p-0 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl text-white overflow-hidden">
                {/* ── MODAL TOP BAR ── */}
                <div className="p-5 pb-3.5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-950/70">
                    <div>
                        <DialogTitle className="text-base font-black uppercase tracking-wider text-white flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-[#EA580C]" />
                            Official Membership & Identity Card Preview
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-400 mt-0.5">
                            Exact CR80 design replica matching physical PVC badge specifications (Front & Back)
                        </DialogDescription>
                    </div>

                    {/* View mode switcher */}
                    <div className="flex items-center gap-1.5 bg-slate-800/90 p-1 rounded-xl border border-slate-700">
                        <button
                            type="button"
                            onClick={() => setViewMode("both")}
                            className={cn(
                                "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                                viewMode === "both" ? "bg-[#EA580C] text-white shadow-md" : "text-slate-400 hover:text-white"
                            )}
                        >
                            Both Sides
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode("front")}
                            className={cn(
                                "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                                viewMode === "front" ? "bg-[#EA580C] text-white shadow-md" : "text-slate-400 hover:text-white"
                            )}
                        >
                            Front
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode("back")}
                            className={cn(
                                "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                                viewMode === "back" ? "bg-[#EA580C] text-white shadow-md" : "text-slate-400 hover:text-white"
                            )}
                        >
                            Back
                        </button>
                    </div>
                </div>

                {/* ── TOOLBAR: PHOTO UPLOAD & QUICK EDIT ── */}
                <div className="px-6 py-2.5 bg-slate-950/40 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setIsEditing(!isEditing)}
                            className={cn(
                                "h-8 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all",
                                isEditing
                                    ? "bg-amber-400 text-slate-950 border-amber-400 hover:bg-amber-300"
                                    : "border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-slate-200"
                            )}
                        >
                            <Edit2 className="h-3 w-3" />
                            {isEditing ? "Hide Field Editor" : "Edit Card Details"}
                        </Button>
                    </div>

                    {/* Photo Upload Trigger */}
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
                            className="h-8 px-3.5 rounded-xl border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-slate-200 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5"
                        >
                            {uploadingPhoto ? (
                                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            ) : (
                                <Upload className="h-3 w-3 text-[#EA580C]" />
                            )}
                            {localPhoto ? "Change Photo" : "Upload Photo"}
                        </Button>
                    </div>
                </div>

                {/* ── OPTIONAL INLINE FIELD EDITOR (Lets user tweak any field before printing) ── */}
                {isEditing && (
                    <div className="p-4 bg-slate-950/90 border-b border-slate-800 text-xs">
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                            <div>
                                <label className="text-[9px] font-black text-slate-400 uppercase">Employee Name</label>
                                <Input
                                    value={cardData.name}
                                    onChange={(e) => setCardData({ ...cardData, name: e.target.value })}
                                    className="h-8 text-xs bg-slate-900 border-slate-700 text-white"
                                />
                            </div>
                            <div>
                                <label className="text-[9px] font-black text-slate-400 uppercase">Designation</label>
                                <Input
                                    value={cardData.designation}
                                    onChange={(e) => setCardData({ ...cardData, designation: e.target.value })}
                                    className="h-8 text-xs bg-slate-900 border-slate-700 text-white"
                                />
                            </div>
                            <div>
                                <label className="text-[9px] font-black text-slate-400 uppercase">Father/Husband (S/O)</label>
                                <Input
                                    value={cardData.fatherName}
                                    onChange={(e) => setCardData({ ...cardData, fatherName: e.target.value })}
                                    className="h-8 text-xs bg-slate-900 border-slate-700 text-white"
                                />
                            </div>
                            <div>
                                <label className="text-[9px] font-black text-slate-400 uppercase">Date of Birth</label>
                                <Input
                                    value={cardData.dob}
                                    onChange={(e) => setCardData({ ...cardData, dob: e.target.value })}
                                    className="h-8 text-xs bg-slate-900 border-slate-700 text-white"
                                />
                            </div>
                            <div>
                                <label className="text-[9px] font-black text-slate-400 uppercase">Phone Number</label>
                                <Input
                                    value={cardData.phone}
                                    onChange={(e) => setCardData({ ...cardData, phone: e.target.value })}
                                    className="h-8 text-xs bg-slate-900 border-slate-700 text-white"
                                />
                            </div>
                            <div>
                                <label className="text-[9px] font-black text-slate-400 uppercase">Blood Group</label>
                                <Input
                                    value={cardData.bloodGroup}
                                    onChange={(e) => setCardData({ ...cardData, bloodGroup: e.target.value })}
                                    className="h-8 text-xs bg-slate-900 border-slate-700 text-white"
                                />
                            </div>
                            <div>
                                <label className="text-[9px] font-black text-slate-400 uppercase">Member / Emp ID</label>
                                <Input
                                    value={cardData.memberId}
                                    onChange={(e) => setCardData({ ...cardData, memberId: e.target.value })}
                                    className="h-8 text-xs bg-slate-900 border-slate-700 text-white"
                                />
                            </div>
                            <div>
                                <label className="text-[9px] font-black text-slate-400 uppercase">State Unit / Branch</label>
                                <Input
                                    value={cardData.stateUnit}
                                    onChange={(e) => setCardData({ ...cardData, stateUnit: e.target.value })}
                                    className="h-8 text-xs bg-slate-900 border-slate-700 text-white"
                                />
                            </div>
                            <div className="col-span-2">
                                <label className="text-[9px] font-black text-slate-400 uppercase">Full Address</label>
                                <Input
                                    value={cardData.address}
                                    onChange={(e) => setCardData({ ...cardData, address: e.target.value })}
                                    className="h-8 text-xs bg-slate-900 border-slate-700 text-white"
                                />
                            </div>
                            <div>
                                <label className="text-[9px] font-black text-slate-400 uppercase">Organization Header</label>
                                <Input
                                    value={cardData.orgName}
                                    onChange={(e) => setCardData({ ...cardData, orgName: e.target.value })}
                                    className="h-8 text-xs bg-slate-900 border-slate-700 text-white"
                                />
                            </div>
                            <div>
                                <label className="text-[9px] font-black text-slate-400 uppercase">Unit Subtitle</label>
                                <Input
                                    value={cardData.unitName}
                                    onChange={(e) => setCardData({ ...cardData, unitName: e.target.value })}
                                    className="h-8 text-xs bg-slate-900 border-slate-700 text-white"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* ── CARD PREVIEW CANVAS ── */}
                <div className="p-6 md:p-8 flex items-center justify-center bg-slate-950/80 overflow-x-auto min-h-[380px]">
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

                {/* ── PRINT-ONLY CONTAINER (Invisible on screen, active on window.print()) ── */}
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
                        Ready for instant physical ID printing or A4 card laminating.
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
                            onClick={() => window.print()}
                            className="h-10 px-6 rounded-xl font-black text-xs uppercase tracking-wider bg-[#EA580C] hover:bg-[#C2410C] text-white shadow-lg shadow-orange-600/30 flex items-center gap-2 cursor-pointer"
                        >
                            <Printer className="h-4 w-4 stroke-[2.5]" />
                            Print Card
                        </Button>
                    </div>
                </div>

                {/* ── SPECIALIZED PRINT STYLES ── */}
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
                            flex-direction: column !important;
                            justify-content: center !important;
                            align-items: center !important;
                            gap: 15mm !important;
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
                            align-items: center;
                            justify-content: center;
                            gap: 12px;
                            width: 480px;
                            color: #94a3b8;
                            font-size: 8px;
                            font-family: monospace;
                        }
                        .cut-line {
                            height: 1px;
                            flex-grow: 1;
                            border-top: 1px dashed #cbd5e1;
                        }
                        .cut-text {
                            letter-spacing: 2px;
                            font-weight: bold;
                        }
                    }
                `}</style>
            </DialogContent>
        </Dialog>
    );
}
