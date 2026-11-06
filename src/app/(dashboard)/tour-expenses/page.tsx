"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plane, Plus, Search, Filter, CheckCircle2, Clock, XCircle,
  Receipt, MapPin, Calendar, User, ArrowUpRight, Download,
  ChevronDown, Wallet, FileText, TrendingUp, AlertCircle,
  Building2, Upload, Paperclip, Eye, Trash2, Loader2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogTitle, DialogFooter, DialogDescription, DialogHeader
} from "@/components/ui/dialog";
import { useRole } from "@/context/RoleContext";
import { useAuth } from "@/context/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { apiGet, apiPost, apiPut } from "@/lib/api-client";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import {
  BRANCHES, EXPENSE_CATEGORIES,
  Expense, Receipt as ReceiptType, ExpenseStatus
} from "./data";

const cn = (...c: string[]) => c.filter(Boolean).join(" ");

const statusStyle: Record<string, string> = {
  Approved: "bg-emerald-50 text-emerald-600",
  Pending:  "bg-amber-50  text-amber-600",
  Rejected: "bg-rose-50   text-rose-600",
};
const statusIcon: Record<string, any> = {
  Approved: CheckCircle2,
  Pending:  Clock,
  Rejected: XCircle,
};

export default function TourExpensesPage() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [search, setSearch]               = useState("");
  const [filterStatus, setFilterStatus]   = useState("All");
  const [showAdd, setShowAdd]             = useState(false);
  const [selected, setSelected]           = useState<Expense | null>(null);
  const [activeTab, setActiveTab]         = useState<"claims"|"policy">("claims");
  const { hasPermission } = useRole();
  const canEditPolicy = hasPermission('TOUR_EXPENSES', 'UPDATE');

  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    totalClaims: 0,
    totalApproved: 0,
    totalPending: 0,
    pendingCount: 0
  });

  // Policy State
  const [policies, setPolicies] = useState<{ label: string; limit: string; note: string }[]>([]);
  const [generalRules, setGeneralRules] = useState("");
  
  // Policy Edit Dialog
  const [showPolicyDialog, setShowPolicyDialog] = useState(false);
  const [editingPolicyIndex, setEditingPolicyIndex] = useState<number | null>(null);
  const [policyForm, setPolicyForm] = useState({ label: "", limit: "", note: "" });
  
  // General Rules Edit
  const [isEditingGeneral, setIsEditingGeneral] = useState(false);
  
  // Reject Dialog
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  // View Receipt Dialog
  const [viewReceipt, setViewReceipt] = useState<ReceiptType | null>(null);

  /* form state */
  const [form, setForm] = useState<{
    employee: string, dept: string, branch: string, purpose: string, from: string, to: string,
    startDate: string, endDate: string, category: string, amount: string, notes: string, receipts: ReceiptType[]
  }>({
    employee: "", dept: "", branch: BRANCHES[0], purpose: "", from: "", to: "",
    startDate: "", endDate: "", category: EXPENSE_CATEGORIES[0], amount: "", notes: "", receipts: []
  });

  const fetchClaims = useCallback(async () => {
    setLoading(true);
    try {
      const queryParams: any = {};
      if (filterStatus && filterStatus !== 'All') {
        queryParams.status = filterStatus;
      }
      if (search) {
        queryParams.search = search;
      }

      const res: any = await apiGet("/tour-expenses", queryParams);
      const mapped = (res.data || []).map((r: any) => {
        const emp = r.employee || {};
        return {
          id: r.claim_code,
          employee: emp.name || "Unknown",
          company: emp.company?.name || "—",
          dept: emp.department || "—",
          branch: emp.office?.name || "—",
          purpose: r.purpose,
          from: r.from_location,
          to: r.to_location,
          startDate: r.start_date ? new Date(r.start_date).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : "—",
          endDate: r.end_date ? new Date(r.end_date).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : "—",
          amount: parseFloat(r.amount) || 0,
          status: r.status ? (r.status.charAt(0).toUpperCase() + r.status.slice(1)) as ExpenseStatus : "Pending",
          category: r.category,
          receipts: r.receipts || [],
          submittedOn: r.created_at ? new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : "—",
          remarks: r.remarks || "",
          approvedBy: r.approver?.name || "",
          rejectedReason: r.rejected_reason || "",
          db_id: r.id,
        };
      });
      setExpenses(mapped);
      setStats({
        totalClaims: res.stats.totalClaims || 0,
        totalApproved: res.stats.totalApproved || 0,
        totalPending: res.stats.totalPending || 0,
        pendingCount: res.stats.pendingCount || 0
      });
    } catch (err) {
      console.error("Failed to fetch claims:", err);
    } finally {
      setLoading(false);
    }
  }, [filterStatus, search]);

  const fetchPolicy = useCallback(async () => {
    try {
      const res: any = await apiGet("/tour-expenses/policy");
      setPolicies((res.policies || []).map((p: any) => ({
        label: p.label,
        limit: p.limit_detail,
        note: p.note
      })));
      setGeneralRules(res.generalRules || "");
    } catch (err) {
      console.error("Failed to fetch policy:", err);
    }
  }, []);

  const handleExportPDF = () => {
    if (!selected) return;
    const doc = new jsPDF();
    
    // Theme Colors
    const primaryColor = [15, 23, 42]; // slate-900
    const secondaryColor = [241, 245, 249]; // slate-100
    const accentColor = [132, 204, 22]; // lime-500
    const textColor = [51, 65, 85]; // slate-700
    
    // Header Section
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(20);
    const companyText = selected.company && selected.company !== "—" ? selected.company.toUpperCase() : "COMPANY";
    doc.text(companyText, 14, 18);
    
    doc.setFontSize(12);
    doc.text("TOUR EXPENSE VOUCHER", 14, 26);
    
    doc.setFontSize(10);
    doc.setFont("Helvetica", "normal");
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 34);
    
    doc.setFontSize(14);
    doc.setFont("Helvetica", "bold");
    doc.text(`Claim #: ${selected.id}`, 140, 26);
    
    let currentY = 50;

    // Helper for section headers
    const addSectionHeader = (title: string, y: number) => {
      doc.setFillColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.rect(14, y - 6, 182, 10, 'F');
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setFontSize(11);
      doc.setFont("Helvetica", "bold");
      doc.text(title.toUpperCase(), 18, y + 1);
      return y + 12;
    };

    // Employee Information
    currentY = addSectionHeader("Employee Information", currentY);
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.setFontSize(10);
    doc.setFont("Helvetica", "normal");
    doc.text(`Name:`, 18, currentY);
    doc.setFont("Helvetica", "bold");
    doc.text(selected.employee, 50, currentY);
    
    doc.setFont("Helvetica", "normal");
    doc.text(`Department:`, 110, currentY);
    doc.setFont("Helvetica", "bold");
    doc.text(selected.dept, 140, currentY);
    currentY += 8;

    doc.setFont("Helvetica", "normal");
    doc.text(`Branch/Location:`, 18, currentY);
    doc.setFont("Helvetica", "bold");
    doc.text(selected.branch, 50, currentY);
    currentY += 16;

    // Tour Details
    currentY = addSectionHeader("Tour & Travel Details", currentY);
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.setFontSize(10);
    doc.setFont("Helvetica", "normal");
    doc.text(`Purpose:`, 18, currentY);
    doc.setFont("Helvetica", "bold");
    doc.text(selected.purpose, 50, currentY);
    currentY += 8;

    doc.setFont("Helvetica", "normal");
    doc.text(`Route:`, 18, currentY);
    doc.setFont("Helvetica", "bold");
    doc.text(`${selected.from} to ${selected.to}`, 50, currentY);
    
    doc.setFont("Helvetica", "normal");
    doc.text(`Duration:`, 110, currentY);
    doc.setFont("Helvetica", "bold");
    doc.text(`${selected.startDate} - ${selected.endDate}`, 140, currentY);
    currentY += 8;

    doc.setFont("Helvetica", "normal");
    doc.text(`Category:`, 18, currentY);
    doc.setFont("Helvetica", "bold");
    doc.text(selected.category, 50, currentY);
    currentY += 16;

    // Financials & Status
    currentY = addSectionHeader("Financials & Status", currentY);
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.setFontSize(10);
    doc.setFont("Helvetica", "normal");
    doc.text(`Claim Amount:`, 18, currentY);
    doc.setFont("Helvetica", "bold");
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFontSize(12);
    doc.text(`Rs ${selected.amount.toLocaleString()}`, 50, currentY);
    
    doc.setFontSize(10);
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.setFont("Helvetica", "normal");
    doc.text(`Current Status:`, 110, currentY);
    doc.setFont("Helvetica", "bold");
    
    // Status color
    if (selected.status === 'Approved') doc.setTextColor(16, 185, 129); // emerald-500
    else if (selected.status === 'Rejected') doc.setTextColor(244, 63, 94); // rose-500
    else doc.setTextColor(245, 158, 11); // amber-500
    
    doc.text(selected.status.toUpperCase(), 140, currentY);
    currentY += 16;

    // Receipts
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    if (selected.receipts && selected.receipts.length > 0) {
      currentY = addSectionHeader("Attached Receipts", currentY) + 2;
      
      autoTable(doc, {
        startY: currentY,
        head: [["Receipt Name", "File Type", "File Size"]],
        body: selected.receipts.map(r => [r.name, r.type || "N/A", r.size || "N/A"]),
        theme: "striped",
        styles: { fontSize: 9, font: "Helvetica", cellPadding: 4 },
        headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: 14, right: 14 }
      });
      
      // @ts-ignore
      currentY = doc.lastAutoTable.finalY + 16;
    } else {
      currentY = addSectionHeader("Attached Receipts", currentY);
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
      doc.setFont("Helvetica", "italic");
      doc.setFontSize(9);
      doc.text("No receipts or attachments provided with this claim.", 18, currentY);
      currentY += 16;
    }

    // Footer signature lines
    if (currentY > 250) {
      doc.addPage();
      currentY = 40;
    }
    
    doc.setDrawColor(203, 213, 225); // slate-300
    doc.line(14, currentY, 80, currentY);
    doc.line(130, currentY, 196, currentY);
    
    doc.setTextColor(100, 116, 139); // slate-500
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8);
    doc.text("Employee Signature", 30, currentY + 5);
    doc.text("Authorized Approver", 145, currentY + 5);

    // Footer Text
    doc.setFontSize(7);
    doc.text("HRMS SYSTEM GENERATED DOCUMENT", 105, 285, { align: "center" });

    doc.save(`Claim_${selected.id}.pdf`);
  };

  useEffect(() => {
    fetchClaims();
  }, [fetchClaims]);

  useEffect(() => {
    fetchPolicy();
  }, [fetchPolicy]);

  // Set default values for onboarding form using current user info
  useEffect(() => {
    if (user) {
      setForm(prev => ({
        ...prev,
        employee: user.name || "",
        dept: user.department || "",
        branch: user.branch || BRANCHES[0]
      }));
    }
  }, [user, showAdd]);

  const handleApprove = async () => {
    if (!selected || !selected.db_id) return;
    try {
      await apiPost(`/tour-expenses/${selected.db_id}/approve`);
      fetchClaims();
      setSelected(null);
    } catch (err) {
      console.error("Failed to approve claim:", err);
    }
  };

  const handleReject = async () => {
    if (!selected || !selected.db_id) return;
    try {
      await apiPost(`/tour-expenses/${selected.db_id}/reject`, {
        rejected_reason: rejectReason,
      });
      fetchClaims();
      setShowReject(false);
      setRejectReason("");
      setSelected(null);
    } catch (err) {
      console.error("Failed to reject claim:", err);
    }
  };

  const handleSubmitClaim = async () => {
    try {
      const payload = {
        purpose: form.purpose,
        from_location: form.from,
        to_location: form.to,
        start_date: form.startDate,
        end_date: form.endDate,
        amount: Number(form.amount) || 0,
        category: form.category,
        receipts: form.receipts,
        remarks: form.notes,
      };
      await apiPost("/tour-expenses", payload);
      fetchClaims();
      setShowAdd(false);
      setForm({
        employee: user?.name || "",
        dept: user?.department || "",
        branch: user?.branch || BRANCHES[0],
        purpose: "",
        from: "",
        to: "",
        startDate: "",
        endDate: "",
        category: EXPENSE_CATEGORIES[0],
        amount: "",
        notes: "",
        receipts: []
      });
    } catch (err) {
      console.error("Failed to submit claim:", err);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const newReceipt: ReceiptType = {
        id: `R${Date.now()}`,
        name: file.name,
        size: `${(file.size / 1024).toFixed(1)} KB`,
        type: file.name.endsWith('.pdf') ? 'PDF' : 'IMG'
      };
      setForm(prev => ({ ...prev, receipts: [...prev.receipts, newReceipt] }));
    }
  };

  const removeReceipt = (id: string) => {
    setForm(prev => ({ ...prev, receipts: prev.receipts.filter(r => r.id !== id) }));
  };

  const handleSavePolicy = async () => {
    let newPolicies;
    if (editingPolicyIndex !== null) {
      newPolicies = policies.map((p, i) => i === editingPolicyIndex ? policyForm : p);
    } else {
      newPolicies = [...policies, policyForm];
    }
    try {
      const res: any = await apiPut("/tour-expenses/policy", {
        policies: newPolicies,
        generalRules: generalRules
      });
      setPolicies((res.policies || []).map((p: any) => ({
        label: p.label,
        limit: p.limit_detail,
        note: p.note
      })));
      setShowPolicyDialog(false);
    } catch (err) {
      console.error("Failed to save policy:", err);
    }
  };

  const handleDeletePolicy = async (index: number) => {
    const newPolicies = policies.filter((_, i) => i !== index);
    try {
      const res: any = await apiPut("/tour-expenses/policy", {
        policies: newPolicies,
        generalRules: generalRules
      });
      setPolicies((res.policies || []).map((p: any) => ({
        label: p.label,
        limit: p.limit_detail,
        note: p.note
      })));
    } catch (err) {
      console.error("Failed to delete policy:", err);
    }
  };

  const handleSaveGeneralRules = async (text: string) => {
    try {
      const res: any = await apiPut("/tour-expenses/policy", {
        policies: policies,
        generalRules: text
      });
      setGeneralRules(res.generalRules || "");
      setIsEditingGeneral(false);
    } catch (err) {
      console.error("Failed to save general rules:", err);
    }
  };

  const filtered = expenses;
  const totalApproved = stats.totalApproved;
  const totalPending = stats.totalPending;
  const totalClaims = stats.totalClaims;
  const pendingCount = stats.pendingCount;

  return (
    <ProtectedRoute module="TOUR_EXPENSES" action="READ">
    <div className="space-y-8 pb-20">

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-2">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-3 italic uppercase tracking-tighter underline underline-offset-4 decoration-[#D9F99D] decoration-2">
            <Plane className="h-6 w-6 text-rose-500" /> Tour Expenses
          </h1>
          <p className="text-[8px] font-black text-slate-400 mt-4 uppercase tracking-[0.4em]">
            Manage employee travel & tour expense claims.
          </p>
        </div>
        <Button
          onClick={() => setShowAdd(true)}
          className="bg-slate-900 text-white hover:bg-black font-black uppercase text-[9px] tracking-widest px-8 h-11 rounded-2xl shadow-xl hover:translate-y-[-2px] transition-all flex items-center gap-2"
        >
          <Plus className="h-4 w-4 stroke-[3]" /> New Claim
        </Button>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Claims",       value: totalClaims,                            suffix: "Claims",  icon: Receipt,    bg: "bg-white"       },
          { label: "Approved Amount",    value: `₹ ${totalApproved.toLocaleString()}`,  suffix: "",        icon: CheckCircle2,bg: "bg-[#D9F99D]"  },
          { label: "Pending Amount",     value: `₹ ${totalPending.toLocaleString()}`,   suffix: "",        icon: Clock,      bg: "bg-amber-50"    },
          { label: "Pending Approvals",  value: pendingCount,                            suffix: "Claims",  icon: AlertCircle,bg: "bg-white"       },
        ].map((s, i) => (
          <Card key={i} className={`${s.bg} border-none rounded-2xl p-5 shadow-sm flex flex-col justify-between h-32 group hover:shadow-md transition-all`}>
            <div className="h-8 w-8 bg-white/60 rounded-xl flex items-center justify-center">
              <s.icon className="h-4 w-4 text-slate-400" />
            </div>
            <div>
              <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{s.label}</p>
              <h3 className="text-base font-black text-slate-900 uppercase italic tracking-tighter leading-tight">
                {s.value} <span className="text-xs font-bold text-slate-400">{s.suffix}</span>
              </h3>
            </div>
          </Card>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-2">
        {(["claims","policy"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-5 h-9 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all",
              activeTab === tab
                ? "bg-slate-900 text-white shadow-md"
                : "bg-white text-slate-400 hover:text-slate-900 hover:bg-slate-50 border border-slate-100"
            )}
          >
            {tab === "claims" ? "Expense Claims" : "Policy & Limits"}
          </button>
        ))}
      </div>

      {/* ── CLAIMS TAB ── */}
      {activeTab === "claims" && (
        <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden p-1">
          <CardHeader className="p-6 pb-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg font-black italic text-slate-900 underline underline-offset-4 decoration-[#D9F99D] decoration-2 uppercase tracking-tighter">
                  All Claims
                </CardTitle>
                <CardDescription className="text-[8px] font-black text-slate-400 mt-3 uppercase tracking-[0.3em] italic">
                  {filtered.length} records found
                </CardDescription>
              </div>
              <div className="flex items-center gap-3">
                {/* Status filter */}
                <div className="flex gap-1">
                  {["All","Pending","Approved","Rejected"].map(s => (
                    <button
                      key={s}
                      onClick={() => setFilterStatus(s)}
                      className={cn(
                        "px-3 h-8 rounded-lg font-black text-[8px] uppercase tracking-widest transition-all",
                        filterStatus === s
                          ? "bg-slate-900 text-white"
                          : "bg-slate-50 text-slate-400 hover:bg-slate-100"
                      )}
                    >{s}</button>
                  ))}
                </div>
                {/* Search */}
                <div className="relative group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-300" />
                  <Input
                    placeholder="Search claims…"
                    className="h-9 w-52 pl-9 bg-slate-50 border-none rounded-xl font-bold text-[10px] focus-visible:ring-1 focus-visible:ring-[#D9F99D]"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-4">
            <div className="space-y-3">
              {filtered.map(exp => {
                const Icon = statusIcon[exp.status];
                return (
                  <div
                    key={exp.id}
                    onClick={() => setSelected(exp)}
                    className="flex items-center justify-between rounded-2xl border-2 border-slate-50 p-4 hover:border-[#D9F99D] hover:bg-slate-50/50 transition-all cursor-pointer group"
                  >
                    {/* Left */}
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 bg-slate-100 rounded-xl flex items-center justify-center group-hover:bg-[#D9F99D]/20 transition-colors shrink-0">
                        <Plane className="h-4 w-4 text-slate-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-slate-900 uppercase italic tracking-tight">{exp.employee}</span>
                          <span className="text-[7px] font-bold text-slate-300 uppercase tracking-widest">{exp.dept} · {exp.branch}</span>
                        </div>
                        <p className="text-[9px] font-bold text-slate-500 mt-0.5">{exp.purpose}</p>
                        <div className="flex items-center gap-3 mt-1.5">
                          <span className="text-[7px] font-black text-slate-300 uppercase flex items-center gap-1">
                            <MapPin className="h-2.5 w-2.5" />{exp.from} → {exp.to}
                          </span>
                          <span className="text-[7px] font-black text-slate-300 uppercase flex items-center gap-1">
                            <Calendar className="h-2.5 w-2.5" />{exp.startDate}
                          </span>
                          <span className="text-[7px] font-black text-slate-300 uppercase flex items-center gap-1">
                            <Receipt className="h-2.5 w-2.5" />{exp.receipts.length} receipts
                          </span>
                        </div>
                      </div>
                    </div>
                    {/* Right */}
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right">
                        <p className="text-base font-black text-slate-900">₹ {exp.amount.toLocaleString()}</p>
                        <p className="text-[7px] font-bold text-slate-300 uppercase">{exp.id}</p>
                      </div>
                      <Badge className={cn("border-none font-black text-[7px] uppercase tracking-widest px-2 py-1 rounded-lg flex items-center gap-1", statusStyle[exp.status])}>
                        <Icon className="h-2.5 w-2.5" /> {exp.status}
                      </Badge>
                      <ArrowUpRight className="h-3.5 w-3.5 text-slate-200 group-hover:text-slate-500 transition-colors" />
                    </div>
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <div className="text-center py-16 text-slate-300">
                  <Plane className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-black uppercase tracking-widest">No claims found</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── POLICY TAB ── */}
      {activeTab === "policy" && (
        <Card className="border-none shadow-sm rounded-2xl bg-white p-1">
          <CardHeader className="p-6 pb-3 flex flex-row items-start justify-between">
            <div>
              <CardTitle className="text-lg font-black italic text-slate-900 underline underline-offset-4 decoration-[#D9F99D] decoration-2 uppercase tracking-tighter">
                Tour Expense Policy
              </CardTitle>
              <CardDescription className="text-[8px] font-black text-slate-400 mt-3 uppercase tracking-[0.3em] italic">
                Configured limits & reimbursement rules · Effective: Jan 01, 2026
              </CardDescription>
            </div>
            {canEditPolicy && (
              <Button 
                onClick={() => { setEditingPolicyIndex(null); setPolicyForm({ label: "", limit: "", note: "" }); setShowPolicyDialog(true); }}
                className="bg-slate-900 text-white hover:bg-black font-black uppercase text-[9px] tracking-widest px-5 h-9 rounded-xl transition-all flex items-center gap-2"
              >
                <Plus className="h-3 w-3 stroke-[3]" /> Add Rule
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {policies.map((rule, i) => (
              <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between rounded-2xl border-2 border-slate-50 p-4 hover:border-[#D9F99D] hover:bg-slate-50/50 transition-all group">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 bg-slate-100 rounded-xl flex items-center justify-center">
                    <Wallet className="h-4 w-4 text-slate-400" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-900 uppercase italic tracking-tight">{rule.label}</p>
                    <p className="text-[8px] font-bold text-slate-400 mt-0.5">{rule.note}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-3 sm:mt-0">
                  <div className="text-right">
                    <p className="text-sm font-black text-slate-900">{rule.limit}</p>
                    <p className="text-[7px] font-bold text-slate-300 uppercase mt-0.5">Max Limit</p>
                  </div>
                  {canEditPolicy && (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:text-slate-900 rounded-lg" onClick={() => { setEditingPolicyIndex(i); setPolicyForm(rule); setShowPolicyDialog(true); }}>
                        <AlertCircle className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg" onClick={() => handleDeletePolicy(i)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {/* General note */}
            <div className="rounded-2xl bg-amber-50 border border-amber-100 p-4 flex gap-3 mt-2 group relative">
              <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="flex justify-between items-center">
                  <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest">General Rules</p>
                  {canEditPolicy && !isEditingGeneral && (
                    <Button size="sm" variant="ghost" className="h-6 text-[8px] uppercase tracking-widest text-amber-600 hover:bg-amber-100 rounded-lg opacity-0 group-hover:opacity-100" onClick={() => setIsEditingGeneral(true)}>
                      Edit Rules
                    </Button>
                  )}
                </div>
                {isEditingGeneral ? (
                  <div className="mt-2 space-y-2">
                    <textarea 
                      className="w-full text-[9px] font-bold text-amber-800 bg-white border border-amber-200 rounded-lg p-2 outline-none focus:ring-1 focus:ring-amber-400 resize-none" 
                      rows={4} 
                      value={generalRules}
                      onChange={e => setGeneralRules(e.target.value)}
                    />
                    <div className="flex justify-end gap-1">
                       <Button size="sm" className="h-6 text-[8px] bg-amber-500 hover:bg-amber-600 text-white uppercase" onClick={() => handleSaveGeneralRules(generalRules)}>Save</Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-[9px] font-bold text-amber-600 mt-1 leading-relaxed whitespace-pre-wrap">
                    {generalRules}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Detail Dialog ── */}
      <Dialog open={!!selected} onOpenChange={v => !v && setSelected(null)}>
        <DialogContent
          className="rounded-2xl p-0 overflow-hidden border-none shadow-2xl [&>button]:top-5 [&>button]:right-5 [&>button]:z-50 [&>button]:text-white [&>button]:bg-white/10 [&>button]:rounded-full [&>button]:p-1"
          style={{ maxWidth: 640, width: '95vw' }}
        >
          <DialogTitle className="sr-only">Expense Claim Detail</DialogTitle>
          {selected && (() => {
            const Icon = statusIcon[selected.status];
            return (
              <div className="flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="bg-[#0f172a] p-7 shrink-0">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[7px] font-black uppercase tracking-widest" style={{ color: '#94a3b8' }}>{selected.id}</p>
                      <h3 className="text-lg font-black uppercase italic tracking-tighter mt-1" style={{ color: '#D9F99D' }}>{selected.employee}</h3>
                      <p className="text-[9px] font-bold mt-1" style={{ color: '#cbd5e1' }}>{selected.dept} · {selected.branch} · {selected.purpose}</p>
                    </div>
                    <Badge className={cn("border-none font-black text-[8px] uppercase tracking-widest px-3 py-1.5 rounded-xl flex items-center gap-1.5", statusStyle[selected.status])}>
                      <Icon className="h-3 w-3" /> {selected.status}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mt-6">
                    {[
                      { label: "Route",    value: `${selected.from} → ${selected.to}` },
                      { label: "Duration", value: `${selected.startDate} – ${selected.endDate}` },
                      { label: "Amount",   value: `₹ ${selected.amount.toLocaleString()}` },
                    ].map(d => (
                      <div key={d.label}>
                        <p className="text-[7px] font-black uppercase tracking-widest" style={{ color: '#94a3b8' }}>{d.label}</p>
                        <p className="text-[10px] font-black mt-1" style={{ color: '#f8fafc' }}>{d.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Body */}
                <div className="p-6 overflow-y-auto space-y-6">
                  
                  {/* Info Grid */}
                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-1">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Category</span>
                        <p className="text-xs font-bold text-slate-900">{selected.category}</p>
                     </div>
                     <div className="space-y-1">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Submitted On</span>
                        <p className="text-xs font-bold text-slate-900">{selected.submittedOn}</p>
                     </div>
                     {selected.approvedBy && (
                       <div className="space-y-1">
                          <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">Approved By</span>
                          <p className="text-xs font-bold text-slate-900">{selected.approvedBy}</p>
                       </div>
                     )}
                     {selected.rejectedReason && (
                       <div className="space-y-1 col-span-2">
                          <span className="text-[8px] font-black text-rose-500 uppercase tracking-widest">Rejection Reason</span>
                          <p className="text-xs font-bold text-rose-600 bg-rose-50 p-2 rounded-lg mt-1">{selected.rejectedReason}</p>
                       </div>
                     )}
                     {selected.remarks && (
                       <div className="space-y-1 col-span-2">
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Remarks</span>
                          <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg mt-1">{selected.remarks}</p>
                       </div>
                     )}
                  </div>

                  {/* Receipts Section */}
                  <div>
                    <h4 className="text-[9px] font-black text-slate-900 uppercase tracking-widest border-b border-slate-100 pb-2 mb-3">
                      Attached Receipts ({selected.receipts.length})
                    </h4>
                    {selected.receipts.length > 0 ? (
                      <div className="grid grid-cols-2 gap-3">
                        {selected.receipts.map(r => (
                          <div key={r.id} className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 bg-slate-50 hover:border-slate-300 transition-colors">
                             <div className="flex items-center gap-2 overflow-hidden">
                                <div className="h-8 w-8 bg-white rounded-lg flex items-center justify-center shrink-0 shadow-sm">
                                  <FileText className="h-4 w-4 text-slate-400" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-[9px] font-bold text-slate-900 truncate">{r.name}</p>
                                  <p className="text-[7px] font-black text-slate-400 uppercase">{r.size} • {r.type}</p>
                                </div>
                             </div>
                             <Button size="icon" variant="ghost" className="h-7 w-7 rounded-lg shrink-0" onClick={() => setViewReceipt(r)}>
                               <Eye className="h-3.5 w-3.5 text-slate-500" />
                             </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">No receipts attached.</p>
                    )}
                  </div>
                </div>
                {/* Actions */}
                <div className="px-6 pb-6 pt-4 border-t border-slate-100 flex gap-2 shrink-0">
                  {selected.status === "Pending" && (
                    <>
                      <Button onClick={handleApprove} className="flex-1 bg-[#D9F99D] text-slate-900 hover:bg-[#c8ea8a] font-black uppercase text-[9px] tracking-widest h-11 rounded-xl">
                        <CheckCircle2 className="h-3.5 w-3.5 mr-2" /> Approve
                      </Button>
                      <Button onClick={() => setShowReject(true)} className="flex-1 bg-rose-50 text-rose-600 hover:bg-rose-100 font-black uppercase text-[9px] tracking-widest h-11 rounded-xl border-none">
                        <XCircle className="h-3.5 w-3.5 mr-2" /> Reject
                      </Button>
                    </>
                  )}
                  <Button variant="outline" onClick={handleExportPDF} className="font-black uppercase text-[9px] tracking-widest h-11 rounded-xl border-slate-100 text-slate-500 hover:bg-slate-50">
                    <Download className="h-3.5 w-3.5 mr-2" /> Export PDF
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ── Reject Reason Dialog ── */}
      <Dialog open={showReject} onOpenChange={setShowReject}>
        <DialogContent className="sm:max-w-[425px] rounded-2xl border-none shadow-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-slate-900 italic uppercase">Reject Claim</DialogTitle>
            <DialogDescription className="text-xs">
              Please provide a reason for rejecting this expense claim.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <textarea 
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Enter rejection reason..."
              className="w-full min-h-[100px] p-3 rounded-xl bg-slate-50 border-none outline-none focus:ring-2 focus:ring-rose-500 text-sm resize-none"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowReject(false)} className="rounded-xl font-bold uppercase text-[10px] tracking-widest">Cancel</Button>
            <Button onClick={handleReject} disabled={!rejectReason.trim()} className="rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold uppercase text-[10px] tracking-widest">Confirm Rejection</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── View Receipt Dialog (Mock) ── */}
      <Dialog open={!!viewReceipt} onOpenChange={v => !v && setViewReceipt(null)}>
        <DialogContent className="sm:max-w-[800px] rounded-2xl border-none shadow-2xl p-0 overflow-hidden bg-slate-100">
          <DialogTitle className="sr-only">View Receipt</DialogTitle>
          <div className="flex items-center justify-between bg-[#0f172a] p-4 text-white">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5" style={{ color: '#94a3b8' }} />
              <div>
                <p className="text-sm font-bold" style={{ color: '#f8fafc' }}>{viewReceipt?.name}</p>
                <p className="text-[10px] uppercase tracking-widest" style={{ color: '#cbd5e1' }}>{viewReceipt?.size} • {viewReceipt?.type}</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white rounded-full">
              <Download className="h-4 w-4" />
            </Button>
          </div>
          <div className="h-[60vh] flex items-center justify-center p-8">
             <div className="bg-white w-full h-full rounded-xl shadow-sm border border-slate-200 flex flex-col items-center justify-center text-slate-300">
                <FileText className="h-16 w-16 mb-4 opacity-50" />
                <p className="text-sm font-bold text-slate-400">Receipt Preview</p>
                <p className="text-xs mt-2">{viewReceipt?.name}</p>
             </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Add Claim Dialog ── */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent
          className="rounded-2xl p-0 overflow-hidden border-none shadow-2xl [&>button]:top-5 [&>button]:right-5 [&>button]:z-50 [&>button]:text-white [&>button]:bg-white/10 [&>button]:rounded-full [&>button]:p-1"
          style={{ maxWidth: 640, width: '95vw' }}
        >
          <DialogTitle className="sr-only">New Tour Expense Claim</DialogTitle>
          <div className="flex flex-col max-h-[90vh]">
            <div className="bg-[#0f172a] px-7 py-6 shrink-0">
              <h3 className="text-lg font-black uppercase italic tracking-tighter" style={{ color: '#D9F99D' }}>New Expense Claim</h3>
              <p className="text-[8px] font-bold uppercase tracking-widest mt-1" style={{ color: '#94a3b8' }}>Fill in the tour details below</p>
            </div>
            <div className="p-6 overflow-y-auto space-y-5">
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Employee Name</label>
                  <Input
                    placeholder="e.g. Arjun Singh"
                    value={form.employee}
                    onChange={e => setForm(prev => ({ ...prev, employee: e.target.value }))}
                    className="h-10 bg-slate-50 border-none rounded-xl font-bold text-xs focus-visible:ring-1 focus-visible:ring-[#D9F99D]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Department</label>
                  <Input
                    placeholder="e.g. Sales"
                    value={form.dept}
                    onChange={e => setForm(prev => ({ ...prev, dept: e.target.value }))}
                    className="h-10 bg-slate-50 border-none rounded-xl font-bold text-xs focus-visible:ring-1 focus-visible:ring-[#D9F99D]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Branch</label>
                  <select
                    value={form.branch}
                    onChange={e => setForm(prev => ({ ...prev, branch: e.target.value }))}
                    className="w-full h-10 bg-slate-50 border-none rounded-xl font-bold text-xs px-3 outline-none focus:ring-1 focus:ring-[#D9F99D]"
                  >
                    {BRANCHES.map(b => <option key={b}>{b}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Tour Purpose</label>
                  <Input
                    placeholder="e.g. Client visit Mumbai"
                    value={form.purpose}
                    onChange={e => setForm(prev => ({ ...prev, purpose: e.target.value }))}
                    className="h-10 bg-slate-50 border-none rounded-xl font-bold text-xs focus-visible:ring-1 focus-visible:ring-[#D9F99D]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest">From City</label>
                  <Input
                    placeholder="Departure city"
                    value={form.from}
                    onChange={e => setForm(prev => ({ ...prev, from: e.target.value }))}
                    className="h-10 bg-slate-50 border-none rounded-xl font-bold text-xs focus-visible:ring-1 focus-visible:ring-[#D9F99D]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest">To City</label>
                  <Input
                    placeholder="Destination city"
                    value={form.to}
                    onChange={e => setForm(prev => ({ ...prev, to: e.target.value }))}
                    className="h-10 bg-slate-50 border-none rounded-xl font-bold text-xs focus-visible:ring-1 focus-visible:ring-[#D9F99D]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Start Date</label>
                  <Input
                    type="date"
                    value={form.startDate}
                    onChange={e => setForm(prev => ({ ...prev, startDate: e.target.value }))}
                    className="h-10 bg-slate-50 border-none rounded-xl font-bold text-xs focus-visible:ring-1 focus-visible:ring-[#D9F99D]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest">End Date</label>
                  <Input
                    type="date"
                    value={form.endDate}
                    onChange={e => setForm(prev => ({ ...prev, endDate: e.target.value }))}
                    className="h-10 bg-slate-50 border-none rounded-xl font-bold text-xs focus-visible:ring-1 focus-visible:ring-[#D9F99D]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Expense Category</label>
                  <select
                    value={form.category}
                    onChange={e => setForm(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full h-10 bg-slate-50 border-none rounded-xl font-bold text-xs px-3 outline-none focus:ring-1 focus:ring-[#D9F99D]"
                  >
                    {EXPENSE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Total Amount (₹)</label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={form.amount}
                    onChange={e => setForm(prev => ({ ...prev, amount: e.target.value }))}
                    className="h-10 bg-slate-50 border-none rounded-xl font-bold text-xs focus-visible:ring-1 focus-visible:ring-[#D9F99D]"
                  />
                </div>
              </div>

              <div className="space-y-1.5 border-t border-slate-100 pt-5">
                <div className="flex items-center justify-between">
                  <label className="text-[7px] font-black text-slate-900 uppercase tracking-widest">Attachments / Receipts</label>
                  <label className="cursor-pointer">
                    <input type="file" className="hidden" onChange={handleFileUpload} />
                    <div className="flex items-center gap-1 text-[8px] font-bold text-[#84cc16] hover:text-[#65a30d]">
                      <Paperclip className="h-3 w-3" /> Attach File
                    </div>
                  </label>
                </div>
                
                {form.receipts.length > 0 ? (
                  <div className="space-y-2 mt-2">
                    {form.receipts.map(r => (
                      <div key={r.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                        <div className="flex items-center gap-2">
                          <FileText className="h-3 w-3 text-slate-400" />
                          <span className="text-[10px] font-bold text-slate-700">{r.name}</span>
                          <span className="text-[8px] text-slate-400">({r.size})</span>
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded-md" onClick={() => removeReceipt(r.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 flex flex-col items-center justify-center text-center mt-2">
                    <Upload className="h-5 w-5 text-slate-300 mb-1" />
                    <p className="text-[9px] font-bold text-slate-500">Upload bills, tickets or receipts</p>
                    <p className="text-[7px] text-slate-400 uppercase mt-0.5">PDF, JPG, PNG up to 5MB</p>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Remarks / Notes</label>
                <textarea
                  rows={2}
                  placeholder="Any additional notes…"
                  value={form.notes}
                  onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full bg-slate-50 rounded-xl font-bold text-xs px-3 py-2.5 outline-none focus:ring-1 focus:ring-[#D9F99D] resize-none border-none"
                />
              </div>

            </div>
            <div className="px-6 pb-6 pt-4 border-t border-slate-50 flex gap-2 shrink-0">
              <Button
                onClick={handleSubmitClaim}
                className="flex-1 bg-[#D9F99D] text-slate-900 hover:bg-[#c8ea8a] font-black uppercase text-[9px] tracking-widest h-11 rounded-xl"
              >
                <Plus className="h-3.5 w-3.5 mr-2" /> Submit Claim
              </Button>
              <Button
                onClick={() => setShowAdd(false)}
                variant="outline"
                className="font-black uppercase text-[9px] tracking-widest h-11 rounded-xl border-slate-100 text-slate-400"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Policy Form Dialog ── */}
      <Dialog open={showPolicyDialog} onOpenChange={setShowPolicyDialog}>
        <DialogContent className="sm:max-w-[425px] rounded-2xl border-none shadow-2xl p-6 bg-white">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-slate-900 italic uppercase underline underline-offset-4 decoration-[#D9F99D]">
              {editingPolicyIndex !== null ? "Edit Policy Rule" : "Add Policy Rule"}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-1.5">
               <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Rule Category / Label</label>
               <Input 
                 placeholder="e.g. Hotel Stay" 
                 value={policyForm.label} 
                 onChange={e => setPolicyForm(prev => ({...prev, label: e.target.value}))}
                 className="h-10 bg-slate-50 border-none rounded-xl font-bold text-xs focus-visible:ring-1 focus-visible:ring-[#D9F99D]"
               />
            </div>
            <div className="space-y-1.5">
               <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Max Limit Details</label>
               <Input 
                 placeholder="e.g. ₹ 3,500 / night" 
                 value={policyForm.limit} 
                 onChange={e => setPolicyForm(prev => ({...prev, limit: e.target.value}))}
                 className="h-10 bg-slate-50 border-none rounded-xl font-bold text-xs focus-visible:ring-1 focus-visible:ring-[#D9F99D]"
               />
            </div>
            <div className="space-y-1.5">
               <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Additional Notes</label>
               <Input 
                 placeholder="e.g. Metro cities: ₹ 5,000 / night" 
                 value={policyForm.note} 
                 onChange={e => setPolicyForm(prev => ({...prev, note: e.target.value}))}
                 className="h-10 bg-slate-50 border-none rounded-xl font-bold text-xs focus-visible:ring-1 focus-visible:ring-[#D9F99D]"
               />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowPolicyDialog(false)} className="rounded-xl font-bold uppercase text-[10px] tracking-widest">Cancel</Button>
            <Button onClick={handleSavePolicy} className="rounded-xl bg-[#D9F99D] hover:bg-[#c8ea8a] text-slate-900 font-bold uppercase text-[10px] tracking-widest">
              Save Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </ProtectedRoute>
  );
}
