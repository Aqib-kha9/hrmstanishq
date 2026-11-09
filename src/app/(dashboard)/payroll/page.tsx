"use client";
import { cn } from "@/lib/utils";
import { apiGet, apiPatch, apiPost, apiGetPaginated, getToken } from "@/lib/api-client";

import { useRole } from "@/context/RoleContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useState, useEffect } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { salaryToWords } from "@/lib/amount-to-words";
import {
    Wallet,
    ArrowUpRight,
    History,
    Download,
    CheckCircle2,
    CreditCard,
    ShieldCheck,
    Briefcase,
    TrendingUp,
    FileText,
    ArrowDownRight,
    PieChart,
    Banknote,
    MoreHorizontal,
    Check,
    FileSpreadsheet,
    Plus,
    Info,
    Search,
    Filter,
    Clock,
    FileDown,
    LayoutList,
    SlidersHorizontal,
    CalendarCheck,
    AlertCircle,
    UserCircle,
    ChevronRight,
    ChevronLeft,
    Mail,
    Send
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetFooter,
} from "@/components/ui/sheet";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger
} from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import Link from "next/link";
import {
    GlobalRulesSheet,
    DisbursementDialog,
    EmployeeHistoryDialog,
    PayrollPolicyDialog
} from "@/components/payroll/PayrollModals";

const getInitials = (name: string) => {
    return name
        .split(" ")
        .filter(Boolean)
        .map(n => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();
};

export default function PayrollPage() {
    const [isConfigOpen, setIsConfigOpen] = useState(false);

    const [isSendDialogOpen, setIsSendDialogOpen] = useState(false);
    const [isPastOpen, setIsPastOpen] = useState(false);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [isPolicyOpen, setIsPolicyOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [selectedRows, setSelectedRows] = useState<number[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [cycleId, setCycleId] = useState<number | null>(null);
    const itemsPerPage = 10;

    const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
    const [disbursementStep, setDisbursementStep] = useState(1);
    const [txDetails, setTxDetails] = useState({
        mode: "NEFT/RTGS",
        reference: `PAY-BATCH-${new Date().getTime().toString().slice(-6)}`,
        authorizedBy: "HR Manager",
        remarks: "Monthly Payroll Release",
        sendEmails: true,
    });

    const [globalRules, setGlobalRules] = useState({
        pfEmployer: 12,
        pfEmployee: 12,
        hraPercent: 40,
        defaultPT: 200,
        cycle: "MAY 2026"
    });

    const [pastCycles, setPastCycles] = useState<any[]>([]);
    const [selectedBranch, setSelectedBranch] = useState("All Branches");
    const [branches, setBranches] = useState(["All Branches"]);

    const [ledger, setLedger] = useState<any[]>([]);
    const [elapsedDays, setElapsedDays] = useState<number | null>(null);

    // Email dispatch state (Req 3.1)
    const [sendingEmailId, setSendingEmailId] = useState<number | null>(null);
    const [sendingBulkEmail, setSendingBulkEmail] = useState(false);

    const handleSendEntryEmail = async (entryId: number, name: string) => {
        setSendingEmailId(entryId);
        try {
            await apiPost(`/payroll/entry/${entryId}/send-email`, {});
            alert(`Payslip email dispatched successfully to ${name}!`);
        } catch (e: any) {
            alert(e?.response?.data?.message || `Failed to send payslip email to ${name}`);
        } finally {
            setSendingEmailId(null);
        }
    };

    const handleSendAllPayslips = async () => {
        if (!cycleId) return;
        if (!confirm("Are you sure you want to email payslips to all employees in this cycle?")) return;
        setSendingBulkEmail(true);
        try {
            const res: any = await apiPost(`/payroll/cycle/${cycleId}/send-all-payslips`, {});
            alert(res.message || "All payslip emails dispatched successfully!");
        } catch (e: any) {
            alert(e?.response?.data?.message || "Failed to dispatch all payslips");
        } finally {
            setSendingBulkEmail(false);
        }
    };

    const handleDownloadPDF = async (row: any) => {
        try {
            const token = getToken();
            const apiBase = process.env.NEXT_PUBLIC_API_URL || "https://api.apaarpulse.com/api/v1";
            const res = await fetch(`${apiBase}/payroll/entry/${row.id}/pdf`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            if (res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Payslip_${row.name.replace(/\s+/g, '_')}.pdf`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
                return;
            }
        } catch (err) {
            console.warn("Backend PDF download fallback:", err);
        }
        await generatePayslip(row);
    };

    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, selectedBranch, statusFilter]);

    // ── Fetch data from backend ──
    const loadLedger = async () => {
        setLoading(true);
        try {
            const data = await apiGet<{ cycle: any; rows: any[] }>("/payroll/ledger");
            setLedger(data.rows || []);
            if (data.cycle) {
                setCycleId(data.cycle.id);
                // `data.cycle.month` is often formatted as 'June 2026' from the backend
                setGlobalRules(prev => ({ ...prev, cycle: `${String(data.cycle.month).replace(/\b\d{4}\b/g, '').trim()} ${data.cycle.year}` }));
                if (data.cycle.elapsedDays) setElapsedDays(data.cycle.elapsedDays);
            }
            // Extract unique branches
            const br = [...new Set((data.rows || []).map((r: any) => r.location).filter(Boolean))] as string[];
            setBranches(["All Branches", ...br]);
        } catch (e) {
            console.error("Failed to load payroll ledger:", e);
        } finally {
            setLoading(false);
        }
    };

    const loadPastCycles = async () => {
        try {
            const data = await apiGetPaginated<any>("/payroll/history", { limit: 3 });
            const items = (data.data || []).map((item: any) => ({
                month: item.month,
                totalPayout: `₹${(item.totalPayout || 0).toLocaleString()}`,
                employees: item.staff || 0,
                date: item.paid_on ? new Date(item.paid_on).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—',
            }));
            setPastCycles(items);
        } catch (e) {
            console.error("Failed to load past cycles:", e);
        }
    };

    useEffect(() => {
        loadLedger();
        loadPastCycles();
    }, []);

    const calculateProductionNet = (row: any) => {
        const daysInMonth = Number(row.dynamicDays) || 30;
        const elapsedDays = row.elapsedDays != null ? Math.min(Number(row.elapsedDays), daysInMonth) : daysInMonth;

        // Administrative Control & Manual Leave Adjustment (Req 4.1 & 4.2)
        const rawAbsent = Number(row.absentDays ?? row.absent_days ?? 0);
        const leaveAdjust = Number(row.leaveAdjustmentDays ?? row.leave_adjustment_days ?? 0);
        const carryForward = Number(row.leaveCarryForwardDays ?? row.leave_carry_forward_days ?? 0);

        const effectiveAbsentDays = Math.max(0, rawAbsent + leaveAdjust - carryForward);

        const manualPayable = row.manualPayableDays ?? row.manual_payable_days;
        const hasManualOverride = manualPayable !== null && manualPayable !== undefined && manualPayable !== "" && !isNaN(Number(manualPayable));
        const payableDays = hasManualOverride
            ? Math.max(0, Math.min(daysInMonth, Number(manualPayable)))
            : Math.max(0, elapsedDays - effectiveAbsentDays);

        const fixedGross = Number(row.fixedGross ?? row.fixed_gross) || 0;
        // Req 2.4: 50% Basic Salary of CTC/Gross
        const fixedBasic = Math.round(fixedGross * 0.50);
        const hraApplicable = (row.hraApplicable ?? row.hra_applicable) !== false && (row.hraApplicable ?? row.hra_applicable) !== "No";
        const fixedHra = hraApplicable ? Math.round(fixedBasic * 0.40) : 0;
        const fixedConv = Number(row.conveyance) || 0;
        const fixedMed = Number(row.medicalAllowance ?? row.medical_allowance) || 0;
        const fixedSpec = Number(row.specialAllowance ?? row.special_allowance) || 0;
        const fixedPerf = Number(row.performanceAllowance ?? row.performance_allowance) || 0;
        const fixedOther = Math.max(0, fixedGross - (fixedBasic + fixedHra + fixedConv + fixedMed + fixedSpec + fixedPerf));

        const basic = Math.round((fixedBasic / daysInMonth) * payableDays);
        const hra = Math.round((fixedHra / daysInMonth) * payableDays);
        const conveyance = Math.round((fixedConv / daysInMonth) * payableDays);
        const medicalAllowance = Math.round((fixedMed / daysInMonth) * payableDays);
        const specialAllowance = Math.round((fixedSpec / daysInMonth) * payableDays);
        const performanceAllowance = Math.round((fixedPerf / daysInMonth) * payableDays);
        const other = Math.round((fixedOther / daysInMonth) * payableDays);
        const proratedGross = basic + hra + conveyance + medicalAllowance + specialAllowance + performanceAllowance + other;

        const totalEarnings = proratedGross
            + (Number(row.previousArrears ?? row.previous_arrears) || 0)
            + (Number(row.bonus) || 0)
            + (Number(row.incentive) || 0);

        let pf = 0;
        if (row.pfApplicable ?? row.pf_applicable) {
            const pfBasic = (row.pfCeiling ?? row.pf_ceiling) ? Math.min(basic, 15000) : basic;
            pf = Math.round(pfBasic * 0.12);
        }

        let esi = 0;
        if (row.esicApplicable ?? row.esic_applicable) {
            esi = Math.ceil(totalEarnings * 0.0075);
        }

        let pt = 0;
        if ((row.ptApplicable ?? row.pt_applicable) !== false) {
            if (proratedGross > 33333) pt = 208;
            else if (proratedGross > 25000) pt = 167;
            else if (proratedGross > 15000) pt = 125;
        }

        const loanDeduction = Number(row.loanDeduction ?? row.loan_deduction) || 0;
        const otherDeduction = Number(row.otherDeduction ?? row.other_deduction) || 0;
        const grossDeductions = pf + esi + pt + loanDeduction + otherDeduction;
        const net = totalEarnings - grossDeductions;

        const pfEmployer = pf;
        const esiEmployer = (row.esicApplicable ?? row.esic_applicable) ? Math.ceil(totalEarnings * 0.0325) : 0;
        const totalMonthlyCTC = totalEarnings + pfEmployer + esiEmployer;
        const annualCTC = totalMonthlyCTC * 12;
        const lop = fixedGross - proratedGross;

        return {
            fixedGross, fixedBasic, fixedHra, fixedConv, fixedMed, fixedSpec, fixedPerf, fixedOther,
            basic, hra, conveyance, medicalAllowance, specialAllowance, performanceAllowance, other,
            proratedGross, totalEarnings,
            payableDays, effectiveAbsentDays,
            hasManualOverride,
            pf, esi, pt, grossDeductions, net,
            pfEmployer, esiEmployer, totalMonthlyCTC, annualCTC, lop
        };
    };

    const calculateNet = (row: any) => calculateProductionNet(row).net;

    const handleSalaryUpdate = async (id: number, field: string, value: any) => {
        setLedger(prev => prev.map(emp => {
            if (emp.id !== id) return emp;
            const updated = { ...emp, [field]: value };
            if (field === 'manualPayableDays') updated.manual_payable_days = value;
            if (field === 'leaveAdjustmentDays') updated.leave_adjustment_days = value;
            if (field === 'leaveCarryForwardDays') updated.leave_carry_forward_days = value;
            if (field === 'adminNotes') updated.admin_notes = value;
            return updated;
        }));
        setSelectedEmployee((prev: any) => {
            if (!prev || prev.id !== id) return prev;
            const updated = { ...prev, [field]: value };
            if (field === 'manualPayableDays') updated.manual_payable_days = value;
            if (field === 'leaveAdjustmentDays') updated.leave_adjustment_days = value;
            if (field === 'leaveCarryForwardDays') updated.leave_carry_forward_days = value;
            if (field === 'adminNotes') updated.admin_notes = value;
            return updated;
        });
        try {
            const backendField = field.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
            const res = await apiPatch<any>(`/payroll/entry/${id}`, { [backendField]: value });
            if (res && res.data) {
                setLedger(prev => prev.map(emp => emp.id === id ? { ...emp, ...res.data } : emp));
            }
        } catch (e) {
            console.error("Failed to update entry:", e);
        }
    };

    const handleExportExcel = () => {
        const rows = ledger.map(emp => {
            const res = calculateProductionNet(emp);
            const daysInMonth = 28;
            const payable = daysInMonth - emp.absentDays;
            return {
                "Employee Code": emp.employeeCode,
                "Employee Name": emp.name,
                "Location": emp.location,
                "Company": emp.company,
                "Gross Salary": emp.fixedGross,
                "Designation": emp.designation,
                "PF Applicable": emp.pfApplicable ? "Yes" : "No",
                "PF Ceiling": emp.pfCeiling ? "Yes" : "No",
                "ESIC Applicable": emp.esicApplicable ? "Yes" : "No",
                "Days In Month": daysInMonth,
                "Payable Days": payable,
                "Absent Days": emp.absentDays,
                "Basic": res.basic,
                "HRA": res.hra,
                "Other Allowance": res.other,
                "Previous Month Arrears": emp.previousArrears,
                "Bonus": emp.bonus,
                "Incentive": emp.incentive,
                "Gross Earnings": res.totalEarnings,
                "Provident Fund": res.pf,
                "ESIC": res.esi,
                "Professional Tax": res.pt,
                "Advance/Loan/TDS": emp.loanDeduction || 0,
                "Other Deduction": emp.otherDeduction || 0,
                "Gross Deductions": res.grossDeductions,
                "Net Salary": res.net,
                "PF Employer": res.pfEmployer,
                "ESIC Employer": res.esiEmployer,
                "Total Monthly CTC": res.totalMonthlyCTC
            };
        });

        const worksheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Payroll Data");
        XLSX.writeFile(workbook, `Payroll_Export_${globalRules.cycle.replace(" ", "_")}.xlsx`);
    };

    const filteredLedger = ledger.filter(emp => {
        const matchesBranch = selectedBranch === "All Branches" || emp.location === selectedBranch;
        const matchesSearch = emp.name.toLowerCase().includes(searchQuery.toLowerCase()) || emp.employeeCode.toString().includes(searchQuery);
        const matchesStatus = statusFilter === "ALL" || emp.status === statusFilter;
        return matchesBranch && matchesSearch && matchesStatus;
    });

    const totalPages = Math.ceil(filteredLedger.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedLedger = filteredLedger.slice(startIndex, startIndex + itemsPerPage);

    const toggleRow = (id: number) => {
        setSelectedRows(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const handleBulkPay = async () => {
        try {
            await Promise.all(
                selectedRows.map(id => apiPatch(`/payroll/entry/${id}/status`, { status: "Paid" }))
            );
            setLedger(prev => prev.map(emp => selectedRows.includes(emp.id) ? { ...emp, status: "Paid" } : emp));
            setSelectedRows([]);
        } catch (e) {
            console.error("Failed to bulk mark as paid:", e);
        }
    };

    const handleDisburseAll = async () => {
        if (!cycleId) return;
        try {
            await apiPost(`/payroll/disburse/${cycleId}`, {
                mode: txDetails.mode,
                reference: txDetails.reference,
                authorizedBy: txDetails.authorizedBy,
                remarks: txDetails.remarks,
                sendEmails: txDetails.sendEmails !== false,
            });
            setIsSendDialogOpen(false);
            setDisbursementStep(1);
            await loadLedger();
            await loadPastCycles();
        } catch (e) {
            console.error("Failed to disburse cycle:", e);
        }
    };

    const generatePayslip = async (row: any) => {
        const doc = new jsPDF({ orientation: 'l', unit: 'mm', format: 'a5' });
        const pNet = calculateProductionNet(row);
        const cycleText = globalRules?.cycle || 'June 2026';

        const primaryColor: [number, number, number] = [15, 23, 42]; // slate-900
        const accentColor: [number, number, number] = [37, 99, 235]; // blue-600
        const textColor: [number, number, number] = [30, 30, 30];
        const mutedColor: [number, number, number] = [100, 100, 100];
        const lineColor: [number, number, number] = [226, 232, 240]; // slate-200

        // Load logo image
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
            const tempImg = new Image();
            tempImg.src = '/company_logopng.png';
            tempImg.onload = () => resolve(tempImg);
            tempImg.onerror = (e) => reject(e);
        }).catch(() => null);

        // ── Top Accent Bar ──
        doc.setFillColor(...accentColor);
        doc.rect(0, 0, 210, 4, 'F');

        // ── Header ──
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

        // Title
        doc.setFillColor(248, 250, 252);
        doc.rect(15, 25, 180, 8, 'F');
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...primaryColor);
        doc.text(`PAYSLIP FOR THE MONTH OF ${cycleText.toUpperCase()}`, 105, 30, { align: "center" });

        // ── Employee Profile (Clean Grid) ──
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
        drawLabelValue("Emp ID:", row.employeeCode || "--", 80, currentY);
        drawLabelValue("UAN:", row.uan || "--", 145, currentY);

        currentY += 6;
        drawLabelValue("Designation:", row.designation || "--", 15, currentY);
        drawLabelValue("Department:", row.department || "--", 80, currentY);
        drawLabelValue("PF No:", row.pfNumber || "--", 145, currentY);

        currentY += 6;
        drawLabelValue("Bank Name:", row.bankName || "--", 15, currentY);
        drawLabelValue("A/C No:", row.bankAccountNumber || "--", 80, currentY);
        drawLabelValue("Days Worked:", String(row.workingDays || 0), 145, currentY);

        currentY += 6;
        drawLabelValue("Muster Days:", String(row.total_muster_days ?? 30), 15, currentY);
        drawLabelValue("Present Days:", String(row.present_days ?? (30 - (row.absentDays || 0))), 80, currentY);
        drawLabelValue("Payable Days:", String(row.payable_days ?? (30 - (row.absentDays || 0))), 145, currentY);

        currentY += 6;
        drawLabelValue("LWP Days:", String(row.lwp_days ?? row.absentDays ?? 0), 15, currentY);

        currentY += 8;

        // ── Salary Details Table (4 Columns) ──
        autoTable(doc, {
            startY: currentY,
            theme: 'grid',
            head: [['Earnings', 'Amount (INR)', 'Deductions', 'Amount (INR)']],
            body: [
                ['Basic Salary', Number(pNet.basic).toLocaleString('en-IN', {minimumFractionDigits: 2}), pNet.pf > 0 ? 'Provident Fund (PF)' : '', pNet.pf > 0 ? Number(pNet.pf).toLocaleString('en-IN', {minimumFractionDigits: 2}) : ''],
                ['House Rent Allowance', Number(pNet.hra).toLocaleString('en-IN', {minimumFractionDigits: 2}), pNet.esi > 0 ? 'Employee State Ins. (ESI)' : '', pNet.esi > 0 ? Number(pNet.esi).toLocaleString('en-IN', {minimumFractionDigits: 2}) : ''],
                ['Special Allowance', Number(pNet.other).toLocaleString('en-IN', {minimumFractionDigits: 2}), pNet.pt > 0 ? 'Professional Tax (PT)' : '', pNet.pt > 0 ? Number(pNet.pt).toLocaleString('en-IN', {minimumFractionDigits: 2}) : ''],
                [row.conveyance ? 'Conveyance Allowance' : '', row.conveyance ? Number(row.conveyance).toLocaleString('en-IN', {minimumFractionDigits: 2}) : '', row.loanDeduction > 0 ? 'Loan Deduction' : '', row.loanDeduction > 0 ? Number(row.loanDeduction).toLocaleString('en-IN', {minimumFractionDigits: 2}) : '']
            ].filter(r => r.some(cell => cell !== '')),
            headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', lineWidth: 0.1, lineColor: [226, 232, 240] },
            bodyStyles: { textColor: [30, 30, 30], lineWidth: 0.1, lineColor: [226, 232, 240] },
            styles: { fontSize: 8, cellPadding: 3 },
            columnStyles: {
                0: { cellWidth: 55 },
                1: { cellWidth: 35, halign: 'right' },
                2: { cellWidth: 55 },
                3: { cellWidth: 35, halign: 'right' }
            },
            foot: [['Gross Earnings', Number(pNet.totalEarnings).toLocaleString('en-IN', {minimumFractionDigits: 2}), 'Gross Deductions', Number(pNet.grossDeductions).toLocaleString('en-IN', {minimumFractionDigits: 2})]],
            footStyles: { fillColor: [255, 255, 255], textColor: [15, 23, 42], fontStyle: 'bold', lineWidth: 0.1, lineColor: [226, 232, 240] },
            margin: { left: 15, right: 15 }
        });

        const finalY = (doc as any).lastAutoTable.finalY + 8;

        // ── Excel Data Summary Section (Net, PF Employer, ESIC Employer, CTC) ──
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(...lineColor);
        doc.rect(15, finalY, 180, 25, 'FD');

        // Net Pay Highlight
        doc.setFillColor(220, 252, 231); // green-100
        doc.rect(15, finalY, 60, 25, 'F');
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(22, 101, 52); // green-800
        doc.text("Net Take Home", 45, finalY + 8, { align: "center" });
        doc.setFontSize(14);
        doc.text(`INR ${Number(pNet.net).toLocaleString('en-IN', {minimumFractionDigits: 2})}`, 45, finalY + 18, { align: "center" });

        // Divider
        doc.line(75, finalY, 75, finalY + 25);

        // CTC & Employer Contributions
        doc.setFontSize(8);
        doc.setTextColor(...mutedColor);
        doc.text("Employer PF:", 85, finalY + 8);
        doc.text("Employer ESIC:", 85, finalY + 18);
        
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...textColor);
        doc.text(Number(pNet.pfEmployer || 0).toLocaleString('en-IN', {minimumFractionDigits: 2}), 115, finalY + 8);
        doc.text(Number(pNet.esiEmployer || 0).toLocaleString('en-IN', {minimumFractionDigits: 2}), 115, finalY + 18);

        // Highlight CTC
        doc.setFillColor(254, 249, 195); // yellow-100
        doc.rect(140, finalY, 55, 25, 'F');
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(133, 77, 14); // yellow-800
        doc.text("Total Monthly CTC", 167.5, finalY + 8, { align: "center" });
        doc.setFontSize(14);
        doc.text(`INR ${Number(pNet.totalMonthlyCTC).toLocaleString('en-IN', {minimumFractionDigits: 2})}`, 167.5, finalY + 18, { align: "center" });

        // ── Footer ──
        doc.setFontSize(7);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(...mutedColor);
        doc.text(`Amount in words: ${salaryToWords(pNet.net)}`, 105, finalY + 32, { align: "center" });

        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.5);
        doc.text("This is a computer-generated document and does not require a signature.", 105, 142, { align: "center" });

        doc.save(`${row.name.replace(" ", "_")}_Payslip_${(globalRules?.cycle || "Draft").replace(" ", "")}.pdf`);
    };


    return (
        <ProtectedRoute module="PAYROLL" action="READ">
            <div className="space-y-10 pb-20">
                {/* Header */}
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between px-2">
                    <div>
                        <h1 className="text-xl font-black text-slate-900 flex items-center gap-3 italic uppercase tracking-tighter underline underline-offset-4 decoration-[#D9F99D] decoration-2">
                            <Wallet className="h-6 w-6 text-indigo-400 stroke-[2.5]" /> Salary Payments
                        </h1>
                        <div className="flex items-center gap-3 mt-4">
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.4em]">Payment Records • Salary Processing</p>
                            {elapsedDays && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[8px] font-black uppercase tracking-widest border border-amber-200">
                                    <Clock className="h-2.5 w-2.5" /> Pro-rated · Day {elapsedDays}
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-3">


                        <Link href="/payroll/analytics">
                            <Button
                                variant="outline"
                                className="h-10 px-6 rounded-xl border-2 border-slate-50 font-black uppercase text-[9px] tracking-widest text-slate-400 transition-all hover:bg-slate-50"
                            >
                                <PieChart className="h-4 w-4 mr-2" /> Analytics
                            </Button>
                        </Link>
                        <Link href="/payroll/history">
                            <Button
                                variant="outline"
                                className="h-10 px-6 rounded-xl border-2 border-slate-50 font-black uppercase text-[9px] tracking-widest text-slate-400 transition-all hover:bg-slate-50"
                            >
                                <History className="h-4 w-4 mr-2" /> Global History
                            </Button>
                        </Link>
                        <Button
                            onClick={handleSendAllPayslips}
                            disabled={sendingBulkEmail}
                            variant="outline"
                            className="h-11 px-6 rounded-2xl border-2 border-slate-100 font-black uppercase text-[9px] tracking-widest text-slate-800 transition-all hover:bg-slate-50"
                        >
                            {sendingBulkEmail ? (
                                <span className="flex items-center gap-1.5"><Clock className="h-4 w-4 animate-spin text-indigo-600" /> Sending...</span>
                            ) : (
                                <span className="flex items-center gap-1.5"><Mail className="h-4 w-4 text-indigo-600" /> Email All Payslips</span>
                            )}
                        </Button>
                        <Button
                            onClick={() => setIsSendDialogOpen(true)}
                            className="bg-[#D9F99D] text-slate-900 hover:bg-[#c8ea8a] font-black uppercase text-[9px] tracking-[0.3em] px-8 h-11 rounded-2xl  hover:translate-y-[-2px] transition-all"
                        >
                            Finalize Disbursement <ArrowUpRight className="h-4 w-4 ml-2" />
                        </Button>
                    </div>
                </div>



                {/* Smart Search & Advanced Filters */}
                <div className="flex flex-col md:flex-row items-center gap-4 bg-white/50 p-2 rounded-3xl backdrop-blur-sm border border-slate-50">
                    <div className="relative flex-1 group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                        <Input
                            placeholder="Search employee by name, ID or node..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="h-12 w-full pl-12 rounded-2xl bg-white border-none shadow-sm font-bold text-[11px] focus:ring-2 ring-indigo-100"
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                            <SelectTrigger className="h-12 w-[180px] rounded-xl border-2 border-slate-50 font-black uppercase text-[9px] tracking-widest text-slate-900 bg-white shadow-sm">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="border-none shadow-2xl rounded-2xl">
                                {branches.map(b => (
                                    <SelectItem key={b} value={b} className="font-bold text-[10px] uppercase">{b}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="h-12 w-[160px] rounded-2xl bg-white border-none shadow-sm font-black text-[9px] uppercase tracking-widest">
                                <Filter className="h-3.5 w-3.5 mr-2 text-slate-400" /> <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="border-none shadow-xl rounded-2xl">
                                <SelectItem value="ALL" className="text-[10px] font-bold uppercase">All Status</SelectItem>
                                <SelectItem value="Draft" className="text-[10px] font-bold uppercase">Draft</SelectItem>
                                <SelectItem value="Verified" className="text-[10px] font-bold uppercase">Verified</SelectItem>
                                <SelectItem value="Pending Audit" className="text-[10px] font-bold uppercase">Pending Audit</SelectItem>
                                <SelectItem value="Paid" className="text-[10px] font-bold uppercase">Paid Records</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button
                            variant="outline"
                            onClick={handleExportExcel}
                            className="h-12 px-6 rounded-2xl bg-white border-none shadow-sm font-black text-[9px] uppercase tracking-widest text-slate-900"
                        >
                            <FileSpreadsheet className="h-4 w-4 mr-2 text-emerald-500" /> Export Excel
                        </Button>
                    </div>
                </div>

                {/* Selected Batch Actions */}
                {selectedRows.length > 0 && (
                    <div className="bg-indigo-600 p-4 rounded-2xl flex items-center justify-between animate-in slide-in-from-top-4 duration-300">
                        <p className="text-white text-[10px] font-black uppercase tracking-widest">
                            {selectedRows.length} Employees Selected for Batch Action
                        </p>
                        <div className="flex gap-2">
                            <Button onClick={handleBulkPay} className="h-9 rounded-xl bg-white text-indigo-600 font-black text-[9px] uppercase tracking-widest px-6 hover:bg-indigo-50">Mark as Paid</Button>
                            <Button onClick={() => setSelectedRows([])} variant="ghost" className="h-9 rounded-xl text-white font-black text-[9px] uppercase tracking-widest hover:bg-white/10">Cancel</Button>
                        </div>
                    </div>
                )}



                {/* Active Ledger */}
                <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden p-1">
                    <CardHeader className="p-6 pb-3 border-none">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <CardTitle className="text-lg font-black italic text-slate-900 underline underline-offset-4 decoration-[#D9F99D] decoration-2 uppercase tracking-tighter">Monthly Salary List</CardTitle>
                                <CardDescription className="text-[8px] font-black text-slate-400 mt-4 uppercase tracking-[0.3em] italic">Branch salary details</CardDescription>
                            </div>
                            <Badge className="bg-slate-900 text-white border-none font-black text-[8px] tracking-[0.2em] px-4 py-2 rounded-xl uppercase">Cycle: {globalRules.cycle}</Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="mt-4">
                        <Table>
                            <TableHeader>
                                <TableRow className="border-none hover:bg-transparent">
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-6">Employee Details</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Days (Muster/Payable/LWP)</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Prorated Gross</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Deductions</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Statutory</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Net Payable</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Status</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-left">Actions</TableHead>
                                    <TableHead className="text-right pr-6 w-[60px]">
                                        <Checkbox
                                            checked={selectedRows.length === filteredLedger.length && filteredLedger.length > 0}
                                            onCheckedChange={(checked) => {
                                                if (checked) setSelectedRows(filteredLedger.map(e => e.id));
                                                else setSelectedRows([]);
                                            }}
                                            className="border-slate-300 data-[state=checked]:bg-slate-900 data-[state=checked]:border-slate-900 transition-all shadow-sm rounded-full h-4 w-4 cursor-pointer hover:border-slate-400 inline-block"
                                        />
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedLedger.map((row) => {
                                    const pNet = calculateProductionNet(row);
                                    return (
                                        <TableRow
                                            key={row.id}
                                            className={cn(
                                                "group border-none transition-all h-20 border-b border-dashed border-slate-50 last:border-none relative",
                                                selectedRows.includes(row.id)
                                                    ? "bg-slate-50/80 hover:bg-slate-50"
                                                    : "hover:bg-slate-50/50"
                                            )}
                                        >
                                            <TableCell className="pl-6 relative">
                                                {/* Premium left indicator line */}
                                                {selectedRows.includes(row.id) && (
                                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-900 rounded-r" />
                                                )}
                                                <div className="flex flex-col">
                                                    <p className="text-sm font-black text-slate-900 italic tracking-tight uppercase group-hover:translate-x-1 transition-transform">{row.name}</p>
                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                        <Badge className="bg-slate-50 text-slate-400 border-none font-black text-[7px] h-4 px-1.5 rounded uppercase tracking-widest">{row.designation}</Badge>
                                                        <Badge className="bg-indigo-50 text-indigo-500 border-none font-black text-[7px] h-4 px-1.5 rounded uppercase tracking-widest">{row.location}</Badge>
                                                        <span className="text-[7px] font-bold text-rose-500 uppercase tracking-widest">{row.absentDays > 0 ? `${row.absentDays} LWP` : 'Full Present'}</span>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-xs font-black text-slate-900">
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-[9px] font-bold text-slate-500">Muster: <strong className="text-slate-900">{row.total_muster_days ?? row.totalMusterDays ?? 30}</strong></span>
                                                    <span className="text-[9px] font-bold text-emerald-600 flex items-center gap-1">
                                                        Payable: <strong className="text-emerald-700">{pNet.payableDays}</strong>
                                                        {pNet.hasManualOverride && (
                                                            <Badge className="bg-amber-100 text-amber-800 border-none font-black text-[7px] px-1 h-3.5 rounded uppercase tracking-wider">Manual</Badge>
                                                        )}
                                                    </span>
                                                    <span className="text-[9px] font-bold text-rose-500">LWP: <strong className="text-rose-600">{pNet.effectiveAbsentDays}</strong></span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-xs font-black text-slate-900">
                                                <div className="flex flex-col">
                                                    <span>₹{pNet.totalEarnings.toLocaleString()}</span>
                                                    <span className="text-[7px] font-bold text-slate-400 uppercase tracking-widest">Base CTC: ₹{row.fixedGross.toLocaleString()}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-[10px] font-bold text-slate-600">
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-rose-500 font-black">₹{pNet.grossDeductions.toLocaleString()}</span>
                                                    <span className="text-[7px] uppercase tracking-widest text-slate-400">Total Deducted</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1">
                                                    {row.pfApplicable && <Badge className="bg-slate-900 text-white border-none font-black text-[7px] h-5 px-2 rounded-md uppercase tracking-widest">PF</Badge>}
                                                    {row.esicApplicable && <Badge className="bg-emerald-50 text-emerald-600 border-none font-black text-[7px] h-5 px-2 rounded-md uppercase tracking-widest">ESI</Badge>}
                                                    {!row.pfApplicable && !row.esicApplicable && <Badge className="bg-slate-50 text-slate-400 border-none font-black text-[7px] h-5 px-2 rounded-md uppercase tracking-widest">NONE</Badge>}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-xs font-black text-emerald-600 italic">₹{pNet.net.toLocaleString()}</TableCell>
                                            <TableCell>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <button className="focus:outline-none">
                                                            <Badge className={cn(
                                                                "border-none font-black text-[8px] uppercase tracking-widest px-3 h-6 rounded-lg shadow-sm cursor-pointer hover:opacity-80 transition-opacity",
                                                                row.status === 'Paid' ? 'bg-[#D1FAE5] text-emerald-600' :
                                                                    row.status === 'Verified' ? 'bg-blue-50 text-blue-600' :
                                                                        row.status === 'Pending Audit' ? 'bg-purple-50 text-purple-600' : 'bg-[#FEF3C7] text-amber-600'
                                                            )}>
                                                                {row.status}
                                                            </Badge>
                                                        </button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent className="border-none shadow-xl rounded-xl">
                                                        <DropdownMenuItem
                                                            className="text-[9px] font-black uppercase tracking-widest text-amber-600 hover:bg-amber-50 cursor-pointer"
                                                            onClick={() => handleSalaryUpdate(row.id, 'status', 'Draft')}
                                                        >
                                                            Draft
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            className="text-[9px] font-black uppercase tracking-widest text-purple-600 hover:bg-purple-50 cursor-pointer"
                                                            onClick={() => handleSalaryUpdate(row.id, 'status', 'Pending Audit')}
                                                        >
                                                            Pending Audit
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            className="text-[9px] font-black uppercase tracking-widest text-blue-600 hover:bg-blue-50 cursor-pointer"
                                                            onClick={() => handleSalaryUpdate(row.id, 'status', 'Verified')}
                                                        >
                                                            Verified
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            className="text-[9px] font-black uppercase tracking-widest text-emerald-600 hover:bg-emerald-50 cursor-pointer"
                                                            onClick={() => handleSalaryUpdate(row.id, 'status', 'Paid')}
                                                        >
                                                            Paid
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                            <TableCell className="text-left w-[240px]">
                                                <div className="flex items-center justify-start gap-1.5">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-8 px-2.5 rounded-lg border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100 text-indigo-700 font-bold text-[10px] gap-1.5 shadow-xs transition-all"
                                                        onClick={() => {
                                                            setSelectedEmployee(row);
                                                            setIsConfigOpen(true);
                                                        }}
                                                        title="Review & Adjust Leave / Payable Days"
                                                    >
                                                        <SlidersHorizontal className="h-3.5 w-3.5 text-indigo-600" />
                                                        <span>Adjust</span>
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-8 w-8 rounded-lg border-slate-100 p-0 hover:bg-slate-50"
                                                        onClick={() => {
                                                            setSelectedEmployee(row);
                                                            setIsHistoryOpen(true);
                                                        }}
                                                    >
                                                        <History className="h-4 w-4 text-slate-400" />
                                                    </Button>
                                                    <span title={row.status !== "Paid" ? "Payslip is only available after payment status is Paid" : "Download Payslip PDF"}>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => handleDownloadPDF(row)}
                                                            disabled={row.status !== "Paid"}
                                                            className="h-8 rounded-lg border-slate-100 font-black uppercase text-[7px] tracking-widest px-2.5 hover:bg-[#D9F99D] hover:text-slate-900 hover:border-[#D9F99D] transition-all disabled:opacity-30 disabled:pointer-events-none"
                                                        >
                                                            <Download className="h-3 w-3 mr-1" /> PDF
                                                        </Button>
                                                    </span>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleSendEntryEmail(row.id, row.name)}
                                                        disabled={sendingEmailId === row.id || row.status !== "Paid"}
                                                        title="Email Payslip to Employee"
                                                        className="h-8 rounded-lg border-slate-100 font-black uppercase text-[7px] tracking-widest px-2 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-100 transition-all disabled:opacity-30 disabled:pointer-events-none"
                                                    >
                                                        {sendingEmailId === row.id ? (
                                                            <Clock className="h-3 w-3 animate-spin text-indigo-600" />
                                                        ) : (
                                                            <span className="flex items-center gap-1"><Mail className="h-3 w-3 text-indigo-600" /> Mail</span>
                                                        )}
                                                    </Button>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right pr-6 w-[60px]">
                                                <Checkbox
                                                    checked={selectedRows.includes(row.id)}
                                                    onCheckedChange={() => toggleRow(row.id)}
                                                    className="border-slate-300 data-[state=checked]:bg-slate-900 data-[state=checked]:border-slate-900 transition-all shadow-sm rounded-full h-4 w-4 cursor-pointer hover:border-slate-400 inline-block"
                                                />
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>

                        {/* Pagination Controls */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-between mt-6 px-6 py-4 border-t border-slate-100 bg-slate-50/30">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredLedger.length)} of {filteredLedger.length} Employees
                                </p>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                        disabled={currentPage === 1}
                                        className="h-8 w-8 rounded-lg border-slate-100 p-0 hover:bg-slate-50 disabled:opacity-40"
                                    >
                                        <ChevronLeft className="h-4 w-4 text-slate-600" />
                                    </Button>
                                    <span className="text-[10px] font-black text-slate-900 mx-2 uppercase tracking-widest">
                                        Page {currentPage} of {totalPages}
                                    </span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                        disabled={currentPage === totalPages}
                                        className="h-8 w-8 rounded-lg border-slate-100 p-0 hover:bg-slate-50 disabled:opacity-40"
                                    >
                                        <ChevronRight className="h-4 w-4 text-slate-600" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>


                {/* Exported Modals */}
                <GlobalRulesSheet
                    isOpen={isConfigOpen}
                    onOpenChange={setIsConfigOpen}
                    selectedEmployee={selectedEmployee}
                    setSelectedEmployee={setSelectedEmployee}
                    globalRules={globalRules}
                    setGlobalRules={setGlobalRules}
                    handleSalaryUpdate={handleSalaryUpdate}
                    calculateProductionNet={calculateProductionNet}
                />

                <DisbursementDialog
                    isOpen={isSendDialogOpen}
                    onOpenChange={setIsSendDialogOpen}
                    disbursementStep={disbursementStep}
                    setDisbursementStep={setDisbursementStep}
                    txDetails={txDetails}
                    setTxDetails={setTxDetails}
                    ledger={ledger}
                    calculateProductionNet={calculateProductionNet}
                    handleDisburseAll={handleDisburseAll}
                />

                <EmployeeHistoryDialog
                    isOpen={isHistoryOpen}
                    onOpenChange={setIsHistoryOpen}
                    selectedEmployee={selectedEmployee}
                />


                {/* Floating Batch Action Bar */}
                {selectedRows.length > 0 && (
                    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-10 duration-500">
                        <div className="bg-slate-900 shadow-2xl rounded-3xl p-3 flex items-center gap-6 border border-white/10 backdrop-blur-xl">
                            <div className="pl-4 pr-6 border-r border-white/10">
                                <p className="text-[9px] font-black uppercase text-slate-500 tracking-[0.2em] mb-0.5">Selected</p>
                                <h5 className="text-sm font-black italic text-[#D9F99D] tracking-tighter uppercase">{selectedRows.length} Employees</h5>
                            </div>
                            <div className="flex items-center gap-3">
                                <Button
                                    onClick={handleBulkPay}
                                    className="h-10 rounded-xl bg-white text-slate-900 font-black uppercase text-[8px] tracking-widest px-6 hover:bg-[#D9F99D] transition-all"
                                >
                                    <CheckCircle2 className="h-3.5 w-3.5 mr-2" /> Mark as Paid
                                </Button>
                                <Button
                                    variant="outline"
                                    className="h-10 rounded-xl bg-white/5 border-white/10 text-white font-black uppercase text-[8px] tracking-widest px-6 hover:bg-white/10 transition-all"
                                >
                                    <Download className="h-3.5 w-3.5 mr-2" /> Download All
                                </Button>
                                <Button
                                    onClick={() => setSelectedRows([])}
                                    variant="ghost"
                                    className="h-10 rounded-xl text-slate-400 font-black uppercase text-[8px] tracking-widest px-4 hover:text-white"
                                >
                                    Clear
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </ProtectedRoute>
    );
}

