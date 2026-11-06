"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  FileType, FileText, Download, Eye,
  CheckCircle2, Search, Clock, FileSignature, ArrowUpRight, Mail,
  Loader2, AlertCircle, Send, Pencil, X, Save, RefreshCw
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
import { apiGet, apiPost } from "@/lib/api-client";

const cn = (...classes: string[]) => classes.filter(Boolean).join(" ");

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
};

type PreviewEmployee = {
  id: number;
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
  content: string;
};

const TYPE_LABEL_MAP: Record<string, string> = {
  offer: "Offer Letter",
  appointment: "Appointment Letter",
  promotion: "Promotion Letter",
  transfer: "Transfer Letter",
  resignation: "Resignation Letter",
  experience: "Experience Letter",
  relieving: "Relieving Letter",
  warning: "Warning Letter",
  "non-performance": "Non-Performance Letter",
  absenteeism: "Absenteeism Letter",
};

const variantMeta = [
  { id: 1, label: "Standard Corporate", desc: "Navy bar · Serif · Two-col header" },
  { id: 2, label: "Modern Minimalist", desc: "Centered logo · Light gray · Sans" },
  { id: 3, label: "Premium Executive", desc: "Dark navy bleed · Accent title band" },
  { id: 4, label: "Creative Edge", desc: "Bold side bar · Big type treatment" },
  { id: 5, label: "Classic Formal", desc: "Double-border frame · Old-world look" },
];

export default function LettersPage() {
  const [searchTerm, setSearchTerm] = useState("");
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
  const [letters, setLetters] = useState<any[]>([]);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [editedContent, setEditedContent] = useState<string>("");
  const [isEditing, setIsEditing] = useState(false);
  const [candidateMode, setCandidateMode] = useState(false);
  const [candidateData, setCandidateData] = useState({
    name: '', email: '', designation: '', department: '', office: '', company: '', date_of_joining: '', fixed_gross: '',
    pf_applicable: true, pf_ceiling: true, pf_contribution_mode: 'shared', pf_employer_rate: 0.12, pf_employee_rate: 0.12,
    esic_applicable: true, esic_contribution_mode: 'shared', esic_employer_rate: 0.0325, esic_employee_rate: 0.0075,
    pt_applicable: true
  });

  // Action state
  const [issuing, setIssuing] = useState(false);
  const [issueError, setIssueError] = useState("");
  const [issueSuccess, setIssueSuccess] = useState("");
  const [sending, setSending] = useState(false);
  const [seeding, setSeeding] = useState(false);

  // ── Seed Templates Handler ──
  const handleSeedTemplates = async () => {
    setSeeding(true);
    try {
      await apiPost<any>("/letters/templates/seed");
      await fetchTemplates();
    } catch (err: any) {
      // Non-critical
    } finally {
      setSeeding(false);
    }
  };

  // ── Fetch Templates ──
  const fetchTemplates = useCallback(async () => {
    try {
      const data = await apiGet<any>("/letters/templates/all");
      // apiGet unwraps res.data.data — so data is either the array or { data: [...] }
      const rows = Array.isArray(data) ? data : (data?.data || data?.rows || []);
      setTemplates(rows);
    } catch {
      // Templates fetch is non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Fetch Letters ──
  const fetchLetters = useCallback(async () => {
    try {
      const data = await apiGet<any>("/letters");
      const rows = Array.isArray(data) ? data : (data?.data || data?.rows || []);
      setLetters(rows);
    } catch {
      // Non-critical
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
      })));
    } catch {
      // Non-critical
    }
  }, []);

  // ── Fetch Companies and Offices ──
  const [companies, setCompanies] = useState<any[]>([]);
  const [offices, setOffices] = useState<any[]>([]);

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

  const fetchSignatories = useCallback(async () => {
    try {
      const data = await apiGet<any>("/signatories", { active: 'true' });
      const rows = Array.isArray(data) ? data : (data?.data || data?.rows || []);
      setSignatories(rows);
    } catch {
      // Non-critical
    }
  }, []);

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
      const empId = params.get('employeeId');
      const tType = params.get('templateType');
      
      if (empId && !selectedEmployee) {
        // Ensure it is a string for the select value
        setSelectedEmployee(empId);
      }
      
      if (tType && !selectedTemplate) {
        const found = templates.find(t => t.type === tType || t.name.toLowerCase().includes('offer'));
        if (found) {
          setSelectedTemplate(found);
        }
      }
    }
  }, [employees, templates]);

  // ── Fetch Preview when template + employee/candidate selected ──
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
        const payload: any = { templateId: selectedTemplate.id };
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
    
    const timer = setTimeout(load, 500);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [selectedTemplate, selectedEmployee, candidateMode, candidateData]);

  // ── Filtered templates ──
  const filtered = templates.filter(t =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.category && t.category.toLowerCase().includes(searchTerm.toLowerCase())) ||
    t.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const issuedCount = letters.filter((l: any) => l.status === "issued" || l.status === "acknowledged").length;
  const ackCount = letters.filter((l: any) => l.status === "acknowledged").length;
  const compliancePct = issuedCount > 0 ? Math.round((ackCount / issuedCount) * 100) : 100;

  const accentColor = (selectedTemplate)
    ? (typeAccentMap[selectedTemplate.type] || '#1e293b')
    : '#1e293b';

  // ── Handle PDF Download ──
  const handleDownloadPDF = async () => {
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
        fullHtml = fullHtml.replace(/src="\/company_logopng.png"/g, `src="${window.location.origin}/company_logopng.png"`);
      }

      // Use raw fetch to get the PDF blob (not JSON)
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
      link.download = `${selectedTemplate.type}-${previewData?.employee?.emp_code || "employee"}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setIssueSuccess("PDF downloaded successfully!");
    } catch (err: any) {
      setIssueError(err?.message || "Failed to generate PDF.");
    } finally {
      setIssuing(false);
    }
  };

  // ── Handle Email Send ──
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
      setIssueError("Please enter candidate email address.");
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
        fullHtml = fullHtml.replace(/src="\/company_logopng.png"/g, `src="${window.location.origin}/company_logopng.png"`);
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
      setIssueSuccess("Letter sent successfully via email!");
      await fetchLetters();
    } catch (err: any) {
      setIssueError(err?.message || "Failed to send email.");
    } finally {
      setSending(false);
    }
  };

  // ── Build preview props ──
  const employeeForPreview = previewData?.employee ? {
    name: previewData.employee.name,
    designation: previewData.employee.designation,
    department: previewData.employee.department,
    office: (previewData.employee.office as any)?.name || previewData.employee.office,
    company: previewData.employee.company,
    companyDetails: previewData.employee.companyDetails,
    date: previewData.employee.date || new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
  } : (selectedEmployee ? employees.find(e => String(e.id) === selectedEmployee) : null) ? {
    name: employees.find(e => String(e.id) === selectedEmployee)!.name,
    designation: employees.find(e => String(e.id) === selectedEmployee)!.designation,
    department: employees.find(e => String(e.id) === selectedEmployee)!.department,
    office: undefined,
    company: undefined,
    companyDetails: undefined,
    date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
  } : {
    name: candidateData.name || 'Candidate',
    designation: candidateData.designation || 'TBD',
    department: candidateData.department || 'TBD',
    office: candidateData.office || 'Head Office',
    company: candidateData.company || 'Apaar Logistics',
    date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
  };

  return (
    <ProtectedRoute module="LETTERS" action="READ">
      <div className="space-y-10 pb-20">

        {/* ── Page Header ── */}
        <div className="px-2">
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-3 italic uppercase tracking-tighter underline underline-offset-4 decoration-[#D9F99D] decoration-2">
            <FileType className="h-6 w-6 text-rose-500" /> Letters & Docs
          </h1>
          <p className="text-[8px] font-black text-slate-400 mt-4 uppercase tracking-[0.4em]">
            Create and manage official letters and documents.
          </p>
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            { label: "Active Templates", value: `${templates.filter(t => t.is_active).length} Templates`, icon: FileSignature, bg: "bg-white" },
            { label: "Letters Issued", value: `${issuedCount} Letters`, icon: Send, bg: "bg-white" },
            { label: "Compliance", value: `${compliancePct}% Acknowledged`, icon: CheckCircle2, bg: "bg-[#D9F99D]" },
          ].map((stat, i) => (
            <Card key={i} className={`${stat.bg} border-none rounded-2xl p-6 shadow-sm flex flex-col justify-between h-36 group hover:shadow-md transition-all`}>
              <div className="h-9 w-9 bg-slate-50 rounded-xl flex items-center justify-center group-hover:bg-[#D9F99D]/20 transition-colors">
                <stat.icon className="h-5 w-5 text-slate-400 group-focus-within:text-slate-900 transition-colors" />
              </div>
              <div>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{stat.label}</p>
                <h3 className="text-lg font-black text-slate-900 uppercase italic tracking-tighter">{stat.value}</h3>
              </div>
            </Card>
          ))}
        </div>

        {/* ── Template Grid ── */}
        <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden p-1">
          <CardHeader className="p-6 pb-3 border-none">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <CardTitle className="text-lg font-black italic text-slate-900 underline underline-offset-4 decoration-[#D9F99D] decoration-2 uppercase tracking-tighter">
                  Template List
                </CardTitle>
                <CardDescription className="text-[8px] font-black text-slate-400 mt-4 uppercase tracking-[0.3em] italic">
                  All official document templates
                </CardDescription>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-300 group-focus-within:text-slate-900 transition-colors" />
                  <Input
                    placeholder="Search templates..."
                    className="h-10 w-64 pl-12 bg-slate-50 border-none rounded-xl font-bold text-[10px] focus-visible:ring-1 focus-visible:ring-[#D9F99D] shadow-inner"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Button
                  onClick={handleSeedTemplates}
                  disabled={seeding}
                  variant="outline"
                  size="sm"
                  className="h-10 border-slate-200 hover:bg-[#D9F99D]/20 hover:border-[#D9F99D] font-black text-[9px] uppercase tracking-widest rounded-xl px-4 transition-all"
                >
                  {seeding ? (
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Seeding...
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <RefreshCw className="h-3 w-3" />
                      Seed
                    </span>
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-4">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <FileText className="h-10 w-10 mb-4 opacity-30" />
                <p className="text-[10px] font-black uppercase tracking-widest">No templates found</p>
                <p className="text-[8px] mt-1">Seed default templates to get started.</p>
                <Button
                  onClick={handleSeedTemplates}
                  disabled={seeding}
                  className="mt-6 bg-[#D9F99D] hover:bg-[#C7F07A] text-slate-900 font-black text-[9px] uppercase tracking-widest rounded-xl px-5 h-10 shadow-sm hover:shadow-md transition-all hover:translate-y-[-2px] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                >
                  {seeding ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Seeding...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <RefreshCw className="h-3 w-3" />
                      Seed Templates
                    </span>
                  )}
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filtered.map((template) => (
                  <Card key={template.id} className="border-2 border-slate-50 rounded-2xl p-5 hover:border-[#D9F99D] hover:bg-slate-50/50 transition-all group relative overflow-hidden">
                    <div className="flex items-start justify-between relative z-10">
                      <div className="space-y-3">
                        <Badge className={cn(
                          "border-none font-black text-[7px] uppercase tracking-widest px-2.5 h-4.5 rounded-md",
                          template.is_active ? "bg-[#D1FAE5] text-emerald-600" : "bg-[#FEF3C7] text-amber-600"
                        )}>
                          {template.is_active ? "Active" : "Draft"}
                        </Badge>
                        <h3 className="text-lg font-black text-slate-900 uppercase italic tracking-tighter group-hover:translate-x-1 transition-transform">
                          {template.name}
                        </h3>
                        <div className="flex items-center gap-4">
                          <div className="space-y-0.5">
                            <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Type</p>
                            <p className="text-[9px] font-bold text-slate-600 uppercase">{TYPE_LABEL_MAP[template.type] || template.type}</p>
                          </div>
                          <div className="space-y-0.5">
                            <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Category</p>
                            <p className="text-[9px] font-bold text-slate-600 uppercase">{template.category || "General"}</p>
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost" size="icon"
                        className="h-9 w-9 rounded-lg bg-white border-2 border-slate-50 hover:bg-[#D9F99D] hover:border-[#D9F99D] transition-all"
                        onClick={() => { setSelectedTemplate(template); setSelectedVariant(1); setIssueError(""); setIssueSuccess(""); setIsEditing(false); }}
                      >
                        <Eye className="h-4 w-4 text-slate-400" />
                      </Button>
                    </div>
                    <div className="absolute -right-3 -bottom-3 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity rotate-12">
                      <FileText className="h-24 w-24" />
                    </div>
                    <div className="mt-6 flex items-center justify-between border-t border-slate-50 pt-3 relative z-10">
                      <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest italic flex items-center gap-2">
                        <Clock className="h-2.5 w-2.5" /> Updated: {new Date(template.updated_at).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}
                      </p>
                      <Button
                        onClick={() => { setSelectedTemplate(template); setSelectedVariant(1); setIssueError(""); setIssueSuccess(""); setIsEditing(false); }}
                        variant="link"
                        className="text-rose-500 font-black uppercase text-[8px] tracking-widest p-0 h-auto"
                      >
                        Generate <ArrowUpRight className="h-2.5 w-2.5 ml-1" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Generate Dialog ── */}
        <Dialog open={!!selectedTemplate} onOpenChange={(val) => { if (!val) { setSelectedTemplate(null); setPreviewData(null); setIsEditing(false); } }}>
          <DialogContent
            className="rounded-2xl p-0 overflow-hidden border-none shadow-2xl [&>button]:text-white [&>button]:top-5 [&>button]:right-5 [&>button]:z-50 [&>button]:bg-white/10 [&>button]:rounded-full [&>button]:p-1"
            style={{ width: '98vw', maxWidth: 1600, height: '95vh' }}
          >
            <DialogTitle className="sr-only">
              {selectedTemplate?.name ?? "Document Generator"}
            </DialogTitle>
            <div className="flex h-full w-full overflow-hidden">

              {/* ── A4 Preview ── */}
              <div className="flex-1 min-w-0 bg-slate-300 overflow-auto flex items-start justify-center p-8">
                <div id="pdf-preview-container" className="shrink-0 shadow-2xl" style={{ width: 794 }}>
                  {previewLoading ? (
                    <div className="flex items-center justify-center bg-white" style={{ width: 794, minHeight: 400 }}>
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
                      signatory={selectedSignatory ? signatories.find((s) => String(s.id) === selectedSignatory) : null}
                      editable={isEditing}
                      onContentChange={setEditedContent}
                    />
                  )}
                </div>
              </div>

              {/* ── Right Panel ── */}
              <div style={{ width: 320, minWidth: 320, background: '#0f172a', display: 'flex', flexDirection: 'column', borderLeft: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                <div style={{ flex: 1, overflowY: 'auto', padding: 32, display: 'flex', flexDirection: 'column', gap: 24 }}>

                  {/* Title */}
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 900, textTransform: 'uppercase', fontStyle: 'italic', letterSpacing: '-0.5px', color: '#d9f99d', margin: 0 }}>
                      {selectedTemplate?.name}
                    </h3>
                    <p style={{ fontSize: 8, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '2px', marginTop: 4 }}>
                      {TYPE_LABEL_MAP[selectedTemplate?.type || ""] || selectedTemplate?.type} · {selectedTemplate?.category || "General"}
                    </p>
                  </div>

                  {/* Edit Toggle */}
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <Button
                      variant={isEditing ? "default" : "outline"}
                      size="sm"
                      onClick={() => setIsEditing(!isEditing)}
                      className={cn(
                        "w-full font-black text-[8px] uppercase tracking-widest rounded-xl h-9",
                        isEditing
                          ? "bg-[#d9f99d] text-[#0f172a] hover:bg-[#bef264] border-none"
                          : "bg-transparent border border-white/10 text-white hover:bg-white/5"
                      )}
                    >
                      {isEditing ? (
                        <><Save className="h-3 w-3 mr-1.5" /> Editing Mode ON</>
                      ) : (
                        <><Pencil className="h-3 w-3 mr-1.5" /> Edit Content</>
                      )}
                    </Button>
                    {isEditing && (
                      <p style={{ fontSize: 7, fontWeight: 600, color: '#64748b', margin: 0, textAlign: 'center' }}>
                        Click on the text in the preview to edit inline. Changes are auto-saved for PDF/email.
                      </p>
                    )}
                  </div>

                  {/* Variant Picker */}
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <p style={{ fontSize: 7, fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '3px', margin: 0 }}>Design Variant</p>
                    {variantMeta.map((v) => (
                      <button
                        key={v.id}
                        onClick={() => setSelectedVariant(v.id)}
                        style={{
                          width: '100%', textAlign: 'left', borderRadius: 12, padding: '10px 12px',
                          border: selectedVariant === v.id ? '1px solid #d9f99d' : '1px solid rgba(255,255,255,0.1)',
                          background: selectedVariant === v.id ? 'rgba(217,249,157,0.1)' : 'rgba(255,255,255,0.04)',
                          cursor: 'pointer', transition: 'all 0.15s',
                        }}
                      >
                        <div style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', color: selectedVariant === v.id ? '#d9f99d' : '#e2e8f0' }}>{v.label}</div>
                        <div style={{ fontSize: 8, fontWeight: 600, color: selectedVariant === v.id ? '#a3e635' : '#94a3b8', marginTop: 2 }}>{v.desc}</div>
                      </button>
                    ))}
                  </div>

                  {/* Mode Toggle */}
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => setCandidateMode(false)}
                        style={{
                          flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 10, fontWeight: 700,
                          background: !candidateMode ? '#d9f99d' : 'rgba(255,255,255,0.05)',
                          color: !candidateMode ? '#0f172a' : '#94a3b8',
                          border: 'none', cursor: 'pointer', transition: 'all 0.2s'
                        }}
                      >
                        Employee
                      </button>
                      <button
                        onClick={() => setCandidateMode(true)}
                        style={{
                          flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 10, fontWeight: 700,
                          background: candidateMode ? '#d9f99d' : 'rgba(255,255,255,0.05)',
                          color: candidateMode ? '#0f172a' : '#94a3b8',
                          border: 'none', cursor: 'pointer', transition: 'all 0.2s'
                        }}
                      >
                        Candidate
                      </button>
                    </div>
                  </div>

                  {/* Dynamic Selection Area */}
                  {!candidateMode ? (
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <p style={{ fontSize: 7, fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '3px', margin: 0 }}>Select Employee</p>
                      <select
                        style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, height: 40, padding: '0 12px', fontSize: 10, fontWeight: 700, color: '#e2e8f0', outline: 'none' }}
                        value={selectedEmployee}
                        onChange={(e) => { setSelectedEmployee(e.target.value); setIssueError(""); setIssueSuccess(""); setIsEditing(false); }}
                      >
                        <option value="" style={{ background: '#1e293b', color: '#64748b' }}>Select an employee…</option>
                        {employees.map((emp) => (
                          <option key={emp.id} value={emp.id} style={{ background: '#1e293b', color: '#e2e8f0' }}>
                            {emp.name} ({emp.emp_code}){emp.department ? ` – ${emp.department}` : ""}
                          </option>
                        ))}
                      </select>
                      {employees.length === 0 && !loading && (
                        <p style={{ fontSize: 7, fontWeight: 600, color: '#64748b', margin: 0 }}>No employees loaded</p>
                      )}
                    </div>
                  ) : (
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <p style={{ fontSize: 7, fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '3px', margin: 0 }}>Candidate Details</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <input type="text" placeholder="Full Name" value={candidateData.name} onChange={(e) => setCandidateData({...candidateData, name: e.target.value})} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 12px', fontSize: 10, color: '#fff', outline: 'none' }} />
                        <input type="email" placeholder="Email Address" value={candidateData.email} onChange={(e) => setCandidateData({...candidateData, email: e.target.value})} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 12px', fontSize: 10, color: '#fff', outline: 'none' }} />
                        <div style={{ display: 'flex', gap: 8 }}>
                          <input type="text" placeholder="Designation" value={candidateData.designation} onChange={(e) => setCandidateData({...candidateData, designation: e.target.value})} style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 12px', fontSize: 10, color: '#fff', outline: 'none' }} />
                          <input type="text" placeholder="Department" value={candidateData.department} onChange={(e) => setCandidateData({...candidateData, department: e.target.value})} style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 12px', fontSize: 10, color: '#fff', outline: 'none' }} />
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <select value={candidateData.company} onChange={(e) => setCandidateData({...candidateData, company: e.target.value})} style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 12px', fontSize: 10, color: '#fff', outline: 'none' }}>
                            <option value="" style={{ background: '#1e293b', color: '#64748b' }}>Select Company…</option>
                            {companies.map(c => <option key={c.id} value={c.name} style={{ background: '#1e293b', color: '#e2e8f0' }}>{c.name}</option>)}
                          </select>
                          <select value={candidateData.office} onChange={(e) => setCandidateData({...candidateData, office: e.target.value})} style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 12px', fontSize: 10, color: '#fff', outline: 'none' }}>
                            <option value="" style={{ background: '#1e293b', color: '#64748b' }}>Select Office…</option>
                            {offices.filter(o => !candidateData.company || companies.find(c => c.name === candidateData.company)?.id === o.company_id).map(o => <option key={o.id} value={o.name} style={{ background: '#1e293b', color: '#e2e8f0' }}>{o.name}</option>)}
                          </select>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <input type="number" placeholder="Monthly Gross CTC" value={candidateData.fixed_gross} onChange={(e) => setCandidateData({...candidateData, fixed_gross: e.target.value})} style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 12px', fontSize: 10, color: '#fff', outline: 'none' }} />
                          <input type="date" placeholder="Date of Joining" value={candidateData.date_of_joining} onChange={(e) => setCandidateData({...candidateData, date_of_joining: e.target.value})} style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 12px', fontSize: 10, color: '#fff', outline: 'none' }} />
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <label style={{ fontSize: 9, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4, width: '100px' }}>
                            <input type="checkbox" checked={candidateData.pf_applicable} onChange={e => setCandidateData({...candidateData, pf_applicable: e.target.checked})} /> PF Applicable
                          </label>
                          {candidateData.pf_applicable && (
                            <label style={{ fontSize: 9, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <input type="checkbox" checked={candidateData.pf_ceiling} onChange={e => setCandidateData({...candidateData, pf_ceiling: e.target.checked})} /> ₹15k Ceiling
                            </label>
                          )}
                          {candidateData.pf_applicable && (
                            <select value={candidateData.pf_contribution_mode} onChange={e => setCandidateData({...candidateData, pf_contribution_mode: e.target.value})} style={{ flex: 1, minWidth: 100, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '4px 8px', fontSize: 9, color: '#fff' }}>
                              <option value="shared" style={{ background: '#1e293b' }}>Shared (Both)</option>
                              <option value="employer_only" style={{ background: '#1e293b' }}>Employer Only</option>
                              <option value="employee_only" style={{ background: '#1e293b' }}>Employee Only</option>
                              <option value="none" style={{ background: '#1e293b' }}>None</option>
                            </select>
                          )}
                          {candidateData.pf_applicable && candidateData.pf_contribution_mode !== 'none' && (
                            <div style={{ display: 'flex', gap: 4, width: '100%' }}>
                              {(candidateData.pf_contribution_mode === 'shared' || candidateData.pf_contribution_mode === 'employer_only') && (
                                <input type="number" step="0.01" placeholder="Employer Rate (0.12)" value={candidateData.pf_employer_rate} onChange={(e) => setCandidateData({...candidateData, pf_employer_rate: parseFloat(e.target.value)})} style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '4px 8px', fontSize: 9, color: '#fff', outline: 'none' }} />
                              )}
                              {(candidateData.pf_contribution_mode === 'shared' || candidateData.pf_contribution_mode === 'employee_only') && (
                                <input type="number" step="0.01" placeholder="Employee Rate (0.12)" value={candidateData.pf_employee_rate} onChange={(e) => setCandidateData({...candidateData, pf_employee_rate: parseFloat(e.target.value)})} style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '4px 8px', fontSize: 9, color: '#fff', outline: 'none' }} />
                              )}
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <label style={{ fontSize: 9, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4, width: '100px' }}>
                            <input type="checkbox" checked={candidateData.esic_applicable} onChange={e => setCandidateData({...candidateData, esic_applicable: e.target.checked})} /> ESIC Applicable
                          </label>
                          {candidateData.esic_applicable && (
                            <select value={candidateData.esic_contribution_mode} onChange={e => setCandidateData({...candidateData, esic_contribution_mode: e.target.value})} style={{ flex: 1, minWidth: 100, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '4px 8px', fontSize: 9, color: '#fff' }}>
                              <option value="shared" style={{ background: '#1e293b' }}>Shared (Both)</option>
                              <option value="employer_only" style={{ background: '#1e293b' }}>Employer Only</option>
                              <option value="employee_only" style={{ background: '#1e293b' }}>Employee Only</option>
                              <option value="none" style={{ background: '#1e293b' }}>None</option>
                            </select>
                          )}
                          {candidateData.esic_applicable && candidateData.esic_contribution_mode !== 'none' && (
                            <div style={{ display: 'flex', gap: 4, width: '100%' }}>
                              {(candidateData.esic_contribution_mode === 'shared' || candidateData.esic_contribution_mode === 'employer_only') && (
                                <input type="number" step="0.0001" placeholder="Employer Rate (0.0325)" value={candidateData.esic_employer_rate} onChange={(e) => setCandidateData({...candidateData, esic_employer_rate: parseFloat(e.target.value)})} style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '4px 8px', fontSize: 9, color: '#fff', outline: 'none' }} />
                              )}
                              {(candidateData.esic_contribution_mode === 'shared' || candidateData.esic_contribution_mode === 'employee_only') && (
                                <input type="number" step="0.0001" placeholder="Employee Rate (0.0075)" value={candidateData.esic_employee_rate} onChange={(e) => setCandidateData({...candidateData, esic_employee_rate: parseFloat(e.target.value)})} style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '4px 8px', fontSize: 9, color: '#fff', outline: 'none' }} />
                              )}
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <label style={{ fontSize: 9, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4, width: '100px' }}>
                            <input type="checkbox" checked={candidateData.pt_applicable} onChange={e => setCandidateData({...candidateData, pt_applicable: e.target.checked})} /> PT Applicable
                          </label>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Signatory Selection */}
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <p style={{ fontSize: 7, fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '3px', margin: 0 }}>Authorised Signatory</p>
                    <select
                      style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, height: 40, padding: '0 12px', fontSize: 10, fontWeight: 700, color: '#e2e8f0', outline: 'none' }}
                      value={selectedSignatory}
                      onChange={(e) => setSelectedSignatory(e.target.value)}
                    >
                      <option value="" style={{ background: '#1e293b', color: '#64748b' }}>Default Signatory…</option>
                      {signatories.map((sig) => (
                        <option key={sig.id} value={sig.id} style={{ background: '#1e293b', color: '#e2e8f0' }}>
                          {sig.name} ({sig.designation})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Employee Info (when selected + preview loaded) */}
                  {previewData?.employee && (
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <p style={{ fontSize: 7, fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '3px', margin: 0 }}>Employee Details</p>
                      <div style={{ background: 'rgba(255,255,255,0.04)', padding: 12, borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 8, color: '#64748b' }}>Name</span>
                          <span style={{ fontSize: 9, fontWeight: 700, color: '#e2e8f0' }}>{previewData.employee.name}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 8, color: '#64748b' }}>Code</span>
                          <span style={{ fontSize: 9, fontWeight: 700, color: '#e2e8f0' }}>{previewData.employee.emp_code}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 8, color: '#64748b' }}>Designation</span>
                          <span style={{ fontSize: 9, fontWeight: 700, color: '#e2e8f0' }}>{previewData.employee.designation}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 8, color: '#64748b' }}>Department</span>
                          <span style={{ fontSize: 9, fontWeight: 700, color: '#e2e8f0' }}>{previewData.employee.department}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 8, color: '#64748b' }}>Office</span>
                          <span style={{ fontSize: 9, fontWeight: 700, color: '#e2e8f0' }}>{previewData.employee.office}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 8, color: '#64748b' }}>Email</span>
                          <span style={{ fontSize: 9, fontWeight: 700, color: '#d9f99d' }}>{previewData.employee.email}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Dynamic Fields Info */}
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <p style={{ fontSize: 7, fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '3px', margin: 0 }}>Dynamic Fields</p>
                    <div style={{ background: 'rgba(255,255,255,0.04)', padding: 12, borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {["[Employee_Name]", "[Job_Title]", "[Date]", "[Department]", "[Office_Location]", "[Company_Name]", "[Employee_Code]", "[Salary]", "[Joining_Date]"].map(f => (
                        <div key={f} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8' }}>{f}</span>
                          <span style={{ fontSize: 7, fontWeight: 900, color: previewData ? '#d9f99d' : '#64748b', textTransform: 'uppercase' }}>
                            {previewData ? 'Filled' : 'Auto'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Email toggle */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={emailEnabled}
                      onChange={(e) => setEmailEnabled(e.target.checked)}
                      style={{ accentColor: '#d9f99d', width: 12, height: 12 }}
                    />
                    <span style={{ fontSize: 9, fontWeight: 700, color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '1px' }}>Enable Email Auto-Send</span>
                  </div>

                  {/* Status Messages */}
                  {issueError && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(239,68,68,0.15)', borderRadius: 8, padding: '8px 12px' }}>
                      <AlertCircle style={{ width: 12, height: 12, color: '#fca5a5', flexShrink: 0 }} />
                      <span style={{ fontSize: 8, fontWeight: 700, color: '#fca5a5' }}>{issueError}</span>
                    </div>
                  )}
                  {issueSuccess && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(34,197,94,0.15)', borderRadius: 8, padding: '8px 12px' }}>
                      <CheckCircle2 style={{ width: 12, height: 12, color: '#86efac', flexShrink: 0 }} />
                      <span style={{ fontSize: 8, fontWeight: 700, color: '#86efac' }}>{issueSuccess}</span>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div style={{ padding: '20px 24px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button
                    disabled={sending || (candidateMode ? !candidateData.name : !selectedEmployee) || !previewData}
                    onClick={handleSendEmail}
                    style={{
                      width: '100%', background: '#d9f99d', color: '#0f172a', fontWeight: 900, fontSize: 9, height: 44,
                      borderRadius: 12, border: 'none', cursor: sending || (candidateMode ? !candidateData.name : !selectedEmployee) || !previewData ? 'not-allowed' : 'pointer',
                      textTransform: 'uppercase', letterSpacing: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      opacity: sending || (candidateMode ? !candidateData.name : !selectedEmployee) || !previewData ? 0.5 : 1,
                    }}
                  >
                    {sending ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Sending…</>
                    ) : (
                      <><Mail style={{ width: 14, height: 14 }} /> {candidateMode ? 'Send Email' : 'Email & Record'}</>
                    )}
                  </button>
                  <button
                    disabled={issuing || (candidateMode ? !candidateData.name : !selectedEmployee) || !previewData}
                    onClick={handleDownloadPDF}
                    style={{
                      width: '100%', background: 'transparent', color: '#e2e8f0', fontWeight: 900, fontSize: 9, height: 44,
                      borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', cursor: issuing || (candidateMode ? !candidateData.name : !selectedEmployee) || !previewData ? 'not-allowed' : 'pointer',
                      textTransform: 'uppercase', letterSpacing: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      opacity: issuing || (candidateMode ? !candidateData.name : !selectedEmployee) || !previewData ? 0.5 : 1,
                    }}
                  >
                    {issuing ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating…</>
                    ) : (
                      <><Download style={{ width: 14, height: 14 }} /> Download PDF</>
                    )}
                  </button>
                </div>
              </div>

            </div>
          </DialogContent>
        </Dialog>
      </div>
    </ProtectedRoute>
  );
}
