"use client";

import React, { useState, useRef, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { apiPatch, apiGet } from "@/lib/api-client";
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
    RotateCcw,
    Sparkles,
    X,
    Download,
    Layers,
    FileCheck2,
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
    const [generatingPdf, setGeneratingPdf] = useState(false);
    const [localPhoto, setLocalPhoto] = useState<string | null>(rawEmployee?.profile_image || null);
    
    // Print Configuration States
    const [printScale, setPrintScale] = useState<"cr80" | "large">("cr80");
    const [printLayout, setPrintLayout] = useState<"foldable" | "sideBySide">("foldable");

    const fileInputRef = useRef<HTMLInputElement>(null);
    const sigFileInputRef = useRef<HTMLInputElement>(null);
    const [signatoriesList, setSignatoriesList] = useState<Array<{ id: number; name: string; designation: string; signature_url: string }>>([]);

    // Helpers
    const formatDate = (dateStr: string | null | undefined): string => {
        if (!dateStr) return "N/A";
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

    const getInitials = (str: string): string => {
        if (!str) return "CO";
        const words = str.trim().split(/\s+/);
        if (words.length >= 2) {
            return (words[0][0] + words[1][0]).toUpperCase();
        }
        return str.slice(0, 2).toUpperCase();
    };

    const getCompanyWebsite = (compName: string, rawWebsite?: string | null): string => {
        if (rawWebsite && rawWebsite.trim()) {
            return rawWebsite.trim().toUpperCase();
        }
        const clean = compName.toLowerCase().replace(/[^a-z0-9]/g, "");
        return `WWW.${clean || "company"}.COM`;
    };

    // Dynamic Card Data State
    const [cardData, setCardData] = useState({
        orgName: "APAAR LOGISTICS",
        orgInitials: "AL",
        unitName: "UJJAIN BRANCH",
        name: "ADAM",
        designation: "EXECUTIVE",
        fatherName: "OMPRAKASH SHARMA",
        dob: "20/05/1998",
        address: "12/3, MG ROAD, VIJAY NAGAR, INDORE, MP 452010",
        phone: "+91 8601677140",
        bloodGroup: "B+VE",
        status: "ACTIVE",
        memberId: "APA003",
        stateUnit: "UJJAIN",
        tagline: "COMMITTED TO EXCELLENCE & INTEGRITY",
        website: "WWW.APAARLOGISTICS.COM",
        signatureUrl: null as string | null,
        signatoryName: "",
        signatoryTitle: "",
    });

    // Populate data dynamically from employee, office, and company records
    const syncFromEmployee = () => {
        if (!employee) return;

        const org = (
            rawEmployee?.company?.name ||
            rawEmployee?.company_name ||
            employee.company ||
            "APAAR LOGISTICS"
        ).toUpperCase();

        const initials = (rawEmployee?.company?.code || getInitials(org)).toUpperCase();

        // Branch / Office location resolution
        const officeName = rawEmployee?.office?.name || "";
        const officeCity = rawEmployee?.office?.city || "";
        let cleanLocation = officeCity;
        if (!cleanLocation && officeName) {
            if (officeName.includes("—")) {
                cleanLocation = officeName.split("—")[1].trim();
            } else if (officeName.includes("-")) {
                cleanLocation = officeName.split("-")[1].trim();
            } else {
                cleanLocation = officeName;
            }
        }
        if (!cleanLocation && employee.location && employee.location !== "Unknown") {
            cleanLocation = employee.location;
        }
        if (!cleanLocation) {
            cleanLocation = "CENTRAL";
        }

        const branchUnit = `${cleanLocation.toUpperCase()} BRANCH`;
        const locationDisplay = cleanLocation.toUpperCase();
        const compWebsite = getCompanyWebsite(org, rawEmployee?.company?.website);

        const empName = (rawEmployee?.name || employee.name || "EMPLOYEE").toUpperCase();
        const empDesig = (rawEmployee?.designation || employee.jobTitle || "EXECUTIVE").toUpperCase();
        const empCode = rawEmployee?.emp_code || employee.id || "EMP001";
        const empPhone = rawEmployee?.phone || employee.phone || "+91 00000 00000";
        const empFather = (rawEmployee?.father_or_husband_name || "N/A").toUpperCase();
        const empDob = rawEmployee?.date_of_birth ? formatDate(rawEmployee.date_of_birth) : "N/A";
        const empAddr = (rawEmployee?.address || rawEmployee?.office?.address || "N/A").toUpperCase();
        const empBlood = (rawEmployee?.blood_group || "B+VE").toUpperCase().replace("POSITIVE", "+VE").replace("POS", "+VE");
        const empStatus = (rawEmployee?.status || employee.status || "ACTIVE").toUpperCase();

        setCardData((prev) => ({
            ...prev,
            orgName: org,
            orgInitials: initials,
            unitName: branchUnit,
            name: empName,
            designation: empDesig,
            fatherName: empFather,
            dob: empDob,
            address: empAddr,
            phone: empPhone.startsWith("+") ? empPhone : `+91 ${empPhone}`,
            bloodGroup: empBlood.includes("+") || empBlood.includes("-") ? empBlood : `${empBlood}+VE`,
            status: empStatus,
            memberId: empCode,
            stateUnit: locationDisplay,
            tagline: "COMMITTED TO EXCELLENCE & INTEGRITY",
            website: compWebsite,
        }));
    };

    useEffect(() => {
        syncFromEmployee();
        if (rawEmployee?.profile_image) {
            setLocalPhoto(rawEmployee.profile_image);
        }
    }, [employee, rawEmployee]);

    // Fetch available Authorized Signatories from API
    useEffect(() => {
        async function loadSignatories() {
            try {
                const res = await apiGet<any>("/signatories");
                const list = Array.isArray(res) ? res : res?.data || [];
                setSignatoriesList(list);
                if (list.length > 0) {
                    const first = list[0];
                    setCardData((prev) => ({
                        ...prev,
                        signatureUrl: prev.signatureUrl || first.signature_url || null,
                        signatoryName: prev.signatoryName || (first.name ? first.name.toUpperCase() : ""),
                        signatoryTitle: prev.signatoryTitle || (first.designation ? first.designation.toUpperCase() : ""),
                    }));
                }
            } catch (err) {
                console.error("Failed to fetch signatories:", err);
            }
        }
        if (isOpen) {
            loadSignatories();
        }
    }, [isOpen]);

    // Handle Custom Signature Upload
    const handleSignatureSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 3 * 1024 * 1024) {
            alert("Please choose a signature image under 3MB.");
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            const base64Data = reader.result as string;
            setCardData((prev) => ({
                ...prev,
                signatureUrl: base64Data,
            }));
        };
        reader.readAsDataURL(file);
    };

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

    // ── HIGH-RES PDF DOWNLOAD (300 DPI) ──
    const handleDownloadPdf = async () => {
        try {
            setGeneratingPdf(true);
            const html2canvas = (await import("html2canvas")).default;
            const { jsPDF } = await import("jspdf");

            const renderArea = document.getElementById("id-card-pdf-render-area");
            if (!renderArea) {
                alert("Unable to locate badge render area.");
                return;
            }

            renderArea.style.display = "flex";
            const canvas = await html2canvas(renderArea, {
                scale: 3, // 3x scale produces razor-sharp 300 DPI print quality
                useCORS: true,
                allowTaint: true,
                backgroundColor: "#ffffff",
                logging: false,
            });
            renderArea.style.display = "none";

            const imgData = canvas.toDataURL("image/png");
            const pdf = new jsPDF({
                orientation: "portrait",
                unit: "mm",
                format: "a4",
            });

            // Target dimensions on A4 (Exact CR80 width = 85.6mm, or scaled)
            const mmWidth = printScale === "cr80" ? 100 : 130;
            const mmHeight = (canvas.height * mmWidth) / canvas.width;
            const xPos = (210 - mmWidth) / 2;
            const yPos = (297 - mmHeight) / 2;

            pdf.addImage(imgData, "PNG", xPos, yPos, mmWidth, mmHeight);
            pdf.save(`ID_Card_${cardData.memberId}_${cardData.name.replace(/\s+/g, "_")}.pdf`);
        } catch (err: any) {
            console.error("PDF generation error:", err);
            alert("PDF generation completed via print dialog.");
            window.print();
        } finally {
            setGeneratingPdf(false);
        }
    };

    // ── DYNAMIC VECTOR QR CODE (High Resolution 240x240 in #EA580C) ──
    const renderOrangeQRCode = () => {
        const qrPayload = `COMPANY:${cardData.orgName}|EMP_ID:${cardData.memberId}|NAME:${cardData.name}|DESIG:${cardData.designation}|BRANCH:${cardData.stateUnit}|STATUS:${cardData.status}`;
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&color=ea580c&bgcolor=ffffff&data=${encodeURIComponent(qrPayload)}`;

        return (
            <div className="w-[105px] h-[105px] rounded-xl p-1 bg-white border border-orange-200/60 shadow-sm flex items-center justify-center overflow-hidden">
                <img
                    src={qrUrl}
                    alt="Corporate Verification QR Code"
                    className="w-full h-full object-contain"
                    onError={(e) => {
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

    // ── FRONT SIDE CARD (Matches CR80 Horizontal Specification) ──
    const renderFrontCard = (isPrint = false, idSuffix = "preview") => {
        const badgePathId = `badgePath-${idSuffix}`;

        return (
            <div
                className={cn(
                    "relative w-[480px] h-[305px] rounded-[28px] overflow-hidden bg-white shadow-xl border border-slate-200/90 flex flex-col justify-between select-none shrink-0",
                    isPrint && "shadow-none border border-slate-300 print-card-border"
                )}
            >
                {/* ── TOP HEADER (Diagonal Split Black & Vibrant Orange) ── */}
                <div className="relative h-[54px] w-full shrink-0 overflow-hidden">
                    {/* Background SVG with Diagonal Cut */}
                    <svg viewBox="0 0 480 54" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
                        {/* Right Orange Section */}
                        <rect x="0" y="0" width="480" height="54" fill="#E65100" />
                        {/* Left Black Angled Section (slanted diagonal cut) */}
                        <polygon points="0,0 350,0 332,54 0,54" fill="#0A0A0A" />
                    </svg>

                    {/* Content inside Header */}
                    <div className="relative z-10 flex items-center justify-between h-full px-4">
                        {/* Left: Dynamic Company Logo Emblem + Names */}
                        <div className="flex items-center gap-2.5 max-w-[325px]">
                            {/* Circular Corporate Logo Badge */}
                            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-orange-600 via-amber-500 to-orange-500 border-2 border-white shadow-md flex items-center justify-center shrink-0 p-0.5">
                                <div className="w-full h-full rounded-full border border-white/80 flex flex-col items-center justify-center bg-orange-600 relative overflow-hidden">
                                    <svg viewBox="0 0 100 100" className="w-full h-full">
                                        <circle cx="50" cy="50" r="48" fill="#E65100" />
                                        <circle cx="50" cy="50" r="38" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeDasharray="4 2" />
                                        <defs>
                                            <path id={badgePathId} d="M 50,50 m -30,0 a 30,30 0 1,1 60,0 a 30,30 0 1,1 -60,0" fill="none" />
                                        </defs>
                                        <text fill="#FFFFFF" fontSize="7.5" fontWeight="900" letterSpacing="0.5">
                                            <textPath href={`#${badgePathId}`} startOffset="50%" textAnchor="middle">
                                                {cardData.orgName.slice(0, 24)}
                                            </textPath>
                                        </text>
                                        <text x="50" y="55" fill="#FFFFFF" fontSize="16" fontWeight="900" textAnchor="middle" dominantBaseline="middle" fontFamily="sans-serif">
                                            {cardData.orgInitials}
                                        </text>
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

                        {/* Right: Corporate Security Shield Graphic */}
                        <div className="flex items-center justify-end pr-3">
                            <svg viewBox="0 0 46 32" className="w-11 h-8 drop-shadow">
                                <path
                                    d="M23,2 L40,7 C40,18 31,27 23,30 C15,27 6,18 6,7 Z"
                                    fill="#FFA726"
                                    stroke="#FFFFFF"
                                    strokeWidth="1.8"
                                />
                                <path
                                    d="M23,6 L35,10 C35,17 28,24 23,26 C18,24 11,17 11,10 Z"
                                    fill="#E65100"
                                    opacity="0.4"
                                />
                                <path
                                    d="M17,15 L21,19 L29,11"
                                    fill="none"
                                    stroke="#FFFFFF"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
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
                                    className="absolute bottom-0 right-0 h-6 w-6 rounded-full bg-[#EA580C] hover:bg-[#C2410C] text-white flex items-center justify-center shadow-md border-2 border-white transition-transform hover:scale-110 cursor-pointer"
                                >
                                    {uploadingPhoto ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                        <Camera className="h-3 w-3 stroke-[2.5]" />
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
                        <h2 className="text-[17px] font-black text-slate-900 tracking-tight leading-none uppercase truncate">
                            {cardData.name}
                        </h2>

                        {/* Designation / Role in Orange */}
                        <div className="text-[11.5px] font-black text-[#EA580C] uppercase tracking-wider leading-none pb-1 truncate">
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
                                <span className="font-black text-slate-800 uppercase leading-[1.25] text-[9.5px] line-clamp-2">
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
                    {/* Left: Employee ID */}
                    <div className="flex flex-col">
                        <span className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest leading-none">
                            EMPLOYEE ID
                        </span>
                        <span className="text-[12px] font-black text-slate-900 uppercase tracking-wider font-mono mt-0.5 leading-tight">
                            {cardData.memberId}
                        </span>
                    </div>

                    {/* Right: Branch / Location */}
                    <div className="flex flex-col items-end">
                        <span className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest leading-none">
                            BRANCH / LOCATION
                        </span>
                        <span className="text-[12px] font-black text-[#EA580C] uppercase tracking-wider mt-0.5 leading-tight">
                            {cardData.stateUnit}
                        </span>
                    </div>
                </div>
            </div>
        );
    };

    // ── BACK SIDE CARD (Corporate Specification with Watermark & Instructions) ──
    const renderBackCard = (isPrint = false, idSuffix = "preview") => {
        const watermarkPathId = `watermarkPath-${idSuffix}`;

        return (
            <div
                className={cn(
                    "relative w-[480px] h-[305px] rounded-[28px] overflow-hidden bg-white shadow-xl border border-slate-200/90 flex flex-col justify-between select-none shrink-0",
                    isPrint && "shadow-none border border-slate-300 print-card-border"
                )}
            >
                {/* Center Faint Corporate Watermark Logo */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.04] overflow-hidden">
                    <svg viewBox="0 0 200 200" className="w-48 h-48 text-[#E65100]">
                        <circle cx="100" cy="100" r="88" fill="none" stroke="currentColor" strokeWidth="3" />
                        <circle cx="100" cy="100" r="74" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 2" />
                        <circle cx="100" cy="100" r="52" fill="none" stroke="currentColor" strokeWidth="1.5" />
                        <defs>
                            <path id={watermarkPathId} d="M 100,100 m -62,0 a 62,62 0 1,1 124,0 a 62,62 0 1,1 -124,0" fill="none" />
                        </defs>
                        <text fill="currentColor" fontSize="8.5" fontWeight="900" letterSpacing="1">
                            <textPath href={`#${watermarkPathId}`} startOffset="50%" textAnchor="middle">
                                {cardData.orgName} • OFFICIAL IDENTITY BADGE
                            </textPath>
                        </text>
                        <text x="100" y="106" fill="currentColor" fontSize="30" fontWeight="900" textAnchor="middle" dominantBaseline="middle" fontFamily="sans-serif">
                            {cardData.orgInitials}
                        </text>
                    </svg>
                </div>

                {/* ── MAIN CONTENT (Instructions + Orange QR Code) ── */}
                <div className="p-6 pb-2 grow flex items-start justify-between gap-4 z-10">
                    {/* Left: General Corporate Instructions */}
                    <div className="flex flex-col space-y-2 max-w-[310px]">
                        <h3 className="text-[13.5px] font-black uppercase tracking-wider text-slate-900 border-b pb-1.5 border-slate-200">
                            GENERAL INSTRUCTIONS
                        </h3>
                        <ul className="space-y-1.5 text-[9.5px] font-black text-slate-800 uppercase leading-snug">
                            <li className="flex items-start gap-2">
                                <span className="text-[#EA580C] text-[11px] leading-none shrink-0 mt-0.5">▪</span>
                                <span>THIS IDENTITY CARD IS STRICTLY NON-TRANSFERABLE.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-[#EA580C] text-[11px] leading-none shrink-0 mt-0.5">▪</span>
                                <span>VALID ONLY WITH AUTHORIZED SIGNATURE.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-[#EA580C] text-[11px] leading-none shrink-0 mt-0.5">▪</span>
                                <span>IF FOUND OR LOST, REPORT IMMEDIATELY TO HR DEPARTMENT.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-[#EA580C] text-[11px] leading-none shrink-0 mt-0.5">▪</span>
                                <span>ONLINE VERIFICATION AVAILABLE AT {cardData.website.replace(/^HTTPS?:\/\//i, "").replace(/^WWW\./i, "").toLowerCase()}.</span>
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

                {/* ── BOTTOM FOOTER (Authorized Signature & Company Info) ── */}
                <div className="h-[58px] w-full bg-[#F8FAFC] border-t border-slate-200/90 px-6 flex items-center justify-between shrink-0 z-10">
                    {/* Left: Authorized Signatory */}
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-400 shadow-sm shrink-0">
                            <ShieldCheck className="h-5 w-5 text-slate-400 stroke-[1.5]" />
                        </div>
                        <div className="flex flex-col items-center">
                            {/* Digital Signature Image if present */}
                            {cardData.signatureUrl ? (
                                <div className="h-6 w-28 flex items-end justify-center -mb-0.5">
                                    <img
                                        src={cardData.signatureUrl}
                                        alt="Authorized Signature"
                                        className="max-h-6 max-w-full object-contain mix-blend-multiply"
                                    />
                                </div>
                            ) : null}
                            <div className="w-28 h-[1px] bg-slate-300 mt-1 mb-0.5" />
                            <span className="text-[7.5px] font-black uppercase tracking-widest text-slate-500 leading-none">
                                AUTHORIZED SIGNATORY
                            </span>
                            {cardData.signatoryName ? (
                                <span className="text-[6.5px] font-bold text-slate-500 uppercase tracking-tight leading-tight mt-0.5 truncate max-w-[125px]">
                                    {cardData.signatoryName} {cardData.signatoryTitle ? `• ${cardData.signatoryTitle}` : ""}
                                </span>
                            ) : null}
                        </div>
                    </div>

                    {/* Right: Company Titles & Website */}
                    <div className="flex flex-col items-end leading-tight">
                        <span className="text-[11px] font-black text-slate-900 uppercase tracking-tight">
                            {cardData.orgName} • {cardData.stateUnit}
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
            <DialogContent
                showCloseButton={false}
                className="w-[96vw] max-w-[1100px]! sm:max-w-[1100px]! max-h-[92vh] flex flex-col p-0 gap-0 rounded-2xl sm:rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl text-white overflow-hidden my-auto"
            >
                {/* ── MODAL TOP BAR (Sticky) ── */}
                <div className="shrink-0 p-4 sm:p-5 pb-3.5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/80">
                    <div>
                        <DialogTitle className="text-sm sm:text-base font-black uppercase tracking-wider text-white flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-[#EA580C]" />
                            Official Identity Badge Production Studio
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-400 mt-0.5">
                            CR80 International Standard Badge (85.6 × 54.0 mm) — {cardData.orgName}
                        </DialogDescription>
                    </div>

                    <div className="flex items-center gap-3 ml-auto sm:ml-0">
                        {/* View mode switcher */}
                        <div className="flex items-center gap-1 bg-slate-800/90 p-1 rounded-xl border border-slate-700">
                            <button
                                type="button"
                                onClick={() => setViewMode("both")}
                                className={cn(
                                    "px-2.5 sm:px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer",
                                    viewMode === "both" ? "bg-[#EA580C] text-white shadow-md" : "text-slate-400 hover:text-white"
                                )}
                            >
                                Both Sides
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewMode("front")}
                                className={cn(
                                    "px-2.5 sm:px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer",
                                    viewMode === "front" ? "bg-[#EA580C] text-white shadow-md" : "text-slate-400 hover:text-white"
                                )}
                            >
                                Front
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewMode("back")}
                                className={cn(
                                    "px-2.5 sm:px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer",
                                    viewMode === "back" ? "bg-[#EA580C] text-white shadow-md" : "text-slate-400 hover:text-white"
                                )}
                            >
                                Back
                            </button>
                        </div>

                        {/* Prominent Close Button */}
                        <button
                            type="button"
                            onClick={onClose}
                            className="h-8 w-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center border border-slate-700 transition-colors cursor-pointer shrink-0"
                            title="Close Modal"
                        >
                            <X className="h-4 w-4 stroke-[2.5]" />
                        </button>
                    </div>
                </div>

                {/* ── TOOLBAR: PHOTO UPLOAD, PRINT FORMAT & QUICK EDIT ── */}
                <div className="shrink-0 px-4 sm:px-6 py-2.5 bg-slate-950/40 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setIsEditing(!isEditing)}
                            className={cn(
                                "h-8 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer",
                                isEditing
                                    ? "bg-amber-400 text-slate-950 border-amber-400 hover:bg-amber-300"
                                    : "border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-slate-200"
                            )}
                        >
                            <Edit2 className="h-3 w-3" />
                            {isEditing ? "Hide Field Editor" : "Edit Card Details"}
                        </Button>

                        {/* Print Layout Selector */}
                        <div className="hidden sm:flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-xl px-2 py-0.5 text-[9px] font-black uppercase text-slate-300">
                            <span className="text-slate-500 mr-1">Print:</span>
                            <button
                                type="button"
                                onClick={() => setPrintLayout("foldable")}
                                className={cn(
                                    "px-2 py-0.5 rounded cursor-pointer transition-colors",
                                    printLayout === "foldable" ? "bg-[#EA580C] text-white" : "hover:text-white"
                                )}
                            >
                                Foldable A4
                            </button>
                            <button
                                type="button"
                                onClick={() => setPrintLayout("sideBySide")}
                                className={cn(
                                    "px-2 py-0.5 rounded cursor-pointer transition-colors",
                                    printLayout === "sideBySide" ? "bg-[#EA580C] text-white" : "hover:text-white"
                                )}
                            >
                                Side-by-Side
                            </button>
                        </div>

                        {/* Print Size Scale Selector */}
                        <div className="hidden md:flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-xl px-2 py-0.5 text-[9px] font-black uppercase text-slate-300">
                            <span className="text-slate-500 mr-1">Scale:</span>
                            <button
                                type="button"
                                onClick={() => setPrintScale("cr80")}
                                title="Standard 85.6mm × 54.0mm wallet/lanyard badge"
                                className={cn(
                                    "px-2 py-0.5 rounded cursor-pointer transition-colors",
                                    printScale === "cr80" ? "bg-emerald-600 text-white" : "hover:text-white"
                                )}
                            >
                                CR80 Standard (85.6×54mm)
                            </button>
                            <button
                                type="button"
                                onClick={() => setPrintScale("large")}
                                title="Large Display Badge (120mm × 76mm)"
                                className={cn(
                                    "px-2 py-0.5 rounded cursor-pointer transition-colors",
                                    printScale === "large" ? "bg-emerald-600 text-white" : "hover:text-white"
                                )}
                            >
                                Large (120×76mm)
                            </button>
                        </div>

                        {isEditing && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={syncFromEmployee}
                                className="h-8 px-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                                title="Reset all fields back to database employee details"
                            >
                                <RotateCcw className="h-3 w-3" />
                                Reset Defaults
                            </Button>
                        )}
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
                            className="h-8 px-3.5 rounded-xl border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-slate-200 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
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

                {/* ── OPTIONAL INLINE FIELD EDITOR ── */}
                {isEditing && (
                    <div className="shrink-0 max-h-[190px] overflow-y-auto p-4 bg-slate-950/95 border-b border-slate-800 text-xs">
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                            <div>
                                <label className="text-[9px] font-black text-slate-400 uppercase">Company Name</label>
                                <Input
                                    value={cardData.orgName}
                                    onChange={(e) => setCardData({ ...cardData, orgName: e.target.value })}
                                    className="h-8 text-xs bg-slate-900 border-slate-700 text-white"
                                />
                            </div>
                            <div>
                                <label className="text-[9px] font-black text-slate-400 uppercase">Logo Initials</label>
                                <Input
                                    value={cardData.orgInitials}
                                    onChange={(e) => setCardData({ ...cardData, orgInitials: e.target.value })}
                                    className="h-8 text-xs bg-slate-900 border-slate-700 text-white uppercase"
                                    maxLength={3}
                                />
                            </div>
                            <div>
                                <label className="text-[9px] font-black text-slate-400 uppercase">Branch / Unit Subtitle</label>
                                <Input
                                    value={cardData.unitName}
                                    onChange={(e) => setCardData({ ...cardData, unitName: e.target.value })}
                                    className="h-8 text-xs bg-slate-900 border-slate-700 text-white"
                                />
                            </div>
                            <div>
                                <label className="text-[9px] font-black text-slate-400 uppercase">Branch / Location</label>
                                <Input
                                    value={cardData.stateUnit}
                                    onChange={(e) => setCardData({ ...cardData, stateUnit: e.target.value })}
                                    className="h-8 text-xs bg-slate-900 border-slate-700 text-white"
                                />
                            </div>
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
                                <label className="text-[9px] font-black text-slate-400 uppercase">Father/Spouse (S/O)</label>
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
                                <label className="text-[9px] font-black text-slate-400 uppercase">Employee ID</label>
                                <Input
                                    value={cardData.memberId}
                                    onChange={(e) => setCardData({ ...cardData, memberId: e.target.value })}
                                    className="h-8 text-xs bg-slate-900 border-slate-700 text-white"
                                />
                            </div>
                            <div>
                                <label className="text-[9px] font-black text-slate-400 uppercase">Company Website</label>
                                <Input
                                    value={cardData.website}
                                    onChange={(e) => setCardData({ ...cardData, website: e.target.value })}
                                    className="h-8 text-xs bg-slate-900 border-slate-700 text-white"
                                />
                            </div>
                            <div className="col-span-2">
                                <label className="text-[9px] font-black text-slate-400 uppercase">Company Tagline</label>
                                <Input
                                    value={cardData.tagline}
                                    onChange={(e) => setCardData({ ...cardData, tagline: e.target.value })}
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

                            {/* ── AUTHORIZED SIGNATORY CONTROLS ── */}
                            <div className="col-span-2 sm:col-span-3 md:col-span-4 border-t border-slate-800 pt-2.5 mt-1">
                                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                                    <span className="text-[10px] font-black uppercase text-[#EA580C] tracking-wider flex items-center gap-1.5">
                                        <ShieldCheck className="h-3.5 w-3.5" />
                                        Authorized Signatory & Signature (Back Side)
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="file"
                                            ref={sigFileInputRef}
                                            onChange={handleSignatureSelect}
                                            accept="image/*"
                                            className="hidden"
                                        />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => sigFileInputRef.current?.click()}
                                            className="h-7 px-2.5 text-[9px] font-black uppercase tracking-wider rounded-lg border-slate-700 bg-slate-800/90 hover:bg-slate-800 text-slate-200 cursor-pointer"
                                        >
                                            <Upload className="h-3 w-3 mr-1 text-[#EA580C]" />
                                            {cardData.signatureUrl ? "Change Signature Image" : "Upload Signature Image"}
                                        </Button>
                                        {cardData.signatureUrl && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setCardData((prev) => ({ ...prev, signatureUrl: null }))}
                                                className="h-7 px-2 text-[9px] font-black uppercase text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded-lg cursor-pointer"
                                            >
                                                Remove Signature
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                    <div>
                                        <label className="text-[9px] font-black text-slate-400 uppercase">Select Saved Signatory</label>
                                        <select
                                            value={
                                                signatoriesList.find((s) => s.signature_url === cardData.signatureUrl)?.id || ""
                                            }
                                            onChange={(e) => {
                                                const id = e.target.value;
                                                if (!id) {
                                                    setCardData((prev) => ({
                                                        ...prev,
                                                        signatureUrl: null,
                                                        signatoryName: "",
                                                        signatoryTitle: "",
                                                    }));
                                                } else {
                                                    const sig = signatoriesList.find((s) => String(s.id) === id);
                                                    if (sig) {
                                                        setCardData((prev) => ({
                                                            ...prev,
                                                            signatureUrl: sig.signature_url,
                                                            signatoryName: (sig.name || "").toUpperCase(),
                                                            signatoryTitle: (sig.designation || "").toUpperCase(),
                                                        }));
                                                    }
                                                }
                                            }}
                                            className="h-8 w-full text-xs bg-slate-900 border border-slate-700 rounded-md px-2 text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                                        >
                                            <option value="">None (Blank Physical Signature Line)</option>
                                            {signatoriesList.map((sig) => (
                                                <option key={sig.id} value={sig.id}>
                                                    {sig.name} ({sig.designation})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black text-slate-400 uppercase">Signatory Name</label>
                                        <Input
                                            value={cardData.signatoryName}
                                            onChange={(e) => setCardData({ ...cardData, signatoryName: e.target.value })}
                                            placeholder="e.g. JOHN"
                                            className="h-8 text-xs bg-slate-900 border-slate-700 text-white uppercase"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black text-slate-400 uppercase">Signatory Designation</label>
                                        <Input
                                            value={cardData.signatoryTitle}
                                            onChange={(e) => setCardData({ ...cardData, signatoryTitle: e.target.value })}
                                            placeholder="e.g. DIRECTOR / HR MANAGER"
                                            className="h-8 text-xs bg-slate-900 border-slate-700 text-white uppercase"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── CARD PREVIEW CANVAS (Flex-1, Scrollable, Never overflows viewport) ── */}
                <div className="flex-1 overflow-y-auto overflow-x-auto p-4 sm:p-6 md:p-8 flex items-center justify-center bg-slate-950/90 min-h-0">
                    <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-8 my-auto">
                        {(viewMode === "front" || viewMode === "both") && (
                            <div className="flex flex-col items-center gap-2 shrink-0">
                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 bg-slate-800/60 px-3 py-1 rounded-full border border-slate-700/60">
                                    Front Side (CR80)
                                </span>
                                {renderFrontCard(false, "preview-front")}
                            </div>
                        )}

                        {(viewMode === "back" || viewMode === "both") && (
                            <div className="flex flex-col items-center gap-2 shrink-0">
                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 bg-slate-800/60 px-3 py-1 rounded-full border border-slate-700/60">
                                    Back Side (CR80)
                                </span>
                                {renderBackCard(false, "preview-back")}
                            </div>
                        )}
                    </div>
                </div>

                {/* ── PRINT-ONLY CONTAINER (Invisible on screen, active on window.print()) ── */}
                <div id="id-card-print-container" className="hidden print:flex">
                    <div className={cn("print-layout-root", printLayout === "sideBySide" ? "print-side-by-side" : "print-foldable")}>
                        {/* Front Card Container with Crop Marks */}
                        <div className="print-card-outer">
                            {/* Professional Corner Crop Marks */}
                            <div className="crop-corner top-left" />
                            <div className="crop-corner top-right" />
                            <div className="crop-corner bottom-left" />
                            <div className="crop-corner bottom-right" />

                            <div className={printScale === "cr80" ? "print-cr80-box" : "print-large-box"}>
                                <div className={printScale === "cr80" ? "print-cr80-scaler" : "print-large-scaler"}>
                                    {renderFrontCard(true, "print-front")}
                                </div>
                            </div>
                        </div>

                        {/* Fold / Cut Guide between Front and Back */}
                        {printLayout === "foldable" ? (
                            <div className="print-fold-guide">
                                <span className="cut-icon">✂</span>
                                <div className="cut-dash" />
                                <span className="cut-text">FOLD HERE (CENTER LINE)</span>
                                <div className="cut-dash" />
                                <span className="cut-icon">✂</span>
                            </div>
                        ) : (
                            <div className="print-spacer" />
                        )}

                        {/* Back Card Container with Crop Marks */}
                        <div className="print-card-outer">
                            {/* Professional Corner Crop Marks */}
                            <div className="crop-corner top-left" />
                            <div className="crop-corner top-right" />
                            <div className="crop-corner bottom-left" />
                            <div className="crop-corner bottom-right" />

                            <div className={printScale === "cr80" ? "print-cr80-box" : "print-large-box"}>
                                <div className={printScale === "cr80" ? "print-cr80-scaler" : "print-large-scaler"}>
                                    {renderBackCard(true, "print-back")}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Standardized Physical Dimensions Label */}
                    <div className="print-meta-label">
                        {printScale === "cr80" ? "ISO 7810 CR80 Standard (85.6 mm × 54.0 mm) • 100% True Scale" : "High-Resolution Display Badge (120 mm × 76 mm)"}
                    </div>
                </div>

                {/* ── HIDDEN PDF RENDER AREA (For html2canvas 300 DPI Export) ── */}
                <div id="id-card-pdf-render-area" style={{ display: "none" }} className="flex flex-col items-center p-8 bg-white text-slate-900 gap-4">
                    <div className="flex flex-col items-center gap-1">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{cardData.orgName} Official Identity Card</span>
                    </div>
                    {renderFrontCard(true, "pdf-front")}
                    <div className="w-[480px] flex items-center justify-center gap-3 my-1">
                        <div className="h-[1px] flex-1 border-t border-dashed border-slate-300" />
                        <span className="text-[9px] font-mono text-slate-400 font-bold tracking-widest">✂ FOLD / CUT GUIDE ✂</span>
                        <div className="h-[1px] flex-1 border-t border-dashed border-slate-300" />
                    </div>
                    {renderBackCard(true, "pdf-back")}
                </div>

                {/* ── MODAL FOOTER (Sticky) ── */}
                <div className="shrink-0 p-4 sm:p-5 border-t border-slate-800 bg-slate-950/90 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3 text-xs text-slate-400">
                        <span className="hidden sm:inline-flex items-center gap-1.5 font-medium">
                            <FileCheck2 className="h-3.5 w-3.5 text-emerald-400" />
                            CR80 Standard (85.6 × 54 mm) ready
                        </span>
                    </div>

                    <div className="flex items-center gap-2.5 ml-auto">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                            className="h-9 sm:h-10 px-4 sm:px-5 rounded-xl border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
                        >
                            Close
                        </Button>

                        <Button
                            type="button"
                            variant="outline"
                            disabled={generatingPdf}
                            onClick={handleDownloadPdf}
                            className="h-9 sm:h-10 px-4 sm:px-5 rounded-xl border-slate-700 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md"
                            title="Download print-ready PDF at 300 DPI"
                        >
                            {generatingPdf ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                            ) : (
                                <Download className="h-3.5 w-3.5 text-amber-400" />
                            )}
                            Download PDF
                        </Button>

                        <Button
                            type="button"
                            onClick={() => window.print()}
                            className="h-9 sm:h-10 px-5 sm:px-6 rounded-xl font-black text-xs uppercase tracking-wider bg-[#EA580C] hover:bg-[#C2410C] text-white shadow-lg shadow-orange-600/30 flex items-center gap-2 cursor-pointer"
                        >
                            <Printer className="h-4 w-4 stroke-[2.5]" />
                            Print Card
                        </Button>
                    </div>
                </div>

                {/* ── PRODUCTION GRADE PRINT STYLES ── */}
                <style jsx global>{`
                    @media print {
                        @page {
                            size: A4 portrait;
                            margin: 10mm;
                        }
                        html, body {
                            background: #ffffff !important;
                            margin: 0 !important;
                            padding: 0 !important;
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
                            background: #ffffff !important;
                            padding: 0 !important;
                            margin: 0 !important;
                            z-index: 999999 !important;
                            -webkit-print-color-adjust: exact !important;
                            print-color-adjust: exact !important;
                            color-adjust: exact !important;
                        }
                        .print-layout-root {
                            display: flex !important;
                            align-items: center !important;
                            justify-content: center !important;
                            page-break-inside: avoid !important;
                            break-inside: avoid !important;
                        }
                        .print-foldable {
                            flex-direction: column !important;
                            gap: 0 !important;
                        }
                        .print-side-by-side {
                            flex-direction: row !important;
                            gap: 12mm !important;
                        }
                        .print-card-outer {
                            position: relative !important;
                            padding: 2mm !important;
                            page-break-inside: avoid !important;
                            break-inside: avoid !important;
                        }
                        .print-cr80-box {
                            width: 85.6mm !important;
                            height: 54.0mm !important;
                            overflow: hidden !important;
                            position: relative !important;
                            border-radius: 3.2mm !important;
                            box-shadow: none !important;
                        }
                        .print-cr80-scaler {
                            width: 480px !important;
                            height: 305px !important;
                            transform: scale(0.674) !important;
                            transform-origin: top left !important;
                        }
                        .print-large-box {
                            width: 120.0mm !important;
                            height: 76.25mm !important;
                            overflow: hidden !important;
                            position: relative !important;
                            border-radius: 4.5mm !important;
                            box-shadow: none !important;
                        }
                        .print-large-scaler {
                            width: 480px !important;
                            height: 305px !important;
                            transform: scale(0.945) !important;
                            transform-origin: top left !important;
                        }
                        .print-card-border {
                            border: 0.5pt solid #cbd5e1 !important;
                        }
                        .crop-corner {
                            position: absolute !important;
                            width: 3.5mm !important;
                            height: 3.5mm !important;
                            pointer-events: none !important;
                        }
                        .crop-corner.top-left {
                            top: 0 !important;
                            left: 0 !important;
                            border-top: 0.5pt solid #94a3b8 !important;
                            border-left: 0.5pt solid #94a3b8 !important;
                        }
                        .crop-corner.top-right {
                            top: 0 !important;
                            right: 0 !important;
                            border-top: 0.5pt solid #94a3b8 !important;
                            border-right: 0.5pt solid #94a3b8 !important;
                        }
                        .crop-corner.bottom-left {
                            bottom: 0 !important;
                            left: 0 !important;
                            border-bottom: 0.5pt solid #94a3b8 !important;
                            border-left: 0.5pt solid #94a3b8 !important;
                        }
                        .crop-corner.bottom-right {
                            bottom: 0 !important;
                            right: 0 !important;
                            border-bottom: 0.5pt solid #94a3b8 !important;
                            border-right: 0.5pt solid #94a3b8 !important;
                        }
                        .print-fold-guide {
                            display: flex !important;
                            align-items: center !important;
                            justify-content: center !important;
                            gap: 2mm !important;
                            width: 85.6mm !important;
                            margin: 1.5mm 0 !important;
                            color: #94a3b8 !important;
                            font-size: 6pt !important;
                            font-family: monospace !important;
                        }
                        .cut-dash {
                            height: 1px !important;
                            flex-grow: 1 !important;
                            border-top: 0.5pt dashed #cbd5e1 !important;
                        }
                        .cut-text {
                            font-weight: bold !important;
                            letter-spacing: 1px !important;
                            white-space: nowrap !important;
                        }
                        .print-meta-label {
                            margin-top: 6mm !important;
                            font-size: 6pt !important;
                            font-family: sans-serif !important;
                            font-weight: bold !important;
                            letter-spacing: 0.5px !important;
                            color: #94a3b8 !important;
                            text-align: center !important;
                        }
                    }
                `}</style>
            </DialogContent>
        </Dialog>
    );
}
