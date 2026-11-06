"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import {
    CheckCircle2,
    AlertCircle,
    Loader2,
    Upload,
    FileCheck,
    X,
    User,
    Building2,
    ShieldCheck,
    CreditCard,
    ArrowRight,
    ArrowLeft,
    Check,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://api.apaarpulse.com/api/v1";

const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const AADHAAR_RE = /^\d{12}$/;
const PHONE_RE = /^(\+91[-\s]?)?[6-9]\d{9}$/;

function CandidateOnboardingContent() {
    const searchParams = useSearchParams();
    const token = searchParams.get("token") || "";

    const [loading, setLoading] = useState(true);
    const [invitation, setInvitation] = useState<any>(null);
    const [tokenError, setTokenError] = useState<string | null>(null);

    const [currentStep, setCurrentStep] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const [submittedSuccess, setSubmittedSuccess] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        phone: "",
        dob: "",
        gender: "male",
        address: "",
        emergencyName: "",
        emergencyRelation: "",
        emergencyPhone: "",
        bankName: "",
        accountNo: "",
        confirmAccountNo: "",
        ifsc: "",
        pan: "",
        aadhaar: "",
        uan: "",
    });

    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [uploadedDocs, setUploadedDocs] = useState<{ [key: string]: File }>({});
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [activeDocType, setActiveDocType] = useState<string>("");

    // Validate token on mount
    useEffect(() => {
        if (!token) {
            setTokenError("Missing onboarding token. Please check the link from your invitation email.");
            setLoading(false);
            return;
        }

        async function validate() {
            try {
                const res = await fetch(`${API_BASE}/onboarding/public/validate/${token}`);
                const data = await res.json();
                if (!res.ok || !data.success) {
                    throw new Error(data.message || "Invalid or expired onboarding invitation.");
                }
                setInvitation(data.data);
                setFormData((prev) => ({
                    ...prev,
                    name: data.data.candidate_name || "",
                    email: data.data.email || "",
                }));
            } catch (err: any) {
                setTokenError(err.message || "Invalid or expired onboarding invitation.");
            } finally {
                setLoading(false);
            }
        }
        validate();
    }, [token]);

    const updateField = (key: string, value: string) => {
        setFormData((prev) => ({ ...prev, [key]: value }));
        if (fieldErrors[key]) {
            setFieldErrors((prev) => {
                const n = { ...prev };
                delete n[key];
                return n;
            });
        }
    };

    const handleFileSelect = (docType: string) => {
        setActiveDocType(docType);
        fileInputRef.current?.click();
    };

    const onFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && activeDocType) {
            setUploadedDocs((prev) => ({ ...prev, [activeDocType]: file }));
        }
        e.target.value = "";
    };

    const removeDoc = (docType: string) => {
        setUploadedDocs((prev) => {
            const n = { ...prev };
            delete n[docType];
            return n;
        });
    };

    const validateStep = (step: number): boolean => {
        const errors: Record<string, string> = {};

        if (step === 0) {
            if (!formData.name.trim()) errors.name = "Full name is required";
            if (!formData.phone.trim() || !PHONE_RE.test(formData.phone.replace(/\s/g, ""))) {
                errors.phone = "Valid 10-digit phone number is required";
            }
            if (!formData.dob) errors.dob = "Date of birth is required";
            if (!formData.address.trim()) errors.address = "Residential address is required";
        }

        if (step === 1) {
            if (!formData.emergencyName.trim()) errors.emergencyName = "Contact name is required";
            if (!formData.emergencyRelation.trim()) errors.emergencyRelation = "Relationship is required";
        }

        if (step === 2) {
            if (!formData.bankName.trim()) errors.bankName = "Bank name is required";
            if (!formData.accountNo.trim()) errors.accountNo = "Account number is required";
            if (formData.accountNo !== formData.confirmAccountNo) {
                errors.confirmAccountNo = "Account numbers do not match";
            }
            if (!formData.ifsc.trim() || formData.ifsc.trim().length !== 11) {
                errors.ifsc = "Valid 11-character IFSC code is required";
            }
            if (!formData.pan.trim() || !PAN_RE.test(formData.pan.toUpperCase())) {
                errors.pan = "Valid PAN format required (e.g. ABCDE1234F)";
            }
            if (!formData.aadhaar.trim() || !AADHAAR_RE.test(formData.aadhaar)) {
                errors.aadhaar = "Valid 12-digit Aadhaar number required";
            }
        }

        setFieldErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleNext = () => {
        if (validateStep(currentStep)) {
            setCurrentStep((s) => s + 1);
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
    };

    const readFileAsDataUrl = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    const handleSubmit = async () => {
        setSubmitting(true);
        try {
            // Read all uploaded docs as base64 data URLs
            const docList = await Promise.all(
                Object.keys(uploadedDocs).map(async (k) => {
                    const file = uploadedDocs[k];
                    let dataUrl: string | null = null;
                    try {
                        dataUrl = await readFileAsDataUrl(file);
                    } catch (e) {
                        console.error("Failed to read file", file.name, e);
                    }
                    return {
                        type: k,
                        filename: file.name,
                        size: file.size,
                        mime_type: file.type,
                        data_url: dataUrl,
                    };
                })
            );

            // First submit candidate details
            const res = await fetch(`${API_BASE}/onboarding/public/submit/${token}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: formData.name,
                    phone: formData.phone,
                    date_of_birth: formData.dob,
                    gender: formData.gender,
                    address: formData.address,
                    emergency_contact_name: formData.emergencyName,
                    emergency_contact_relation: formData.emergencyRelation,
                    emergency_phone: formData.emergencyPhone,
                    bank_name: formData.bankName,
                    bank_account_number: formData.accountNo,
                    ifsc_code: formData.ifsc,
                    pan_number: formData.pan.toUpperCase(),
                    aadhaar_number: formData.aadhaar,
                    uan: formData.uan || null,
                    uploaded_docs: docList,
                }),
            });

            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.message || "Failed to submit onboarding details");
            }

            setSubmittedSuccess(true);
        } catch (err: any) {
            alert(err.message || "Failed to submit details. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
                <Loader2 className="h-10 w-10 animate-spin text-slate-900" />
                <p className="mt-4 text-xs font-bold uppercase tracking-widest text-slate-500">
                    Verifying Onboarding Link...
                </p>
            </div>
        );
    }

    if (tokenError) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
                <Card className="max-w-md w-full rounded-3xl border-none shadow-2xl p-6 text-center bg-white">
                    <div className="h-14 w-14 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4">
                        <AlertCircle className="h-8 w-8" />
                    </div>
                    <h2 className="text-xl font-black text-slate-900 tracking-tight mb-2">Link Expired or Invalid</h2>
                    <p className="text-xs text-slate-500 leading-relaxed mb-6">{tokenError}</p>
                    <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">
                        Please contact HR to request a new onboarding invitation link.
                    </p>
                </Card>
            </div>
        );
    }

    if (submittedSuccess) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
                <Card className="max-w-lg w-full rounded-3xl border-none shadow-2xl p-8 text-center bg-white">
                    <div className="h-16 w-16 rounded-3xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-5 shadow-inner">
                        <CheckCircle2 className="h-10 w-10 stroke-[2.5]" />
                    </div>
                    <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold px-3 py-1 mb-3">
                        Submission Received
                    </Badge>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-3">
                        Thank You, {formData.name}!
                    </h2>
                    <p className="text-xs text-slate-500 leading-relaxed mb-6">
                        Your self-onboarding details and documents have been received by our Human Resources department.
                        We will review your information, issue your official Employee ID and Appointment Letter, and send your portal login credentials to <strong className="text-slate-800">{formData.email}</strong>.
                    </p>
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-left space-y-1">
                        <div className="flex justify-between text-[11px]">
                            <span className="text-slate-400 font-bold uppercase">Candidate:</span>
                            <span className="font-black text-slate-800">{formData.name}</span>
                        </div>
                        <div className="flex justify-between text-[11px]">
                            <span className="text-slate-400 font-bold uppercase">Registered Email:</span>
                            <span className="font-bold text-slate-700">{formData.email}</span>
                        </div>
                        <div className="flex justify-between text-[11px]">
                            <span className="text-slate-400 font-bold uppercase">Status:</span>
                            <span className="font-bold text-amber-600">Pending HR Approval</span>
                        </div>
                    </div>
                </Card>
            </div>
        );
    }

    const stepsTitles = ["Personal Info", "Emergency Contact", "Bank & Statutory", "Documents", "Review"];

    return (
        <div className="min-h-screen bg-slate-100 py-10 px-4">
            <input
                type="file"
                ref={fileInputRef}
                onChange={onFilePicked}
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg"
            />

            <div className="max-w-2xl mx-auto space-y-6">
                {/* Brand Banner */}
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/60 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-2xl bg-slate-900 text-[#D9F99D] flex items-center justify-center font-black text-xl shadow">
                            A
                        </div>
                        <div>
                            <h1 className="text-lg font-black text-slate-900 tracking-tight">Candidate Self-Onboarding</h1>
                            <p className="text-xs text-slate-400 font-medium">Welcome to the team! Please submit your details.</p>
                        </div>
                    </div>
                    <Badge variant="outline" className="text-[10px] font-black uppercase tracking-wider border-slate-200 text-slate-600">
                        {invitation?.company?.name || "Company"}
                    </Badge>
                </div>

                {/* Step indicator */}
                <div className="flex items-center justify-between px-2">
                    {stepsTitles.map((title, i) => (
                        <div key={title} className="flex items-center gap-2">
                            <div
                                className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                                    i === currentStep
                                        ? "bg-slate-900 text-white shadow"
                                        : i < currentStep
                                        ? "bg-emerald-500 text-white"
                                        : "bg-slate-200 text-slate-500"
                                }`}
                            >
                                {i < currentStep ? <Check className="h-4 w-4 stroke-[3]" /> : i + 1}
                            </div>
                            <span className="hidden sm:inline text-[11px] font-bold text-slate-600">{title}</span>
                        </div>
                    ))}
                </div>

                {/* Form Card */}
                <Card className="rounded-3xl border-none shadow-xl bg-white p-6 sm:p-8">
                    {currentStep === 0 && (
                        <div className="space-y-4">
                            <div>
                                <h2 className="text-lg font-black text-slate-900">Step 1: Personal Details</h2>
                                <p className="text-xs text-slate-500">Please provide your legal personal information.</p>
                            </div>

                            <div className="space-y-3">
                                <div>
                                    <Label className="text-xs font-bold text-slate-700">Full Legal Name *</Label>
                                    <Input
                                        value={formData.name}
                                        onChange={(e) => updateField("name", e.target.value)}
                                        className="h-11 rounded-xl bg-slate-50 mt-1"
                                        placeholder="Enter your full name"
                                    />
                                    {fieldErrors.name && <p className="text-xs text-red-500 mt-1">{fieldErrors.name}</p>}
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <Label className="text-xs font-bold text-slate-700">Email Address (Read-only)</Label>
                                        <Input
                                            value={formData.email}
                                            disabled
                                            className="h-11 rounded-xl bg-slate-100 text-slate-500 mt-1"
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-xs font-bold text-slate-700">Mobile Phone Number *</Label>
                                        <Input
                                            value={formData.phone}
                                            onChange={(e) => updateField("phone", e.target.value)}
                                            className="h-11 rounded-xl bg-slate-50 mt-1"
                                            placeholder="10-digit mobile number"
                                        />
                                        {fieldErrors.phone && <p className="text-xs text-red-500 mt-1">{fieldErrors.phone}</p>}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <Label className="text-xs font-bold text-slate-700">Date of Birth *</Label>
                                        <Input
                                            type="date"
                                            value={formData.dob}
                                            onChange={(e) => updateField("dob", e.target.value)}
                                            className="h-11 rounded-xl bg-slate-50 mt-1"
                                        />
                                        {fieldErrors.dob && <p className="text-xs text-red-500 mt-1">{fieldErrors.dob}</p>}
                                    </div>
                                    <div>
                                        <Label className="text-xs font-bold text-slate-700">Gender *</Label>
                                        <select
                                            value={formData.gender}
                                            onChange={(e) => updateField("gender", e.target.value)}
                                            className="w-full h-11 rounded-xl bg-slate-50 border border-slate-200 px-3 text-xs font-bold text-slate-800 mt-1 outline-none"
                                        >
                                            <option value="male">Male</option>
                                            <option value="female">Female</option>
                                            <option value="other">Other</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <Label className="text-xs font-bold text-slate-700">Residential Address *</Label>
                                    <Input
                                        value={formData.address}
                                        onChange={(e) => updateField("address", e.target.value)}
                                        className="h-11 rounded-xl bg-slate-50 mt-1"
                                        placeholder="Full residential address with city, state & pincode"
                                    />
                                    {fieldErrors.address && <p className="text-xs text-red-500 mt-1">{fieldErrors.address}</p>}
                                </div>
                            </div>
                        </div>
                    )}

                    {currentStep === 1 && (
                        <div className="space-y-4">
                            <div>
                                <h2 className="text-lg font-black text-slate-900">Step 2: Emergency Contact</h2>
                                <p className="text-xs text-slate-500">Whom should we contact in case of an emergency?</p>
                            </div>

                            <div className="space-y-3">
                                <div>
                                    <Label className="text-xs font-bold text-slate-700">Contact Person Name *</Label>
                                    <Input
                                        value={formData.emergencyName}
                                        onChange={(e) => updateField("emergencyName", e.target.value)}
                                        className="h-11 rounded-xl bg-slate-50 mt-1"
                                        placeholder="e.g. Priya Sharma"
                                    />
                                    {fieldErrors.emergencyName && <p className="text-xs text-red-500 mt-1">{fieldErrors.emergencyName}</p>}
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <Label className="text-xs font-bold text-slate-700">Relationship *</Label>
                                        <Input
                                            value={formData.emergencyRelation}
                                            onChange={(e) => updateField("emergencyRelation", e.target.value)}
                                            className="h-11 rounded-xl bg-slate-50 mt-1"
                                            placeholder="e.g. Spouse, Parent, Sibling"
                                        />
                                        {fieldErrors.emergencyRelation && <p className="text-xs text-red-500 mt-1">{fieldErrors.emergencyRelation}</p>}
                                    </div>
                                    <div>
                                        <Label className="text-xs font-bold text-slate-700">Emergency Phone Number</Label>
                                        <Input
                                            value={formData.emergencyPhone}
                                            onChange={(e) => updateField("emergencyPhone", e.target.value)}
                                            className="h-11 rounded-xl bg-slate-50 mt-1"
                                            placeholder="Emergency mobile number"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {currentStep === 2 && (
                        <div className="space-y-4">
                            <div>
                                <h2 className="text-lg font-black text-slate-900">Step 3: Bank & Statutory Info</h2>
                                <p className="text-xs text-slate-500">Required for monthly salary credits and PF/ESI compliance.</p>
                            </div>

                            <div className="space-y-3">
                                <div>
                                    <Label className="text-xs font-bold text-slate-700">Bank Name *</Label>
                                    <Input
                                        value={formData.bankName}
                                        onChange={(e) => updateField("bankName", e.target.value)}
                                        className="h-11 rounded-xl bg-slate-50 mt-1"
                                        placeholder="e.g. HDFC Bank, ICICI Bank, SBI"
                                    />
                                    {fieldErrors.bankName && <p className="text-xs text-red-500 mt-1">{fieldErrors.bankName}</p>}
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <Label className="text-xs font-bold text-slate-700">Bank Account Number *</Label>
                                        <Input
                                            value={formData.accountNo}
                                            onChange={(e) => updateField("accountNo", e.target.value)}
                                            className="h-11 rounded-xl bg-slate-50 mt-1"
                                            placeholder="Account number"
                                        />
                                        {fieldErrors.accountNo && <p className="text-xs text-red-500 mt-1">{fieldErrors.accountNo}</p>}
                                    </div>
                                    <div>
                                        <Label className="text-xs font-bold text-slate-700">Confirm Account Number *</Label>
                                        <Input
                                            value={formData.confirmAccountNo}
                                            onChange={(e) => updateField("confirmAccountNo", e.target.value)}
                                            className="h-11 rounded-xl bg-slate-50 mt-1"
                                            placeholder="Re-enter account number"
                                        />
                                        {fieldErrors.confirmAccountNo && <p className="text-xs text-red-500 mt-1">{fieldErrors.confirmAccountNo}</p>}
                                    </div>
                                </div>

                                <div>
                                    <Label className="text-xs font-bold text-slate-700">Bank IFSC Code *</Label>
                                    <Input
                                        value={formData.ifsc}
                                        onChange={(e) => updateField("ifsc", e.target.value.toUpperCase())}
                                        className="h-11 rounded-xl bg-slate-50 mt-1 uppercase"
                                        placeholder="e.g. HDFC0001234"
                                    />
                                    {fieldErrors.ifsc && <p className="text-xs text-red-500 mt-1">{fieldErrors.ifsc}</p>}
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                                    <div>
                                        <Label className="text-xs font-bold text-slate-700">PAN Card Number *</Label>
                                        <Input
                                            value={formData.pan}
                                            onChange={(e) => updateField("pan", e.target.value.toUpperCase())}
                                            className="h-11 rounded-xl bg-slate-50 mt-1 uppercase"
                                            placeholder="ABCDE1234F"
                                        />
                                        {fieldErrors.pan && <p className="text-xs text-red-500 mt-1">{fieldErrors.pan}</p>}
                                    </div>
                                    <div>
                                        <Label className="text-xs font-bold text-slate-700">Aadhaar Card Number *</Label>
                                        <Input
                                            value={formData.aadhaar}
                                            onChange={(e) => updateField("aadhaar", e.target.value)}
                                            className="h-11 rounded-xl bg-slate-50 mt-1"
                                            placeholder="12-digit Aadhaar"
                                        />
                                        {fieldErrors.aadhaar && <p className="text-xs text-red-500 mt-1">{fieldErrors.aadhaar}</p>}
                                    </div>
                                </div>

                                <div>
                                    <Label className="text-xs font-bold text-slate-700">Universal Account Number (UAN - Optional)</Label>
                                    <Input
                                        value={formData.uan}
                                        onChange={(e) => updateField("uan", e.target.value)}
                                        className="h-11 rounded-xl bg-slate-50 mt-1"
                                        placeholder="12-digit UAN if previously employed"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {currentStep === 3 && (
                        <div className="space-y-4">
                            <div>
                                <h2 className="text-lg font-black text-slate-900">Step 4: Upload Verification Documents</h2>
                                <p className="text-xs text-slate-500">Upload clear scans or photos of your identity documents (PDF/JPG/PNG).</p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                                {[
                                    { id: "aadhaar_card", label: "Aadhaar Card", desc: "Front and back side" },
                                    { id: "pan_card", label: "PAN Card", desc: "Clear front view" },
                                    { id: "bank_proof", label: "Bank Passbook / Cheque", desc: "Showing name & account no" },
                                    { id: "photo", label: "Passport Photo", desc: "Recent photograph" },
                                ].map((doc) => {
                                    const file = uploadedDocs[doc.id];
                                    return (
                                        <div
                                            key={doc.id}
                                            className={`p-4 rounded-2xl border transition-all ${
                                                file
                                                    ? "border-emerald-200 bg-emerald-50/50"
                                                    : "border-slate-200 bg-slate-50 hover:bg-slate-100/70"
                                            }`}
                                        >
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <h4 className="font-bold text-xs text-slate-900">{doc.label}</h4>
                                                    <p className="text-[10px] text-slate-400">{doc.desc}</p>
                                                </div>
                                                {file ? (
                                                    <Badge className="bg-emerald-500 text-white text-[9px] font-bold">
                                                        Uploaded
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="text-slate-400 text-[9px]">
                                                        Pending
                                                    </Badge>
                                                )}
                                            </div>

                                            {file ? (
                                                <div className="mt-3 flex items-center justify-between bg-white p-2 rounded-xl border border-emerald-100 text-[10px]">
                                                    <span className="font-bold text-slate-700 truncate max-w-[140px]">
                                                        {file.name}
                                                    </span>
                                                    <button
                                                        onClick={() => removeDoc(doc.id)}
                                                        className="text-red-500 hover:text-red-700"
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleFileSelect(doc.id)}
                                                    className="w-full mt-3 h-9 text-[10px] font-bold rounded-xl border-dashed"
                                                >
                                                    <Upload className="h-3.5 w-3.5 mr-1" /> Choose File
                                                </Button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {currentStep === 4 && (
                        <div className="space-y-4">
                            <div>
                                <h2 className="text-lg font-black text-slate-900">Step 5: Review & Confirmation</h2>
                                <p className="text-xs text-slate-500">Please review your submitted details before finalizing.</p>
                            </div>

                            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2 text-xs">
                                <div className="grid grid-cols-2 py-1 border-b border-slate-200/60">
                                    <span className="text-slate-400 font-bold uppercase text-[10px]">Full Name:</span>
                                    <span className="font-black text-slate-900">{formData.name}</span>
                                </div>
                                <div className="grid grid-cols-2 py-1 border-b border-slate-200/60">
                                    <span className="text-slate-400 font-bold uppercase text-[10px]">Email:</span>
                                    <span className="font-bold text-slate-800">{formData.email}</span>
                                </div>
                                <div className="grid grid-cols-2 py-1 border-b border-slate-200/60">
                                    <span className="text-slate-400 font-bold uppercase text-[10px]">Mobile:</span>
                                    <span className="font-bold text-slate-800">{formData.phone}</span>
                                </div>
                                <div className="grid grid-cols-2 py-1 border-b border-slate-200/60">
                                    <span className="text-slate-400 font-bold uppercase text-[10px]">Bank:</span>
                                    <span className="font-bold text-slate-800">{formData.bankName} (A/C: {formData.accountNo})</span>
                                </div>
                                <div className="grid grid-cols-2 py-1 border-b border-slate-200/60">
                                    <span className="text-slate-400 font-bold uppercase text-[10px]">PAN / Aadhaar:</span>
                                    <span className="font-bold text-slate-800">{formData.pan} / {formData.aadhaar}</span>
                                </div>
                                <div className="grid grid-cols-2 py-1">
                                    <span className="text-slate-400 font-bold uppercase text-[10px]">Documents Uploaded:</span>
                                    <span className="font-bold text-emerald-600">{Object.keys(uploadedDocs).length} files attached</span>
                                </div>
                            </div>

                            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
                                <ShieldCheck className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                                <p className="leading-relaxed">
                                    I hereby declare that the particulars given above are true and correct to the best of my knowledge and belief. I agree to provide original documents for physical verification upon request.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Step Navigation Controls */}
                    <div className="flex items-center justify-between pt-6 border-t border-slate-100 mt-6">
                        {currentStep > 0 ? (
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setCurrentStep((s) => s - 1)}
                                className="h-11 rounded-xl text-xs font-bold px-5"
                            >
                                <ArrowLeft className="h-4 w-4 mr-1" /> Back
                            </Button>
                        ) : (
                            <div />
                        )}

                        {currentStep < 4 ? (
                            <Button
                                type="button"
                                onClick={handleNext}
                                className="bg-slate-900 text-white hover:bg-black font-black uppercase text-[10px] tracking-widest px-8 h-11 rounded-xl shadow-lg flex items-center gap-2"
                            >
                                Next Step <ArrowRight className="h-4 w-4" />
                            </Button>
                        ) : (
                            <Button
                                type="button"
                                onClick={handleSubmit}
                                disabled={submitting}
                                className="bg-emerald-600 text-white hover:bg-emerald-700 font-black uppercase text-[10px] tracking-widest px-8 h-11 rounded-xl shadow-lg flex items-center gap-2"
                            >
                                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit All Details"}
                            </Button>
                        )}
                    </div>
                </Card>
            </div>
        </div>
    );
}

export default function CandidateOnboardingPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
            <CandidateOnboardingContent />
        </Suspense>
    );
}
