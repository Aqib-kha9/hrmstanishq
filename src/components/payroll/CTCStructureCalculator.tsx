"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  calculateSalaryStructure,
  SalaryEngineInput,
  SalaryEngineResult,
  round2,
} from "@/lib/salaryCalculatorEngine";
import { apiGet } from "@/lib/api-client";
import {
  Calculator,
  ShieldCheck,
  Building2,
  FileSpreadsheet,
  Download,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Percent,
  Banknote,
  DollarSign,
  TrendingUp,
  Info,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import * as XLSX from "xlsx";

interface MinimumWageItem {
  id: number;
  state: string;
  wages_category: string;
  monthly_wage: number;
  remark?: string;
}

export function CTCStructureCalculator() {
  // Input State
  const [basis, setBasis] = useState<"CTC" | "Gross" | "Net Take Home">("CTC");
  const [amountInput, setAmountInput] = useState<string>("462000");
  const [isMonthly, setIsMonthly] = useState<boolean>(false);

  // Geographic & Category Rules
  const [state, setState] = useState<string>("MP");
  const [wagesCategory, setWagesCategory] = useState<string>("Skilled");
  const [gender, setGender] = useState<"All" | "Male" | "Female">("All");

  // Percentage & Ceiling Configuration
  const [basicPct, setBasicPct] = useState<number>(0.50);
  const [hraPct, setHraPct] = useState<number>(0.40);
  const [otherFixedAllowances, setOtherFixedAllowances] = useState<number>(0);

  // PF Configuration
  const [pfApplicable, setPfApplicable] = useState<boolean>(false);
  const [pfWageLimit, setPfWageLimit] = useState<number>(25000);
  const [employerPfPct, setEmployerPfPct] = useState<number>(0.13);
  const [employeePfPct, setEmployeePfPct] = useState<number>(0.12);

  // ESIC Configuration
  const [esicApplicable, setEsicApplicable] = useState<boolean>(false);
  const [esicCalcBase, setEsicCalcBase] = useState<"Basic" | "Gross">("Basic");
  const [esicWageLimit, setEsicWageLimit] = useState<number>(21000);

  // Gratuity & Bonus
  const [gratuityApplicable, setGratuityApplicable] = useState<boolean>(true);
  const [gratuityPct, setGratuityPct] = useState<number>(0.0481);
  const [bonusApplicable, setBonusApplicable] = useState<boolean>(false);
  const [bonusPct, setBonusPct] = useState<number>(0.0833);

  // Other Monthly Deductions
  const [tdsMonthly, setTdsMonthly] = useState<number>(0);
  const [lwfMonthly, setLwfMonthly] = useState<number>(0);
  const [loanEmiMonthly, setLoanEmiMonthly] = useState<number>(0);
  const [otherDeductionsMonthly, setOtherDeductionsMonthly] = useState<number>(0);

  // Database Masters
  const [minimumWagesList, setMinimumWagesList] = useState<MinimumWageItem[]>([]);
  const [statesList, setStatesList] = useState<string[]>(["MP", "Lucknow", "Rajsthan", "Nagpur"]);
  const [categoriesList, setCategoriesList] = useState<string[]>([
    "Unskilled",
    "Semi-skilled",
    "Skilled",
    "Highly Skilled",
  ]);

  // Load masters from API
  useEffect(() => {
    async function loadMasters() {
      try {
        const res = await apiGet<any>("/payroll/minimum-wages");
        if (res && res.data) {
          setMinimumWagesList(res.data.records || []);
          if (res.data.states && res.data.states.length > 0) setStatesList(res.data.states);
          if (res.data.categories && res.data.categories.length > 0) setCategoriesList(res.data.categories);
        }
      } catch (err) {
        console.warn("Failed to load minimum wages from API, using fallback catalog:", err);
      }
    }
    loadMasters();
  }, []);

  // Matched Minimum Wage Floor
  const currentMinimumWage = useMemo(() => {
    const matched = minimumWagesList.find(
      (m) =>
        m.state.toUpperCase() === state.toUpperCase() &&
        m.wages_category.toUpperCase() === wagesCategory.toUpperCase()
    );
    if (matched) return Number(matched.monthly_wage);

    // Fallback defaults matching client Excel
    if (state === "MP") {
      if (wagesCategory === "Unskilled") return 12575;
      if (wagesCategory === "Semi-skilled") return 13571;
      if (wagesCategory === "Skilled") return 15294;
      if (wagesCategory === "Highly Skilled") return 16919;
    }
    if (state === "Lucknow") {
      if (wagesCategory === "Unskilled") return 13006;
      if (wagesCategory === "Semi-skilled") return 14306;
      if (wagesCategory === "Skilled") return 16025;
    }
    if (state === "Rajsthan") {
      if (wagesCategory === "Unskilled") return 7722;
      if (wagesCategory === "Semi-skilled") return 8034;
      if (wagesCategory === "Skilled") return 8346;
      if (wagesCategory === "Highly Skilled") return 9646;
    }
    if (state === "Nagpur") {
      if (wagesCategory === "Unskilled") return 14155;
      if (wagesCategory === "Semi-skilled") return 14990;
      if (wagesCategory === "Skilled") return 15766;
    }
    return 15294;
  }, [minimumWagesList, state, wagesCategory]);

  // Compute live breakdown
  const calcResult = useMemo<SalaryEngineResult>(() => {
    const numericAmount = parseFloat(amountInput) || 0;
    return calculateSalaryStructure({
      basis,
      amount: numericAmount,
      isMonthly,
      state,
      wagesCategory,
      minimumWage: currentMinimumWage,
      basicPct,
      hraPct,
      otherFixedAllowances,
      pfApplicable,
      pfWageLimit,
      employerPfPct,
      employeePfPct,
      esicApplicable,
      esicCalcBase,
      esicWageLimit,
      gratuityApplicable,
      gratuityPct,
      bonusApplicable,
      bonusPct,
      ptApplicable: true,
      gender,
      tdsMonthly,
      lwfMonthly,
      loanEmiMonthly,
      otherDeductionsMonthly,
    });
  }, [
    basis,
    amountInput,
    isMonthly,
    state,
    wagesCategory,
    currentMinimumWage,
    basicPct,
    hraPct,
    otherFixedAllowances,
    pfApplicable,
    pfWageLimit,
    employerPfPct,
    employeePfPct,
    esicApplicable,
    esicCalcBase,
    esicWageLimit,
    gratuityApplicable,
    gratuityPct,
    bonusApplicable,
    bonusPct,
    gender,
    tdsMonthly,
    lwfMonthly,
    loanEmiMonthly,
    otherDeductionsMonthly,
  ]);

  const fmt = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

  // Export this calculation as an Excel workbook
  const handleExportSingleExcel = () => {
    const wb = XLSX.utils.book_new();

    const summaryRows = [
      ["CTC STRUCTURE CALCULATOR — New Labour / Wage Code Compliant"],
      ["Generated via HRMS Enterprise Payroll Engine"],
      [""],
      ["STEP 1 — Inputs & Basis"],
      ["Calculation Basis", basis],
      ["Input Amount (Entered)", amountInput],
      ["Period", isMonthly ? "Monthly" : "Annual"],
      ["State", state],
      ["Wages Category", wagesCategory],
      ["Statutory Minimum Wage (Monthly)", currentMinimumWage],
      [""],
      ["STEP 2 — Statutory Rules & Rates"],
      ["Basic % of CTC", `${(basicPct * 100).toFixed(2)}%`],
      ["HRA % of Basic", `${(hraPct * 100).toFixed(2)}%`],
      ["Employer PF Contribution %", `${(employerPfPct * 100).toFixed(2)}%`],
      ["Employee PF Contribution %", `${(employeePfPct * 100).toFixed(2)}%`],
      ["PF Applicable?", pfApplicable ? "Yes" : "No"],
      ["PF Wage Limit (Monthly)", pfWageLimit],
      ["Gratuity % (on Basic)", `${(gratuityPct * 100).toFixed(2)}%`],
      ["Bonus Applicable?", bonusApplicable ? "Yes" : "No"],
      ["Bonus % of Basic", `${(bonusPct * 100).toFixed(2)}%`],
      ["ESIC Applicable?", esicApplicable ? "Yes" : "No"],
      ["ESIC Base", esicCalcBase],
      [""],
      ["STEP 3 — Salary Breakup", "Annual (₹)", "Monthly (₹)"],
      ["Cost to Company (CTC)", calcResult.annual.ctc, calcResult.monthly.ctc],
      ["Basic Salary", calcResult.annual.basic, calcResult.monthly.basic],
      ["HRA (House Rent Allowance)", calcResult.annual.hra, calcResult.monthly.hra],
      ["Other Fixed Allowances", calcResult.annual.otherFixed, calcResult.monthly.otherFixed],
      ["Special Allowance (Balancing)", calcResult.annual.specialAllowance, calcResult.monthly.specialAllowance],
      ["Gross Salary", calcResult.annual.gross, calcResult.monthly.gross],
      [""],
      ["Employer Contributions (Included in CTC)", "Annual (₹)", "Monthly (₹)"],
      ["Employer PF Contribution", calcResult.annual.employerPf, calcResult.monthly.employerPf],
      ["Employer ESIC Contribution", calcResult.annual.employerEsic, calcResult.monthly.employerEsic],
      ["Gratuity (4.81%)", calcResult.annual.gratuity, calcResult.monthly.gratuity],
      ["Annual Statutory Bonus", calcResult.annual.statutoryBonus, calcResult.monthly.statutoryBonus],
      ["Exgratia Bonus", calcResult.annual.exgratiaBonus, calcResult.monthly.exgratiaBonus],
      ["Total Employer Benefits", calcResult.annual.totalEmployerBenefits, calcResult.monthly.totalEmployerBenefits],
      [""],
      ["Employee Deductions", "Annual (₹)", "Monthly (₹)"],
      ["Employee PF Contribution", calcResult.annual.employeePf, calcResult.monthly.employeePf],
      ["Employee ESIC Contribution", calcResult.annual.employeeEsic, calcResult.monthly.employeeEsic],
      ["Professional Tax (PT)", calcResult.annual.pt, calcResult.monthly.pt],
      ["Income Tax / TDS", calcResult.annual.tds, calcResult.monthly.tds],
      ["Labour Welfare Fund (LWF)", calcResult.annual.lwf, calcResult.monthly.lwf],
      ["Total Deductions", calcResult.annual.totalDeductions, calcResult.monthly.totalDeductions],
      [""],
      ["NET TAKE-HOME SALARY", calcResult.annual.netTakeHome, calcResult.monthly.netTakeHome],
      ["Basic Calculated On", calcResult.meta.basicCalculatedOn],
    ];

    const ws = XLSX.utils.aoa_to_sheet(summaryRows);
    XLSX.utils.book_append_sheet(wb, ws, "CTC_Structure");
    XLSX.writeFile(wb, `CTC_Structure_${basis}_${amountInput}.xlsx`);
  };

  const handleResetDefaults = () => {
    setBasis("CTC");
    setAmountInput("462000");
    setIsMonthly(false);
    setState("MP");
    setWagesCategory("Skilled");
    setBasicPct(0.50);
    setHraPct(0.40);
    setOtherFixedAllowances(0);
    setPfApplicable(false);
    setPfWageLimit(25000);
    setEsicApplicable(false);
    setEsicCalcBase("Basic");
    setGratuityApplicable(true);
    setBonusApplicable(false);
    setTdsMonthly(0);
    setLwfMonthly(0);
  };

  return (
    <div className="space-y-6">
      {/* ── TOP HEADER HERO ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 p-6 rounded-3xl text-white shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge className="bg-amber-400 text-slate-950 font-black tracking-wider text-[10px] uppercase px-2.5 py-0.5">
              New Wage Code Compliant
            </Badge>
            <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-black uppercase px-2 py-0.5">
              100% Client Excel Matched
            </Badge>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2.5 pt-1">
            <Calculator className="h-6 w-6 text-amber-400" />
            CTC Structure Calculator & Reverse Solver Engine
          </h2>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            Automatic statutory breakdown across Basic, HRA, PF (13%), ESIC, Gratuity (4.81%), Statutory vs Exgratia Bonus (₹21k cutoff), and State-wise Professional Tax with reverse iteration from Gross or Net Take-Home.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleResetDefaults}
            className="h-10 px-4 rounded-xl border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-slate-200 text-xs font-bold cursor-pointer shadow-sm"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Reset Defaults
          </Button>
          <Button
            size="sm"
            onClick={handleExportSingleExcel}
            className="h-10 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-950/40 cursor-pointer flex items-center gap-2"
          >
            <FileSpreadsheet className="h-4 w-4" /> Export Excel
          </Button>
        </div>
      </div>

      {/* ── TOP KPI METRIC CARDS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Total CTC */}
        <Card className="rounded-2xl border-slate-200 shadow-sm bg-white overflow-hidden relative">
          <div className="h-1.5 w-full bg-blue-600" />
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-black uppercase tracking-wider">Total Cost To Company (CTC)</span>
              <Building2 className="h-4 w-4 text-blue-600" />
            </div>
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {fmt(calcResult.annual.ctc)}
              <span className="text-xs font-bold text-slate-500 ml-1.5 font-normal">/yr</span>
            </div>
            <div className="text-xs font-bold text-blue-700 mt-1">
              {fmt(calcResult.monthly.ctc)} <span className="text-[10px] text-slate-500 font-medium">per month</span>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Gross Salary */}
        <Card className="rounded-2xl border-slate-200 shadow-sm bg-white overflow-hidden relative">
          <div className="h-1.5 w-full bg-indigo-600" />
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-black uppercase tracking-wider">Gross Salary</span>
              <TrendingUp className="h-4 w-4 text-indigo-600" />
            </div>
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {fmt(calcResult.annual.gross)}
              <span className="text-xs font-bold text-slate-500 ml-1.5 font-normal">/yr</span>
            </div>
            <div className="text-xs font-bold text-indigo-700 mt-1">
              {fmt(calcResult.monthly.gross)} <span className="text-[10px] text-slate-500 font-medium">per month</span>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Net Take-Home */}
        <Card className="rounded-2xl border-slate-200 shadow-sm bg-white overflow-hidden relative">
          <div className="h-1.5 w-full bg-emerald-600" />
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-black uppercase tracking-wider">Net In-Hand / Take Home</span>
              <Banknote className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-emerald-700 tracking-tight">
              {fmt(calcResult.annual.netTakeHome)}
              <span className="text-xs font-bold text-slate-500 ml-1.5 font-normal">/yr</span>
            </div>
            <div className="text-xs font-bold text-emerald-800 mt-1">
              {fmt(calcResult.monthly.netTakeHome)} <span className="text-[10px] text-slate-500 font-medium">per month</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── MAIN CONFIGURATION & SPLIT VIEW ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN (Inputs & Rule Toggles) — 5 Cols */}
        <div className="lg:col-span-5 space-y-5">
          {/* STEP 1: Calculation Basis & Amount */}
          <Card className="rounded-2xl border-slate-200 shadow-sm bg-white">
            <CardHeader className="p-5 pb-3 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-black text-white">
                    1
                  </span>
                  Calculation Basis & Amount
                </CardTitle>
                <Badge variant="outline" className="text-[9px] font-bold uppercase">
                  Reverse Solver Active
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-5 space-y-4 text-xs">
              {/* Basis Buttons */}
              <div>
                <Label className="text-[10px] font-black uppercase text-slate-600 tracking-wider">Select Calculation Basis</Label>
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl mt-1.5 border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setBasis("CTC")}
                    className={`py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                      basis === "CTC"
                        ? "bg-blue-900 text-white shadow-sm"
                        : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                    }`}
                  >
                    CTC
                  </button>
                  <button
                    type="button"
                    onClick={() => setBasis("Gross")}
                    className={`py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                      basis === "Gross"
                        ? "bg-blue-900 text-white shadow-sm"
                        : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                    }`}
                  >
                    Gross
                  </button>
                  <button
                    type="button"
                    onClick={() => setBasis("Net Take Home")}
                    className={`py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                      basis === "Net Take Home"
                        ? "bg-blue-900 text-white shadow-sm"
                        : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                    }`}
                  >
                    Net In-Hand
                  </button>
                </div>
              </div>

              {/* Amount Input with Period Toggle */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label className="text-[10px] font-black uppercase text-slate-600 tracking-wider">
                    {basis} Target Amount (₹)
                  </Label>
                  <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5 border border-slate-200">
                    <button
                      type="button"
                      onClick={() => {
                        if (isMonthly) {
                          const n = parseFloat(amountInput) || 0;
                          setAmountInput(String(Math.round(n * 12)));
                          setIsMonthly(false);
                        }
                      }}
                      className={`px-2 py-0.5 text-[9px] font-black uppercase rounded ${
                        !isMonthly ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500"
                      }`}
                    >
                      Annual
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!isMonthly) {
                          const n = parseFloat(amountInput) || 0;
                          setAmountInput(String(Math.round(n / 12)));
                          setIsMonthly(true);
                        }
                      }}
                      className={`px-2 py-0.5 text-[9px] font-black uppercase rounded ${
                        isMonthly ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500"
                      }`}
                    >
                      Monthly
                    </button>
                  </div>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">₹</span>
                  <Input
                    type="number"
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                    placeholder="e.g. 462000"
                    className="h-11 pl-8 font-black text-sm bg-white border-slate-300 focus-visible:ring-blue-600 rounded-xl"
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 mt-1.5 px-0.5">
                  <span>
                    Monthly: {isMonthly ? fmt(parseFloat(amountInput) || 0) : fmt((parseFloat(amountInput) || 0) / 12)}
                  </span>
                  <span>
                    Annual: {!isMonthly ? fmt(parseFloat(amountInput) || 0) : fmt((parseFloat(amountInput) || 0) * 12)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* STEP 2: State & Minimum Wage Rules */}
          <Card className="rounded-2xl border-slate-200 shadow-sm bg-white">
            <CardHeader className="p-5 pb-3 border-b border-slate-100">
              <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-black text-white">
                  2
                </span>
                State & Wage Code Minimums
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[10px] font-black uppercase text-slate-600">State / Location</Label>
                  <select
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="h-9 w-full mt-1 text-xs font-bold bg-white border border-slate-200 rounded-xl px-2.5 text-slate-900 shadow-2xs focus:outline-none focus:ring-1 focus:ring-blue-600"
                  >
                    {statesList.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label className="text-[10px] font-black uppercase text-slate-600">Wages Category</Label>
                  <select
                    value={wagesCategory}
                    onChange={(e) => setWagesCategory(e.target.value)}
                    className="h-9 w-full mt-1 text-xs font-bold bg-white border border-slate-200 rounded-xl px-2.5 text-slate-900 shadow-2xs focus:outline-none focus:ring-1 focus:ring-blue-600"
                  >
                    {categoriesList.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Minimum Wage Banner */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 block">
                    Statutory Floor Rate ({state} • {wagesCategory})
                  </span>
                  <span className="text-sm font-black text-blue-900">
                    {fmt(currentMinimumWage)} <span className="text-[10px] font-normal text-slate-500">/mo</span>
                  </span>
                </div>
                <Badge
                  className={`text-[9px] font-black uppercase tracking-wider ${
                    calcResult.meta.basicCalculatedOn === "Minimum Wage"
                      ? "bg-amber-100 text-amber-900 border border-amber-300"
                      : "bg-blue-100 text-blue-900 border border-blue-200"
                  }`}
                >
                  {calcResult.meta.basicCalculatedOn === "Minimum Wage" ? "⚡ Floor Override Active" : "✓ 50% Rule Met"}
                </Badge>
              </div>

              {/* Basic % & HRA % */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <Label className="text-[10px] font-black uppercase text-slate-600">Basic % of CTC</Label>
                  <div className="relative mt-1">
                    <Input
                      type="number"
                      step="0.01"
                      value={basicPct * 100}
                      onChange={(e) => setBasicPct((parseFloat(e.target.value) || 0) / 100)}
                      className="h-9 text-xs font-bold pr-7 bg-white border-slate-200"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">%</span>
                  </div>
                  <span className="text-[9px] text-slate-400 mt-0.5 block">Wage Code: Min 50%</span>
                </div>

                <div>
                  <Label className="text-[10px] font-black uppercase text-slate-600">HRA % of Basic</Label>
                  <div className="relative mt-1">
                    <Input
                      type="number"
                      step="0.01"
                      value={hraPct * 100}
                      onChange={(e) => setHraPct((parseFloat(e.target.value) || 0) / 100)}
                      className="h-9 text-xs font-bold pr-7 bg-white border-slate-200"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">%</span>
                  </div>
                  <span className="text-[9px] text-slate-400 mt-0.5 block">40% Non-Metro / 50% Metro</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* STEP 3: Statutory Benefit Toggles (PF, ESIC, Bonus, Gratuity) */}
          <Card className="rounded-2xl border-slate-200 shadow-sm bg-white">
            <CardHeader className="p-5 pb-3 border-b border-slate-100">
              <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-black text-white">
                  3
                </span>
                Statutory Deductions & Allowances
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4 text-xs">
              {/* PF Row */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-black text-slate-900 text-xs flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-blue-600" />
                    Provident Fund (PF)
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPfApplicable(true)}
                      className={`px-3 py-1 rounded-md text-[9px] font-black uppercase transition-colors cursor-pointer ${
                        pfApplicable ? "bg-blue-600 text-white" : "bg-white border text-slate-600"
                      }`}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => setPfApplicable(false)}
                      className={`px-3 py-1 rounded-md text-[9px] font-black uppercase transition-colors cursor-pointer ${
                        !pfApplicable ? "bg-slate-700 text-white" : "bg-white border text-slate-600"
                      }`}
                    >
                      No
                    </button>
                  </div>
                </div>
                {pfApplicable && (
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200 text-[11px]">
                    <div>
                      <span className="text-[9px] text-slate-500 font-bold block">Wage Limit (₹/mo)</span>
                      <Input
                        type="number"
                        value={pfWageLimit}
                        onChange={(e) => setPfWageLimit(parseFloat(e.target.value) || 0)}
                        className="h-8 text-xs font-bold bg-white mt-0.5"
                      />
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-500 font-bold block">Employer PF (13%) / Emp (12%)</span>
                      <span className="text-xs font-black text-slate-800 mt-2 block">13.00% / 12.00%</span>
                    </div>
                  </div>
                )}
              </div>

              {/* ESIC Row */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-black text-slate-900 text-xs block">ESIC (Employee State Insurance)</span>
                    <span className="text-[9px] text-slate-500 font-medium">Eligible if Gross ≤ ₹21,000/mo</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEsicApplicable(true)}
                      className={`px-3 py-1 rounded-md text-[9px] font-black uppercase transition-colors cursor-pointer ${
                        esicApplicable ? "bg-blue-600 text-white" : "bg-white border text-slate-600"
                      }`}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => setEsicApplicable(false)}
                      className={`px-3 py-1 rounded-md text-[9px] font-black uppercase transition-colors cursor-pointer ${
                        !esicApplicable ? "bg-slate-700 text-white" : "bg-white border text-slate-600"
                      }`}
                    >
                      No
                    </button>
                  </div>
                </div>
                {esicApplicable && (
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200 text-[11px]">
                    <div>
                      <span className="text-[9px] text-slate-500 font-bold block">Calculation Base</span>
                      <select
                        value={esicCalcBase}
                        onChange={(e) => setEsicCalcBase(e.target.value as "Basic" | "Gross")}
                        className="h-8 w-full text-xs font-bold bg-white border border-slate-200 rounded-md px-2 mt-0.5 text-slate-900"
                      >
                        <option value="Basic">Basic</option>
                        <option value="Gross">Gross</option>
                      </select>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-500 font-bold block">Rates</span>
                      <span className="text-xs font-black text-slate-800 mt-2 block">3.25% (Co) / 0.75% (Emp)</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Bonus Row */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-black text-slate-900 text-xs block">Annual Bonus (Statutory / Exgratia)</span>
                    <span className="text-[9px] text-slate-500 font-medium">Statutory up to ₹21k; Exgratia &gt; ₹21k</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setBonusApplicable(true)}
                      className={`px-3 py-1 rounded-md text-[9px] font-black uppercase transition-colors cursor-pointer ${
                        bonusApplicable ? "bg-blue-600 text-white" : "bg-white border text-slate-600"
                      }`}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => setBonusApplicable(false)}
                      className={`px-3 py-1 rounded-md text-[9px] font-black uppercase transition-colors cursor-pointer ${
                        !bonusApplicable ? "bg-slate-700 text-white" : "bg-white border text-slate-600"
                      }`}
                    >
                      No
                    </button>
                  </div>
                </div>
              </div>

              {/* Gratuity Row */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="font-black text-slate-900 text-xs block">Gratuity (4.81% of Basic)</span>
                  <span className="text-[9px] text-slate-500 font-medium">Standard 15 days per 26 workdays</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setGratuityApplicable(true)}
                    className={`px-3 py-1 rounded-md text-[9px] font-black uppercase transition-colors cursor-pointer ${
                      gratuityApplicable ? "bg-blue-600 text-white" : "bg-white border text-slate-600"
                    }`}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => setGratuityApplicable(false)}
                    className={`px-3 py-1 rounded-md text-[9px] font-black uppercase transition-colors cursor-pointer ${
                      !gratuityApplicable ? "bg-slate-700 text-white" : "bg-white border text-slate-600"
                    }`}
                  >
                    No
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN (Dual-Column Breakup Table) — 7 Cols */}
        <div className="lg:col-span-7 space-y-5">
          <Card className="rounded-2xl border-slate-200 shadow-sm bg-white overflow-hidden">
            <CardHeader className="p-5 pb-3 border-b border-slate-100 bg-slate-50/80">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-blue-600" />
                    Complete Salary Structure Breakup
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500 mt-0.5">
                    Basis: <strong className="text-slate-900">{basis}</strong> • Minimum Wage Floor:{" "}
                    <strong className="text-slate-900">{fmt(currentMinimumWage)}/mo</strong>
                  </CardDescription>
                </div>

                <div className="flex items-center gap-2">
                  <Badge className="bg-blue-100 text-blue-900 border border-blue-200 text-[10px] font-black uppercase">
                    Calculated on: {calcResult.meta.basicCalculatedOn}
                  </Badge>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {/* Negative Special Allowance Alert */}
              {calcResult.meta.isSpecialAllowanceNegative && (
                <div className="m-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
                  <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-black uppercase tracking-wide block">
                      ⚠ Negative Special Allowance Alert
                    </strong>
                    <span className="text-[11px] leading-relaxed">
                      At this CTC level, the State Minimum Wage ({fmt(currentMinimumWage)}/mo) forces Basic Salary higher than the total Gross Salary.
                    </span>
                  </div>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-100/60 text-[10px] font-black uppercase text-slate-600 tracking-wider">
                      <th className="py-2.5 px-4">Component</th>
                      <th className="py-2.5 px-4 text-right">Annual (₹)</th>
                      <th className="py-2.5 px-4 text-right">Monthly (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {/* SECTION 1: GROSS COMPENSATION */}
                    <tr className="bg-slate-50/70 font-black text-slate-900 text-[11px] uppercase tracking-wider">
                      <td colSpan={3} className="py-2 px-4 text-[#124479]">
                        Part A: Gross Salary Structure
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-bold text-slate-800">
                        Basic Salary
                        <span className="ml-2 text-[9px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                          {calcResult.meta.basicCalculatedOn}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right font-black text-slate-900">
                        {fmt(calcResult.annual.basic)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-black text-slate-900">
                        {fmt(calcResult.monthly.basic)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 px-4 text-slate-700 font-medium">HRA (House Rent Allowance)</td>
                      <td className="py-2 px-4 text-right font-semibold text-slate-800">
                        {fmt(calcResult.annual.hra)}
                      </td>
                      <td className="py-2 px-4 text-right font-semibold text-slate-800">
                        {fmt(calcResult.monthly.hra)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 px-4 text-slate-700 font-medium">Other Fixed Allowances (Conveyance/Medical)</td>
                      <td className="py-2 px-4 text-right font-semibold text-slate-800">
                        {fmt(calcResult.annual.otherFixed)}
                      </td>
                      <td className="py-2 px-4 text-right font-semibold text-slate-800">
                        {fmt(calcResult.monthly.otherFixed)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 px-4 font-medium text-slate-700">
                        Special Allowance (Balancing)
                        {calcResult.meta.isSpecialAllowanceNegative && (
                          <span className="ml-2 text-[9px] font-black text-rose-600 bg-rose-50 px-1 py-0.5 rounded">
                            Negative
                          </span>
                        )}
                      </td>
                      <td
                        className={`py-2 px-4 text-right font-bold ${
                          calcResult.meta.isSpecialAllowanceNegative ? "text-rose-600 font-black" : "text-slate-800"
                        }`}
                      >
                        {fmt(calcResult.annual.specialAllowance)}
                      </td>
                      <td
                        className={`py-2 px-4 text-right font-bold ${
                          calcResult.meta.isSpecialAllowanceNegative ? "text-rose-600 font-black" : "text-slate-800"
                        }`}
                      >
                        {fmt(calcResult.monthly.specialAllowance)}
                      </td>
                    </tr>
                    <tr className="bg-indigo-50/50 font-black text-indigo-950">
                      <td className="py-2.5 px-4 uppercase tracking-wide">Gross Salary (Part A Total)</td>
                      <td className="py-2.5 px-4 text-right font-black text-indigo-900">
                        {fmt(calcResult.annual.gross)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-black text-indigo-900">
                        {fmt(calcResult.monthly.gross)}
                      </td>
                    </tr>

                    {/* SECTION 2: EMPLOYER STATUTORY CONTRIBUTIONS */}
                    <tr className="bg-slate-50/70 font-black text-slate-900 text-[11px] uppercase tracking-wider">
                      <td colSpan={3} className="py-2 px-4 text-[#124479]">
                        Part B: Employer Statutory Benefits (Included in CTC)
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 px-4 text-slate-700 font-medium">Employer PF Contribution (13.00%)</td>
                      <td className="py-2 px-4 text-right font-semibold text-slate-800">
                        {fmt(calcResult.annual.employerPf)}
                      </td>
                      <td className="py-2 px-4 text-right font-semibold text-slate-800">
                        {fmt(calcResult.monthly.employerPf)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 px-4 text-slate-700 font-medium">Employer ESIC Contribution (3.25%)</td>
                      <td className="py-2 px-4 text-right font-semibold text-slate-800">
                        {fmt(calcResult.annual.employerEsic)}
                      </td>
                      <td className="py-2 px-4 text-right font-semibold text-slate-800">
                        {fmt(calcResult.monthly.employerEsic)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 px-4 text-slate-700 font-medium">Gratuity (4.81% on Basic)</td>
                      <td className="py-2 px-4 text-right font-semibold text-slate-800">
                        {fmt(calcResult.annual.gratuity)}
                      </td>
                      <td className="py-2 px-4 text-right font-semibold text-slate-800">
                        {fmt(calcResult.monthly.gratuity)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 px-4 text-slate-700 font-medium">
                        Annual Bonus (Statutory: ≤ ₹21k / Exgratia: &gt; ₹21k)
                      </td>
                      <td className="py-2 px-4 text-right font-semibold text-slate-800">
                        {fmt(calcResult.annual.statutoryBonus + calcResult.annual.exgratiaBonus)}
                      </td>
                      <td className="py-2 px-4 text-right font-semibold text-slate-800">
                        {fmt(calcResult.monthly.statutoryBonus + calcResult.monthly.exgratiaBonus)}
                      </td>
                    </tr>
                    <tr className="bg-blue-50/70 font-black text-blue-950">
                      <td className="py-2.5 px-4 uppercase tracking-wide">Total CTC (Cost to Company)</td>
                      <td className="py-2.5 px-4 text-right font-black text-blue-900">
                        {fmt(calcResult.annual.ctc)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-black text-blue-900">
                        {fmt(calcResult.monthly.ctc)}
                      </td>
                    </tr>

                    {/* SECTION 3: EMPLOYEE DEDUCTIONS */}
                    <tr className="bg-slate-50/70 font-black text-slate-900 text-[11px] uppercase tracking-wider">
                      <td colSpan={3} className="py-2 px-4 text-[#124479]">
                        Part C: Employee Deductions
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 px-4 text-slate-700 font-medium">Employee PF Contribution (12.00%)</td>
                      <td className="py-2 px-4 text-right font-semibold text-slate-800">
                        {fmt(calcResult.annual.employeePf)}
                      </td>
                      <td className="py-2 px-4 text-right font-semibold text-slate-800">
                        {fmt(calcResult.monthly.employeePf)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 px-4 text-slate-700 font-medium">Employee ESIC Contribution (0.75%)</td>
                      <td className="py-2 px-4 text-right font-semibold text-slate-800">
                        {fmt(calcResult.annual.employeeEsic)}
                      </td>
                      <td className="py-2 px-4 text-right font-semibold text-slate-800">
                        {fmt(calcResult.monthly.employeeEsic)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 px-4 text-slate-700 font-medium">
                        Professional Tax (PT — {state})
                      </td>
                      <td className="py-2 px-4 text-right font-semibold text-slate-800">
                        {fmt(calcResult.annual.pt)}
                      </td>
                      <td className="py-2 px-4 text-right font-semibold text-slate-800">
                        {fmt(calcResult.monthly.pt)}
                      </td>
                    </tr>
                    <tr className="bg-rose-50/50 font-black text-rose-950">
                      <td className="py-2.5 px-4 uppercase tracking-wide">Total Employee Deductions</td>
                      <td className="py-2.5 px-4 text-right font-black text-rose-900">
                        {fmt(calcResult.annual.totalDeductions)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-black text-rose-900">
                        {fmt(calcResult.monthly.totalDeductions)}
                      </td>
                    </tr>

                    {/* SECTION 4: NET IN-HAND SALARY */}
                    <tr className="bg-emerald-100/70 font-black text-emerald-950 border-t-2 border-emerald-300">
                      <td className="py-3 px-4 text-xs uppercase tracking-wider">
                        Net Take-Home Salary (In-Hand)
                      </td>
                      <td className="py-3 px-4 text-right text-sm font-black text-emerald-900">
                        {fmt(calcResult.annual.netTakeHome)}
                      </td>
                      <td className="py-3 px-4 text-right text-sm font-black text-emerald-900">
                        {fmt(calcResult.monthly.netTakeHome)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
