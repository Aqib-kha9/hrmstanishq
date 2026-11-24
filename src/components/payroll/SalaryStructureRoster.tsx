"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { apiGet, apiPut, apiPost, getToken } from "@/lib/api-client";
import {
  Users,
  Search,
  Filter,
  FileSpreadsheet,
  Upload,
  Download,
  Building2,
  RefreshCw,
  Edit,
  CheckCircle2,
  AlertTriangle,
  ArrowUpDown,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface EmployeeRosterRow {
  employeeId: number;
  empCode: string;
  name: string;
  designation: string;
  companyName: string;
  companyId: number;
  officeName: string;
  officeId: number;
  state: string;
  wagesCategory: string;
  minimumWageMonthly: number;
  structureId?: number;
  calculationBasis: string;
  annualCTC: number;
  monthlyCTC: number;
  annualGross: number;
  monthlyGross: number;
  annualBasic: number;
  monthlyBasic: number;
  annualHra: number;
  monthlyHra: number;
  annualSpecialAllowance: number;
  monthlySpecialAllowance: number;
  employerPfAnnual: number;
  employerEsicAnnual: number;
  gratuityAnnual: number;
  statutoryBonusAnnual: number;
  exgratiaBonusAnnual: number;
  employeePfAnnual: number;
  employeeEsicAnnual: number;
  ptAnnual: number;
  totalDeductionsAnnual: number;
  netTakeHomeAnnual: number;
  netTakeHomeMonthly: number;
  currentTakeHomeMonthly: number;
  differenceInTakeHome: number;
  basicCalculatedOn: string;
  isSpecialAllowanceNegative: boolean;
  pfApplicable: boolean;
  esicApplicable: boolean;
  bonusApplicable: boolean;
}

export function SalaryStructureRoster() {
  const [roster, setRoster] = useState<EmployeeRosterRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>("");
  const [companyFilter, setCompanyFilter] = useState<string>("ALL");
  const [stateFilter, setStateFilter] = useState<string>("ALL");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 15;

  // Edit Modal State
  const [editingRow, setEditingRow] = useState<EmployeeRosterRow | null>(null);
  const [editBasis, setEditBasis] = useState<string>("CTC");
  const [editAmount, setEditAmount] = useState<string>("");
  const [editState, setEditState] = useState<string>("MP");
  const [editCategory, setEditCategory] = useState<string>("Skilled");
  const [savingEdit, setSavingEdit] = useState<boolean>(false);

  // Import Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [uploadingFile, setUploadingFile] = useState<boolean>(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadRoster = async () => {
    setLoading(true);
    try {
      const res = await apiGet<any>("/payroll/salary-structures");
      if (res && res.data) {
        setRoster(res.data);
      }
    } catch (err) {
      console.error("Failed to load salary structures roster:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoster();
  }, []);

  // Filter lists
  const companiesList = useMemo(() => {
    const set = new Set(roster.map((r) => r.companyName).filter(Boolean));
    return ["ALL", ...Array.from(set)];
  }, [roster]);

  const statesList = useMemo(() => {
    const set = new Set(roster.map((r) => r.state).filter(Boolean));
    return ["ALL", ...Array.from(set)];
  }, [roster]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    let result = roster;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.empCode.toLowerCase().includes(q) ||
          r.designation.toLowerCase().includes(q) ||
          r.officeName.toLowerCase().includes(q)
      );
    }
    if (companyFilter !== "ALL") {
      result = result.filter((r) => r.companyName === companyFilter);
    }
    if (stateFilter !== "ALL") {
      result = result.filter((r) => r.state === stateFilter);
    }
    return result;
  }, [roster, search, companyFilter, stateFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredRows.length / itemsPerPage) || 1;
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredRows.slice(start, start + itemsPerPage);
  }, [filteredRows, currentPage]);

  const fmt = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

  // Handle Edit Save
  const handleSaveEdit = async () => {
    if (!editingRow) return;
    setSavingEdit(true);
    try {
      await apiPut(`/payroll/salary-structures/${editingRow.employeeId}`, {
        calculation_basis: editBasis,
        amount: parseFloat(editAmount) || 0,
        isMonthly: false,
        state: editState,
        wages_category: editCategory,
        pf_applicable: editingRow.pfApplicable,
        esic_applicable: editingRow.esicApplicable,
        bonus_applicable: editingRow.bonusApplicable,
        current_take_home: editingRow.currentTakeHomeMonthly,
      });
      setEditingRow(null);
      await loadRoster();
    } catch (err) {
      console.error("Error updating structure:", err);
    } finally {
      setSavingEdit(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (row: EmployeeRosterRow) => {
    setEditingRow(row);
    setEditBasis(row.calculationBasis || "CTC");
    setEditAmount(String(row.annualCTC || row.annualGross || 0));
    setEditState(row.state || "MP");
    setEditCategory(row.wagesCategory || "Skilled");
  };

  // Handle Excel Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFile(true);
    setImportMessage(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const token = getToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";
      const res = await fetch(`${apiUrl}/payroll/salary-structures/import-client-excel`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setImportMessage(data.message);
        await loadRoster();
      } else {
        setImportMessage(data.message || "Failed to process excel file");
      }
    } catch (err: any) {
      setImportMessage(`Upload failed: ${err.message}`);
    } finally {
      setUploadingFile(false);
    }
  };

  // Handle Excel Export Download
  const handleExportRoster = () => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";
    const token = getToken();
    window.open(`${apiUrl}/payroll/salary-structures/export-excel?token=${token}`, "_blank");
  };

  return (
    <div className="space-y-5">
      {/* ── TOP ACTION BAR ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h3 className="text-base font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-600" />
            Company Salary Structure Roster (83-Column Engine)
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Active roster tracking {roster.length} employees across all branches with Wage Code minimum wage compliance and take-home benchmarks.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={loadRoster}
            disabled={loading}
            className="h-9 px-3 rounded-xl border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsImportModalOpen(true)}
            className="h-9 px-3.5 rounded-xl border-blue-200 bg-blue-50/60 hover:bg-blue-100 text-blue-800 text-xs font-black uppercase tracking-wider cursor-pointer shadow-xs"
          >
            <Upload className="h-3.5 w-3.5 mr-1.5" /> Import Client Excel
          </Button>
          <Button
            size="sm"
            onClick={handleExportRoster}
            className="h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-wider cursor-pointer shadow-sm flex items-center gap-1.5"
          >
            <Download className="h-3.5 w-3.5" /> Export Spreadsheet (.xlsx)
          </Button>
        </div>
      </div>

      {/* ── SEARCH & FILTER CONTROLS ── */}
      <div className="flex flex-col md:flex-row items-center gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search employee by name, code, designation or branch..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            className="h-10 pl-10 pr-4 text-xs font-bold bg-slate-50/60 border-slate-200 rounded-xl w-full"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          {/* Company Filter */}
          <select
            value={companyFilter}
            onChange={(e) => {
              setCompanyFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="h-10 text-xs font-bold bg-white border border-slate-200 rounded-xl px-3 text-slate-800 shadow-2xs focus:outline-none"
          >
            {companiesList.map((c) => (
              <option key={c} value={c}>
                {c === "ALL" ? "All Companies" : c}
              </option>
            ))}
          </select>

          {/* State Filter */}
          <select
            value={stateFilter}
            onChange={(e) => {
              setStateFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="h-10 text-xs font-bold bg-white border border-slate-200 rounded-xl px-3 text-slate-800 shadow-2xs focus:outline-none"
          >
            {statesList.map((s) => (
              <option key={s} value={s}>
                {s === "ALL" ? "All States" : s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── ROSTER TABLE ── */}
      <Card className="rounded-2xl border-slate-200 shadow-sm bg-white overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto min-h-[420px]">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-black uppercase text-slate-600 tracking-wider">
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-3">State / Category</th>
                  <th className="py-3 px-3 text-right">Floor Min Wage</th>
                  <th className="py-3 px-3 text-right">Annual CTC</th>
                  <th className="py-3 px-3 text-right">Monthly Gross</th>
                  <th className="py-3 px-3 text-right">Basic Salary</th>
                  <th className="py-3 px-3 text-right">Net Take-Home</th>
                  <th className="py-3 px-3 text-right">Previous TH</th>
                  <th className="py-3 px-3 text-center">Variance (Diff)</th>
                  <th className="py-3 px-3 text-center">Statutory</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={11} className="py-16 text-center text-slate-400 font-bold">
                      Loading salary roster records...
                    </td>
                  </tr>
                ) : paginatedRows.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-16 text-center text-slate-400 font-bold">
                      No matching employee records found.
                    </td>
                  </tr>
                ) : (
                  paginatedRows.map((row) => (
                    <tr key={row.employeeId} className="hover:bg-slate-50/80 transition-colors">
                      {/* Employee Info */}
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <span className="font-black text-slate-900 text-xs">{row.name}</span>
                          <span className="text-[10px] text-slate-500 font-bold">
                            {row.empCode} • {row.designation}
                          </span>
                          <span className="text-[9px] text-blue-700 font-semibold truncate max-w-[170px]">
                            {row.companyName} • {row.officeName.replace(/^[^-—]+[-—]\s*/, "")}
                          </span>
                        </div>
                      </td>

                      {/* State & Wages Category */}
                      <td className="py-3 px-3">
                        <div className="flex flex-col items-start gap-0.5">
                          <span className="text-[11px] font-black text-slate-800">{row.state}</span>
                          <span className="text-[9.5px] font-bold text-slate-500">{row.wagesCategory}</span>
                          {row.basicCalculatedOn === "Minimum Wage" && (
                            <span className="text-[8.5px] font-black text-amber-700 bg-amber-50 px-1 py-0.2 rounded border border-amber-200">
                              Floor Override
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Minimum Wage Floor */}
                      <td className="py-3 px-3 text-right font-black text-slate-700">
                        {fmt(row.minimumWageMonthly)}
                      </td>

                      {/* Annual CTC */}
                      <td className="py-3 px-3 text-right">
                        <span className="font-black text-blue-900 text-xs block">{fmt(row.annualCTC)}</span>
                        <span className="text-[9px] text-slate-400 font-medium">{fmt(row.monthlyCTC)}/mo</span>
                      </td>

                      {/* Monthly Gross */}
                      <td className="py-3 px-3 text-right font-black text-slate-900">
                        {fmt(row.monthlyGross)}
                      </td>

                      {/* Basic Salary */}
                      <td className="py-3 px-3 text-right">
                        <span className="font-black text-slate-800 text-xs block">{fmt(row.monthlyBasic)}</span>
                        <span className="text-[9px] text-slate-400 font-medium">HRA: {fmt(row.monthlyHra)}</span>
                      </td>

                      {/* Net Take-Home */}
                      <td className="py-3 px-3 text-right">
                        <span className="font-black text-emerald-700 text-xs block">
                          {fmt(row.netTakeHomeMonthly)}
                        </span>
                        <span className="text-[9px] text-slate-400 font-medium">{fmt(row.netTakeHomeAnnual)}/yr</span>
                      </td>

                      {/* Previous Take-Home */}
                      <td className="py-3 px-3 text-right font-bold text-slate-600">
                        {row.currentTakeHomeMonthly > 0 ? fmt(row.currentTakeHomeMonthly) : "--"}
                      </td>

                      {/* Difference (Variance) */}
                      <td className="py-3 px-3 text-center">
                        {row.currentTakeHomeMonthly > 0 ? (
                          <span
                            className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-black ${
                              row.differenceInTakeHome >= 0
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-rose-50 text-rose-700"
                            }`}
                          >
                            {row.differenceInTakeHome >= 0 ? (
                              <TrendingUp className="h-3 w-3" />
                            ) : (
                              <TrendingDown className="h-3 w-3" />
                            )}
                            {fmt(Math.abs(row.differenceInTakeHome))}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[10px]">--</span>
                        )}
                      </td>

                      {/* Statutory Badges */}
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[8.5px] font-black uppercase ${
                              row.pfApplicable ? "bg-blue-100 text-blue-900" : "bg-slate-100 text-slate-400"
                            }`}
                            title="Provident Fund"
                          >
                            PF
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[8.5px] font-black uppercase ${
                              row.esicApplicable ? "bg-purple-100 text-purple-900" : "bg-slate-100 text-slate-400"
                            }`}
                            title="ESIC"
                          >
                            ESI
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[8.5px] font-black uppercase ${
                              row.bonusApplicable ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-400"
                            }`}
                            title="Annual Bonus"
                          >
                            BON
                          </span>
                        </div>
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditModal(row)}
                          className="h-7 w-7 p-0 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-blue-50 cursor-pointer"
                          title="Edit Salary Structure"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>
              Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
              {Math.min(currentPage * itemsPerPage, filteredRows.length)} of {filteredRows.length} employees
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="h-8 px-2.5 rounded-lg border-slate-200 text-xs cursor-pointer"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Previous
              </Button>
              <span className="font-bold text-slate-800">
                {currentPage} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="h-8 px-2.5 rounded-lg border-slate-200 text-xs cursor-pointer"
              >
                Next <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── EDIT SALARY STRUCTURE MODAL ── */}
      {editingRow && (
        <Dialog open={!!editingRow} onOpenChange={(open) => !open && setEditingRow(null)}>
          <DialogContent className="max-w-[540px] p-6 rounded-3xl bg-white border border-slate-200 shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-base font-black uppercase text-slate-900 tracking-tight">
                Update Salary Structure: {editingRow.name}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Emp Code: {editingRow.empCode} • {editingRow.companyName} • {editingRow.designation}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[10px] font-black uppercase text-slate-600">Calculation Basis</Label>
                  <select
                    value={editBasis}
                    onChange={(e) => setEditBasis(e.target.value)}
                    className="h-9 w-full mt-1 text-xs font-bold bg-white border border-slate-200 rounded-xl px-3 text-slate-900"
                  >
                    <option value="CTC">CTC (Cost to Company)</option>
                    <option value="Gross">Gross Salary</option>
                    <option value="Net Take Home">Net Take-Home</option>
                  </select>
                </div>

                <div>
                  <Label className="text-[10px] font-black uppercase text-slate-600">Annual Target Amount (₹)</Label>
                  <Input
                    type="number"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    className="h-9 mt-1 text-xs font-bold bg-white border-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[10px] font-black uppercase text-slate-600">State / Location</Label>
                  <select
                    value={editState}
                    onChange={(e) => setEditState(e.target.value)}
                    className="h-9 w-full mt-1 text-xs font-bold bg-white border border-slate-200 rounded-xl px-3 text-slate-900"
                  >
                    <option value="MP">MP</option>
                    <option value="Lucknow">Lucknow</option>
                    <option value="Rajsthan">Rajsthan</option>
                    <option value="Nagpur">Nagpur</option>
                  </select>
                </div>

                <div>
                  <Label className="text-[10px] font-black uppercase text-slate-600">Wages Category</Label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="h-9 w-full mt-1 text-xs font-bold bg-white border border-slate-200 rounded-xl px-3 text-slate-900"
                  >
                    <option value="Unskilled">Unskilled</option>
                    <option value="Semi-skilled">Semi-skilled</option>
                    <option value="Skilled">Skilled</option>
                    <option value="Highly Skilled">Highly Skilled</option>
                  </select>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Previous Take Home:</span>
                  <span className="font-black text-slate-900">{fmt(editingRow.currentTakeHomeMonthly)}/mo</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Current Monthly Gross:</span>
                  <span className="font-black text-blue-900">{fmt(editingRow.monthlyGross)}/mo</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Current Monthly Net:</span>
                  <span className="font-black text-emerald-700">{fmt(editingRow.netTakeHomeMonthly)}/mo</span>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditingRow(null)}
                className="h-9 px-4 rounded-xl border-slate-200 cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSaveEdit}
                disabled={savingEdit}
                className="h-9 px-5 rounded-xl bg-blue-900 hover:bg-blue-800 text-white font-black uppercase text-xs tracking-wider cursor-pointer shadow-md"
              >
                {savingEdit ? "Recalculating..." : "Save & Recalculate"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ── CLIENT EXCEL IMPORT MODAL ── */}
      <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
        <DialogContent className="max-w-[480px] p-6 rounded-3xl bg-white border border-slate-200 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-black uppercase text-slate-900 tracking-tight flex items-center gap-2">
              <Upload className="h-5 w-5 text-blue-600" />
              Import Client Payroll Excel File
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Upload client horizontal spreadsheet (`Final_CTC_Structure_Calculator_Exgretia_Horizontal-1=.xlsx`) to automatically ingest or update all 162+ employee salary structures.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".xlsx,.xls"
              className="hidden"
            />

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50/40 p-8 rounded-2xl text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2"
            >
              <FileSpreadsheet className="h-8 w-8 text-blue-600" />
              <span className="text-xs font-black text-slate-800 uppercase tracking-wide">
                {uploadingFile ? "Ingesting Excel Data..." : "Click to select Excel (.xlsx) file"}
              </span>
              <span className="text-[10px] text-slate-400">
                Supports official 83-column client format with automatic formula sync
              </span>
            </div>

            {importMessage && (
              <div
                className={`p-3.5 rounded-xl text-xs font-bold ${
                  importMessage.includes("Successfully")
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : "bg-rose-50 text-rose-800 border border-rose-200"
                }`}
              >
                {importMessage}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsImportModalOpen(false)}
              className="h-9 px-4 rounded-xl border-slate-200 cursor-pointer"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
