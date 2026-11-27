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
    ShieldAlert,
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
    Landmark,
    BadgeHelp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://hrmsbackend-z7do.onrender.com/api/v1";

const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const AADHAAR_RE = /^\d{12}$/;
const PHONE_RE = /^(\+91[-\s]?)?[6-9]\d{9}$/;
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;

// Verification & Compliance Documents (Req 2.3 D + 6-Month Statement & Resume)
const DOCUMENT_DEFINITIONS = [
    {
        id: "aadhaar_card",
        title: "1. Aadhaar Card Front & Back (Combined)",
        description: "Front & back copy showing complete 12-digit UID number and residential address.",
        mandatory: true,
        accept: ".pdf,.png,.jpg,.jpeg",
    },
    {
        id: "pan_card",
        title: "2. PAN Card",
        description: "Permanent Account Number card copy with clear photograph and signature.",
        mandatory: true,
        accept: ".pdf,.png,.jpg,.jpeg",
    },
    {
        id: "photo",
        title: "3. Passport Size Photograph",
        description: "Recent formal passport-size photo with plain white/light background.",
        mandatory: true,
        accept: ".png,.jpg,.jpeg",
    },
    {
        id: "passbook_cheque",
        title: "4. Cancelled Cheque / Passbook Copy",
        description: "Clear copy displaying your account holder name, account number & IFSC.",
        mandatory: true,
        accept: ".pdf,.png,.jpg,.jpeg",
    },
    {
        id: "education_certificate",
        title: "5. Highest Educational Qualification Certificate",
        description: "Degree, diploma, or highest qualification certificate / marksheet.",
        mandatory: true,
        accept: ".pdf,.png,.jpg,.jpeg",
    },
    {
        id: "relieving_letter",
        title: "6. Previous Employer Relieving Letter / Experience Letter",
        description: "Official relieving / experience certificate from your last organization (Optional for freshers).",
        mandatory: false,
        accept: ".pdf,.png,.jpg,.jpeg",
    },
    {
        id: "salary_slips",
        title: "7. Last 6 Months' Salary Slips",
        description: "Official payslips for the previous 6 consecutive months showing earnings & deductions (Optional for freshers).",
        mandatory: false,
        accept: ".pdf,.png,.jpg,.jpeg",
    },
    {
        id: "bank_statement",
        title: "8. Last 6 Months' Bank Statement",
        description: "Official bank statement for the last 6 months showing salary credits / account transactions (Optional for freshers).",
        mandatory: false,
        accept: ".pdf,.png,.jpg,.jpeg",
    },
    {
        id: "signed_offer_letter",
        title: "9. Signed Offer Letter / Appointment Letter Acceptance",
        description: "Signed & accepted copy of the company offer letter or appointment letter.",
        mandatory: true,
        accept: ".pdf,.png,.jpg,.jpeg",
    },
    {
        id: "resume",
        title: "10. Updated Resume / Curriculum Vitae (CV)",
        description: "Your latest professional resume or CV (Optional).",
        mandatory: false,
        accept: ".pdf,.doc,.docx,.png,.jpg,.jpeg",
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

        // Section B: Bank Details (Candidate's Salary Credit Account)
        account_holder_name: "", // Account Holder Name (*)
        bank_name: "", // Bank Name (*)
        bank_account_number: "", // Bank Account Number (*)
        confirm_account_number: "", // Confirm Account Number (*)
        ifsc_code: "", // IFSC Code (*)
        payment_mode: "Bank Transfer", // Payment Mode

        // Section C: Statutory Compliance & Declarations (Candidate Declarations)
        has_existing_pf: false, // Existing EPFO member?
        uan: "", // 12-digit UAN if previously allocated
        prev_pf_number: "", // Previous PF Member ID (optional)
        prev_exit_date: "", // Date of Exit from previous organization (optional)

        has_existing_esic: false, // Existing ESIC IP?
        esic_number: "", // 10-digit / 17-digit ESIC IP number
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
                    name: inv.candidate_name || prev.name,
                    account_holder_name: inv.candidate_name || prev.name,
                    phone: inv.phone || prev.phone,
                    working_location: inv.office?.name || (inv.office?.address ? `${inv.office.name} - ${inv.office.address}` : "Indore Logistics Hub"),
                    designation: inv.designation || "Executive",
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

    const processFileForDoc = async (docId: string, file: File) => {
        if (!file || !docId) return;
        if (file.size > 10 * 1024 * 1024) {
            alert("File size exceeds 10MB limit. Please upload a smaller file.");
            return;
        }
        try {
            const dataUrl = await readFileAsDataUrl(file);
            setUploadedDocs((prev) => ({
                ...prev,
                [docId]: { file, dataUrl },
            }));
            // Clear any doc error
            setFieldErrors((prev) => {
                const n = { ...prev };
                delete n.docs;
                return n;
            });
        } catch (readErr) {
            console.error("Could not read file", readErr);
            alert("Could not read file. Please try again.");
        }
    };

    const onFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && activeDocType) {
            await processFileForDoc(activeDocType, file);
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

    // Fill all fields with realistic dummy data for rapid testing & UAT
    const fillDummyData = () => {
        const rand = Math.floor(1000 + Math.random() * 9000);
        const randLetter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
        setFormData((prev) => ({
            ...prev,
            name: prev.name || "Rahul Sharma",
            dob: "1998-05-20",
            gender: "male",
            marital_status: "unmarried",
            father_or_husband_name: "Omprakash Sharma",
            phone: prev.phone || `987654${rand}`,
            emergency_contact_name: "Priya Sharma",
            emergency_contact_phone: "9876543211",
            emergency_contact_relation: "Spouse",
            address: "12/3, MG Road, Vijay Nagar, Indore, MP 452010",
            aadhaar: `12345678${rand}`,
            pan: `ABCDE${rand}${randLetter}`,
            account_holder_name: prev.name || "Rahul Sharma",
            bank_name: "HDFC Bank",
            bank_account_number: "50100123456789",
            confirm_account_number: "50100123456789",
            ifsc_code: "HDFC0001234",
            payment_mode: "Bank Transfer",
            has_existing_pf: true,
            uan: `10123456${rand}`,
            prev_pf_number: `MH/BAN/00${rand}/000/0000001`,
            prev_exit_date: "2026-10-31",
            has_existing_esic: true,
            esic_number: `312345${rand}`,
        }));

        setFieldErrors({});

        // Pre-populate mock dummy files for all 8 SOW documents so user can test end-to-end effortlessly
        const mockSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="100%" height="100%" fill="%23f1f5f9"/><text x="50%" y="50%" font-family="sans-serif" font-size="16" font-weight="bold" fill="%23334155" text-anchor="middle">Mock Verification Document</text></svg>`;

        const dummyDocs: Record<string, { file: File; dataUrl: string }> = {};
        DOCUMENT_DEFINITIONS.forEach((doc, idx) => {
            const ext = doc.id === "photo" ? "png" : "pdf";
            const mime = doc.id === "photo" ? "image/png" : "application/pdf";
            const mockBlob = new Blob([`Mock verification document content for ${doc.title}`], { type: mime });
            const mockFile = new File([mockBlob], `${doc.id}_mock_document_${idx + 1}.${ext}`, { type: mime });
            dummyDocs[doc.id] = {
                file: mockFile,
                dataUrl: mockSvg,
            };
        });
        setUploadedDocs(dummyDocs);
        setDeclarationAccepted(true);
    };

    // Validation per step
    const validateStep = (step: number): boolean => {
        const errors: Record<string, string> = {};

        // ── STEP 0: Personal Information (Page 1) ──
        if (step === 0) {
            if (!formData.name.trim()) errors.name = "Full name as per Aadhaar is required";
            if (!formData.dob) errors.dob = "Date of birth is required";
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

        // ── STEP 1: Bank Details & Statutory Declarations (Page 2) ──
        if (step === 1) {
            // Section 1: Bank Details
            if (!formData.account_holder_name.trim()) errors.account_holder_name = "Account holder name as per bank record is required";
            if (!formData.bank_name.trim()) errors.bank_name = "Bank name is required";
            if (!formData.bank_account_number.trim()) errors.bank_account_number = "Bank account number is required";
            if (formData.bank_account_number !== formData.confirm_account_number) {
                errors.confirm_account_number = "Bank account numbers do not match";
            }
            const cleanIfsc = formData.ifsc_code.toUpperCase().replace(/\s/g, "");
            if (!cleanIfsc || !IFSC_RE.test(cleanIfsc)) {
                errors.ifsc_code = "Valid 11-character IFSC code is required (e.g. HDFC0001234)";
            }

            // Section 2: Statutory EPFO & ESIC Declarations
            if (formData.has_existing_pf) {
                if (!formData.uan.trim() || !/^\d{12}$/.test(formData.uan.trim())) {
                    errors.uan = "Valid 12-digit Universal Account Number (UAN) is required for existing PF members";
                }
            }
            // ESIC IP number is completely optional
        }

        // ── STEP 2: Mandatory Document Uploads (Page 3) ──
        if (step === 2) {
            if (!uploadedDocs.aadhaar_card) {
                errors.docs = "Please upload your Aadhaar Card (mandatory verification document)";
            } else if (!uploadedDocs.pan_card) {
                errors.docs = "Please upload your PAN Card";
            } else if (!uploadedDocs.photo) {
                errors.docs = "Please upload your recent Passport Size Photograph";
            } else if (!uploadedDocs.passbook_cheque && !uploadedDocs.bank_proof) {
                errors.docs = "Please upload your Cancelled Cheque / Bank Passbook Copy (mandatory for salary credit)";
            } else if (!uploadedDocs.education_certificate) {
                errors.docs = "Please upload your Highest Educational Qualification Certificate";
            } else if (!uploadedDocs.signed_offer_letter) {
                errors.docs = "Please upload your Signed Offer Letter / Appointment Letter Acceptance";
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

                // Salary & Bank Details
                account_holder_name: formData.account_holder_name.trim() || formData.name.trim(),
                bank_name: formData.bank_name.trim(),
                bank_account_number: formData.bank_account_number.trim(),
                ifsc_code: formData.ifsc_code.trim().toUpperCase(),
                payment_mode: "Bank Transfer",

                // Statutory Information (Candidate Declarations)
                has_existing_pf: Boolean(formData.has_existing_pf),
                pf_applicable: true,
                pf_ceiling: true,
                pf_employment_date: formData.has_existing_pf ? (formData.prev_exit_date || null) : null,
                pf_number: formData.has_existing_pf ? (formData.prev_pf_number.trim().toUpperCase() || null) : null,
                uan: formData.has_existing_pf ? formData.uan.trim() : null,

                has_existing_esic: Boolean(formData.has_existing_esic),
                esic_applicable: Boolean(formData.has_existing_esic),
                esic_number: formData.has_existing_esic ? formData.esic_number.trim().toUpperCase() : null,

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
            alert(err.message || "An unexpected error occurred during submission. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
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
                        Your complete onboarding profile, bank credentials, statutory declarations, and verification documents have been securely submitted to our Human Resources department.
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
                            <span className="text-slate-400 font-bold uppercase text-[10px]">Company Entity</span>
                            <span className="font-bold text-slate-800">{invitation?.company?.name || "Apaar Logistics"}</span>
                        </div>
                        <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                            <span className="text-slate-400 font-bold uppercase text-[10px]">Salary Bank A/C</span>
                            <span className="font-mono font-bold text-slate-800">
                                {formData.bank_name} (••••{formData.bank_account_number.slice(-4)})
                            </span>
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
        { label: "Personal Info", desc: "Aadhaar, contacts & personal data" },
        { label: "Bank & Statutory", desc: "Salary account & statutory declarations" },
        { label: "Documents", desc: "Verification documents & resume" },
        { label: "Review & Submit", desc: "Final declaration & submission" },
    ];

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-50 py-8 px-4 sm:px-6">
            <div className="max-w-3xl mx-auto space-y-6">
                {/* Brand Header */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-lg shadow-md">
                            A
                        </div>
                        <div>
                            <h1 className="text-lg font-black text-slate-900 tracking-tight">
                                {invitation?.company?.name || "Apaar Logistics & Cold Supply Chain Pvt Ltd"}
                            </h1>
                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                Official Employee Self-Onboarding Portal
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={fillDummyData}
                            className="h-8 px-3 rounded-xl border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 font-bold text-xs shadow-xs"
                        >
                            <Sparkles className="h-3.5 w-3.5 mr-1 text-amber-600" /> Fill Dummy
                        </Button>
                        <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold uppercase px-2.5 py-1">
                            Secure Session
                        </Badge>
                    </div>
                </div>

                {/* Stepper Header */}
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80">
                    <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
                        {steps.map((step, idx) => {
                            const isDone = currentStep > idx;
                            const isCurrent = currentStep === idx;

                            return (
                                <button
                                    key={idx}
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
                    {/* Hidden fallback global file input */}
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={onFilePicked}
                        className="hidden"
                        accept=".pdf,.png,.jpg,.jpeg"
                    />
                    {/* ════════════════════════════════════════════════════════ */}
                    {/* STEP 0 (PAGE A): PERSONAL INFORMATION */}
                    {/* ════════════════════════════════════════════════════════ */}
                    {currentStep === 0 && (
                        <div className="space-y-6">
                            <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
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
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={fillDummyData}
                                    className="h-8 px-3 rounded-xl border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 font-bold text-xs shadow-xs shrink-0"
                                >
                                    <Sparkles className="h-3.5 w-3.5 mr-1 text-amber-600" /> Fill Dummy
                                </Button>
                            </div>

                            <div className="space-y-4">
                                {/* 1. Full Legal Name as per Aadhaar */}
                                <div>
                                    <Label className="text-xs font-bold text-slate-700">
                                        Full Name, as per Aadhaar <span className="text-rose-500">*</span>
                                    </Label>
                                    <Input
                                        value={formData.name}
                                        onChange={(e) => {
                                            updateField("name", e.target.value);
                                            if (!formData.account_holder_name || formData.account_holder_name === formData.name) {
                                                updateField("account_holder_name", e.target.value);
                                            }
                                        }}
                                        className="h-11 rounded-xl bg-slate-50 mt-1 font-bold text-xs"
                                        placeholder="Full legal name exactly as printed on your Aadhaar Card"
                                    />
                                    {fieldErrors.name && <p className="text-xs text-rose-500 mt-1">{fieldErrors.name}</p>}
                                </div>

                                {/* 2. DOB & Gender */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                                            className="h-11 rounded-xl bg-slate-50 mt-1 font-mono font-bold text-xs"
                                            placeholder="10-digit mobile number"
                                            maxLength={10}
                                        />
                                        {fieldErrors.phone && <p className="text-xs text-rose-500 mt-1">{fieldErrors.phone}</p>}
                                    </div>

                                    <div>
                                        <div className="flex items-center justify-between">
                                            <Label className="text-xs font-bold text-slate-700">
                                                Registered Email Address
                                            </Label>
                                            <Badge variant="outline" className="text-[9px] text-emerald-600 border-emerald-200 bg-emerald-50">
                                                Verified
                                            </Badge>
                                        </div>
                                        <Input
                                            disabled
                                            value={invitation?.email || ""}
                                            className="h-11 rounded-xl bg-slate-100 border-slate-200 mt-1 font-bold text-xs text-slate-500 cursor-not-allowed"
                                        />
                                    </div>
                                </div>

                                {/* 5. Emergency Contact Details */}
                                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-3">
                                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                                        <Phone className="h-3.5 w-3.5 text-indigo-600" /> Emergency Contact Particulars
                                    </span>

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <div>
                                            <Label className="text-[11px] font-bold text-slate-700">
                                                Contact Person Name <span className="text-rose-500">*</span>
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
                                                Emergency Phone <span className="text-rose-500">*</span>
                                            </Label>
                                            <Input
                                                value={formData.emergency_contact_phone}
                                                onChange={(e) => updateField("emergency_contact_phone", e.target.value)}
                                                className="h-10 rounded-xl bg-white mt-1 font-bold text-xs"
                                                placeholder="10-digit emergency number"
                                                maxLength={10}
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
                                            onChange={(e) => updateField("aadhaar", e.target.value.replace(/\D/g, ""))}
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
                                            placeholder="e.g. ABCDE1234F"
                                            maxLength={10}
                                        />
                                        {fieldErrors.pan && <p className="text-xs text-rose-500 mt-1">{fieldErrors.pan}</p>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ════════════════════════════════════════════════════════ */}
                    {/* STEP 1 (PAGE B): BANK DETAILS & STATUTORY DECLARATIONS */}
                    {/* ════════════════════════════════════════════════════════ */}
                    {currentStep === 1 && (
                        <div className="space-y-6">
                            <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="h-8 w-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                                        <Landmark className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <h2 className="text-base font-black text-slate-900">
                                            Page 2: Bank Details & Statutory Declarations
                                        </h2>
                                        <p className="text-xs text-slate-500">
                                            Banking credentials for salary credit and statutory compliance declarations.
                                        </p>
                                    </div>
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={fillDummyData}
                                    className="h-8 px-3 rounded-xl border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 font-bold text-xs shadow-xs shrink-0"
                                >
                                    <Sparkles className="h-3.5 w-3.5 mr-1 text-amber-600" /> Fill Dummy
                                </Button>
                            </div>

                            {/* ── Compensation Overview (Locked / Read-Only Offer Confirmation) ── */}
                            {Number(invitation?.fixed_gross) > 0 ? (
                                <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                                    <div className="space-y-0.5">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                                            <Sparkles className="h-3.5 w-3.5 text-emerald-600" /> Offered Monthly Gross Compensation
                                        </span>
                                        <p className="text-2xl font-black text-slate-900">
                                            ₹{Number(invitation.fixed_gross).toLocaleString("en-IN")}{" "}
                                            <span className="text-xs font-bold text-slate-500">/ month</span>
                                        </p>
                                        <p className="text-[11px] text-slate-600">
                                            As specified in your approved employment offer. Detailed component breakdown will be itemized in your Appointment Letter.
                                        </p>
                                    </div>
                                    <Badge className="bg-emerald-600 text-white font-bold text-[10px] uppercase tracking-wider px-3 py-1 self-start sm:self-center shrink-0">
                                        HR Pre-Approved
                                    </Badge>
                                </div>
                            ) : (
                                <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                                    <div className="space-y-0.5">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-indigo-900 flex items-center gap-1.5">
                                            <Info className="h-3.5 w-3.5 text-indigo-600" /> Compensation Structure
                                        </span>
                                        <p className="text-base font-black text-slate-900">
                                            As Authorized in Approved Offer Letter
                                        </p>
                                        <p className="text-[11px] text-slate-600">
                                            Your payroll structure will be finalized by HR upon verification of your previous salary proofs and relieving documents.
                                        </p>
                                    </div>
                                    <Badge className="bg-indigo-600 text-white font-bold text-[10px] uppercase tracking-wider px-3 py-1 self-start sm:self-center shrink-0">
                                        Pre-Authorized
                                    </Badge>
                                </div>
                            )}

                            {/* ── Section 1: Salary & Bank Details ── */}
                            <div className="space-y-4 p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-black uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                                        <CreditCard className="h-3.5 w-3.5 text-emerald-600" /> Section 1: Salary Credit Bank Account Details
                                    </span>
                                    <Badge variant="outline" className="text-[9px] text-emerald-700 border-emerald-300 bg-emerald-50">
                                        Direct Bank Transfer (NEFT/RTGS)
                                    </Badge>
                                </div>

                                {/* Bank Details Disclaimer Banner */}
                                <div className="p-4 rounded-xl bg-amber-50/90 border border-amber-200/90 text-amber-950 space-y-2.5">
                                    <div className="flex items-center gap-2">
                                        <div className="h-6 w-6 rounded-lg bg-amber-200/90 text-amber-900 flex items-center justify-center shrink-0 font-black">
                                            <ShieldAlert className="h-4 w-4" />
                                        </div>
                                        <h4 className="text-xs font-black uppercase tracking-wider text-amber-950">
                                            Important Disclaimer • Please Fill Bank Details With Utmost Care
                                        </h4>
                                    </div>
                                    <p className="text-[11px] leading-relaxed text-amber-950/90 font-medium">
                                        Your monthly salary, expense reimbursements, and bonuses will be credited <strong>strictly to this bank account</strong> via direct automated transfer (NEFT/RTGS/IMPS). Any error or mismatch in the Account Number or IFSC Code will result in salary payment failure, bank bounce, or extensive disbursement delays.
                                    </p>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[10px]">
                                        <div className="flex items-start gap-1.5 bg-white/80 p-2.5 rounded-lg border border-amber-200/70 font-semibold text-amber-950">
                                            <CheckCircle2 className="h-3.5 w-3.5 text-amber-700 shrink-0 mt-0.5" />
                                            <span><strong>Name Match:</strong> Account name must exactly match your name on bank passbook & Aadhaar.</span>
                                        </div>
                                        <div className="flex items-start gap-1.5 bg-white/80 p-2.5 rounded-lg border border-amber-200/70 font-semibold text-amber-950">
                                            <CheckCircle2 className="h-3.5 w-3.5 text-amber-700 shrink-0 mt-0.5" />
                                            <span><strong>Active Account:</strong> Must be an active savings or salary account without credit freeze.</span>
                                        </div>
                                        <div className="flex items-start gap-1.5 bg-white/80 p-2.5 rounded-lg border border-amber-200/70 font-semibold text-amber-950">
                                            <CheckCircle2 className="h-3.5 w-3.5 text-amber-700 shrink-0 mt-0.5" />
                                            <span><strong>Passbook Proof:</strong> Uploaded Cheque / Passbook copy in Step 3 must reflect identical numbers.</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <Label className="text-xs font-bold text-slate-700">
                                            Account Holder Name <span className="text-rose-500">*</span>
                                        </Label>
                                        <Input
                                            value={formData.account_holder_name}
                                            onChange={(e) => updateField("account_holder_name", e.target.value)}
                                            className="h-11 rounded-xl bg-slate-50 mt-1 font-bold text-xs"
                                            placeholder="Must match name on Bank Passbook / Cheque"
                                        />
                                        {fieldErrors.account_holder_name && (
                                            <p className="text-xs text-rose-500 mt-1">{fieldErrors.account_holder_name}</p>
                                        )}
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
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <Label className="text-xs font-bold text-slate-700">
                                            Bank Account Number <span className="text-rose-500">*</span>
                                        </Label>
                                        <Input
                                            value={formData.bank_account_number}
                                            onChange={(e) => updateField("bank_account_number", e.target.value.replace(/\D/g, ""))}
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
                                            onChange={(e) => updateField("confirm_account_number", e.target.value.replace(/\D/g, ""))}
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
                                        onChange={(e) => updateField("ifsc_code", e.target.value.toUpperCase().replace(/\s/g, ""))}
                                        className="h-11 rounded-xl bg-slate-50 mt-1 font-mono uppercase font-bold text-xs"
                                        placeholder="e.g. HDFC0001234 (11 characters)"
                                        maxLength={11}
                                    />
                                    {fieldErrors.ifsc_code && <p className="text-xs text-rose-500 mt-1">{fieldErrors.ifsc_code}</p>}
                                    <p className="text-[10px] text-slate-400 mt-1">
                                        Found on your cheque leaf or front page of your bank passbook.
                                    </p>
                                </div>
                            </div>

                            {/* ── Section 2: Statutory Information (EPFO & ESIC Declarations) ── */}
                            <div className="space-y-4 p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
                                <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                                    <span className="text-[11px] font-black uppercase tracking-wider text-blue-700 flex items-center gap-1.5">
                                        <ShieldCheck className="h-3.5 w-3.5 text-blue-600" /> Section 2: Statutory Compliance & Declarations
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                        EPFO & ESIC Setup
                                    </span>
                                </div>

                                {/* A. Provident Fund (EPFO) / Form 11 Declaration */}
                                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/90 space-y-3">
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <span className="text-xs font-black text-slate-900 block">
                                                Provident Fund (EPFO) Registration Declaration
                                            </span>
                                            <span className="text-[11px] text-slate-500">
                                                Are you already an existing member of Employees&apos; Provident Fund (EPFO)?
                                            </span>
                                        </div>
                                    </div>

                                    {/* Choice: Fresher vs Existing */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                        <button
                                            type="button"
                                            onClick={() => updateField("has_existing_pf", false)}
                                            className={`p-3 rounded-xl border text-left transition-all ${
                                                !formData.has_existing_pf
                                                    ? "border-blue-500 bg-blue-50/50 shadow-xs ring-1 ring-blue-500"
                                                    : "border-slate-200 bg-white hover:bg-slate-50"
                                            }`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${!formData.has_existing_pf ? "border-blue-600 bg-blue-600" : "border-slate-300"}`}>
                                                    {!formData.has_existing_pf && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                                                </div>
                                                <span className="text-xs font-bold text-slate-900">No, I am a First-Time Member</span>
                                            </div>
                                            <p className="text-[10px] text-slate-500 mt-1 pl-6">
                                                Fresher or not previously registered with EPFO.
                                            </p>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => updateField("has_existing_pf", true)}
                                            className={`p-3 rounded-xl border text-left transition-all ${
                                                formData.has_existing_pf
                                                    ? "border-blue-500 bg-blue-50/50 shadow-xs ring-1 ring-blue-500"
                                                    : "border-slate-200 bg-white hover:bg-slate-50"
                                            }`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${formData.has_existing_pf ? "border-blue-600 bg-blue-600" : "border-slate-300"}`}>
                                                    {formData.has_existing_pf && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                                                </div>
                                                <span className="text-xs font-bold text-slate-900">Yes, I Have an Existing UAN</span>
                                            </div>
                                            <p className="text-[10px] text-slate-500 mt-1 pl-6">
                                                Previously allocated a 12-digit UAN by another employer.
                                            </p>
                                        </button>
                                    </div>

                                    {/* Existing PF details inputs */}
                                    {formData.has_existing_pf ? (
                                        <div className="pt-3 border-t border-slate-200 space-y-3 animate-in fade-in duration-200">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                <div>
                                                    <Label className="text-[11px] font-bold text-slate-700">
                                                        Universal Account Number (UAN) <span className="text-rose-500">*</span>
                                                    </Label>
                                                    <Input
                                                        value={formData.uan}
                                                        onChange={(e) => updateField("uan", e.target.value.replace(/\D/g, ""))}
                                                        className="h-10 rounded-xl bg-white mt-1 font-mono font-bold text-xs"
                                                        placeholder="12-digit UAN number"
                                                        maxLength={12}
                                                    />
                                                    {fieldErrors.uan && <p className="text-[10px] text-rose-500 mt-1">{fieldErrors.uan}</p>}
                                                </div>

                                                <div>
                                                    <Label className="text-[11px] font-bold text-slate-700">
                                                        Previous PF Member ID
                                                    </Label>
                                                    <Input
                                                        value={formData.prev_pf_number}
                                                        onChange={(e) => updateField("prev_pf_number", e.target.value.toUpperCase())}
                                                        className="h-10 rounded-xl bg-white mt-1 font-mono uppercase font-bold text-xs"
                                                        placeholder="e.g. MH/BAN/0012345/000/0000001"
                                                    />
                                                </div>
                                            </div>

                                            <div className="sm:w-1/2 pr-0 sm:pr-1.5">
                                                <Label className="text-[11px] font-bold text-slate-700">
                                                    Previous Organization Exit Date
                                                </Label>
                                                <Input
                                                    type="date"
                                                    value={formData.prev_exit_date}
                                                    onChange={(e) => updateField("prev_exit_date", e.target.value)}
                                                    className="h-10 rounded-xl bg-white mt-1 font-bold text-xs"
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-100 text-[11px] text-blue-900 leading-relaxed flex items-start gap-2">
                                            <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                                            <span>
                                                <strong>First-Time Member Enrollment:</strong> A fresh Universal Account Number (UAN) and Member ID will be generated by Apaar Logistics upon onboarding registration. Company statutory PF calculations comply with the standard ₹15,000 ceiling.
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* B. Employee State Insurance (ESIC) Declaration */}
                                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/90 space-y-3">
                                    <div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-black text-slate-900 block">
                                                Employee State Insurance (ESIC) Setup
                                            </span>
                                            <Badge variant="outline" className="text-[8px] text-slate-500 font-normal">
                                                Statutory Health Scheme (Req 2.3 C)
                                            </Badge>
                                        </div>
                                        <span className="text-[11px] text-slate-500">
                                            Do you have an existing ESIC Insurance Number (IP Number) from previous employment?
                                        </span>
                                    </div>

                                    {/* Choice: Existing vs None */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                        <button
                                            type="button"
                                            onClick={() => updateField("has_existing_esic", false)}
                                            className={`p-3 rounded-xl border text-left transition-all ${
                                                !formData.has_existing_esic
                                                    ? "border-emerald-500 bg-emerald-50/50 shadow-xs ring-1 ring-emerald-500"
                                                    : "border-slate-200 bg-white hover:bg-slate-50"
                                            }`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${!formData.has_existing_esic ? "border-emerald-600 bg-emerald-600" : "border-slate-300"}`}>
                                                    {!formData.has_existing_esic && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                                                </div>
                                                <span className="text-xs font-bold text-slate-900">No / First-Time Registrant</span>
                                            </div>
                                            <p className="text-[10px] text-slate-500 mt-1 pl-6">
                                                Never previously registered with ESIC.
                                            </p>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => updateField("has_existing_esic", true)}
                                            className={`p-3 rounded-xl border text-left transition-all ${
                                                formData.has_existing_esic
                                                    ? "border-emerald-500 bg-emerald-50/50 shadow-xs ring-1 ring-emerald-500"
                                                    : "border-slate-200 bg-white hover:bg-slate-50"
                                            }`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${formData.has_existing_esic ? "border-emerald-600 bg-emerald-600" : "border-slate-300"}`}>
                                                    {formData.has_existing_esic && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                                                </div>
                                                <span className="text-xs font-bold text-slate-900">Yes, I Have an Existing IP Number</span>
                                            </div>
                                            <p className="text-[10px] text-slate-500 mt-1 pl-6">
                                                Have an active 10 or 17 digit ESIC Insurance Number.
                                            </p>
                                        </button>
                                    </div>

                                    {formData.has_existing_esic ? (
                                        <div className="pt-2 border-t border-slate-200 animate-in fade-in duration-200">
                                            <Label className="text-[11px] font-bold text-slate-700">
                                                Existing ESIC IP Number (Optional)
                                            </Label>
                                            <Input
                                                value={formData.esic_number}
                                                onChange={(e) => updateField("esic_number", e.target.value.replace(/\D/g, ""))}
                                                className="h-10 rounded-xl bg-white mt-1 font-mono font-bold text-xs"
                                                placeholder="10 or 17 digit ESIC Insurance (IP) Number (Optional)"
                                                maxLength={17}
                                            />
                                            {fieldErrors.esic_number && (
                                                <p className="text-[10px] text-rose-500 mt-1">{fieldErrors.esic_number}</p>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="p-3 rounded-xl bg-slate-100/70 border border-slate-200 text-[11px] text-slate-600 leading-relaxed flex items-start gap-2">
                                            <Info className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
                                            <span>
                                                If your monthly gross salary falls within the statutory eligibility threshold (≤ ₹21,000/month), you will be newly registered and allocated an ESIC IP Number.
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ════════════════════════════════════════════════════════ */}
                    {/* STEP 2 (PAGE C): MANDATORY DOCUMENT UPLOADS */}
                    {/* ════════════════════════════════════════════════════════ */}
                    {currentStep === 2 && (
                        <div className="space-y-6">
                            <div className="border-b border-slate-100 pb-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="h-8 w-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                                            <Upload className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <h2 className="text-base font-black text-slate-900">
                                                Page 3: Document Uploads & Verification
                                            </h2>
                                            <p className="text-xs text-slate-500">
                                                Attach clear scanned copies or photos (PDF, PNG, JPG up to 10MB each).
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={fillDummyData}
                                            className="h-8 px-3 rounded-xl border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 font-bold text-xs shadow-xs shrink-0"
                                        >
                                            <Sparkles className="h-3.5 w-3.5 mr-1 text-amber-600" /> Fill Dummy
                                        </Button>
                                        <Badge className="bg-slate-900 text-white font-mono text-xs">
                                            {Object.keys(uploadedDocs).length} / {DOCUMENT_DEFINITIONS.length} Attached
                                        </Badge>
                                    </div>
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
                                                <label
                                                    htmlFor={`doc-upload-${doc.id}`}
                                                    className="w-full mt-3 h-8 text-[10px] font-bold rounded-xl border border-dashed border-slate-300 hover:border-indigo-500 hover:bg-indigo-50/50 bg-white flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-2xs"
                                                >
                                                    <Upload className="h-3 w-3 text-slate-500" /> Choose File
                                                    <input
                                                        id={`doc-upload-${doc.id}`}
                                                        type="file"
                                                        className="hidden"
                                                        accept={doc.accept}
                                                        onChange={(e) => {
                                                            const file = e.target.files?.[0];
                                                            if (file) {
                                                                processFileForDoc(doc.id, file);
                                                            }
                                                            e.target.value = "";
                                                        }}
                                                    />
                                                </label>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* ════════════════════════════════════════════════════════ */}
                    {/* STEP 3 (PAGE D): REVIEW & SUBMISSION */}
                    {/* ════════════════════════════════════════════════════════ */}
                    {currentStep === 3 && (
                        <div className="space-y-6">
                            <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="h-8 w-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                                        <FileCheck className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <h2 className="text-base font-black text-slate-900">
                                            Page 4: Review & Submission
                                        </h2>
                                        <p className="text-xs text-slate-500">
                                            Please verify all submitted onboarding particulars before sending to HR.
                                        </p>
                                    </div>
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={fillDummyData}
                                    className="h-8 px-3 rounded-xl border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 font-bold text-xs shadow-xs shrink-0"
                                >
                                    <Sparkles className="h-3.5 w-3.5 mr-1 text-amber-600" /> Fill Dummy
                                </Button>
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
                                        <span className="text-slate-400 font-bold uppercase text-[9px] block">DOB / Gender</span>
                                        <span className="font-bold text-slate-800">
                                            {formData.dob} • {formData.gender.toUpperCase()}
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

                            {/* Section 2: Salary & Bank Details Preview */}
                            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5 text-xs">
                                <div className="flex items-center justify-between pb-1 border-b border-slate-200/60">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                        <CreditCard className="h-3.5 w-3.5 text-emerald-600" /> B. Bank & Statutory Declarations
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
                                        <span className="text-slate-400 font-bold uppercase text-[9px] block">Offered Monthly CTC</span>
                                        <span className="font-black text-emerald-700 text-sm">
                                            {Number(invitation?.fixed_gross) > 0 ? `₹${Number(invitation.fixed_gross).toLocaleString("en-IN")} / month` : "As per approved Offer Letter"}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 font-bold uppercase text-[9px] block">Salary Bank & Mode</span>
                                        <span className="font-bold text-slate-800">
                                            {formData.bank_name} (Direct Bank Transfer)
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 font-bold uppercase text-[9px] block">Account Holder & Number</span>
                                        <span className="font-mono font-bold text-slate-800">
                                            {formData.account_holder_name} • ••••••••{formData.bank_account_number.slice(-4)}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 font-bold uppercase text-[9px] block">Bank IFSC Code</span>
                                        <span className="font-mono font-bold text-slate-800">{formData.ifsc_code}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 font-bold uppercase text-[9px] block">EPFO / UAN Status</span>
                                        <span className="font-bold text-slate-800">
                                            {formData.has_existing_pf ? `Existing UAN: ${formData.uan}` : "First-Time Member (Fresh UAN Allocation)"}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 font-bold uppercase text-[9px] block">ESIC Declaration</span>
                                        <span className="font-bold text-slate-800">
                                            {formData.has_existing_esic ? `Existing IP: ${formData.esic_number}` : "First-Time Registrant (Subject to Wage Slabs)"}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Section 3: Attached Documents Summary */}
                            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5 text-xs">
                                <div className="flex items-center justify-between pb-1 border-b border-slate-200/60">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                        <FileText className="h-3.5 w-3.5 text-indigo-600" /> C. Attached Verification Documents
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

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                                    {DOCUMENT_DEFINITIONS.map((def) => {
                                        const doc = uploadedDocs[def.id];
                                        return (
                                            <div
                                                key={def.id}
                                                className="p-2 rounded-xl bg-white border border-slate-200/80 flex items-center justify-between gap-2"
                                            >
                                                <span className="text-[11px] font-bold text-slate-800 truncate">
                                                    {def.title.split(". ")[1] || def.title}
                                                </span>
                                                {doc ? (
                                                    <Badge className="bg-emerald-100 text-emerald-800 border-none text-[8px] font-bold uppercase">
                                                        Attached
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="text-[8px] text-slate-400 border-slate-200">
                                                        Not Uploaded
                                                    </Badge>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Candidate Declaration */}
                            <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 space-y-2">
                                <label className="flex items-start gap-2.5 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={declarationAccepted}
                                        onChange={(e) => setDeclarationAccepted(e.target.checked)}
                                        className="h-4 w-4 rounded text-emerald-600 mt-0.5 border-emerald-400 focus:ring-emerald-500"
                                    />
                                    <p className="text-[11px] text-emerald-950 font-medium leading-relaxed">
                                        I hereby solemnly declare that all personal credentials, bank details, statutory declarations, and uploaded documents provided above are genuine, true, and accurate to the best of my knowledge. I understand that any discrepancy discovered during background verification may result in disciplinary action or withdrawal of offer as per company employment policies.
                                    </p>
                                </label>
                            </div>
                        </div>
                    )}

                    {/* Step Navigation Actions */}
                    <div className="flex items-center justify-between pt-6 mt-6 border-t border-slate-100">
                        {currentStep > 0 ? (
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setCurrentStep((s) => s - 1)}
                                className="h-11 px-5 rounded-2xl font-bold text-xs"
                            >
                                <ArrowLeft className="h-4 w-4 mr-1.5" /> Previous Step
                            </Button>
                        ) : (
                            <div />
                        )}

                        {currentStep < steps.length - 1 ? (
                            <Button
                                type="button"
                                onClick={handleNext}
                                className="h-11 px-6 rounded-2xl font-black uppercase text-[10px] tracking-widest bg-slate-900 text-white hover:bg-slate-800 shadow-lg shadow-slate-900/10"
                            >
                                Next Step <ArrowRight className="h-4 w-4 ml-1.5" />
                            </Button>
                        ) : (
                            <Button
                                type="button"
                                disabled={submitting || !declarationAccepted}
                                onClick={handleSubmit}
                                className="h-11 px-8 rounded-2xl font-black uppercase text-[10px] tracking-widest bg-emerald-600 text-white hover:bg-emerald-700 shadow-xl shadow-emerald-600/20 disabled:opacity-50"
                            >
                                {submitting ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Submitting Dossier...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 className="h-4 w-4 mr-1.5" /> Submit Onboarding Dossier
                                    </>
                                )}
                            </Button>
                        )}
                    </div>
                </Card>

                {/* Secure Footer */}
                <div className="text-center text-[11px] text-slate-400 font-medium">
                    Protected by Apaar Logistics 256-Bit SSL Encrypted HRMS Portal. All Rights Reserved.
                </div>
            </div>

            {/* Document Preview Modal */}
            {previewDocModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
                    <Card className="max-w-2xl w-full rounded-3xl border-none shadow-2xl p-6 bg-white space-y-4">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                            <div>
                                <h3 className="font-black text-sm text-slate-900">{previewDocModal.title}</h3>
                                <p className="text-[10px] text-slate-400 font-mono">{previewDocModal.fileName}</p>
                            </div>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setPreviewDocModal(null)}
                                className="h-8 w-8 p-0 rounded-full"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>

                        <div className="max-h-[60vh] overflow-auto rounded-2xl bg-slate-50 p-2 flex items-center justify-center border border-slate-200/80">
                            {previewDocModal.fileType.includes("image") ? (
                                <img
                                    src={previewDocModal.dataUrl}
                                    alt={previewDocModal.title}
                                    className="max-h-[55vh] object-contain rounded-xl"
                                />
                            ) : (
                                <div className="p-8 text-center space-y-3">
                                    <FileText className="h-12 w-12 text-slate-400 mx-auto" />
                                    <p className="text-xs font-bold text-slate-700">PDF Document Attached</p>
                                    <a
                                        href={previewDocModal.dataUrl}
                                        download={previewDocModal.fileName}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-bold"
                                    >
                                        <ExternalLink className="h-3.5 w-3.5" /> Download / View External
                                    </a>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end pt-2">
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setPreviewDocModal(null)}
                                className="text-xs font-bold rounded-xl"
                            >
                                Close
                            </Button>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
}

export default function CandidateSelfOnboardingPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen flex items-center justify-center bg-slate-50">
                    <Loader2 className="h-6 w-6 animate-spin text-slate-600" />
                </div>
            }
        >
            <CandidateOnboardingContent />
        </Suspense>
    );
}
