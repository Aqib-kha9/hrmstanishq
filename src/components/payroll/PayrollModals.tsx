import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    TrendingUp, Info, Wallet, ArrowUpRight, ChevronRight,
    ShieldCheck, CreditCard, UserCircle, CalendarCheck, Clock, Download,
    SlidersHorizontal, ShieldAlert, CheckCircle2, Loader2, Sparkles, Building2, Percent, Check, AlertCircle,
    Calendar, FileSpreadsheet, User, Filter, ArrowRight, CheckCircle, XCircle, Search
} from "lucide-react";
import { apiGet, apiPatch, apiPut } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { salaryToWords } from "@/lib/amount-to-words";

export function GlobalRulesSheet({
    isOpen, onOpenChange,
    selectedEmployee, setSelectedEmployee,
    globalRules, setGlobalRules,
    handleSalaryUpdate, calculateProductionNet,
    loadLedger
}: any) {
    // Local editable fields for selected employee
    const [fixedGross, setFixedGross] = useState<number>(0);
    const [hraApplicable, setHraApplicable] = useState<boolean>(true);
    const [pfApplicable, setPfApplicable] = useState<boolean>(true);
    const [pfCeiling, setPfCeiling] = useState<boolean>(true);
    const [pfContributionMode, setPfContributionMode] = useState<string>("shared");
    const [esicApplicable, setEsicApplicable] = useState<boolean>(false);
    const [ptApplicable, setPtApplicable] = useState<boolean>(true);
    const [performanceAllowance, setPerformanceAllowance] = useState<number>(0);
    const [specialAllowance, setSpecialAllowance] = useState<number>(0);
    const [conveyance, setConveyance] = useState<number>(0);
    const [medicalAllowance, setMedicalAllowance] = useState<number>(0);

    const [manualPayableDays, setManualPayableDays] = useState<string>("");
    const [leaveAdjustmentDays, setLeaveAdjustmentDays] = useState<number>(0);
    const [leaveCarryForwardDays, setLeaveCarryForwardDays] = useState<number>(0);
    const [adminNotes, setAdminNotes] = useState<string>("");

    const [previousArrears, setPreviousArrears] = useState<number>(0);
    const [bonus, setBonus] = useState<number>(0);
    const [incentive, setIncentive] = useState<number>(0);
    const [otherDeduction, setOtherDeduction] = useState<number>(0);

    const [saving, setSaving] = useState<boolean>(false);
    const [activeTab, setActiveTab] = useState<"structure" | "attendance" | "variable">("structure");

    useEffect(() => {
        if (selectedEmployee) {
            setFixedGross(Number(selectedEmployee.fixedGross ?? selectedEmployee.fixed_gross) || 0);
            setHraApplicable((selectedEmployee.hraApplicable ?? selectedEmployee.hra_applicable) !== false);
            setPfApplicable((selectedEmployee.pfApplicable ?? selectedEmployee.pf_applicable) !== false);
            setPfCeiling((selectedEmployee.pfCeiling ?? selectedEmployee.pf_ceiling) !== false);
            setPfContributionMode(selectedEmployee.pfContributionMode ?? selectedEmployee.pf_contribution_mode ?? "shared");
            setEsicApplicable(Boolean(selectedEmployee.esicApplicable ?? selectedEmployee.esic_applicable));
            setPtApplicable((selectedEmployee.ptApplicable ?? selectedEmployee.pt_applicable) !== false);
            setPerformanceAllowance(Number(selectedEmployee.performanceAllowance ?? selectedEmployee.performance_allowance) || 0);
            setSpecialAllowance(Number(selectedEmployee.specialAllowance ?? selectedEmployee.special_allowance) || 0);
            setConveyance(Number(selectedEmployee.conveyance) || 0);
            setMedicalAllowance(Number(selectedEmployee.medicalAllowance ?? selectedEmployee.medical_allowance) || 0);

            const mPayable = selectedEmployee.manualPayableDays ?? selectedEmployee.manual_payable_days;
            setManualPayableDays(mPayable !== null && mPayable !== undefined ? String(mPayable) : "");
            setLeaveAdjustmentDays(Number(selectedEmployee.leaveAdjustmentDays ?? selectedEmployee.leave_adjustment_days) || 0);
            setLeaveCarryForwardDays(Number(selectedEmployee.leaveCarryForwardDays ?? selectedEmployee.leave_carry_forward_days) || 0);
            setAdminNotes(selectedEmployee.adminNotes ?? selectedEmployee.admin_notes ?? "");

            setPreviousArrears(Number(selectedEmployee.previousArrears ?? selectedEmployee.previous_arrears) || 0);
            setBonus(Number(selectedEmployee.bonus) || 0);
            setIncentive(Number(selectedEmployee.incentive) || 0);
            setOtherDeduction(Number(selectedEmployee.otherDeduction ?? selectedEmployee.other_deduction) || 0);
            setActiveTab("structure");
        }
    }, [selectedEmployee, isOpen]);

    // Live calculation for the drawer
    const calc = (() => {
        const dynamicDays = Number(selectedEmployee?.dynamicDays) || 30;
        const elapsedDays = selectedEmployee?.elapsedDays != null ? Math.min(Number(selectedEmployee.elapsedDays), dynamicDays) : dynamicDays;
        const absentDays = Number(selectedEmployee?.absentDays ?? selectedEmployee?.absent_days ?? 0);
        const effectiveAbsent = Math.max(0, absentDays + leaveAdjustmentDays - leaveCarryForwardDays);

        const hasManual = manualPayableDays !== "" && !isNaN(Number(manualPayableDays));
        const payableDays = hasManual
            ? Math.max(0, Math.min(dynamicDays, Number(manualPayableDays)))
            : Math.max(0, elapsedDays - effectiveAbsent);

        // 50% Basic Salary formula (Req 2.4)
        const basicSalary = Math.round(fixedGross * 0.50);
        const hra = hraApplicable ? Math.round(basicSalary * 0.40) : 0;
        const otherAllowance = Math.max(0, fixedGross - (basicSalary + hra + conveyance + medicalAllowance + specialAllowance + performanceAllowance));

        // Prorated components
        const pBasic = Math.round((basicSalary / dynamicDays) * payableDays);
        const pHra = Math.round((hra / dynamicDays) * payableDays);
        const pConv = Math.round((conveyance / dynamicDays) * payableDays);
        const pMed = Math.round((medicalAllowance / dynamicDays) * payableDays);
        const pSpec = Math.round((specialAllowance / dynamicDays) * payableDays);
        const pPerf = Math.round((performanceAllowance / dynamicDays) * payableDays);
        const pOther = Math.round((otherAllowance / dynamicDays) * payableDays);

        const proratedGross = pBasic + pHra + pConv + pMed + pSpec + pPerf + pOther;
        const totalEarnings = proratedGross + previousArrears + bonus + incentive;

        // PF
        let pf = 0;
        let pfEmployer = 0;
        if (pfApplicable) {
            const pfBase = pfCeiling ? Math.min(pBasic, 15000) : pBasic;
            if (pfContributionMode === "shared" || pfContributionMode === "employee_only") {
                pf = Math.round(pfBase * 0.12);
            }
            if (pfContributionMode === "shared" || pfContributionMode === "employer_only") {
                pfEmployer = Math.round(pfBase * 0.12);
            }
        }

        // ESI (threshold: fixedGross <= 21000)
        let esi = 0;
        let esiEmployer = 0;
        if (esicApplicable && fixedGross <= 21000) {
            esi = Math.ceil(totalEarnings * 0.0075);
            esiEmployer = Math.ceil(totalEarnings * 0.0325);
        }

        // PT
        let pt = 0;
        if (ptApplicable) {
            if (fixedGross > 33333) pt = 208;
            else if (fixedGross > 25000) pt = 150;
            else if (fixedGross > 15000) pt = 100;
        }

        const loanDeduction = Number(selectedEmployee?.loanDeduction) || 0;
        const grossDeductions = pf + esi + pt + loanDeduction + otherDeduction;
        const net = Math.max(0, totalEarnings - grossDeductions);
        const lop = Math.round((fixedGross / dynamicDays) * (dynamicDays - payableDays));

        return {
            dynamicDays,
            elapsedDays,
            absentDays,
            effectiveAbsent,
            payableDays,
            hasManual,
            basicSalary,
            hra,
            otherAllowance,
            proratedGross,
            totalEarnings,
            pf,
            pfEmployer,
            esi,
            esiEmployer,
            pt,
            loanDeduction,
            grossDeductions,
            net,
            lop
        };
    })();

    const handleSave = async () => {
        if (!selectedEmployee) return;
        setSaving(true);
        try {
            // 1. Update Payroll Entry
            const entryPayload: any = {
                manual_payable_days: manualPayableDays === "" ? null : Number(manualPayableDays),
                leave_adjustment_days: leaveAdjustmentDays,
                leave_carry_forward_days: leaveCarryForwardDays,
                admin_notes: adminNotes.trim(),
                bonus: bonus,
                previous_arrears: previousArrears,
                incentive: incentive,
                other_deduction: otherDeduction
            };
            await apiPatch(`/payroll/entry/${selectedEmployee.id}`, entryPayload);

            // 2. Update Employee Salary Structure (if employeeId exists)
            const empId = selectedEmployee.employeeId || selectedEmployee.employee_id;
            if (empId) {
                const salaryPayload: any = {
                    fixed_gross: fixedGross,
                    hra_applicable: hraApplicable,
                    pf_applicable: pfApplicable,
                    pf_ceiling: pfCeiling,
                    pf_contribution_mode: pfContributionMode,
                    esic_applicable: esicApplicable,
                    pt_applicable: ptApplicable,
                    performance_allowance: performanceAllowance,
                    special_allowance: specialAllowance,
                    conveyance: conveyance,
                    medical_allowance: medicalAllowance
                };
                await apiPut(`/employees/${empId}/salary`, salaryPayload);
            }

            if (loadLedger) await loadLedger();
            onOpenChange(false);
        } catch (err: any) {
            console.error("Failed to save payroll configuration:", err);
            alert(err?.response?.data?.message || "Failed to save payroll configuration");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Sheet open={isOpen} onOpenChange={(open) => {
            onOpenChange(open);
            if (!open) setSelectedEmployee(null);
        }}>
            <SheetContent className="sm:max-w-[620px] w-full p-0 flex flex-col h-full max-h-screen bg-white border-l border-slate-200 shadow-2xl">
                {/* Pinned Header */}
                <div className="shrink-0 px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-indigo-50 border border-indigo-100/80 flex items-center justify-center text-indigo-600 shrink-0">
                            <SlidersHorizontal className="h-5 w-5" />
                        </div>
                        <div>
                            <SheetTitle className="text-base font-bold text-slate-900 tracking-tight">
                                {selectedEmployee ? `Configure: ${selectedEmployee.name}` : "Global Salary Rules"}
                            </SheetTitle>
                            {selectedEmployee ? (
                                <SheetDescription className="text-xs text-slate-500 font-normal mt-0.5">
                                    {selectedEmployee.employeeCode} • {selectedEmployee.designation || 'Staff'} • {selectedEmployee.department || 'Operations'} • {selectedEmployee.company || 'Company Entity'}
                                </SheetDescription>
                            ) : (
                                <SheetDescription className="text-xs text-slate-500 font-normal mt-0.5">
                                    Define global PF, ESI, and monthly cycle configuration
                                </SheetDescription>
                            )}
                        </div>
                    </div>
                    {selectedEmployee && (
                        <Badge variant="outline" className="text-[11px] font-semibold text-slate-600 bg-slate-50 border-slate-200 px-2.5 py-1">
                            {selectedEmployee.location || "Indore HQ"}
                        </Badge>
                    )}
                </div>

                    {selectedEmployee ? (
                    <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                        {/* Tabs Navigation */}
                        <div className="flex border-b border-slate-200 gap-1 pb-1">
                            <button
                                type="button"
                                onClick={() => setActiveTab("structure")}
                                className={cn(
                                    "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all",
                                    activeTab === "structure"
                                        ? "bg-slate-900 text-white"
                                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                                )}
                            >
                                CTC & Compliance
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab("attendance")}
                                className={cn(
                                    "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all",
                                    activeTab === "attendance"
                                        ? "bg-slate-900 text-white"
                                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                                )}
                            >
                                Attendance Control
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab("variable")}
                                className={cn(
                                    "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all",
                                    activeTab === "variable"
                                        ? "bg-slate-900 text-white"
                                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                                )}
                            >
                                Arrears & Deductions
                            </button>
                        </div>

                        {/* TAB 1: CTC & Statutory Compliance */}
                        {activeTab === "structure" && (
                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-xs font-semibold text-slate-800">Monthly Fixed CTC / Gross (₹)</Label>
                                        <span className="text-[10px] text-slate-400">Annual: ₹{(fixedGross * 12).toLocaleString()}</span>
                                    </div>
                                    <Input
                                        type="number"
                                        value={fixedGross || ""}
                                        onChange={(e) => setFixedGross(parseFloat(e.target.value) || 0)}
                                        placeholder="Enter monthly CTC (e.g. 50000)"
                                        className="h-11 rounded-xl bg-slate-50 border-slate-200 text-sm font-bold text-slate-900 focus:bg-white"
                                    />
                                    <p className="text-[11px] text-slate-500">
                                        Standard Indian CTC Structure: Basic is automatically computed as 50% of Fixed CTC.
                                    </p>
                                </div>

                                {/* Computed Structure Card */}
                                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                                        <span>Standard Earnings Breakdown</span>
                                        <span className="text-[11px] text-indigo-600 font-medium">Monthly CTC: ₹{fixedGross.toLocaleString()}</span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-3 pt-1 text-xs">
                                        <div className="p-2.5 rounded-lg bg-white border border-slate-100">
                                            <span className="text-[10px] text-slate-400 block uppercase font-medium">Basic (50%)</span>
                                            <span className="font-bold text-slate-800 text-sm">₹{calc.basicSalary.toLocaleString()}</span>
                                        </div>
                                        <div className="p-2.5 rounded-lg bg-white border border-slate-100">
                                            <span className="text-[10px] text-slate-400 block uppercase font-medium">HRA ({hraApplicable ? "40%" : "0%"})</span>
                                            <span className="font-bold text-slate-800 text-sm">₹{calc.hra.toLocaleString()}</span>
                                        </div>
                                        <div className="p-2.5 rounded-lg bg-white border border-slate-100">
                                            <span className="text-[10px] text-slate-400 block uppercase font-medium">Other / Special</span>
                                            <span className="font-bold text-slate-800 text-sm">₹{calc.otherAllowance.toLocaleString()}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Statutory Toggles */}
                                <div className="space-y-3 pt-2">
                                    <Label className="text-xs font-semibold text-slate-800 block">Statutory Compliance Rules</Label>
                                    
                                    {/* HRA */}
                                    <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer transition-all">
                                        <div>
                                            <span className="text-xs font-semibold text-slate-800 block">House Rent Allowance (HRA)</span>
                                            <span className="text-[11px] text-slate-500">40% of Basic salary component</span>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={hraApplicable}
                                            onChange={(e) => setHraApplicable(e.target.checked)}
                                            className="h-4 w-4 rounded text-slate-900 border-slate-300 focus:ring-slate-900 cursor-pointer"
                                        />
                                    </label>

                                    {/* PF Configuration */}
                                    <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <span className="text-xs font-semibold text-slate-800 block">Provident Fund (PF)</span>
                                                <span className="text-[11px] text-slate-500">12% on Basic (deduction ₹{calc.pf.toLocaleString()})</span>
                                            </div>
                                            <input
                                                type="checkbox"
                                                checked={pfApplicable}
                                                onChange={(e) => setPfApplicable(e.target.checked)}
                                                className="h-4 w-4 rounded text-slate-900 border-slate-300 focus:ring-slate-900 cursor-pointer"
                                            />
                                        </div>

                                        {pfApplicable && (
                                            <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-3 text-xs">
                                                <div>
                                                    <Label className="text-[10px] font-semibold text-slate-500 uppercase block mb-1">Cap Basic at ₹15,000</Label>
                                                    <select
                                                        value={pfCeiling ? "yes" : "no"}
                                                        onChange={(e) => setPfCeiling(e.target.value === "yes")}
                                                        className="w-full h-9 rounded-lg border border-slate-200 px-2.5 text-xs bg-slate-50 font-medium"
                                                    >
                                                        <option value="yes">Yes (Statutory ₹15k Cap)</option>
                                                        <option value="no">No (Uncapped 12% on Full Basic)</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <Label className="text-[10px] font-semibold text-slate-500 uppercase block mb-1">Contribution Mode</Label>
                                                    <select
                                                        value={pfContributionMode}
                                                        onChange={(e) => setPfContributionMode(e.target.value)}
                                                        className="w-full h-9 rounded-lg border border-slate-200 px-2.5 text-xs bg-slate-50 font-medium"
                                                    >
                                                        <option value="shared">Shared (Emp 12% + Empr 12%)</option>
                                                        <option value="employee_only">Employee Only (12%)</option>
                                                        <option value="employer_only">Employer Only (12%)</option>
                                                    </select>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* ESIC */}
                                    <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer transition-all">
                                        <div>
                                            <span className="text-xs font-semibold text-slate-800 block">ESIC Applicable</span>
                                            <span className="text-[11px] text-slate-500">0.75% Employee + 3.25% Employer (deduction ₹{calc.esi.toLocaleString()})</span>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={esicApplicable}
                                            onChange={(e) => setEsicApplicable(e.target.checked)}
                                            className="h-4 w-4 rounded text-slate-900 border-slate-300 focus:ring-slate-900 cursor-pointer"
                                        />
                                    </label>

                                    {/* Professional Tax (PT) */}
                                    <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer transition-all">
                                        <div>
                                            <span className="text-xs font-semibold text-slate-800 block">Professional Tax (PT)</span>
                                            <span className="text-[11px] text-slate-500">Standard state PT slab deduction (₹{calc.pt})</span>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={ptApplicable}
                                            onChange={(e) => setPtApplicable(e.target.checked)}
                                            className="h-4 w-4 rounded text-slate-900 border-slate-300 focus:ring-slate-900 cursor-pointer"
                                        />
                                    </label>
                                </div>
                            </div>
                        )}

                        {/* TAB 2: Attendance Control (Req 4.1, 4.2 & 10) */}
                        {activeTab === "attendance" && (
                            <div className="space-y-4">
                                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 leading-relaxed">
                                    <p className="font-semibold text-slate-900 mb-0.5">Admin Discretion Policy (Req 10):</p>
                                    Unapproved or pending leaves never auto-deduct salary. The Admin has full authority to override payable days, deduct this cycle, or carry forward deductions.
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold text-slate-700">Muster Absent Days</Label>
                                        <Input
                                            disabled
                                            value={selectedEmployee.absentDays || 0}
                                            className="h-10 rounded-xl bg-slate-100 border-slate-200 font-bold text-xs text-slate-600 cursor-not-allowed"
                                        />
                                        <p className="text-[10px] text-slate-400">Live attendance sync</p>
                                    </div>
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-xs font-semibold text-slate-700">Payable Days Override</Label>
                                            <Badge variant="outline" className="text-[9px] bg-amber-50 text-amber-800 border-amber-200 px-1 py-0">Req 4.1</Badge>
                                        </div>
                                        <Input
                                            type="number"
                                            step="0.5"
                                            placeholder={`Auto: ${calc.payableDays}`}
                                            value={manualPayableDays}
                                            onChange={(e) => setManualPayableDays(e.target.value)}
                                            className="h-10 rounded-xl bg-white border-slate-200 font-bold text-xs text-slate-900 focus:border-slate-900"
                                        />
                                        <p className="text-[10px] text-slate-400">Leave blank for automatic calculation</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3 pt-2">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold text-slate-700">Deduct Now (Days)</Label>
                                        <Input
                                            type="number"
                                            step="0.5"
                                            value={leaveAdjustmentDays || ""}
                                            onChange={(e) => setLeaveAdjustmentDays(parseFloat(e.target.value) || 0)}
                                            placeholder="0"
                                            className="h-10 rounded-xl bg-white border-slate-200 font-bold text-xs text-slate-900"
                                        />
                                        <p className="text-[10px] text-slate-400">Deduct from this cycle</p>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold text-slate-700">Carry Forward (Days)</Label>
                                        <Input
                                            type="number"
                                            step="0.5"
                                            value={leaveCarryForwardDays || ""}
                                            onChange={(e) => setLeaveCarryForwardDays(parseFloat(e.target.value) || 0)}
                                            placeholder="0"
                                            className="h-10 rounded-xl bg-white border-slate-200 font-bold text-xs text-slate-900"
                                        />
                                        <p className="text-[10px] text-slate-400">Defer deduction to next cycle</p>
                                    </div>
                                </div>

                                <div className="space-y-1.5 pt-2">
                                    <Label className="text-xs font-semibold text-slate-700">Admin Audit Reason / Note</Label>
                                    <Input
                                        placeholder="Reason for adjustment (e.g. approved medical waiver)"
                                        value={adminNotes}
                                        onChange={(e) => setAdminNotes(e.target.value)}
                                        className="h-10 rounded-xl bg-white border-slate-200 text-xs"
                                    />
                                </div>
                            </div>
                        )}

                        {/* TAB 3: Variable & Recoveries */}
                        {activeTab === "variable" && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold text-slate-700">Previous Arrears (₹)</Label>
                                        <Input
                                            type="number"
                                            value={previousArrears || ""}
                                            onChange={(e) => setPreviousArrears(parseFloat(e.target.value) || 0)}
                                            placeholder="0"
                                            className="h-10 rounded-xl bg-white border-slate-200 font-bold text-xs text-slate-900"
                                        />
                                        <p className="text-[10px] text-slate-400">One-time addition</p>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold text-slate-700">Bonus (₹)</Label>
                                        <Input
                                            type="number"
                                            value={bonus || ""}
                                            onChange={(e) => setBonus(parseFloat(e.target.value) || 0)}
                                            placeholder="0"
                                            className="h-10 rounded-xl bg-white border-slate-200 font-bold text-xs text-slate-900"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold text-slate-700">Incentive / Performance (₹)</Label>
                                        <Input
                                            type="number"
                                            value={incentive || ""}
                                            onChange={(e) => setIncentive(parseFloat(e.target.value) || 0)}
                                            placeholder="0"
                                            className="h-10 rounded-xl bg-white border-slate-200 font-bold text-xs text-slate-900"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold text-slate-700">Other Deductions / Fine (₹)</Label>
                                        <Input
                                            type="number"
                                            value={otherDeduction || ""}
                                            onChange={(e) => setOtherDeduction(parseFloat(e.target.value) || 0)}
                                            placeholder="0"
                                            className="h-10 rounded-xl bg-white border-slate-200 font-bold text-xs text-slate-900"
                                        />
                                        <p className="text-[10px] text-slate-400">Manual recovery</p>
                                    </div>
                                </div>

                                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="font-semibold text-slate-700">Loan / Advance EMI:</span>
                                        <span className="font-bold text-slate-900">₹{(selectedEmployee.loanDeduction || 0).toLocaleString()}</span>
                                    </div>
                                    <p className="text-[11px] text-slate-400">Automatically synced from active loan schedule.</p>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    /* Global Rules Fallback */
                    <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
                            These default rules apply to any employee without explicit custom contract terms.
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label className="text-xs font-semibold text-slate-700">Employer PF %</Label>
                                <Input
                                    type="number"
                                    value={globalRules.pfEmployer}
                                    onChange={(e) => setGlobalRules({ ...globalRules, pfEmployer: parseInt(e.target.value) || 0 })}
                                    className="h-10 rounded-xl"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs font-semibold text-slate-700">Employee PF %</Label>
                                <Input
                                    type="number"
                                    value={globalRules.pfEmployee}
                                    onChange={(e) => setGlobalRules({ ...globalRules, pfEmployee: parseInt(e.target.value) || 0 })}
                                    className="h-10 rounded-xl"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Pinned Bottom Matrix & Footer */}
                <div className="shrink-0 px-6 py-4 border-t border-slate-200 bg-white space-y-3">
                    {selectedEmployee && (
                        <div className="p-3.5 rounded-xl bg-slate-900 text-white">
                            <div className="grid grid-cols-3 gap-2 text-center">
                                <div className="border-r border-slate-800 pr-2">
                                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Payable Days</span>
                                    <span className="text-sm font-bold text-white">{calc.payableDays} / {selectedEmployee.dynamicDays || 30}</span>
                                </div>
                                <div className="border-r border-slate-800 px-2">
                                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Gross Payable</span>
                                    <span className="text-sm font-bold text-white">₹{calc.proratedGross.toLocaleString()}</span>
                                </div>
                                <div className="pl-2">
                                    <span className="text-[10px] text-emerald-400 uppercase font-semibold block">Net In-Hand</span>
                                    <span className="text-base font-bold text-emerald-400">₹{calc.net.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex items-center gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            className="flex-1 h-11 rounded-xl border-slate-200 font-semibold text-xs text-slate-700"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            disabled={saving}
                            onClick={handleSave}
                            className="flex-1 h-11 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-sm flex items-center justify-center gap-2"
                        >
                            {saving ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin text-white" />
                                    Saving...
                                </>
                            ) : (
                                "Save Configuration"
                            )}
                        </Button>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}

export function DisbursementDialog({
    isOpen, onOpenChange,
    disbursementStep, setDisbursementStep,
    txDetails, setTxDetails,
    ledger, calculateProductionNet,
    handleDisburseAll
}: any) {
    return (
        <Dialog open={isOpen} onOpenChange={(open) => {
            onOpenChange(open);
            if (!open) setDisbursementStep(1);
        }}>
            <DialogContent className="sm:max-w-[480px] border-none shadow-2xl rounded-[2.5rem] p-10 overflow-hidden">
                {disbursementStep === 1 ? (
                    <div className="animate-in fade-in slide-in-from-right-5 duration-300">
                        <div className="h-16 w-16 rounded-[1.2rem] bg-[#D9F99D] flex items-center justify-center mx-auto mb-6 shadow-xl group">
                            <Wallet className="h-8 w-8 text-slate-900 group-hover:scale-110 transition-transform" />
                        </div>
                        <DialogHeader className="text-center space-y-3">
                            <DialogTitle className="text-3xl font-black italic uppercase text-slate-900 tracking-tighter mx-auto">Review Cycle</DialogTitle>
                            <DialogDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] leading-loose mx-auto">
                                Confirming payout for <span className="text-slate-900 font-black italic">{ledger.length} Staff Members</span>
                            </DialogDescription>
                        </DialogHeader>

                        <div className="my-8 p-8 rounded-[2rem] bg-slate-50 text-slate-900 relative overflow-hidden border border-slate-100 shadow-xl">
                            <div className="absolute top-0 right-0 p-6 opacity-[0.03]">
                                <ArrowUpRight className="h-16 w-16 text-slate-900" />
                            </div>
                            <div className="grid grid-cols-2 gap-6 text-left relative z-10">
                                <div>
                                    <p className="text-[8px] font-black uppercase text-slate-400 tracking-[0.2em] mb-2">Total Gross</p>
                                    <p className="text-xl font-black italic text-slate-900 tracking-tighter">₹{ledger.reduce((acc: any, curr: any) => acc + calculateProductionNet(curr).totalEarnings, 0).toLocaleString()}</p>
                                </div>
                                <div className="text-right border-l border-slate-200 pl-6">
                                    <p className="text-[8px] font-black uppercase text-rose-400 tracking-[0.2em] mb-2">Deductions</p>
                                    <p className="text-xl font-black italic text-rose-500 tracking-tighter">
                                        -₹{ledger.reduce((acc: any, curr: any) => {
                                            const res = calculateProductionNet(curr);
                                            return acc + res.pf + res.pt + res.esi;
                                        }, 0).toLocaleString()}
                                    </p>
                                </div>
                            </div>
                            <div className="mt-8 pt-8 border-t border-slate-200">
                                <p className="text-[9px] font-black uppercase text-emerald-600 tracking-[0.3em] mb-2">Net Funds to Disburse</p>
                                <h4 className="text-4xl font-black italic tracking-tighter text-slate-900">₹{ledger.reduce((acc: any, curr: any) => acc + calculateProductionNet(curr).net, 0).toLocaleString()}</h4>
                            </div>
                        </div>

                        <div className="flex flex-col gap-4">
                            <Button
                                onClick={() => setDisbursementStep(2)}
                                className="w-full h-14 rounded-2xl bg-slate-900 text-white font-black uppercase text-[10px] tracking-[0.2em] shadow-xl hover:translate-y-[-2px] transition-all flex items-center justify-center gap-3"
                            >
                                Verify & Finalize <ChevronRight className="h-5 w-5" />
                            </Button>
                            <button onClick={() => onOpenChange(false)} className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400 hover:text-slate-600 transition-colors py-2">
                                No, Cancel Transaction
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="animate-in fade-in slide-in-from-right-5 duration-300">
                        <div className="h-16 w-16 rounded-[1.2rem] bg-indigo-50 flex items-center justify-center mx-auto mb-6">
                            <ShieldCheck className="h-8 w-8 text-indigo-600" />
                        </div>
                        <DialogHeader className="text-center space-y-3 mb-8">
                            <DialogTitle className="text-2xl font-black italic uppercase text-slate-900 tracking-tighter mx-auto">Audit Details</DialogTitle>
                            <DialogDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] leading-loose mx-auto text-center">
                                Mandatory fields for production ledger audit
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-5 mb-10">
                            <div className="space-y-1.5">
                                <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Payment Mode</Label>
                                <Select value={txDetails.mode} onValueChange={(v) => setTxDetails({ ...txDetails, mode: v })}>
                                    <SelectTrigger className="h-12 rounded-xl bg-slate-50 border-none font-bold text-[11px] px-6">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="border-none rounded-xl shadow-2xl">
                                        <SelectItem value="NEFT/RTGS" className="font-bold text-xs uppercase italic">NEFT / RTGS (Manual)</SelectItem>
                                        <SelectItem value="Bulk UPI" className="font-bold text-xs uppercase italic">Bulk UPI Transfer</SelectItem>
                                        <SelectItem value="Manual/Cash" className="font-bold text-xs uppercase italic">Manual Disbursement</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Reference / Batch ID</Label>
                                <Input
                                    value={txDetails.reference}
                                    onChange={(e) => setTxDetails({ ...txDetails, reference: e.target.value })}
                                    className="h-12 rounded-xl bg-slate-50 border-none font-bold text-[11px] px-6"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Authorized By</Label>
                                <Input
                                    value={txDetails.authorizedBy}
                                    onChange={(e) => setTxDetails({ ...txDetails, authorizedBy: e.target.value })}
                                    className="h-12 rounded-xl bg-slate-50 border-none font-bold text-[11px] px-6"
                                />
                            </div>
                            <div className="flex items-center gap-2.5 pt-2 px-1">
                                <input
                                    type="checkbox"
                                    id="sendEmailsToggle"
                                    checked={txDetails.sendEmails !== false}
                                    onChange={(e) => setTxDetails({ ...txDetails, sendEmails: e.target.checked })}
                                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                />
                                <Label htmlFor="sendEmailsToggle" className="text-[10px] font-bold text-slate-700 cursor-pointer select-none">
                                    Automatically email PDF salary slips to all employees upon payout
                                </Label>
                            </div>
                        </div>

                        <div className="flex flex-col gap-4">
                            <Button
                                onClick={handleDisburseAll}
                                className="w-full h-14 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-black uppercase text-[10px] tracking-[0.2em] shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3"
                            >
                                <CreditCard className="h-5 w-5" /> Release Funds Now
                            </Button>
                            <button onClick={() => setDisbursementStep(1)} className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400 hover:text-slate-600 transition-colors py-2">
                                Back to Summary
                            </button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

export function EmployeeHistoryDialog({
    isOpen,
    onOpenChange,
    selectedEmployee,
    allEmployees = [],
    onSelectEmployee
}: {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    selectedEmployee: any;
    allEmployees?: any[];
    onSelectEmployee?: (emp: any) => void;
}) {
    const [history, setHistory] = useState<any[]>([]);
    const [periodAnalysis, setPeriodAnalysis] = useState<any | null>(null);
    const [employeeDetails, setEmployeeDetails] = useState<any | null>(null);
    const [loading, setLoading] = useState(false);

    // Duration filter: 30, 60, 90, 180, 365, or custom
    const [durationPreset, setDurationPreset] = useState<string>("30");

    // Initialize custom date range with past 30 days
    const getDefaultDates = () => {
        const today = new Date();
        const past = new Date();
        past.setDate(today.getDate() - 29);
        const format = (d: Date) => d.toISOString().split("T")[0];
        return { from: format(past), to: format(today) };
    };

    const [customFrom, setCustomFrom] = useState<string>(() => getDefaultDates().from);
    const [customTo, setCustomTo] = useState<string>(() => getDefaultDates().to);
    const [timelineFilter, setTimelineFilter] = useState<string>("ALL");
    const [activeTab, setActiveTab] = useState<string>("timeline");

    const fetchHistory = async (empId: number | string, params: { days?: string; from?: string; to?: string }) => {
        if (!empId) return;
        setLoading(true);
        try {
            const queryParts: string[] = [];
            if (params.from && params.to) {
                queryParts.push(`from=${encodeURIComponent(params.from)}`);
                queryParts.push(`to=${encodeURIComponent(params.to)}`);
            } else if (params.days) {
                queryParts.push(`days=${encodeURIComponent(params.days)}`);
            }
            const qs = queryParts.length > 0 ? `?${queryParts.join("&")}` : "";
            const res: any = await apiGet(`/payroll/employee/${empId}/history${qs}`);

            if (res && res.employee) {
                setEmployeeDetails(res.employee);
                setPeriodAnalysis(res.periodAnalysis || null);
                setHistory(res.history || []);
            } else if (Array.isArray(res)) {
                setHistory(res);
                setPeriodAnalysis(null);
                setEmployeeDetails(null);
            } else {
                setHistory([]);
                setPeriodAnalysis(null);
                setEmployeeDetails(null);
            }
        } catch (e) {
            console.error("Failed to load employee salary history:", e);
            setHistory([]);
            setPeriodAnalysis(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!isOpen || !selectedEmployee) return;
        const empId = selectedEmployee.employeeId || selectedEmployee.id;
        if (durationPreset === "custom") {
            fetchHistory(empId, { from: customFrom, to: customTo });
        } else {
            fetchHistory(empId, { days: durationPreset });
        }
    }, [isOpen, selectedEmployee, durationPreset]);

    const handleApplyCustomRange = () => {
        if (!selectedEmployee) return;
        const empId = selectedEmployee.employeeId || selectedEmployee.id;
        fetchHistory(empId, { from: customFrom, to: customTo });
    };

    const handleEmployeeChange = (newIdStr: string) => {
        const found = allEmployees.find(e => String(e.employeeId || e.id) === newIdStr);
        if (found && onSelectEmployee) {
            onSelectEmployee(found);
        }
    };

    const handleExportCSV = () => {
        if (!periodAnalysis?.timeline || periodAnalysis.timeline.length === 0) return;
        const empName = (employeeDetails?.name || selectedEmployee?.name || "Employee").replace(/\s+/g, "_");
        const headers = ["Date", "Day", "Status", "In Time", "Out Time", "Hours Logged", "Payable Day Credit", "Daily Earned (INR)"];
        const rows = periodAnalysis.timeline.map((t: any) => [
            t.date,
            t.day,
            t.status?.toUpperCase(),
            t.checkIn || "--",
            t.checkOut || "--",
            t.totalHours || 0,
            t.payableCredit,
            t.dailyEarned
        ]);
        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r: any[]) => r.join(","))].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Salary_Log_${empName}_${periodAnalysis.from}_to_${periodAnalysis.to}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDownload = async (row: any) => {
        try {
            const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
            const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
            const res = await fetch(`${apiBase}/payroll/entry/${row.id}/pdf`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Payslip_${selectedEmployee?.name?.replace(/\s+/g, '_') || 'Staff'}_${row.month?.replace(/\s+/g, '_') || 'Cycle'}.pdf`;
                a.click();
                window.URL.revokeObjectURL(url);
                return;
            }
        } catch (_) {}

        const doc = new jsPDF({ orientation: 'l', unit: 'mm', format: 'a5' });

        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
            const tempImg = new Image();
            tempImg.src = '/company_logopng.png';
            tempImg.onload = () => resolve(tempImg);
            tempImg.onerror = (e) => reject(e);
        }).catch(() => null);

        const pNet = row;
        const cycleText = row.month;

        const primaryColor: [number, number, number] = [15, 23, 42];
        const accentColor: [number, number, number] = [37, 99, 235];
        const textColor: [number, number, number] = [30, 30, 30];
        const mutedColor: [number, number, number] = [100, 100, 100];
        const lineColor: [number, number, number] = [226, 232, 240];

        doc.setFillColor(...accentColor);
        doc.rect(0, 0, 210, 4, 'F');

        if (img) {
            doc.addImage(img, 'PNG', 15, 6, 28, 12);
        } else {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(20);
            doc.setTextColor(...primaryColor);
            doc.text("NODE HRMS", 15, 18);
        }

        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...textColor);
        doc.text(row.company || "Apaar Logistics Pvt Ltd", 195, 15, { align: "right" });
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...mutedColor);
        doc.text(row.location || "Corporate Office: Mumbai, India", 195, 20, { align: "right" });

        doc.setFillColor(248, 250, 252);
        doc.rect(15, 25, 180, 8, 'F');
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...primaryColor);
        doc.text(`PAYSLIP FOR THE MONTH OF ${cycleText.toUpperCase()}`, 105, 30, { align: "center" });

        let currentY = 38;
        doc.setFontSize(8);
        doc.setTextColor(...textColor);

        const drawLabelValue = (label: string, value: string, x: number, y: number) => {
            doc.setFont("helvetica", "bold");
            doc.setTextColor(...mutedColor);
            doc.text(label, x, y);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(...textColor);
            doc.text(value, x + 22, y);
        };

        drawLabelValue("Name:", row.name || "--", 15, currentY);
        drawLabelValue("Emp ID:", row.employeeCode || String(row.id) || "--", 80, currentY);
        drawLabelValue("UAN:", row.uan || "--", 145, currentY);

        currentY += 6;
        drawLabelValue("Designation:", row.designation || "--", 15, currentY);
        drawLabelValue("Department:", row.department || "--", 80, currentY);
        drawLabelValue("PF No:", row.pfNumber || "--", 145, currentY);

        currentY += 6;
        drawLabelValue("Bank Name:", row.bankName || "--", 15, currentY);
        drawLabelValue("A/C No:", row.bankAccountNumber || "--", 80, currentY);
        drawLabelValue("Days Worked:", String(row.workingDays || 0), 145, currentY);

        currentY += 8;

        autoTable(doc, {
            startY: currentY,
            theme: 'grid',
            head: [['Earnings', 'Amount (INR)', 'Deductions', 'Amount (INR)']],
            body: [
                ['Basic Salary', Number(pNet.basic || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }), pNet.pf > 0 ? 'Provident Fund (PF)' : '', pNet.pf > 0 ? Number(pNet.pf).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : ''],
                ['House Rent Allowance', Number(pNet.hra || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }), pNet.esi > 0 ? 'Employee State Ins. (ESI)' : '', pNet.esi > 0 ? Number(pNet.esi).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : ''],
                ['Special Allowance', Number(pNet.other || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }), pNet.pt > 0 ? 'Professional Tax (PT)' : '', pNet.pt > 0 ? Number(pNet.pt).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : ''],
                [row.conveyance ? 'Conveyance Allowance' : '', row.conveyance ? Number(row.conveyance).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '', row.loanDeduction > 0 ? 'Loan Deduction' : '', row.loanDeduction > 0 ? Number(row.loanDeduction).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '']
            ].filter(r => r.some(cell => cell !== '')),
            headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', lineWidth: 0.1, lineColor: [226, 232, 240] },
            bodyStyles: { textColor: [30, 30, 30], lineWidth: 0.1, lineColor: [226, 232, 240] },
            styles: { fontSize: 8, cellPadding: 3 },
            columnStyles: { 0: { cellWidth: 55 }, 1: { cellWidth: 35, halign: 'right' }, 2: { cellWidth: 55 }, 3: { cellWidth: 35, halign: 'right' } },
            foot: [['Gross Earnings', Number(pNet.totalEarnings || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }), 'Gross Deductions', Number(pNet.grossDeductions || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })]],
            footStyles: { fillColor: [255, 255, 255], textColor: [15, 23, 42], fontStyle: 'bold', lineWidth: 0.1, lineColor: [226, 232, 240] },
            margin: { left: 15, right: 15 }
        });

        const finalY = (doc as any).lastAutoTable.finalY + 8;

        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(...lineColor);
        doc.rect(15, finalY, 180, 25, 'FD');

        doc.setFillColor(220, 252, 231);
        doc.rect(15, finalY, 60, 25, 'F');
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(22, 101, 52);
        doc.text("Net Take Home", 45, finalY + 8, { align: "center" });
        doc.setFontSize(14);
        doc.text(`INR ${Number(pNet.net || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 45, finalY + 18, { align: "center" });

        doc.line(75, finalY, 75, finalY + 25);

        doc.setFontSize(8);
        doc.setTextColor(...mutedColor);
        doc.text("Employer PF:", 85, finalY + 8);
        doc.text("Employer ESIC:", 85, finalY + 18);

        doc.setFont("helvetica", "bold");
        doc.setTextColor(...textColor);
        doc.text(Number(pNet.pfEmployer || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }), 115, finalY + 8);
        doc.text(Number(pNet.esiEmployer || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }), 115, finalY + 18);

        doc.setFillColor(254, 249, 195);
        doc.rect(140, finalY, 55, 25, 'F');
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(133, 77, 14);
        doc.text("Total Monthly CTC", 167.5, finalY + 8, { align: "center" });
        doc.setFontSize(14);
        doc.text(`INR ${Number(pNet.totalMonthlyCTC || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 167.5, finalY + 18, { align: "center" });

        doc.setFontSize(7);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(...mutedColor);
        doc.text(`Amount in words: ${salaryToWords(pNet.net || 0)}`, 105, finalY + 32, { align: "center" });

        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.5);
        doc.text("This is a computer-generated document and does not require a signature.", 105, 142, { align: "center" });

        doc.save(`Payslip_${(selectedEmployee?.name || 'Staff').replace(/\s+/g, '_')}_${cycleText}.pdf`);
    };

    const currentEmp = employeeDetails || selectedEmployee;
    const fixedGross = Number(currentEmp?.fixed_gross || currentEmp?.fixedGross || 0);
    const dailyRate = periodAnalysis?.dailyRate || Math.round(fixedGross / 30);
    const hourlyRate = periodAnalysis?.hourlyRate || Math.round(dailyRate / 9);

    const filteredTimeline = (periodAnalysis?.timeline || []).filter((t: any) => {
        if (timelineFilter === "ALL") return true;
        if (timelineFilter === "present") return t.status === "present" || t.status === "late" || t.status === "tour";
        if (timelineFilter === "half_day") return t.status === "half_day";
        if (timelineFilter === "weekend") return t.status === "weekend";
        if (timelineFilter === "absent") return t.status === "absent";
        return true;
    });

    const activeEmpId = String(selectedEmployee?.employeeId || selectedEmployee?.id || "");

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[960px] w-full max-h-[92vh] border-none shadow-2xl rounded-3xl p-0 overflow-hidden flex flex-col bg-slate-50">
                {/* ── Top Hero Header (Dark SaaS Theme) ── */}
                <div className="bg-slate-900 p-6 md:p-8 text-white shrink-0 relative">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-[#D9F99D]/20 flex items-center justify-center border border-white/10 shrink-0 text-lg font-black text-[#D9F99D]">
                                {(currentEmp?.name || "Staff").substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="text-xl font-black italic uppercase tracking-tighter text-white">
                                        {currentEmp?.name || "Employee"}
                                    </h3>
                                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/10 font-bold uppercase tracking-wider text-slate-300">
                                        {currentEmp?.emp_code || currentEmp?.employeeCode || `EMP-${currentEmp?.id || '--'}`}
                                    </span>
                                </div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                    {currentEmp?.company || "Company"} • {currentEmp?.designation || "Staff"} • {currentEmp?.department || "General"}
                                </p>
                            </div>
                        </div>

                        {/* Staff Switcher Dropdown (Allows changing employee right inside modal) */}
                        {allEmployees.length > 0 && onSelectEmployee && (
                            <div className="flex items-center gap-2 bg-white/5 p-1.5 rounded-2xl border border-white/10">
                                <User className="h-3.5 w-3.5 text-slate-400 ml-2" />
                                <Select value={activeEmpId} onValueChange={handleEmployeeChange}>
                                    <SelectTrigger className="h-9 w-[220px] rounded-xl bg-transparent border-none text-white text-[10px] font-bold uppercase tracking-wider focus:ring-0">
                                        <SelectValue placeholder="Switch Employee..." />
                                    </SelectTrigger>
                                    <SelectContent className="border-none shadow-2xl rounded-2xl max-h-72">
                                        {allEmployees.map((emp) => {
                                            const id = String(emp.employeeId || emp.id);
                                            return (
                                                <SelectItem key={id} value={id} className="text-[10px] font-bold uppercase">
                                                    {emp.name} ({emp.employeeCode || `EMP-${id}`})
                                                </SelectItem>
                                            );
                                        })}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>

                    {/* Quick Wage Metrics Bar */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
                        <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Fixed Monthly Gross</p>
                            <p className="text-base font-black italic text-[#D9F99D]">₹{fixedGross.toLocaleString()}</p>
                        </div>
                        <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Daily Wage Rate (30d)</p>
                            <p className="text-base font-black italic text-white">₹{dailyRate.toLocaleString()} <span className="text-[9px] text-slate-400 font-normal">/day</span></p>
                        </div>
                        <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Hourly Rate (9h)</p>
                            <p className="text-base font-black italic text-indigo-300">₹{hourlyRate.toLocaleString()} <span className="text-[9px] text-slate-400 font-normal">/hr</span></p>
                        </div>
                        <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Shift & Weekly Off</p>
                            <p className="text-xs font-black uppercase text-amber-300 truncate">
                                {currentEmp?.shift_preset || "09:30 - 18:30"} • {Array.isArray(currentEmp?.weekly_off_days) ? currentEmp.weekly_off_days.join(", ") : (currentEmp?.weekly_off_days || "Sun")}
                            </p>
                        </div>
                    </div>
                </div>

                {/* ── Controls & Duration Selection Filter Bar ── */}
                <div className="bg-white p-4 border-b border-slate-200/80 px-6 shrink-0 flex flex-wrap items-center justify-between gap-3 shadow-xs">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mr-1">Duration:</span>
                        {[
                            { id: "30", label: "Last 30 Days" },
                            { id: "60", label: "Last 60 Days" },
                            { id: "90", label: "Last 90 Days" },
                            { id: "180", label: "Last 180 Days" },
                            { id: "365", label: "1 Year" },
                            { id: "custom", label: "Custom Range" },
                        ].map((btn) => (
                            <button
                                key={btn.id}
                                onClick={() => setDurationPreset(btn.id)}
                                className={cn(
                                    "px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all",
                                    durationPreset === btn.id
                                        ? "bg-slate-900 text-[#D9F99D] shadow-xs"
                                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                )}
                            >
                                {btn.label}
                            </button>
                        ))}
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2">
                        {periodAnalysis?.timeline?.length > 0 && (
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={handleExportCSV}
                                className="h-8 rounded-xl border-slate-200 text-slate-700 font-black uppercase text-[8px] tracking-widest px-3 hover:bg-[#D9F99D] hover:text-slate-900"
                            >
                                <FileSpreadsheet className="h-3.5 w-3.5 mr-1 text-emerald-600" /> Export CSV
                            </Button>
                        )}
                    </div>
                </div>

                {/* Custom Date Range Row (Revealed when 'Custom Range' is active) */}
                {durationPreset === "custom" && (
                    <div className="bg-indigo-50/60 border-b border-indigo-100 p-3 px-6 shrink-0 flex items-center gap-3 flex-wrap">
                        <span className="text-[9px] font-black text-indigo-900 uppercase tracking-widest flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-indigo-600" /> Custom Range:
                        </span>
                        <div className="flex items-center gap-2">
                            <label className="text-[9px] font-bold text-slate-500 uppercase">From:</label>
                            <Input
                                type="date"
                                value={customFrom}
                                onChange={(e) => setCustomFrom(e.target.value)}
                                className="h-8 w-36 text-[10px] font-bold rounded-lg bg-white border-slate-200"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="text-[9px] font-bold text-slate-500 uppercase">To:</label>
                            <Input
                                type="date"
                                value={customTo}
                                onChange={(e) => setCustomTo(e.target.value)}
                                className="h-8 w-36 text-[10px] font-bold rounded-lg bg-white border-slate-200"
                            />
                        </div>
                        <Button
                            size="sm"
                            onClick={handleApplyCustomRange}
                            disabled={loading}
                            className="h-8 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase text-[8px] tracking-widest rounded-lg shadow-xs"
                        >
                            {loading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null} Apply Range
                        </Button>
                    </div>
                )}

                {/* ── Period Summary KPI Row ── */}
                {periodAnalysis && (
                    <div className="p-4 px-6 grid grid-cols-2 md:grid-cols-4 gap-3 bg-white shrink-0 border-b border-slate-200/60">
                        <div className="p-3 rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100/40 border border-emerald-200/60">
                            <p className="text-[8px] font-black text-emerald-800 uppercase tracking-widest">Period Gross Earned</p>
                            <p className="text-xl font-black italic text-emerald-700 tracking-tight mt-0.5">
                                ₹{periodAnalysis.periodGrossEarned?.toLocaleString()}
                            </p>
                            <p className="text-[8px] text-emerald-600 font-bold mt-1">
                                {periodAnalysis.payableDays} payable days × ₹{periodAnalysis.dailyRate?.toLocaleString()}
                            </p>
                        </div>

                        <div className="p-3 rounded-2xl bg-gradient-to-br from-indigo-50 to-indigo-100/40 border border-indigo-200/60">
                            <p className="text-[8px] font-black text-indigo-800 uppercase tracking-widest">Payable Work Ratio</p>
                            <p className="text-xl font-black italic text-indigo-700 tracking-tight mt-0.5">
                                {periodAnalysis.payableDays} <span className="text-xs text-indigo-400 font-bold">/ {periodAnalysis.daysCount} Days</span>
                            </p>
                            <p className="text-[8px] text-indigo-600 font-bold mt-1">
                                Range: {periodAnalysis.from} → {periodAnalysis.to}
                            </p>
                        </div>

                        <div className="p-3 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200">
                            <p className="text-[8px] font-black text-slate-700 uppercase tracking-widest">Attendance Breakdown</p>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="inline-flex items-center text-[9px] font-bold text-emerald-600">
                                    <CheckCircle className="h-3 w-3 mr-0.5" /> {periodAnalysis.presentDays} Pres
                                </span>
                                <span className="text-slate-300">·</span>
                                <span className="inline-flex items-center text-[9px] font-bold text-blue-600">
                                    {periodAnalysis.weeklyOffDays} Off
                                </span>
                                <span className="text-slate-300">·</span>
                                <span className="inline-flex items-center text-[9px] font-bold text-amber-600">
                                    {periodAnalysis.halfDays} Half
                                </span>
                            </div>
                            <p className="text-[8px] text-slate-500 font-bold mt-1">
                                {periodAnalysis.totalHoursLogged || 0} Hours Logged
                            </p>
                        </div>

                        <div className="p-3 rounded-2xl bg-gradient-to-br from-rose-50 to-rose-100/40 border border-rose-200/60">
                            <p className="text-[8px] font-black text-rose-800 uppercase tracking-widest">Unpaid Absents (LWP)</p>
                            <p className="text-xl font-black italic text-rose-700 tracking-tight mt-0.5">
                                {periodAnalysis.absentDays} Days
                            </p>
                            <p className="text-[8px] text-rose-600 font-bold mt-1">
                                Salary Deducted: ₹{(periodAnalysis.absentDays * dailyRate).toLocaleString()}
                            </p>
                        </div>
                    </div>
                )}

                {/* ── Tabbed View Selection ── */}
                <div className="px-6 pt-3 bg-white shrink-0 border-b border-slate-200/60">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <TabsList className="bg-slate-100 p-1 rounded-2xl h-10 w-full justify-start">
                            <TabsTrigger
                                value="timeline"
                                className="rounded-xl text-[9px] font-black uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-xs px-5"
                            >
                                <Clock className="h-3.5 w-3.5 mr-1.5 text-indigo-600" />
                                Day-Wise Salary Log ({periodAnalysis?.timeline?.length || 0})
                            </TabsTrigger>
                            <TabsTrigger
                                value="cycles"
                                className="rounded-xl text-[9px] font-black uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-xs px-5"
                            >
                                <CalendarCheck className="h-3.5 w-3.5 mr-1.5 text-emerald-600" />
                                Past Monthly Payroll Cycles ({history.length})
                            </TabsTrigger>
                            <TabsTrigger
                                value="structure"
                                className="rounded-xl text-[9px] font-black uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-xs px-5"
                            >
                                <Wallet className="h-3.5 w-3.5 mr-1.5 text-amber-600" />
                                Salary & Statutory Structure
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>

                {/* ── Scrollable Body Content ── */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
                            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                            <p className="text-[10px] uppercase font-black tracking-widest text-slate-500">
                                Computing period salary and attendance ledger...
                            </p>
                        </div>
                    ) : activeTab === "timeline" ? (
                        <div className="space-y-4">
                            {/* Filter pills for status */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Filter:</span>
                                    {["ALL", "present", "half_day", "weekend", "absent"].map((st) => (
                                        <button
                                            key={st}
                                            onClick={() => setTimelineFilter(st)}
                                            className={cn(
                                                "px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider",
                                                timelineFilter === st
                                                    ? "bg-slate-800 text-white"
                                                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                                            )}
                                        >
                                            {st === "ALL" ? "All Days" : st.replace("_", " ")}
                                        </button>
                                    ))}
                                </div>
                                <span className="text-[9px] font-bold text-slate-500 uppercase">
                                    Showing {filteredTimeline.length} of {periodAnalysis?.timeline?.length || 0} Days
                                </span>
                            </div>

                            {/* Timeline Table */}
                            {filteredTimeline.length === 0 ? (
                                <div className="text-center py-16 bg-white rounded-2xl border border-slate-200/80">
                                    <Clock className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                                    <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">
                                        No attendance entries found for this period
                                    </p>
                                </div>
                            ) : (
                                <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50 border-b border-slate-200/80 text-[8px] font-black uppercase text-slate-500 tracking-wider">
                                                <th className="py-3 px-4">Date & Day</th>
                                                <th className="py-3 px-4">Attendance Status</th>
                                                <th className="py-3 px-4">Clock In / Out</th>
                                                <th className="py-3 px-4">Hours</th>
                                                <th className="py-3 px-4 text-center">Payable Credit</th>
                                                <th className="py-3 px-4 text-right">Daily Salary Earned</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 text-[10px]">
                                            {filteredTimeline.map((item: any, idx: number) => {
                                                const isPresent = item.status === "present" || item.status === "late" || item.status === "tour";
                                                const isHalf = item.status === "half_day";
                                                const isOff = item.status === "weekend";
                                                const isAbsent = item.status === "absent";

                                                return (
                                                    <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                                                        <td className="py-3 px-4 font-bold text-slate-900">
                                                            <div>
                                                                <span>{item.date}</span>
                                                                <span className="ml-1.5 text-[8px] font-black uppercase text-slate-400">
                                                                    ({item.day})
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="py-3 px-4">
                                                            {isPresent ? (
                                                                <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 font-black text-[8px] rounded-md px-2">
                                                                    {item.status === "tour" ? "Field Tour" : (item.lateMinutes > 0 ? `Present (Late ${item.lateMinutes}m)` : "Present")}
                                                                </Badge>
                                                            ) : isHalf ? (
                                                                <Badge className="bg-amber-50 text-amber-700 border border-amber-200 font-black text-[8px] rounded-md px-2">
                                                                    Half Day
                                                                </Badge>
                                                            ) : isOff ? (
                                                                <Badge className="bg-blue-50 text-blue-700 border border-blue-200 font-black text-[8px] rounded-md px-2">
                                                                    Weekly Off
                                                                </Badge>
                                                            ) : item.status === "holiday" ? (
                                                                <Badge className="bg-purple-50 text-purple-700 border border-purple-200 font-black text-[8px] rounded-md px-2">
                                                                    Paid Holiday
                                                                </Badge>
                                                            ) : (
                                                                <Badge className="bg-rose-50 text-rose-700 border border-rose-200 font-black text-[8px] rounded-md px-2">
                                                                    Absent (LWP)
                                                                </Badge>
                                                            )}
                                                        </td>
                                                        <td className="py-3 px-4 font-mono text-[9px] text-slate-600">
                                                            {item.checkIn || item.checkOut ? (
                                                                <span>{item.checkIn || "--"} → {item.checkOut || "--"}</span>
                                                            ) : (
                                                                <span className="text-slate-300">--</span>
                                                            )}
                                                        </td>
                                                        <td className="py-3 px-4 font-bold text-slate-700">
                                                            {item.totalHours > 0 ? `${item.totalHours} hrs` : "--"}
                                                        </td>
                                                        <td className="py-3 px-4 text-center font-black">
                                                            <span className={cn(
                                                                "inline-block px-2 py-0.5 rounded-md text-[9px]",
                                                                item.payableCredit === 1 ? "bg-emerald-100 text-emerald-800" :
                                                                item.payableCredit === 0.5 ? "bg-amber-100 text-amber-800" :
                                                                "bg-rose-100 text-rose-800"
                                                            )}>
                                                                {item.payableCredit} Day
                                                            </span>
                                                        </td>
                                                        <td className="py-3 px-4 text-right font-black italic">
                                                            {item.dailyEarned > 0 ? (
                                                                <span className="text-emerald-700">₹{item.dailyEarned.toLocaleString()}</span>
                                                            ) : (
                                                                <span className="text-rose-400">₹0</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    ) : activeTab === "cycles" ? (
                        <div className="space-y-3">
                            <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">
                                Monthly Finalized Payroll Runs & Payslip Slips
                            </p>
                            {history.length === 0 ? (
                                <div className="text-center py-16 bg-white rounded-2xl border border-slate-200/80">
                                    <CalendarCheck className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                                    <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">
                                        No past payroll cycles recorded yet
                                    </p>
                                </div>
                            ) : (
                                history.map((h, i) => (
                                    <div
                                        key={i}
                                        className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-2xl border border-slate-200 bg-white gap-3 shadow-xs hover:border-indigo-200 transition-all"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                                                <CalendarCheck className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <span className="text-xs font-black text-slate-900 uppercase">
                                                    {h.month} ({h.year})
                                                </span>
                                                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                                                    Working Days: {h.workingDays || 0} • Absents: {h.absentDays || 0}d
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4">
                                            <div className="text-right">
                                                <p className="text-[7px] font-black uppercase text-slate-400">Net Take Home</p>
                                                <span className="text-sm font-black italic text-emerald-700">
                                                    ₹{Number(h.net || 0).toLocaleString()}
                                                </span>
                                            </div>
                                            <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 font-black text-[8px] h-6 px-2.5 rounded-lg">
                                                {h.status || "Paid"}
                                            </Badge>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleDownload(h)}
                                                className="h-8 rounded-xl border-slate-200 font-black uppercase text-[8px] tracking-widest px-3 hover:bg-[#D9F99D] hover:text-slate-900"
                                            >
                                                <Download className="h-3.5 w-3.5 mr-1" /> PDF Slip
                                            </Button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    ) : (
                        /* ── Tab: Salary & Statutory Structure ── */
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Salary Breakup */}
                                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-900 flex items-center gap-2">
                                        <Wallet className="h-4 w-4 text-emerald-600" />
                                        Monthly Salary Structure (CTC Breakup)
                                    </h4>
                                    <div className="space-y-2 text-[10px] divide-y divide-slate-100">
                                        <div className="flex justify-between py-1.5 font-bold text-slate-700">
                                            <span>Basic Salary (50%)</span>
                                            <span className="font-mono font-black">
                                                ₹{employeeDetails?.salaryBreakup?.basic?.toLocaleString() || Math.round(fixedGross * 0.50).toLocaleString()}
                                            </span>
                                        </div>
                                        <div className="flex justify-between py-1.5 font-bold text-slate-700">
                                            <span>House Rent Allowance (HRA 40%)</span>
                                            <span className="font-mono font-black">
                                                ₹{employeeDetails?.salaryBreakup?.hra?.toLocaleString() || Math.round(fixedGross * 0.20).toLocaleString()}
                                            </span>
                                        </div>
                                        <div className="flex justify-between py-1.5 font-bold text-slate-700">
                                            <span>Special / Other Allowances</span>
                                            <span className="font-mono font-black">
                                                ₹{employeeDetails?.salaryBreakup?.other?.toLocaleString() || Math.max(0, fixedGross - Math.round(fixedGross * 0.70)).toLocaleString()}
                                            </span>
                                        </div>
                                        <div className="flex justify-between py-2 font-black text-slate-900 bg-slate-50 px-2 rounded-lg">
                                            <span>Total Fixed Monthly Base</span>
                                            <span className="font-mono text-emerald-700">₹{fixedGross.toLocaleString()}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Statutory Applicability */}
                                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-900 flex items-center gap-2">
                                        <ShieldCheck className="h-4 w-4 text-indigo-600" />
                                        Statutory & Banking Details
                                    </h4>
                                    <div className="space-y-2 text-[10px] divide-y divide-slate-100">
                                        <div className="flex justify-between py-1.5 font-bold text-slate-700">
                                            <span>Provident Fund (PF)</span>
                                            <span>
                                                {employeeDetails?.pf_applicable ? (
                                                    <Badge className="bg-emerald-50 text-emerald-700 border-none text-[8px]">Active (12%)</Badge>
                                                ) : (
                                                    <Badge className="bg-slate-100 text-slate-500 border-none text-[8px]">Exempt</Badge>
                                                )}
                                            </span>
                                        </div>
                                        <div className="flex justify-between py-1.5 font-bold text-slate-700">
                                            <span>ESIC Health Insurance</span>
                                            <span>
                                                {employeeDetails?.esic_applicable ? (
                                                    <Badge className="bg-emerald-50 text-emerald-700 border-none text-[8px]">Active (0.75%)</Badge>
                                                ) : (
                                                    <Badge className="bg-slate-100 text-slate-500 border-none text-[8px]">Exempt</Badge>
                                                )}
                                            </span>
                                        </div>
                                        <div className="flex justify-between py-1.5 font-bold text-slate-700">
                                            <span>Bank Account</span>
                                            <span className="font-mono font-bold text-slate-800">
                                                {employeeDetails?.bank_name || "--"} ({employeeDetails?.bank_account_number || "--"})
                                            </span>
                                        </div>
                                        <div className="flex justify-between py-1.5 font-bold text-slate-700">
                                            <span>UAN / PF Number</span>
                                            <span className="font-mono font-bold text-slate-800">
                                                {employeeDetails?.uan || employeeDetails?.pf_number || "--"}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Modal Footer ── */}
                <div className="p-4 px-6 bg-white border-t border-slate-200/80 flex items-center justify-between shrink-0">
                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                        Single Employee Historical Salary Analytics • Production Grade
                    </p>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        className="h-9 px-6 rounded-xl font-black uppercase text-[8px] tracking-widest text-slate-700 hover:bg-slate-100"
                    >
                        Close
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export function PayrollPolicyDialog({
    isOpen, onOpenChange,
    globalRules, setGlobalRules
}: any) {
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[450px] border-none shadow-2xl rounded-3xl p-8">
                <DialogHeader className="text-left space-y-2">
                    <div className="h-12 w-12 rounded-2xl bg-rose-50 flex items-center justify-center">
                        <Clock className="h-6 w-6 text-rose-500" />
                    </div>
                    <DialogTitle className="text-2xl font-black italic uppercase text-slate-900 tracking-tighter">Payroll Policies</DialogTitle>
                    <DialogDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-loose">
                        Define statutory deduction rules for the entire company.
                    </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="operations" className="w-full mt-6">
                    <TabsList className="grid w-full grid-cols-2 h-12 bg-slate-50 rounded-2xl p-1 mb-8">
                        <TabsTrigger value="operations" className="rounded-xl font-black uppercase text-[8px] tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-sm">Operations</TabsTrigger>
                        <TabsTrigger value="statutory" className="rounded-xl font-black uppercase text-[8px] tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-sm">Statutory</TabsTrigger>
                    </TabsList>

                    <TabsContent value="operations" className="space-y-6 mt-0">
                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                            <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest mb-3">No Operational Rules</p>
                            <p className="text-[10px] font-bold text-slate-500 italic">Operational penalties have been disabled globally.</p>
                        </div>
                    </TabsContent>

                    <TabsContent value="statutory" className="space-y-6 mt-0">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Employer PF %</Label>
                                <Input
                                    type="number"
                                    value={globalRules.pfEmployer}
                                    onChange={(e) => setGlobalRules({ ...globalRules, pfEmployer: parseInt(e.target.value) || 0 })}
                                    className="h-12 rounded-xl bg-slate-50 border-slate-100 font-bold text-[11px]"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Employee PF %</Label>
                                <Input
                                    type="number"
                                    value={globalRules.pfEmployee}
                                    onChange={(e) => setGlobalRules({ ...globalRules, pfEmployee: parseInt(e.target.value) || 0 })}
                                    className="h-12 rounded-xl bg-slate-50 border-slate-100 font-bold text-[11px]"
                                />
                            </div>
                        </div>
                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                            <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest mb-3">Professional Tax Slabs (MP)</p>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between text-[10px] font-bold">
                                    <span className="text-slate-500 italic">Up to ₹1.5L / Yr</span>
                                    <span className="text-slate-900">₹0</span>
                                </div>
                                <div className="flex items-center justify-between text-[10px] font-bold">
                                    <span className="text-slate-500 italic">Above ₹1.5L / Yr</span>
                                    <span className="text-slate-900">₹2,500 / Yr</span>
                                </div>
                            </div>
                            <Button variant="link" className="h-auto p-0 mt-3 text-[8px] font-black uppercase tracking-widest text-indigo-500">Update Slabs</Button>
                        </div>
                    </TabsContent>
                </Tabs>

                <DialogFooter className="mt-8">
                    <Button onClick={() => onOpenChange(false)} className="w-full h-12 rounded-2xl bg-slate-900 text-white font-black uppercase text-[9px] tracking-widest shadow-xl">Save All Changes</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
