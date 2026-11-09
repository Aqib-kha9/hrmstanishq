"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
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
    Eye,
    Briefcase,
    Clock,
    FileText,
    Calendar,
    Phone,
    MapPin,
    Users,
    Sparkles,
    Info,
    ExternalLink,
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
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;

// 8 Mandatory & Standard Candidate Verification Documents (Req 2.3 D)
const DOCUMENT_DEFINITIONS = [
    {
        id: "aadhaar_card",
        title: "1. Aadhaar Card",
        description: "Front & back copy showing complete 12-digit number and address.",
        mandatory: true,
        accept: ".pdf,.png,.jpg,.jpeg",
    },
    {
        id: "bank_proof",
        title: "2. Bank Passbook / Cancelled Cheque",
        description: "Clear copy displaying your account holder name, account number & IFSC.",
        mandatory: true,
        accept: ".pdf,.png,.jpg,.jpeg",
    },
    {
        id: "photo",
        title: "3. Employee Photograph",
        description: "Recent formal passport-size photo with plain background.",
        mandatory: true,
        accept: ".png,.jpg,.jpeg",
    },
    {
        id: "relieving_letter",
        title: "4. Relieving Letter from Previous Employer",
        description: "Official relieving / experience certificate from your last organization.",
        mandatory: false,
        accept: ".pdf,.png,.jpg,.jpeg",
    },
    {
        id: "appointment_letter",
        title: "5. Previous Appointment Letter",
        description: "Appointment or offer letter from your previous employer.",
        mandatory: false,
        accept: ".pdf,.png,.jpg,.jpeg",
    },
    {
        id: "salary_slips",
        title: "6. Salary Slips for the Previous Three Months",
        description: "Payslips for the last 3 consecutive months from your previous company.",
        mandatory: false,
        accept: ".pdf,.png,.jpg,.jpeg",
    },
    {
        id: "bank_statements",
        title: "7. Bank Statements for the Previous Three Months",
        description: "Bank statement showing salary credits for the last 3 months.",
        mandatory: false,
        accept: ".pdf,.png,.jpg,.jpeg",
    },
    {
        id: "form_16",
        title: "8. Form 16 / Tax Certificate",
        description: "Part A & B of Form 16 or tax deduction certificate from prior employer.",
        mandatory: false,
        accept: ".pdf,.png,.jpg,.jpeg",
    },
];

function CandidateOnboardingContent() {
    const searchParams = useSearchParams();
    const token = searchParams.get("token") || "";

    const [loading, setLoading] = useState(true);
    const [invitation, setInvitation] = useState<any>(null);
    const [tokenError, setTokenError] = useState<string | null>(null);

    const [currentStep, setCurrentStep] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const [submittedSuccess, setSubmittedSuccess] = useState(false);
    const [declarationAccepted, setDeclarationAccepted] = useState(false);

    // Form state covering all sections under Req 2.3
    const [formData, setFormData] = useState({
        // Section A: Personal Information
        name: "", // Full Name, as per Aadhaar (*)
        dob: "", // Date of Birth (*)
        doj: "", // Date of Joining (*)
        marital_status: "unmarried", // Married / Unmarried (*)
        father_or_husband_name: "", // Father's Name / Husband's Name, as applicable (*)
        phone: "", // Mobile Number (*)
        emergency_contact_name: "", // Emergency Contact Name (*)
        emergency_contact_phone: "", // Emergency Contact Number (*)
        emergency_contact_relation: "", // Emergency Contact Relationship (*)
        address: "", // Address as per Aadhaar (*)
        gender: "male", // Gender (*)
        aadhaar: "", // Aadhaar 12-digit number (*)
        pan: "", // PAN Card Number (NOT mandatory under Req 2.3 A)

        // Section B: Employment Information
        working_location: "", // Working Location (renamed from Office Location)
        designation: "", // Designation (renamed from Job Role; separate job title removed)
        shift_start_time: "09:30", // Shift Start Time
        shift_end_time: "18:30", // Shift End Time
        is_rotational_shift: false, // Rotational Shift option (NEW Req 2.3 B)

        // Section C: Salary Information - Section 1: Salary & Bank Details
        fixed_gross: "", // Monthly CTC (₹)
        bank_name: "", // Bank Name (*)
        bank_account_number: "", // Bank Account Number (*)
        confirm_account_number: "", // Confirm Account Number (*)
        ifsc_code: "", // IFSC Code (*)
        payment_mode: "Bank Transfer", // Payment Mode

        // Section C: Salary Information - Section 2: Statutory Information
        pf_applicable: true, // PF applicability
        pf_ceiling: true, // PF ceiling limit (₹15,000 cap)
        pf_employment_date: "", // PF Employment Date
        pf_number: "", // PF Number
        uan: "", // UAN Number
        esic_applicable: false, // ESIC applicability
        esic_number: "", // ESIC Registration / Configuration (replaces LIC field)
    });

    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [uploadedDocs, setUploadedDocs] = useState<{ [key: string]: { file: File; dataUrl: string } }>({});
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [activeDocType, setActiveDocType] = useState<string>("");
    const [previewDocModal, setPreviewDocModal] = useState<{ id: string; title: string; dataUrl: string; fileType: string; fileName: string } | null>(null);

    // Validate token on mount
    useEffect(() => {
        if (!token) {
            setTokenError("Missing onboarding token. Please check the invitation link sent to your registered email.");
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
                const inv = data.data;
                setInvitation(inv);

                // Auto-fill available details from the invitation
                setFormData((prev) => ({
                    ...prev,
                    name: inv.candidate_name || "",
                    phone: inv.phone || "",
                    working_location: inv.office?.name || (inv.office?.address ? `${inv.office.name} - ${inv.office.address}` : "Head Office"),
                    designation: inv.designation || "Executive",
                    fixed_gross: inv.fixed_gross ? String(inv.fixed_gross) : "",
                    doj: new Date().toISOString().split("T")[0],
                }));
            } catch (err: any) {
                setTokenError(err.message || "Invalid or expired onboarding invitation.");
            } finally {
                setLoading(false);
            }
        }
        validate();
    }, [token]);

    const updateField = (key: string, value: any) => {
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

    const readFileAsDataUrl = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    const onFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && activeDocType) {
            if (file.size > 10 * 1024 * 1024) {
                alert("File size exceeds 10MB limit. Please upload a smaller file.");
                e.target.value = "";
                return;
            }
            try {
                const dataUrl = await readFileAsDataUrl(file);
                setUploadedDocs((prev) => ({
                    ...prev,
                    [activeDocType]: { file, dataUrl },
                }));
            } catch (readErr) {
                console.error("Could not read file", readErr);
                alert("Could not read file. Please try again.");
            }
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

    // Validation per step
    const validateStep = (step: number): boolean => {
        const errors: Record<string, string> = {};

        // ── STEP 0: Personal Information (Page A) ──
        // All fields marked mandatory EXCEPT PAN Number
        if (step === 0) {
            if (!formData.name.trim()) errors.name = "Full name as per Aadhaar is required";
            if (!formData.dob) errors.dob = "Date of birth is required";
            if (!formData.doj) errors.doj = "Date of joining is required";
            if (!formData.marital_status) errors.marital_status = "Marital status is required";
            if (!formData.father_or_husband_name.trim()) {
                errors.father_or_husband_name = "Father's / Husband's name is required";
            }
            if (!formData.phone.trim() || !PHONE_RE.test(formData.phone.replace(/[\s-]/g, ""))) {
                errors.phone = "Valid 10-digit mobile number is required";
            }
            if (!formData.emergency_contact_name.trim()) {
                errors.emergency_contact_name = "Emergency contact name is required";
            }
            if (!formData.emergency_contact_phone.trim() || !PHONE_RE.test(formData.emergency_contact_phone.replace(/[\s-]/g, ""))) {
                errors.emergency_contact_phone = "Valid 10-digit emergency contact number is required";
            }
            if (!formData.emergency_contact_relation.trim()) {
                errors.emergency_contact_relation = "Emergency contact relationship is required";
            }
            if (!formData.address.trim()) {
                errors.address = "Residential address as per Aadhaar is required";
            }
            if (!formData.gender) {
                errors.gender = "Gender is required";
            }
            if (!formData.aadhaar.trim() || !AADHAAR_RE.test(formData.aadhaar.replace(/\s/g, ""))) {
                errors.aadhaar = "Valid 12-digit Aadhaar number is required";
            }
            // PAN is explicitly NOT mandatory under Req 2.3 A
            if (formData.pan.trim() && !PAN_RE.test(formData.pan.toUpperCase().trim())) {
                errors.pan = "Invalid PAN format (e.g. ABCDE1234F)";
            }
        }

        // ── STEP 1: Employment Information (Page B) ──
        if (step === 1) {
            if (!formData.working_location.trim()) {
                errors.working_location = "Working location is required";
            }
            if (!formData.designation.trim()) {
                errors.designation = "Designation is required";
            }
            if (!formData.shift_start_time) {
                errors.shift_start_time = "Shift start time is required";
            }
            if (!formData.shift_end_time) {
                errors.shift_end_time = "Shift end time is required";
            }
        }

        // ── STEP 2: Salary Information (Page C) ──
        if (step === 2) {
            // Section 1: Salary & Bank Details
            if (!formData.bank_name.trim()) errors.bank_name = "Bank name is required";
            if (!formData.bank_account_number.trim()) errors.bank_account_number = "Bank account number is required";
            if (formData.bank_account_number !== formData.confirm_account_number) {
                errors.confirm_account_number = "Bank account numbers do not match";
            }
            const cleanIfsc = formData.ifsc_code.toUpperCase().replace(/\s/g, "");
            if (!cleanIfsc || !IFSC_RE.test(cleanIfsc)) {
                errors.ifsc_code = "Valid 11-character IFSC code is required (e.g. HDFC0001234)";
            }
            if (!formData.payment_mode) {
                errors.payment_mode = "Payment mode is required";
            }

            // Section 2: Statutory Information
            if (formData.pf_applicable && formData.uan.trim() && !/^\d{12}$/.test(formData.uan.trim())) {
                errors.uan = "UAN should be a 12-digit number";
            }
        }

        // ── STEP 3: Mandatory Document Uploads (Page D) ──
        if (step === 3) {
            // Require primary identity proofs: Aadhaar and Bank Proof
            if (!uploadedDocs.aadhaar_card) {
                errors.docs = "Please upload your Aadhaar Card (mandatory verification document)";
            } else if (!uploadedDocs.bank_proof) {
                errors.docs = "Please upload your Bank Passbook or Cancelled Cheque (mandatory for salary credit)";
            } else if (!uploadedDocs.photo) {
                errors.docs = "Please upload your recent Employee Photograph";
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

    const handleSubmit = async () => {
        if (!declarationAccepted) {
            alert("Please read and accept the declaration checkbox before submitting.");
            return;
        }

        setSubmitting(true);
        try {
            // Prepare documents payload
            const docList = Object.keys(uploadedDocs).map((k) => {
                const item = uploadedDocs[k];
                return {
                    type: k,
                    filename: item.file.name,
                    size: item.file.size,
                    mime_type: item.file.type,
                    data_url: item.dataUrl,
                };
            });

            const payload = {
                // Personal Information
                name: formData.name.trim(),
                date_of_birth: formData.dob,
                date_of_joining: formData.doj,
                marital_status: formData.marital_status,
                father_or_husband_name: formData.father_or_husband_name.trim(),
                phone: formData.phone.trim(),
                emergency_contact_name: formData.emergency_contact_name.trim(),
                emergency_contact_phone: formData.emergency_contact_phone.trim(),
                emergency_contact_relation: formData.emergency_contact_relation.trim(),
                address: formData.address.trim(),
                gender: formData.gender,
                aadhaar_number: formData.aadhaar.replace(/\s/g, ""),
                pan_number: formData.pan.trim().toUpperCase() || null,

                // Employment Information
                working_location: formData.working_location.trim(),
                designation: formData.designation.trim(),
                shift_start_time: formData.shift_start_time,
                shift_end_time: formData.shift_end_time,
                is_rotational_shift: Boolean(formData.is_rotational_shift),

                // Salary & Bank Details
                fixed_gross: formData.fixed_gross ? Number(formData.fixed_gross) : (invitation?.fixed_gross || 0),
                bank_name: formData.bank_name.trim(),
                bank_account_number: formData.bank_account_number.trim(),
                ifsc_code: formData.ifsc_code.trim().toUpperCase(),
                payment_mode: formData.payment_mode,

                // Statutory Information
                pf_applicable: Boolean(formData.pf_applicable),
                pf_ceiling: Boolean(formData.pf_ceiling),
                pf_employment_date: formData.pf_employment_date || null,
                pf_number: formData.pf_number.trim().toUpperCase() || null,
                uan: formData.uan.trim() || null,
                esic_applicable: Boolean(formData.esic_applicable),
                esic_number: formData.esic_number.trim().toUpperCase() || null,

                // Uploaded Documents
                uploaded_docs: docList,
            };

            const res = await fetch(`${API_BASE}/onboarding/public/submit/${token}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.message || "Failed to submit onboarding details. Please try again.");
            }

            setSubmittedSuccess(true);
        } catch (err: any) {
            console.error("Submission failed:", err);
            alert(err.message || "Failed to submit onboarding details. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
                <div className="relative">
                    <div className="h-16 w-16 rounded-3xl bg-slate-900 text-white flex items-center justify-center font-black text-2xl shadow-xl animate-pulse">
                        A
                    </div>
                </div>
                <Loader2 className="h-6 w-6 animate-spin text-slate-700 mt-6" />
                <p className="mt-3 text-xs font-bold uppercase tracking-widest text-slate-500">
                    Verifying Secure Onboarding Link...
                </p>
            </div>
        );
    }

    if (tokenError) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
                <Card className="max-w-md w-full rounded-3xl border-none shadow-2xl p-8 text-center bg-white">
                    <div className="h-16 w-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4 border border-rose-100">
                        <AlertCircle className="h-8 w-8 stroke-[2.5]" />
                    </div>
                    <h2 className="text-xl font-black text-slate-900 tracking-tight mb-2">Link Expired or Invalid</h2>
                    <p className="text-xs text-slate-500 leading-relaxed mb-6">{tokenError}</p>
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 text-left text-xs text-slate-600 space-y-1">
                        <div className="flex items-center gap-2 font-bold text-slate-700">
                            <Info className="h-4 w-4 text-slate-400" /> Need Assistance?
                        </div>
                        <p className="text-[11px] text-slate-500">
                            Please contact your HR representative or recruitment team to receive a fresh onboarding invitation link.
                        </p>
                    </div>
                </Card>
            </div>
        );
    }

    if (submittedSuccess) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
                <Card className="max-w-xl w-full rounded-3xl border-none shadow-2xl p-8 text-center bg-white">
                    <div className="h-16 w-16 rounded-3xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-5 shadow-inner">
                        <CheckCircle2 className="h-10 w-10 stroke-[2.5]" />
                    </div>
                    <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold px-3 py-1 mb-3">
                        Onboarding Dossier Submitted
                    </Badge>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-3">
                        Welcome Aboard, {formData.name}!
                    </h2>
                    <p className="text-xs text-slate-500 leading-relaxed mb-6 max-w-md mx-auto">
                        Your complete onboarding profile, statutory registrations, and verification documents have been securely submitted to our Human Resources department.
                    </p>

                    <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 text-left space-y-2.5 text-xs mb-6">
                        <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                            <span className="text-slate-400 font-bold uppercase text-[10px]">Candidate Name</span>
                            <span className="font-black text-slate-900">{formData.name}</span>
                        </div>
                        <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                            <span className="text-slate-400 font-bold uppercase text-[10px]">Registered Email</span>
                            <span className="font-bold text-slate-800">{invitation?.email}</span>
                        </div>
                        <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                            <span className="text-slate-400 font-bold uppercase text-[10px]">Designation</span>
                            <span className="font-bold text-slate-800">{formData.designation}</span>
                        </div>
                        <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                            <span className="text-slate-400 font-bold uppercase text-[10px]">Working Location</span>
                            <span className="font-bold text-slate-800">{formData.working_location}</span>
                        </div>
                        <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                            <span className="text-slate-400 font-bold uppercase text-[10px]">Documents Uploaded</span>
                            <span className="font-bold text-emerald-600">{Object.keys(uploadedDocs).length} documents attached</span>
                        </div>
                        <div className="flex justify-between items-center py-1">
                            <span className="text-slate-400 font-bold uppercase text-[10px]">Status</span>
                            <Badge className="bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-bold">
                                Under HR Review & ID Allocation
                            </Badge>
                        </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100 text-indigo-900 text-left text-xs space-y-1">
                        <p className="font-bold flex items-center gap-1.5">
                            <Sparkles className="h-4 w-4 text-indigo-600" /> What happens next?
                        </p>
                        <p className="text-[11px] text-indigo-700 leading-relaxed">
                            1. HR will verify your submitted documents and statutory details.<br />
                            2. Your unique Company Employee ID will be generated.<br />
                            3. Your Appointment Letter and HRMS employee portal credentials will be dispatched to your registered email.
                        </p>
                    </div>
                </Card>
            </div>
        );
    }

    const steps = [
        { label: "Personal Information", desc: "Aadhaar, contacts & personal data" },
        { label: "Employment Information", desc: "Designation, location & shift" },
        { label: "Salary & Statutory", desc: "Bank details & statutory compliance" },
        { label: "Document Uploads", desc: "8 verification documents" },
        { label: "Review & Submit", desc: "Final verification & declaration" },
    ];

    return (
        <div className="min-h-screen bg-slate-100 py-10 px-4 sm:px-6">
            <input
                type="file"
                ref={fileInputRef}
                onChange={onFilePicked}
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg"
            />

            {/* Document Preview Modal */}
            {previewDocModal && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                            <div>
                                <h3 className="font-black text-slate-900 text-sm">{previewDocModal.title}</h3>
                                <p className="text-xs text-slate-400 font-mono truncate max-w-sm">{previewDocModal.fileName}</p>
                            </div>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setPreviewDocModal(null)}
                                className="h-8 w-8 p-0 rounded-full"
                            >
                                <X className="h-5 w-5" />
                            </Button>
                        </div>
                        <div className="flex-1 overflow-auto bg-slate-50 rounded-2xl p-3 flex items-center justify-center min-h-[300px]">
                            {previewDocModal.fileType.startsWith("image/") ? (
                                <img
                                    src={previewDocModal.dataUrl}
                                    alt={previewDocModal.title}
                                    className="max-h-[60vh] max-w-full rounded-xl object-contain shadow-sm"
                                />
                            ) : (
                                <iframe
                                    src={previewDocModal.dataUrl}
                                    className="w-full h-[60vh] rounded-xl border border-slate-200"
                                    title={previewDocModal.title}
                                />
                            )}
                        </div>
                        <div className="flex justify-end pt-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setPreviewDocModal(null)}
                                className="h-9 rounded-xl text-xs font-bold"
                            >
                                Close Preview
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <div className="max-w-3xl mx-auto space-y-6">
                {/* Brand Banner */}
                <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-sm border border-slate-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                        <div className="h-12 w-12 rounded-2xl bg-slate-900 text-[#D9F99D] flex items-center justify-center font-black text-xl shadow-md">
                            A
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-lg font-black text-slate-900 tracking-tight">Employee Self-Onboarding</h1>
                                <Badge className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold">
                                    Confidential
                                </Badge>
                            </div>
                            <p className="text-xs text-slate-500 font-medium">
                                Please review and complete your employee registration details.
                            </p>
                        </div>
                    </div>
                    <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Legal Entity</span>
                        <span className="text-xs font-black text-slate-800">
                            {invitation?.company?.name || "Apaar Logistics & Cold Supply Chain"}
                        </span>
                    </div>
                </div>

                {/* Step Indicator */}
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/70">
                    <div className="grid grid-cols-5 gap-2">
                        {steps.map((step, idx) => {
                            const isCurrent = idx === currentStep;
                            const isDone = idx < currentStep;
                            return (
                                <button
                                    key={step.label}
                                    type="button"
                                    onClick={() => {
                                        if (isDone) setCurrentStep(idx);
                                    }}
                                    disabled={!isDone && !isCurrent}
                                    className={`flex flex-col items-center text-center p-2 rounded-xl transition-all ${
                                        isCurrent
                                            ? "bg-slate-900 text-white shadow-md cursor-default"
                                            : isDone
                                            ? "bg-emerald-50 text-emerald-800 hover:bg-emerald-100/80 cursor-pointer"
                                            : "bg-slate-50 text-slate-400 cursor-not-allowed opacity-60"
                                    }`}
                                >
                                    <div
                                        className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-black mb-1 ${
                                            isCurrent
                                                ? "bg-white text-slate-900"
                                                : isDone
                                                ? "bg-emerald-600 text-white"
                                                : "bg-slate-200 text-slate-500"
                                        }`}
                                    >
                                        {isDone ? <Check className="h-3.5 w-3.5 stroke-[3]" /> : idx + 1}
                                    </div>
                                    <span className="text-[10px] font-bold truncate max-w-[85px] hidden sm:block">
                                        {step.label}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Form Body Card */}
                <Card className="rounded-3xl border-none shadow-xl bg-white p-6 sm:p-8">
                    {/* ═════════════════════════════════════════════════════════ */}
                    {/* STEP 0 (PAGE A): PERSONAL INFORMATION */}
                    {/* ═════════════════════════════════════════════════════════ */}
                    {currentStep === 0 && (
                        <div className="space-y-6">
                            <div className="border-b border-slate-100 pb-4">
                                <div className="flex items-center gap-2">
                                    <div className="h-8 w-8 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center">
                                        <User className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <h2 className="text-base font-black text-slate-900">
                                            Page 1: Personal Information
                                        </h2>
                                        <p className="text-xs text-slate-500">
                                            All fields marked with <span className="text-rose-500 font-bold">*</span> are mandatory as per statutory requirements. PAN Number is optional.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                {/* 1. Full Legal Name as per Aadhaar */}
                                <div>
                                    <Label className="text-xs font-bold text-slate-700">
                                        Full Name, as per Aadhaar <span className="text-rose-500">*</span>
                                    </Label>
                                    <Input
                                        value={formData.name}
                                        onChange={(e) => updateField("name", e.target.value)}
                                        className="h-11 rounded-xl bg-slate-50 mt-1 font-bold text-xs"
                                        placeholder="Full legal name exactly as shown on your Aadhaar card"
                                    />
                                    {fieldErrors.name && <p className="text-xs text-rose-500 mt-1">{fieldErrors.name}</p>}
                                </div>

                                {/* 2. DOB, DOJ, Gender */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div>
                                        <Label className="text-xs font-bold text-slate-700">
                                            Date of Birth <span className="text-rose-500">*</span>
                                        </Label>
                                        <Input
                                            type="date"
                                            value={formData.dob}
                                            onChange={(e) => updateField("dob", e.target.value)}
                                            className="h-11 rounded-xl bg-slate-50 mt-1 font-bold text-xs"
                                        />
                                        {fieldErrors.dob && <p className="text-xs text-rose-500 mt-1">{fieldErrors.dob}</p>}
                                    </div>

                                    <div>
                                        <Label className="text-xs font-bold text-slate-700">
                                            Date of Joining <span className="text-rose-500">*</span>
                                        </Label>
                                        <Input
                                            type="date"
                                            value={formData.doj}
                                            onChange={(e) => updateField("doj", e.target.value)}
                                            className="h-11 rounded-xl bg-slate-50 mt-1 font-bold text-xs"
                                        />
                                        {fieldErrors.doj && <p className="text-xs text-rose-500 mt-1">{fieldErrors.doj}</p>}
                                    </div>

                                    <div>
                                        <Label className="text-xs font-bold text-slate-700">
                                            Gender <span className="text-rose-500">*</span>
                                        </Label>
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

                                {/* 3. Marital Status & Father/Husband Name */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <Label className="text-xs font-bold text-slate-700">
                                            Marital Status <span className="text-rose-500">*</span>
                                        </Label>
                                        <select
                                            value={formData.marital_status}
                                            onChange={(e) => updateField("marital_status", e.target.value)}
                                            className="w-full h-11 rounded-xl bg-slate-50 border border-slate-200 px-3 text-xs font-bold text-slate-800 mt-1 outline-none"
                                        >
                                            <option value="unmarried">Unmarried</option>
                                            <option value="married">Married</option>
                                            <option value="other">Other</option>
                                        </select>
                                        {fieldErrors.marital_status && (
                                            <p className="text-xs text-rose-500 mt-1">{fieldErrors.marital_status}</p>
                                        )}
                                    </div>

                                    <div>
                                        <Label className="text-xs font-bold text-slate-700">
                                            {formData.marital_status === "married" ? "Father's / Husband's Name" : "Father's Name"} <span className="text-rose-500">*</span>
                                        </Label>
                                        <Input
                                            value={formData.father_or_husband_name}
                                            onChange={(e) => updateField("father_or_husband_name", e.target.value)}
                                            className="h-11 rounded-xl bg-slate-50 mt-1 font-bold text-xs"
                                            placeholder="Enter Father's or Husband's full name"
                                        />
                                        {fieldErrors.father_or_husband_name && (
                                            <p className="text-xs text-rose-500 mt-1">{fieldErrors.father_or_husband_name}</p>
                                        )}
                                    </div>
                                </div>

                                {/* 4. Mobile Number & Registered Email */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <Label className="text-xs font-bold text-slate-700">
                                            Mobile Number <span className="text-rose-500">*</span>
                                        </Label>
                                        <Input
                                            value={formData.phone}
                                            onChange={(e) => updateField("phone", e.target.value)}
                                            className="h-11 rounded-xl bg-slate-50 mt-1 font-bold text-xs"
                                            placeholder="10-digit primary mobile number"
                                        />
                                        {fieldErrors.phone && <p className="text-xs text-rose-500 mt-1">{fieldErrors.phone}</p>}
                                    </div>

                                    <div>
                                        <Label className="text-xs font-bold text-slate-700">
                                            Registered Email Address (Read-only)
                                        </Label>
                                        <Input
                                            value={invitation?.email || ""}
                                            disabled
                                            className="h-11 rounded-xl bg-slate-100 text-slate-500 mt-1 font-bold text-xs"
                                        />
                                    </div>
                                </div>

                                {/* 5. Emergency Contact details */}
                                <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80 space-y-3">
                                    <span className="text-[11px] font-black uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                                        <Users className="h-3.5 w-3.5 text-amber-600" /> Emergency Contact Details
                                    </span>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <div>
                                            <Label className="text-[11px] font-bold text-slate-700">
                                                Emergency Contact Name <span className="text-rose-500">*</span>
                                            </Label>
                                            <Input
                                                value={formData.emergency_contact_name}
                                                onChange={(e) => updateField("emergency_contact_name", e.target.value)}
                                                className="h-10 rounded-xl bg-white mt-1 font-bold text-xs"
                                                placeholder="e.g. Priya Sharma"
                                            />
                                            {fieldErrors.emergency_contact_name && (
                                                <p className="text-[10px] text-rose-500 mt-1">{fieldErrors.emergency_contact_name}</p>
                                            )}
                                        </div>
                                        <div>
                                            <Label className="text-[11px] font-bold text-slate-700">
                                                Emergency Contact Number <span className="text-rose-500">*</span>
                                            </Label>
                                            <Input
                                                value={formData.emergency_contact_phone}
                                                onChange={(e) => updateField("emergency_contact_phone", e.target.value)}
                                                className="h-10 rounded-xl bg-white mt-1 font-bold text-xs"
                                                placeholder="10-digit emergency number"
                                            />
                                            {fieldErrors.emergency_contact_phone && (
                                                <p className="text-[10px] text-rose-500 mt-1">{fieldErrors.emergency_contact_phone}</p>
                                            )}
                                        </div>
                                        <div>
                                            <Label className="text-[11px] font-bold text-slate-700">
                                                Relationship <span className="text-rose-500">*</span>
                                            </Label>
                                            <Input
                                                value={formData.emergency_contact_relation}
                                                onChange={(e) => updateField("emergency_contact_relation", e.target.value)}
                                                className="h-10 rounded-xl bg-white mt-1 font-bold text-xs"
                                                placeholder="e.g. Spouse / Father / Mother"
                                            />
                                            {fieldErrors.emergency_contact_relation && (
                                                <p className="text-[10px] text-rose-500 mt-1">{fieldErrors.emergency_contact_relation}</p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* 6. Address as per Aadhaar */}
                                <div>
                                    <Label className="text-xs font-bold text-slate-700">
                                        Residential Address as per Aadhaar <span className="text-rose-500">*</span>
                                    </Label>
                                    <Input
                                        value={formData.address}
                                        onChange={(e) => updateField("address", e.target.value)}
                                        className="h-11 rounded-xl bg-slate-50 mt-1 font-bold text-xs"
                                        placeholder="Full address with house number, street, city, state and PIN code"
                                    />
                                    {fieldErrors.address && <p className="text-xs text-rose-500 mt-1">{fieldErrors.address}</p>}
                                </div>

                                {/* 7. Aadhaar (Mandatory) & PAN (Optional) */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                    <div>
                                        <Label className="text-xs font-bold text-slate-700">
                                            Aadhaar Card Number (12 digits) <span className="text-rose-500">*</span>
                                        </Label>
                                        <Input
                                            value={formData.aadhaar}
                                            onChange={(e) => updateField("aadhaar", e.target.value)}
                                            className="h-11 rounded-xl bg-slate-50 mt-1 font-mono font-bold text-xs"
                                            placeholder="12-digit UIDAI number"
                                            maxLength={12}
                                        />
                                        {fieldErrors.aadhaar && <p className="text-xs text-rose-500 mt-1">{fieldErrors.aadhaar}</p>}
                                    </div>

                                    <div>
                                        <div className="flex items-center justify-between">
                                            <Label className="text-xs font-bold text-slate-700">
                                                PAN Card Number
                                            </Label>
                                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                                Optional (Req 2.3 A)
                                            </span>
                                        </div>
                                        <Input
                                            value={formData.pan}
                                            onChange={(e) => updateField("pan", e.target.value.toUpperCase())}
                                            className="h-11 rounded-xl bg-slate-50 mt-1 font-mono uppercase font-bold text-xs"
                                            placeholder="ABCDE1234F (Optional)"
                                            maxLength={10}
                                        />
                                        {fieldErrors.pan && <p className="text-xs text-rose-500 mt-1">{fieldErrors.pan}</p>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ═════════════════════════════════════════════════════════ */}
                    {/* STEP 1 (PAGE B): EMPLOYMENT INFORMATION */}
                    {/* ═════════════════════════════════════════════════════════ */}
                    {currentStep === 1 && (
                        <div className="space-y-6">
                            <div className="border-b border-slate-100 pb-4">
                                <div className="flex items-center gap-2">
                                    <div className="h-8 w-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
                                        <Briefcase className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <h2 className="text-base font-black text-slate-900">
                                            Page 2: Employment Information
                                        </h2>
                                        <p className="text-xs text-slate-500">
                                            Role allocation, working location, and daily shift operational schedule.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                {/* Working Location & Designation */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <Label className="text-xs font-bold text-slate-700">
                                            Working Location <span className="text-rose-500">*</span>
                                        </Label>
                                        <Input
                                            value={formData.working_location}
                                            onChange={(e) => updateField("working_location", e.target.value)}
                                            className="h-11 rounded-xl bg-slate-50 mt-1 font-bold text-xs"
                                            placeholder="e.g. Mumbai Logistics Hub"
                                        />
                                        {fieldErrors.working_location && (
                                            <p className="text-xs text-rose-500 mt-1">{fieldErrors.working_location}</p>
                                        )}
                                    </div>

                                    <div>
                                        <Label className="text-xs font-bold text-slate-700">
                                            Designation <span className="text-rose-500">*</span>
                                        </Label>
                                        <Input
                                            value={formData.designation}
                                            onChange={(e) => updateField("designation", e.target.value)}
                                            className="h-11 rounded-xl bg-slate-50 mt-1 font-bold text-xs"
                                            placeholder="e.g. Senior Supply Chain Executive"
                                        />
                                        {fieldErrors.designation && (
                                            <p className="text-xs text-rose-500 mt-1">{fieldErrors.designation}</p>
                                        )}
                                    </div>
                                </div>

                                {/* Shift Timings & Rotational Shift Option */}
                                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                            <Clock className="h-3.5 w-3.5 text-indigo-600" /> Operational Shift Schedule
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <Label className="text-xs font-bold text-slate-700">
                                                Shift Start Time <span className="text-rose-500">*</span>
                                            </Label>
                                            <Input
                                                type="time"
                                                value={formData.shift_start_time}
                                                onChange={(e) => updateField("shift_start_time", e.target.value)}
                                                className="h-11 rounded-xl bg-white mt-1 font-mono font-bold text-xs"
                                            />
                                            {fieldErrors.shift_start_time && (
                                                <p className="text-xs text-rose-500 mt-1">{fieldErrors.shift_start_time}</p>
                                            )}
                                        </div>

                                        <div>
                                            <Label className="text-xs font-bold text-slate-700">
                                                Shift End Time <span className="text-rose-500">*</span>
                                            </Label>
                                            <Input
                                                type="time"
                                                value={formData.shift_end_time}
                                                onChange={(e) => updateField("shift_end_time", e.target.value)}
                                                className="h-11 rounded-xl bg-white mt-1 font-mono font-bold text-xs"
                                            />
                                            {fieldErrors.shift_end_time && (
                                                <p className="text-xs text-rose-500 mt-1">{fieldErrors.shift_end_time}</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Rotational Shift Checkbox / Option (Req 2.3 B) */}
                                    <div className="pt-2 border-t border-slate-200/60">
                                        <label className="flex items-start gap-3 p-3 rounded-xl bg-white border border-slate-200 cursor-pointer hover:border-indigo-300 transition-all">
                                            <input
                                                type="checkbox"
                                                checked={formData.is_rotational_shift}
                                                onChange={(e) => updateField("is_rotational_shift", e.target.checked)}
                                                className="mt-0.5 h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500"
                                            />
                                            <div className="space-y-0.5">
                                                <span className="text-xs font-black text-slate-900 block">
                                                    Rotational Shift
                                                </span>
                                                <p className="text-[11px] text-slate-500 leading-relaxed">
                                                    Check this option if your role operates on rotational shifts (e.g. morning, evening, night roster).
                                                </p>
                                            </div>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ═════════════════════════════════════════════════════════ */}
                    {/* STEP 2 (PAGE C): SALARY INFORMATION */}
                    {/* ═════════════════════════════════════════════════════════ */}
                    {currentStep === 2 && (
                        <div className="space-y-6">
                            <div className="border-b border-slate-100 pb-4">
                                <div className="flex items-center gap-2">
                                    <div className="h-8 w-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                                        <CreditCard className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <h2 className="text-base font-black text-slate-900">
                                            Page 3: Salary Information
                                        </h2>
                                        <p className="text-xs text-slate-500">
                                            Banking credentials for monthly disbursement & statutory compliance declarations.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* ── Section 1: Salary & Bank Details ── */}
                            <div className="space-y-3 p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
                                <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
                                    <CreditCard className="h-3.5 w-3.5 text-emerald-600" /> Section 1: Salary & Bank Details
                                </span>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <Label className="text-xs font-bold text-slate-700">
                                            Monthly CTC (₹)
                                        </Label>
                                        <Input
                                            type="number"
                                            value={formData.fixed_gross}
                                            onChange={(e) => updateField("fixed_gross", e.target.value)}
                                            className="h-11 rounded-xl bg-slate-50 mt-1 font-bold text-xs"
                                            placeholder="Agreed monthly gross CTC"
                                        />
                                    </div>

                                    <div>
                                        <Label className="text-xs font-bold text-slate-700">
                                            Payment Mode <span className="text-rose-500">*</span>
                                        </Label>
                                        <select
                                            value={formData.payment_mode}
                                            onChange={(e) => updateField("payment_mode", e.target.value)}
                                            className="w-full h-11 rounded-xl bg-slate-50 border border-slate-200 px-3 text-xs font-bold text-slate-800 mt-1 outline-none"
                                        >
                                            <option value="Bank Transfer">Bank Transfer (NEFT/RTGS)</option>
                                            <option value="Cheque">Cheque</option>
                                            <option value="Cash">Cash</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <Label className="text-xs font-bold text-slate-700">
                                        Bank Name <span className="text-rose-500">*</span>
                                    </Label>
                                    <Input
                                        value={formData.bank_name}
                                        onChange={(e) => updateField("bank_name", e.target.value)}
                                        className="h-11 rounded-xl bg-slate-50 mt-1 font-bold text-xs"
                                        placeholder="e.g. HDFC Bank, ICICI Bank, State Bank of India"
                                    />
                                    {fieldErrors.bank_name && <p className="text-xs text-rose-500 mt-1">{fieldErrors.bank_name}</p>}
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <Label className="text-xs font-bold text-slate-700">
                                            Bank Account Number <span className="text-rose-500">*</span>
                                        </Label>
                                        <Input
                                            value={formData.bank_account_number}
                                            onChange={(e) => updateField("bank_account_number", e.target.value)}
                                            className="h-11 rounded-xl bg-slate-50 mt-1 font-mono font-bold text-xs"
                                            placeholder="Your salary account number"
                                        />
                                        {fieldErrors.bank_account_number && (
                                            <p className="text-xs text-rose-500 mt-1">{fieldErrors.bank_account_number}</p>
                                        )}
                                    </div>

                                    <div>
                                        <Label className="text-xs font-bold text-slate-700">
                                            Confirm Account Number <span className="text-rose-500">*</span>
                                        </Label>
                                        <Input
                                            value={formData.confirm_account_number}
                                            onChange={(e) => updateField("confirm_account_number", e.target.value)}
                                            className="h-11 rounded-xl bg-slate-50 mt-1 font-mono font-bold text-xs"
                                            placeholder="Re-enter account number"
                                        />
                                        {fieldErrors.confirm_account_number && (
                                            <p className="text-xs text-rose-500 mt-1">{fieldErrors.confirm_account_number}</p>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <Label className="text-xs font-bold text-slate-700">
                                        Bank IFSC Code <span className="text-rose-500">*</span>
                                    </Label>
                                    <Input
                                        value={formData.ifsc_code}
                                        onChange={(e) => updateField("ifsc_code", e.target.value.toUpperCase())}
                                        className="h-11 rounded-xl bg-slate-50 mt-1 font-mono uppercase font-bold text-xs"
                                        placeholder="e.g. HDFC0001234 (11 characters)"
                                        maxLength={11}
                                    />
                                    {fieldErrors.ifsc_code && <p className="text-xs text-rose-500 mt-1">{fieldErrors.ifsc_code}</p>}
                                </div>
                            </div>

                            {/* ── Section 2: Statutory Information ── */}
                            <div className="space-y-4 p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
                                <span className="text-[11px] font-black uppercase tracking-wider text-blue-700 flex items-center gap-1.5">
                                    <ShieldCheck className="h-3.5 w-3.5 text-blue-600" /> Section 2: Terms & Conditions / Statutory Information
                                </span>

                                {/* PF Configuration */}
                                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-black text-slate-900">Provident Fund (PF) Setup</span>
                                        <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                                            <span>PF Applicable</span>
                                            <input
                                                type="checkbox"
                                                checked={formData.pf_applicable}
                                                onChange={(e) => updateField("pf_applicable", e.target.checked)}
                                                className="h-4 w-4 rounded text-blue-600"
                                            />
                                        </label>
                                    </div>

                                    {formData.pf_applicable && (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200/60">
                                            <div>
                                                <Label className="text-[11px] font-bold text-slate-700">
                                                    PF Ceiling Limit
                                                </Label>
                                                <select
                                                    value={formData.pf_ceiling ? "yes" : "no"}
                                                    onChange={(e) => updateField("pf_ceiling", e.target.value === "yes")}
                                                    className="w-full h-10 rounded-xl bg-white border border-slate-200 px-3 text-xs font-bold text-slate-800 mt-1 outline-none"
                                                >
                                                    <option value="yes">Yes (Capped at ₹15,000 ceiling)</option>
                                                    <option value="no">No (Calculated on Actual Basic)</option>
                                                </select>
                                            </div>

                                            <div>
                                                <Label className="text-[11px] font-bold text-slate-700">
                                                    PF Employment Date
                                                </Label>
                                                <Input
                                                    type="date"
                                                    value={formData.pf_employment_date}
                                                    onChange={(e) => updateField("pf_employment_date", e.target.value)}
                                                    className="h-10 rounded-xl bg-white mt-1 font-bold text-xs"
                                                />
                                            </div>

                                            <div>
                                                <Label className="text-[11px] font-bold text-slate-700">
                                                    Existing PF Number (Optional)
                                                </Label>
                                                <Input
                                                    value={formData.pf_number}
                                                    onChange={(e) => updateField("pf_number", e.target.value.toUpperCase())}
                                                    className="h-10 rounded-xl bg-white mt-1 font-mono uppercase font-bold text-xs"
                                                    placeholder="e.g. MH/BAN/0012345/000/0000001"
                                                />
                                            </div>

                                            <div>
                                                <Label className="text-[11px] font-bold text-slate-700">
                                                    Universal Account Number (UAN)
                                                </Label>
                                                <Input
                                                    value={formData.uan}
                                                    onChange={(e) => updateField("uan", e.target.value)}
                                                    className="h-10 rounded-xl bg-white mt-1 font-mono font-bold text-xs"
                                                    placeholder="12-digit UAN if previously allocated"
                                                    maxLength={12}
                                                />
                                                {fieldErrors.uan && <p className="text-[10px] text-rose-500 mt-1">{fieldErrors.uan}</p>}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* ESIC Configuration (Replaces incorrectly labelled LIC field) */}
                                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <span className="text-xs font-black text-slate-900 block">
                                                Employee State Insurance (ESIC) Setup
                                            </span>
                                            <span className="text-[10px] text-slate-400">
                                                Replaces legacy statutory life policy field as confirmed.
                                            </span>
                                        </div>
                                        <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                                            <span>ESIC Applicable</span>
                                            <input
                                                type="checkbox"
                                                checked={formData.esic_applicable}
                                                onChange={(e) => updateField("esic_applicable", e.target.checked)}
                                                className="h-4 w-4 rounded text-blue-600"
                                            />
                                        </label>
                                    </div>

                                    {formData.esic_applicable && (
                                        <div className="pt-2 border-t border-slate-200/60">
                                            <Label className="text-[11px] font-bold text-slate-700">
                                                ESIC Number / IP Insurance Number
                                            </Label>
                                            <Input
                                                value={formData.esic_number}
                                                onChange={(e) => updateField("esic_number", e.target.value)}
                                                className="h-10 rounded-xl bg-white mt-1 font-mono font-bold text-xs"
                                                placeholder="17-digit ESIC Insured Person (IP) number"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ═════════════════════════════════════════════════════════ */}
                    {/* STEP 3 (PAGE D): MANDATORY DOCUMENT UPLOADS */}
                    {/* ═════════════════════════════════════════════════════════ */}
                    {currentStep === 3 && (
                        <div className="space-y-6">
                            <div className="border-b border-slate-100 pb-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="h-8 w-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                                            <Upload className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <h2 className="text-base font-black text-slate-900">
                                                Page 4: Mandatory Document Uploads
                                            </h2>
                                            <p className="text-xs text-slate-500">
                                                Attach clear scanned copies or photos (PDF, PNG, JPG up to 10MB each).
                                            </p>
                                        </div>
                                    </div>
                                    <Badge className="bg-slate-900 text-white font-mono text-xs">
                                        {Object.keys(uploadedDocs).length} / {DOCUMENT_DEFINITIONS.length} Attached
                                    </Badge>
                                </div>
                            </div>

                            {fieldErrors.docs && (
                                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
                                    <AlertCircle className="h-4 w-4 shrink-0" />
                                    <span>{fieldErrors.docs}</span>
                                </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                {DOCUMENT_DEFINITIONS.map((doc) => {
                                    const uploaded = uploadedDocs[doc.id];
                                    const isMandatory = doc.mandatory;

                                    return (
                                        <div
                                            key={doc.id}
                                            className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                                                uploaded
                                                    ? "border-emerald-300 bg-emerald-50/40 shadow-xs"
                                                    : "border-slate-200 bg-slate-50/70 hover:bg-slate-100/60"
                                            }`}
                                        >
                                            <div className="space-y-1">
                                                <div className="flex items-start justify-between gap-2">
                                                    <h4 className="font-black text-xs text-slate-900 flex items-center gap-1">
                                                        <span>{doc.title}</span>
                                                        {isMandatory && <span className="text-rose-500 font-bold">*</span>}
                                                    </h4>
                                                    {uploaded ? (
                                                        <Badge className="bg-emerald-600 text-white text-[9px] font-bold px-1.5 py-0.5 shrink-0">
                                                            Uploaded
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline" className={`text-[9px] shrink-0 ${isMandatory ? "border-rose-300 text-rose-600 bg-rose-50/40 font-bold" : "text-slate-400"}`}>
                                                            {isMandatory ? "Required" : "Optional"}
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className="text-[10px] text-slate-500 leading-relaxed">
                                                    {doc.description}
                                                </p>
                                            </div>

                                            {uploaded ? (
                                                <div className="mt-3 pt-2.5 border-t border-emerald-200/80 flex items-center justify-between text-xs">
                                                    <div className="min-w-0 pr-2">
                                                        <span className="font-bold text-slate-800 text-[11px] truncate block max-w-[140px]">
                                                            {uploaded.file.name}
                                                        </span>
                                                        <span className="text-[9px] text-slate-400 font-mono">
                                                            {(uploaded.file.size / 1024).toFixed(0)} KB
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-1 shrink-0">
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() =>
                                                                setPreviewDocModal({
                                                                    id: doc.id,
                                                                    title: doc.title,
                                                                    dataUrl: uploaded.dataUrl,
                                                                    fileType: uploaded.file.type,
                                                                    fileName: uploaded.file.name,
                                                                })
                                                            }
                                                            className="h-7 px-2 text-[10px] font-bold bg-white rounded-lg border-emerald-300 text-emerald-800"
                                                        >
                                                            <Eye className="h-3 w-3 mr-1" /> View
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => removeDoc(doc.id)}
                                                            className="h-7 w-7 p-0 rounded-lg text-rose-600 hover:bg-rose-50"
                                                        >
                                                            <X className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleFileSelect(doc.id)}
                                                    className="w-full mt-3 h-8 text-[10px] font-bold rounded-xl border-dashed border-slate-300 hover:border-slate-400 bg-white"
                                                >
                                                    <Upload className="h-3 w-3 mr-1" /> Choose File
                                                </Button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* ═════════════════════════════════════════════════════════ */}
                    {/* STEP 4 (PAGE E): REVIEW & SUBMISSION */}
                    {/* ═════════════════════════════════════════════════════════ */}
                    {currentStep === 4 && (
                        <div className="space-y-6">
                            <div className="border-b border-slate-100 pb-4">
                                <div className="flex items-center gap-2">
                                    <div className="h-8 w-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                                        <FileCheck className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <h2 className="text-base font-black text-slate-900">
                                            Page 5: Review & Submission
                                        </h2>
                                        <p className="text-xs text-slate-500">
                                            Please verify all submitted onboarding particulars before sending to HR.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Section 1: Personal Details Preview */}
                            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5 text-xs">
                                <div className="flex items-center justify-between pb-1 border-b border-slate-200/60">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                        <User className="h-3.5 w-3.5 text-slate-600" /> A. Personal Information
                                    </span>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setCurrentStep(0)}
                                        className="h-6 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 p-0"
                                    >
                                        Edit
                                    </Button>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <div>
                                        <span className="text-slate-400 font-bold uppercase text-[9px] block">Full Name (as per Aadhaar)</span>
                                        <span className="font-black text-slate-900">{formData.name}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 font-bold uppercase text-[9px] block">DOB / DOJ / Gender</span>
                                        <span className="font-bold text-slate-800">
                                            {formData.dob} • DOJ: {formData.doj} • {formData.gender.toUpperCase()}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 font-bold uppercase text-[9px] block">Marital Status & Guardian</span>
                                        <span className="font-bold text-slate-800">
                                            {formData.marital_status.toUpperCase()} • Guardian: {formData.father_or_husband_name}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 font-bold uppercase text-[9px] block">Mobile & Registered Email</span>
                                        <span className="font-bold text-slate-800">{formData.phone} • {invitation?.email}</span>
                                    </div>
                                    <div className="sm:col-span-2">
                                        <span className="text-slate-400 font-bold uppercase text-[9px] block">Address (as per Aadhaar)</span>
                                        <span className="font-medium text-slate-800">{formData.address}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 font-bold uppercase text-[9px] block">Aadhaar & PAN</span>
                                        <span className="font-bold text-slate-800">
                                            UID: {formData.aadhaar} • PAN: {formData.pan || "N/A (Optional)"}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 font-bold uppercase text-[9px] block">Emergency Contact</span>
                                        <span className="font-bold text-slate-800">
                                            {formData.emergency_contact_name} ({formData.emergency_contact_relation}) • {formData.emergency_contact_phone}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Section 2: Employment Details Preview */}
                            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5 text-xs">
                                <div className="flex items-center justify-between pb-1 border-b border-slate-200/60">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                        <Briefcase className="h-3.5 w-3.5 text-indigo-600" /> B. Employment Information
                                    </span>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setCurrentStep(1)}
                                        className="h-6 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 p-0"
                                    >
                                        Edit
                                    </Button>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <div>
                                        <span className="text-slate-400 font-bold uppercase text-[9px] block">Working Location</span>
                                        <span className="font-black text-slate-900">{formData.working_location}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 font-bold uppercase text-[9px] block">Designation</span>
                                        <span className="font-black text-slate-900">{formData.designation}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 font-bold uppercase text-[9px] block">Daily Shift Timings</span>
                                        <span className="font-bold text-slate-800">
                                            {formData.shift_start_time} to {formData.shift_end_time}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 font-bold uppercase text-[9px] block">Rotational Shift Policy</span>
                                        <Badge className={`text-[9px] font-bold ${formData.is_rotational_shift ? "bg-amber-100 text-amber-800" : "bg-slate-200 text-slate-700"}`}>
                                            {formData.is_rotational_shift ? "Yes (Rotational Shift)" : "Standard Shift"}
                                        </Badge>
                                    </div>
                                </div>
                            </div>

                            {/* Section 3: Salary & Statutory Details Preview */}
                            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5 text-xs">
                                <div className="flex items-center justify-between pb-1 border-b border-slate-200/60">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                        <CreditCard className="h-3.5 w-3.5 text-emerald-600" /> C. Salary & Statutory Details
                                    </span>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setCurrentStep(2)}
                                        className="h-6 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 p-0"
                                    >
                                        Edit
                                    </Button>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <div>
                                        <span className="text-slate-400 font-bold uppercase text-[9px] block">Monthly CTC & Mode</span>
                                        <span className="font-black text-slate-900">
                                            {formData.fixed_gross ? `₹${Number(formData.fixed_gross).toLocaleString("en-IN")}` : "As per appointment"} • {formData.payment_mode}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 font-bold uppercase text-[9px] block">Bank Name & A/C</span>
                                        <span className="font-bold text-slate-800">
                                            {formData.bank_name} • A/C: {formData.bank_account_number}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 font-bold uppercase text-[9px] block">IFSC Code</span>
                                        <span className="font-mono font-bold text-slate-800">{formData.ifsc_code}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 font-bold uppercase text-[9px] block">PF & Ceiling</span>
                                        <span className="font-bold text-slate-800">
                                            {formData.pf_applicable ? `Yes (${formData.pf_ceiling ? "₹15k Ceiling Cap" : "Actual Basic"})` : "Not Applicable"}
                                            {formData.uan && ` • UAN: ${formData.uan}`}
                                        </span>
                                    </div>
                                    <div className="sm:col-span-2">
                                        <span className="text-slate-400 font-bold uppercase text-[9px] block">ESIC Coverage</span>
                                        <span className="font-bold text-slate-800">
                                            {formData.esic_applicable ? `Applicable • IP No: ${formData.esic_number || "To be allocated"}` : "Not Applicable"}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Section 4: Document Summary Preview */}
                            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5 text-xs">
                                <div className="flex items-center justify-between pb-1 border-b border-slate-200/60">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                        <FileText className="h-3.5 w-3.5 text-slate-600" /> D. Attached Verification Documents ({Object.keys(uploadedDocs).length} Files)
                                    </span>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setCurrentStep(3)}
                                        className="h-6 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 p-0"
                                    >
                                        Edit
                                    </Button>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {DOCUMENT_DEFINITIONS.map((def) => {
                                        const up = uploadedDocs[def.id];
                                        return (
                                            <div
                                                key={def.id}
                                                className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200 text-[11px]"
                                            >
                                                <span className="font-bold text-slate-800 truncate pr-2">
                                                    {def.title.split(". ")[1]}
                                                </span>
                                                {up ? (
                                                    <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-bold shrink-0">
                                                        Attached
                                                    </Badge>
                                                ) : (
                                                    <span className="text-[9px] text-slate-400 italic shrink-0">
                                                        Not attached
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Legal Declaration */}
                            <label className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50/80 border border-amber-200/90 cursor-pointer text-amber-950 text-xs">
                                <input
                                    type="checkbox"
                                    checked={declarationAccepted}
                                    onChange={(e) => setDeclarationAccepted(e.target.checked)}
                                    className="mt-0.5 h-4 w-4 rounded text-amber-600 focus:ring-amber-500"
                                />
                                <div className="space-y-1">
                                    <span className="font-black text-amber-900 block">
                                        Employee Self-Declaration & Consent
                                    </span>
                                    <p className="text-[11px] text-amber-800 leading-relaxed">
                                        I hereby declare that all particulars, documents, and statements furnished above are true, complete, and authentic to the best of my knowledge and belief. I agree to produce original verification documents upon request by the Company.
                                    </p>
                                </div>
                            </label>
                        </div>
                    )}

                    {/* Step Navigation Bar */}
                    <div className="flex items-center justify-between pt-6 border-t border-slate-100 mt-6">
                        {currentStep > 0 ? (
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setCurrentStep((s) => s - 1)}
                                className="h-11 rounded-xl text-xs font-bold px-5"
                            >
                                <ArrowLeft className="h-4 w-4 mr-1" /> Previous Step
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
                                disabled={submitting || !declarationAccepted}
                                className="bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 font-black uppercase text-[10px] tracking-widest px-8 h-11 rounded-xl shadow-lg flex items-center gap-2"
                            >
                                {submitting ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" /> Submitting Dossier...
                                    </>
                                ) : (
                                    <>
                                        <Check className="h-4 w-4 stroke-[3]" /> Submit All Details to HR
                                    </>
                                )}
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
