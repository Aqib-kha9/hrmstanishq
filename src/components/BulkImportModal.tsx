"use client";

import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileDown, Upload, Loader2, CheckCircle2, AlertCircle, FileSpreadsheet, Play, XCircle } from "lucide-react";
import { apiPost } from "@/lib/api-client";
import { cn } from "@/lib/utils";

type BulkImportModalProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    companies: { id: number; name: string }[];
    offices: { id: number; name: string }[];
    onSuccess: () => void;
};

type ParsedRow = Record<string, any>;

export function BulkImportModal({ open, onOpenChange, companies, offices, onSuccess }: BulkImportModalProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [step, setStep] = useState<1 | 2 | 3>(1); // 1: Download/Upload, 2: Preview/Map, 3: Processing/Result
    const [parsedData, setParsedData] = useState<ParsedRow[]>([]);

    // Progress
    const [isProcessing, setIsProcessing] = useState(false);
    const [processedCount, setProcessedCount] = useState(0);
    const [results, setResults] = useState<{ row: number; emp_code: string; name: string; success: boolean; error?: string }[]>([]);

    const downloadTemplate = () => {
        // 1. Employee Data Sheet
        const employeeData = [
            {
                "Emp Code (Optional)": "APA001",
                "Name (Required)": "John Doe",
                "Email (Required)": "john@company.com",
                "Phone": "9876543210",
                "Designation": "Software Engineer",
                "Department": "Engineering",
                "Date of Joining (YYYY-MM-DD)": "2024-01-15",
                "Gender (male/female/other)": "male",
                "Monthly Fixed CTC": 50000,
                "Company ID (Required)": companies[0]?.id || 1,
                "Office ID (Required)": offices[0]?.id || 1,
                "Bank Name": "HDFC Bank",
                "Bank Account Number": "12345678901234",
                "IFSC Code": "HDFC0001234",
                "PF Applicable (TRUE/FALSE)": "TRUE",
                "ESIC Applicable (TRUE/FALSE)": "FALSE"
            }
        ];

        // 2. Instructions Sheet
        const instructions = [
            { Column: "Emp Code (Optional)", Description: "Company-specific ID (e.g. APA001). Left blank, it auto-generates with company prefix." },
            { Column: "Name (Required)", Description: "Full name. Max 100 chars." },
            { Column: "Email (Required)", Description: "Valid email address." },
            { Column: "Phone", Description: "Phone number." },
            { Column: "Designation", Description: "Job Title (e.g., Manager)." },
            { Column: "Department", Description: "Department (e.g., Sales)." },
            { Column: "Date of Joining", Description: "Format: YYYY-MM-DD" },
            { Column: "Gender", Description: "male, female, or other" },
            { Column: "Monthly Fixed CTC", Description: "Number (e.g. 50000)" },
            { Column: "Company ID (Required)", Description: "Check the 'Companies & Offices' sheet for the correct ID." },
            { Column: "Office ID (Required)", Description: "Check the 'Companies & Offices' sheet for the correct ID." },
            { Column: "Bank Name", Description: "e.g., HDFC Bank" },
            { Column: "Bank Account Number", Description: "Up to 30 digits" },
            { Column: "IFSC Code", Description: "11 character code" },
            { Column: "PF Applicable", Description: "TRUE or FALSE. Defaults to TRUE if empty." },
            { Column: "ESIC Applicable", Description: "TRUE or FALSE. Defaults to FALSE if empty." },
        ];

        // 3. Reference Sheet
        const compSheet = companies.map(c => ({ "Type": "Company", "ID": c.id, "Name": c.name }));
        const offSheet = offices.map(o => ({ "Type": "Office", "ID": o.id, "Name": o.name }));
        const reference = [...compSheet, {}, ...offSheet];

        const wb = XLSX.utils.book_new();

        const wsData = XLSX.utils.json_to_sheet(employeeData);
        XLSX.utils.book_append_sheet(wb, wsData, "Employees Data");

        const wsInstr = XLSX.utils.json_to_sheet(instructions);
        XLSX.utils.book_append_sheet(wb, wsInstr, "Instructions");

        const wsRef = XLSX.utils.json_to_sheet(reference);
        XLSX.utils.book_append_sheet(wb, wsRef, "Companies & Offices");

        XLSX.writeFile(wb, "Employee_Bulk_Import_Template.xlsx");
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: "binary" });
                const wsname = wb.SheetNames[0]; // Assuming data is always on the first sheet
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);
                setParsedData(data as ParsedRow[]);
                setStep(2);
            } catch (err) {
                alert("Failed to parse Excel file.");
            }
        };
        reader.readAsBinaryString(file);
    };

    const parseBoolean = (val: any, defaultVal: boolean) => {
        if (val === undefined || val === null || val === "") return defaultVal;
        if (typeof val === "boolean") return val;
        if (typeof val === "string") return val.toUpperCase() === "TRUE";
        return defaultVal;
    };

    const startImport = async () => {
        setStep(3);
        setIsProcessing(true);
        setProcessedCount(0);
        setResults([]);

        const newResults = [];

        for (let i = 0; i < parsedData.length; i++) {
            const row = parsedData[i];

            // Company-specific emp_code (e.g. APA001) or null for backend auto-generation (Req 2.2)
            const rawCode = String(row["Emp Code (Optional)"] || "").trim().toUpperCase();
            const empCode = rawCode || null;

            // Build payload exactly as required by the backend
            const payload = {
                emp_code: empCode,
                name: String(row["Name (Required)"] || "").trim(),
                email: String(row["Email (Required)"] || "").trim(),
                phone: row["Phone"] ? String(row["Phone"]).trim() : null,
                password: "Password@123", // Default password per user request
                designation: row["Designation"] ? String(row["Designation"]).trim() : null,
                department: row["Department"] ? String(row["Department"]).trim() : null,
                role: "employee", // Default role
                date_of_joining: row["Date of Joining (YYYY-MM-DD)"] || null,
                gender: row["Gender (male/female/other)"]?.toLowerCase() || null,
                fixed_gross: row["Monthly Fixed CTC"] ? Number(row["Monthly Fixed CTC"]) : null,
                company_id: row["Company ID (Required)"] ? Number(row["Company ID (Required)"]) : null,
                office_id: row["Office ID (Required)"] ? Number(row["Office ID (Required)"]) : null,
                bank_name: row["Bank Name"] ? String(row["Bank Name"]) : null,
                bank_account_number: row["Bank Account Number"] ? String(row["Bank Account Number"]) : null,
                ifsc_code: row["IFSC Code"] ? String(row["IFSC Code"]) : null,
                pf_applicable: parseBoolean(row["PF Applicable (TRUE/FALSE)"], true),
                esic_applicable: parseBoolean(row["ESIC Applicable (TRUE/FALSE)"], false),
                send_offer_letter: false, // Per user request

                // Defaults for other complex fields to avoid validation errors
                pf_employee_rate: 0.12,
                pf_employer_rate: 0.12,
                esic_employee_rate: 0.0075,
                esic_employer_rate: 0.0325,
                pf_contribution_mode: "shared",
                esic_contribution_mode: "shared",
                shift_start_time: "10:00",
                shift_end_time: "19:00",
                half_day_late_minutes: 60,
                pt_applicable: true,
                effective_work_days: 26,
            };

            try {
                if (!payload.name || !payload.email || !payload.company_id || !payload.office_id) {
                    throw new Error("Missing required fields (Name, Email, Company ID, or Office ID)");
                }

                await apiPost("/auth/register", payload);
                newResults.push({
                    row: i + 2, // Accounting for header row
                    emp_code: payload.emp_code || "Auto",
                    name: payload.name,
                    success: true
                });
            } catch (err: any) {
                const msg = err.response?.data?.message || err.response?.data?.errors?.[0] || err.message || "Failed";
                newResults.push({
                    row: i + 2,
                    emp_code: payload.emp_code || "Auto",
                    name: payload.name,
                    success: false,
                    error: typeof msg === 'object' ? JSON.stringify(msg) : msg
                });
            }

            setProcessedCount(i + 1);
            setResults([...newResults]);
        }

        setIsProcessing(false);
        onSuccess();
    };

    const reset = () => {
        setStep(1);
        setParsedData([]);
        setResults([]);
        setProcessedCount(0);
        setIsProcessing(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    return (
        <Dialog open={open} onOpenChange={(val) => { if (!isProcessing) { onOpenChange(val); if (!val) setTimeout(reset, 500); } }}>
            <DialogContent className="sm:max-w-[700px] border-none shadow-2xl rounded-3xl p-8 bg-slate-50">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-black text-slate-900 italic tracking-tighter uppercase flex items-center gap-2">
                        <FileSpreadsheet className="h-6 w-6 text-emerald-500" />
                        Bulk Import Employees
                    </DialogTitle>
                    <DialogDescription className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">
                        {step === 1 && "Download the template, fill it out, and upload it back."}
                        {step === 2 && `Previewing ${parsedData.length} records found in the Excel.`}
                        {step === 3 && (isProcessing ? "Processing records..." : "Import complete.")}
                    </DialogDescription>
                </DialogHeader>

                <div className="mt-6">
                    {/* STEP 1: Download & Upload */}
                    {step === 1 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Download Card */}
                            <div className="bg-white rounded-[2rem] p-8 border border-slate-100 flex flex-col items-center justify-center text-center space-y-4 hover:border-emerald-200 transition-colors">
                                <div className="h-16 w-16 bg-emerald-50 rounded-2xl flex items-center justify-center">
                                    <FileDown className="h-8 w-8 text-emerald-500" />
                                </div>
                                <div>
                                    <h3 className="font-black text-slate-900 uppercase tracking-widest text-xs">1. Download Template</h3>
                                    <p className="text-[9px] font-bold text-slate-400 mt-2">Get the latest Excel template with deep instructions.</p>
                                </div>
                                <Button onClick={downloadTemplate} className="w-full bg-emerald-50 text-emerald-600 hover:bg-emerald-100 font-black text-[10px] uppercase tracking-widest rounded-xl h-10 mt-4">
                                    Download .XLSX
                                </Button>
                            </div>

                            {/* Upload Card */}
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="bg-white rounded-[2rem] p-8 border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-center space-y-4 hover:bg-slate-50 hover:border-indigo-300 transition-colors cursor-pointer"
                            >
                                <div className="h-16 w-16 bg-indigo-50 rounded-2xl flex items-center justify-center">
                                    <Upload className="h-8 w-8 text-indigo-500" />
                                </div>
                                <div>
                                    <h3 className="font-black text-slate-900 uppercase tracking-widest text-xs">2. Upload Filled File</h3>
                                    <p className="text-[9px] font-bold text-slate-400 mt-2">Upload the Excel file once you've filled the details.</p>
                                </div>
                                <Button variant="outline" className="w-full border-slate-200 text-slate-600 font-black text-[10px] uppercase tracking-widest rounded-xl h-10 mt-4 pointer-events-none">
                                    Browse File
                                </Button>
                                <input
                                    type="file"
                                    className="hidden"
                                    accept=".xlsx, .xls"
                                    ref={fileInputRef}
                                    onChange={handleFileUpload}
                                />
                            </div>
                        </div>
                    )}

                    {/* STEP 2: Preview */}
                    {step === 2 && (
                        <div className="space-y-6">
                            <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm max-h-[300px] overflow-y-auto">
                                <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-4">First 5 records preview</p>
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-slate-100">
                                            <th className="py-2 text-[9px] font-black text-slate-400 uppercase">Emp Code</th>
                                            <th className="py-2 text-[9px] font-black text-slate-400 uppercase">Name</th>
                                            <th className="py-2 text-[9px] font-black text-slate-400 uppercase">Email</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {parsedData.slice(0, 5).map((row, idx) => (
                                            <tr key={idx} className="border-b border-slate-50 last:border-none">
                                                <td className="py-2 text-[10px] font-bold text-slate-700">{row["Emp Code (Optional)"] || <span className="text-slate-400 italic">Auto</span>}</td>
                                                <td className="py-2 text-[10px] font-bold text-slate-700">{row["Name (Required)"]}</td>
                                                <td className="py-2 text-[10px] font-bold text-slate-700">{row["Email (Required)"]}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {parsedData.length > 5 && (
                                    <p className="text-center text-[9px] font-bold text-slate-400 mt-4 italic">+ {parsedData.length - 5} more records</p>
                                )}
                            </div>

                            <div className="flex gap-3 justify-end">
                                <Button variant="ghost" onClick={reset} className="font-black text-[10px] uppercase tracking-widest h-12 px-6 rounded-xl text-slate-500">
                                    Cancel
                                </Button>
                                <Button onClick={startImport} className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10px] uppercase tracking-[0.2em] h-12 px-8 rounded-xl shadow-lg flex items-center gap-2">
                                    <Play className="h-4 w-4" /> Start Import ({parsedData.length} records)
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* STEP 3: Progress & Results */}
                    {step === 3 && (
                        <div className="space-y-6">
                            {/* Progress bar */}
                            <div className="bg-white rounded-2xl p-6 border border-slate-100 space-y-4">
                                <div className="flex items-center justify-between">
                                    <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                                        {isProcessing ? <Loader2 className="h-4 w-4 animate-spin text-indigo-500" /> : <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                                        {isProcessing ? "Processing..." : "Finished"}
                                    </p>
                                    <p className="text-[10px] font-black text-slate-400">
                                        {processedCount} / {parsedData.length}
                                    </p>
                                </div>
                                <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-indigo-500 transition-all duration-300 ease-out"
                                        style={{ width: `${(processedCount / parsedData.length) * 100}%` }}
                                    />
                                </div>
                            </div>

                            {/* Results Table */}
                            <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm max-h-[250px] overflow-y-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-slate-100">
                                            <th className="py-2 text-[9px] font-black text-slate-400 uppercase">Row</th>
                                            <th className="py-2 text-[9px] font-black text-slate-400 uppercase">Emp Code</th>
                                            <th className="py-2 text-[9px] font-black text-slate-400 uppercase">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {results.map((res, idx) => (
                                            <tr key={idx} className="border-b border-slate-50">
                                                <td className="py-3 text-[10px] font-bold text-slate-500">#{res.row}</td>
                                                <td className="py-3 text-[10px] font-bold text-slate-700">{res.emp_code}</td>
                                                <td className="py-3">
                                                    {res.success ? (
                                                        <span className="flex items-center gap-1 text-[9px] font-black text-emerald-500 uppercase">
                                                            <CheckCircle2 className="h-3 w-3" /> Success
                                                        </span>
                                                    ) : (
                                                        <div className="flex flex-col gap-1">
                                                            <span className="flex items-center gap-1 text-[9px] font-black text-red-500 uppercase">
                                                                <XCircle className="h-3 w-3" /> Failed
                                                            </span>
                                                            <span className="text-[9px] font-bold text-red-400 leading-tight">
                                                                {res.error}
                                                            </span>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {!isProcessing && (
                                <div className="flex justify-end">
                                    <Button onClick={() => onOpenChange(false)} className="bg-slate-900 hover:bg-black text-white font-black text-[10px] uppercase tracking-[0.2em] h-12 px-8 rounded-xl shadow-lg">
                                        Close
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
