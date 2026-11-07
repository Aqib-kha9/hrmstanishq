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
    ShieldCheck, CreditCard, UserCircle, CalendarCheck, Clock, Download
} from "lucide-react";
import { apiGet } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { salaryToWords } from "@/lib/amount-to-words";

export function GlobalRulesSheet({
    isOpen, onOpenChange,
    selectedEmployee, setSelectedEmployee,
    globalRules, setGlobalRules,
    handleSalaryUpdate, calculateProductionNet
}: any) {
    return (
        <Sheet open={isOpen} onOpenChange={(open) => {
            onOpenChange(open);
            if (!open) setSelectedEmployee(null);
        }}>
            <SheetContent className="sm:max-w-[540px] border-none shadow-2xl p-0 overflow-y-auto">
                <div className="h-2 bg-[#D9F99D]" />
                <div className="p-8 space-y-10">
                    <SheetHeader className="text-left space-y-2">
                        <div className="h-12 w-12 rounded-2xl bg-slate-50 flex items-center justify-center">
                            <TrendingUp className="h-6 w-6 text-indigo-500" />
                        </div>
                        <SheetTitle className="text-2xl font-black italic uppercase text-slate-900 tracking-tighter">
                            {selectedEmployee ? `Configure: ${selectedEmployee.name}` : "Global Salary Rules"}
                        </SheetTitle>
                        <SheetDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-loose">
                            Define CTC components, PF rules, and Tax overrides for this employee.
                        </SheetDescription>
                    </SheetHeader>

                    {selectedEmployee ? (
                        <div className="grid gap-8 animate-in slide-in-from-right-4 duration-300">
                            <div className="space-y-6">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                                    <span className="text-[9px] font-black text-slate-900 uppercase tracking-widest">Earnings Breakdown</span>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2 relative group">
                                        <div className="flex justify-between items-center ml-1">
                                            <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Monthly CTC</Label>
                                            <Badge className="bg-slate-100 text-slate-500 border-none font-bold text-[7px] uppercase tracking-widest px-1.5 h-3.5">Locked</Badge>
                                        </div>
                                        <Input
                                            type="number"
                                            disabled
                                            value={selectedEmployee.fixedGross || 0}
                                            className="h-12 rounded-xl bg-slate-50/50 border-slate-100 font-bold text-[11px] text-slate-500 cursor-not-allowed opacity-70"
                                        />
                                        <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest ml-1">Managed via Profile Update</p>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Previous Arrears</Label>
                                        <Input
                                            type="number"
                                            value={selectedEmployee.previousArrears || 0}
                                            onChange={(e) => handleSalaryUpdate(selectedEmployee.id, 'previousArrears', parseInt(e.target.value) || 0)}
                                            className="h-12 rounded-xl bg-slate-50 border-slate-100 font-bold text-[11px] focus:bg-white transition-all"
                                        />
                                        <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest ml-1">One-time addition</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Bonus</Label>
                                        <Input
                                            type="number"
                                            value={selectedEmployee.bonus || 0}
                                            onChange={(e) => handleSalaryUpdate(selectedEmployee.id, 'bonus', parseInt(e.target.value) || 0)}
                                            className="h-10 rounded-xl bg-slate-50 border-slate-100 font-bold text-[10px] focus:bg-white transition-all"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Incentive</Label>
                                        <Input
                                            type="number"
                                            value={selectedEmployee.incentive || 0}
                                            onChange={(e) => handleSalaryUpdate(selectedEmployee.id, 'incentive', parseInt(e.target.value) || 0)}
                                            className="h-10 rounded-xl bg-slate-50 border-slate-100 font-bold text-[10px] focus:bg-white transition-all"
                                        />
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 mb-2 pt-4 border-t border-slate-100">
                                    <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                    <span className="text-[9px] font-black text-slate-900 uppercase tracking-widest">Deductions & Recoveries</span>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2 relative">
                                        <div className="flex justify-between items-center ml-1">
                                            <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Advance / Loan EMI</Label>
                                            <Badge className="bg-emerald-50 text-emerald-600 border-none font-bold text-[7px] uppercase tracking-widest px-1.5 h-3.5">Auto</Badge>
                                        </div>
                                        <Input
                                            type="number"
                                            disabled
                                            value={selectedEmployee.loanDeduction || 0}
                                            className="h-10 rounded-xl bg-emerald-50/30 border-emerald-100/50 font-bold text-[10px] text-emerald-700 cursor-not-allowed"
                                        />
                                        <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest ml-1">Synced from Loan Module</p>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center ml-1">
                                            <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Other Deduction</Label>
                                        </div>
                                        <Input
                                            type="number"
                                            value={selectedEmployee.otherDeduction || 0}
                                            onChange={(e) => handleSalaryUpdate(selectedEmployee.id, 'otherDeduction', parseInt(e.target.value) || 0)}
                                            className="h-10 rounded-xl bg-slate-50 border-slate-100 font-bold text-[10px] focus:bg-white transition-all"
                                        />
                                        <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest ml-1">Manual recovery</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 mb-2 pt-4 border-t border-slate-100">
                                    <div className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                                    <span className="text-[9px] font-black text-slate-900 uppercase tracking-widest">Attendance & Manual Payroll Control (Req 4.1, 4.2 & 10)</span>
                                </div>
                                <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-100/90 text-[10px] text-indigo-950 leading-relaxed space-y-1">
                                    <p className="font-bold uppercase tracking-wider text-[9px] text-indigo-800">Administrative Manual Control (Req 10):</p>
                                    <p className="text-slate-600 text-[10px]">
                                        Pending or unapproved leaves never automatically deduct an employee&apos;s salary. As Admin/Owner, you hold complete authority over leave approval, paid/unpaid status, balance adjustment, and current vs. future-month salary deductions.
                                    </p>
                                </div>

                                {/* Active Cycle Leave Records (Req 10) */}
                                {selectedEmployee.cycle_leaves && selectedEmployee.cycle_leaves.length > 0 && (
                                    <div className="space-y-2 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                                        <span className="text-[8px] font-black uppercase tracking-wider text-slate-500 block">
                                            Leave Requests in this Cycle ({selectedEmployee.cycle_leaves.length})
                                        </span>
                                        <div className="space-y-2">
                                            {selectedEmployee.cycle_leaves.map((l: any, idx: number) => {
                                                const isPending = l.status === 'pending';
                                                const isUnpaid = l.payroll_treatment === 'unpaid';
                                                const isCarry = l.payroll_treatment === 'carry_forward_next';
                                                return (
                                                    <div key={l.id || idx} className="p-2.5 rounded-lg bg-white border border-slate-200/80 flex items-center justify-between text-[9px]">
                                                        <div>
                                                            <div className="flex items-center gap-1.5 font-bold text-slate-800">
                                                                <Badge className="text-[7px] font-black uppercase px-1.5 h-4 rounded">
                                                                    {(l.leave_type || 'EL').toUpperCase()}
                                                                </Badge>
                                                                <span>{l.duration || 1} Day{l.duration > 1 ? 's' : ''}</span>
                                                                <span className="text-slate-400 font-normal">
                                                                    ({new Date(l.from_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – {new Date(l.to_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })})
                                                                </span>
                                                            </div>
                                                            {l.reason && <p className="text-[8px] text-slate-500 italic mt-0.5 truncate max-w-[280px]">&ldquo;{l.reason}&rdquo;</p>}
                                                        </div>
                                                        <Badge className={cn(
                                                            "text-[7px] font-black uppercase px-2 h-4 rounded border-none",
                                                            isPending ? "bg-amber-100 text-amber-800" :
                                                            isUnpaid ? "bg-rose-100 text-rose-800" :
                                                            isCarry ? "bg-indigo-100 text-indigo-800" :
                                                            "bg-emerald-100 text-emerald-800"
                                                        )}>
                                                            {isPending ? "Pending (No Cut)" :
                                                             isUnpaid ? "Unpaid (LWP)" :
                                                             isCarry ? "Carry Next" : "Paid"}
                                                        </Badge>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center ml-1">
                                                <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Recorded Absences</Label>
                                                <Badge className="bg-blue-50 text-blue-600 border-none font-bold text-[7px] uppercase tracking-widest px-1.5 h-3.5">Attendance Sync</Badge>
                                            </div>
                                            <Input
                                                type="number"
                                                disabled
                                                value={selectedEmployee.absentDays}
                                                className="h-10 rounded-xl bg-blue-50/30 border-blue-100/50 font-bold text-[10px] text-blue-700 cursor-not-allowed"
                                            />
                                            <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest ml-1">Live muster absent days</p>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center ml-1">
                                                <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Direct Payable Days Override (Req 4.1)</Label>
                                                <Badge className="bg-amber-100 text-amber-800 border-none font-bold text-[7px] uppercase tracking-widest px-1.5 h-3.5">Admin</Badge>
                                            </div>
                                            <Input
                                                type="number"
                                                placeholder="Override days (e.g. 28)"
                                                value={selectedEmployee.manualPayableDays ?? selectedEmployee.manual_payable_days ?? ""}
                                                onChange={(e) => handleSalaryUpdate(selectedEmployee.id, 'manualPayableDays', e.target.value === "" ? null : parseFloat(e.target.value))}
                                                className="h-10 rounded-xl bg-slate-50 border-slate-100 font-bold text-[10px] focus:bg-white transition-all"
                                            />
                                            <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest ml-1">Directly locks payable days</p>
                                        </div>
                                    </div>

                                    {/* Leave Adjustment Controls (Req 4.2) */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Deduct This Month (Days)</Label>
                                            <Input
                                                type="number"
                                                value={selectedEmployee.leaveAdjustmentDays ?? selectedEmployee.leave_adjustment_days ?? 0}
                                                onChange={(e) => handleSalaryUpdate(selectedEmployee.id, 'leaveAdjustmentDays', parseFloat(e.target.value) || 0)}
                                                className="h-10 rounded-xl bg-slate-50 border-slate-100 font-bold text-[10px] focus:bg-white transition-all"
                                            />
                                            <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest ml-1">e.g. Deduct 2 days now</p>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Carry Forward To Next (Days)</Label>
                                            <Input
                                                type="number"
                                                value={selectedEmployee.leaveCarryForwardDays ?? selectedEmployee.leave_carry_forward_days ?? 0}
                                                onChange={(e) => handleSalaryUpdate(selectedEmployee.id, 'leaveCarryForwardDays', parseFloat(e.target.value) || 0)}
                                                className="h-10 rounded-xl bg-slate-50 border-slate-100 font-bold text-[10px] focus:bg-white transition-all"
                                            />
                                            <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest ml-1">e.g. Carry 2 days forward</p>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Admin Audit Reason / Note</Label>
                                        <Input
                                            placeholder="Reason for manual adjustment..."
                                            value={selectedEmployee.adminNotes ?? selectedEmployee.admin_notes ?? ""}
                                            onChange={(e) => handleSalaryUpdate(selectedEmployee.id, 'adminNotes', e.target.value)}
                                            className="h-10 rounded-xl bg-slate-50 border-slate-100 font-bold text-[10px] focus:bg-white transition-all"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 rounded-[2rem] bg-slate-950 text-white shadow-2xl relative overflow-hidden border border-white/5">
                                <div className="absolute top-0 right-0 p-6 opacity-5">
                                    <TrendingUp className="h-20 w-20" />
                                </div>
                                <div className="grid grid-cols-3 gap-4 relative z-10">
                                    <div>
                                        <p className="text-[8px] font-black uppercase text-indigo-300 tracking-[0.2em] mb-1">Payable Days</p>
                                        <h4 className="text-xl font-black text-white tracking-tight italic">
                                            {calculateProductionNet(selectedEmployee)?.payableDays} <span className="text-xs text-slate-400 font-normal">/ {selectedEmployee.dynamicDays || 30}</span>
                                        </h4>
                                    </div>
                                    <div>
                                        <p className="text-[8px] font-black uppercase text-rose-300 tracking-[0.2em] mb-1">LOP Deduction</p>
                                        <h4 className="text-xl font-black text-rose-400 tracking-tight italic">₹{calculateProductionNet(selectedEmployee)?.lop?.toLocaleString()}</h4>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[8px] font-black uppercase text-[#D9F99D] tracking-[0.2em] mb-1">Net In-Hand</p>
                                        <h4 className="text-2xl font-black italic tracking-tighter text-[#D9F99D]">₹{calculateProductionNet(selectedEmployee).net.toLocaleString()}</h4>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="grid gap-8 animate-in slide-in-from-right-4 duration-300">
                            <div className="space-y-6">
                                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100 flex gap-3">
                                    <Info className="h-5 w-5 text-amber-500 shrink-0" />
                                    <p className="text-[9px] font-bold text-amber-800 uppercase tracking-widest leading-relaxed">
                                        Warning: These rules will apply to all employees who don't have custom overrides.
                                    </p>
                                </div>

                                <div className="space-y-4">
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
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">HRA % of Basic</Label>
                                            <Input
                                                type="number"
                                                value={globalRules.hraPercent}
                                                onChange={(e) => setGlobalRules({ ...globalRules, hraPercent: parseInt(e.target.value) || 0 })}
                                                className="h-12 rounded-xl bg-slate-50 border-slate-100 font-bold text-[11px]"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Monthly Cycle</Label>
                                            <Input
                                                value={globalRules.cycle}
                                                onChange={(e) => setGlobalRules({ ...globalRules, cycle: e.target.value })}
                                                className="h-12 rounded-xl bg-slate-50 border-slate-100 font-bold text-[11px]"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <SheetFooter className="pt-6">
                        <Button onClick={() => onOpenChange(false)} className="w-full h-12 rounded-2xl bg-slate-900 text-white font-black uppercase text-[9px] tracking-widest shadow-xl">Save Configuration</Button>
                    </SheetFooter>
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
    isOpen, onOpenChange,
    selectedEmployee
}: any) {
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!isOpen || !selectedEmployee) return;
        const fetchHistory = async () => {
            setLoading(true);
            try {
                const empId = selectedEmployee.employeeId || selectedEmployee.id;
                const data = await apiGet<any[]>(`/payroll/employee/${empId}/history`);
                setHistory(data || []);
            } catch (e) {
                console.error("Failed to load employee history:", e);
                setHistory([]);
            } finally {
                setLoading(false);
            }
        };
        fetchHistory();
    }, [isOpen, selectedEmployee]);

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

        // Load logo image
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

        doc.save(`Payslip_${selectedEmployee.name?.replace(/\s+/g, '_')}_${cycleText}.pdf`);
    };

    const paidEntries = history.filter(h => h.status === 'Paid' || h.status === 'Verified');
    const totalPaidYTD = paidEntries.reduce((acc, h) => acc + h.net, 0);
    const avgNetPay = paidEntries.length > 0 ? Math.round(totalPaidYTD / paidEntries.length) : 0;
    const leavesTaken = history.reduce((acc, h) => acc + (h.absentDays || 0), 0);

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] border-none shadow-2xl rounded-3xl p-0 overflow-hidden">
                <div className="bg-slate-900 p-8 text-white">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="h-14 w-14 rounded-2xl bg-white/10 flex items-center justify-center border border-white/10">
                            <UserCircle className="h-8 w-8 text-[#D9F99D]" />
                        </div>
                        <div>
                            <h3 className="text-xl font-black italic uppercase tracking-tighter">{selectedEmployee?.name}</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{selectedEmployee?.company} • Salary History</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                            <p className="text-[7px] font-black text-slate-500 uppercase mb-1">Total Paid YTD</p>
                            <p className="text-sm font-black italic text-[#D9F99D]">₹{totalPaidYTD.toLocaleString()}</p>
                        </div>
                        <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                            <p className="text-[7px] font-black text-slate-500 uppercase mb-1">Avg. Net Pay</p>
                            <p className="text-sm font-black italic text-white">₹{avgNetPay.toLocaleString()}</p>
                        </div>
                        <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                            <p className="text-[7px] font-black text-slate-500 uppercase mb-1">Leaves Taken</p>
                            <p className="text-sm font-black italic text-rose-400">{leavesTaken} Days</p>
                        </div>
                    </div>
                </div>
                <div className="p-8 space-y-4">
                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Recent Payouts</p>
                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                        {loading ? (
                            <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest text-center py-8">Loading history...</p>
                        ) : history.length === 0 ? (
                            <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest text-center py-8">No payout history found</p>
                        ) : (
                            history.map((h, i) => (
                                <div key={i} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 bg-slate-50/30">
                                    <div className="flex items-center gap-3">
                                        <CalendarCheck className="h-4 w-4 text-slate-400" />
                                        <span className="text-[10px] font-black text-slate-900 uppercase">{h.month}</span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="text-xs font-black italic text-slate-900">₹{h.net.toLocaleString()}</span>
                                        <Badge className="bg-emerald-50 text-emerald-600 border-none font-black text-[7px] h-5 px-2 rounded-lg">{h.status}</Badge>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleDownload(h)}
                                            className="h-8 rounded-lg border-slate-100 font-black uppercase text-[7px] tracking-widest px-3 hover:bg-[#D9F99D] hover:text-slate-900 hover:border-[#D9F99D]"
                                        >
                                            <Download className="h-3.5 w-3.5 mr-1" /> PDF
                                        </Button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
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
