import * as XLSX from "xlsx";

export interface ExportPayrollOptions {
  targetEmployees: any[];
  cycleName: string;
  selectedCompany?: string;
}

/**
 * Exports the comprehensive multi-sheet Payroll Excel workbook containing
 * full dynamic Excel formulas matching the client's master spreadsheets:
 * 1. Monthly_Payroll_Ledger: Real-time payroll register with lived pro-ration & statutory formulas
 * 2. CTC_Calculator: Full 83-column horizontal CTC structure calculator with all client formulas
 * 3. Solver: Iterative Gross/Net to CTC solver formulas
 * 4. Minimum Wages: State & category minimum wage lookup table
 * 5. PT: State-wise Professional Tax slabs and rules
 */
export async function exportPayrollWithFormulas(options: ExportPayrollOptions): Promise<void> {
  const { targetEmployees, cycleName, selectedCompany } = options;
  if (!targetEmployees || targetEmployees.length === 0) return;

  let wb: XLSX.WorkBook;

  try {
    // Attempt to load client master template from public/templates
    const res = await fetch("/templates/Final_CTC_Structure_Calculator_Exgretia_Horizontal-1=.xlsx");
    if (res.ok) {
      const buffer = await res.arrayBuffer();
      wb = XLSX.read(buffer, { type: "array", cellFormula: true, cellStyles: true });
    } else {
      throw new Error(`Template fetch status: ${res.status}`);
    }
  } catch (err) {
    console.warn("Could not load template workbook from static assets, creating fresh workbook:", err);
    wb = XLSX.utils.book_new();
  }

  // Ensure sheets exist
  if (!wb.Sheets["CTC_Calculator"]) {
    wb.Sheets["CTC_Calculator"] = { "!ref": "A1:CE10" };
  }
  if (!wb.Sheets["Solver"]) {
    wb.Sheets["Solver"] = { "!ref": "A1:BH10" };
  }
  if (!wb.Sheets["Minimum Wages"]) {
    wb.Sheets["Minimum Wages"] = { "!ref": "A1:D20" };
  }
  if (!wb.Sheets["PT"]) {
    wb.Sheets["PT"] = { "!ref": "A1:AA45" };
  }

  // Sanitize Workbook Defined Names (eliminates "Removed Records: Named range from /xl/workbook.xml")
  wb.Workbook = wb.Workbook || {};
  wb.Workbook.Names = [
    {
      Name: "PT_State_List",
      Ref: "PT!$T$3:$T$34",
    },
  ];

  // Clean PT sheet (eliminates "Removed Records: Formula from /xl/worksheets/sheet5.xml")
  const ptWs = wb.Sheets["PT"];
  if (ptWs) {
    // Replace broken Table13 references with valid Excel formulas
    ptWs["I4"] = { t: "n", v: 125, f: "ROUND(H4/12,0)" };
    ptWs["I5"] = { t: "n", v: 167, f: "ROUND(H5/12,0)" };
    ptWs["I6"] = { t: "n", v: 208, f: "ROUND(H6/12,0)" };
    ptWs["I8"] = { t: "n", v: 175, f: "ROUND(H8/12,0)" };
    ptWs["I9"] = { t: "n", v: 208, f: "ROUND(H9/12,0)" };
    ptWs["I11"] = { t: "n", v: 208, f: "ROUND(H11/12,0)" };

    // Clear unused scratch columns L through S (removes [2]Sheet!E51 and dynamic array spills)
    for (let rowIdx = 1; rowIdx <= 45; rowIdx++) {
      ["L", "M", "N", "O", "P", "Q", "R", "S"].forEach((col) => {
        delete ptWs[`${col}${rowIdx}`];
      });
    }

    // Safety sweep for any stray external links or unresolved table formulas
    for (const cell in ptWs) {
      if (cell.startsWith("!")) continue;
      const c = ptWs[cell];
      if (c && c.f && (c.f.includes("[") || c.f.includes("_xlws") || c.f.includes("Table") || c.f.includes("#REF") || c.f.includes("#NAME"))) {
        delete ptWs[cell];
      }
    }
  }

  // ==========================================
  // SHEET 1: Monthly_Payroll_Ledger
  // ==========================================
  const wsLedger: XLSX.WorkSheet = {};
  const ledgerHeaders = [
    "Sr No", "Employee Code", "Employee Name", "Department", "Designation", "Company", "Location", "State",
    "Bank Name", "Account Number", "IFSC Code", "Days in Month", "Absent Days", "Payable Days",
    "Fixed Gross", "Fixed Basic", "Fixed HRA", "Fixed Other Allowances",
    "Earned Basic", "Earned HRA", "Earned Other Allowances", "Arrears", "Bonus", "Incentive", "Gross Earnings",
    "PF Applicable", "Employee PF", "ESIC Applicable", "Employee ESIC", "Professional Tax (PT)",
    "Loan EMI", "Other Deductions", "Total Deductions", "Net Salary",
    "Employer PF", "Employer ESIC", "Gratuity", "Total Employer Cost", "Total Monthly CTC", "Annual CTC", "Status",
    "Payment Mode", "PAN Number", "UAN Number"
  ];

  ledgerHeaders.forEach((h, colIdx) => {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: colIdx });
    wsLedger[cellRef] = { t: "s", v: h };
  });

  // ==========================================
  // SHEET 2: Bank_Disbursement (Corporate Payout Advice)
  // ==========================================
  const wsBank: XLSX.WorkSheet = {};
  const bankHeaders = [
    "Sr No", "Employee Code", "Beneficiary Name", "Company", "Branch / Location",
    "Bank Name", "Account Number", "IFSC Code", "Payment Mode", "Net Salary Payable (₹)",
    "PAN Number", "Narration / Remarks"
  ];
  bankHeaders.forEach((h, colIdx) => {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: colIdx });
    wsBank[cellRef] = { t: "s", v: h };
  });

  const totalEmployees = targetEmployees.length;

  targetEmployees.forEach((emp, idx) => {
    const r = idx + 2; // Excel 1-based row index (row 2..N+1)
    const daysInMonth = Number(emp.dynamicDays) || 30;
    const absentDays = Number(emp.effectiveAbsentDays ?? emp.absentDays ?? 0);
    const payableDays = Math.max(0, daysInMonth - absentDays);
    const fixedGross = Number(emp.fixedGross ?? emp.fixed_gross) || 0;
    const fixedBasic = Math.round(fixedGross * 0.50);
    const fixedHra = Math.round(fixedBasic * 0.40);
    const fixedOther = Math.max(0, fixedGross - fixedBasic - fixedHra);

    const basic = Math.round((fixedBasic / daysInMonth) * payableDays);
    const hra = Math.round((fixedHra / daysInMonth) * payableDays);
    const other = Math.round((fixedOther / daysInMonth) * payableDays);
    const arrears = Number(emp.previousArrears ?? emp.previous_arrears) || 0;
    const bonus = Number(emp.bonus) || 0;
    const incentive = Number(emp.incentive) || 0;
    const grossEarnings = basic + hra + other + arrears + bonus + incentive;

    const pfApplicable = Boolean(emp.pfApplicable ?? emp.pf_applicable);
    const pfCeiling = Boolean(emp.pfCeiling ?? emp.pf_ceiling);
    const pf = pfApplicable ? Math.round(Math.min(basic, pfCeiling ? 15000 : basic) * 0.12) : 0;

    const esicApplicable = Boolean(emp.esicApplicable ?? emp.esic_applicable);
    const esi = esicApplicable && grossEarnings <= 21000 ? Math.ceil(grossEarnings * 0.0075) : 0;

    let pt = 0;
    if ((emp.ptApplicable ?? emp.pt_applicable) !== false) {
      if (grossEarnings > 33333) pt = 208;
      else if (grossEarnings > 25000) pt = 167;
      else if (grossEarnings > 15000) pt = 125;
    }

    const loan = Number(emp.loanDeduction ?? emp.loan_deduction) || 0;
    const otherDed = Number(emp.otherDeduction ?? emp.other_deduction) || 0;
    const totalDeductions = pf + esi + pt + loan + otherDed;
    const net = grossEarnings - totalDeductions;

    const pfEmployer = pfApplicable ? Math.round(Math.min(basic, pfCeiling ? 15000 : basic) * 0.13) : 0;
    const esiEmployer = esicApplicable && grossEarnings <= 21000 ? Math.ceil(grossEarnings * 0.0325) : 0;
    const gratuity = Math.round(basic * 0.0481);
    const totalEmployerCost = pfEmployer + esiEmployer + gratuity;
    const monthlyCtc = grossEarnings + totalEmployerCost;
    const annualCtc = monthlyCtc * 12;

    const bankName = emp.bankName && emp.bankName !== '--' ? emp.bankName : (emp.bank_name || "—");
    const bankAccount = emp.bankAccountNumber && emp.bankAccountNumber !== '--'
      ? emp.bankAccountNumber
      : (emp.bank_account_number || emp.accountNumber || emp.bank_account_no || "—");
    const ifsc = emp.ifscCode && emp.ifscCode !== '--'
      ? emp.ifscCode
      : (emp.ifsc_code || emp.bank_ifsc || "—");
    const paymentMode = emp.paymentMode || emp.payment_mode || "Bank Transfer";
    const panNumber = emp.panNumber || emp.pan_number || "—";
    const uanNumber = emp.uan || "—";

    wsLedger[`A${r}`] = { t: "n", v: idx + 1 };
    wsLedger[`B${r}`] = { t: "s", v: String(emp.employeeCode || emp.emp_code || "") };
    wsLedger[`C${r}`] = { t: "s", v: String(emp.name || "") };
    wsLedger[`D${r}`] = { t: "s", v: String(emp.department || "Operations") };
    wsLedger[`E${r}`] = { t: "s", v: String(emp.designation || "Staff") };
    wsLedger[`F${r}`] = { t: "s", v: String(emp.company || "BP Marketing") };
    wsLedger[`G${r}`] = { t: "s", v: String(emp.location || "Indore") };
    wsLedger[`H${r}`] = { t: "s", v: String(emp.state || "MP") };
    wsLedger[`I${r}`] = { t: "s", v: String(bankName) };
    wsLedger[`J${r}`] = { t: "s", v: String(bankAccount) };
    wsLedger[`K${r}`] = { t: "s", v: String(ifsc) };
    wsLedger[`L${r}`] = { t: "n", v: daysInMonth };
    wsLedger[`M${r}`] = { t: "n", v: absentDays };
    wsLedger[`N${r}`] = { t: "n", f: `L${r}-M${r}`, v: payableDays };
    wsLedger[`O${r}`] = { t: "n", v: fixedGross };
    wsLedger[`P${r}`] = { t: "n", f: `ROUND(O${r}*0.5,0)`, v: fixedBasic };
    wsLedger[`Q${r}`] = { t: "n", f: `ROUND(P${r}*0.4,0)`, v: fixedHra };
    wsLedger[`R${r}`] = { t: "n", f: `MAX(0,O${r}-P${r}-Q${r})`, v: fixedOther };
    wsLedger[`S${r}`] = { t: "n", f: `ROUND((P${r}/L${r})*N${r},0)`, v: basic };
    wsLedger[`T${r}`] = { t: "n", f: `ROUND((Q${r}/L${r})*N${r},0)`, v: hra };
    wsLedger[`U${r}`] = { t: "n", f: `ROUND((R${r}/L${r})*N${r},0)`, v: other };
    wsLedger[`V${r}`] = { t: "n", v: arrears };
    wsLedger[`W${r}`] = { t: "n", v: bonus };
    wsLedger[`X${r}`] = { t: "n", v: incentive };
    wsLedger[`Y${r}`] = { t: "n", f: `SUM(S${r}:X${r})`, v: grossEarnings };
    wsLedger[`Z${r}`] = { t: "s", v: pfApplicable ? "Yes" : "No" };
    wsLedger[`AA${r}`] = { t: "n", f: `IF(Z${r}="Yes",ROUND(MIN(S${r},15000)*0.12,0),0)`, v: pf };
    wsLedger[`AB${r}`] = { t: "s", v: esicApplicable ? "Yes" : "No" };
    wsLedger[`AC${r}`] = { t: "n", f: `IF(AB${r}="Yes",IF(Y${r}<=21000,ROUND(Y${r}*0.0075,0),0),0)`, v: esi };
    wsLedger[`AD${r}`] = { t: "n", v: pt };
    wsLedger[`AE${r}`] = { t: "n", v: loan };
    wsLedger[`AF${r}`] = { t: "n", v: otherDed };
    wsLedger[`AG${r}`] = { t: "n", f: `SUM(AA${r},AC${r},AD${r},AE${r},AF${r})`, v: totalDeductions };
    wsLedger[`AH${r}`] = { t: "n", f: `Y${r}-AG${r}`, v: net };
    wsLedger[`AI${r}`] = { t: "n", f: `IF(Z${r}="Yes",ROUND(MIN(S${r},15000)*0.13,0),0)`, v: pfEmployer };
    wsLedger[`AJ${r}`] = { t: "n", f: `IF(AB${r}="Yes",IF(Y${r}<=21000,ROUND(Y${r}*0.0325,0),0),0)`, v: esiEmployer };
    wsLedger[`AK${r}`] = { t: "n", f: `ROUND(S${r}*0.0481,0)`, v: gratuity };
    wsLedger[`AL${r}`] = { t: "n", f: `SUM(AI${r}:AK${r})`, v: totalEmployerCost };
    wsLedger[`AM${r}`] = { t: "n", f: `Y${r}+AL${r}`, v: monthlyCtc };
    wsLedger[`AN${r}`] = { t: "n", f: `AM${r}*12`, v: annualCtc };
    wsLedger[`AO${r}`] = { t: "s", v: String(emp.status || "Verified") };
    wsLedger[`AP${r}`] = { t: "s", v: String(paymentMode) };
    wsLedger[`AQ${r}`] = { t: "s", v: String(panNumber) };
    wsLedger[`AR${r}`] = { t: "s", v: String(uanNumber) };

    // Populate Bank_Disbursement row
    wsBank[`A${r}`] = { t: "n", v: idx + 1 };
    wsBank[`B${r}`] = { t: "s", v: String(emp.employeeCode || emp.emp_code || "") };
    wsBank[`C${r}`] = { t: "s", v: String(emp.name || "") };
    wsBank[`D${r}`] = { t: "s", v: String(emp.company || "BP Marketing") };
    wsBank[`E${r}`] = { t: "s", v: String(emp.location || "Indore") };
    wsBank[`F${r}`] = { t: "s", v: String(bankName) };
    wsBank[`G${r}`] = { t: "s", v: String(bankAccount) };
    wsBank[`H${r}`] = { t: "s", v: String(ifsc) };
    wsBank[`I${r}`] = { t: "s", v: String(paymentMode) };
    wsBank[`J${r}`] = { t: "n", f: `'Monthly_Payroll_Ledger'!AH${r}`, v: net };
    wsBank[`K${r}`] = { t: "s", v: String(panNumber) };
    wsBank[`L${r}`] = { t: "s", v: `Salary Disbursement for ${cycleName}` };
  });

  // Summary Row at the bottom of the Ledger
  const lastRow = totalEmployees + 1;
  const totRow = lastRow + 1;
  wsLedger[`A${totRow}`] = { t: "s", v: "TOTAL" };
  const sumCols = ["O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "AA", "AC", "AD", "AE", "AF", "AG", "AH", "AI", "AJ", "AK", "AL", "AM", "AN"];
  sumCols.forEach(col => {
    wsLedger[`${col}${totRow}`] = { t: "n", f: `SUM(${col}2:${col}${lastRow})` };
  });
  wsLedger["!ref"] = `A1:AR${totRow}`;

  // Summary Row & Column Widths for Bank_Disbursement
  wsBank[`A${totRow}`] = { t: "s", v: "TOTAL" };
  wsBank[`J${totRow}`] = { t: "n", f: `SUM(J2:J${lastRow})` };
  wsBank["!ref"] = `A1:L${totRow}`;
  wsBank["!cols"] = [
    { wch: 8 },  // Sr No
    { wch: 15 }, // Emp Code
    { wch: 25 }, // Beneficiary Name
    { wch: 22 }, // Company
    { wch: 20 }, // Location
    { wch: 22 }, // Bank Name
    { wch: 22 }, // Account Number
    { wch: 15 }, // IFSC Code
    { wch: 16 }, // Payment Mode
    { wch: 22 }, // Net Salary Payable
    { wch: 15 }, // PAN Number
    { wch: 32 }, // Narration
  ];

  // ==========================================
  // SHEET 2: CTC_Calculator (83-column Client Layout)
  // ==========================================
  const calcWs = wb.Sheets["CTC_Calculator"];
  targetEmployees.forEach((emp, idx) => {
    const r = idx + 4; // Excel row index 4..N+3
    const fixedGross = Number(emp.fixedGross ?? emp.fixed_gross) || 0;
    const annualAmount = fixedGross * 12;

    calcWs[`A${r}`] = { t: "n", v: idx + 1 };
    calcWs[`B${r}`] = { t: "s", v: String(emp.employeeCode || emp.emp_code || "") };
    calcWs[`C${r}`] = { t: "s", v: String(emp.name || "") };
    calcWs[`D${r}`] = { t: "s", v: String(emp.designation || "Staff") };
    calcWs[`E${r}`] = { t: "s", v: String(emp.location || "Indore") };
    calcWs[`F${r}`] = { t: "s", v: String(emp.company || "BP Marketing") };
    calcWs[`G${r}`] = { t: "s", v: String(emp.state || "MP") };
    calcWs[`H${r}`] = { t: "s", v: String(emp.wagesCategory || "Skilled") };
    calcWs[`I${r}`] = { t: "n", f: `IF(OR($G${r}="",$H${r}=""),0,SUMPRODUCT(MAX(('Minimum Wages'!$A$2:$A$300=$G${r})*('Minimum Wages'!$B$2:$B$300=$H${r})*'Minimum Wages'!$C$2:$C$300)))` };
    calcWs[`J${r}`] = { t: "s", v: "CTC" };
    calcWs[`K${r}`] = { t: "n", v: annualAmount };
    calcWs[`L${r}`] = { t: "n", f: `IF($K${r}="","",$K${r}/12)` };
    calcWs[`M${r}`] = { t: "n", v: 0.50 };
    calcWs[`N${r}`] = { t: "n", v: 0.40 };
    calcWs[`O${r}`] = { t: "n", v: 0.13 };
    calcWs[`P${r}`] = { t: "n", v: 0.12 };
    calcWs[`Q${r}`] = { t: "s", v: (emp.pfApplicable ?? emp.pf_applicable) ? "Yes" : "No" };
    calcWs[`R${r}`] = { t: "n", v: 25000 };
    calcWs[`S${r}`] = { t: "n", v: 0.0481 };
    calcWs[`T${r}`] = { t: "s", v: "Yes" };
    calcWs[`U${r}`] = { t: "n", v: 0.0833 };
    calcWs[`V${r}`] = { t: "s", v: (emp.esicApplicable ?? emp.esic_applicable) ? "Yes" : "No" };
    calcWs[`W${r}`] = { t: "s", v: "Basic" };
    calcWs[`X${r}`] = { t: "n", v: 0.0325 };
    calcWs[`Y${r}`] = { t: "n", v: 0.0075 };
    calcWs[`Z${r}`] = { t: "n", v: 21000 };
    calcWs[`AA${r}`] = { t: "n", f: `CC${r}` };
    calcWs[`AB${r}`] = { t: "n", v: 0 };
    calcWs[`AC${r}`] = { t: "n", v: 0 };
    calcWs[`AD${r}`] = { t: "n", v: Number(emp.loanDeduction ?? emp.loan_deduction) || 0 };
    calcWs[`AE${r}`] = { t: "n", v: Number(emp.otherDeduction ?? emp.other_deduction) || 0 };
    calcWs[`AF${r}`] = { t: "n", v: 0 };
    calcWs[`AG${r}`] = { t: "n", f: `IF(OR($J${r}="",$K${r}=""),"",IF($J${r}="CTC",$K${r},IF($J${r}="Gross",Solver!$AH${r},IF($J${r}="Net Take Home",Solver!$BH${r},""))))` };
    calcWs[`AH${r}`] = { t: "n", f: `IF(OR($J${r}="",$K${r}=""),"",Solver!$F${r}*$O${r})` };
    calcWs[`AI${r}`] = { t: "n", f: `IF(OR($J${r}="",$K${r}=""),"",Solver!$G${r}*$X${r})` };
    calcWs[`AJ${r}`] = { t: "n", f: `IF(OR($J${r}="",$K${r}=""),"",$AN${r}*$S${r})` };
    calcWs[`AK${r}`] = { t: "n", f: `IF(OR($J${r}="",$K${r}=""),"",IF($AN${r}/12>21000,0,MAX(7000,$I${r})*12*Solver!$C${r}))` };
    calcWs[`AL${r}`] = { t: "n", f: `IF(OR($J${r}="",$K${r}=""),"",IF($AN${r}/12>21000,$AN${r}*Solver!$C${r},0))` };
    calcWs[`AM${r}`] = { t: "n", f: `IF(OR($J${r}="",$K${r}=""),"",$AG${r}-$AH${r}-$AI${r}-$AJ${r}-$AK${r}-$AL${r})` };
    calcWs[`AN${r}`] = { t: "n", f: `IF(OR($J${r}="",$K${r}=""),"",MAX($AG${r}*$M${r},$I${r}*12))` };
    calcWs[`AO${r}`] = { t: "n", f: `IF(OR($J${r}="",$K${r}=""),"",MAX(0,MIN($AN${r}*$N${r},ROUND($AM${r}-$AN${r},2))))` };
    calcWs[`AP${r}`] = { t: "n", f: `IF(OR($J${r}="",$K${r}=""),"",MAX(0,MIN($AF${r},ROUND($AM${r}-$AN${r}-$AO${r},2))))` };
    calcWs[`AQ${r}`] = { t: "n", f: `IF(OR($J${r}="",$K${r}=""),"",ROUND($AM${r}-$AN${r}-$AO${r}-$AP${r},2))` };
    calcWs[`AR${r}`] = { t: "n", f: `IF(OR($J${r}="",$K${r}=""),"",$AM${r})` };
    calcWs[`AS${r}`] = { t: "n", f: `IF(OR($J${r}="",$K${r}=""),"",Solver!$F${r}*$P${r})` };
    calcWs[`AT${r}`] = { t: "n", f: `IF(OR($J${r}="",$K${r}=""),"",Solver!$G${r}*$Y${r})` };
    calcWs[`AU${r}`] = { t: "n", f: `IF(OR($J${r}="",$K${r}=""),"",$AA${r}*12)` };
    calcWs[`AV${r}`] = { t: "n", f: `IF(OR($J${r}="",$K${r}=""),"",$AB${r}*12)` };
    calcWs[`AW${r}`] = { t: "n", f: `IF(OR($J${r}="",$K${r}=""),"",$AC${r}*12)` };
    calcWs[`AX${r}`] = { t: "n", f: `IF(OR($J${r}="",$K${r}=""),"",$AD${r}*12)` };
    calcWs[`AY${r}`] = { t: "n", f: `IF(OR($J${r}="",$K${r}=""),"",$AE${r}*12)` };
    calcWs[`AZ${r}`] = { t: "n", f: `IF(OR($J${r}="",$K${r}=""),"",SUM($AS${r}:$AY${r}))` };
    calcWs[`BA${r}`] = { t: "n", f: `IF(OR($J${r}="",$K${r}=""),"",$AR${r}-$AZ${r})` };
    calcWs[`BB${r}`] = { t: "n", f: `IF(AG${r}="","",AG${r}/12)` };
    calcWs[`BC${r}`] = { t: "n", f: `IF(AH${r}="","",AH${r}/12)` };
    calcWs[`BD${r}`] = { t: "n", f: `IF(AI${r}="","",AI${r}/12)` };
    calcWs[`BE${r}`] = { t: "n", f: `IF(AJ${r}="","",AJ${r}/12)` };
    calcWs[`BF${r}`] = { t: "n", f: `IF(AK${r}="","",AK${r}/12)` };
    calcWs[`BG${r}`] = { t: "n", f: `IF(AL${r}="","",AL${r}/12)` };
    calcWs[`BH${r}`] = { t: "n", f: `IF(AM${r}="","",AM${r}/12)` };
    calcWs[`BI${r}`] = { t: "n", f: `IF(AN${r}="","",AN${r}/12)` };
    calcWs[`BJ${r}`] = { t: "n", f: `IF(AO${r}="","",AO${r}/12)` };
    calcWs[`BK${r}`] = { t: "n", f: `IF(AP${r}="","",AP${r}/12)` };
    calcWs[`BL${r}`] = { t: "n", f: `IF(AQ${r}="","",AQ${r}/12)` };
    calcWs[`BM${r}`] = { t: "n", f: `IF(AR${r}="","",AR${r}/12)` };
    calcWs[`BN${r}`] = { t: "n", f: `IF(AS${r}="","",AS${r}/12)` };
    calcWs[`BO${r}`] = { t: "n", f: `IF(AT${r}="","",AT${r}/12)` };
    calcWs[`BP${r}`] = { t: "n", f: `IF(AU${r}="","",AU${r}/12)` };
    calcWs[`BQ${r}`] = { t: "n", f: `IF(AV${r}="","",AV${r}/12)` };
    calcWs[`BR${r}`] = { t: "n", f: `IF(AW${r}="","",AW${r}/12)` };
    calcWs[`BS${r}`] = { t: "n", f: `IF(AX${r}="","",AX${r}/12)` };
    calcWs[`BT${r}`] = { t: "n", f: `IF(AY${r}="","",AY${r}/12)` };
    calcWs[`BU${r}`] = { t: "n", f: `IF(AZ${r}="","",AZ${r}/12)` };
    calcWs[`BV${r}`] = { t: "n", f: `IF(BA${r}="","",BA${r}/12)` };
    calcWs[`BW${r}`] = { t: "s", f: `IF(OR($J${r}="",$K${r}=""),"",IF($I${r}*12>$AG${r}*$M${r},"Minimum Wage","% of CTC"))` };
    calcWs[`BX${r}`] = { t: "s", f: `IF(OR($J${r}="",$K${r}=""),"",IF(Solver!$H${r}<>"OK","NOT CONVERGED",IF(AND(ABS($AM${r}+$AH${r}+$AI${r}+$AJ${r}+$AK${r}+$AL${r}-$AG${r})<0.01,OR($J${r}="CTC",AND($J${r}="Gross",ABS($AM${r}-$K${r})<1),AND($J${r}="Net Take Home",ABS($BA${r}-$K${r})<1))),"OK","CHECK")))` };
    calcWs[`BZ${r}`] = { t: "s", v: emp.state === "MP" ? "Madhya Pradesh" : (emp.state || "Madhya Pradesh") };
    calcWs[`CA${r}`] = { t: "s", v: emp.gender || "All" };
    calcWs[`CB${r}`] = { t: "s", f: `IF($BZ${r}="","",IFERROR(INDEX(PT!$D$3:$D$42,MATCH($BZ${r},PT!$B$3:$B$42,0)),IFERROR(INDEX(PT!$D$3:$D$42,MATCH($BZ${r},PT!$C$3:$C$42,0)),"No")))` };
    calcWs[`CC${r}`] = { t: "n", f: `IFERROR(IF($BH${r}="","",IF(OR($BZ${r}="",$CA${r}="",$CB${r}=""),0,IFERROR(INDEX(PT!$I$3:$I$42,MATCH(1,INDEX((PT!$X$3:$X$42=$BZ${r})*(PT!$Y$3:$Y$42=$CB${r})*((PT!$E$3:$E$42=$CA${r})+(PT!$E$3:$E$42="All")>0)*(PT!$F$3:$F$42<=$BH${r})*(((ISNUMBER(PT!$G$3:$G$42))*(PT!$G$3:$G$42>=$BH${r}))+(PT!$G$3:$G$42="& Above")>0),0),0)),0))),0)` };
    calcWs[`CD${r}`] = { t: "n", v: fixedGross };
    delete calcWs[`CD${r}`].f;
    calcWs[`CE${r}`] = { t: "n", f: `BV${r}-CD${r}` };
  });

  // Clean empty rows in CTC_Calculator beyond actual employees
  const maxCalcRow = totalEmployees + 3;
  for (const cell in calcWs) {
    if (cell.startsWith("!")) continue;
    const match = cell.match(/[0-9]+/);
    if (match && parseInt(match[0], 10) > maxCalcRow) {
      delete calcWs[cell];
    }
  }
  calcWs["!ref"] = `A1:CE${maxCalcRow}`;

  // ==========================================
  // SHEET 3: Solver (Full 60-column Dynamic Calculations)
  // ==========================================
  const solverWs = wb.Sheets["Solver"];
  const grossCols = [
    "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z", "AA", "AB", "AC", "AD", "AE", "AF", "AG", "AH"
  ];
  const netCols = [
    "AI", "AJ", "AK", "AL", "AM", "AN", "AO", "AP", "AQ", "AR", "AS", "AT", "AU", "AV", "AW", "AX", "AY", "AZ", "BA", "BB", "BC", "BD", "BE", "BF", "BG", "BH"
  ];

  targetEmployees.forEach((emp, idx) => {
    const r = idx + 4;
    solverWs[`A${r}`] = { t: "n", f: `IF(CTC_Calculator!$A${r}="","",CTC_Calculator!$A${r})` };
    solverWs[`B${r}`] = { t: "s", f: `IF(CTC_Calculator!$B${r}="","",CTC_Calculator!$B${r})` };
    solverWs[`C${r}`] = { t: "n", f: `IF(CTC_Calculator!$T${r}="Yes",CTC_Calculator!$U${r},0)` };
    solverWs[`D${r}`] = { t: "n", f: `IF(CTC_Calculator!$Q${r}="Yes",IF(CTC_Calculator!$R${r}>0,CTC_Calculator!$R${r}*12,1000000000000000),0)` };
    solverWs[`E${r}`] = { t: "n", f: `IF(CTC_Calculator!$V${r}="Yes",IF(CTC_Calculator!$Z${r}>0,CTC_Calculator!$Z${r}*12,1000000000000000),0)` };
    solverWs[`F${r}`] = { t: "n", f: `IF(OR(CTC_Calculator!$J${r}="",CTC_Calculator!$K${r}=""),"",MIN(CTC_Calculator!$AN${r},$D${r}))` };
    solverWs[`G${r}`] = { t: "n", f: `IF(OR(CTC_Calculator!$J${r}="",CTC_Calculator!$K${r}=""),"",IF(CTC_Calculator!$V${r}="No",0,IF(CTC_Calculator!$W${r}="Basic",MIN(CTC_Calculator!$AN${r},$E${r}),MIN((CTC_Calculator!$AG${r}-CTC_Calculator!$AH${r}-CTC_Calculator!$AJ${r}-CTC_Calculator!$AK${r}-CTC_Calculator!$AL${r})/(1+CTC_Calculator!$X${r}),$E${r}))))` };
    solverWs[`H${r}`] = { t: "s", f: `IF(OR(CTC_Calculator!$J${r}="",CTC_Calculator!$K${r}=""),"",IF(CTC_Calculator!$J${r}="CTC","OK",IF(CTC_Calculator!$J${r}="Gross",IF(ABS(AH${r}-AG${r})<0.01,"OK","NOT CONVERGED"),IF(ABS(BH${r}-BG${r})<0.01,"OK","NOT CONVERGED"))))` };

    // Gross basis iterations 0..25 (Cols I to AH)
    solverWs[`I${r}`] = { t: "n", f: `IF(OR(CTC_Calculator!$A${r}="",CTC_Calculator!$K${r}=""),"",CTC_Calculator!$K${r})` };
    for (let c = 1; c < grossCols.length; c++) {
      const col = grossCols[c];
      const prevCol = grossCols[c - 1];
      solverWs[`${col}${r}`] = {
        t: "n",
        f: `IF(OR(CTC_Calculator!$A${r}="",CTC_Calculator!$K${r}=""),"",CTC_Calculator!$K${r}+CTC_Calculator!$O${r}*MIN(MAX(CTC_Calculator!$M${r}*${prevCol}${r},CTC_Calculator!$I${r}*12),$D${r})+CTC_Calculator!$S${r}*MAX(CTC_Calculator!$M${r}*${prevCol}${r},CTC_Calculator!$I${r}*12)+IF(MAX(CTC_Calculator!$M${r}*${prevCol}${r},CTC_Calculator!$I${r}*12)/12>21000,0,MAX(7000,CTC_Calculator!$I${r})*12*$C${r})+IF(MAX(CTC_Calculator!$M${r}*${prevCol}${r},CTC_Calculator!$I${r}*12)/12>21000,MAX(CTC_Calculator!$M${r}*${prevCol}${r},CTC_Calculator!$I${r}*12)*$C${r},0)+CTC_Calculator!$X${r}*IF(CTC_Calculator!$V${r}="No",0,IF(CTC_Calculator!$W${r}="Basic",MIN(MAX(CTC_Calculator!$M${r}*${prevCol}${r},CTC_Calculator!$I${r}*12),$E${r}),MIN(CTC_Calculator!$K${r},$E${r}))))`
      };
    }

    // Net take home basis iterations 0..25 (Cols AI to BH)
    solverWs[`AI${r}`] = { t: "n", f: `IF(OR(CTC_Calculator!$A${r}="",CTC_Calculator!$K${r}=""),"",CTC_Calculator!$K${r})` };
    for (let c = 1; c < netCols.length; c++) {
      const col = netCols[c];
      const prevCol = netCols[c - 1];
      solverWs[`${col}${r}`] = {
        t: "n",
        f: `IF(OR(CTC_Calculator!$A${r}="",CTC_Calculator!$K${r}=""),"",CTC_Calculator!$K${r}+(CTC_Calculator!$AA${r}+CTC_Calculator!$AB${r}+CTC_Calculator!$AC${r}+CTC_Calculator!$AD${r}+CTC_Calculator!$AE${r})*12+(CTC_Calculator!$P${r}+CTC_Calculator!$O${r})*MIN(MAX(CTC_Calculator!$M${r}*${prevCol}${r},CTC_Calculator!$I${r}*12),$D${r})+CTC_Calculator!$S${r}*MAX(CTC_Calculator!$M${r}*${prevCol}${r},CTC_Calculator!$I${r}*12)+IF(MAX(CTC_Calculator!$M${r}*${prevCol}${r},CTC_Calculator!$I${r}*12)/12>21000,MAX(CTC_Calculator!$M${r}*${prevCol}${r},CTC_Calculator!$I${r}*12)*$C${r},0)+(CTC_Calculator!$Y${r}+CTC_Calculator!$X${r})*IF(CTC_Calculator!$V${r}="No",0,IF(CTC_Calculator!$W${r}="Basic",MIN(MAX(CTC_Calculator!$M${r}*${prevCol}${r},CTC_Calculator!$I${r}*12),$E${r}),MIN((${prevCol}${r}-CTC_Calculator!$O${r}*MIN(MAX(CTC_Calculator!$M${r}*${prevCol}${r},CTC_Calculator!$I${r}*12),$D${r})-CTC_Calculator!$S${r}*MAX(CTC_Calculator!$M${r}*${prevCol}${r},CTC_Calculator!$I${r}*12)-IF(MAX(CTC_Calculator!$M${r}*${prevCol}${r},CTC_Calculator!$I${r}*12)/12>21000,0,MAX(7000,CTC_Calculator!$I${r})*12*$C${r})-IF(MAX(CTC_Calculator!$M${r}*${prevCol}${r},CTC_Calculator!$I${r}*12)/12>21000,MAX(CTC_Calculator!$M${r}*${prevCol}${r},CTC_Calculator!$I${r}*12)*$C${r},0))/(1+CTC_Calculator!$X${r}),$E${r}))))`
      };
    }
  });

  // Clean empty rows in Solver beyond actual employees
  for (const cell in solverWs) {
    if (cell.startsWith("!")) continue;
    const match = cell.match(/[0-9]+/);
    if (match && parseInt(match[0], 10) > maxCalcRow) {
      delete solverWs[cell];
    }
  }
  solverWs["!ref"] = `A1:BH${maxCalcRow}`;

  // Reorder sheets with Monthly_Payroll_Ledger & Bank_Disbursement first
  wb.SheetNames = ["Monthly_Payroll_Ledger", "Bank_Disbursement", "CTC_Calculator", "Solver", "Minimum Wages", "PT"];
  wb.Sheets["Monthly_Payroll_Ledger"] = wsLedger;
  wb.Sheets["Bank_Disbursement"] = wsBank;

  const companyTag = selectedCompany && selectedCompany !== "All Companies"
    ? `_${selectedCompany.replace(/[^a-zA-Z0-9]/g, "_")}`
    : "";
  const filename = `Payroll_Export_${cycleName.replace(/\s+/g, "_")}${companyTag}.xlsx`;

  XLSX.writeFile(wb, filename);
}
