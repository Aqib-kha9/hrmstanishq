"use client";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import {
    ArrowLeft,
    Download,
    FileText,
    Building2,
    Wallet,
    Banknote,
    TrendingDown,
    Activity,
    Search,
    Filter,
    Mail
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Link from "next/link";
import { useState, use, useEffect } from "react";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { salaryToWords } from "@/lib/amount-to-words";
import { apiGet, apiPost } from "@/lib/api-client";

export default function CycleDetailsPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const cycleId = resolvedParams.id;

    const [searchQuery, setSearchQuery] = useState("");
    const [selectedBranch, setSelectedBranch] = useState("All Branches");
    const [loading, setLoading] = useState(true);
    const [cycleName, setCycleName] = useState("Loading...");
    const [transactions, setTransactions] = useState<any[]>([]);
    const [rawRows, setRawRows] = useState<any[]>([]);

    const branches = ["All Branches", ...Array.from(new Set(transactions.map((t: any) => t.branch).filter(Boolean)))] as string[];

    useEffect(() => {
        const load = async () => {
            try {
                const data = await apiGet<{ cycle: any; rows: any[] }>(`/payroll/ledger/${cycleId}`);
                const cycle = data.cycle;
                const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
                setCycleName(`${(monthNames[cycle.month_index] || cycle.month)?.substring(0, 3).toUpperCase()}-${cycle.year}`);

                const rows = (data.rows || []).map((r: any) => ({
                    id: r.employeeCode || r.id,
                    name: r.name,
                    role: r.designation || '',
                    branch: r.location || 'Unknown',
                    base: r.proratedGross || 0,
                    bonus: (r.bonus || 0) + (r.incentive || 0) + (r.previousArrears || 0),
                    pf: r.pf || 0,
                    pt: r.pt || 0,
                    net: r.net || 0,
                    status: (r.status === 'Paid' || r.status === 'Verified') ? 'Transferred' : 'Pending',
                }));
                setTransactions(rows);
                setRawRows(data.rows || []);
            } catch (e) {
                console.error("Failed to load cycle details:", e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [cycleId]);

    const filteredTransactions = transactions.filter(t => {
        const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            String(t.id).toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.branch.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesBranch = selectedBranch === "All Branches" || t.branch === selectedBranch;
        return matchesSearch && matchesBranch;
    });

    const totalBase = filteredTransactions.reduce((acc, curr) => acc + curr.base, 0);
    const totalBonus = filteredTransactions.reduce((acc, curr) => acc + curr.bonus, 0);
    const totalDeductions = filteredTransactions.reduce((acc, curr) => acc + curr.pf + curr.pt, 0);
    const totalNet = filteredTransactions.reduce((acc, curr) => acc + curr.net, 0);

    const handleExport = () => {
        const rows = filteredTransactions.map(t => ({
            "Employee ID": t.id,
            "Employee Name": t.name,
            "Designation": t.role,
            "Location": t.branch,
            "Base Salary": t.base,
            "Bonuses/Arrears": t.bonus,
            "PF Deducted": t.pf,
            "PT Deducted": t.pt,
            "Net Transferred": t.net,
            "Status": t.status
        }));
        
        const worksheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Cycle Audit");
        XLSX.writeFile(workbook, `Cycle_Audit_${cycleName}.xlsx`);
    };

    const handleViewPayslips = async () => {
        if (rawRows.length === 0) return;
        const doc = new jsPDF({ orientation: 'l', unit: 'mm', format: 'a5' });

        // Load logo image
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
            const tempImg = new Image();
            tempImg.src = '/company_logopng.png';
            tempImg.onload = () => resolve(tempImg);
            tempImg.onerror = (e) => reject(e);
        }).catch(() => null);
        
        rawRows.forEach((row, index) => {
            if (index > 0) doc.addPage();
            
            const pNet = row;
            const cycleText = cycleName;

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
                    ['Basic Salary', Number(pNet.basic || 0).toLocaleString('en-IN', {minimumFractionDigits: 2}), pNet.pf > 0 ? 'Provident Fund (PF)' : '', pNet.pf > 0 ? Number(pNet.pf).toLocaleString('en-IN', {minimumFractionDigits: 2}) : ''],
                    ['House Rent Allowance', Number(pNet.hra || 0).toLocaleString('en-IN', {minimumFractionDigits: 2}), pNet.esi > 0 ? 'Employee State Ins. (ESI)' : '', pNet.esi > 0 ? Number(pNet.esi).toLocaleString('en-IN', {minimumFractionDigits: 2}) : ''],
                    ['Special Allowance', Number(pNet.other || 0).toLocaleString('en-IN', {minimumFractionDigits: 2}), pNet.pt > 0 ? 'Professional Tax (PT)' : '', pNet.pt > 0 ? Number(pNet.pt).toLocaleString('en-IN', {minimumFractionDigits: 2}) : ''],
                    [row.conveyance ? 'Conveyance Allowance' : '', row.conveyance ? Number(row.conveyance).toLocaleString('en-IN', {minimumFractionDigits: 2}) : '', row.loanDeduction > 0 ? 'Loan Deduction' : '', row.loanDeduction > 0 ? Number(row.loanDeduction).toLocaleString('en-IN', {minimumFractionDigits: 2}) : '']
                ].filter(r => r.some(cell => cell !== '')),
                headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', lineWidth: 0.1, lineColor: [226, 232, 240] },
                bodyStyles: { textColor: [30, 30, 30], lineWidth: 0.1, lineColor: [226, 232, 240] },
                styles: { fontSize: 8, cellPadding: 3 },
                columnStyles: { 0: { cellWidth: 55 }, 1: { cellWidth: 35, halign: 'right' }, 2: { cellWidth: 55 }, 3: { cellWidth: 35, halign: 'right' } },
                foot: [['Gross Earnings', Number(pNet.totalEarnings || 0).toLocaleString('en-IN', {minimumFractionDigits: 2}), 'Gross Deductions', Number(pNet.grossDeductions || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})]],
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
            doc.text(`INR ${Number(pNet.net || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}`, 45, finalY + 18, { align: "center" });

            doc.line(75, finalY, 75, finalY + 25);

            doc.setFontSize(8);
            doc.setTextColor(...mutedColor);
            doc.text("Employer PF:", 85, finalY + 8);
            doc.text("Employer ESIC:", 85, finalY + 18);
            
            doc.setFont("helvetica", "bold");
            doc.setTextColor(...textColor);
            doc.text(Number(pNet.pfEmployer || 0).toLocaleString('en-IN', {minimumFractionDigits: 2}), 115, finalY + 8);
            doc.text(Number(pNet.esiEmployer || 0).toLocaleString('en-IN', {minimumFractionDigits: 2}), 115, finalY + 18);

            doc.setFillColor(254, 249, 195);
            doc.rect(140, finalY, 55, 25, 'F');
            doc.setFont("helvetica", "bold");
            doc.setFontSize(10);
            doc.setTextColor(133, 77, 14);
            doc.text("Total Monthly CTC", 167.5, finalY + 8, { align: "center" });
            doc.setFontSize(14);
            doc.text(`INR ${Number(pNet.totalMonthlyCTC || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}`, 167.5, finalY + 18, { align: "center" });

            doc.setFontSize(7);
            doc.setFont("helvetica", "italic");
            doc.setTextColor(...mutedColor);
            doc.text(`Amount in words: ${salaryToWords(pNet.net || 0)}`, 105, finalY + 32, { align: "center" });

            doc.setFont("helvetica", "normal");
            doc.setFontSize(6.5);
            doc.text("This is a computer-generated document and does not require a signature.", 105, 142, { align: "center" });
        });
        
        doc.save(`Payslips_${cycleName}.pdf`);
    };

    const generateSinglePayslip = async (mappedRowId: string) => {
        const row = rawRows.find((r: any) => (r.employeeCode || String(r.id)) === mappedRowId);
        if (!row) return;
        const doc = new jsPDF({ orientation: 'l', unit: 'mm', format: 'a5' });

        // Load logo image
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
            const tempImg = new Image();
            tempImg.src = '/company_logopng.png';
            tempImg.onload = () => resolve(tempImg);
            tempImg.onerror = (e) => reject(e);
        }).catch(() => null);

        const pNet = row;
        const cycleText = cycleName;

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
                ['Basic Salary', Number(pNet.basic || 0).toLocaleString('en-IN', {minimumFractionDigits: 2}), pNet.pf > 0 ? 'Provident Fund (PF)' : '', pNet.pf > 0 ? Number(pNet.pf).toLocaleString('en-IN', {minimumFractionDigits: 2}) : ''],
                ['House Rent Allowance', Number(pNet.hra || 0).toLocaleString('en-IN', {minimumFractionDigits: 2}), pNet.esi > 0 ? 'Employee State Ins. (ESI)' : '', pNet.esi > 0 ? Number(pNet.esi).toLocaleString('en-IN', {minimumFractionDigits: 2}) : ''],
                ['Special Allowance', Number(pNet.other || 0).toLocaleString('en-IN', {minimumFractionDigits: 2}), pNet.pt > 0 ? 'Professional Tax (PT)' : '', pNet.pt > 0 ? Number(pNet.pt).toLocaleString('en-IN', {minimumFractionDigits: 2}) : ''],
                [row.conveyance ? 'Conveyance Allowance' : '', row.conveyance ? Number(row.conveyance).toLocaleString('en-IN', {minimumFractionDigits: 2}) : '', row.loanDeduction > 0 ? 'Loan Deduction' : '', row.loanDeduction > 0 ? Number(row.loanDeduction).toLocaleString('en-IN', {minimumFractionDigits: 2}) : '']
            ].filter(r => r.some(cell => cell !== '')),
            headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', lineWidth: 0.1, lineColor: [226, 232, 240] },
            bodyStyles: { textColor: [30, 30, 30], lineWidth: 0.1, lineColor: [226, 232, 240] },
            styles: { fontSize: 8, cellPadding: 3 },
            columnStyles: { 0: { cellWidth: 55 }, 1: { cellWidth: 35, halign: 'right' }, 2: { cellWidth: 55 }, 3: { cellWidth: 35, halign: 'right' } },
            foot: [['Gross Earnings', Number(pNet.totalEarnings || 0).toLocaleString('en-IN', {minimumFractionDigits: 2}), 'Gross Deductions', Number(pNet.grossDeductions || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})]],
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
        doc.text(`INR ${Number(pNet.net || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}`, 45, finalY + 18, { align: "center" });

        doc.line(75, finalY, 75, finalY + 25);

        doc.setFontSize(8);
        doc.setTextColor(...mutedColor);
        doc.text("Employer PF:", 85, finalY + 8);
        doc.text("Employer ESIC:", 85, finalY + 18);
        
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...textColor);
        doc.text(Number(pNet.pfEmployer || 0).toLocaleString('en-IN', {minimumFractionDigits: 2}), 115, finalY + 8);
        doc.text(Number(pNet.esiEmployer || 0).toLocaleString('en-IN', {minimumFractionDigits: 2}), 115, finalY + 18);

        doc.setFillColor(254, 249, 195);
        doc.rect(140, finalY, 55, 25, 'F');
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(133, 77, 14);
        doc.text("Total Monthly CTC", 167.5, finalY + 8, { align: "center" });
        doc.setFontSize(14);
        doc.text(`INR ${Number(pNet.totalMonthlyCTC || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}`, 167.5, finalY + 18, { align: "center" });

        doc.setFontSize(7);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(...mutedColor);
        doc.text(`Amount in words: ${salaryToWords(pNet.net || 0)}`, 105, finalY + 32, { align: "center" });

        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.5);
        doc.text("This is a computer-generated document and does not require a signature.", 105, 142, { align: "center" });

        doc.save(`Payslip_${row.name?.replace(/\s+/g, '_')}_${cycleText}.pdf`);
    };

    const [sendingEmailId, setSendingEmailId] = useState<string | null>(null);
    const [sendingBulkEmail, setSendingBulkEmail] = useState(false);

    const handleSendEntryEmail = async (entryId: string, name: string) => {
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
        if (!confirm(`Are you sure you want to email salary slips to all employees for ${cycleName}?`)) return;
        setSendingBulkEmail(true);
        try {
            const res: any = await apiPost(`/payroll/cycle/${cycleId}/send-all-payslips`, {});
            alert(res?.message || `Dispatched payslip emails to all employees in ${cycleName}!`);
        } catch (e: any) {
            alert(e?.response?.data?.message || "Failed to dispatch payslips");
        } finally {
            setSendingBulkEmail(false);
        }
    };

    const handleDownloadPdf = async (row: any) => {
        try {
            const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
            const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
            const res = await fetch(`${apiBase}/payroll/entry/${row.id}/pdf`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Server returned non-200');
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Payslip_${row.name?.replace(/\s+/g, '_')}_${cycleName.replace(/\s+/g, '_')}.pdf`;
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (_) {
            await generateSinglePayslip(row.id);
        }
    };

    return (
        <ProtectedRoute module="PAYROLL" action="READ">
            <div className="space-y-8 pb-20">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 px-2 pt-4">
                    <div>
                        <Link href="/payroll/history" className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-500 transition-colors mb-4 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                            <ArrowLeft className="h-3 w-3" /> Back to Vault
                        </Link>
                        <h1 className="text-3xl font-black text-slate-900 italic uppercase tracking-tighter flex items-center gap-4">
                            Cycle Audit <span className="text-indigo-500 underline underline-offset-8 decoration-[#D9F99D] decoration-4">{cycleName}</span>
                        </h1>
                        <p className="text-[10px] font-black text-slate-400 mt-4 uppercase tracking-[0.4em]">Comprehensive Disbursement Breakdown</p>
                    </div>

                    <div className="flex bg-slate-100 p-1.5 rounded-2xl gap-2 flex-wrap">
                        <Button
                            variant="ghost"
                            onClick={handleViewPayslips}
                            className="h-11 px-6 rounded-xl font-black text-[9px] uppercase tracking-widest text-slate-500 hover:bg-white hover:shadow-sm transition-all"
                        >
                            <FileText className="h-4 w-4 mr-2" /> View Payslips
                        </Button>
                        <Button
                            variant="ghost"
                            onClick={handleSendAllPayslips}
                            disabled={sendingBulkEmail}
                            className="h-11 px-6 rounded-xl font-black text-[9px] uppercase tracking-widest text-indigo-600 hover:bg-white hover:shadow-sm transition-all"
                        >
                            <Mail className="h-4 w-4 mr-2" /> {sendingBulkEmail ? "Dispatching..." : "Email All Payslips"}
                        </Button>
                        <Button
                            onClick={handleExport}
                            className="bg-slate-900 text-white hover:bg-black font-black uppercase text-[9px] tracking-[0.3em] px-8 h-11 rounded-xl shadow-md transition-all"
                        >
                            <Download className="h-4 w-4 mr-2" /> Export CSV
                        </Button>
                    </div>
                </div>

                {/* Macro Financial Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 px-2">
                    <Card className="border-none shadow-sm rounded-2xl p-6 flex flex-col justify-between h-36 bg-slate-900 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform duration-500">
                            <Wallet className="h-24 w-24 text-white" />
                        </div>
                        <div className="relative z-10">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Net Payout</p>
                            <h4 className="text-3xl font-black italic tracking-tighter uppercase text-white flex items-center gap-1">
                                <span className="text-lg text-slate-500">₹</span>{totalNet.toLocaleString()}
                            </h4>
                        </div>
                    </Card>

                    <Card className="border-none shadow-sm rounded-2xl p-6 flex flex-col justify-between h-36 bg-[#E0E7FF] group hover:shadow-md transition-all">
                        <div className="flex items-start justify-between">
                            <div className="bg-white/50 p-2.5 rounded-xl group-hover:scale-110 transition-transform">
                                <Activity className="h-5 w-5 text-indigo-900" />
                            </div>
                        </div>
                        <div>
                            <h4 className="text-2xl font-black italic tracking-tighter uppercase text-indigo-900 flex items-center gap-1">
                                <span className="text-sm text-indigo-500/50">₹</span>{totalBase.toLocaleString()}
                            </h4>
                            <p className="text-[9px] font-bold text-slate-600 mt-1 uppercase tracking-widest">Base Salary</p>
                        </div>
                    </Card>

                    <Card className="border-none shadow-sm rounded-2xl p-6 flex flex-col justify-between h-36 bg-[#D1FAE5] group hover:shadow-md transition-all">
                        <div className="flex items-start justify-between">
                            <div className="bg-white/50 p-2.5 rounded-xl group-hover:scale-110 transition-transform">
                                <Banknote className="h-5 w-5 text-emerald-900" />
                            </div>
                        </div>
                        <div>
                            <h4 className="text-2xl font-black italic tracking-tighter uppercase text-emerald-900 flex items-center gap-1">
                                <span className="text-sm text-emerald-500/50">₹</span>{totalBonus.toLocaleString()}
                            </h4>
                            <p className="text-[9px] font-bold text-slate-600 mt-1 uppercase tracking-widest">Total Bonuses</p>
                        </div>
                    </Card>

                    <Card className="border-none shadow-sm rounded-2xl p-6 flex flex-col justify-between h-36 bg-[#FEE2E2] group hover:shadow-md transition-all">
                        <div className="flex items-start justify-between">
                            <div className="bg-white/50 p-2.5 rounded-xl group-hover:scale-110 transition-transform">
                                <TrendingDown className="h-5 w-5 text-rose-900" />
                            </div>
                        </div>
                        <div>
                            <h4 className="text-2xl font-black italic tracking-tighter uppercase text-rose-900 flex items-center gap-1">
                                <span className="text-sm text-rose-500/50">-₹</span>{totalDeductions.toLocaleString()}
                            </h4>
                            <p className="text-[9px] font-bold text-slate-600 mt-1 uppercase tracking-widest">Statutory Deductions</p>
                        </div>
                    </Card>
                </div>

                {/* Micro Employee Level Table */}
                <Card className="border-none shadow-sm rounded-[2.5rem] bg-white overflow-hidden p-1 mx-2">
                    <CardHeader className="p-6 pb-4 border-none flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <CardTitle className="text-lg font-black italic text-slate-900 uppercase tracking-tighter">Beneficiary Ledger</CardTitle>
                        <div className="flex items-center gap-4 bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
                            <div className="relative min-w-[200px] group">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                                <Input
                                    placeholder="Search Employee, ID..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="h-10 pl-10 pr-4 rounded-xl bg-white border-none shadow-sm font-bold text-[10px] focus:ring-2 ring-indigo-100"
                                />
                            </div>
                            <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                                <SelectTrigger className="h-10 w-[140px] rounded-xl bg-white border-none shadow-sm font-black text-[9px] uppercase tracking-widest text-slate-900">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="border-none shadow-xl rounded-2xl">
                                    {branches.map(b => (
                                        <SelectItem key={b} value={b} className="text-[10px] font-bold uppercase">{b}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Button variant="outline" className="h-10 px-4 rounded-xl border-none bg-white shadow-sm font-black uppercase text-[9px] tracking-widest text-slate-900 hover:bg-slate-100 transition-colors">
                                <Filter className="h-3.5 w-3.5 mr-2" /> Filter
                            </Button>
                        </div>
                    </CardHeader>

                    <Table>
                        <TableHeader>
                            <TableRow className="border-none bg-slate-50/50 hover:bg-slate-50/50">
                                <TableHead className="pl-8 h-16 text-[9px] font-black uppercase tracking-widest text-slate-400">Employee Information</TableHead>
                                <TableHead className="h-16 text-[9px] font-black uppercase tracking-widest text-slate-400">Base Salary</TableHead>
                                <TableHead className="h-16 text-[9px] font-black uppercase tracking-widest text-slate-400">Additions</TableHead>
                                <TableHead className="h-16 text-[9px] font-black uppercase tracking-widest text-slate-400">Deductions (PF/PT)</TableHead>
                                <TableHead className="h-16 text-[9px] font-black uppercase tracking-widest text-slate-400">Net Amount</TableHead>
                                <TableHead className="h-16 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right pr-8">Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredTransactions.map((t) => (
                                <TableRow key={t.id} className="group border-b border-dashed border-slate-100 hover:bg-slate-50/30 transition-all h-auto last:border-none">
                                    <TableCell className="pl-8 py-5">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-black text-slate-900 italic tracking-tight uppercase group-hover:translate-x-1 transition-transform">{t.name}</span>
                                            <div className="flex items-center gap-2 mt-1.5">
                                                <Badge className="bg-slate-100 text-slate-500 border-none font-black text-[7px] h-4 px-1.5 rounded uppercase tracking-widest">{t.id}</Badge>
                                                <div className="flex items-center gap-1 text-[8px] font-bold text-indigo-500 uppercase tracking-widest">
                                                    <Building2 className="h-3 w-3" />
                                                    {t.branch}
                                                </div>
                                            </div>
                                        </div>
                                    </TableCell>

                                    <TableCell className="py-5 text-slate-600 font-bold text-xs">
                                        ₹{t.base.toLocaleString()}
                                    </TableCell>

                                    <TableCell className="py-5">
                                        {t.bonus > 0 ? (
                                            <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-none font-black text-[8px] uppercase tracking-widest px-2 h-5 rounded-md shadow-sm">
                                                + ₹{t.bonus.toLocaleString()}
                                            </Badge>
                                        ) : (
                                            <span className="text-slate-300 text-xs font-black">-</span>
                                        )}
                                    </TableCell>

                                    <TableCell className="py-5">
                                        {t.pf + t.pt > 0 ? (
                                            <Badge variant="outline" className="bg-rose-50 text-rose-600 border-none font-black text-[8px] uppercase tracking-widest px-2 h-5 rounded-md shadow-sm">
                                                - ₹{(t.pf + t.pt).toLocaleString()}
                                            </Badge>
                                        ) : (
                                            <span className="text-slate-300 text-xs font-black">-</span>
                                        )}
                                    </TableCell>

                                    <TableCell className="py-5">
                                        <span className="text-base font-black text-slate-900 italic tracking-tighter">
                                            ₹{t.net.toLocaleString()}
                                        </span>
                                    </TableCell>

                                    <TableCell className="pr-8 py-5 text-right flex items-center justify-end gap-2">
                                        <Badge className={cn(
                                            "border-none font-black text-[8px] h-6 px-3 rounded-lg uppercase tracking-widest shadow-sm",
                                            t.status === 'Transferred' ? "bg-emerald-500 text-white" : "bg-amber-100 text-amber-700"
                                        )}>
                                            {t.status}
                                        </Badge>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleDownloadPdf(t)}
                                            className="h-8 rounded-lg border-slate-100 font-black uppercase text-[7px] tracking-widest px-3 hover:bg-[#D9F99D] hover:text-slate-900 hover:border-[#D9F99D] transition-all"
                                        >
                                            <Download className="h-3.5 w-3.5 mr-1.5" /> PDF
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleSendEntryEmail(t.id, t.name)}
                                            disabled={sendingEmailId === t.id}
                                            className="h-8 rounded-lg border-slate-100 font-black uppercase text-[7px] tracking-widest px-3 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-all"
                                            title="Email Payslip to Employee"
                                        >
                                            <Mail className="h-3.5 w-3.5 mr-1.5" /> {sendingEmailId === t.id ? "Sending..." : "Email"}
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Card>
            </div>
        </ProtectedRoute>
    );
}
