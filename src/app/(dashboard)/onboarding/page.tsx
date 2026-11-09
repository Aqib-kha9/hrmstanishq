"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
    UserPlus,
    Clock,
    ChevronRight,
    ArrowLeft,
    Upload,
    CheckCircle,
    Calculator,
    FileText,
    ShieldCheck,
    Loader2,
    Sparkles,
    AlertCircle,
    X,
    FileCheck,
    Eye,
    Send,
    Download,
    Copy,
    UserCheck,
    MailCheck,
    RefreshCw,
    ExternalLink,
    Briefcase,
    Banknote,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useRole } from "@/context/RoleContext";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { apiGet, apiPost, apiPatch, apiPut, getApiErrorMessage } from "@/lib/api-client";

const steps = ["Personal Info", "Employment Information", "Salary & Bank", "Documentation", "Review"];

// ── Types for dynamically fetched data ──
interface OfficeItem {
    id: number;
    name: string;
    address?: string;
    latitude?: number;
    longitude?: number;
    radius_meters?: number;
    is_active: boolean;
}

interface CompanyItem {
    id: number;
    name: string;
    address?: string;
    is_active: boolean;
}

// ═══════════════════════════════════════════════════════════════
// DUMMY DATA — one-click fill for development
// ═══════════════════════════════════════════════════════════════
const DUMMY_DATA = {
    name: "Rahul Sharma",
    email: "rahul.sharma@apaarlogistics.com",
    phone: "9876543210",
    dob: "1995-03-15",
    gender: "male",
    maritalStatus: "unmarried",
    fatherOrHusbandName: "Omprakash Sharma",
    emergencyName: "Priya Sharma",
    emergencyRelation: "Spouse",
    emergencyPhone: "9876543211",
    address: "12/3, MG Road, Vijay Nagar, Indore, MP 452010",
    aadhaar: "123456789012",
    pan: "ABCDE1234F",
    doj: "2026-06-15",
    role: "EMPLOYEE",
    jobTitle: "Operations Manager",
    dept: "Operations",
    hrManager: "Rahul Sharma (HR Manager)",
    shiftStartTime: "09:30",
    shiftEndTime: "18:30",
    isRotationalShift: "No",
    halfDayLateMinutes: "60",
    fixedGross: "45000",
    hraApplicable: "Yes",
    conveyance: "0",
    medicalAllowance: "0",
    specialAllowance: "0",
    performanceAllowance: "0",
    bankName: "HDFC Bank",
    accountNo: "50100123456789",
    ifsc: "HDFC0001234",
    paymentMode: "Bank Transfer",
    pfApplicable: "Yes",
    pfCeiling: "Yes",
    esicApplicable: "Yes",
    ptApplicable: "Yes",
    pfContributionMode: "shared",
    pfEmployeeRate: "0.12",
    pfEmployerRate: "0.12",
    esicContributionMode: "shared",
    esicEmployeeRate: "0.0075",
    esicEmployerRate: "0.0325",
    pfNo: "PF/MP/IND/001234",
    uan: "101234567890",
    licDetails: "LIC/IND/987654",
};

// ═══════════════════════════════════════════════════════════════
// VALIDATION
// ═══════════════════════════════════════════════════════════════
type FieldErrors = Record<string, string>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const AADHAAR_RE = /^\d{12}$/;
const UAN_RE = /^\d{12}$/;
const PHONE_RE = /^(\+91[-\s]?)?[6-9]\d{9}$/;
const ACCOUNT_NO_RE = /^\d{9,18}$/;

const validateField = (id: string, value: string): string | null => {
    const v = value.trim();
    switch (id) {
        // ── Step 0: Personal Info (Req 2.3 A) ──
        case "name":
            if (!v) return "Full name (as per Aadhaar) is required";
            if (v.length < 2) return "Name must be at least 2 characters";
            if (v.length > 100) return "Name must be under 100 characters";
            return null;
        case "email":
            if (!v) return "Email address is required";
            if (!EMAIL_RE.test(v)) return "Please enter a valid email address";
            if (v.length > 150) return "Email must be under 150 characters";
            return null;
        case "phone":
            if (!v) return "Mobile number is required";
            if (!PHONE_RE.test(v.replace(/\s/g, ""))) return "Enter a valid 10-digit mobile number";
            return null;
        case "dob":
            if (!v) return "Date of birth is required";
            const d = new Date(v);
            if (isNaN(d.getTime())) return "Invalid date";
            const today = new Date();
            const age18 = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
            if (d > age18) return "Employee must be at least 18 years old";
            return null;
        case "doj":
            if (!v) return "Date of joining is required";
            return null;
        case "gender":
            if (!v) return "Gender is required";
            return null;
        case "maritalStatus":
            if (!v) return "Marital status is required";
            return null;
        case "fatherOrHusbandName":
            if (!v) return "Father's or Husband's name is required";
            if (v.length < 2) return "Must be at least 2 characters";
            if (v.length > 100) return "Must be under 100 characters";
            return null;
        case "emergencyName":
            if (!v) return "Emergency contact name is required";
            if (v.length < 2) return "Must be at least 2 characters";
            if (v.length > 100) return "Must be under 100 characters";
            return null;
        case "emergencyPhone":
            if (!v) return "Emergency contact phone is required";
            if (!PHONE_RE.test(v.replace(/\s/g, ""))) return "Enter a valid 10-digit emergency number";
            return null;
        case "emergencyRelation":
            if (!v) return "Emergency relationship is required";
            if (v.length > 50) return "Must be under 50 characters";
            return null;
        case "aadhaar":
            if (!v) return "Aadhaar number is required";
            if (!AADHAAR_RE.test(v.replace(/\s/g, ""))) return "Aadhaar must be exactly 12 digits";
            return null;
        case "pan":
            // Optional per Req 2.3 A! Format checked only if entered
            if (v && !PAN_RE.test(v.toUpperCase())) return "PAN must be in format ABCDE1234F";
            return null;
        case "address":
            if (!v) return "Address as per Aadhaar is required";
            if (v.length < 5) return "Please enter complete address";
            if (v.length > 500) return "Address must be under 500 characters";
            return null;

        // ── Step 1: Employment Information (Req 2.3 B) ──
        case "company":
            if (!v) return "Company Entity is required";
            return null;
        case "location":
            if (!v) return "Working Location is required";
            return null;
        case "role":
            if (!v) return "System Role is required";
            return null;
        case "jobTitle":
            if (!v) return "Designation is required";
            if (v.length > 80) return "Designation must be under 80 characters";
            return null;
        case "shiftStartTime":
            if (!v) return "Shift start time is required";
            if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) return "Must be HH:MM format (e.g., 09:30)";
            return null;
        case "shiftEndTime":
            if (!v) return "Shift end time is required";
            if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) return "Must be HH:MM format (e.g., 18:30)";
            return null;
        case "halfDayLateMinutes":
            if (!v || isNaN(Number(v)) || Number(v) < 1 || Number(v) > 480) return "Must be 1–480 minutes";
            return null;

        // ── Step 2: Salary & Bank (Req 2.4) ──
        case "fixedGross":
            if (!v || isNaN(Number(v)) || Number(v) <= 0) return "Monthly CTC is required";
            if (Number(v) < 5000) return "CTC must be at least ₹5,000";
            if (Number(v) > 10000000) return "CTC seems too high";
            return null;
        case "bankName":
            if (!v) return "Bank name is required";
            if (v.length > 100) return "Bank name must be under 100 characters";
            return null;
        case "accountNo":
            if (!v) return "Account number is required";
            if (!ACCOUNT_NO_RE.test(v)) return "Account number must be 9–18 digits";
            return null;
        case "ifsc":
            if (!v) return "IFSC code is required";
            if (!IFSC_RE.test(v.toUpperCase())) return "IFSC must be in format HDFC0001234";
            return null;
        case "pfEmployeeRate":
        case "pfEmployerRate":
        case "esicEmployeeRate":
        case "esicEmployerRate":
            if (v && (isNaN(Number(v)) || Number(v) < 0 || Number(v) > 1)) return "Rate must be between 0 and 1";
            return null;
        case "pfNo":
            if (v && v.length > 30) return "PF number must be under 30 characters";
            return null;
        case "uan":
            if (v && !UAN_RE.test(v)) return "UAN must be exactly 12 digits";
            return null;
        case "licDetails":
            if (v && v.length > 100) return "LIC details must be under 100 characters";
            return null;
        default:
            return null;
    }
};

/** Validate all fields on a given step. Returns an object of { fieldId: errorMessage }. */
const validateStep = (step: number, formData: Record<string, string>): FieldErrors => {
    const errors: FieldErrors = {};
    const check = (id: string) => {
        const err = validateField(id, formData[id] || "");
        if (err) errors[id] = err;
    };
    switch (step) {
        case 0:
            check("name");
            check("email");
            check("phone");
            check("dob");
            check("doj");
            check("gender");
            check("maritalStatus");
            check("fatherOrHusbandName");
            check("emergencyName");
            check("emergencyPhone");
            check("emergencyRelation");
            check("aadhaar");
            check("pan");
            check("address");
            break;
        case 1:
            check("company");
            check("location");
            check("role");
            check("jobTitle");
            check("shiftStartTime");
            check("shiftEndTime");
            check("halfDayLateMinutes");
            break;
        case 2:
            check("fixedGross");
            check("bankName");
            check("accountNo");
            check("ifsc");
            check("pfEmployeeRate");
            check("pfEmployerRate");
            check("esicEmployeeRate");
            check("esicEmployerRate");
            check("pfNo");
            check("uan");
            check("licDetails");
            break;
    }
    return errors;
};

// ═══════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function OnboardingForm() {
    const searchParams = useSearchParams();
    const editId = searchParams.get("editId");
    const isEditing = !!editId;

    const { availableRoles } = useRole();
    const router = useRouter();
    const [currentStep, setCurrentStep] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadedFiles, setUploadedFiles] = useState<{ file: File; docType: string }[]>([]);

    // ── Post-creation offer letter state ──
    const [createdEmployee, setCreatedEmployee] = useState<{ id: number; emp_code: string; name: string; email: string } | null>(null);
    const [offerLetterPreviewing, setOfferLetterPreviewing] = useState(false);
    const [offerLetterSending, setOfferLetterSending] = useState(false);
    const [offerLetterSent, setOfferLetterSent] = useState(false);
    const [offerLetterSendingError, setOfferLetterSendingError] = useState<string | null>(null);

    // ── Dynamic companies & offices (fetched from DB) ──
    const [companies, setCompanies] = useState<CompanyItem[]>([]);
    const [offices, setOffices] = useState<OfficeItem[]>([]);
    const [loadingLookups, setLoadingLookups] = useState(true);

    useEffect(() => {
        let cancelled = false;
        async function fetchLookups() {
            try {
                const [co, of] = await Promise.all([
                    apiGet<CompanyItem[]>("/companies"),
                    apiGet<OfficeItem[]>("/offices", { limit: 100 }),
                ]);
                if (!cancelled) {
                    setCompanies(co);
                    setOffices(of);
                    if (!editId) {
                        if (co.length > 0) {
                            setFormData((prev) => ({ ...prev, company: co[0].id.toString() }));
                        }
                        if (of.length > 0) {
                            setFormData((prev) => ({ ...prev, location: of[0].id.toString() }));
                        }
                    } else {
                        try {
                            const [emp, salaryResponse]: any = await Promise.all([
                                apiGet(`/employees/${editId}`),
                                apiGet(`/employees/${editId}/salary`).catch(() => ({ current: null }))
                            ]);
                            const currentSalary = salaryResponse?.current || {};

                            setFormData((prev) => ({
                                ...prev,
                                name: emp.name || "",
                                email: emp.email || "",
                                phone: emp.phone || "",
                                dob: emp.date_of_birth ? emp.date_of_birth.split("T")[0] : "",
                                gender: emp.gender || "male",
                                maritalStatus: emp.marital_status || "unmarried",
                                fatherOrHusbandName: emp.father_or_husband_name || "",
                                address: emp.address || "",
                                aadhaar: emp.aadhaar_number || "",
                                role: emp.role ? emp.role.toUpperCase() : "EMPLOYEE",
                                jobTitle: emp.designation || "",
                                dept: emp.department || "Operations",
                                hrManager: emp.hr_manager || "",
                                doj: emp.date_of_joining ? emp.date_of_joining.split("T")[0] : "",
                                company: emp.company_id ? emp.company_id.toString() : "",
                                location: emp.office_id ? emp.office_id.toString() : (emp.location ? of.find((o) => o.name === emp.location)?.id?.toString() : "") || "",
                                fixedGross: currentSalary.fixed_gross?.toString() || emp.fixed_gross?.toString() || "",
                                bankName: emp.bank_name || "",
                                accountNo: emp.bank_account_number || "",
                                ifsc: emp.ifsc_code || "",
                                paymentMode: emp.payment_mode || "Bank Transfer",
                                pfCeiling: (currentSalary.pf_ceiling ?? emp.pf_ceiling) ? "Yes" : "No",
                                esicApplicable: (currentSalary.esic_applicable ?? emp.esic_applicable) ? "Yes" : "No",
                                pfContributionMode: (currentSalary.pf_contribution_mode ?? emp.pf_contribution_mode) || "shared",
                                pfEmployeeRate: currentSalary.pf_employee_rate?.toString() || "0.12",
                                pfEmployerRate: currentSalary.pf_employer_rate?.toString() || "0.12",
                                esicContributionMode: (currentSalary.esic_contribution_mode ?? emp.esic_contribution_mode) || "shared",
                                esicEmployeeRate: currentSalary.esic_employee_rate?.toString() || "0.0075",
                                esicEmployerRate: currentSalary.esic_employer_rate?.toString() || "0.0325",
                                pfNo: emp.pf_number || "",
                                uan: emp.uan || "",
                                pan: emp.pan_number || "",
                                licDetails: emp.lic_details || "",
                                emergencyName: emp.emergency_contact_name || "",
                                emergencyPhone: emp.emergency_contact_phone || "",
                                emergencyRelation: emp.emergency_contact_relation || "",
                                shiftStartTime: emp.shift_start_time ? emp.shift_start_time.substring(0, 5) : "09:30",
                                shiftEndTime: emp.shift_end_time ? emp.shift_end_time.substring(0, 5) : "18:30",
                                isRotationalShift: emp.is_rotational_shift ? "Yes" : "No",
                                halfDayLateMinutes: emp.half_day_late_minutes?.toString() || "60",
                                ptApplicable: (currentSalary.pt_applicable ?? emp.pt_applicable) ? "Yes" : "No",
                                effectiveWorkDays: currentSalary.effective_work_days?.toString() || "26",
                            }));
                        } catch (err) {
                            console.error("Failed to fetch employee for editing", err);
                        }
                    }
                }
            } catch {
                // silently keep defaults
            } finally {
                if (!cancelled) setLoadingLookups(false);
            }
        }
        fetchLookups();
        return () => { cancelled = true; };
    }, [editId]);

    // ── Sequential Employee ID State (Req 1.2) ──
    const [suggestedEmpCode, setSuggestedEmpCode] = useState<string>("");
    const [customEmpCode, setCustomEmpCode] = useState<string>("");

    // ── Self-Onboarding Tabs & Invitations State (Req 2) ──
    const [activeTab, setActiveTab] = useState<"direct" | "submissions">("direct");
    const [invitations, setInvitations] = useState<any[]>([]);
    const safeInvitations = Array.isArray(invitations) ? invitations : [];
    const [invitationsLoading, setInvitationsLoading] = useState(false);
    const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
    const [inviteLoading, setInviteLoading] = useState(false);
    const [inviteSuccessLink, setInviteSuccessLink] = useState<string | null>(null);
    const [inviteError, setInviteError] = useState<string | null>(null);
    const [inviteForm, setInviteForm] = useState({
        candidate_name: "",
        email: "",
        phone: "",
        company_id: "",
        office_id: "",
        notes: "",
    });

    // ── Review & 1-Click Approve Candidate State (Req 2.2) ──
    const [reviewCandidate, setReviewCandidate] = useState<any | null>(null);
    const [approveLoading, setApproveLoading] = useState(false);
    const [approvalOverrides, setApprovalOverrides] = useState({
        name: "",
        email: "",
        phone: "",
        dob: "",
        gender: "male",
        marital_status: "unmarried",
        father_or_husband_name: "",
        address: "",
        pan: "",
        aadhaar: "",
        emergencyName: "",
        emergencyRelation: "",
        emergencyPhone: "",

        company_id: "",
        office_id: "",
        working_location: "",
        designation: "Executive",
        department: "Operations",
        role: "EMPLOYEE",
        date_of_joining: new Date().toISOString().split("T")[0],

        fixed_gross: "45000",
        hra_applicable: "Yes",
        conveyance: "0",
        medical_allowance: "0",
        special_allowance: "0",
        performance_allowance: "0",
        bankName: "",
        accountNo: "",
        ifsc: "",
        paymentMode: "Bank Transfer",

        pf_applicable: "Yes",
        pf_ceiling: "Yes",
        pf_employment_date: "",
        pf_contribution_mode: "shared",
        pf_employee_rate: "0.12",
        pf_employer_rate: "0.12",
        esic_applicable: "Yes",
        esic_contribution_mode: "shared",
        esic_employee_rate: "0.0075",
        esic_employer_rate: "0.0325",
        pt_applicable: "Yes",
        pf_number: "PF/IND/001",
        uan: "",
        esic_number: "",
        lic_details: "",

        shift_start_time: "09:30",
        shift_end_time: "18:30",
        is_rotational_shift: false,
        half_day_late_minutes: "60",
    });

    // ── Candidate Document Preview Modal State ──
    const [previewDoc, setPreviewDoc] = useState<{
        type: string;
        filename: string;
        size?: number;
        file_url?: string;
        data_url?: string;
        candidate_name?: string;
        aadhaar_number?: string;
        pan_number?: string;
        bank_account_number?: string;
        bank_name?: string;
        ifsc_code?: string;
    } | null>(null);
    const [imgPreviewError, setImgPreviewError] = useState(false);

    const getDocPreviewUrl = (url?: string) => {
        if (!url) return "";
        if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) {
            return url;
        }
        const backendBase = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000")
            .replace(/\/api\/v1\/?$/, "")
            .replace(/\/+$/, "");
        const cleanPath = url.startsWith("/") ? url : `/${url}`;
        return `${backendBase}${cleanPath}`;
    };

    // ── Resigned Conflict Warning State (Req 23) ──
    const [isResignedError, setIsResignedError] = useState(false);

    // Fetch next sequential code according to company-specific format (Req 2.2)
    const loadNextCode = useCallback(async (companyId?: string) => {
        if (!editId) {
            try {
                const params: Record<string, string> = {};
                if (companyId) params.company_id = companyId;
                const res = await apiGet<{ nextCode?: string; next_emp_code?: string }>("/employees/next-code", params);
                const code = res?.nextCode || res?.next_emp_code;
                if (code) {
                    setSuggestedEmpCode(code);
                    setCustomEmpCode(code);
                }
            } catch (err) {
                console.error("Failed to load next sequential code:", err);
            }
        }
    }, [editId]);

    // Fetch candidate invitations
    const fetchInvitations = async () => {
        setInvitationsLoading(true);
        try {
            const res: any = await apiGet("/onboarding/invitations");
            let list: any[] = [];
            if (Array.isArray(res)) {
                list = res;
            } else if (Array.isArray(res?.data)) {
                list = res.data;
            } else if (Array.isArray(res?.rows)) {
                list = res.rows;
            } else if (Array.isArray(res?.invitations)) {
                list = res.invitations;
            }
            setInvitations(list);
        } catch (err) {
            console.error("Failed to load invitations:", err);
        } finally {
            setInvitationsLoading(false);
        }
    };

    useEffect(() => {
        fetchInvitations();
    }, []);

    useEffect(() => {
        if (activeTab === "submissions") {
            fetchInvitations();
        }
    }, [activeTab]);

    const sendCandidateInvite = async () => {
        if (!inviteForm.candidate_name || !inviteForm.email) {
            setInviteError("Candidate name and email are required.");
            return;
        }
        setInviteLoading(true);
        setInviteSuccessLink(null);
        setInviteError(null);
        try {
            const data = await apiPost<any>("/onboarding/invite", {
                candidate_name: inviteForm.candidate_name,
                email: inviteForm.email,
                phone: inviteForm.phone || undefined,
                company_id: inviteForm.company_id ? Number(inviteForm.company_id) : undefined,
                office_id: inviteForm.office_id ? Number(inviteForm.office_id) : undefined,
                notes: inviteForm.notes || undefined,
            });
            alert(`Self-onboarding invitation link sent successfully to ${inviteForm.email}!`);
            setInviteDialogOpen(false);
            setInviteError(null);
            setInviteForm({
                candidate_name: "",
                email: "",
                phone: "",
                company_id: "",
                office_id: "",
                notes: "",
            });
            setActiveTab("submissions");
            fetchInvitations();
        } catch (err: any) {
            const errMsg = getApiErrorMessage(err, "Failed to send self-onboarding invitation.");
            console.error("Failed to send invite:", errMsg, err);
            setInviteError(errMsg);
        } finally {
            setInviteLoading(false);
        }
    };

    const approveCandidateSubmission = async (invitationId: number) => {
        setApproveLoading(true);
        try {
            const result = await apiPost<any>(`/onboarding/approve/${invitationId}`, {
                name: approvalOverrides.name || undefined,
                email: approvalOverrides.email || undefined,
                phone: approvalOverrides.phone || undefined,
                date_of_birth: approvalOverrides.dob || undefined,
                gender: approvalOverrides.gender || undefined,
                marital_status: approvalOverrides.marital_status || undefined,
                father_or_husband_name: approvalOverrides.father_or_husband_name || undefined,
                address: approvalOverrides.address || undefined,
                pan_number: approvalOverrides.pan || undefined,
                aadhaar_number: approvalOverrides.aadhaar || undefined,
                emergency_contact_name: approvalOverrides.emergencyName || undefined,
                emergency_contact_phone: approvalOverrides.emergencyPhone || undefined,
                emergency_contact_relation: approvalOverrides.emergencyRelation || undefined,
                designation: approvalOverrides.designation || undefined,
                department: approvalOverrides.department || undefined,
                role: approvalOverrides.role || undefined,
                company_id: approvalOverrides.company_id ? Number(approvalOverrides.company_id) : undefined,
                office_id: approvalOverrides.office_id ? Number(approvalOverrides.office_id) : undefined,
                date_of_joining: approvalOverrides.date_of_joining || undefined,
                fixed_gross: approvalOverrides.fixed_gross ? Number(approvalOverrides.fixed_gross) : undefined,
                hra_applicable: approvalOverrides.hra_applicable !== "No",
                conveyance: Number(approvalOverrides.conveyance) || 0,
                medical_allowance: Number(approvalOverrides.medical_allowance) || 0,
                special_allowance: Number(approvalOverrides.special_allowance) || 0,
                performance_allowance: Number(approvalOverrides.performance_allowance) || 0,
                payment_mode: approvalOverrides.paymentMode || undefined,
                bank_name: approvalOverrides.bankName || undefined,
                bank_account_number: approvalOverrides.accountNo || undefined,
                ifsc_code: approvalOverrides.ifsc || undefined,
                pf_applicable: approvalOverrides.pf_applicable === "Yes",
                pf_ceiling: approvalOverrides.pf_ceiling === "Yes",
                pf_employment_date: approvalOverrides.pf_employment_date || undefined,
                pf_contribution_mode: approvalOverrides.pf_contribution_mode,
                pf_number: approvalOverrides.pf_number || undefined,
                uan: approvalOverrides.uan || undefined,
                esic_applicable: approvalOverrides.esic_applicable === "Yes",
                esic_contribution_mode: approvalOverrides.esic_contribution_mode,
                esic_number: approvalOverrides.esic_number || undefined,
                pt_applicable: approvalOverrides.pt_applicable === "Yes",
                shift_start_time: approvalOverrides.shift_start_time || undefined,
                shift_end_time: approvalOverrides.shift_end_time || undefined,
                is_rotational_shift: Boolean(approvalOverrides.is_rotational_shift),
                half_day_late_minutes: Number(approvalOverrides.half_day_late_minutes) || 60,
            });
            alert(`Candidate approved successfully! Created Employee ${result.employee.name} with ID ${result.employee.emp_code}`);
            setReviewCandidate(null);
            fetchInvitations();
        } catch (err: any) {
            const errMsg = getApiErrorMessage(err, "Failed to approve candidate submission.");
            console.error("Failed to approve candidate:", errMsg, err);
            alert(errMsg);
        } finally {
            setApproveLoading(false);
        }
    };

    const [formData, setFormData] = useState({
        // Step 0: Personal Info (Req 2.3 A)
        name: "",
        email: "",
        phone: "",
        dob: "",
        doj: "",
        gender: "male",
        maritalStatus: "unmarried",
        fatherOrHusbandName: "",
        emergencyName: "",
        emergencyPhone: "",
        emergencyRelation: "",
        aadhaar: "",
        pan: "",
        address: "",

        // Step 1: Employment Information (Req 2.3 B)
        company: "",
        location: "",
        role: "EMPLOYEE",
        jobTitle: "",
        dept: "Operations",
        hrManager: "",
        shiftStartTime: "09:30",
        shiftEndTime: "18:30",
        isRotationalShift: "No",
        halfDayLateMinutes: "60",

        // Step 2: Salary & Bank (Req 2.4)
        fixedGross: "",
        hraApplicable: "Yes",
        conveyance: "0",
        medicalAllowance: "0",
        specialAllowance: "0",
        performanceAllowance: "0",
        bankName: "",
        accountNo: "",
        ifsc: "",
        paymentMode: "Bank Transfer",
        pfApplicable: "Yes",
        pfCeiling: "Yes",
        pfEmploymentDate: "",
        esicApplicable: "Yes",
        ptApplicable: "Yes",
        pfContributionMode: "shared",
        pfEmployeeRate: "0.12",
        pfEmployerRate: "0.12",
        esicContributionMode: "shared",
        esicEmployeeRate: "0.0075",
        esicEmployerRate: "0.0325",
        pfNo: "",
        uan: "",
        licDetails: "",
        esicNumber: "",
    });

    // Auto-update sequential employee ID when company changes (Req 2.2)
    useEffect(() => {
        loadNextCode(formData.company);
    }, [formData.company, loadNextCode]);

    // ── Field helpers ──
    const updateField = (id: string, value: string) => {
        setFormData((prev) => ({ ...prev, [id]: value }));
        setError(null);
        // Clear the field-level error on change
        setFieldErrors((prev) => {
            if (!prev[id]) return prev;
            const next = { ...prev };
            delete next[id];
            return next;
        });
    };

    /** Validate on blur — shows error immediately but doesn't block navigation */
    const handleBlur = (id: string) => {
        const err = validateField(id, (formData as Record<string, string>)[id] || "");
        setFieldErrors((prev) => {
            if (err) return { ...prev, [id]: err };
            if (!prev[id]) return prev;
            const next = { ...prev };
            delete next[id];
            return next;
        });
    };

    /** Fill all fields with realistic dummy data for development */
    const fillDummyData = () => {
        setFormData((prev) => ({ ...prev, ...DUMMY_DATA }));
        setFieldErrors({});
        setError(null);
    };

    /** Trigger the hidden file input */
    const handleSelectFiles = () => {
        fileInputRef.current?.click();
    };

    /** Handle files selected via the hidden input */
    const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        // Auto-detect doc type from filename, default to "other"
        const detectType = (name: string): string => {
            const n = name.toLowerCase();
            if (n.includes("aadhar")) return "Aadhar";
            if (n.includes("pan")) return "PAN";
            if (n.includes("bank") || n.includes("passbook")) return "Passbook";
            if (n.includes("photo") || n.includes("image") || n.includes("pic")) return "Photo";
            return "other";
        };
        setUploadedFiles((prev) => [...prev, ...files.map((f) => ({ file: f, docType: detectType(f.name) }))]);
        e.target.value = "";
    };

    /** Update document type for a specific uploaded file */
    const updateFileDocType = (index: number, docType: string) => {
        setUploadedFiles((prev) => prev.map((f, i) => (i === index ? { ...f, docType } : f)));
    };

    /** Remove a specific file from the uploaded list */
    const removeFile = (index: number) => {
        setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
    };

    /** Shared input className builder — adds red ring on error */
    const inputClass = (id: string, base: string) =>
        cn(base, fieldErrors[id] && "ring-2 ring-red-200 bg-red-50/30");

    /** Shared select className builder — adds red ring on error */
    const selectClass = (id: string, base: string) =>
        cn(base, fieldErrors[id] && "ring-2 ring-red-200 bg-red-50/30");

    /** Inline field error message */
    const fieldErrorEl = (id: string) => {
        const msg = fieldErrors[id];
        if (!msg) return null;
        return (
            <p className="text-[9px] font-black text-red-500 uppercase tracking-widest flex items-center gap-1 animate-in slide-in-from-top-2">
                <AlertCircle className="h-3 w-3 flex-shrink-0" /> {msg}
            </p>
        );
    };

    // ── Submission helpers ──
    const generateEmpCode = (): string => {
        return customEmpCode || suggestedEmpCode || `EMP${Date.now().toString().slice(-6)}`;
    };

    const buildPayload = () => {
        const empCode = generateEmpCode();
        const password = "Welcome@123";

        return {
            emp_code: empCode,
            name: formData.name,
            email: formData.email,
            phone: formData.phone || null,
            password,
            date_of_birth: formData.dob || null,
            gender: formData.gender,
            marital_status: formData.maritalStatus || "unmarried",
            father_or_husband_name: formData.fatherOrHusbandName || null,
            address: formData.address || null,
            aadhaar_number: formData.aadhaar ? formData.aadhaar.replace(/\s/g, "") : null,
            pan_number: formData.pan ? formData.pan.toUpperCase() : null,
            designation: formData.jobTitle || null,
            department: formData.dept || "General",
            hr_manager: formData.hrManager || null,
            role: formData.role.toLowerCase().replace(/ /g, "_"),
            date_of_joining: formData.doj || null,
            office_id: formData.location ? parseInt(formData.location) : null,
            company_id: formData.company ? parseInt(formData.company) : null,
            company_name: companies.find((c) => c.id.toString() === formData.company)?.name || null,
            location: offices.find((o) => o.id.toString() === formData.location)?.name || null,
            fixed_gross: formData.fixedGross ? Number(formData.fixedGross) : 0,
            hra_applicable: formData.hraApplicable !== "No",
            conveyance: Number(formData.conveyance) || 0,
            medical_allowance: Number(formData.medicalAllowance) || 0,
            special_allowance: Number(formData.specialAllowance) || 0,
            performance_allowance: Number(formData.performanceAllowance) || 0,
            pf_applicable: formData.pfApplicable === "Yes",
            pf_ceiling: formData.pfCeiling === "Yes",
            pf_employment_date: formData.pfEmploymentDate || null,
            pf_contribution_mode: formData.pfContributionMode,
            pf_employee_rate: parseFloat(formData.pfEmployeeRate) || 0.12,
            pf_employer_rate: parseFloat(formData.pfEmployerRate) || 0.12,
            esic_applicable: formData.esicApplicable === "Yes",
            esic_contribution_mode: formData.esicContributionMode,
            esic_number: formData.esicNumber || formData.licDetails || null,
            esic_employee_rate: parseFloat(formData.esicEmployeeRate) || 0.0075,
            esic_employer_rate: parseFloat(formData.esicEmployerRate) || 0.0325,
            pt_applicable: formData.ptApplicable === "Yes",
            bank_name: formData.bankName || null,
            bank_account_number: formData.accountNo || null,
            ifsc_code: formData.ifsc || null,
            emergency_contact_name: formData.emergencyName || null,
            emergency_contact_phone: formData.emergencyPhone || null,
            emergency_contact_relation: formData.emergencyRelation || null,
            shift_start_time: formData.shiftStartTime || null,
            shift_end_time: formData.shiftEndTime || null,
            is_rotational_shift: formData.isRotationalShift === "Yes",
            half_day_late_minutes: formData.halfDayLateMinutes ? Number(formData.halfDayLateMinutes) : 60,
            send_offer_letter: false,
        };
    };

    /** Validate current step before advancing */
    const handleNextStep = () => {
        const errors = validateStep(currentStep, formData as Record<string, string>);
        if (Object.keys(errors).length > 0) {
            setFieldErrors(errors);
            return;
        }
        setFieldErrors({});
        setCurrentStep((s) => s + 1);
    };

    const handleFinish = async () => {
        // Validate all data-entry steps (0, 1, 2) before submitting
        const allErrors: FieldErrors = {};
        for (let i = 0; i <= 2; i++) {
            const stepErrors = validateStep(i, formData as Record<string, string>);
            Object.assign(allErrors, stepErrors);
        }
        if (Object.keys(allErrors).length > 0) {
            setFieldErrors(allErrors);
            setError("Please fix the validation errors before submitting.");
            // Jump to the first step that has errors
            for (let i = 0; i <= 2; i++) {
                if (Object.keys(validateStep(i, formData as Record<string, string>)).length > 0) {
                    setCurrentStep(i);
                    break;
                }
            }
            return;
        }

        setSubmitting(true);
        setError(null);
        setFieldErrors({});

        try {
            const payload = buildPayload();
            let result: any;
            
            if (isEditing) {
                result = await apiPatch<any>(`/employees/${editId}`, payload);
                try { await apiPut(`/employees/${editId}/salary`, payload); } catch (e) { console.warn("Salary update error:", e); }
                try { await apiPatch(`/employees/${editId}/role`, { role: payload.role }); } catch (e) { console.warn("Role update error:", e); }
            } else {
                result = await apiPost<{ emp_code: string; name: string; email: string; id: number }>("/auth/register", payload);
            }

            // Upload selected documents to backend → Cloudinary
            if (uploadedFiles.length > 0 && result.id) {
                const token = localStorage.getItem("hrms_auth_token");
                const formDataUpload = new FormData();

                const typeByFilename = (name: string): string => {
                    const n = name.toLowerCase();
                    if (n.includes("aadhar")) return "aadhar";
                    if (n.includes("pan")) return "pan";
                    if (n.includes("bank") || n.includes("passbook")) return "passbook";
                    if (n.includes("photo") || n.includes("image")) return "photo";
                    return "other";
                };

                // Build per-file type array (JSON) so backend assigns correct type to each file
                const types: string[] = [];
                for (let i = 0; i < uploadedFiles.length; i++) {
                    const entry = uploadedFiles[i];
                    formDataUpload.append("files", entry.file);
                    const docType = entry.docType !== "other"
                        ? entry.docType.toLowerCase()
                        : typeByFilename(entry.file.name);
                    types.push(docType);
                }
                formDataUpload.append("types", JSON.stringify(types));

                try {
                    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "https://api.apaarpulse.com/api/v1";
                    const uploadRes = await fetch(`${baseUrl}/documents/upload/multiple/${result.id}`, {
                        method: "POST",
                        headers: { Authorization: `Bearer ${token}` },
                        body: formDataUpload,
                    });
                    if (!uploadRes.ok) {
                        const errBody = await uploadRes.json().catch(() => ({}));
                        console.warn("Document upload failed:", uploadRes.status, errBody.message || uploadRes.statusText);
                    }
                } catch (uploadErr) {
                    console.warn("Document upload failed (non-fatal):", uploadErr);
                }
            }

            if (isEditing) {
                router.push(`/employees/${editId}`);
                return;
            }

            setCreatedEmployee({
                id: result.id,
                emp_code: result.emp_code,
                name: result.name,
                email: result.email,
            });
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : `Failed to ${isEditing ? 'update' : 'create'} employee. Please try again.`;
            const axiosErr = err as { response?: { status?: number; data?: { message?: string; errors?: Record<string, string[]> } } };
            const errMsg = axiosErr?.response?.data?.message || msg;
            if (errMsg.toLowerCase().includes("resigned") || axiosErr?.response?.status === 409) {
                setIsResignedError(true);
            }
            if (axiosErr?.response?.data?.message) {
                setError(axiosErr.response.data.message);
            } else if (axiosErr?.response?.data?.errors) {
                const fieldErrors = Object.values(axiosErr.response.data.errors).flat().join("; ");
                setError(fieldErrors || msg);
            } else {
                setError(msg);
            }
        } finally {
            setSubmitting(false);
        }
    };

    // ── Offer Letter Actions ──
    const handlePreviewOfferLetter = async () => {
        if (!createdEmployee) return;
        setOfferLetterPreviewing(true);
        try {
            const token = localStorage.getItem("hrms_auth_token");
            const baseUrl = process.env.NEXT_PUBLIC_API_URL || "https://api.apaarpulse.com/api/v1";
            const res = await fetch(`${baseUrl}/letters/offer-letter/${createdEmployee.id}/preview`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({ message: "Failed to generate preview" }));
                throw new Error(err.message || "Failed to generate preview");
            }
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            window.open(url, "_blank");
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Failed to preview offer letter";
            setOfferLetterSendingError(msg);
        } finally {
            setOfferLetterPreviewing(false);
        }
    };

    const handleSendOfferLetter = async () => {
        if (!createdEmployee) return;
        setOfferLetterSending(true);
        setOfferLetterSendingError(null);
        try {
            const token = localStorage.getItem("hrms_auth_token");
            const baseUrl = process.env.NEXT_PUBLIC_API_URL || "https://api.apaarpulse.com/api/v1";
            const res = await fetch(`${baseUrl}/letters/offer-letter/${createdEmployee.id}/send`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ password: "Welcome@123" }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({ message: "Failed to send offer letter" }));
                throw new Error(err.message || "Failed to send offer letter");
            }
            setOfferLetterSent(true);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Failed to send offer letter";
            setOfferLetterSendingError(msg);
        } finally {
            setOfferLetterSending(false);
        }
    };

    const handleGoToEmployees = () => {
        router.push("/employees");
    };

    const renderApprovalSalaryPreview = () => {
        const fixedGross = Number(approvalOverrides.fixed_gross) || 0;
        if (fixedGross <= 0) return null;

        // Req 2.4: 50% Basic Salary of Gross/CTC
        const basic = Math.round(fixedGross * 0.50);
        const hraApplicable = approvalOverrides.hra_applicable !== "No";
        const hra = hraApplicable ? Math.round(basic * 0.40) : 0;
        const conveyance = Number(approvalOverrides.conveyance) || 0;
        const medicalAllowance = Number(approvalOverrides.medical_allowance) || 0;
        const specialAllowance = Number(approvalOverrides.special_allowance) || 0;
        const performanceAllowance = Number(approvalOverrides.performance_allowance) || 0;

        const other = Math.max(0, fixedGross - (basic + hra + conveyance + medicalAllowance + specialAllowance + performanceAllowance));
        const grossSalary = basic + hra + conveyance + medicalAllowance + specialAllowance + performanceAllowance + other;

        let pfBase = basic;
        if (approvalOverrides.pf_applicable === "Yes" && approvalOverrides.pf_ceiling === "Yes") {
            pfBase = Math.min(basic, 15000);
        }

        let pfEmployee = 0;
        let pfEmployer = 0;
        if (approvalOverrides.pf_applicable === "Yes") {
            const pEmpRate = parseFloat(approvalOverrides.pf_employee_rate) || 0.12;
            const pEmprRate = parseFloat(approvalOverrides.pf_employer_rate) || 0.12;
            if (approvalOverrides.pf_contribution_mode === "shared") {
                pfEmployee = Math.round(pfBase * pEmpRate);
                pfEmployer = Math.round(pfBase * pEmprRate);
            } else if (approvalOverrides.pf_contribution_mode === "employee_only") {
                pfEmployee = Math.round(pfBase * pEmpRate);
            } else if (approvalOverrides.pf_contribution_mode === "employer_only") {
                pfEmployer = Math.round(pfBase * pEmprRate);
            }
        }

        let esiEmployee = 0;
        let esiEmployer = 0;
        if (approvalOverrides.esic_applicable === "Yes") {
            const eEmpRate = parseFloat(approvalOverrides.esic_employee_rate) || 0.0075;
            const eEmprRate = parseFloat(approvalOverrides.esic_employer_rate) || 0.0325;
            if (approvalOverrides.esic_contribution_mode === "shared") {
                esiEmployee = Math.ceil(fixedGross * eEmpRate);
                esiEmployer = Math.ceil(fixedGross * eEmprRate);
            } else if (approvalOverrides.esic_contribution_mode === "employee_only") {
                esiEmployee = Math.ceil(fixedGross * eEmpRate);
            } else if (approvalOverrides.esic_contribution_mode === "employer_only") {
                esiEmployer = Math.ceil(fixedGross * eEmprRate);
            }
        }

        let professionalTax = 0;
        if (approvalOverrides.pt_applicable === "Yes") {
            if (fixedGross >= 15001 && fixedGross <= 25000) professionalTax = 125;
            else if (fixedGross >= 25001 && fixedGross <= 33333) professionalTax = 167;
            else if (fixedGross >= 33334) professionalTax = 208;
        }

        const totalDeductions = pfEmployee + esiEmployee + professionalTax;
        const netSalary = grossSalary - totalDeductions;
        const monthlyCTC = grossSalary + pfEmployer + esiEmployer;
        const annualCTC = monthlyCTC * 12;

        return (
            <div className="p-5 bg-slate-900 rounded-2xl text-white shadow-xl space-y-5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                        <Calculator className="h-4 w-4 text-[#D9F99D]" />
                        <h4 className="text-xs font-black italic uppercase tracking-widest text-[#D9F99D]">
                            Salary Preview & Structure Summary (Req 2.4)
                        </h4>
                    </div>
                    <Badge className="bg-slate-800 text-slate-300 text-[9px] font-bold">
                        Basic @ 50% of CTC
                    </Badge>
                </div>

                {/* ── Summary Metrics Grid (Req 2.4 Mandatory 6) ── */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                    <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
                        <p className="text-[8px] font-black text-amber-400 uppercase tracking-widest mb-0.5">Monthly CTC</p>
                        <p className="text-sm font-black text-white">₹{monthlyCTC.toLocaleString('en-IN')}</p>
                    </div>
                    <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
                        <p className="text-[8px] font-black text-amber-400 uppercase tracking-widest mb-0.5">Annual CTC</p>
                        <p className="text-sm font-black text-white">₹{annualCTC.toLocaleString('en-IN')}</p>
                    </div>
                    <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Basic (50%)</p>
                        <p className="text-sm font-black text-white">₹{basic.toLocaleString('en-IN')}</p>
                    </div>
                    <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Gross Salary</p>
                        <p className="text-sm font-black text-white">₹{grossSalary.toLocaleString('en-IN')}</p>
                    </div>
                    <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
                        <p className="text-[8px] font-black text-rose-400 uppercase tracking-widest mb-0.5">Total Deductions</p>
                        <p className="text-sm font-black text-rose-300">-₹{totalDeductions.toLocaleString('en-IN')}</p>
                    </div>
                    <div className="bg-[#D9F99D]/15 p-3 rounded-xl border border-[#D9F99D]/30">
                        <p className="text-[8px] font-black text-[#D9F99D] uppercase tracking-widest mb-0.5">Net Take Home</p>
                        <p className="text-sm font-black text-[#D9F99D]">₹{netSalary.toLocaleString('en-IN')}</p>
                    </div>
                </div>

                {/* ── Component Breakdown Columns ── */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-slate-800 text-xs">
                    {/* Left: Earnings Components */}
                    <div className="bg-slate-800/40 p-3.5 rounded-xl border border-slate-700/50 space-y-2">
                        <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-2 flex items-center justify-between">
                            <span>Earnings Breakdown</span>
                            <span className="text-white/60 font-mono">Gross: ₹{grossSalary.toLocaleString('en-IN')}</span>
                        </p>
                        <div className="space-y-1.5 font-bold text-white/90 text-[11px]">
                            <div className="flex justify-between items-center bg-slate-800/60 px-2.5 py-1.5 rounded-lg">
                                <span className="text-white/70">Basic Salary (50% of CTC)</span>
                                <span className="font-mono text-white">₹{basic.toLocaleString('en-IN')}</span>
                            </div>
                            <div className="flex justify-between items-center bg-slate-800/60 px-2.5 py-1.5 rounded-lg">
                                <span className="text-white/70 flex items-center gap-1.5">
                                    <span>HRA</span>
                                    {!hraApplicable && <span className="text-[8px] text-amber-400 px-1 py-0.2 bg-amber-400/10 rounded">Opted Out</span>}
                                </span>
                                <span className="font-mono text-white">₹{hra.toLocaleString('en-IN')}</span>
                            </div>
                            {conveyance > 0 && (
                                <div className="flex justify-between items-center bg-slate-800/60 px-2.5 py-1.5 rounded-lg">
                                    <span className="text-white/70">Conveyance Allowance</span>
                                    <span className="font-mono text-white">₹{conveyance.toLocaleString('en-IN')}</span>
                                </div>
                            )}
                            {medicalAllowance > 0 && (
                                <div className="flex justify-between items-center bg-slate-800/60 px-2.5 py-1.5 rounded-lg">
                                    <span className="text-white/70">Medical Allowance</span>
                                    <span className="font-mono text-white">₹{medicalAllowance.toLocaleString('en-IN')}</span>
                                </div>
                            )}
                            {specialAllowance > 0 && (
                                <div className="flex justify-between items-center bg-slate-800/60 px-2.5 py-1.5 rounded-lg">
                                    <span className="text-white/70">Special Allowance</span>
                                    <span className="font-mono text-white">₹{specialAllowance.toLocaleString('en-IN')}</span>
                                </div>
                            )}
                            {performanceAllowance > 0 && (
                                <div className="flex justify-between items-center bg-slate-800/60 px-2.5 py-1.5 rounded-lg">
                                    <span className="text-white/70">Performance Allowance</span>
                                    <span className="font-mono text-white">₹{performanceAllowance.toLocaleString('en-IN')}</span>
                                </div>
                            )}
                            <div className="flex justify-between items-center bg-slate-800/60 px-2.5 py-1.5 rounded-lg">
                                <span className="text-white/70">Other Allowance (Balancing)</span>
                                <span className="font-mono text-white">₹{other.toLocaleString('en-IN')}</span>
                            </div>
                        </div>
                    </div>

                    {/* Right: Deductions & Employer Contributions */}
                    <div className="space-y-4">
                        <div className="bg-slate-800/40 p-3.5 rounded-xl border border-slate-700/50 space-y-2">
                            <p className="text-[9px] font-black text-rose-400 uppercase tracking-widest mb-2 flex items-center justify-between">
                                <span>Employee Deductions</span>
                                <span className="text-rose-400 font-mono">Total: -₹{totalDeductions.toLocaleString('en-IN')}</span>
                            </p>
                            <div className="space-y-1.5 font-bold text-[11px]">
                                {pfEmployee > 0 ? (
                                    <div className="flex justify-between items-center bg-slate-800/60 px-2.5 py-1.5 rounded-lg">
                                        <span className="text-white/70">PF Contribution</span>
                                        <span className="text-rose-400 font-mono">-₹{pfEmployee.toLocaleString('en-IN')}</span>
                                    </div>
                                ) : (
                                    <div className="flex justify-between items-center bg-slate-800/30 px-2.5 py-1.5 rounded-lg text-slate-500">
                                        <span>PF Contribution</span>
                                        <span>Exempt / None</span>
                                    </div>
                                )}
                                {esiEmployee > 0 ? (
                                    <div className="flex justify-between items-center bg-slate-800/60 px-2.5 py-1.5 rounded-lg">
                                        <span className="text-white/70">ESIC Contribution</span>
                                        <span className="text-rose-400 font-mono">-₹{esiEmployee.toLocaleString('en-IN')}</span>
                                    </div>
                                ) : (
                                    <div className="flex justify-between items-center bg-slate-800/30 px-2.5 py-1.5 rounded-lg text-slate-500">
                                        <span>ESIC Contribution</span>
                                        <span>Exempt / None</span>
                                    </div>
                                )}
                                {professionalTax > 0 && (
                                    <div className="flex justify-between items-center bg-slate-800/60 px-2.5 py-1.5 rounded-lg">
                                        <span className="text-white/70">Professional Tax (PT)</span>
                                        <span className="text-rose-400 font-mono">-₹{professionalTax.toLocaleString('en-IN')}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="bg-slate-800/40 p-3.5 rounded-xl border border-slate-700/50 space-y-2">
                            <p className="text-[9px] font-black text-amber-400 uppercase tracking-widest mb-2">
                                Employer Contributions (CTC Cost)
                            </p>
                            <div className="space-y-1.5 font-bold text-[11px]">
                                {pfEmployer > 0 && (
                                    <div className="flex justify-between items-center bg-slate-800/60 px-2.5 py-1.5 rounded-lg">
                                        <span className="text-white/70">Employer PF Contribution</span>
                                        <span className="text-emerald-400 font-mono">+₹{pfEmployer.toLocaleString('en-IN')}</span>
                                    </div>
                                )}
                                {esiEmployer > 0 && (
                                    <div className="flex justify-between items-center bg-slate-800/60 px-2.5 py-1.5 rounded-lg">
                                        <span className="text-white/70">Employer ESIC Contribution</span>
                                        <span className="text-emerald-400 font-mono">+₹{esiEmployer.toLocaleString('en-IN')}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderSalaryPreview = () => {
        const fixedGross = Number(formData.fixedGross) || 0;
        if (fixedGross <= 0) return null;

        // Req 2.4: 50% Basic Salary of Gross/CTC
        const basic = Math.round(fixedGross * 0.50);
        const hraApplicable = formData.hraApplicable !== "No";
        const hra = hraApplicable ? Math.round(basic * 0.40) : 0;
        const conveyance = Number(formData.conveyance) || 0;
        const medicalAllowance = Number(formData.medicalAllowance) || 0;
        const specialAllowance = Number(formData.specialAllowance) || 0;
        const performanceAllowance = Number(formData.performanceAllowance) || 0;

        const other = Math.max(0, fixedGross - (basic + hra + conveyance + medicalAllowance + specialAllowance + performanceAllowance));
        const grossSalary = basic + hra + conveyance + medicalAllowance + specialAllowance + performanceAllowance + other;

        let pfBase = basic;
        if (formData.pfApplicable === "Yes" && formData.pfCeiling === "Yes") {
            pfBase = Math.min(basic, 15000);
        }

        let pfEmployee = 0;
        let pfEmployer = 0;
        if (formData.pfApplicable === "Yes") {
            const pEmpRate = parseFloat(formData.pfEmployeeRate) || 0.12;
            const pEmprRate = parseFloat(formData.pfEmployerRate) || 0.12;
            if (formData.pfContributionMode === "shared") {
                pfEmployee = Math.round(pfBase * pEmpRate);
                pfEmployer = Math.round(pfBase * pEmprRate);
            } else if (formData.pfContributionMode === "employee_only") {
                pfEmployee = Math.round(pfBase * pEmpRate);
            } else if (formData.pfContributionMode === "employer_only") {
                pfEmployer = Math.round(pfBase * pEmprRate);
            }
        }

        let esiEmployee = 0;
        let esiEmployer = 0;
        if (formData.esicApplicable === "Yes") {
            const eEmpRate = parseFloat(formData.esicEmployeeRate) || 0.0075;
            const eEmprRate = parseFloat(formData.esicEmployerRate) || 0.0325;
            if (formData.esicContributionMode === "shared") {
                esiEmployee = Math.ceil(fixedGross * eEmpRate);
                esiEmployer = Math.ceil(fixedGross * eEmprRate);
            } else if (formData.esicContributionMode === "employee_only") {
                esiEmployee = Math.ceil(fixedGross * eEmpRate);
            } else if (formData.esicContributionMode === "employer_only") {
                esiEmployer = Math.ceil(fixedGross * eEmprRate);
            }
        }

        let professionalTax = 0;
        if (formData.ptApplicable === "Yes") {
            if (fixedGross >= 15001 && fixedGross <= 25000) professionalTax = 125;
            else if (fixedGross >= 25001 && fixedGross <= 33333) professionalTax = 167;
            else if (fixedGross >= 33334) professionalTax = 208;
        }

        const totalDeductions = pfEmployee + esiEmployee + professionalTax;
        const netSalary = grossSalary - totalDeductions;
        const monthlyCTC = grossSalary + pfEmployer + esiEmployer;
        const annualCTC = monthlyCTC * 12;

        return (
            <div className="mt-8 p-6 bg-slate-900 rounded-[2rem] text-white shadow-xl animate-in slide-in-from-bottom-4 space-y-6">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                    <div className="flex items-center gap-2">
                        <Calculator className="h-5 w-5 text-[#D9F99D]" />
                        <h3 className="text-sm font-black italic uppercase tracking-widest text-[#D9F99D]">
                            Live Salary Preview & Structure Summary (Req 2.4)
                        </h3>
                    </div>
                    <Badge className="bg-slate-800 text-slate-300 text-[10px] font-bold">
                        Basic @ 50% of CTC
                    </Badge>
                </div>

                {/* ── Summary Metrics Grid (Req 2.4 Mandatory 6) ── */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700/60">
                        <p className="text-[9px] font-black text-amber-400 uppercase tracking-widest mb-1">Monthly CTC</p>
                        <p className="text-base font-black text-white">₹{monthlyCTC.toLocaleString('en-IN')}</p>
                    </div>
                    <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700/60">
                        <p className="text-[9px] font-black text-amber-400 uppercase tracking-widest mb-1">Annual CTC</p>
                        <p className="text-base font-black text-white">₹{annualCTC.toLocaleString('en-IN')}</p>
                    </div>
                    <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700/60">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Basic (50%)</p>
                        <p className="text-base font-black text-white">₹{basic.toLocaleString('en-IN')}</p>
                    </div>
                    <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700/60">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Gross Salary</p>
                        <p className="text-base font-black text-white">₹{grossSalary.toLocaleString('en-IN')}</p>
                    </div>
                    <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700/60">
                        <p className="text-[9px] font-black text-rose-400 uppercase tracking-widest mb-1">Total Deductions</p>
                        <p className="text-base font-black text-rose-300">-₹{totalDeductions.toLocaleString('en-IN')}</p>
                    </div>
                    <div className="bg-[#D9F99D]/15 p-4 rounded-2xl border border-[#D9F99D]/30">
                        <p className="text-[9px] font-black text-[#D9F99D] uppercase tracking-widest mb-1">Net Take Home</p>
                        <p className="text-base font-black text-[#D9F99D]">₹{netSalary.toLocaleString('en-IN')}</p>
                    </div>
                </div>

                {/* ── Component Breakdown Columns ── */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-800">
                    {/* Left: Earnings Components */}
                    <div className="bg-slate-800/40 p-4 rounded-2xl border border-slate-700/50 space-y-3">
                        <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-2 flex items-center justify-between">
                            <span>Earnings Breakdown</span>
                            <span className="text-white/60 font-mono text-xs">Gross: ₹{grossSalary.toLocaleString('en-IN')}</span>
                        </p>
                        <div className="space-y-2 font-bold text-white/90 text-xs">
                            <div className="flex justify-between items-center bg-slate-800/60 p-2.5 rounded-xl">
                                <span className="text-white/80">Basic Salary (50% of CTC)</span>
                                <span className="font-mono text-white">₹{basic.toLocaleString('en-IN')}</span>
                            </div>
                            <div className="flex justify-between items-center bg-slate-800/60 p-2.5 rounded-xl">
                                <span className="text-white/80 flex items-center gap-2">
                                    <span>House Rent Allowance (HRA)</span>
                                    {!hraApplicable && <span className="text-[9px] text-amber-400 px-1.5 py-0.5 bg-amber-400/10 rounded">Disabled</span>}
                                </span>
                                <span className="font-mono text-white">₹{hra.toLocaleString('en-IN')}</span>
                            </div>
                            {conveyance > 0 && (
                                <div className="flex justify-between items-center bg-slate-800/60 p-2.5 rounded-xl">
                                    <span className="text-white/80">Conveyance Allowance</span>
                                    <span className="font-mono text-white">₹{conveyance.toLocaleString('en-IN')}</span>
                                </div>
                            )}
                            {medicalAllowance > 0 && (
                                <div className="flex justify-between items-center bg-slate-800/60 p-2.5 rounded-xl">
                                    <span className="text-white/80">Medical Allowance</span>
                                    <span className="font-mono text-white">₹{medicalAllowance.toLocaleString('en-IN')}</span>
                                </div>
                            )}
                            {specialAllowance > 0 && (
                                <div className="flex justify-between items-center bg-slate-800/60 p-2.5 rounded-xl">
                                    <span className="text-white/80">Special Allowance</span>
                                    <span className="font-mono text-white">₹{specialAllowance.toLocaleString('en-IN')}</span>
                                </div>
                            )}
                            {performanceAllowance > 0 && (
                                <div className="flex justify-between items-center bg-slate-800/60 p-2.5 rounded-xl">
                                    <span className="text-white/80">Performance Allowance</span>
                                    <span className="font-mono text-white">₹{performanceAllowance.toLocaleString('en-IN')}</span>
                                </div>
                            )}
                            <div className="flex justify-between items-center bg-slate-800/60 p-2.5 rounded-xl">
                                <span className="text-white/80">Other Allowance (Balancing)</span>
                                <span className="font-mono text-white">₹{other.toLocaleString('en-IN')}</span>
                            </div>
                        </div>
                    </div>

                    {/* Right: Deductions & Employer Contributions */}
                    <div className="space-y-4">
                        <div className="bg-slate-800/40 p-4 rounded-2xl border border-slate-700/50 space-y-3">
                            <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-2 flex items-center justify-between">
                                <span>Employee Deductions</span>
                                <span className="text-rose-400 font-mono text-xs">Total: -₹{totalDeductions.toLocaleString('en-IN')}</span>
                            </p>
                            <div className="space-y-2 font-bold text-xs">
                                {pfEmployee > 0 ? (
                                    <div className="flex justify-between items-center bg-slate-800/60 p-2.5 rounded-xl">
                                        <span className="text-white/80">PF Contribution</span>
                                        <span className="text-rose-400 font-mono">-₹{pfEmployee.toLocaleString('en-IN')}</span>
                                    </div>
                                ) : (
                                    <div className="flex justify-between items-center bg-slate-800/30 p-2.5 rounded-xl text-slate-500">
                                        <span>PF Contribution</span>
                                        <span>Exempt / None</span>
                                    </div>
                                )}
                                {esiEmployee > 0 ? (
                                    <div className="flex justify-between items-center bg-slate-800/60 p-2.5 rounded-xl">
                                        <span className="text-white/80">ESIC Contribution</span>
                                        <span className="text-rose-400 font-mono">-₹{esiEmployee.toLocaleString('en-IN')}</span>
                                    </div>
                                ) : (
                                    <div className="flex justify-between items-center bg-slate-800/30 p-2.5 rounded-xl text-slate-500">
                                        <span>ESIC Contribution</span>
                                        <span>Exempt / None</span>
                                    </div>
                                )}
                                {professionalTax > 0 && (
                                    <div className="flex justify-between items-center bg-slate-800/60 p-2.5 rounded-xl">
                                        <span className="text-white/80">Professional Tax (PT)</span>
                                        <span className="text-rose-400 font-mono">-₹{professionalTax.toLocaleString('en-IN')}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="bg-slate-800/40 p-4 rounded-2xl border border-slate-700/50 space-y-3">
                            <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-2">
                                Employer Contributions (CTC Cost)
                            </p>
                            <div className="space-y-2 font-bold text-xs">
                                {pfEmployer > 0 && (
                                    <div className="flex justify-between items-center bg-slate-800/60 p-2.5 rounded-xl">
                                        <span className="text-white/80">Employer PF Contribution</span>
                                        <span className="text-emerald-400 font-mono">+₹{pfEmployer.toLocaleString('en-IN')}</span>
                                    </div>
                                )}
                                {esiEmployer > 0 && (
                                    <div className="flex justify-between items-center bg-slate-800/60 p-2.5 rounded-xl">
                                        <span className="text-white/80">Employer ESIC Contribution</span>
                                        <span className="text-emerald-400 font-mono">+₹{esiEmployer.toLocaleString('en-IN')}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <ProtectedRoute module="EMPLOYEES" action="CREATE">
            <div className="max-w-4xl mx-auto space-y-12 pb-20 px-4 md:px-0">
                {createdEmployee ? (
                    /* ── SUCCESS SCREEN ── */
                    <div className="flex flex-col items-center justify-center space-y-10 pt-10 animate-in fade-in zoom-in-95">
                        <div className="h-20 w-20 bg-emerald-100 rounded-[2rem] flex items-center justify-center shadow-xl shadow-emerald-100/30">
                            <CheckCircle className="h-10 w-10 text-emerald-600" />
                        </div>
                        <div className="text-center space-y-2">
                            <h3 className="text-3xl font-black text-slate-900 italic uppercase tracking-tighter">
                                Employee Added!
                            </h3>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                {createdEmployee.name} ({createdEmployee.emp_code}) has been created successfully.
                            </p>
                        </div>

                        {/* Offer Letter Actions Card */}
                        <Card className="w-full max-w-lg border-none shadow-sm rounded-[2.5rem] bg-white p-8">
                            <CardHeader className="px-0 pt-0 pb-6 border-b border-slate-50">
                                <CardTitle className="text-lg font-black text-slate-900 italic tracking-tighter uppercase flex items-center gap-2">
                                    <FileText className="h-5 w-5 text-amber-500" />
                                    Generate Offer Letter
                                </CardTitle>
                                <CardDescription className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                    Head over to the Letters module to generate and send a perfectly formatted Offer Letter for {createdEmployee.email}.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="px-0 py-6 space-y-4">
                                <div className="grid grid-cols-1 gap-3">
                                    <Button
                                        onClick={() => router.push(`/letters?employeeId=${createdEmployee.id}&templateType=offer_letter`)}
                                        className="h-12 rounded-xl bg-amber-50 text-amber-700 hover:bg-amber-100 hover:text-amber-800 font-black text-[10px] uppercase tracking-widest border border-amber-200 transition-all flex items-center justify-center gap-2"
                                    >
                                        <Eye className="h-4 w-4" /> Go to Letters Module
                                    </Button>
                                    <Button
                                        onClick={() => router.push('/employees')}
                                        className="h-12 rounded-xl bg-slate-900 text-white hover:bg-black font-black text-[10px] uppercase tracking-[0.3em] shadow-2xl shadow-slate-200 transition-all flex items-center justify-center gap-2"
                                    >
                                        Go to Employees List
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                ) : (
                    <>
                        {/* Header section with Tabs & Actions */}
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pt-6">
                            <div>
                                <h1 className="text-2xl font-black text-slate-900 italic uppercase tracking-tighter underline underline-offset-8 decoration-[#D9F99D] decoration-2">
                                    Employee Onboarding
                                </h1>
                                <p className="text-[9px] font-black text-slate-400 mt-4 uppercase tracking-[0.3em]">
                                    Direct internal entry & candidate self-onboarding review
                                </p>
                            </div>

                            <div className="flex items-center gap-2">
                                <div className="flex p-1 bg-slate-100 rounded-2xl border border-slate-200">
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab("direct")}
                                        className={cn(
                                            "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all",
                                            activeTab === "direct"
                                                ? "bg-white text-slate-900 shadow-sm"
                                                : "text-slate-500 hover:text-slate-900"
                                        )}
                                    >
                                        Direct HR Form
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab("submissions")}
                                        className={cn(
                                            "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5",
                                            activeTab === "submissions"
                                                ? "bg-white text-slate-900 shadow-sm"
                                                : "text-slate-500 hover:text-slate-900"
                                        )}
                                    >
                                        Candidate Submissions
                                        {safeInvitations.filter((i) => i.status === "submitted").length > 0 && (
                                            <span className="h-4 px-1.5 rounded-full bg-emerald-500 text-white font-mono text-[9px] font-bold flex items-center justify-center">
                                                {safeInvitations.filter((i) => i.status === "submitted").length}
                                            </span>
                                        )}
                                    </button>
                                </div>

                                <Button
                                    type="button"
                                    onClick={() => {
                                        setInviteSuccessLink(null);
                                        setInviteError(null);
                                        setInviteDialogOpen(true);
                                    }}
                                    className="bg-indigo-600 text-white hover:bg-indigo-700 font-black uppercase text-[10px] tracking-widest px-4 h-11 rounded-xl shadow-lg transition-all flex items-center gap-2"
                                >
                                    <Send className="h-3.5 w-3.5" /> Send Invite Link
                                </Button>
                            </div>
                        </div>

                        {/* Req 23: Resigned Conflict Alert Banner */}
                        {isResignedError && (
                            <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 text-amber-900 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md animate-in fade-in">
                                <div className="flex items-center gap-3">
                                    <AlertCircle className="h-6 w-6 text-amber-600 shrink-0" />
                                    <div>
                                        <p className="font-black text-amber-950 uppercase tracking-wider text-[11px]">
                                            Resigned Employee Detected (Req 23)
                                        </p>
                                        <p className="text-xs text-amber-800 mt-0.5">
                                            This person is an existing employee marked as <strong>Resigned</strong>. Creating a new profile is blocked to prevent accidental duplicate records. Please use the Re-Hiring workflow instead.
                                        </p>
                                    </div>
                                </div>
                                <Button
                                    type="button"
                                    onClick={() => router.push("/employees")}
                                    className="bg-amber-600 text-white hover:bg-amber-700 font-black uppercase text-[10px] tracking-wider px-5 h-10 rounded-xl shrink-0"
                                >
                                    Go to Re-Hire
                                </Button>
                            </div>
                        )}

                        {activeTab === "submissions" ? (
                            <div className="space-y-6 pt-4">
                                <div className="flex items-center justify-between px-2">
                                    <div>
                                        <h3 className="text-lg font-black uppercase tracking-tight text-slate-900">
                                            Candidate Applications ({safeInvitations.length})
                                        </h3>
                                        <p className="text-xs text-slate-500">
                                            Review details submitted by candidates and approve with 1 click to create active employees.
                                        </p>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={fetchInvitations}
                                        className="h-9 text-xs font-bold rounded-xl"
                                    >
                                        <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
                                    </Button>
                                </div>

                                {invitationsLoading ? (
                                    <div className="flex justify-center p-12">
                                        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                                    </div>
                                ) : safeInvitations.length === 0 ? (
                                    <Card className="p-12 text-center rounded-3xl border-dashed border-2 border-slate-200 bg-white">
                                        <UserCheck className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                                        <h4 className="font-bold text-slate-700 text-sm">No Candidate Invites Yet</h4>
                                        <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                                            Click &quot;Send Invite Link&quot; above to email a secure self-onboarding link to prospective candidates.
                                        </p>
                                    </Card>
                                ) : (
                                    <div className="grid grid-cols-1 gap-3">
                                        {safeInvitations.map((inv) => {
                                            const isSubmitted = inv.status === "submitted";
                                            const isApproved = inv.status === "approved";
                                            return (
                                                <div
                                                    key={inv.id}
                                                    className="p-5 bg-white rounded-2xl border border-slate-200 flex flex-col md:flex-row md:items-center md:justify-between gap-4 shadow-sm hover:shadow transition-shadow"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-11 w-11 rounded-2xl bg-slate-900 text-[#D9F99D] flex items-center justify-center font-black text-sm shadow">
                                                            {inv.candidate_name?.slice(0, 2).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <h4 className="font-black text-sm text-slate-900">{inv.candidate_name}</h4>
                                                                <Badge
                                                                    className={cn(
                                                                        "text-[9px] font-bold uppercase",
                                                                        isSubmitted && "bg-emerald-100 text-emerald-800",
                                                                        isApproved && "bg-slate-100 text-slate-700",
                                                                        inv.status === "invited" && "bg-amber-100 text-amber-800",
                                                                        inv.status === "expired" && "bg-red-100 text-red-800"
                                                                    )}
                                                                >
                                                                    {inv.status}
                                                                </Badge>
                                                            </div>
                                                            <p className="text-xs text-slate-500 font-medium mt-0.5">{inv.email} {inv.phone && `• ${inv.phone}`}</p>
                                                            <p className="text-[10px] text-slate-400 mt-0.5">
                                                                Expires: {new Date(inv.expires_at).toLocaleDateString()}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2">
                                                        {isSubmitted && (
                                                            <Button
                                                                onClick={() => {
                                                                    setReviewCandidate(inv);
                                                                    const sub = inv.submitted_data || {};
                                                                    const gross = Number(inv.fixed_gross) > 0 
                                                                        ? inv.fixed_gross 
                                                                        : (Number(sub.fixed_gross) > 0 ? sub.fixed_gross : "45000");

                                                                    setApprovalOverrides({
                                                                        name: sub.name || inv.candidate_name || "",
                                                                        email: inv.email || "",
                                                                        phone: sub.phone || inv.phone || "",
                                                                        dob: sub.date_of_birth || "",
                                                                        gender: sub.gender || "male",
                                                                        marital_status: sub.marital_status || "unmarried",
                                                                        father_or_husband_name: sub.father_or_husband_name || sub.father_husband_name || "",
                                                                        address: sub.address || "",
                                                                        pan: sub.pan_number || sub.pan || "",
                                                                        aadhaar: sub.aadhaar_number || sub.aadhaar || "",
                                                                        bankName: sub.bank_name || "",
                                                                        accountNo: sub.bank_account_number || "",
                                                                        ifsc: sub.ifsc_code || "",
                                                                        paymentMode: sub.payment_mode || "Bank Transfer",
                                                                        emergencyName: sub.emergency_contact_name || "",
                                                                        emergencyRelation: sub.emergency_contact_relation || "",
                                                                        emergencyPhone: sub.emergency_contact_phone || sub.emergency_phone || "",

                                                                        working_location: sub.working_location || inv.office?.name || "",
                                                                        designation: sub.designation || inv.designation || "Executive",
                                                                        department: sub.department || inv.department || "Operations",
                                                                        role: "EMPLOYEE",
                                                                        company_id: (inv.company_id || sub.company_id || (companies[0]?.id?.toString()) || "").toString(),
                                                                        office_id: (inv.office_id || sub.office_id || (offices[0]?.id?.toString()) || "").toString(),
                                                                        date_of_joining: sub.date_of_joining || new Date().toISOString().split("T")[0],

                                                                        fixed_gross: gross.toString(),
                                                                        hra_applicable: sub.hra_applicable !== false ? "Yes" : "No",
                                                                        conveyance: sub.conveyance?.toString() || "0",
                                                                        medical_allowance: sub.medical_allowance?.toString() || "0",
                                                                        special_allowance: sub.special_allowance?.toString() || "0",
                                                                        performance_allowance: sub.performance_allowance?.toString() || "0",

                                                                        pf_applicable: sub.pf_applicable !== false ? "Yes" : "No",
                                                                        pf_ceiling: sub.pf_ceiling ? "Yes" : "No",
                                                                        pf_employment_date: sub.pf_employment_date || "",
                                                                        pf_contribution_mode: "shared",
                                                                        pf_employee_rate: "0.12",
                                                                        pf_employer_rate: "0.12",
                                                                        esic_applicable: sub.esic_applicable ? "Yes" : "No",
                                                                        esic_contribution_mode: "shared",
                                                                        esic_employee_rate: "0.0075",
                                                                        esic_employer_rate: "0.0325",
                                                                        pt_applicable: "Yes",
                                                                        pf_number: sub.pf_number || "PF/IND/001",
                                                                        uan: sub.uan || "",
                                                                        esic_number: sub.esic_number || "",
                                                                        lic_details: "",

                                                                        shift_start_time: sub.shift_start_time || "09:30",
                                                                        shift_end_time: sub.shift_end_time || "18:30",
                                                                        is_rotational_shift: Boolean(sub.is_rotational_shift),
                                                                        half_day_late_minutes: "60",
                                                                    });
                                                                }}
                                                                className="bg-emerald-600 text-white hover:bg-emerald-700 font-black uppercase text-[10px] tracking-wider h-10 px-5 rounded-xl shadow"
                                                            >
                                                                <FileCheck className="h-4 w-4 mr-1.5" /> Review & Approve
                                                            </Button>
                                                        )}
                                                        {inv.status === "invited" && (
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => {
                                                                    const url = `${window.location.origin}/self-onboarding?token=${inv.token}`;
                                                                    navigator.clipboard.writeText(url);
                                                                    alert("Invitation link copied to clipboard!");
                                                                }}
                                                                className="text-xs h-9 font-bold rounded-xl"
                                                            >
                                                                <Copy className="h-3 w-3 mr-1" /> Copy Link
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <>
                                {/* Stepper */}
                                <div className="relative flex justify-between items-center px-6 md:px-12">
                            <div className="absolute top-1/2 left-0 w-full h-[1px] bg-slate-100 -translate-y-1/2 z-0" />
                            {steps.map((step, i) => (
                                <div key={i} className="relative z-10 flex flex-col items-center gap-3">
                                    <div
                                        className={cn(
                                            "h-10 w-10 md:h-11 md:w-11 rounded-2xl flex items-center justify-center font-black text-xs transition-all duration-500 border-4",
                                            currentStep >= i
                                                ? "bg-slate-900 border-white text-[#D9F99D] shadow-lg"
                                                : "bg-white border-slate-50 text-slate-200",
                                        )}
                                    >
                                        {currentStep > i ? <CheckCircle className="h-5 w-5" /> : i + 1}
                                    </div>
                                    <span
                                        className={cn(
                                            "text-[7px] md:text-[8px] font-black uppercase tracking-widest hidden md:block",
                                            currentStep >= i ? "text-slate-900" : "text-slate-300",
                                        )}
                                    >
                                        {step}
                                    </span>
                                </div>
                            ))}
                        </div>

                        {/* Main Form Card */}
                        <Card className="border-none shadow-sm rounded-[2.5rem] bg-white p-6 md:p-12">
                            <CardHeader className="px-0 pt-0 pb-10 border-b border-slate-50">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-1">
                                        <CardTitle className="text-2xl font-black text-slate-900 italic tracking-tighter uppercase">
                                            {steps[currentStep]}
                                        </CardTitle>
                                        <CardDescription className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                            Step {currentStep + 1} of {steps.length}
                                        </CardDescription>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {/* ── Fill Dummy Data Button (dev only) ── */}
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={fillDummyData}
                                            disabled={submitting}
                                            className="h-9 px-4 rounded-xl border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:text-amber-800 font-black text-[9px] uppercase tracking-widest transition-all"
                                        >
                                            <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Fill Dummy
                                        </Button>
                                        <div className="h-12 w-12 rounded-2xl bg-slate-50 flex items-center justify-center">
                                            <ShieldCheck className="h-6 w-6 text-slate-200" />
                                        </div>
                                    </div>
                                </div>
                            </CardHeader>

                            <CardContent className="px-0 py-10 min-h-[400px]">
                                {/* Global error banner */}
                                {error && (
                                    <div
                                        ref={(el) => { if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); } }}
                                        className="mb-8 p-5 bg-red-50 border-2 border-red-200 rounded-2xl animate-pulse"
                                    >
                                        <div className="flex items-start gap-3">
                                            <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
                                            <div>
                                                <p className="text-[9px] font-black text-red-500 uppercase tracking-[0.3em] mb-1">Registration Error</p>
                                                <p className="text-xs font-bold text-red-700">{error}</p>
                                                <p className="text-[9px] font-semibold text-red-400 mt-2">If the email is already registered, go to the employee list to delete the duplicate first.</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* ── STEP 0: Personal Info (Req 2.3 A) ── */}
                                {currentStep === 0 && (
                                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                                        {/* Req 1.2: Automatic Sequential Employee ID */}
                                        <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-mono font-bold text-xs shadow">
                                                    ID
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="text-xs font-black uppercase tracking-wider text-indigo-950">
                                                            Company-Specific Employee ID (Req 2.2)
                                                        </h4>
                                                        <Badge className="bg-indigo-600 text-white text-[9px] font-bold">
                                                            Company Prefix Format
                                                        </Badge>
                                                    </div>
                                                    <p className="text-[10px] text-indigo-700 font-medium mt-0.5">
                                                        Company prefix followed by unique sequential identifier (e.g. APA001)
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="w-full sm:w-44">
                                                <Input
                                                    value={customEmpCode}
                                                    onChange={(e) => setCustomEmpCode(e.target.value.toUpperCase())}
                                                    placeholder={suggestedEmpCode || "APA001"}
                                                    className="h-10 bg-white border border-indigo-200 rounded-xl font-mono font-black text-xs text-indigo-950 uppercase"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-7">
                                            {/* 1. Full Name, as per Aadhaar */}
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center">
                                                    Full Name, as per Aadhaar <span className="text-red-500 font-bold ml-1">*</span>
                                                </Label>
                                                <Input
                                                    placeholder="e.g. Rahul Sharma"
                                                    className={inputClass("name", "h-12 bg-slate-50 border-none rounded-xl px-5 font-black text-xs uppercase tracking-widest")}
                                                    value={formData.name}
                                                    onChange={(e) => updateField("name", e.target.value)}
                                                    onBlur={() => handleBlur("name")}
                                                />
                                                {fieldErrorEl("name")}
                                            </div>

                                            {/* 2. Email Address */}
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center">
                                                    Email Address <span className="text-red-500 font-bold ml-1">*</span>
                                                </Label>
                                                <Input
                                                    placeholder="rahul.sharma@apaarlogistics.com"
                                                    className={inputClass("email", "h-12 bg-slate-50 border-none rounded-xl px-5 font-black text-xs lowercase")}
                                                    value={formData.email}
                                                    onChange={(e) => updateField("email", e.target.value)}
                                                    onBlur={() => handleBlur("email")}
                                                />
                                                {fieldErrorEl("email")}
                                            </div>

                                            {/* 3. Mobile Number */}
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center">
                                                    Mobile Number <span className="text-red-500 font-bold ml-1">*</span>
                                                </Label>
                                                <Input
                                                    placeholder="9876543210"
                                                    className={inputClass("phone", "h-12 bg-slate-50 border-none rounded-xl px-5 font-black text-xs")}
                                                    value={formData.phone}
                                                    onChange={(e) => updateField("phone", e.target.value)}
                                                    onBlur={() => handleBlur("phone")}
                                                />
                                                {fieldErrorEl("phone")}
                                            </div>

                                            {/* 4. Gender */}
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center">
                                                    Gender <span className="text-red-500 font-bold ml-1">*</span>
                                                </Label>
                                                <select
                                                    className="w-full h-12 bg-slate-50 border-none rounded-xl px-5 font-black text-[10px] uppercase tracking-widest outline-none"
                                                    value={formData.gender}
                                                    onChange={(e) => updateField("gender", e.target.value)}
                                                >
                                                    <option value="male">Male</option>
                                                    <option value="female">Female</option>
                                                    <option value="other">Other</option>
                                                </select>
                                                {fieldErrorEl("gender")}
                                            </div>

                                            {/* 5. Date of Birth */}
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center">
                                                    Date of Birth <span className="text-red-500 font-bold ml-1">*</span>
                                                </Label>
                                                <Input
                                                    type="date"
                                                    className={inputClass("dob", "h-12 bg-slate-50 border-none rounded-xl px-5 font-black text-xs")}
                                                    value={formData.dob}
                                                    onChange={(e) => updateField("dob", e.target.value)}
                                                    onBlur={() => handleBlur("dob")}
                                                />
                                                {fieldErrorEl("dob")}
                                            </div>

                                            {/* 6. Date of Joining */}
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center">
                                                    Date of Joining <span className="text-red-500 font-bold ml-1">*</span>
                                                </Label>
                                                <Input
                                                    type="date"
                                                    className={inputClass("doj", "h-12 bg-slate-50 border-none rounded-xl px-5 font-black text-xs")}
                                                    value={formData.doj}
                                                    onChange={(e) => updateField("doj", e.target.value)}
                                                    onBlur={() => handleBlur("doj")}
                                                />
                                                {fieldErrorEl("doj")}
                                            </div>

                                            {/* 7. Marital Status */}
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center">
                                                    Marital Status <span className="text-red-500 font-bold ml-1">*</span>
                                                </Label>
                                                <select
                                                    className="w-full h-12 bg-slate-50 border-none rounded-xl px-5 font-black text-[10px] uppercase tracking-widest outline-none"
                                                    value={formData.maritalStatus}
                                                    onChange={(e) => updateField("maritalStatus", e.target.value)}
                                                    onBlur={() => handleBlur("maritalStatus")}
                                                >
                                                    <option value="unmarried">Unmarried</option>
                                                    <option value="married">Married</option>
                                                </select>
                                                {fieldErrorEl("maritalStatus")}
                                            </div>

                                            {/* 8. Father's Name / Husband's Name */}
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center">
                                                    Father&apos;s Name / Husband&apos;s Name <span className="text-red-500 font-bold ml-1">*</span>
                                                </Label>
                                                <Input
                                                    placeholder="e.g. Omprakash Sharma"
                                                    className={inputClass("fatherOrHusbandName", "h-12 bg-slate-50 border-none rounded-xl px-5 font-black text-xs uppercase tracking-widest")}
                                                    value={formData.fatherOrHusbandName}
                                                    onChange={(e) => updateField("fatherOrHusbandName", e.target.value)}
                                                    onBlur={() => handleBlur("fatherOrHusbandName")}
                                                />
                                                {fieldErrorEl("fatherOrHusbandName")}
                                            </div>

                                            {/* 9. Emergency Contact Name */}
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center">
                                                    Emergency Contact Name <span className="text-red-500 font-bold ml-1">*</span>
                                                </Label>
                                                <Input
                                                    placeholder="e.g. Priya Sharma"
                                                    className={inputClass("emergencyName", "h-12 bg-slate-50 border-none rounded-xl px-5 font-black text-xs uppercase tracking-widest")}
                                                    value={formData.emergencyName}
                                                    onChange={(e) => updateField("emergencyName", e.target.value)}
                                                    onBlur={() => handleBlur("emergencyName")}
                                                />
                                                {fieldErrorEl("emergencyName")}
                                            </div>

                                            {/* 10. Emergency Contact Number */}
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center">
                                                    Emergency Contact Number <span className="text-red-500 font-bold ml-1">*</span>
                                                </Label>
                                                <Input
                                                    placeholder="9876543211"
                                                    className={inputClass("emergencyPhone", "h-12 bg-slate-50 border-none rounded-xl px-5 font-black text-xs")}
                                                    value={formData.emergencyPhone}
                                                    onChange={(e) => updateField("emergencyPhone", e.target.value)}
                                                    onBlur={() => handleBlur("emergencyPhone")}
                                                />
                                                {fieldErrorEl("emergencyPhone")}
                                            </div>

                                            {/* 11. Emergency Contact Relationship */}
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center">
                                                    Emergency Contact Relationship <span className="text-red-500 font-bold ml-1">*</span>
                                                </Label>
                                                <Input
                                                    placeholder="e.g. Spouse / Father / Mother"
                                                    className={inputClass("emergencyRelation", "h-12 bg-slate-50 border-none rounded-xl px-5 font-black text-xs uppercase tracking-widest")}
                                                    value={formData.emergencyRelation}
                                                    onChange={(e) => updateField("emergencyRelation", e.target.value)}
                                                    onBlur={() => handleBlur("emergencyRelation")}
                                                />
                                                {fieldErrorEl("emergencyRelation")}
                                            </div>

                                            {/* 12. Aadhaar Number */}
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center">
                                                    Aadhaar Number <span className="text-red-500 font-bold ml-1">*</span>
                                                </Label>
                                                <Input
                                                    placeholder="123456789012"
                                                    className={inputClass("aadhaar", "h-12 bg-slate-50 border-none rounded-xl px-5 font-black text-xs tracking-widest")}
                                                    value={formData.aadhaar}
                                                    onChange={(e) => updateField("aadhaar", e.target.value)}
                                                    onBlur={() => handleBlur("aadhaar")}
                                                />
                                                {fieldErrorEl("aadhaar")}
                                            </div>

                                            {/* 13. PAN Number (NOT mandatory under Req 2.3 A) */}
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                                                    PAN Number <span className="text-slate-400 font-bold normal-case text-[9px]">(Optional)</span>
                                                </Label>
                                                <Input
                                                    placeholder="ABCDE1234F"
                                                    className={inputClass("pan", "h-12 bg-slate-50 border-none rounded-xl px-5 font-black text-xs uppercase tracking-widest")}
                                                    value={formData.pan}
                                                    onChange={(e) => updateField("pan", e.target.value.toUpperCase())}
                                                    onBlur={() => handleBlur("pan")}
                                                />
                                                {fieldErrorEl("pan")}
                                            </div>

                                            {/* 14. Address as per Aadhaar */}
                                            <div className="space-y-2 md:col-span-2">
                                                <Label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center">
                                                    Address as per Aadhaar <span className="text-red-500 font-bold ml-1">*</span>
                                                </Label>
                                                <Input
                                                    placeholder="Full residential address as stated on Aadhaar card..."
                                                    className={inputClass("address", "h-12 bg-slate-50 border-none rounded-xl px-5 font-black text-xs")}
                                                    value={formData.address}
                                                    onChange={(e) => updateField("address", e.target.value)}
                                                    onBlur={() => handleBlur("address")}
                                                />
                                                {fieldErrorEl("address")}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* ── STEP 1: Employment Information (Req 2.3 B) ── */}
                                {currentStep === 1 && (
                                    <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-7">
                                            {/* 1. Company Entity */}
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center">
                                                    Company Entity <span className="text-red-500 font-bold ml-1">*</span>
                                                </Label>
                                                <select
                                                    className="w-full h-12 bg-slate-50 border-none rounded-xl px-5 font-black text-[10px] uppercase tracking-widest outline-none"
                                                    value={formData.company}
                                                    onChange={(e) => updateField("company", e.target.value)}
                                                    disabled={loadingLookups}
                                                >
                                                    {loadingLookups ? (
                                                        <option>Loading...</option>
                                                    ) : (
                                                        companies.map((c) => (
                                                            <option key={c.id} value={c.id.toString()}>
                                                                {c.name}
                                                            </option>
                                                        ))
                                                    )}
                                                </select>
                                                {fieldErrorEl("company")}
                                            </div>

                                            {/* 2. Working Location (renamed from Office Location per Req 2.3 B) */}
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center">
                                                    Working Location <span className="text-red-500 font-bold ml-1">*</span>
                                                </Label>
                                                <select
                                                    className="w-full h-12 bg-slate-50 border-none rounded-xl px-5 font-black text-[10px] uppercase tracking-widest outline-none"
                                                    value={formData.location}
                                                    onChange={(e) => updateField("location", e.target.value)}
                                                    disabled={loadingLookups}
                                                >
                                                    {loadingLookups ? (
                                                        <option>Loading...</option>
                                                    ) : (
                                                        offices.map((o) => (
                                                            <option key={o.id} value={o.id.toString()}>
                                                                {o.name}
                                                            </option>
                                                        ))
                                                    )}
                                                </select>
                                                {fieldErrorEl("location")}
                                            </div>

                                            {/* 3. System Role */}
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center">
                                                    Role <span className="text-red-500 font-bold ml-1">*</span>
                                                </Label>
                                                <select
                                                    className="w-full h-12 bg-slate-50 border-none rounded-xl px-5 font-black text-[10px] uppercase tracking-widest outline-none"
                                                    value={formData.role}
                                                    onChange={(e) => updateField("role", e.target.value)}
                                                >
                                                    {availableRoles.map((r) => (
                                                        <option key={r.name} value={r.name}>
                                                            {r.name.replace(/_/g, " ")}
                                                        </option>
                                                    ))}
                                                </select>
                                                {fieldErrorEl("role")}
                                            </div>

                                            {/* 4. Designation (renamed from Job Role; separate Job Title & Department removed per Req 2.3 B) */}
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center">
                                                    Designation <span className="text-red-500 font-bold ml-1">*</span>
                                                </Label>
                                                <Input
                                                    placeholder="e.g. Operations Manager"
                                                    className={inputClass("jobTitle", "h-12 bg-slate-50 border-none rounded-xl px-5 font-black text-xs uppercase tracking-widest")}
                                                    value={formData.jobTitle}
                                                    onChange={(e) => updateField("jobTitle", e.target.value)}
                                                    onBlur={() => handleBlur("jobTitle")}
                                                />
                                                {fieldErrorEl("jobTitle")}
                                            </div>

                                            {/* 5. HR Manager / Reporting Manager */}
                                            <div className="space-y-2 md:col-span-2">
                                                <Label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                                                    HR Manager / Reporting Manager <span className="text-slate-400 font-bold normal-case text-[9px]">(Optional)</span>
                                                </Label>
                                                <Input
                                                    placeholder="e.g. Rahul Sharma (HR Manager)"
                                                    className={inputClass("hrManager", "h-12 bg-slate-50 border-none rounded-xl px-5 font-black text-xs uppercase tracking-widest")}
                                                    value={formData.hrManager || ""}
                                                    onChange={(e) => updateField("hrManager", e.target.value)}
                                                />
                                            </div>
                                        </div>

                                        {/* ── Shift Configuration & Rotational Shift (Req 2.3 B) ── */}
                                        <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-200/80 space-y-5">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Clock className="h-4 w-4 text-indigo-600" />
                                                    <p className="text-[10px] font-black text-indigo-700 uppercase tracking-widest">
                                                        Shift & Attendance Configuration (Req 2.3 B)
                                                    </p>
                                                </div>
                                                <Badge className="bg-indigo-100 text-indigo-800 text-[9px] font-bold">
                                                    Shift Timings & Roster
                                                </Badge>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                                <div className="space-y-2">
                                                    <Label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center">
                                                        Shift Start Time <span className="text-red-500 font-bold ml-1">*</span>
                                                    </Label>
                                                    <Input
                                                        type="time"
                                                        className={inputClass("shiftStartTime", "h-12 bg-white border border-slate-200 rounded-xl px-5 font-black text-xs tracking-widest")}
                                                        value={formData.shiftStartTime}
                                                        onChange={(e) => updateField("shiftStartTime", e.target.value)}
                                                        onBlur={() => handleBlur("shiftStartTime")}
                                                    />
                                                    {fieldErrorEl("shiftStartTime")}
                                                </div>
                                                <div className="space-y-2">
                                                    <Label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center">
                                                        Shift End Time <span className="text-red-500 font-bold ml-1">*</span>
                                                    </Label>
                                                    <Input
                                                        type="time"
                                                        className={inputClass("shiftEndTime", "h-12 bg-white border border-slate-200 rounded-xl px-5 font-black text-xs tracking-widest")}
                                                        value={formData.shiftEndTime}
                                                        onChange={(e) => updateField("shiftEndTime", e.target.value)}
                                                        onBlur={() => handleBlur("shiftEndTime")}
                                                    />
                                                    {fieldErrorEl("shiftEndTime")}
                                                </div>
                                                <div className="space-y-2">
                                                    <Label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center">
                                                        Rotational Shift <span className="text-red-500 font-bold ml-1">*</span>
                                                    </Label>
                                                    <select
                                                        className="w-full h-12 bg-white border border-slate-200 rounded-xl px-4 font-black text-[10px] uppercase tracking-widest outline-none"
                                                        value={formData.isRotationalShift}
                                                        onChange={(e) => updateField("isRotationalShift", e.target.value)}
                                                    >
                                                        <option value="No">No (Fixed Regular Shift)</option>
                                                        <option value="Yes">Yes (Rotational Shift Roster)</option>
                                                    </select>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-3 border-t border-slate-200/60">
                                                <div className="space-y-2">
                                                    <Label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                                                        Half-Day Late Threshold (Minutes) <span className="text-slate-400 font-bold normal-case text-[9px]">(Default: 60)</span>
                                                    </Label>
                                                    <Input
                                                        type="number"
                                                        placeholder="60"
                                                        min="1"
                                                        max="480"
                                                        className={inputClass("halfDayLateMinutes", "h-12 bg-white border border-slate-200 rounded-xl px-5 font-black text-xs tracking-widest")}
                                                        value={formData.halfDayLateMinutes}
                                                        onChange={(e) => updateField("halfDayLateMinutes", e.target.value)}
                                                        onBlur={() => handleBlur("halfDayLateMinutes")}
                                                    />
                                                    {fieldErrorEl("halfDayLateMinutes")}
                                                </div>
                                                <div className="flex items-center">
                                                    <p className="text-[10px] text-slate-500 italic leading-relaxed pt-4">
                                                        * Rotational shift employees follow rotational rosters configured in Attendance Management (Req 2.5 C).
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* ── STEP 2: Salary & Bank ── */}
                                {currentStep === 2 && (
                                    <>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-8 animate-in fade-in slide-in-from-right-4">
                                            <div className="space-y-3">
                                                <Label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center">
                                                    Monthly Fixed Gross (CTC) <span className="text-red-500 font-bold ml-1">*</span>
                                                </Label>
                                                <Input
                                                    type="number"
                                                    placeholder="e.g. 85000"
                                                    className={inputClass("fixedGross", "h-12 bg-emerald-50 border-none rounded-xl px-5 font-black text-xs uppercase tracking-widest text-emerald-900")}
                                                    value={formData.fixedGross}
                                                    onChange={(e) => updateField("fixedGross", e.target.value)}
                                                    onBlur={() => handleBlur("fixedGross")}
                                                />
                                                {fieldErrorEl("fixedGross")}
                                            </div>
                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <Label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">
                                                        HRA Applicable (Optional)
                                                    </Label>
                                                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Req 2.4</span>
                                                </div>
                                                <select
                                                    className="w-full h-12 bg-emerald-50 border-none rounded-xl px-5 font-black text-[10px] uppercase tracking-widest outline-none text-emerald-900"
                                                    value={formData.hraApplicable}
                                                    onChange={(e) => updateField("hraApplicable", e.target.value)}
                                                >
                                                    <option value="Yes">Yes (Enabled)</option>
                                                    <option value="No">No (Disabled / Exempt)</option>
                                                </select>
                                            </div>
                                            <div className="space-y-3">
                                                <Label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                                    Conveyance Allowance (₹)
                                                </Label>
                                                <Input
                                                    type="number"
                                                    placeholder="0"
                                                    className="h-12 bg-slate-50 border-none rounded-xl px-5 font-black text-xs uppercase tracking-widest text-slate-900"
                                                    value={formData.conveyance}
                                                    onChange={(e) => updateField("conveyance", e.target.value)}
                                                />
                                            </div>
                                            <div className="space-y-3">
                                                <Label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                                    Medical Allowance (₹)
                                                </Label>
                                                <Input
                                                    type="number"
                                                    placeholder="0"
                                                    className="h-12 bg-slate-50 border-none rounded-xl px-5 font-black text-xs uppercase tracking-widest text-slate-900"
                                                    value={formData.medicalAllowance}
                                                    onChange={(e) => updateField("medicalAllowance", e.target.value)}
                                                />
                                            </div>
                                            <div className="space-y-3">
                                                <Label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                                    Special Allowance (₹)
                                                </Label>
                                                <Input
                                                    type="number"
                                                    placeholder="0"
                                                    className="h-12 bg-slate-50 border-none rounded-xl px-5 font-black text-xs uppercase tracking-widest text-slate-900"
                                                    value={formData.specialAllowance}
                                                    onChange={(e) => updateField("specialAllowance", e.target.value)}
                                                />
                                            </div>
                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <Label className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">
                                                        Performance Allowance (₹)
                                                    </Label>
                                                    <span className="text-[9px] text-indigo-400 font-bold uppercase tracking-wider">Req 2.4</span>
                                                </div>
                                                <Input
                                                    type="number"
                                                    placeholder="0"
                                                    className="h-12 bg-indigo-50 border-none rounded-xl px-5 font-black text-xs uppercase tracking-widest text-indigo-900"
                                                    value={formData.performanceAllowance}
                                                    onChange={(e) => updateField("performanceAllowance", e.target.value)}
                                                />
                                            </div>
                                            <div className="space-y-3">
                                                <Label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center">
                                                    Bank Name <span className="text-red-500 font-bold ml-1">*</span>
                                                </Label>
                                                <Input
                                                    placeholder="e.g. HDFC Bank"
                                                    className={inputClass("bankName", "h-12 bg-slate-50 border-none rounded-xl px-5 font-black text-xs uppercase tracking-widest")}
                                                    value={formData.bankName}
                                                    onChange={(e) => updateField("bankName", e.target.value)}
                                                    onBlur={() => handleBlur("bankName")}
                                                />
                                                {fieldErrorEl("bankName")}
                                            </div>
                                            <div className="space-y-3">
                                                <Label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center">
                                                    Account Number <span className="text-red-500 font-bold ml-1">*</span>
                                                </Label>
                                                <Input
                                                    placeholder="0000 0000 0000"
                                                    className={inputClass("accountNo", "h-12 bg-slate-50 border-none rounded-xl px-5 font-black text-xs tracking-widest")}
                                                    value={formData.accountNo}
                                                    onChange={(e) => updateField("accountNo", e.target.value)}
                                                    onBlur={() => handleBlur("accountNo")}
                                                />
                                                {fieldErrorEl("accountNo")}
                                            </div>
                                            <div className="space-y-3">
                                                <Label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center">
                                                    IFSC Code <span className="text-red-500 font-bold ml-1">*</span>
                                                </Label>
                                                <Input
                                                    placeholder="HDFC0001234"
                                                    className={inputClass("ifsc", "h-12 bg-slate-50 border-none rounded-xl px-5 font-black text-xs uppercase tracking-widest")}
                                                    value={formData.ifsc}
                                                    onChange={(e) => updateField("ifsc", e.target.value.toUpperCase())}
                                                    onBlur={() => handleBlur("ifsc")}
                                                />
                                                {fieldErrorEl("ifsc")}
                                            </div>
                                            <div className="space-y-3">
                                                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                    Payment Mode
                                                </Label>
                                                <select
                                                    className="w-full h-12 bg-slate-50 border-none rounded-xl px-5 font-black text-[10px] uppercase tracking-widest outline-none"
                                                    value={formData.paymentMode}
                                                    onChange={(e) => updateField("paymentMode", e.target.value)}
                                                >
                                                    <option value="Bank Transfer">Bank Transfer</option>
                                                    <option value="Cash">Cash</option>
                                                </select>
                                            </div>
                                            <div className="space-y-3">
                                                <Label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">
                                                    PF Applicable
                                                </Label>
                                                <select
                                                    className="w-full h-12 bg-indigo-50 border-none rounded-xl px-5 font-black text-[10px] uppercase tracking-widest outline-none text-indigo-900"
                                                    value={formData.pfApplicable}
                                                    onChange={(e) => updateField("pfApplicable", e.target.value)}
                                                >
                                                    <option value="Yes">Yes</option>
                                                    <option value="No">No</option>
                                                </select>
                                            </div>
                                            <div className="space-y-3">
                                                <Label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">
                                                    PF Ceiling Limit
                                                </Label>
                                                <select
                                                    className="w-full h-12 bg-indigo-50 border-none rounded-xl px-5 font-black text-[10px] uppercase tracking-widest outline-none text-indigo-900"
                                                    value={formData.pfCeiling}
                                                    onChange={(e) => updateField("pfCeiling", e.target.value)}
                                                >
                                                    <option value="Yes">Yes (₹15,000 cap)</option>
                                                    <option value="No">No (Actual Basic)</option>
                                                </select>
                                            </div>
                                            <div className="space-y-3">
                                                <Label className="text-[10px] font-black text-blue-500 uppercase tracking-widest">
                                                    ESIC Applicable
                                                </Label>
                                                <select
                                                    className="w-full h-12 bg-blue-50 border-none rounded-xl px-5 font-black text-[10px] uppercase tracking-widest outline-none text-blue-900"
                                                    value={formData.esicApplicable}
                                                    onChange={(e) => updateField("esicApplicable", e.target.value)}
                                                >
                                                    <option value="Yes">Yes</option>
                                                    <option value="No">No</option>
                                                </select>
                                            </div>
                                            <div className="space-y-3">
                                                <Label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">
                                                    PT Applicable
                                                </Label>
                                                <select
                                                    className="w-full h-12 bg-indigo-50 border-none rounded-xl px-5 font-black text-[10px] uppercase tracking-widest outline-none text-indigo-900"
                                                    value={formData.ptApplicable}
                                                    onChange={(e) => updateField("ptApplicable", e.target.value)}
                                                >
                                                    <option value="Yes">Yes</option>
                                                    <option value="No">No</option>
                                                </select>
                                            </div>
                                            <div className="space-y-3">
                                                <Label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">
                                                    PF Contribution Mode
                                                </Label>
                                                <select
                                                    className="w-full h-12 bg-emerald-50 border-none rounded-xl px-5 font-black text-[10px] uppercase tracking-widest outline-none text-emerald-900"
                                                    value={formData.pfContributionMode}
                                                    onChange={(e) => updateField("pfContributionMode", e.target.value)}
                                                >
                                                    <option value="none">None (Not Applicable)</option>
                                                    <option value="employee_only">Employee Only</option>
                                                    <option value="employer_only">Employer Only</option>
                                                    <option value="shared">Shared (Both)</option>
                                                </select>
                                            </div>
                                            {(formData.pfContributionMode === "shared" || formData.pfContributionMode === "employee_only") && (
                                                <div className="space-y-3">
                                                    <Label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">
                                                        PF Employee Rate (Decimal)
                                                    </Label>
                                                    <Input
                                                        type="number"
                                                        step="0.0001"
                                                        min="0"
                                                        max="1"
                                                        placeholder="e.g. 0.12 for 12%"
                                                        className={inputClass("pfEmployeeRate", "h-12 bg-emerald-50 border-none rounded-xl px-5 font-black text-xs uppercase tracking-widest text-emerald-900")}
                                                        value={formData.pfEmployeeRate}
                                                        onChange={(e) => updateField("pfEmployeeRate", e.target.value)}
                                                        onBlur={() => handleBlur("pfEmployeeRate")}
                                                    />
                                                    {fieldErrorEl("pfEmployeeRate")}
                                                </div>
                                            )}
                                            {(formData.pfContributionMode === "shared" || formData.pfContributionMode === "employer_only") && (
                                                <div className="space-y-3">
                                                    <Label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">
                                                        PF Employer Rate (Decimal)
                                                    </Label>
                                                    <Input
                                                        type="number"
                                                        step="0.0001"
                                                        min="0"
                                                        max="1"
                                                        placeholder="e.g. 0.12 for 12%"
                                                        className={inputClass("pfEmployerRate", "h-12 bg-emerald-50 border-none rounded-xl px-5 font-black text-xs uppercase tracking-widest text-emerald-900")}
                                                        value={formData.pfEmployerRate}
                                                        onChange={(e) => updateField("pfEmployerRate", e.target.value)}
                                                        onBlur={() => handleBlur("pfEmployerRate")}
                                                    />
                                                    {fieldErrorEl("pfEmployerRate")}
                                                </div>
                                            )}
                                            <div className="space-y-3">
                                                <Label className="text-[10px] font-black text-blue-500 uppercase tracking-widest">
                                                    ESIC Contribution Mode
                                                </Label>
                                                <select
                                                    className="w-full h-12 bg-blue-50 border-none rounded-xl px-5 font-black text-[10px] uppercase tracking-widest outline-none text-blue-900"
                                                    value={formData.esicContributionMode}
                                                    onChange={(e) => updateField("esicContributionMode", e.target.value)}
                                                >
                                                    <option value="none">None (Not Applicable)</option>
                                                    <option value="employee_only">Employee Only</option>
                                                    <option value="employer_only">Employer Only</option>
                                                    <option value="shared">Shared (Both)</option>
                                                </select>
                                            </div>
                                            {(formData.esicContributionMode === "shared" || formData.esicContributionMode === "employee_only") && (
                                                <div className="space-y-3">
                                                    <Label className="text-[10px] font-black text-blue-500 uppercase tracking-widest">
                                                        ESIC Employee Rate (Decimal)
                                                    </Label>
                                                    <Input
                                                        type="number"
                                                        step="0.0001"
                                                        min="0"
                                                        max="1"
                                                        placeholder="e.g. 0.0075 for 0.75%"
                                                        className={inputClass("esicEmployeeRate", "h-12 bg-blue-50 border-none rounded-xl px-5 font-black text-xs uppercase tracking-widest text-blue-900")}
                                                        value={formData.esicEmployeeRate}
                                                        onChange={(e) => updateField("esicEmployeeRate", e.target.value)}
                                                        onBlur={() => handleBlur("esicEmployeeRate")}
                                                    />
                                                    {fieldErrorEl("esicEmployeeRate")}
                                                </div>
                                            )}
                                            {(formData.esicContributionMode === "shared" || formData.esicContributionMode === "employer_only") && (
                                                <div className="space-y-3">
                                                    <Label className="text-[10px] font-black text-blue-500 uppercase tracking-widest">
                                                        ESIC Employer Rate (Decimal)
                                                    </Label>
                                                    <Input
                                                        type="number"
                                                        step="0.0001"
                                                        min="0"
                                                        max="1"
                                                        placeholder="e.g. 0.0325 for 3.25%"
                                                        className={inputClass("esicEmployerRate", "h-12 bg-blue-50 border-none rounded-xl px-5 font-black text-xs uppercase tracking-widest text-blue-900")}
                                                        value={formData.esicEmployerRate}
                                                        onChange={(e) => updateField("esicEmployerRate", e.target.value)}
                                                        onBlur={() => handleBlur("esicEmployerRate")}
                                                    />
                                                    {fieldErrorEl("esicEmployerRate")}
                                                </div>
                                            )}
                                            <div className="space-y-3">
                                                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                    PF Number
                                                </Label>
                                                <Input
                                                    placeholder="PF/IND/001"
                                                    className={inputClass("pfNo", "h-12 bg-slate-50 border-none rounded-xl px-5 font-black text-xs uppercase tracking-widest")}
                                                    value={formData.pfNo}
                                                    onChange={(e) => updateField("pfNo", e.target.value)}
                                                    onBlur={() => handleBlur("pfNo")}
                                                />
                                                {fieldErrorEl("pfNo")}
                                            </div>
                                            <div className="space-y-3">
                                                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                    UAN ID
                                                </Label>
                                                <Input
                                                    placeholder="1000 0000 0000"
                                                    className={inputClass("uan", "h-12 bg-slate-50 border-none rounded-xl px-5 font-black text-xs tracking-widest")}
                                                    value={formData.uan}
                                                    onChange={(e) => updateField("uan", e.target.value)}
                                                    onBlur={() => handleBlur("uan")}
                                                />
                                                {fieldErrorEl("uan")}
                                            </div>
                                            <div className="space-y-3">
                                                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                    PF Employment Date
                                                </Label>
                                                <Input
                                                    type="date"
                                                    className={inputClass("pfEmploymentDate", "h-12 bg-slate-50 border-none rounded-xl px-5 font-black text-xs uppercase tracking-widest")}
                                                    value={formData.pfEmploymentDate}
                                                    onChange={(e) => updateField("pfEmploymentDate", e.target.value)}
                                                />
                                            </div>
                                            <div className="space-y-3">
                                                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                    ESIC IP / Registration Number
                                                </Label>
                                                <Input
                                                    placeholder="e.g. ESIC IP: 1234567890"
                                                    className={inputClass("licDetails", "h-12 bg-slate-50 border-none rounded-xl px-5 font-black text-xs uppercase tracking-widest")}
                                                    value={formData.licDetails}
                                                    onChange={(e) => updateField("licDetails", e.target.value)}
                                                    onBlur={() => handleBlur("licDetails")}
                                                />
                                                {fieldErrorEl("licDetails")}
                                            </div>
                                        </div>

                                        {renderSalaryPreview()}
                                    </>
                                )}

                                {/* ── STEP 3: Documentation ── */}
                                {currentStep === 3 && (
                                    <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
                                        {/* Hidden file input */}
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            multiple
                                            accept="image/*,.pdf"
                                            className="hidden"
                                            onChange={handleFilesSelected}
                                        />

                                        {/* Drop zone */}
                                        <div
                                            onClick={handleSelectFiles}
                                            className="border-4 border-dashed border-slate-200 rounded-[2rem] p-16 text-center space-y-6 bg-slate-50/20 hover:bg-slate-50 hover:border-slate-400 transition-all group flex flex-col items-center cursor-pointer"
                                        >
                                            <div className="h-16 w-16 bg-white rounded-[1.2rem] shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                                                <Upload className="h-8 w-8 text-slate-300 group-hover:text-slate-500 transition-colors" />
                                            </div>
                                            <div className="space-y-2">
                                                <h3 className="text-xl font-black text-slate-900 italic uppercase">
                                                    Upload Documents
                                                </h3>
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                                    Aadhar • PAN • Bank Proof • Photos
                                                </p>
                                            </div>
                                            <Button
                                                type="button"
                                                className="bg-slate-900 text-white font-black hover:bg-black px-12 h-12 rounded-xl shadow-xl uppercase text-[10px] tracking-widest pointer-events-none"
                                            >
                                                Select Files
                                            </Button>
                                        </div>

                                        {/* Uploaded files list */}
                                        {uploadedFiles.length > 0 && (
                                            <div className="space-y-4">
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                                    Uploaded Files ({uploadedFiles.length})
                                                </p>
                                                <div className="space-y-2">
                                                    {uploadedFiles.map((entry, i) => (
                                                        <div
                                                            key={`${entry.file.name}-${i}`}
                                                            className="flex items-center justify-between p-4 bg-white border-2 border-slate-50 rounded-2xl hover:border-emerald-200 transition-all shadow-sm gap-3"
                                                        >
                                                            <div className="flex items-center gap-4 flex-1 min-w-0">
                                                                <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                                                                    <FileCheck className="h-5 w-5 text-emerald-500" />
                                                                </div>
                                                                <div className="text-left min-w-0 flex-1">
                                                                    <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest truncate max-w-[180px] md:max-w-[360px]">
                                                                        {entry.file.name}
                                                                    </p>
                                                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                                                                        {(entry.file.size / 1024).toFixed(1)} KB
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <select
                                                                value={entry.docType}
                                                                onChange={(e) => updateFileDocType(i, e.target.value)}
                                                                className="h-9 rounded-xl border-2 border-slate-100 bg-slate-50 px-3 text-[9px] font-black uppercase tracking-widest text-slate-600 focus:outline-none focus:border-emerald-300 flex-shrink-0"
                                                            >
                                                                <option value="other">Type</option>
                                                                <option value="Aadhar">Aadhar</option>
                                                                <option value="PAN">PAN</option>
                                                                <option value="Passbook">Passbook</option>
                                                                <option value="Photo">Photo</option>
                                                            </select>
                                                            <button
                                                                type="button"
                                                                onClick={() => removeFile(i)}
                                                                className="h-8 w-8 rounded-xl bg-red-50 flex items-center justify-center hover:bg-red-100 transition-colors flex-shrink-0"
                                                            >
                                                                <X className="h-4 w-4 text-red-400" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Required document placeholders */}
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                            {["Aadhar", "PAN", "Passbook", "Photo"].map((doc, i) => {
                                                const hasFile = uploadedFiles.some((f) => f.docType === doc);
                                                return (
                                                    <div
                                                        key={i}
                                                        className={cn(
                                                            "flex flex-col items-center gap-4 p-6 bg-white border-2 rounded-2xl group shadow-sm transition-all text-center",
                                                            hasFile
                                                                ? "border-emerald-200 bg-emerald-50/30"
                                                                : "border-slate-50 hover:border-slate-900",
                                                        )}
                                                    >
                                                        <div
                                                            className={cn(
                                                                "h-10 w-10 rounded-xl flex items-center justify-center transition-colors",
                                                                hasFile
                                                                    ? "bg-emerald-500"
                                                                    : "bg-slate-50 group-hover:bg-slate-900",
                                                            )}
                                                        >
                                                            {hasFile ? (
                                                                <CheckCircle className="h-5 w-5 text-white" />
                                                            ) : (
                                                                <FileText className="h-5 w-5 text-slate-200 group-hover:text-[#D9F99D]" />
                                                            )}
                                                        </div>
                                                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 group-hover:text-slate-900">
                                                            {doc}
                                                        </span>
                                                        <Badge
                                                            className={cn(
                                                                "border-none font-black text-[7px] h-5 tracking-widest px-3",
                                                                hasFile
                                                                    ? "bg-emerald-100 text-emerald-700"
                                                                    : "bg-slate-50 text-slate-300",
                                                            )}
                                                        >
                                                            {hasFile ? "UPLOADED" : "PENDING"}
                                                        </Badge>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* ── STEP 4: Review ── */}
                                {currentStep === 4 && (
                                    <div className="flex flex-col items-center justify-center space-y-10 text-center py-10 animate-in fade-in zoom-in-95">
                                        <div className="h-20 w-20 bg-[#D9F99D] rounded-[2rem] flex items-center justify-center shadow-xl shadow-[#D9F99D]/20 animate-bounce">
                                            <CheckCircle className="h-10 w-10 text-slate-900" />
                                        </div>
                                        <div className="space-y-2">
                                            <h3 className="text-3xl font-black text-slate-900 italic uppercase tracking-tighter">
                                                Review & Finish
                                            </h3>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                Check everything before adding the employee.
                                            </p>
                                        </div>
                                        <div className="w-full max-w-3xl grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                                            {/* Personal Details (Req 2.3 A) */}
                                            <div className="p-8 bg-slate-50 rounded-[2rem] space-y-5">
                                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] border-b border-slate-200 pb-3">
                                                    Personal Details (Req 2.3 A)
                                                </p>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="col-span-2">
                                                        <p className="text-[7px] font-black text-slate-400 uppercase">Full Name (as per Aadhaar)</p>
                                                        <p className="text-sm font-black italic uppercase text-slate-900">
                                                            {formData.name || "N/A"}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[7px] font-black text-slate-400 uppercase">Email</p>
                                                        <p className="text-xs font-black text-slate-900 lowercase truncate">
                                                            {formData.email || "N/A"}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[7px] font-black text-slate-400 uppercase">Mobile Phone</p>
                                                        <p className="text-xs font-black text-slate-900">
                                                            {formData.phone || "N/A"}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[7px] font-black text-slate-400 uppercase">Gender & Marital Status</p>
                                                        <p className="text-xs font-black text-slate-900 uppercase">
                                                            {formData.gender} • {formData.maritalStatus}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[7px] font-black text-slate-400 uppercase">Father&apos;s / Husband&apos;s Name</p>
                                                        <p className="text-xs font-black text-slate-900 uppercase">
                                                            {formData.fatherOrHusbandName || "N/A"}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[7px] font-black text-slate-400 uppercase">Date of Birth</p>
                                                        <p className="text-xs font-black text-slate-900">
                                                            {formData.dob || "N/A"}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[7px] font-black text-slate-400 uppercase">Date of Joining</p>
                                                        <p className="text-xs font-black text-slate-900">
                                                            {formData.doj || "N/A"}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[7px] font-black text-slate-400 uppercase">Aadhaar Number</p>
                                                        <p className="text-xs font-black text-slate-900 font-mono">
                                                            {formData.aadhaar || "N/A"}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[7px] font-black text-slate-400 uppercase">PAN Number</p>
                                                        <p className="text-xs font-black text-slate-900 font-mono">
                                                            {formData.pan ? formData.pan.toUpperCase() : "N/A (Optional)"}
                                                        </p>
                                                    </div>
                                                    <div className="col-span-2 pt-2 border-t border-slate-200/60">
                                                        <p className="text-[7px] font-black text-slate-400 uppercase">Emergency Contact</p>
                                                        <p className="text-xs font-black text-slate-900">
                                                            {formData.emergencyName || "N/A"} ({formData.emergencyRelation || "N/A"}) • {formData.emergencyPhone || "N/A"}
                                                        </p>
                                                    </div>
                                                    <div className="col-span-2">
                                                        <p className="text-[7px] font-black text-slate-400 uppercase">Address as per Aadhaar</p>
                                                        <p className="text-xs font-bold text-slate-700 leading-snug">
                                                            {formData.address || "N/A"}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Employment Information (Req 2.3 B) */}
                                            <div className="p-8 bg-slate-50 rounded-[2rem] space-y-5">
                                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] border-b border-slate-200 pb-3">
                                                    Employment Information (Req 2.3 B)
                                                </p>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="col-span-2">
                                                        <p className="text-[7px] font-black text-slate-400 uppercase">Company Entity</p>
                                                        <p className="text-sm font-black italic uppercase text-slate-900">
                                                            {companies.find((c) => c.id.toString() === formData.company)?.name || formData.company || "N/A"}
                                                        </p>
                                                    </div>
                                                    <div className="col-span-2">
                                                        <p className="text-[7px] font-black text-slate-400 uppercase">Working Location</p>
                                                        <p className="text-sm font-black italic uppercase text-slate-900">
                                                            {offices.find((o) => o.id.toString() === formData.location)?.name || formData.location || "N/A"}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[7px] font-black text-slate-400 uppercase">Role</p>
                                                        <p className="text-xs font-black text-slate-900 uppercase tracking-widest">
                                                            {formData.role}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[7px] font-black text-slate-400 uppercase">Designation</p>
                                                        <p className="text-xs font-black text-slate-900 uppercase tracking-widest">
                                                            {formData.jobTitle || "N/A"}
                                                        </p>
                                                    </div>
                                                    <div className="col-span-2">
                                                        <p className="text-[7px] font-black text-slate-400 uppercase">HR / Reporting Manager</p>
                                                        <p className="text-xs font-black text-slate-900">
                                                            {formData.hrManager || "N/A"}
                                                        </p>
                                                    </div>
                                                    <div className="col-span-2 pt-2 border-t border-slate-200/60">
                                                        <p className="text-[7px] font-black text-indigo-600 uppercase">Shift Configuration</p>
                                                        <p className="text-xs font-black text-slate-900">
                                                            {formData.shiftStartTime} - {formData.shiftEndTime} (Threshold: {formData.halfDayLateMinutes}m)
                                                        </p>
                                                    </div>
                                                    <div className="col-span-2">
                                                        <p className="text-[7px] font-black text-indigo-600 uppercase">Rotational Shift</p>
                                                        <p className="text-xs font-black text-slate-900">
                                                            {formData.isRotationalShift === "Yes" ? "Yes (Rotational Shift Roster)" : "No (Fixed Regular Shift)"}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Compensation & Compliance (Req 2.4) */}
                                            <div className="p-8 bg-slate-50 rounded-[2rem] space-y-5 md:col-span-2">
                                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] border-b border-slate-200 pb-3">
                                                    Compensation & Compliance (Req 2.4)
                                                </p>
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                    <div>
                                                        <p className="text-[7px] font-black text-emerald-500 uppercase">Monthly Fixed CTC</p>
                                                        <p className="text-sm font-black text-emerald-600 uppercase tracking-widest">
                                                            ₹{formData.fixedGross ? Number(formData.fixedGross).toLocaleString("en-IN") : "0"}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[7px] font-black text-slate-400 uppercase">HRA Applicable</p>
                                                        <p className="text-sm font-black text-slate-900 uppercase tracking-widest">
                                                            {formData.hraApplicable}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[7px] font-black text-slate-400 uppercase">Bank Name</p>
                                                        <p className="text-sm font-black text-slate-900 uppercase tracking-widest">
                                                            {formData.bankName || "N/A"}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[7px] font-black text-slate-400 uppercase">Account & IFSC</p>
                                                        <p className="text-xs font-black text-slate-900 font-mono">
                                                            {formData.accountNo || "N/A"} • {formData.ifsc || "N/A"}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[7px] font-black text-indigo-400 uppercase">PF Applicable & Mode</p>
                                                        <p className="text-xs font-black text-indigo-600 uppercase tracking-widest">
                                                            {formData.pfApplicable} ({formData.pfContributionMode})
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[7px] font-black text-indigo-400 uppercase">PF Ceiling Limit</p>
                                                        <p className="text-xs font-black text-indigo-600 uppercase tracking-widest">
                                                            {formData.pfCeiling === "Yes" ? "₹15,000 Cap" : "Actual Basic"}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[7px] font-black text-blue-400 uppercase">ESIC Applicable & Mode</p>
                                                        <p className="text-xs font-black text-blue-600 uppercase tracking-widest">
                                                            {formData.esicApplicable} ({formData.esicContributionMode})
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[7px] font-black text-indigo-400 uppercase">PT Applicable</p>
                                                        <p className="text-xs font-black text-indigo-600 uppercase tracking-widest">
                                                            {formData.ptApplicable}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </CardContent>

                            <CardFooter className="px-0 pb-0 pt-10 border-t border-slate-50 flex justify-between items-center bg-transparent">
                                <Button
                                    variant="ghost"
                                    onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                                    disabled={currentStep === 0 || submitting}
                                    className="h-12 px-8 rounded-xl gap-3 text-slate-400 hover:text-slate-900 font-black uppercase tracking-widest text-[9px] transition-all"
                                >
                                    <ArrowLeft className="h-4 w-4" /> Go Back
                                </Button>
                                <Button
                                    onClick={() => {
                                        if (currentStep === steps.length - 1) {
                                            handleFinish();
                                        } else {
                                            handleNextStep();
                                        }
                                    }}
                                    disabled={submitting}
                                    className="h-12 px-12 rounded-xl bg-slate-900 text-white font-black uppercase tracking-[0.3em] text-[10px] shadow-2xl shadow-slate-200 hover:bg-black transition-all flex items-center gap-3 disabled:opacity-50"
                                >
                                    {submitting ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" /> Creating...
                                        </>
                                    ) : currentStep === steps.length - 1 ? (
                                        <>
                                            Add Employee <ChevronRight className="h-4 w-4" />
                                        </>
                                    ) : (
                                        <>
                                            Next Step <ChevronRight className="h-4 w-4" />
                                        </>
                                    )}
                                </Button>
                            </CardFooter>
                        </Card>
                            </>
                        )}
                    </>
                )}
            </div>

            {/* Req 2.1: Send Candidate Self-Onboarding Link Dialog */}
            <Dialog open={inviteDialogOpen} onOpenChange={(open) => { setInviteDialogOpen(open); if (!open) setInviteError(null); }}>
                <DialogContent className="sm:max-w-[480px] p-6 rounded-3xl bg-white border-none shadow-2xl">
                    <DialogHeader className="space-y-2 text-left">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600 mb-2">
                            <Send className="h-6 w-6 stroke-[2.5]" />
                        </div>
                        <DialogTitle className="text-xl font-black text-slate-900 tracking-tight">
                            Send Self-Onboarding Link (Req 2.1)
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-500">
                            The candidate will receive an expiring link to fill their personal, statutory, bank details, and upload documents.
                        </DialogDescription>
                    </DialogHeader>

                    {inviteSuccessLink ? (
                        <div className="space-y-4 py-4 text-center">
                            <div className="h-12 w-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                                <MailCheck className="h-6 w-6" />
                            </div>
                            <h4 className="font-black text-sm text-slate-900">Invitation Link Generated!</h4>
                            <p className="text-xs text-slate-500">
                                Link has been dispatched to <strong>{inviteForm.email}</strong>. You can also copy it directly below:
                            </p>
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs font-mono break-all text-slate-700">
                                {inviteSuccessLink}
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    onClick={() => {
                                        navigator.clipboard.writeText(inviteSuccessLink);
                                        alert("Link copied to clipboard!");
                                    }}
                                    className="flex-1 bg-slate-900 text-white hover:bg-black font-black uppercase text-[10px] tracking-wider h-11 rounded-xl"
                                >
                                    <Copy className="h-4 w-4 mr-1.5" /> Copy Link
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setInviteDialogOpen(false);
                                        setInviteSuccessLink(null);
                                    }}
                                    className="h-11 px-5 rounded-xl text-xs font-bold"
                                >
                                    Close
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3 py-3">
                            {inviteError && (
                                <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2.5">
                                    <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                                    <div className="flex-1 font-semibold leading-relaxed">
                                        {inviteError}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setInviteError(null)}
                                        className="text-red-400 hover:text-red-700 font-bold ml-1 text-base leading-none"
                                        aria-label="Dismiss error"
                                    >
                                        ×
                                    </button>
                                </div>
                            )}

                            <div>
                                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Candidate Full Name *</Label>
                                <Input
                                    value={inviteForm.candidate_name}
                                    onChange={(e) => setInviteForm(f => ({ ...f, candidate_name: e.target.value }))}
                                    placeholder="e.g. Anjali Verma"
                                    className="h-10 rounded-xl bg-slate-50 font-bold text-xs"
                                />
                            </div>
                            <div>
                                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Candidate Email Address *</Label>
                                <Input
                                    type="email"
                                    value={inviteForm.email}
                                    onChange={(e) => setInviteForm(f => ({ ...f, email: e.target.value }))}
                                    placeholder="anjali@example.com"
                                    className="h-10 rounded-xl bg-slate-50 text-xs"
                                />
                            </div>
                            <div>
                                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Mobile Phone Number</Label>
                                <Input
                                    value={inviteForm.phone}
                                    onChange={(e) => setInviteForm(f => ({ ...f, phone: e.target.value }))}
                                    placeholder="10-digit mobile number"
                                    className="h-10 rounded-xl bg-slate-50 text-xs"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Company</Label>
                                    <select
                                        value={inviteForm.company_id}
                                        onChange={(e) => setInviteForm(f => ({ ...f, company_id: e.target.value }))}
                                        className="w-full h-10 rounded-xl bg-slate-50 border border-slate-200 px-3 text-xs font-bold text-slate-800 outline-none"
                                    >
                                        <option value="">Select Company</option>
                                        {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Office Hub</Label>
                                    <select
                                        value={inviteForm.office_id}
                                        onChange={(e) => setInviteForm(f => ({ ...f, office_id: e.target.value }))}
                                        className="w-full h-10 rounded-xl bg-slate-50 border border-slate-200 px-3 text-xs font-bold text-slate-800 outline-none"
                                    >
                                        <option value="">Select Office</option>
                                        {offices.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    {!inviteSuccessLink && (
                        <DialogFooter className="mt-4 gap-2">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setInviteDialogOpen(false);
                                    setInviteError(null);
                                }}
                                className="h-11 rounded-xl text-xs font-bold"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={sendCandidateInvite}
                                disabled={inviteLoading || !inviteForm.candidate_name || !inviteForm.email}
                                className="bg-indigo-600 text-white hover:bg-indigo-700 font-black uppercase text-[10px] tracking-widest px-6 h-11 rounded-xl shadow-lg"
                            >
                                {inviteLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send Link Now"}
                            </Button>
                        </DialogFooter>
                    )}
                </DialogContent>
            </Dialog>

            {/* Req 2.2: Review Candidate Submission & 1-Click Approve Dialog */}
            <Dialog open={!!reviewCandidate} onOpenChange={(open) => !open && setReviewCandidate(null)}>
                <DialogContent className="sm:max-w-[850px] max-h-[90vh] overflow-y-auto p-6 md:p-8 rounded-3xl bg-white border-none shadow-2xl">
                    <DialogHeader className="space-y-2 text-left pb-3 border-b border-slate-100">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 shadow-sm">
                                    <FileCheck className="h-6 w-6 stroke-[2.5]" />
                                </div>
                                <div>
                                    <DialogTitle className="text-xl font-black text-slate-900 tracking-tight">
                                        Review & 1-Click Approve Candidate
                                    </DialogTitle>
                                    <DialogDescription className="text-xs text-slate-500">
                                        Verify candidate data, configure full compensation structure, statutory compliance (PF, ESIC, PT) & shift timings.
                                    </DialogDescription>
                                </div>
                            </div>
                        </div>
                    </DialogHeader>

                    {reviewCandidate && (
                        <div className="space-y-6 py-3">
                            {/* ── CARD 1: Candidate Verification & Documents ── */}
                            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-3">
                                <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                        <UserCheck className="h-4 w-4 text-emerald-600" /> Candidate Submitted Profile
                                    </span>
                                    <Badge className="bg-emerald-100 text-emerald-800 text-[9px] font-bold uppercase">
                                        Self-Submitted
                                    </Badge>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                                    <div>
                                        <span className="text-slate-400 font-bold uppercase text-[9px] block">Full Name & Gender</span>
                                        <span className="font-black text-slate-900">{approvalOverrides.name} ({approvalOverrides.gender})</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 font-bold uppercase text-[9px] block">Marital Status & Guardian</span>
                                        <span className="font-bold text-slate-800">
                                            {approvalOverrides.marital_status?.toUpperCase() || "UNMARRIED"} {approvalOverrides.father_or_husband_name && `• ${approvalOverrides.father_or_husband_name}`}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 font-bold uppercase text-[9px] block">Email & Phone</span>
                                        <span className="font-bold text-slate-800">{approvalOverrides.email} • {approvalOverrides.phone || "N/A"}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 font-bold uppercase text-[9px] block">Date of Birth & Joining</span>
                                        <span className="font-bold text-slate-800">DOB: {approvalOverrides.dob || "N/A"} • DOJ: {approvalOverrides.date_of_joining || "N/A"}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 font-bold uppercase text-[9px] block">PAN & Aadhaar</span>
                                        <span className="font-bold text-slate-800">{approvalOverrides.pan || "N/A (Optional)"} • Aadhaar: {approvalOverrides.aadhaar || "N/A"}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 font-bold uppercase text-[9px] block">Candidate Working Location</span>
                                        <span className="font-bold text-slate-800">{approvalOverrides.working_location || "N/A"}</span>
                                    </div>
                                    <div className="md:col-span-2">
                                        <span className="text-slate-400 font-bold uppercase text-[9px] block">Address (as per Aadhaar)</span>
                                        <span className="font-medium text-slate-700">{approvalOverrides.address || "N/A"}</span>
                                    </div>
                                    <div className="md:col-span-2">
                                        <span className="text-slate-400 font-bold uppercase text-[9px] block">Emergency Contact</span>
                                        <span className="font-bold text-slate-800">
                                            {approvalOverrides.emergencyName || "N/A"} ({approvalOverrides.emergencyRelation || "N/A"})
                                            {approvalOverrides.emergencyPhone && ` • Phone: ${approvalOverrides.emergencyPhone}`}
                                        </span>
                                    </div>
                                </div>

                                {/* Uploaded Documents (Req 2.3 D - 8 Documents Support) */}
                                <div className="pt-2 border-t border-slate-200/60">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">Attached Verification Documents</span>
                                    {reviewCandidate.submitted_data?.uploaded_docs?.length > 0 ? (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {reviewCandidate.submitted_data.uploaded_docs.map((doc: any, i: number) => (
                                                <div
                                                    key={i}
                                                    className="p-2.5 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2 shadow-xs hover:border-indigo-300 transition-all"
                                                >
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <div className="h-7 w-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 font-bold">
                                                            {doc.type === "photo" ? (
                                                                <UserCheck className="h-3.5 w-3.5" />
                                                            ) : doc.type?.includes("pan") ? (
                                                                <ShieldCheck className="h-3.5 w-3.5" />
                                                            ) : doc.type?.includes("bank") ? (
                                                                <Banknote className="h-3.5 w-3.5" />
                                                            ) : (
                                                                <FileText className="h-3.5 w-3.5" />
                                                            )}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <span className="font-bold text-slate-800 text-xs capitalize truncate block">
                                                                {doc.type.replace(/_/g, " ")}
                                                            </span>
                                                            <span className="text-[10px] text-slate-400 font-mono truncate block max-w-[140px]">
                                                                {doc.filename}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                        <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-bold px-1.5 py-0.5">
                                                            Attached
                                                        </Badge>
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => {
                                                                setImgPreviewError(false);
                                                                setPreviewDoc({
                                                                    ...doc,
                                                                    candidate_name: reviewCandidate.candidate_name || reviewCandidate.email,
                                                                    aadhaar_number: reviewCandidate.submitted_data?.aadhaar_number,
                                                                    pan_number: reviewCandidate.submitted_data?.pan_number,
                                                                    bank_account_number: reviewCandidate.submitted_data?.bank_account_number,
                                                                    bank_name: reviewCandidate.submitted_data?.bank_name,
                                                                    ifsc_code: reviewCandidate.submitted_data?.ifsc_code,
                                                                    data_url: doc.data_url || doc.file_url,
                                                                });
                                                            }}
                                                            className="h-7 px-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200 font-bold text-xs flex items-center gap-1 shadow-none transition-all cursor-pointer"
                                                        >
                                                            <Eye className="h-3.5 w-3.5" />
                                                            <span>View</span>
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-slate-400 italic">No files attached.</p>
                                    )}
                                </div>
                            </div>

                            {/* ── CARD 2: Employment Information (Req 2.3 B) ── */}
                            <div className="space-y-3 p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
                                <span className="text-[11px] font-black uppercase tracking-wider text-indigo-700 flex items-center gap-1.5">
                                    <Briefcase className="h-4 w-4 text-indigo-600" /> 1. Employment Information
                                </span>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div>
                                        <Label className="text-[10px] font-bold text-slate-600 mb-1 block">Company Entity *</Label>
                                        <select
                                            value={approvalOverrides.company_id}
                                            onChange={(e) => setApprovalOverrides(a => ({ ...a, company_id: e.target.value }))}
                                            className="w-full h-10 rounded-xl bg-slate-50 border border-slate-200 px-3 text-xs font-bold text-slate-800 outline-none"
                                        >
                                            <option value="">Select Company</option>
                                            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <Label className="text-[10px] font-bold text-slate-600 mb-1 block">Working Location *</Label>
                                        <select
                                            value={approvalOverrides.office_id}
                                            onChange={(e) => setApprovalOverrides(a => ({ ...a, office_id: e.target.value }))}
                                            className="w-full h-10 rounded-xl bg-slate-50 border border-slate-200 px-3 text-xs font-bold text-slate-800 outline-none"
                                        >
                                            <option value="">Select Office</option>
                                            {offices.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div>
                                        <Label className="text-[10px] font-bold text-slate-600 mb-1 block">Designation *</Label>
                                        <Input
                                            value={approvalOverrides.designation}
                                            onChange={(e) => setApprovalOverrides(a => ({ ...a, designation: e.target.value }))}
                                            className="h-10 rounded-xl bg-slate-50 font-bold text-xs"
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-[10px] font-bold text-slate-600 mb-1 block">Department *</Label>
                                        <Input
                                            value={approvalOverrides.department}
                                            onChange={(e) => setApprovalOverrides(a => ({ ...a, department: e.target.value }))}
                                            className="h-10 rounded-xl bg-slate-50 font-bold text-xs"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div>
                                        <Label className="text-[10px] font-bold text-slate-600 mb-1 block">System Role *</Label>
                                        <select
                                            value={approvalOverrides.role}
                                            onChange={(e) => setApprovalOverrides(a => ({ ...a, role: e.target.value }))}
                                            className="w-full h-10 rounded-xl bg-slate-50 border border-slate-200 px-3 text-xs font-bold text-slate-800 outline-none"
                                        >
                                            <option value="EMPLOYEE">Staff Employee</option>
                                            <option value="MANAGER">Team Manager</option>
                                            <option value="HR">HR Manager</option>
                                        </select>
                                    </div>
                                    <div>
                                        <Label className="text-[10px] font-bold text-slate-600 mb-1 block">Date of Joining *</Label>
                                        <Input
                                            type="date"
                                            value={approvalOverrides.date_of_joining}
                                            onChange={(e) => setApprovalOverrides(a => ({ ...a, date_of_joining: e.target.value }))}
                                            className="h-10 rounded-xl bg-slate-50 font-bold text-xs"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* ── CARD 3: Salary & Banking Details (Editable) ── */}
                            <div className="space-y-3 p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
                                <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
                                    <Banknote className="h-4 w-4 text-emerald-600" /> 2. Compensation & Banking
                                </span>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div>
                                        <Label className="text-[10px] font-bold text-emerald-700 mb-1 block">Monthly Fixed Gross CTC (₹) *</Label>
                                        <Input
                                            type="number"
                                            value={approvalOverrides.fixed_gross}
                                            onChange={(e) => setApprovalOverrides(a => ({ ...a, fixed_gross: e.target.value }))}
                                            placeholder="e.g. 45000"
                                            className="h-10 rounded-xl bg-emerald-50/60 border border-emerald-200 font-black text-xs text-emerald-900"
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-[10px] font-bold text-slate-600 mb-1 block">Payment Mode</Label>
                                        <select
                                            value={approvalOverrides.paymentMode}
                                            onChange={(e) => setApprovalOverrides(a => ({ ...a, paymentMode: e.target.value }))}
                                            className="w-full h-10 rounded-xl bg-slate-50 border border-slate-200 px-3 text-xs font-bold text-slate-800 outline-none"
                                        >
                                            <option value="Bank Transfer">Bank Transfer</option>
                                            <option value="Cash">Cash</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-1">
                                    <div>
                                        <Label className="text-[10px] font-bold text-emerald-700 mb-1 block">HRA (Optional)</Label>
                                        <select
                                            value={approvalOverrides.hra_applicable}
                                            onChange={(e) => setApprovalOverrides(a => ({ ...a, hra_applicable: e.target.value }))}
                                            className="w-full h-10 rounded-xl bg-emerald-50/60 border border-emerald-200 px-3 text-xs font-bold text-emerald-900 outline-none"
                                        >
                                            <option value="Yes">Enabled</option>
                                            <option value="No">Disabled</option>
                                        </select>
                                    </div>
                                    <div>
                                        <Label className="text-[10px] font-bold text-slate-600 mb-1 block">Performance (₹)</Label>
                                        <Input
                                            type="number"
                                            value={approvalOverrides.performance_allowance}
                                            onChange={(e) => setApprovalOverrides(a => ({ ...a, performance_allowance: e.target.value }))}
                                            placeholder="0"
                                            className="h-10 rounded-xl bg-slate-50 font-bold text-xs"
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-[10px] font-bold text-slate-600 mb-1 block">Conveyance (₹)</Label>
                                        <Input
                                            type="number"
                                            value={approvalOverrides.conveyance}
                                            onChange={(e) => setApprovalOverrides(a => ({ ...a, conveyance: e.target.value }))}
                                            placeholder="0"
                                            className="h-10 rounded-xl bg-slate-50 font-bold text-xs"
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-[10px] font-bold text-slate-600 mb-1 block">Medical (₹)</Label>
                                        <Input
                                            type="number"
                                            value={approvalOverrides.medical_allowance}
                                            onChange={(e) => setApprovalOverrides(a => ({ ...a, medical_allowance: e.target.value }))}
                                            placeholder="0"
                                            className="h-10 rounded-xl bg-slate-50 font-bold text-xs"
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-[10px] font-bold text-slate-600 mb-1 block">Special (₹)</Label>
                                        <Input
                                            type="number"
                                            value={approvalOverrides.special_allowance}
                                            onChange={(e) => setApprovalOverrides(a => ({ ...a, special_allowance: e.target.value }))}
                                            placeholder="0"
                                            className="h-10 rounded-xl bg-slate-50 font-bold text-xs"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <div>
                                        <Label className="text-[10px] font-bold text-slate-600 mb-1 block">Bank Name</Label>
                                        <Input
                                            value={approvalOverrides.bankName}
                                            onChange={(e) => setApprovalOverrides(a => ({ ...a, bankName: e.target.value }))}
                                            placeholder="e.g. HDFC Bank"
                                            className="h-10 rounded-xl bg-slate-50 font-bold text-xs"
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-[10px] font-bold text-slate-600 mb-1 block">Account Number</Label>
                                        <Input
                                            value={approvalOverrides.accountNo}
                                            onChange={(e) => setApprovalOverrides(a => ({ ...a, accountNo: e.target.value }))}
                                            placeholder="Bank account number"
                                            className="h-10 rounded-xl bg-slate-50 font-bold text-xs font-mono"
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-[10px] font-bold text-slate-600 mb-1 block">IFSC Code</Label>
                                        <Input
                                            value={approvalOverrides.ifsc}
                                            onChange={(e) => setApprovalOverrides(a => ({ ...a, ifsc: e.target.value.toUpperCase() }))}
                                            placeholder="HDFC0001234"
                                            className="h-10 rounded-xl bg-slate-50 font-bold text-xs uppercase font-mono"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* ── CARD 4: Statutory & Compliance Controls (matching Direct HR Step 2) ── */}
                            <div className="space-y-3 p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
                                <span className="text-[11px] font-black uppercase tracking-wider text-blue-700 flex items-center gap-1.5">
                                    <ShieldCheck className="h-4 w-4 text-blue-600" /> 3. Statutory & Compliance Setup
                                </span>

                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                                    <div>
                                        <Label className="text-[10px] font-bold text-indigo-700 mb-1 block">PF Applicable</Label>
                                        <select
                                            value={approvalOverrides.pf_applicable}
                                            onChange={(e) => setApprovalOverrides(a => ({ ...a, pf_applicable: e.target.value }))}
                                            className="w-full h-10 rounded-xl bg-indigo-50/60 border border-indigo-200 px-3 text-xs font-bold text-indigo-900 outline-none"
                                        >
                                            <option value="Yes">Yes</option>
                                            <option value="No">No</option>
                                        </select>
                                    </div>
                                    <div>
                                        <Label className="text-[10px] font-bold text-indigo-700 mb-1 block">PF Ceiling Limit</Label>
                                        <select
                                            value={approvalOverrides.pf_ceiling}
                                            onChange={(e) => setApprovalOverrides(a => ({ ...a, pf_ceiling: e.target.value }))}
                                            className="w-full h-10 rounded-xl bg-indigo-50/60 border border-indigo-200 px-3 text-xs font-bold text-indigo-900 outline-none"
                                        >
                                            <option value="Yes">Yes (₹15,000 cap)</option>
                                            <option value="No">No (Actual Basic)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <Label className="text-[10px] font-bold text-blue-700 mb-1 block">ESIC Applicable</Label>
                                        <select
                                            value={approvalOverrides.esic_applicable}
                                            onChange={(e) => setApprovalOverrides(a => ({ ...a, esic_applicable: e.target.value }))}
                                            className="w-full h-10 rounded-xl bg-blue-50/60 border border-blue-200 px-3 text-xs font-bold text-blue-900 outline-none"
                                        >
                                            <option value="Yes">Yes</option>
                                            <option value="No">No</option>
                                        </select>
                                    </div>
                                    <div>
                                        <Label className="text-[10px] font-bold text-indigo-700 mb-1 block">PT Applicable</Label>
                                        <select
                                            value={approvalOverrides.pt_applicable}
                                            onChange={(e) => setApprovalOverrides(a => ({ ...a, pt_applicable: e.target.value }))}
                                            className="w-full h-10 rounded-xl bg-indigo-50/60 border border-indigo-200 px-3 text-xs font-bold text-indigo-900 outline-none"
                                        >
                                            <option value="Yes">Yes</option>
                                            <option value="No">No</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div>
                                        <Label className="text-[10px] font-bold text-emerald-700 mb-1 block">PF Contribution Mode</Label>
                                        <select
                                            value={approvalOverrides.pf_contribution_mode}
                                            onChange={(e) => setApprovalOverrides(a => ({ ...a, pf_contribution_mode: e.target.value }))}
                                            className="w-full h-10 rounded-xl bg-emerald-50/50 border border-emerald-200 px-3 text-xs font-bold text-emerald-900 outline-none"
                                        >
                                            <option value="shared">Shared (Both)</option>
                                            <option value="employee_only">Employee Only</option>
                                            <option value="employer_only">Employer Only</option>
                                            <option value="none">None</option>
                                        </select>
                                    </div>
                                    <div>
                                        <Label className="text-[10px] font-bold text-blue-700 mb-1 block">ESIC Contribution Mode</Label>
                                        <select
                                            value={approvalOverrides.esic_contribution_mode}
                                            onChange={(e) => setApprovalOverrides(a => ({ ...a, esic_contribution_mode: e.target.value }))}
                                            className="w-full h-10 rounded-xl bg-blue-50/50 border border-blue-200 px-3 text-xs font-bold text-blue-900 outline-none"
                                        >
                                            <option value="shared">Shared (Both)</option>
                                            <option value="employee_only">Employee Only</option>
                                            <option value="employer_only">Employer Only</option>
                                            <option value="none">None</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                    <div>
                                        <Label className="text-[10px] font-bold text-slate-600 mb-1 block">PF Number</Label>
                                        <Input
                                            value={approvalOverrides.pf_number}
                                            onChange={(e) => setApprovalOverrides(a => ({ ...a, pf_number: e.target.value.toUpperCase() }))}
                                            placeholder="PF/MP/IND/001234"
                                            className="h-10 rounded-xl bg-slate-50 font-bold text-xs uppercase"
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-[10px] font-bold text-slate-600 mb-1 block">PF Employment Date</Label>
                                        <Input
                                            type="date"
                                            value={approvalOverrides.pf_employment_date}
                                            onChange={(e) => setApprovalOverrides(a => ({ ...a, pf_employment_date: e.target.value }))}
                                            className="h-10 rounded-xl bg-slate-50 font-bold text-xs"
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-[10px] font-bold text-slate-600 mb-1 block">UAN ID</Label>
                                        <Input
                                            value={approvalOverrides.uan}
                                            onChange={(e) => setApprovalOverrides(a => ({ ...a, uan: e.target.value }))}
                                            placeholder="1000 0000 0000"
                                            className="h-10 rounded-xl bg-slate-50 font-bold text-xs font-mono"
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-[10px] font-bold text-slate-600 mb-1 block">ESIC IP / Registration Number</Label>
                                        <Input
                                            value={approvalOverrides.esic_number}
                                            onChange={(e) => setApprovalOverrides(a => ({ ...a, esic_number: e.target.value.toUpperCase() }))}
                                            placeholder="ESIC IP Number"
                                            className="h-10 rounded-xl bg-slate-50 font-bold text-xs"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* ── CARD 5: Live Salary Preview ── */}
                            {renderApprovalSalaryPreview()}

                            {/* ── CARD 6: Shift Configuration ── */}
                            <div className="p-4 bg-amber-50/50 rounded-2xl border border-amber-200 space-y-3">
                                <span className="text-[11px] font-black uppercase tracking-wider text-amber-700 flex items-center gap-1.5">
                                    <Clock className="h-4 w-4 text-amber-600" /> 4. Shift Configuration
                                </span>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div>
                                        <Label className="text-[10px] font-bold text-slate-600 mb-1 block">Shift Start</Label>
                                        <Input
                                            type="time"
                                            value={approvalOverrides.shift_start_time}
                                            onChange={(e) => setApprovalOverrides(a => ({ ...a, shift_start_time: e.target.value }))}
                                            className="h-10 rounded-xl bg-white font-mono text-xs font-bold"
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-[10px] font-bold text-slate-600 mb-1 block">Shift End</Label>
                                        <Input
                                            type="time"
                                            value={approvalOverrides.shift_end_time}
                                            onChange={(e) => setApprovalOverrides(a => ({ ...a, shift_end_time: e.target.value }))}
                                            className="h-10 rounded-xl bg-white font-mono text-xs font-bold"
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-[10px] font-bold text-slate-600 mb-1 block">Half-Day Threshold (Mins)</Label>
                                        <Input
                                            type="number"
                                            value={approvalOverrides.half_day_late_minutes}
                                            onChange={(e) => setApprovalOverrides(a => ({ ...a, half_day_late_minutes: e.target.value }))}
                                            className="h-10 rounded-xl bg-white font-mono text-xs font-bold"
                                        />
                                    </div>
                                </div>
                                <div className="pt-2 border-t border-amber-200/60">
                                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 bg-white p-2.5 rounded-xl border border-amber-200">
                                        <input
                                            type="checkbox"
                                            checked={approvalOverrides.is_rotational_shift}
                                            onChange={(e) => setApprovalOverrides(a => ({ ...a, is_rotational_shift: e.target.checked }))}
                                            className="h-4 w-4 rounded text-amber-600 focus:ring-amber-500"
                                        />
                                        <span>Rotational Shift Employee (Identifies employee on rotational shift roster)</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}

                    <DialogFooter className="mt-4 gap-2">
                        <Button
                            variant="outline"
                            onClick={() => setReviewCandidate(null)}
                            className="h-11 rounded-xl text-xs font-bold"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={() => reviewCandidate && approveCandidateSubmission(reviewCandidate.id)}
                            disabled={approveLoading}
                            className="bg-emerald-600 text-white hover:bg-emerald-700 font-black uppercase text-[10px] tracking-widest px-6 h-11 rounded-xl shadow-lg"
                        >
                            {approveLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "1-Click Approve Candidate"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Document Preview Dialog (Req 2.2 Document Verification) ── */}
            <Dialog open={!!previewDoc} onOpenChange={(open) => !open && setPreviewDoc(null)}>
                <DialogContent className="sm:max-w-[760px] max-h-[90vh] overflow-y-auto p-6 rounded-3xl bg-white border-none shadow-2xl">
                    <DialogHeader className="space-y-1.5 text-left pb-3 border-b border-slate-100">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5">
                                <div className="h-9 w-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                                    {previewDoc?.type === "photo" ? (
                                        <UserCheck className="h-5 w-5" />
                                    ) : previewDoc?.type?.includes("pan") ? (
                                        <ShieldCheck className="h-5 w-5" />
                                    ) : previewDoc?.type?.includes("bank") ? (
                                        <Banknote className="h-5 w-5" />
                                    ) : (
                                        <FileText className="h-5 w-5" />
                                    )}
                                </div>
                                <div>
                                    <DialogTitle className="text-base font-black text-slate-800 tracking-tight capitalize">
                                        {previewDoc?.type?.replace(/_/g, " ")} Document Preview
                                    </DialogTitle>
                                    <DialogDescription className="text-xs text-slate-500 font-mono truncate max-w-[360px]">
                                        {previewDoc?.filename}
                                    </DialogDescription>
                                </div>
                            </div>
                            {(previewDoc?.file_url || previewDoc?.data_url) && (
                                <div className="flex items-center gap-2">
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                            const targetUrl = previewDoc.data_url || getDocPreviewUrl(previewDoc.file_url);
                                            window.open(targetUrl, "_blank");
                                        }}
                                        className="h-8 px-3 text-xs font-bold border-slate-200 text-slate-700 hover:bg-slate-50 flex items-center gap-1.5"
                                    >
                                        <ExternalLink className="h-3.5 w-3.5" />
                                        <span>Open in Tab</span>
                                    </Button>
                                    <a
                                        href={previewDoc.data_url || getDocPreviewUrl(previewDoc.file_url)}
                                        download={previewDoc.filename}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg transition-colors border border-indigo-200"
                                    >
                                        <Download className="h-3.5 w-3.5" />
                                        <span>Download</span>
                                    </a>
                                </div>
                            )}
                        </div>
                    </DialogHeader>

                    {previewDoc && (
                        <div className="py-4 space-y-4">
                            {/* Document Display Canvas */}
                            {(previewDoc.file_url || previewDoc.data_url) ? (
                                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 overflow-hidden flex items-center justify-center min-h-[360px]">
                                    {(previewDoc.data_url?.startsWith("data:application/pdf") || previewDoc.file_url?.toLowerCase().endsWith(".pdf")) ? (
                                        <iframe
                                            src={previewDoc.data_url || getDocPreviewUrl(previewDoc.file_url)}
                                            title={previewDoc.filename}
                                            className="w-full h-[520px] rounded-xl border border-slate-200 bg-white"
                                        />
                                    ) : imgPreviewError ? (
                                        <div className="flex flex-col items-center justify-center p-8 text-center space-y-3 bg-white rounded-xl border border-dashed border-slate-300 w-full min-h-[300px]">
                                            <div className="h-14 w-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-inner">
                                                <FileText className="h-7 w-7" />
                                            </div>
                                            <div className="space-y-1 max-w-[380px]">
                                                <p className="text-sm font-bold text-slate-800 break-words">{previewDoc.filename}</p>
                                                <p className="text-xs text-slate-500">
                                                    Image preview is not directly embeddable. Use the buttons below to open or download the document:
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2 pt-2">
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    onClick={() => {
                                                        const targetUrl = previewDoc.data_url || getDocPreviewUrl(previewDoc.file_url);
                                                        window.open(targetUrl, "_blank");
                                                    }}
                                                    className="h-8 px-4 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5"
                                                >
                                                    <ExternalLink className="h-3.5 w-3.5" />
                                                    <span>Open Full File</span>
                                                </Button>
                                                <a
                                                    href={previewDoc.data_url || getDocPreviewUrl(previewDoc.file_url)}
                                                    download={previewDoc.filename}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1.5 h-8 px-4 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors border border-slate-200"
                                                >
                                                    <Download className="h-3.5 w-3.5" />
                                                    <span>Download</span>
                                                </a>
                                            </div>
                                        </div>
                                    ) : (
                                        <img
                                            src={previewDoc.data_url || getDocPreviewUrl(previewDoc.file_url)}
                                            alt={previewDoc.filename}
                                            onError={() => setImgPreviewError(true)}
                                            className="max-h-[500px] w-auto max-w-full object-contain rounded-xl shadow-md border border-slate-200/80 bg-white"
                                        />
                                    )}
                                </div>
                            ) : (
                                /* Fallback Document Card */
                                <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-50 to-indigo-50/40 border border-slate-200 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-black uppercase tracking-wider text-indigo-700">
                                            Candidate Submission Record
                                        </span>
                                        <Badge className="bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                                            Submitted & Verified
                                        </Badge>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 text-xs bg-white p-4 rounded-xl border border-slate-200">
                                        <div>
                                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Candidate</span>
                                            <span className="font-bold text-slate-800">{previewDoc.candidate_name || "—"}</span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Document Type</span>
                                            <span className="font-bold text-slate-800 capitalize">{previewDoc.type.replace(/_/g, " ")}</span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] uppercase font-bold text-slate-400 block">File Name</span>
                                            <span className="font-mono text-slate-700 truncate block">{previewDoc.filename}</span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] uppercase font-bold text-slate-400 block">File Size</span>
                                            <span className="font-bold text-slate-700">
                                                {previewDoc.size ? `${Math.round(previewDoc.size / 1024)} KB` : "N/A"}
                                            </span>
                                        </div>
                                        {previewDoc.aadhaar_number && previewDoc.type.includes("aadhaar") && (
                                            <div className="col-span-2 pt-2 border-t border-slate-100">
                                                <span className="text-[10px] uppercase font-bold text-slate-400 block">Declared Aadhaar Number</span>
                                                <span className="font-mono font-bold text-slate-900 tracking-wider">{previewDoc.aadhaar_number}</span>
                                            </div>
                                        )}
                                        {previewDoc.pan_number && previewDoc.type.includes("pan") && (
                                            <div className="col-span-2 pt-2 border-t border-slate-100">
                                                <span className="text-[10px] uppercase font-bold text-slate-400 block">Declared PAN Number</span>
                                                <span className="font-mono font-bold text-slate-900 tracking-wider">{previewDoc.pan_number}</span>
                                            </div>
                                        )}
                                        {previewDoc.bank_account_number && previewDoc.type.includes("bank") && (
                                            <div className="col-span-2 pt-2 border-t border-slate-100">
                                                <span className="text-[10px] uppercase font-bold text-slate-400 block">Declared Bank Account</span>
                                                <span className="font-mono font-bold text-slate-900">
                                                    {previewDoc.bank_name?.toUpperCase()} — A/C: {previewDoc.bank_account_number} (IFSC: {previewDoc.ifsc_code})
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Candidate & Verification Meta */}
                            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
                                <div className="flex items-center gap-2">
                                    <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                                    <span>Uploaded by candidate <strong className="text-slate-800">{previewDoc.candidate_name}</strong> during self-onboarding verification.</span>
                                </div>
                                {previewDoc.size && (
                                    <span className="font-mono text-slate-500 font-bold shrink-0">
                                        {Math.round(previewDoc.size / 1024)} KB
                                    </span>
                                )}
                            </div>
                        </div>
                    )}

                    <DialogFooter className="pt-2 border-t border-slate-100">
                        <Button
                            type="button"
                            onClick={() => setPreviewDoc(null)}
                            className="h-10 px-5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-900 text-white"
                        >
                            Close Preview
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </ProtectedRoute >
    );
}

export default function OnboardingPage() {
    return (
        <Suspense fallback={<div className="flex h-screen items-center justify-center bg-slate-50"><Loader2 className="h-8 w-8 animate-spin text-indigo-500" /></div>}>
            <OnboardingForm />
        </Suspense>
    );
}
