"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  FileType, FileText, Download, Eye,
  CheckCircle2, Search, Clock, FileSignature, ArrowUpRight, Mail,
  Loader2, AlertCircle, Send, Pencil, X, Save, RefreshCw,
  Plus, Trash2, History, UserCheck, Briefcase, Building2, Sparkles, Phone, ExternalLink
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import { LetterPreview, typeAccentMap } from "./templateDesigns";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api-client";

const cn = (...classes: (string | boolean | undefined | null)[]) => classes.filter(Boolean).join(" ");

type TemplateItem = {
  id: number;
  name: string;
  type: string;
  category: string;
  description: string | null;
  content: string;
  variant_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type EmployeeOption = {
  id: number;
  name: string;
  emp_code: string;
  department?: string;
  designation?: string;
  email?: string;
};

type PreviewEmployee = {
  id: number | string;
  name: string;
  emp_code: string;
  designation: string;
  department: string;
  email: string;
  phone: string;
  office: string;
  company: string;
  companyDetails?: any;
  date?: string;
};

type PreviewData = {
  template: {
    id: number;
    name: string;
    type: string;
    category: string;
    variant_count: number;
  };
  employee: PreviewEmployee;
  signatory?: {
    id: number;
    name: string;
    designation: string;
    signature_url?: string;
  } | null;
  content: string;
};

type IssuedLetter = {
  id: number;
  employee_id: number | null;
  candidate_name: string | null;
  candidate_email: string | null;
  candidate_phone: string | null;
  type: string;
  title: string;
  content: string | null;
  issued_date: string;
  status: "draft" | "issued" | "acknowledged" | "revoked";
  pdf_url?: string | null;
  signatory_id?: number | null;
  issuedTo?: {
    id: number;
    emp_code: string;
    name: string;
    department?: string;
    designation?: string;
    email?: string;
  } | null;
  signatory?: {
    id: number;
    name: string;
    designation: string;
    signature_url?: string;
  } | null;
  issuedBy?: {
    id: number;
    emp_code: string;
    name: string;
  } | null;
};

const TYPE_LABEL_MAP: Record<string, string> = {
  offer: "Offer Letter",
  appointment: "Appointment Letter",
  promotion: "Promotion Letter",
  transfer: "Transfer Letter",
  resignation: "Resignation Acceptance",
  experience: "Experience Certificate",
  relieving: "Relieving Letter",
  warning: "Warning Letter",
  form16: "Form 16 (TDS Certificate)",
  "non-performance": "Non-Performance Letter",
  absenteeism: "Absenteeism Warning",
};

const TYPE_BADGE_STYLE: Record<string, string> = {
  offer: "bg-emerald-50 text-emerald-700 border-emerald-200",
  appointment: "bg-blue-50 text-blue-700 border-blue-200",
  promotion: "bg-purple-50 text-purple-700 border-purple-200",
  transfer: "bg-amber-50 text-amber-700 border-amber-200",
  warning: "bg-rose-50 text-rose-700 border-rose-200",
  resignation: "bg-slate-100 text-slate-700 border-slate-200",
  experience: "bg-cyan-50 text-cyan-700 border-cyan-200",
  relieving: "bg-teal-50 text-teal-700 border-teal-200",
  form16: "bg-sky-50 text-sky-700 border-sky-200",
};

const variantMeta = [
  { id: 1, label: "Standard Corporate", desc: "Navy bar · Serif · Two-col header" },
  { id: 2, label: "Modern Minimalist", desc: "Centered logo · Light gray · Sans" },
  { id: 3, label: "Premium Executive", desc: "Dark navy bleed · Accent title band" },
  { id: 4, label: "Creative Edge", desc: "Bold side bar · Big type treatment" },
  { id: 5, label: "Classic Formal", desc: "Double-border frame · Old-world look" },
];

const AVAILABLE_PLACEHOLDERS = [
  { tag: "[Employee_Name]", desc: "Full Name" },
  { tag: "[Job_Title]", desc: "Designation" },
  { tag: "[Department]", desc: "Department" },
  { tag: "[Office_Location]", desc: "Office / Branch" },
  { tag: "[Company_Name]", desc: "Company Legal Name" },
  { tag: "[Start_Date]", desc: "Effective / Start Date" },
  { tag: "[Joining_Date]", desc: "Date of Joining" },
  { tag: "[Relieving_Date]", desc: "Relieving Date" },
  { tag: "[Salary]", desc: "Monthly Gross" },
  { tag: "[Salary_Annual]", desc: "Annual Gross" },
  { tag: "[CTC]", desc: "Monthly CTC" },
  { tag: "[CTC_Annual]", desc: "Annual CTC" },
  { tag: "[Basic_Salary]", desc: "Monthly Basic (40%)" },
  { tag: "[HRA]", desc: "Monthly HRA" },
  { tag: "[Special_Allowance]", desc: "Special Allowance" },
  { tag: "[PF_Employee]", desc: "Employee PF Deduction" },
  { tag: "[ESI_Employee]", desc: "Employee ESIC Deduction" },
  { tag: "[Professional_Tax]", desc: "Professional Tax (PT)" },
  { tag: "[Total_Deductions]", desc: "Total Monthly Deductions" },
  { tag: "[Net_Take_Home]", desc: "Net Take-Home Pay" },
  { tag: "[PF_Employer]", desc: "Employer PF Contribution" },
  { tag: "[ESI_Employer]", desc: "Employer ESIC Contribution" },
  { tag: "[Company_PAN]", desc: "Employer PAN" },
  { tag: "[Company_TAN]", desc: "Employer TAN" },
  { tag: "[Financial_Year]", desc: "Financial Year (e.g. 2025-26)" },
  { tag: "[Assessment_Year]", desc: "Assessment Year (e.g. 2026-27)" },
  { tag: "[Total_Taxable_Income]", desc: "Taxable Income after 80C" },
  { tag: "[Total_TDS_Deposited]", desc: "Annual Tax Deposited" },
  { tag: "[Signatory_Name]", desc: "Signatory Name" },
  { tag: "[Signatory_Designation]", desc: "Signatory Role" },
];

export default function LettersPage() {
  const [activeTab, setActiveTab] = useState<"templates" | "history">("templates");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateItem | null>(null);
  const [selectedVariant, setSelectedVariant] = useState(1);
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [selectedSignatory, setSelectedSignatory] = useState<string>("");
  const [emailEnabled, setEmailEnabled] = useState(true);

  // API state
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [signatories, setSignatories] = useState<any[]>([]);
  const [letters, setLetters] = useState<IssuedLetter[]>([]);
  const [lettersLoading, setLettersLoading] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [historyTypeFilter, setHistoryTypeFilter] = useState("all");
  const [historyStatusFilter, setHistoryStatusFilter] = useState("all");

  // Preview state
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [editedContent, setEditedContent] = useState<string>("");
  const [isEditing, setIsEditing] = useState(false);

  // Candidate mode state (Req 12.4)
  const [candidateMode, setCandidateMode] = useState(false);
  const [candidateData, setCandidateData] = useState({
    name: "",
    email: "",
    phone: "",
    designation: "",
    department: "",
    office: "",
    company: "",
    date_of_joining: "",
    fixed_gross: "",
    pf_applicable: true,
    pf_ceiling: true,
    pf_contribution_mode: "shared",
    pf_employer_rate: 0.12,
    pf_employee_rate: 0.12,
    esic_applicable: true,
    esic_contribution_mode: "shared",
    esic_employer_rate: 0.0325,
    esic_employee_rate: 0.0075,
    pt_applicable: true,
  });

  // Action state
  const [issuing, setIssuing] = useState(false);
  const [issueError, setIssueError] = useState("");
  const [issueSuccess, setIssueSuccess] = useState("");
  const [sending, setSending] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [emailingLetterId, setEmailingLetterId] = useState<number | null>(null);
  const [viewingLetter, setViewingLetter] = useState<IssuedLetter | null>(null);
  const [downloadingLetterId, setDownloadingLetterId] = useState<number | null>(null);

  // Template Editor Modal state (Req 12.3)
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<number | null>(null);
  const [templateForm, setTemplateForm] = useState({
    name: "",
    type: "offer",
    category: "Hiring",
    description: "",
    content: "",
    is_active: true,
  });
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateSaveError, setTemplateSaveError] = useState("");

  // Companies & Offices
  const [companies, setCompanies] = useState<any[]>([]);
  const [offices, setOffices] = useState<any[]>([]);

  // ── Seed Templates Handler ──
  const handleSeedTemplates = async (force: boolean = false) => {
    setSeeding(true);
    setIssueError("");
    setIssueSuccess("");
    try {
      const query = force ? "?force=true" : "";
      await apiPost<any>(`/letters/templates/seed${query}`);
      await fetchTemplates();
      setIssueSuccess(force ? "Templates reset to official default standards successfully!" : "Default templates seeded successfully!");
    } catch (err: any) {
      setIssueError(err?.message || "Failed to seed templates");
    } finally {
      setSeeding(false);
    }
  };

  // ── Fetch Templates ──
  const fetchTemplates = useCallback(async () => {
    try {
      const data = await apiGet<any>("/letters/templates/all");
      const rows = Array.isArray(data) ? data : (data?.data || data?.rows || []);
      setTemplates(rows);
    } catch {
      // Non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Fetch Letters ──
  const fetchLetters = useCallback(async () => {
    setLettersLoading(true);
    try {
      const data = await apiGet<any>("/letters", { limit: 200 });
      const rows = Array.isArray(data) ? data : (data?.data || data?.rows || []);
      setLetters(rows);
    } catch {
      // Non-critical
    } finally {
      setLettersLoading(false);
    }
  }, []);

  // ── Fetch Employees ──
  const fetchEmployees = useCallback(async () => {
    try {
      const data = await apiGet<any>("/employees", { limit: "200" });
      const rows = Array.isArray(data) ? data : (data?.data || data?.rows || []);
      setEmployees(rows.map((e: any) => ({
        id: e.id,
        name: e.name,
        emp_code: e.emp_code,
        department: e.department,
        designation: e.designation,
        email: e.email,
      })));
    } catch {
      // Non-critical
    }
  }, []);

  // ── Fetch Companies and Offices ──
  const fetchCompaniesAndOffices = useCallback(async () => {
    try {
      const compData = await apiGet<any>("/companies");
      setCompanies(Array.isArray(compData) ? compData : (compData?.data || compData?.rows || []));
      
      const offData = await apiGet<any>("/offices", { limit: 100 });
      setOffices(Array.isArray(offData) ? offData : (offData?.data || offData?.rows || []));
    } catch {
      // Non-critical
    }
  }, []);

  // ── Fetch Signatories (Req 12.3) ──
  const fetchSignatories = useCallback(async () => {
    try {
      const data = await apiGet<any>("/signatories", { active: "true" });
      const rows = Array.isArray(data) ? data : (data?.data || data?.rows || []);
      setSignatories(rows);
      if (rows.length > 0 && !selectedSignatory) {
        // Pre-select first active signatory as default
        setSelectedSignatory(String(rows[0].id));
      }
    } catch {
      // Non-critical
    }
  }, [selectedSignatory]);

  useEffect(() => {
    fetchTemplates();
    fetchLetters();
    fetchEmployees();
    fetchCompaniesAndOffices();
    fetchSignatories();
  }, [fetchTemplates, fetchLetters, fetchEmployees, fetchCompaniesAndOffices, fetchSignatories]);

  // ── Auto-select from URL params ──
  useEffect(() => {
    if (typeof window !== "undefined" && employees.length > 0 && templates.length > 0) {
      const params = new URLSearchParams(window.location.search);
      const empId = params.get("employeeId");
      const tType = params.get("templateType");
      
      if (empId && !selectedEmployee) {
        setSelectedEmployee(empId);
      }
      
      if (tType && !selectedTemplate) {
        const found = templates.find(t => t.type === tType || t.name.toLowerCase().includes(tType.toLowerCase()));
        if (found) {
          setSelectedTemplate(found);
        }
      }
    }
  }, [employees, templates, selectedEmployee, selectedTemplate]);

  // ── Fetch Preview when template + employee/candidate/signatory changes ──
  useEffect(() => {
    if (!selectedTemplate) {
      setPreviewData(null);
      setEditedContent("");
      return;
    }
    if (!candidateMode && !selectedEmployee) {
      setPreviewData(null);
      setEditedContent("");
      return;
    }
    let cancelled = false;
    const load = async () => {
      setPreviewLoading(true);
      try {
        const payload: any = { 
          templateId: selectedTemplate.id,
          signatory_id: selectedSignatory ? parseInt(selectedSignatory, 10) : undefined,
        };
        if (!candidateMode) {
          payload.employeeId = selectedEmployee;
        } else {
          if (!candidateData.name) {
            if (!cancelled) setPreviewLoading(false);
            return;
          }
          payload.candidateData = candidateData;
        }

        const data = await apiPost<any>("/letters/templates/preview", payload);
        const preview = Array.isArray(data) ? data[0] : (data?.data || data);
        if (!cancelled) {
          setPreviewData(preview);
          setEditedContent(preview?.content || "");
          setIssueError("");
          setIssueSuccess("");
        }
      } catch (err: any) {
        if (!cancelled) {
          setPreviewData(null);
          setEditedContent("");
        }
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    };
    
    const timer = setTimeout(load, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [selectedTemplate, selectedEmployee, candidateMode, candidateData, selectedSignatory]);

  // ── Filtered templates ──
  const filteredTemplates = templates.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.category && t.category.toLowerCase().includes(searchTerm.toLowerCase())) ||
      t.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.description && t.description.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = selectedCategory === "all" || (t.category && t.category.toLowerCase() === selectedCategory.toLowerCase());
    return matchesSearch && matchesCategory;
  });

  // ── Filtered History ──
  const filteredHistory = letters.filter(l => {
    const query = historySearch.toLowerCase();
    const matchesSearch = !query ||
      l.title.toLowerCase().includes(query) ||
      (l.candidate_name && l.candidate_name.toLowerCase().includes(query)) ||
      (l.candidate_email && l.candidate_email.toLowerCase().includes(query)) ||
      (l.issuedTo?.name && l.issuedTo.name.toLowerCase().includes(query)) ||
      (l.issuedTo?.emp_code && l.issuedTo.emp_code.toLowerCase().includes(query));
    const matchesType = historyTypeFilter === "all" || l.type === historyTypeFilter;
    const matchesStatus = historyStatusFilter === "all" || l.status === historyStatusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  const issuedCount = letters.filter(l => l.status === "issued" || l.status === "acknowledged").length;
  const ackCount = letters.filter(l => l.status === "acknowledged").length;
  const candidateLetterCount = letters.filter(l => !l.employee_id).length;
  const compliancePct = issuedCount > 0 ? Math.round((ackCount / issuedCount) * 100) : 100;

  const accentColor = (selectedTemplate)
    ? (typeAccentMap[selectedTemplate.type] || "#1e293b")
    : "#1e293b";

  // ── Handle PDF Generation & Download (with optional official record) ──
  const handleDownloadPDF = async (record: boolean = false) => {
    if (!selectedTemplate) {
      setIssueError("Please select a template.");
      return;
    }
    if (!candidateMode && !selectedEmployee) {
      setIssueError("Please select an employee.");
      return;
    }
    if (candidateMode && !candidateData.name) {
      setIssueError("Please enter candidate name.");
      return;
    }
    
    setIssuing(true);
    setIssueError("");
    setIssueSuccess("");

    try {
      const employeeId = !candidateMode ? parseInt(selectedEmployee, 10) : undefined;
      const content = editedContent || previewData?.content || "";
      const token = typeof window !== "undefined" ? localStorage.getItem("hrms_auth_token") : null;
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "https://api.apaarpulse.com/api/v1";

      const previewContainer = document.getElementById("pdf-preview-container");
      let fullHtml = previewContainer ? previewContainer.outerHTML : "";
      if (typeof window !== "undefined") {
        fullHtml = fullHtml.replace(/src="\/(?!\/)/g, `src="${window.location.origin}/`);
      }

      const response = await fetch(`${baseUrl}/letters/generate-pdf`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          employee_id: employeeId,
          candidateData: candidateMode ? candidateData : undefined,
          template_id: selectedTemplate.id,
          title: TYPE_LABEL_MAP[selectedTemplate?.type || ""] || previewData?.template?.name || selectedTemplate.name,
          type: selectedTemplate.type,
          content: content,
          fullHtml: fullHtml,
          signatory_id: selectedSignatory ? parseInt(selectedSignatory, 10) : undefined,
          recordLetter: record,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Failed to generate PDF" }));
        throw new Error(errorData.message || "Failed to generate PDF");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const recipientCode = candidateMode ? (candidateData.name.replace(/\s+/g, "_") || "candidate") : (previewData?.employee?.emp_code || "employee");
      link.download = `${selectedTemplate.type}-${recipientCode}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      if (record) {
        setIssueSuccess("Letter issued, recorded in history, and PDF downloaded!");
        await fetchLetters();
      } else {
        setIssueSuccess("PDF generated and downloaded successfully!");
      }
    } catch (err: any) {
      setIssueError(err?.message || "Failed to generate PDF.");
    } finally {
      setIssuing(false);
    }
  };

  // ── Handle Email Send & Record (Req 12.1 & 12.4) ──
  const handleSendEmail = async () => {
    if (!selectedTemplate) {
      setIssueError("Please select a template.");
      return;
    }
    if (!candidateMode && !selectedEmployee) {
      setIssueError("Please select an employee.");
      return;
    }
    if (candidateMode && !candidateData.email) {
      setIssueError("Please enter a valid candidate email address.");
      return;
    }
    
    setSending(true);
    setIssueError("");
    setIssueSuccess("");

    try {
      const employeeId = !candidateMode ? parseInt(selectedEmployee, 10) : undefined;
      const content = editedContent || previewData?.content || "";
      const previewContainer = document.getElementById("pdf-preview-container");
      let fullHtml = previewContainer ? previewContainer.outerHTML : "";
      if (typeof window !== "undefined") {
        fullHtml = fullHtml.replace(/src="\/(?!\/)/g, `src="${window.location.origin}/`);
      }

      await apiPost("/letters/send-email", {
        employee_id: employeeId,
        candidateData: candidateMode ? candidateData : undefined,
        template_id: selectedTemplate.id,
        title: TYPE_LABEL_MAP[selectedTemplate?.type || ""] || previewData?.template?.name || selectedTemplate.name,
        type: selectedTemplate.type,
        content: content,
        fullHtml: fullHtml,
        signatory_id: selectedSignatory ? parseInt(selectedSignatory, 10) : undefined,
      });

      const recipientName = candidateMode ? candidateData.name : (previewData?.employee?.name || "Employee");
      setIssueSuccess(`Letter successfully issued, recorded, and sent to ${recipientName} via email!`);
      await fetchLetters();
    } catch (err: any) {
      setIssueError(err?.message || "Failed to send email.");
    } finally {
      setSending(false);
    }
  };

  // ── Delete Issued Letter Handler ──
  const handleDeleteLetter = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this issued letter record?")) return;
    try {
      await apiDelete(`/letters/${id}`);
      await fetchLetters();
    } catch (err: any) {
      alert(err?.message || "Failed to delete letter");
    }
  };

  // ── Dispatch Email for Existing Letter in History (Req 2.10) ──
  const handleSendExistingEmail = async (letter: IssuedLetter) => {
    const targetEmail = letter.issuedTo?.email || letter.candidate_email;
    const targetName = letter.issuedTo?.name || letter.candidate_name || "Employee";

    if (!targetEmail) {
      alert("This recipient does not have a registered email address on file.");
      return;
    }

    if (!window.confirm(`Send official ${letter.title} directly to ${targetName}'s registered email (${targetEmail})?`)) {
      return;
    }

    setEmailingLetterId(letter.id);
    setIssueError("");
    setIssueSuccess("");
    try {
      const res: any = await apiPost(`/letters/${letter.id}/send-email`, {});
      const successMsg = res?.message || `Document successfully dispatched to registered email (${targetEmail})!`;
      setIssueSuccess(successMsg);
      await fetchLetters();
    } catch (err: any) {
      setIssueError(err?.message || `Failed to dispatch email to ${targetEmail}`);
    } finally {
      setEmailingLetterId(null);
    }
  };

  // ── Download PDF for Existing Letter in History ──
  const handleDownloadHistoryPDF = async (letter: IssuedLetter) => {
    setDownloadingLetterId(letter.id);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("hrms_auth_token") : null;
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "https://api.apaarpulse.com/api/v1";
      const recipientCode = letter.issuedTo?.emp_code || (letter.candidate_name ? letter.candidate_name.replace(/\s+/g, "_") : "recipient");

      const response = await fetch(`${baseUrl}/letters/generate-pdf`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          employee_id: letter.employee_id || undefined,
          candidateData: !letter.employee_id ? {
            name: letter.candidate_name || "Candidate",
            email: letter.candidate_email || "",
            phone: letter.candidate_phone || "",
          } : undefined,
          title: letter.title,
          type: letter.type,
          content: letter.content || "",
          signatory_id: letter.signatory_id || undefined,
          recordLetter: false,
        }),
      });

      if (!response.ok) throw new Error("Failed to generate PDF");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${letter.type}-${recipientCode}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err?.message || "Failed to download PDF");
    } finally {
      setDownloadingLetterId(null);
    }
  };

  // ── Open Template Editor (Req 12.3) ──
  const handleOpenEditor = (template?: TemplateItem) => {
    if (template) {
      setEditingTemplateId(template.id);
      setTemplateForm({
        name: template.name,
        type: template.type,
        category: template.category || "Hiring",
        description: template.description || "",
        content: template.content || "",
        is_active: template.is_active,
      });
    } else {
      setEditingTemplateId(null);
      setTemplateForm({
        name: "",
        type: "offer",
        category: "Hiring",
        description: "",
        content: "<p>Dear <strong>[Employee_Name]</strong>,</p>\n\n<p>Enter template body here...</p>",
        is_active: true,
      });
    }
    setTemplateSaveError("");
    setEditorOpen(true);
  };

  // ── Save Template (Create or Update) ──
  const handleSaveTemplate = async () => {
    if (!templateForm.name.trim()) {
      setTemplateSaveError("Template name is required.");
      return;
    }
    setSavingTemplate(true);
    setTemplateSaveError("");
    try {
      if (editingTemplateId) {
        await apiPatch(`/letters/templates/${editingTemplateId}`, templateForm);
      } else {
        await apiPost("/letters/templates", templateForm);
      }
      await fetchTemplates();
      setEditorOpen(false);
    } catch (err: any) {
      setTemplateSaveError(err?.message || "Failed to save template.");
    } finally {
      setSavingTemplate(false);
    }
  };

  // ── Insert Placeholder in Template Editor ──
  const handleInsertPlaceholder = (tag: string) => {
    setTemplateForm(prev => ({
      ...prev,
      content: prev.content + ` ${tag} `,
    }));
  };

  // ── Build preview props for Live Preview ──
  const activeSignatoryObj = selectedSignatory ? signatories.find(s => String(s.id) === selectedSignatory) : null;

  const employeeForPreview = previewData?.employee ? {
    name: previewData.employee.name,
    designation: previewData.employee.designation,
    department: previewData.employee.department,
    office: (previewData.employee.office as any)?.name || previewData.employee.office,
    company: previewData.employee.company,
    companyDetails: previewData.employee.companyDetails,
    date: previewData.employee.date || new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
  } : (!candidateMode && selectedEmployee ? employees.find(e => String(e.id) === selectedEmployee) : null) ? {
    name: employees.find(e => String(e.id) === selectedEmployee)!.name,
    designation: employees.find(e => String(e.id) === selectedEmployee)!.designation,
    department: employees.find(e => String(e.id) === selectedEmployee)!.department,
    office: undefined,
    company: undefined,
    companyDetails: undefined,
    date: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
  } : {
    name: candidateData.name || "Candidate Name",
    designation: candidateData.designation || "Proposed Designation",
    department: candidateData.department || "Department",
    office: candidateData.office || "Head Office",
    company: candidateData.company || "Company",
    date: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
  };

  return (
    <ProtectedRoute module="LETTERS" action="READ">
      <div className="space-y-8 pb-20">

        {/* ── Page Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-2">
          <div>
            <h1 className="text-xl font-black text-slate-900 flex items-center gap-3 italic uppercase tracking-tighter underline underline-offset-4 decoration-[#D9F99D] decoration-2">
              <FileType className="h-6 w-6 text-rose-500" /> Offer & Appointment Letter Engine
            </h1>
            <p className="text-[9px] font-black text-slate-400 mt-2 uppercase tracking-[0.3em]">
              Executive letters, candidate generation, salary breakup annexures & signatories (Section 12)
            </p>
          </div>

          {/* Top Tabs */}
          <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
            <button
              onClick={() => setActiveTab("templates")}
              className={cn(
                "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-2",
                activeTab === "templates"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-900"
              )}
            >
              <FileSignature className="h-3.5 w-3.5" />
              Document Templates
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={cn(
                "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-2",
                activeTab === "history"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-900"
              )}
            >
              <History className="h-3.5 w-3.5" />
              Issued Letters
              {letters.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[8px] bg-slate-900 text-white font-mono">
                  {letters.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* ── Stats Overview ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Active Templates", value: `${templates.filter(t => t.is_active).length} Templates`, icon: FileSignature, bg: "bg-white" },
            { label: "Letters Issued", value: `${issuedCount} Letters`, icon: Send, bg: "bg-white" },
            { label: "Candidate Letters", value: `${candidateLetterCount} Issued`, icon: Briefcase, bg: "bg-white" },
            { label: "Compliance Rate", value: `${compliancePct}% Acknowledged`, icon: CheckCircle2, bg: "bg-[#D9F99D]" },
          ].map((stat, i) => (
            <Card key={i} className={`${stat.bg} border-none rounded-2xl p-5 shadow-sm flex flex-col justify-between h-32 group hover:shadow-md transition-all`}>
              <div className="h-8 w-8 bg-slate-50 rounded-xl flex items-center justify-center group-hover:bg-[#D9F99D]/30 transition-colors">
                <stat.icon className="h-4 w-4 text-slate-500 group-hover:text-slate-900 transition-colors" />
              </div>
              <div>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{stat.label}</p>
                <h3 className="text-base font-black text-slate-900 uppercase italic tracking-tighter">{stat.value}</h3>
              </div>
            </Card>
          ))}
        </div>

        {/* ── TAB 1: DOCUMENT TEMPLATES ── */}
        {activeTab === "templates" && (
          <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden p-2">
            <CardHeader className="p-6 pb-4 border-none">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg font-black italic text-slate-900 underline underline-offset-4 decoration-[#D9F99D] decoration-2 uppercase tracking-tighter">
                    Document Template Catalog
                  </CardTitle>
                  <CardDescription className="text-[9px] font-black text-slate-400 mt-2 uppercase tracking-[0.25em]">
                    Select an official template to generate, customize, and issue letters
                  </CardDescription>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative group">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-300 group-focus-within:text-slate-900 transition-colors" />
                    <Input
                      placeholder="Search templates..."
                      className="h-9 w-56 pl-10 bg-slate-50 border-none rounded-xl font-bold text-[10px] focus-visible:ring-1 focus-visible:ring-[#D9F99D] shadow-inner"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>

                  <Button
                    onClick={() => handleOpenEditor()}
                    size="sm"
                    className="h-9 bg-slate-900 text-white hover:bg-slate-800 font-black text-[9px] uppercase tracking-wider rounded-xl px-3.5"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> New Template
                  </Button>

                  <Button
                    onClick={() => handleSeedTemplates(true)}
                    disabled={seeding}
                    variant="outline"
                    size="sm"
                    title="Reset all standard corporate templates to official standards"
                    className="h-9 border-slate-200 hover:bg-[#D9F99D]/20 hover:border-[#D9F99D] font-black text-[9px] uppercase tracking-wider rounded-xl px-3"
                  >
                    {seeding ? (
                      <span className="flex items-center gap-1.5">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Resetting...
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5">
                        <RefreshCw className="h-3 w-3" />
                        Reset Standards
                      </span>
                    )}
                  </Button>
                </div>
              </div>

              {/* Category Pills */}
              <div className="flex items-center gap-2 pt-4 overflow-x-auto">
                {["all", "Hiring", "Disciplinary", "Exit", "General", "Tax & Statutory"].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={cn(
                      "px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all",
                      selectedCategory.toLowerCase() === cat.toLowerCase()
                        ? "bg-[#D9F99D] text-slate-900 shadow-sm"
                        : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </CardHeader>

            <CardContent className="p-4">
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
                </div>
              ) : filteredTemplates.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                  <FileText className="h-10 w-10 mb-4 opacity-30" />
                  <p className="text-[10px] font-black uppercase tracking-widest">No templates found</p>
                  <p className="text-[9px] mt-1">Seed default templates or create a new template.</p>
                  <Button
                    onClick={() => handleSeedTemplates(false)}
                    disabled={seeding}
                    className="mt-6 bg-[#D9F99D] hover:bg-[#C7F07A] text-slate-900 font-black text-[9px] uppercase tracking-widest rounded-xl px-5 h-10 shadow-sm"
                  >
                    <RefreshCw className="h-3.5 w-3.5 mr-2" /> Seed Default Templates
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredTemplates.map((template) => {
                    const isOffer = template.type === "offer";
                    const isAppointment = template.type === "appointment";
                    const isRelieving = template.type === "relieving";
                    const isForm16 = template.type === "form16";
                    return (
                      <Card
                        key={template.id}
                        className={cn(
                          "border-2 rounded-2xl p-5 transition-all group relative overflow-hidden flex flex-col justify-between",
                          isAppointment ? "border-blue-100 bg-blue-50/20 hover:border-blue-400" :
                          isOffer ? "border-emerald-100 bg-emerald-50/20 hover:border-emerald-400" :
                          isRelieving ? "border-teal-100 bg-teal-50/20 hover:border-teal-400" :
                          isForm16 ? "border-sky-100 bg-sky-50/20 hover:border-sky-400" :
                          "border-slate-100 bg-white hover:border-[#D9F99D] hover:bg-slate-50/40"
                        )}
                      >
                        <div className="space-y-3 relative z-10">
                          <div className="flex items-center justify-between">
                            <Badge className={cn("border font-bold text-[8px] uppercase tracking-wider px-2 py-0.5 rounded-md", TYPE_BADGE_STYLE[template.type] || "bg-slate-100 text-slate-700")}>
                              {TYPE_LABEL_MAP[template.type] || template.type}
                            </Badge>
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                              {template.category || "General"}
                            </span>
                          </div>

                          <div>
                            <h3 className="text-base font-black text-slate-900 uppercase italic tracking-tight group-hover:translate-x-0.5 transition-transform">
                              {template.name}
                            </h3>
                            <p className="text-[9px] text-slate-500 mt-1 line-clamp-2">
                              {template.description || "Official HR template with dynamic placeholder binding."}
                            </p>
                          </div>

                          {/* Specific callout pill for Req 12.2 & Req 2.10 */}
                          {isAppointment && (
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-100/70 text-blue-800 text-[8px] font-black uppercase tracking-wider">
                              <Sparkles className="h-3 w-3 text-blue-600" />
                              Includes Annexure A Salary Breakup
                            </div>
                          )}
                          {isOffer && (
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-100/70 text-emerald-800 text-[8px] font-black uppercase tracking-wider">
                              <Briefcase className="h-3 w-3 text-emerald-600" />
                              Offered CTC & Joining Terms
                            </div>
                          )}
                          {isRelieving && (
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-100/70 text-teal-800 text-[8px] font-black uppercase tracking-wider">
                              <UserCheck className="h-3 w-3 text-teal-600" />
                              Clearance & Exit Handover
                            </div>
                          )}
                          {isForm16 && (
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-100/70 text-sky-800 text-[8px] font-black uppercase tracking-wider">
                              <FileText className="h-3 w-3 text-sky-600" />
                              Section 203 TDS Certificate (Part A & B)
                            </div>
                          )}
                        </div>

                        <div className="mt-6 pt-3 border-t border-slate-100 flex items-center justify-between relative z-10">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEditor(template)}
                            className="h-8 px-2.5 text-slate-500 hover:text-slate-900 hover:bg-white text-[8px] font-black uppercase tracking-wider rounded-lg"
                          >
                            <Pencil className="h-3 w-3 mr-1" /> Edit Template
                          </Button>

                          <Button
                            onClick={() => {
                              setSelectedTemplate(template);
                              setSelectedVariant(1);
                              setIssueError("");
                              setIssueSuccess("");
                              setIsEditing(false);
                            }}
                            size="sm"
                            className="h-8 px-3.5 bg-slate-900 text-white hover:bg-[#D9F99D] hover:text-slate-900 font-black uppercase text-[8px] tracking-wider rounded-xl transition-all"
                          >
                            Generate <ArrowUpRight className="h-3 w-3 ml-1" />
                          </Button>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── TAB 2: ISSUED LETTERS HISTORY ── */}
        {activeTab === "history" && (
          <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden p-2">
            <CardHeader className="p-6 pb-4 border-none">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg font-black italic text-slate-900 underline underline-offset-4 decoration-[#D9F99D] decoration-2 uppercase tracking-tighter">
                    Issued Letters History
                  </CardTitle>
                  <CardDescription className="text-[9px] font-black text-slate-400 mt-2 uppercase tracking-[0.25em]">
                    Log of all generated, issued, and emailed documents for candidates and employees
                  </CardDescription>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative group">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-300 group-focus-within:text-slate-900 transition-colors" />
                    <Input
                      placeholder="Search recipient or title..."
                      className="h-9 w-60 pl-10 bg-slate-50 border-none rounded-xl font-bold text-[10px] focus-visible:ring-1 focus-visible:ring-[#D9F99D] shadow-inner"
                      value={historySearch}
                      onChange={(e) => setHistorySearch(e.target.value)}
                    />
                  </div>

                  <select
                    value={historyTypeFilter}
                    onChange={(e) => setHistoryTypeFilter(e.target.value)}
                    className="h-9 px-3 rounded-xl bg-slate-50 border border-slate-200 text-[10px] font-bold text-slate-700 outline-none"
                  >
                    <option value="all">All Letter Types</option>
                    <option value="offer">Offer Letters</option>
                    <option value="appointment">Appointment Letters</option>
                    <option value="relieving">Relieving Letters</option>
                    <option value="form16">Form 16 (TDS Certificate)</option>
                    <option value="warning">Warning Letters</option>
                    <option value="promotion">Promotion Letters</option>
                    <option value="transfer">Transfer Letters</option>
                    <option value="experience">Experience Letters</option>
                  </select>

                  <select
                    value={historyStatusFilter}
                    onChange={(e) => setHistoryStatusFilter(e.target.value)}
                    className="h-9 px-3 rounded-xl bg-slate-50 border border-slate-200 text-[10px] font-bold text-slate-700 outline-none"
                  >
                    <option value="all">All Statuses</option>
                    <option value="issued">Issued</option>
                    <option value="acknowledged">Acknowledged</option>
                  </select>

                  <Button
                    onClick={fetchLetters}
                    variant="outline"
                    size="sm"
                    className="h-9 rounded-xl border-slate-200 px-3 text-[9px] font-black uppercase tracking-wider"
                  >
                    <RefreshCw className={cn("h-3 w-3 mr-1", lettersLoading && "animate-spin")} /> Refresh
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-4">
              {lettersLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
                </div>
              ) : filteredHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                  <History className="h-10 w-10 mb-4 opacity-30" />
                  <p className="text-[10px] font-black uppercase tracking-widest">No letters recorded yet</p>
                  <p className="text-[9px] mt-1">Generate and issue letters from the Templates tab to view history here.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-100">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/70 text-[8px] font-black text-slate-400 uppercase tracking-widest">
                        <th className="py-3 px-4">Recipient</th>
                        <th className="py-3 px-4">Letter Type</th>
                        <th className="py-3 px-4">Title / Signatory</th>
                        <th className="py-3 px-4">Issued Date</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-[11px]">
                      {filteredHistory.map((item) => {
                        const isCandidate = !item.employee_id;
                        return (
                          <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-2">
                                {isCandidate ? (
                                  <div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-bold text-slate-900">{item.candidate_name || "Candidate"}</span>
                                      <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[7px] font-black px-1.5 py-0 rounded">
                                        CANDIDATE
                                      </Badge>
                                    </div>
                                    <p className="text-[9px] text-slate-400">{item.candidate_email || "No email"}</p>
                                    {item.candidate_phone && (
                                      <p className="text-[8px] text-slate-400 flex items-center gap-1"><Phone className="h-2.5 w-2.5" />{item.candidate_phone}</p>
                                    )}
                                  </div>
                                ) : (
                                  <div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-bold text-slate-900">{item.issuedTo?.name || "Employee"}</span>
                                      <Badge className="bg-slate-100 text-slate-700 text-[7px] font-mono px-1.5 py-0 rounded">
                                        {item.issuedTo?.emp_code || "EMP"}
                                      </Badge>
                                    </div>
                                    <p className="text-[9px] text-slate-400">
                                      {item.issuedTo?.designation || "Staff"} · {item.issuedTo?.department || "General"}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </td>

                            <td className="py-3.5 px-4">
                              <Badge className={cn("border text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md", TYPE_BADGE_STYLE[item.type] || "bg-slate-100 text-slate-700")}>
                                {TYPE_LABEL_MAP[item.type] || item.type}
                              </Badge>
                            </td>

                            <td className="py-3.5 px-4">
                              <p className="font-bold text-slate-800 line-clamp-1">{item.title}</p>
                              <p className="text-[9px] text-slate-400">
                                Signatory: <span className="font-semibold text-slate-600">{item.signatory?.name || "Default Signatory"}</span>
                              </p>
                            </td>

                            <td className="py-3.5 px-4 font-mono text-[10px] text-slate-600">
                              {item.issued_date ? new Date(item.issued_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "N/A"}
                            </td>

                            <td className="py-3.5 px-4">
                              <Badge className={cn(
                                "border text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md",
                                item.status === "acknowledged" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                                item.status === "issued" ? "bg-blue-50 text-blue-700 border-blue-200" :
                                "bg-slate-50 text-slate-600 border-slate-200"
                              )}>
                                {item.status}
                              </Badge>
                            </td>

                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Send to Registered Email"
                                  onClick={() => handleSendExistingEmail(item)}
                                  disabled={emailingLetterId === item.id || (!item.issuedTo?.email && !item.candidate_email)}
                                  className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                                >
                                  {emailingLetterId === item.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-600" />
                                  ) : (
                                    <Mail className="h-3.5 w-3.5" />
                                  )}
                                </Button>

                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Download Official PDF"
                                  onClick={() => handleDownloadHistoryPDF(item)}
                                  disabled={downloadingLetterId === item.id}
                                  className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                                >
                                  {downloadingLetterId === item.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
                                  ) : (
                                    <Download className="h-3.5 w-3.5" />
                                  )}
                                </Button>

                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="View Letter Content"
                                  onClick={() => setViewingLetter(item)}
                                  className="h-8 w-8 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>

                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Delete Record"
                                  onClick={() => handleDeleteLetter(item.id)}
                                  className="h-8 w-8 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── VIEW ISSUED LETTER MODAL (Req 2.10) ── */}
        <Dialog open={!!viewingLetter} onOpenChange={(val) => { if (!val) setViewingLetter(null); }}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl p-6 bg-white shadow-2xl border-none">
            {viewingLetter && (
              <div>
                <DialogHeader>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div>
                      <Badge className={cn("border text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md", TYPE_BADGE_STYLE[viewingLetter.type] || "bg-slate-100 text-slate-700")}>
                        {TYPE_LABEL_MAP[viewingLetter.type] || viewingLetter.type}
                      </Badge>
                      <DialogTitle className="text-lg font-black text-slate-900 mt-2">
                        {viewingLetter.title}
                      </DialogTitle>
                      <DialogDescription className="text-xs text-slate-500">
                        Recipient: <strong className="text-slate-800">{viewingLetter.issuedTo?.name || viewingLetter.candidate_name || "Employee"}</strong> ({viewingLetter.issuedTo?.email || viewingLetter.candidate_email || "No registered email"})
                      </DialogDescription>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-mono text-slate-400 block">
                        Issued: {viewingLetter.issued_date ? new Date(viewingLetter.issued_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "N/A"}
                      </span>
                      <Badge className={cn("mt-1 text-[8px] font-black uppercase", viewingLetter.status === "issued" ? "bg-blue-50 text-blue-700" : "bg-emerald-50 text-emerald-700")}>
                        {viewingLetter.status}
                      </Badge>
                    </div>
                  </div>
                </DialogHeader>

                {/* Letter Content Preview */}
                <div className="my-5 p-6 bg-slate-50 rounded-xl border border-slate-200 max-h-[55vh] overflow-y-auto text-xs leading-relaxed text-slate-800">
                  <div dangerouslySetInnerHTML={{ __html: viewingLetter.content || "<p>No content recorded</p>" }} />
                </div>

                <DialogFooter className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
                  <div className="text-xs text-slate-500">
                    {viewingLetter.signatory?.name && (
                      <span>Signatory: <strong>{viewingLetter.signatory.name}</strong> ({viewingLetter.signatory.designation})</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => handleSendExistingEmail(viewingLetter)}
                      disabled={emailingLetterId === viewingLetter.id || !(viewingLetter.issuedTo?.email || viewingLetter.candidate_email)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 rounded-xl px-4"
                    >
                      {emailingLetterId === viewingLetter.id ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <Mail className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      Send to Registered Email
                    </Button>
                    <Button
                      onClick={() => handleDownloadHistoryPDF(viewingLetter)}
                      disabled={downloadingLetterId === viewingLetter.id}
                      variant="outline"
                      className="text-xs font-bold h-9 rounded-xl border-slate-200"
                    >
                      {downloadingLetterId === viewingLetter.id ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <Download className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      Download PDF
                    </Button>
                    <Button
                      onClick={() => setViewingLetter(null)}
                      variant="ghost"
                      className="text-xs h-9 rounded-xl"
                    >
                      Close
                    </Button>
                  </div>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* ── GENERATE & CUSTOMIZE LETTER DIALOG ── */}
        <Dialog open={!!selectedTemplate} onOpenChange={(val) => { if (!val) { setSelectedTemplate(null); setPreviewData(null); setIsEditing(false); } }}>
          <DialogContent
            className="rounded-2xl p-0 overflow-hidden border-none shadow-2xl [&>button]:text-white [&>button]:top-5 [&>button]:right-5 [&>button]:z-50 [&>button]:bg-white/10 [&>button]:rounded-full [&>button]:p-1"
            style={{ width: "98vw", maxWidth: 1600, height: "95vh" }}
          >
            <DialogTitle className="sr-only">
              {selectedTemplate?.name ?? "Document Generator"}
            </DialogTitle>
            <div className="flex h-full w-full overflow-hidden">

              {/* ── A4 Preview Area ── */}
              <div className="flex-1 min-w-0 bg-slate-300 overflow-auto flex items-start justify-center p-8">
                <div id="pdf-preview-container" className="shrink-0 shadow-2xl" style={{ width: 794 }}>
                  {previewLoading ? (
                    <div className="flex items-center justify-center bg-white" style={{ width: 794, minHeight: 500 }}>
                      <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
                    </div>
                  ) : (
                    <LetterPreview
                      variant={selectedVariant}
                      title={TYPE_LABEL_MAP[selectedTemplate?.type || ""] || previewData?.template?.name || selectedTemplate?.name || ""}
                      content={editedContent || previewData?.content || ""}
                      templateId={String(selectedTemplate?.id || "")}
                      accentColor={accentColor}
                      employee={employeeForPreview}
                      signatory={activeSignatoryObj}
                      editable={isEditing}
                      onContentChange={setEditedContent}
                    />
                  )}
                </div>
              </div>

              {/* ── Right Control Panel ── */}
              <div style={{ width: 340, minWidth: 340, background: "#0f172a", display: "flex", flexDirection: "column", borderLeft: "1px solid rgba(255,255,255,0.06)", overflow: "hidden" }}>
                <div style={{ flex: 1, overflowY: "auto", padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>

                  {/* Header Title & Letter Type */}
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 900, textTransform: "uppercase", fontStyle: "italic", letterSpacing: "-0.5px", color: "#d9f99d", margin: 0 }}>
                      {selectedTemplate?.name}
                    </h3>
                    <p style={{ fontSize: 8, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "2px", marginTop: 4 }}>
                      {TYPE_LABEL_MAP[selectedTemplate?.type || ""] || selectedTemplate?.type} · {selectedTemplate?.category || "General"}
                    </p>
                  </div>

                  {/* Inline Content Edit Toggle (Req 12.3) */}
                  <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 16, display: "flex", flexDirection: "column", gap: 6 }}>
                    <Button
                      variant={isEditing ? "default" : "outline"}
                      size="sm"
                      onClick={() => setIsEditing(!isEditing)}
                      className={cn(
                        "w-full font-black text-[9px] uppercase tracking-wider rounded-xl h-9 transition-all",
                        isEditing
                          ? "bg-[#d9f99d] text-[#0f172a] hover:bg-[#bef264] border-none"
                          : "bg-transparent border border-white/10 text-white hover:bg-white/5"
                      )}
                    >
                      {isEditing ? (
                        <><Save className="h-3 w-3 mr-1.5" /> Inline Edit Mode: ACTIVE</>
                      ) : (
                        <><Pencil className="h-3 w-3 mr-1.5" /> Edit Letter Body Inline</>
                      )}
                    </Button>
                    {isEditing && (
                      <p style={{ fontSize: 8, fontWeight: 600, color: "#94a3b8", margin: 0, textAlign: "center" }}>
                        Click anywhere in the letter preview to type directly. Changes are automatically embedded in PDF & email.
                      </p>
                    )}
                  </div>

                  {/* Design Variant Picker */}
                  <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 16, display: "flex", flexDirection: "column", gap: 6 }}>
                    <p style={{ fontSize: 8, fontWeight: 900, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "2px", margin: 0 }}>Design Variant</p>
                    <div className="grid grid-cols-1 gap-1.5">
                      {variantMeta.map((v) => (
                        <button
                          key={v.id}
                          onClick={() => setSelectedVariant(v.id)}
                          style={{
                            width: "100%", textAlign: "left", borderRadius: 10, padding: "8px 10px",
                            border: selectedVariant === v.id ? "1px solid #d9f99d" : "1px solid rgba(255,255,255,0.08)",
                            background: selectedVariant === v.id ? "rgba(217,249,157,0.12)" : "rgba(255,255,255,0.03)",
                            cursor: "pointer", transition: "all 0.15s",
                          }}
                        >
                          <div style={{ fontSize: 9, fontWeight: 900, textTransform: "uppercase", color: selectedVariant === v.id ? "#d9f99d" : "#e2e8f0" }}>{v.label}</div>
                          <div style={{ fontSize: 7.5, color: selectedVariant === v.id ? "#a3e635" : "#64748b", marginTop: 2 }}>{v.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Mode Toggle: Existing Employee vs Candidate (Req 12.4) */}
                  <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 16, display: "flex", flexDirection: "column", gap: 6 }}>
                    <p style={{ fontSize: 8, fontWeight: 900, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "2px", margin: 0 }}>Target Recipient</p>
                    <div style={{ display: "flex", gap: 6, background: "rgba(255,255,255,0.05)", padding: 4, borderRadius: 10 }}>
                      <button
                        onClick={() => setCandidateMode(false)}
                        style={{
                          flex: 1, padding: "6px 0", borderRadius: 8, fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "1px",
                          background: !candidateMode ? "#d9f99d" : "transparent",
                          color: !candidateMode ? "#0f172a" : "#94a3b8",
                          border: "none", cursor: "pointer", transition: "all 0.2s"
                        }}
                      >
                        Existing Employee
                      </button>
                      <button
                        onClick={() => setCandidateMode(true)}
                        style={{
                          flex: 1, padding: "6px 0", borderRadius: 8, fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "1px",
                          background: candidateMode ? "#d9f99d" : "transparent",
                          color: candidateMode ? "#0f172a" : "#94a3b8",
                          border: "none", cursor: "pointer", transition: "all 0.2s"
                        }}
                      >
                        Prospective Candidate
                      </button>
                    </div>
                  </div>

                  {/* Dynamic Selection Area */}
                  {!candidateMode ? (
                    <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 16, display: "flex", flexDirection: "column", gap: 6 }}>
                      <p style={{ fontSize: 8, fontWeight: 900, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "2px", margin: 0 }}>Select Employee</p>
                      <select
                        style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, height: 38, padding: "0 10px", fontSize: 10, fontWeight: 700, color: "#e2e8f0", outline: "none" }}
                        value={selectedEmployee}
                        onChange={(e) => { setSelectedEmployee(e.target.value); setIssueError(""); setIssueSuccess(""); setIsEditing(false); }}
                      >
                        <option value="" style={{ background: "#1e293b", color: "#64748b" }}>Choose an employee…</option>
                        {employees.map((emp) => (
                          <option key={emp.id} value={emp.id} style={{ background: "#1e293b", color: "#e2e8f0" }}>
                            {emp.name} ({emp.emp_code}){emp.department ? ` – ${emp.department}` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    /* Candidate Details Form (Req 12.4) */
                    <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
                      <div className="flex items-center justify-between">
                        <p style={{ fontSize: 8, fontWeight: 900, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "2px", margin: 0 }}>Candidate Information</p>
                        <span className="text-[7px] text-[#d9f99d] font-mono">No profile required</span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <input
                          type="text"
                          placeholder="Candidate Full Name *"
                          value={candidateData.name}
                          onChange={(e) => setCandidateData({...candidateData, name: e.target.value})}
                          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "7px 10px", fontSize: 10, color: "#fff", outline: "none" }}
                        />
                        <div style={{ display: "flex", gap: 6 }}>
                          <input
                            type="email"
                            placeholder="Email Address *"
                            value={candidateData.email}
                            onChange={(e) => setCandidateData({...candidateData, email: e.target.value})}
                            style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "7px 10px", fontSize: 10, color: "#fff", outline: "none" }}
                          />
                          <input
                            type="tel"
                            placeholder="Phone Number"
                            value={candidateData.phone}
                            onChange={(e) => setCandidateData({...candidateData, phone: e.target.value})}
                            style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "7px 10px", fontSize: 10, color: "#fff", outline: "none" }}
                          />
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <input
                            type="text"
                            placeholder="Proposed Role *"
                            value={candidateData.designation}
                            onChange={(e) => setCandidateData({...candidateData, designation: e.target.value})}
                            style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "7px 10px", fontSize: 10, color: "#fff", outline: "none" }}
                          />
                          <input
                            type="text"
                            placeholder="Department"
                            value={candidateData.department}
                            onChange={(e) => setCandidateData({...candidateData, department: e.target.value})}
                            style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "7px 10px", fontSize: 10, color: "#fff", outline: "none" }}
                          />
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <select
                            value={candidateData.company}
                            onChange={(e) => setCandidateData({...candidateData, company: e.target.value})}
                            style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "7px 10px", fontSize: 10, color: "#fff", outline: "none" }}
                          >
                            <option value="" style={{ background: "#1e293b", color: "#64748b" }}>Select Company…</option>
                            {companies.map(c => <option key={c.id} value={c.name} style={{ background: "#1e293b", color: "#e2e8f0" }}>{c.name}</option>)}
                          </select>
                          <select
                            value={candidateData.office}
                            onChange={(e) => setCandidateData({...candidateData, office: e.target.value})}
                            style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "7px 10px", fontSize: 10, color: "#fff", outline: "none" }}
                          >
                            <option value="" style={{ background: "#1e293b", color: "#64748b" }}>Select Office…</option>
                            {offices.filter(o => !candidateData.company || companies.find(c => c.name === candidateData.company)?.id === o.company_id).map(o => <option key={o.id} value={o.name} style={{ background: "#1e293b", color: "#e2e8f0" }}>{o.name}</option>)}
                          </select>
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <input
                            type="number"
                            placeholder="Monthly Gross CTC (₹)"
                            value={candidateData.fixed_gross}
                            onChange={(e) => setCandidateData({...candidateData, fixed_gross: e.target.value})}
                            style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "7px 10px", fontSize: 10, color: "#fff", outline: "none" }}
                          />
                          <input
                            type="date"
                            placeholder="Joining Date"
                            value={candidateData.date_of_joining}
                            onChange={(e) => setCandidateData({...candidateData, date_of_joining: e.target.value})}
                            style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "7px 10px", fontSize: 10, color: "#fff", outline: "none" }}
                          />
                        </div>

                        {/* Statutory Components Toggle for Candidate */}
                        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginTop: 4 }}>
                          <label style={{ fontSize: 8.5, color: "#94a3b8", display: "flex", alignItems: "center", gap: 4 }}>
                            <input type="checkbox" checked={candidateData.pf_applicable} onChange={e => setCandidateData({...candidateData, pf_applicable: e.target.checked})} /> PF
                          </label>
                          {candidateData.pf_applicable && (
                            <label style={{ fontSize: 8.5, color: "#94a3b8", display: "flex", alignItems: "center", gap: 4 }}>
                              <input type="checkbox" checked={candidateData.pf_ceiling} onChange={e => setCandidateData({...candidateData, pf_ceiling: e.target.checked})} /> ₹15k Cap
                            </label>
                          )}
                          <label style={{ fontSize: 8.5, color: "#94a3b8", display: "flex", alignItems: "center", gap: 4 }}>
                            <input type="checkbox" checked={candidateData.esic_applicable} onChange={e => setCandidateData({...candidateData, esic_applicable: e.target.checked})} /> ESIC
                          </label>
                          <label style={{ fontSize: 8.5, color: "#94a3b8", display: "flex", alignItems: "center", gap: 4 }}>
                            <input type="checkbox" checked={candidateData.pt_applicable} onChange={e => setCandidateData({...candidateData, pt_applicable: e.target.checked})} /> PT
                          </label>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Authorised Signatory Selector (Req 12.3) */}
                  <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 16, display: "flex", flexDirection: "column", gap: 6 }}>
                    <div className="flex items-center justify-between">
                      <p style={{ fontSize: 8, fontWeight: 900, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "2px", margin: 0 }}>Authorised Signatory</p>
                      {activeSignatoryObj && (
                        <span className="text-[7px] text-[#d9f99d] font-bold">Signature Connected</span>
                      )}
                    </div>
                    <select
                      style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, height: 38, padding: "0 10px", fontSize: 10, fontWeight: 700, color: "#e2e8f0", outline: "none" }}
                      value={selectedSignatory}
                      onChange={(e) => setSelectedSignatory(e.target.value)}
                    >
                      <option value="" style={{ background: "#1e293b", color: "#64748b" }}>Default Signatory Block…</option>
                      {signatories.map((sig) => (
                        <option key={sig.id} value={sig.id} style={{ background: "#1e293b", color: "#e2e8f0" }}>
                          {sig.name} ({sig.designation})
                        </option>
                      ))}
                    </select>
                    {activeSignatoryObj && (
                      <div className="p-2 rounded-lg bg-white/5 border border-white/5 flex items-center justify-between">
                        <div>
                          <p className="text-[9px] font-bold text-slate-200">{activeSignatoryObj.name}</p>
                          <p className="text-[7.5px] text-slate-400">{activeSignatoryObj.designation}</p>
                        </div>
                        {activeSignatoryObj.signature_url ? (
                          <span className="text-[7px] font-mono text-emerald-400 bg-emerald-950/40 px-1.5 py-0.5 rounded">Digital Stamp Ready</span>
                        ) : (
                          <span className="text-[7px] font-mono text-slate-400">Formal Line Block</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Status Alerts */}
                  {issueError && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(239,68,68,0.15)", borderRadius: 8, padding: "8px 10px" }}>
                      <AlertCircle style={{ width: 12, height: 12, color: "#fca5a5", flexShrink: 0 }} />
                      <span style={{ fontSize: 8.5, fontWeight: 700, color: "#fca5a5" }}>{issueError}</span>
                    </div>
                  )}
                  {issueSuccess && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(34,197,94,0.15)", borderRadius: 8, padding: "8px 10px" }}>
                      <CheckCircle2 style={{ width: 12, height: 12, color: "#86efac", flexShrink: 0 }} />
                      <span style={{ fontSize: 8.5, fontWeight: 700, color: "#86efac" }}>{issueSuccess}</span>
                    </div>
                  )}
                </div>

                {/* Action Buttons Panel */}
                <div style={{ padding: 18, borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", gap: 8 }}>
                  {/* Send Email & Record */}
                  <button
                    disabled={sending || (candidateMode ? !candidateData.name : !selectedEmployee) || !previewData}
                    onClick={handleSendEmail}
                    style={{
                      width: "100%", background: "#d9f99d", color: "#0f172a", fontWeight: 900, fontSize: 9, height: 40,
                      borderRadius: 10, border: "none", cursor: sending || (candidateMode ? !candidateData.name : !selectedEmployee) || !previewData ? "not-allowed" : "pointer",
                      textTransform: "uppercase", letterSpacing: "1.5px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      opacity: sending || (candidateMode ? !candidateData.name : !selectedEmployee) || !previewData ? 0.5 : 1,
                    }}
                  >
                    {sending ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Sending Email…</>
                    ) : (
                      <><Mail style={{ width: 13, height: 13 }} /> Email & Issue to History</>
                    )}
                  </button>

                  <div className="flex gap-2">
                    {/* Issue & Download PDF */}
                    <button
                      disabled={issuing || (candidateMode ? !candidateData.name : !selectedEmployee) || !previewData}
                      onClick={() => handleDownloadPDF(true)}
                      style={{
                        flex: 1, background: "rgba(255,255,255,0.08)", color: "#e2e8f0", fontWeight: 900, fontSize: 8.5, height: 36,
                        borderRadius: 10, border: "1px solid rgba(255,255,255,0.15)", cursor: issuing || (candidateMode ? !candidateData.name : !selectedEmployee) || !previewData ? "not-allowed" : "pointer",
                        textTransform: "uppercase", letterSpacing: "1px", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                        opacity: issuing || (candidateMode ? !candidateData.name : !selectedEmployee) || !previewData ? 0.5 : 1,
                      }}
                    >
                      {issuing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                      Issue & Download
                    </button>

                    {/* Preview PDF Only */}
                    <button
                      disabled={issuing || (candidateMode ? !candidateData.name : !selectedEmployee) || !previewData}
                      onClick={() => handleDownloadPDF(false)}
                      style={{
                        flex: 1, background: "transparent", color: "#94a3b8", fontWeight: 700, fontSize: 8.5, height: 36,
                        borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", cursor: issuing || (candidateMode ? !candidateData.name : !selectedEmployee) || !previewData ? "not-allowed" : "pointer",
                        textTransform: "uppercase", letterSpacing: "1px", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                        opacity: issuing || (candidateMode ? !candidateData.name : !selectedEmployee) || !previewData ? 0.5 : 1,
                      }}
                    >
                      <Download className="h-3 w-3" />
                      PDF Only
                    </button>
                  </div>
                </div>
              </div>

            </div>
          </DialogContent>
        </Dialog>

        {/* ── TEMPLATE EDITOR MODAL (Req 12.3: Admin template editing) ── */}
        <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
          <DialogContent className="max-w-2xl rounded-2xl p-6 bg-white shadow-2xl border-none">
            <DialogHeader>
              <DialogTitle className="text-base font-black italic uppercase tracking-tight text-slate-900">
                {editingTemplateId ? "Edit Document Template" : "Create New Document Template"}
              </DialogTitle>
              <DialogDescription className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                Customize template text, salary placeholders, and legal terms
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 my-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[8px] font-black uppercase text-slate-400 tracking-wider">Template Name *</label>
                  <Input
                    value={templateForm.name}
                    onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                    placeholder="e.g. Appointment Letter (Executive)"
                    className="h-9 mt-1 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="text-[8px] font-black uppercase text-slate-400 tracking-wider">Type *</label>
                  <select
                    value={templateForm.type}
                    onChange={(e) => setTemplateForm({ ...templateForm, type: e.target.value })}
                    className="w-full h-9 mt-1 rounded-md border border-slate-200 px-3 text-xs font-bold text-slate-800 outline-none"
                  >
                    <option value="offer">Offer Letter</option>
                    <option value="appointment">Appointment Letter</option>
                    <option value="relieving">Relieving Letter</option>
                    <option value="form16">Form 16 (TDS Certificate)</option>
                    <option value="warning">Warning Letter</option>
                    <option value="promotion">Promotion Letter</option>
                    <option value="transfer">Transfer Letter</option>
                    <option value="resignation">Resignation Acceptance</option>
                    <option value="experience">Experience Certificate</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[8px] font-black uppercase text-slate-400 tracking-wider">Category</label>
                  <Input
                    value={templateForm.category}
                    onChange={(e) => setTemplateForm({ ...templateForm, category: e.target.value })}
                    placeholder="e.g. Hiring, Disciplinary, Exit, Tax & Statutory"
                    className="h-9 mt-1 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[8px] font-black uppercase text-slate-400 tracking-wider">Description</label>
                  <Input
                    value={templateForm.description}
                    onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })}
                    placeholder="Brief description for HR"
                    className="h-9 mt-1 text-xs"
                  />
                </div>
              </div>

              {/* Placeholder Helper Toolbar */}
              <div>
                <label className="text-[8px] font-black uppercase text-slate-400 tracking-wider block mb-1">
                  Click to Insert Dynamic Placeholder Tag:
                </label>
                <div className="flex flex-wrap gap-1 p-2 bg-slate-50 rounded-xl border border-slate-100 max-h-24 overflow-y-auto">
                  {AVAILABLE_PLACEHOLDERS.map(p => (
                    <button
                      key={p.tag}
                      type="button"
                      onClick={() => handleInsertPlaceholder(p.tag)}
                      className="px-2 py-0.5 rounded text-[8px] font-mono bg-white hover:bg-[#D9F99D] text-slate-700 hover:text-slate-900 border border-slate-200 transition-colors shadow-2xs"
                      title={p.desc}
                    >
                      +{p.tag}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[8px] font-black uppercase text-slate-400 tracking-wider block mb-1">
                  Template HTML Content *
                </label>
                <textarea
                  value={templateForm.content}
                  onChange={(e) => setTemplateForm({ ...templateForm, content: e.target.value })}
                  rows={10}
                  className="w-full font-mono text-[11px] p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#D9F99D] shadow-inner"
                  placeholder="Enter HTML letter content with placeholders..."
                />
              </div>

              {templateSaveError && (
                <p className="text-xs font-bold text-rose-500">{templateSaveError}</p>
              )}
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditorOpen(false)}
                className="rounded-xl text-xs font-bold"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveTemplate}
                disabled={savingTemplate}
                size="sm"
                className="bg-slate-900 text-white hover:bg-slate-800 rounded-xl text-xs font-bold"
              >
                {savingTemplate ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
                Save Template
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </ProtectedRoute>
  );
}
