"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  FileCheck2,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Loader2,
  Download,
  Building2,
  Briefcase,
  MapPin,
  Calendar,
  PenTool,
  RotateCcw,
  Check,
  ShieldCheck,
  Phone,
  Mail,
  IndianRupee,
  Lock,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://hrmsbackend-z7do.onrender.com/api/v1";

interface AppointmentLetterData {
  id: number;
  title: string;
  type: string;
  content: string;
  status: string;
  issued_date: string;
  acceptance_status: "pending" | "accepted" | "rejected";
  candidate: {
    name: string;
    email: string;
    phone?: string;
    designation: string;
    department: string;
    company: string;
    office: string;
    fixed_gross: number;
    date_of_joining?: string | null;
  };
  signatory?: {
    name: string;
    designation: string;
    signature_url?: string;
  } | null;
  response_details: {
    accepted_at?: string | null;
    rejected_at?: string | null;
    signed_name?: string | null;
    candidate_signature?: string | null;
    candidate_comments?: string | null;
    rejection_reason?: string | null;
  };
  onboarding_invited?: boolean;
}

function AppointmentAcceptanceContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [letterData, setLetterData] = useState<AppointmentLetterData | null>(null);

  // Signing mode state
  const [signingMode, setSigningMode] = useState<"draw" | "type">("draw");
  const [typedName, setTypedName] = useState("");
  const [selectedFont, setSelectedFont] = useState<"cursive" | "serif" | "script">("cursive");
  const [inkColor, setInkColor] = useState<"#0f172a" | "#1e3a8a">("#1e3a8a");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Rejection modal state
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectRemarks, setRejectRemarks] = useState("");
  const [rejecting, setRejecting] = useState(false);

  // Canvas ref
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);

  // Fetch appointment letter
  const fetchLetterDetails = async () => {
    if (!token) {
      setError("No appointment acceptance token provided in the URL.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE}/letters/public/appointment/${token}`);
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Unable to fetch appointment letter details.");
      }

      setLetterData(json.data);
      if (json.data?.candidate?.name) {
        setTypedName(json.data.candidate.name);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load appointment letter. Please contact HR.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLetterDetails();
  }, [token]);

  // Setup canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    ctx.scale(ratio, ratio);

    ctx.strokeStyle = inkColor;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, [canvasRef.current, signingMode, inkColor]);

  // Canvas drawing handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    isDrawingRef.current = true;
    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
    setHasDrawn(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    isDrawingRef.current = false;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  // Convert typed signature to Image Data URL
  const generateTypedSignatureImage = (): string => {
    const canvas = document.createElement("canvas");
    canvas.width = 500;
    canvas.height = 160;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";

    ctx.fillStyle = "rgba(0,0,0,0)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = inkColor;
    if (selectedFont === "cursive") {
      ctx.font = "italic 44px 'Brush Script MT', 'Dancing Script', cursive, sans-serif";
    } else if (selectedFont === "script") {
      ctx.font = "italic 40px 'Lucida Handwriting', 'Segoe Script', cursive, sans-serif";
    } else {
      ctx.font = "italic bold 38px 'Georgia', serif";
    }

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(typedName.trim() || letterData?.candidate?.name || "Accepted", canvas.width / 2, canvas.height / 2 - 10);

    // Decorative baseline line
    ctx.strokeStyle = inkColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(60, canvas.height / 2 + 30);
    ctx.lineTo(canvas.width - 60, canvas.height / 2 + 30);
    ctx.stroke();

    return canvas.toDataURL("image/png");
  };

  // Handle Accept Submission
  const handleAcceptAppointment = async () => {
    if (!agreedToTerms) {
      alert("Please confirm the legal acknowledgment checkbox before signing.");
      return;
    }

    let signatureDataUrl = "";
    if (signingMode === "draw") {
      if (!hasDrawn || !canvasRef.current) {
        alert("Please draw your digital signature on the signature pad.");
        return;
      }
      signatureDataUrl = canvasRef.current.toDataURL("image/png");
    } else {
      if (!typedName.trim()) {
        alert("Please enter your full legal name for the digital signature.");
        return;
      }
      signatureDataUrl = generateTypedSignatureImage();
    }

    try {
      setSubmitting(true);
      const res = await fetch(`${API_BASE}/letters/public/appointment/${token}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "accept",
          signature: signatureDataUrl,
          signed_name: signingMode === "type" ? typedName.trim() : (letterData?.candidate?.name || "Employee"),
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to record your appointment acceptance.");
      }

      await fetchLetterDetails();
    } catch (err: any) {
      alert(err?.message || "An error occurred while submitting your appointment acceptance.");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Decline Submission
  const handleDeclineAppointment = async () => {
    if (!rejectReason) {
      alert("Please select a reason for declining the appointment.");
      return;
    }

    const fullReason = rejectRemarks.trim()
      ? `${rejectReason} â€” Notes: ${rejectRemarks.trim()}`
      : rejectReason;

    try {
      setRejecting(true);
      const res = await fetch(`${API_BASE}/letters/public/appointment/${token}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reject",
          reason: fullReason,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to record your response.");
      }

      setRejectModalOpen(false);
      await fetchLetterDetails();
    } catch (err: any) {
      alert(err?.message || "An error occurred while declining the appointment.");
    } finally {
      setRejecting(false);
    }
  };

  // Download PDF
  const handleDownloadPDF = async () => {
    if (!token) return;
    try {
      setDownloading(true);
      const res = await fetch(`${API_BASE}/letters/public/appointment/${token}/pdf`);
      if (!res.ok) throw new Error("Failed to download PDF.");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(letterData?.title || "Appointment_Letter").replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err?.message || "Could not download appointment letter PDF.");
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100 flex flex-col items-center max-w-md w-full text-center">
          <div className="h-14 w-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center mb-4">
            <Loader2 className="h-7 w-7 text-blue-600 animate-spin" />
          </div>
          <h2 className="text-lg font-bold text-slate-800">Verifying Appointment Letter</h2>
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
            Please wait while we securely retrieve your formal employment terms and appointment schedule...
          </p>
        </div>
      </div>
    );
  }

  if (error || !letterData) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <Card className="max-w-md w-full border-rose-200 shadow-xl bg-white rounded-2xl overflow-hidden">
          <div className="bg-rose-50 border-b border-rose-100 p-6 text-center">
            <div className="h-12 w-12 rounded-full bg-rose-100 flex items-center justify-center mx-auto mb-3">
              <AlertCircle className="h-6 w-6 text-rose-600" />
            </div>
            <h2 className="text-base font-bold text-rose-900">Unable to Open Appointment Letter</h2>
            <p className="text-xs text-rose-600 mt-1">{error || "Appointment letter link is invalid or expired."}</p>
          </div>
          <CardContent className="p-6 text-center text-xs text-slate-600">
            <p className="leading-relaxed">
              If you believe this is an error, please reach out to your HR coordinator to reissue a fresh appointment acceptance link.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { candidate, signatory, response_details } = letterData;
  const isAccepted = letterData.acceptance_status === "accepted";
  const isRejected = letterData.acceptance_status === "rejected";

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-slate-100 py-6 px-3 sm:px-6 lg:px-8">
      {/* â”€â”€ TOP HEADER / BRANDING â”€â”€ */}
      <header className="max-w-4xl mx-auto mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-[#124479] to-[#0d3159] text-white flex items-center justify-center font-black text-sm tracking-wider shadow-sm">
            {candidate.company ? candidate.company.slice(0, 2).toUpperCase() : "HR"}
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
              {candidate.company || "Official Company"}
              <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border-emerald-200">
                Official Appointment
              </Badge>
            </h1>
            <p className="text-xs text-slate-500 font-medium flex items-center gap-1.5 mt-0.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              Confidential Employment Document â€¢ Digital Signature Verified
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDownloadPDF}
            disabled={downloading}
            className="text-xs font-bold border-slate-200 hover:bg-slate-50 text-slate-700 h-9 rounded-xl shadow-xs"
          >
            {downloading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1.5 text-[#124479]" />}
            Download PDF
          </Button>
        </div>
      </header>

      {/* â”€â”€ STATUS BANNERS â”€â”€ */}
      <div className="max-w-4xl mx-auto mb-6">
        {isAccepted && (
          <div className="bg-emerald-500 text-white p-4 sm:p-5 rounded-2xl shadow-lg border border-emerald-600 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0">
                <CheckCircle2 className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider">
                  Appointment Letter Accepted &amp; Digitally Signed!
                </h3>
                <p className="text-xs text-emerald-50 mt-1 leading-relaxed">
                  Thank you! Your acceptance has been logged in the organization HRMS on{" "}
                  <strong className="underline">
                    {response_details.accepted_at
                      ? new Date(response_details.accepted_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
                      : "Recently"}
                  </strong>
                  .
                </p>
                <p className="text-xs text-emerald-100 mt-1">
                  Welcome to {candidate.company}! Your official signed copy is ready for download.
                </p>
              </div>
            </div>

            <Button
              type="button"
              onClick={handleDownloadPDF}
              disabled={downloading}
              className="bg-white text-emerald-800 hover:bg-emerald-50 font-bold text-xs h-10 px-4 rounded-xl shadow-sm shrink-0"
            >
              <Download className="h-4 w-4 mr-1.5" />
              Download Signed Letter
            </Button>
          </div>
        )}

        {isRejected && (
          <div className="bg-rose-50 border border-rose-200 p-4 sm:p-5 rounded-2xl flex items-start gap-3 text-rose-900">
            <div className="h-10 w-10 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
              <XCircle className="h-6 w-6 text-rose-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold">Appointment Letter Declined</h3>
              <p className="text-xs text-rose-700 mt-1">
                You marked this appointment letter as declined on{" "}
                {response_details.rejected_at
                  ? new Date(response_details.rejected_at).toLocaleString("en-IN", { dateStyle: "medium" })
                  : "N/A"}
                .
              </p>
              {response_details.rejection_reason && (
                <p className="text-xs bg-white/60 p-2 rounded-lg border border-rose-200 mt-2 font-mono">
                  Reason: {response_details.rejection_reason}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* â”€â”€ APPOINTMENT SUMMARY CARD â”€â”€ */}
      <div className="max-w-4xl mx-auto mb-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="p-3 bg-slate-50/70 rounded-xl">
            <span className="text-[10px] uppercase font-bold text-slate-600 block">Employee Name</span>
            <span className="text-xs sm:text-sm font-black text-slate-800 truncate block mt-0.5">{candidate.name}</span>
            <span className="text-[10px] text-slate-500 truncate block">{candidate.email}</span>
          </div>

          <div className="p-3 bg-slate-50/70 rounded-xl">
            <span className="text-[10px] uppercase font-bold text-slate-600 block">Appointed Role</span>
            <span className="text-xs sm:text-sm font-black text-slate-800 truncate block mt-0.5">{candidate.designation || "Staff"}</span>
            <span className="text-[10px] text-slate-500 truncate block">{candidate.department || "General"}</span>
          </div>

          <div className="p-3 bg-slate-50/70 rounded-xl">
            <span className="text-[10px] uppercase font-bold text-slate-600 block">Monthly Gross CTC</span>
            <span className="text-xs sm:text-sm font-black text-emerald-700 block mt-0.5">
              â‚¹{Number(candidate.fixed_gross || 0).toLocaleString("en-IN")} <span className="text-[10px] text-slate-500 font-normal">/mo</span>
            </span>
            <span className="text-[10px] text-slate-500 block">
              â‚¹{(Number(candidate.fixed_gross || 0) * 12).toLocaleString("en-IN")} /yr
            </span>
          </div>

          <div className="p-3 bg-slate-50/70 rounded-xl">
            <span className="text-[10px] uppercase font-bold text-slate-600 block">Location / Office</span>
            <span className="text-xs sm:text-sm font-black text-slate-800 truncate block mt-0.5">{candidate.office || "Head Office"}</span>
            <span className="text-[10px] text-slate-500 block">
              Issued: {new Date(letterData.issued_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            </span>
          </div>
        </div>
      </div>

      {/* â”€â”€ LETTER CONTENT VIEWER â”€â”€ */}
      <div className="max-w-4xl mx-auto mb-6">
        <Card className="border border-slate-200 shadow-md bg-white rounded-2xl overflow-hidden">
          <CardHeader className="bg-slate-50/70 border-b border-slate-200 py-3.5 px-6 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <FileCheck2 className="h-4 w-4 text-[#124479]" />
              <CardTitle className="text-sm font-bold text-slate-800">{letterData.title || "Appointment Letter"}</CardTitle>
            </div>
            <span className="text-[10px] font-mono font-bold text-slate-500">REF: APPT/{candidate.name.toUpperCase().replace(/\s+/g, "_")}</span>
          </CardHeader>
          <CardContent className="p-6 sm:p-10">
            {/* Formatted Letter HTML Container */}
            <div
              className="prose prose-sm max-w-none text-slate-800 leading-relaxed font-serif text-[13px] sm:text-[14px]
                [&>p]:mb-3 [&>h1]:text-lg [&>h2]:text-base [&>h3]:text-sm [&>h1]:font-sans [&>h2]:font-sans [&>h3]:font-sans
                [&>table]:w-full [&>table]:border-collapse [&>table]:my-4 [&>table]:text-xs [&>table]:font-sans
                [&>table_th]:border [&>table_th]:border-slate-300 [&>table_th]:bg-slate-100 [&>table_th]:p-2 [&>table_th]:text-left
                [&>table_td]:border [&>table_td]:border-slate-300 [&>table_td]:p-2
                [&>ol]:list-decimal [&>ol]:pl-5 [&>ol]:my-2
                [&>ul]:list-disc [&>ul]:pl-5 [&>ul]:my-2"
              dangerouslySetInnerHTML={{ __html: letterData.content }}
            />

            {/* Organization Authorized Signatory Stamp */}
            {signatory && (
              <div className="mt-10 pt-6 border-t border-slate-200 flex flex-col items-start gap-1">
                <span className="text-[10px] uppercase font-bold text-slate-500">For {candidate.company}</span>
                {signatory.signature_url ? (
                  <div className="h-14 my-1">
                    <img src={signatory.signature_url} alt={signatory.name} className="h-full object-contain" />
                  </div>
                ) : (
                  <div className="h-10" />
                )}
                <span className="text-xs font-bold text-slate-800">{signatory.name}</span>
                <span className="text-[11px] text-slate-500">{signatory.designation}</span>
              </div>
            )}

            {/* Candidate Acceptance Box when already accepted */}
            {isAccepted && (
              <div className="mt-8 p-4 rounded-xl border border-emerald-300 bg-emerald-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 font-sans">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-700">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-emerald-800 tracking-wider block">
                      Accepted &amp; Digitally Signed
                    </span>
                    <span className="text-xs font-bold text-slate-900 block">
                      {response_details.signed_name || candidate.name}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Timestamp: {response_details.accepted_at ? new Date(response_details.accepted_at).toLocaleString("en-IN") : "Recorded"}
                    </span>
                  </div>
                </div>

                {response_details.candidate_signature && (
                  <div className="bg-white p-2 rounded-lg border border-emerald-200 shadow-2xs self-center">
                    <img
                      src={response_details.candidate_signature}
                      alt="Candidate Digital Signature"
                      className="h-12 max-w-[200px] object-contain"
                    />
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* â”€â”€ DIGITAL SIGNATURE & ACCEPTANCE PANEL (Only when Pending) â”€â”€ */}
      {!isAccepted && !isRejected && (
        <div className="max-w-4xl mx-auto mb-10">
          <Card className="border-2 border-[#124479]/30 shadow-xl bg-white rounded-2xl overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-blue-50/80 via-white to-blue-50/80 border-b border-blue-100 p-5">
              <div className="flex items-center gap-2 text-[#124479]">
                <Sparkles className="h-5 w-5" />
                <CardTitle className="text-base font-black uppercase tracking-wider text-slate-900">
                  Review Terms &amp; Digitally Sign Appointment Letter
                </CardTitle>
              </div>
              <CardDescription className="text-xs text-slate-600 mt-1">
                Please review all clauses, compensation schedules (Annexure A), and service rules above. Sign electronically below to execute your appointment contract.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-5 sm:p-7 space-y-6">
              {/* Signing Mode Switcher */}
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <span className="text-xs font-bold uppercase text-slate-600 tracking-wider flex items-center gap-1.5">
                  <PenTool className="h-3.5 w-3.5 text-[#124479]" />
                  Select Signature Mode:
                </span>
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setSigningMode("draw")}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      signingMode === "draw" ? "bg-white text-[#124479] shadow-xs" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Draw Signature
                  </button>
                  <button
                    type="button"
                    onClick={() => setSigningMode("type")}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      signingMode === "type" ? "bg-white text-[#124479] shadow-xs" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Type Signature
                  </button>
                </div>
              </div>

              {/* DRAW MODE CANVAS */}
              {signingMode === "draw" ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Draw your handwritten signature using your mouse, trackpad, or finger:</span>
                    <button
                      type="button"
                      onClick={clearCanvas}
                      className="text-slate-500 hover:text-rose-600 font-bold flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Clear Pad
                    </button>
                  </div>

                  <div className="relative border-2 border-dashed border-slate-300 hover:border-blue-400 transition-colors rounded-2xl bg-slate-50/50 p-2 overflow-hidden shadow-inner">
                    <canvas
                      ref={canvasRef}
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                      className="w-full h-36 bg-white rounded-xl cursor-crosshair touch-none"
                    />
                    {!hasDrawn && (
                      <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-slate-300 text-xs italic">
                        âœï¸ Draw your signature here
                      </div>
                    )}
                  </div>

                  {/* Ink color switcher */}
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-[11px] font-bold text-slate-600">Ink Color:</span>
                    <button
                      type="button"
                      onClick={() => setInkColor("#1e3a8a")}
                      className={`h-5 w-5 rounded-full bg-blue-900 border-2 transition-transform cursor-pointer ${
                        inkColor === "#1e3a8a" ? "ring-2 ring-blue-500 scale-110 border-white" : "border-transparent"
                      }`}
                      title="Navy Blue Ink"
                    />
                    <button
                      type="button"
                      onClick={() => setInkColor("#0f172a")}
                      className={`h-5 w-5 rounded-full bg-slate-900 border-2 transition-transform cursor-pointer ${
                        inkColor === "#0f172a" ? "ring-2 ring-blue-500 scale-110 border-white" : "border-transparent"
                      }`}
                      title="Formal Black Ink"
                    />
                  </div>
                </div>
              ) : (
                /* TYPE MODE INPUT */
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Full Legal Name (as signature) *
                    </label>
                    <Input
                      type="text"
                      value={typedName}
                      onChange={(e) => setTypedName(e.target.value)}
                      placeholder="e.g. Rahul Sharma"
                      className="h-10 text-sm font-semibold border-slate-300 bg-white"
                    />
                  </div>

                  {/* Font choice switcher */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1.5">Select Signature Font Style:</label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedFont("cursive")}
                        className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                          selectedFont === "cursive"
                            ? "border-blue-600 bg-blue-50/50 ring-1 ring-blue-500"
                            : "border-slate-200 bg-white hover:border-slate-300"
                        }`}
                      >
                        <span className="text-sm italic font-['Brush_Script_MT','Dancing_Script',cursive] text-slate-800">
                          {typedName || "Rahul Sharma"}
                        </span>
                        <span className="block text-[9px] uppercase font-bold text-slate-600 mt-1">Cursive Casual</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedFont("script")}
                        className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                          selectedFont === "script"
                            ? "border-blue-600 bg-blue-50/50 ring-1 ring-blue-500"
                            : "border-slate-200 bg-white hover:border-slate-300"
                        }`}
                      >
                        <span className="text-sm italic font-['Lucida_Handwriting','Segoe_Script',cursive] text-slate-800">
                          {typedName || "Rahul Sharma"}
                        </span>
                        <span className="block text-[9px] uppercase font-bold text-slate-600 mt-1">Formal Script</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedFont("serif")}
                        className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                          selectedFont === "serif"
                            ? "border-blue-600 bg-blue-50/50 ring-1 ring-blue-500"
                            : "border-slate-200 bg-white hover:border-slate-300"
                        }`}
                      >
                        <span className="text-sm font-bold italic font-serif text-slate-800">
                          {typedName || "Rahul Sharma"}
                        </span>
                        <span className="block text-[9px] uppercase font-bold text-slate-600 mt-1">Classic Serif</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Legal Acknowledgment Checkbox */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#124479] focus:ring-[#124479]"
                  />
                  <span className="text-xs text-slate-700 leading-relaxed">
                    I, <strong className="text-slate-900">{candidate.name}</strong>, hereby confirm that I have read, understood, and accept all the terms, conditions, duties, and compensation schedules (Annexure A) specified in this Official Appointment Letter. I acknowledge that this electronic signature has the same legal validity and enforceability as my handwritten signature under the Information Technology Act.
                  </span>
                </label>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setRejectModalOpen(true)}
                  className="w-full sm:w-auto text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 h-10 px-4 rounded-xl cursor-pointer"
                >
                  <XCircle className="h-4 w-4 mr-1.5" />
                  Decline Appointment...
                </Button>

                <Button
                  type="button"
                  onClick={handleAcceptAppointment}
                  disabled={submitting || !agreedToTerms || (signingMode === "draw" ? !hasDrawn : !typedName.trim())}
                  className="w-full sm:w-auto bg-[#124479] hover:bg-[#0E335C] text-white font-black text-xs uppercase tracking-wider h-11 px-6 rounded-xl shadow-lg shadow-blue-900/20 cursor-pointer disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Recording Signature...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-2 stroke-[3]" />
                      Digitally Sign &amp; Accept Appointment
                    </>
                  )}
                </Button>
              </div>

            </CardContent>
          </Card>
        </div>
      )}

      {/* â”€â”€ DECLINE APPOINTMENT MODAL â”€â”€ */}
      <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
        <DialogContent className="max-w-md bg-white rounded-2xl p-6 shadow-2xl border-none">
          <DialogHeader>
            <div className="h-10 w-10 rounded-xl bg-rose-100 flex items-center justify-center mb-2">
              <XCircle className="h-5 w-5 text-rose-600" />
            </div>
            <DialogTitle className="text-base font-black text-slate-900">Decline Appointment</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Please share your reason for declining this appointment. This feedback will be sent to the HR department.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-2">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Primary Reason *</label>
              <select
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full text-xs font-medium border border-slate-300 rounded-lg p-2.5 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500"
              >
                <option value="">Select reason...</option>
                <option value="Unable to join on proposed schedule">Unable to join on proposed schedule</option>
                <option value="Terms differ from discussions">Terms differ from discussions</option>
                <option value="Personal or family circumstances">Personal or family circumstances</option>
                <option value="Other reason">Other reason</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Additional Remarks (Optional)</label>
              <textarea
                value={rejectRemarks}
                onChange={(e) => setRejectRemarks(e.target.value)}
                rows={3}
                placeholder="Share any specific notes or feedback with our HR team..."
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setRejectModalOpen(false)}
              disabled={rejecting}
              className="text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleDeclineAppointment}
              disabled={rejecting || !rejectReason}
              className="text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg px-4"
            >
              {rejecting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Declining...
                </>
              ) : (
                "Confirm & Decline"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AppointmentAcceptancePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
        </div>
      }
    >
      <AppointmentAcceptanceContent />
    </Suspense>
  );
}
