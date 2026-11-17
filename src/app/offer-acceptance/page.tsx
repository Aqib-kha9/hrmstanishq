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

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://api.apaarpulse.com/api/v1";

interface OfferLetterData {
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

function OfferAcceptanceContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [letterData, setLetterData] = useState<OfferLetterData | null>(null);

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

  // Fetch offer letter
  const fetchOfferDetails = async () => {
    if (!token) {
      setError("No offer acceptance token provided in the URL.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE}/letters/public/offer/${token}`);
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Unable to fetch offer letter details.");
      }

      setLetterData(json.data);
      if (json.data?.candidate?.name) {
        setTypedName(json.data.candidate.name);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load offer letter. Please check with HR.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOfferDetails();
  }, [token]);

  // Setup canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set high DPI display support
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
  const handleAcceptOffer = async () => {
    if (!agreedToTerms) {
      alert("Please confirm the legal acknowledgment checkbox before accepting.");
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
      const res = await fetch(`${API_BASE}/letters/public/offer/${token}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "accept",
          signature: signatureDataUrl,
          signed_name: signingMode === "type" ? typedName.trim() : (letterData?.candidate?.name || "Candidate"),
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to record your acceptance.");
      }

      await fetchOfferDetails();
    } catch (err: any) {
      alert(err?.message || "An error occurred while submitting your acceptance.");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Decline Submission
  const handleDeclineOffer = async () => {
    if (!rejectReason) {
      alert("Please select a reason for declining the offer.");
      return;
    }

    const fullReason = rejectRemarks.trim()
      ? `${rejectReason} — Notes: ${rejectRemarks.trim()}`
      : rejectReason;

    try {
      setRejecting(true);
      const res = await fetch(`${API_BASE}/letters/public/offer/${token}/respond`, {
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
      await fetchOfferDetails();
    } catch (err: any) {
      alert(err?.message || "An error occurred while declining the offer.");
    } finally {
      setRejecting(false);
    }
  };

  // Download PDF
  const handleDownloadPDF = async () => {
    if (!token) return;
    try {
      setDownloading(true);
      const res = await fetch(`${API_BASE}/letters/public/offer/${token}/pdf`);
      if (!res.ok) throw new Error("Failed to download PDF.");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(letterData?.title || "Offer_Letter").replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err?.message || "Could not download offer letter PDF.");
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
          <h2 className="text-lg font-bold text-slate-800">Verifying Official Offer Letter</h2>
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
            Please wait while we securely retrieve your employment terms and compensation schedule...
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
            <h2 className="text-base font-bold text-rose-900">Unable to Open Offer Letter</h2>
            <p className="text-xs text-rose-600 mt-1">{error || "Offer letter link is invalid or expired."}</p>
          </div>
          <CardContent className="p-6 text-center text-xs text-slate-600">
            <p className="leading-relaxed">
              If you believe this is an error, please reach out to your HR coordinator to reissue a fresh offer acceptance link.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { candidate, signatory, response_details } = letterData;
  const isAccepted = letterData.acceptance_status === "accepted";
  const isRejected = letterData.acceptance_status === "rejected";
  const isPending = !isAccepted && !isRejected;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-slate-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* ── TOP EXECUTIVE BAR ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="h-12 w-12 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black text-lg shadow-md shadow-blue-500/20">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-slate-900 text-base">{candidate.company || "Apaar Logistics"}</span>
                <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  OFFICIAL OFFER
                </Badge>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                Confidential Employment Document &bull; Digital Signature Verified
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadPDF}
              disabled={downloading}
              className="text-xs font-bold text-slate-700 border-slate-300 hover:bg-slate-50 rounded-xl"
            >
              {downloading ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5 mr-1.5 text-blue-600" />
              )}
              Download PDF
            </Button>
          </div>
        </div>

        {/* ── STATUS BANNERS ── */}
        {isAccepted && (
          <div className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-2xl p-6 shadow-lg shadow-emerald-500/15 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
                <CheckCircle2 className="h-7 w-7 text-white" />
              </div>
              <div>
                <h3 className="text-base font-extrabold tracking-tight">Offer Letter Accepted &amp; Digitally Signed!</h3>
                <p className="text-xs text-emerald-50 mt-1 leading-relaxed">
                  Thank you! Your acceptance has been logged in the organization HRMS on{" "}
                  <strong>
                    {response_details?.accepted_at
                      ? new Date(response_details.accepted_at).toLocaleString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "Recently"}
                  </strong>.
                </p>
                <p className="text-xs text-emerald-100 mt-1">
                  Our HR team will issue your <strong>Self-Onboarding Portal link</strong> shortly to submit your KYC documents and bank details.
                </p>
              </div>
            </div>
          </div>
        )}

        {isRejected && (
          <div className="bg-gradient-to-r from-rose-600 to-red-700 text-white rounded-2xl p-6 shadow-lg shadow-rose-500/15 flex items-start gap-4">
            <div className="h-12 w-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
              <XCircle className="h-7 w-7 text-white" />
            </div>
            <div>
              <h3 className="text-base font-extrabold tracking-tight">Offer Letter Declined</h3>
              <p className="text-xs text-rose-100 mt-1 leading-relaxed">
                You have declined this offer on{" "}
                {response_details?.rejected_at
                  ? new Date(response_details.rejected_at).toLocaleString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : "Recently"}
                .
              </p>
              {response_details?.rejection_reason && (
                <div className="mt-2.5 bg-black/20 rounded-lg p-2.5 text-xs text-rose-100 border border-white/10">
                  <span className="font-semibold text-white">Recorded Remarks:</span> {response_details.rejection_reason}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── CANDIDATE & POSITION SUMMARY CARD ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 sm:p-6 grid grid-cols-2 sm:grid-cols-4 gap-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
          <div className="pt-2 sm:pt-0 sm:pr-4">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Candidate Name</span>
            <p className="text-sm font-extrabold text-slate-900 mt-0.5 truncate">{candidate.name}</p>
            <p className="text-[11px] text-slate-500 truncate">{candidate.email}</p>
          </div>

          <div className="pt-2 sm:pt-0 sm:px-4">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Offered Role</span>
            <p className="text-sm font-extrabold text-slate-900 mt-0.5 truncate">{candidate.designation}</p>
            <p className="text-[11px] text-slate-500 truncate">{candidate.department}</p>
          </div>

          <div className="pt-2 sm:pt-0 sm:px-4">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Monthly Gross CTC</span>
            <p className="text-sm font-extrabold text-emerald-700 mt-0.5">
              ₹{Number(candidate.fixed_gross || 0).toLocaleString("en-IN")}
              <span className="text-[10px] font-normal text-slate-400"> /mo</span>
            </p>
            <p className="text-[10px] text-slate-500">
              ₹{(Number(candidate.fixed_gross || 0) * 12).toLocaleString("en-IN")} /yr
            </p>
          </div>

          <div className="pt-2 sm:pt-0 sm:pl-4">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Location / Office</span>
            <p className="text-sm font-extrabold text-slate-900 mt-0.5 truncate">{candidate.office || "Head Office"}</p>
            <p className="text-[11px] text-slate-500 truncate">
              Issued: {letterData.issued_date ? new Date(letterData.issued_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Recent"}
            </p>
          </div>
        </div>

        {/* ── LETTER DOCUMENT VIEWER ── */}
        <div className="bg-white rounded-2xl shadow-md border border-slate-200/90 overflow-hidden">
          <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white">
            <div className="flex items-center gap-2.5">
              <FileCheck2 className="h-5 w-5 text-blue-400" />
              <span className="font-bold text-sm tracking-wide">{letterData.title || "Official Offer of Employment"}</span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">REF: OFFER/{candidate.name.toUpperCase().replace(/\s+/g, "_")}</span>
          </div>

          <div className="p-6 sm:p-12 text-slate-800 leading-relaxed max-w-none text-sm select-text">
            {letterData.content ? (
              <div
                className="letter-html-content space-y-4"
                dangerouslySetInnerHTML={{ __html: letterData.content }}
              />
            ) : (
              <p className="text-slate-500 italic">No formatted text available. Please download the official PDF.</p>
            )}

            {/* Authorised Signatory Stamp */}
            {signatory && (
              <div className="mt-12 pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                <div>
                  <p className="text-xs text-slate-500 font-semibold">For &amp; on behalf of</p>
                  <p className="text-sm font-black text-slate-900">{candidate.company || "Apaar Logistics"}</p>
                  {signatory.signature_url ? (
                    <img src={signatory.signature_url} alt="Signature" className="h-12 w-auto object-contain my-1" />
                  ) : (
                    <div className="h-10 flex items-center text-xs font-mono text-slate-400 italic">
                      [Digitally Signed By Signatory]
                    </div>
                  )}
                  <p className="text-xs font-bold text-slate-800">{signatory.name}</p>
                  <p className="text-[11px] text-slate-500">{signatory.designation}</p>
                </div>

                {isAccepted && response_details?.candidate_signature && (
                  <div className="p-4 rounded-xl bg-emerald-50/80 border border-emerald-200/80 min-w-[240px]">
                    <div className="flex items-center gap-1.5 text-emerald-800 font-bold text-xs mb-1">
                      <ShieldCheck className="h-4 w-4 text-emerald-600" />
                      Candidate Digital Acceptance
                    </div>
                    <img
                      src={response_details.candidate_signature}
                      alt="Candidate Signature"
                      className="h-12 w-auto object-contain my-1 bg-white/70 p-1 rounded border border-emerald-100"
                    />
                    <p className="text-xs font-black text-emerald-900">{response_details.signed_name || candidate.name}</p>
                    <p className="text-[10px] text-emerald-700">
                      Signed on{" "}
                      {response_details.accepted_at
                        ? new Date(response_details.accepted_at).toLocaleString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "Verified"}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── CANDIDATE ACCEPTANCE / SIGNING SECTION ── */}
        {isPending && (
          <Card className="border-2 border-blue-500/50 shadow-xl bg-white rounded-2xl overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-blue-50 via-indigo-50/50 to-white border-b border-blue-100 p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
                    <PenTool className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-black text-slate-900">Digital Offer Acceptance &amp; Signature</CardTitle>
                    <CardDescription className="text-xs text-slate-500 mt-0.5">
                      Review the terms above and provide your electronic signature to confirm your acceptance.
                    </CardDescription>
                  </div>
                </div>
                <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-bold text-blue-700 bg-blue-100/60 px-3 py-1 rounded-full border border-blue-200">
                  <Lock className="h-3 w-3" />
                  Legally Binding
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
              
              {/* Mode Switcher */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSigningMode("draw")}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      signingMode === "draw"
                        ? "bg-blue-600 text-white shadow-sm"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    ✍️ Draw Signature
                  </button>
                  <button
                    type="button"
                    onClick={() => setSigningMode("type")}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      signingMode === "type"
                        ? "bg-blue-600 text-white shadow-sm"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    ⌨️ Type Signature
                  </button>
                </div>

                {/* Ink Color Selector */}
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Ink:</span>
                  <button
                    type="button"
                    onClick={() => setInkColor("#1e3a8a")}
                    title="Blue Ink"
                    className={`h-5 w-5 rounded-full bg-blue-900 transition-all ${inkColor === "#1e3a8a" ? "ring-2 ring-blue-500 ring-offset-1 scale-110" : "opacity-60"}`}
                  />
                  <button
                    type="button"
                    onClick={() => setInkColor("#0f172a")}
                    title="Black Ink"
                    className={`h-5 w-5 rounded-full bg-slate-900 transition-all ${inkColor === "#0f172a" ? "ring-2 ring-slate-600 ring-offset-1 scale-110" : "opacity-60"}`}
                  />
                </div>
              </div>

              {/* DRAW MODE */}
              {signingMode === "draw" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="font-semibold text-slate-700">Draw your signature inside the box using touch or mouse:</span>
                    <button
                      type="button"
                      onClick={clearCanvas}
                      className="text-rose-600 hover:text-rose-700 text-xs font-bold flex items-center gap-1"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Clear Signature
                    </button>
                  </div>

                  <div className="border-2 border-dashed border-slate-300 rounded-xl bg-slate-50/50 relative overflow-hidden h-44 cursor-crosshair">
                    <canvas
                      ref={canvasRef}
                      className="w-full h-full touch-none"
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                    />
                    {!hasDrawn && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-slate-400">
                        <PenTool className="h-6 w-6 stroke-1 mb-1 opacity-50" />
                        <span className="text-xs font-medium">Sign here using finger or mouse</span>
                      </div>
                    )}
                    <div className="absolute bottom-3 left-4 right-4 border-b border-slate-300/60 pointer-events-none flex justify-between text-[9px] text-slate-400 font-mono">
                      <span>X ________________________________________</span>
                      <span>SIGNATURE BASELINE</span>
                    </div>
                  </div>
                </div>
              )}

              {/* TYPE MODE */}
              {signingMode === "type" && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Full Legal Name (as will appear on the signed document)
                    </label>
                    <Input
                      type="text"
                      value={typedName}
                      onChange={(e) => setTypedName(e.target.value)}
                      placeholder="e.g. Rahul Sharma"
                      className="font-semibold text-sm"
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-500">Style:</span>
                    {(["cursive", "script", "serif"] as const).map((font) => (
                      <button
                        key={font}
                        type="button"
                        onClick={() => setSelectedFont(font)}
                        className={`px-3 py-1 rounded text-xs font-bold capitalize transition-all ${
                          selectedFont === font
                            ? "bg-blue-100 text-blue-800 border border-blue-300"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        {font}
                      </button>
                    ))}
                  </div>

                  {/* Typed Preview */}
                  <div className="border border-slate-200 rounded-xl bg-slate-50/50 p-6 text-center">
                    <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-2">Digital Signature Preview</p>
                    <p
                      className="text-3xl my-2 select-none"
                      style={{
                        color: inkColor,
                        fontFamily:
                          selectedFont === "cursive"
                            ? "'Brush Script MT', 'Dancing Script', cursive"
                            : selectedFont === "script"
                            ? "'Lucida Handwriting', cursive"
                            : "'Georgia', serif",
                        fontStyle: "italic",
                      }}
                    >
                      {typedName.trim() || "Your Signature"}
                    </p>
                    <div className="w-64 mx-auto border-b border-slate-300 mt-2"></div>
                    <p className="text-[10px] text-slate-400 font-mono mt-1">
                      AUTHENTICATED ELECTRONIC SIGNATURE &bull; {new Date().toLocaleDateString("en-IN")}
                    </p>
                  </div>
                </div>
              )}

              {/* Legal Acknowledgment Checkbox */}
              <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs text-slate-700 leading-relaxed">
                    I, <strong>{candidate.name}</strong>, hereby confirm that I have reviewed, understood, and accept all the terms, conditions, and compensation structure specified in this Offer of Employment. I agree that my digital signature constitutes a valid, legally enforceable electronic signature.
                  </span>
                </label>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRejectModalOpen(true)}
                  disabled={submitting}
                  className="w-full sm:w-auto text-xs font-bold text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700 rounded-xl"
                >
                  <XCircle className="h-4 w-4 mr-1.5" />
                  Decline Offer
                </Button>

                <Button
                  type="button"
                  onClick={handleAcceptOffer}
                  disabled={submitting || !agreedToTerms || (signingMode === "draw" && !hasDrawn) || (signingMode === "type" && !typedName.trim())}
                  className="w-full sm:w-auto bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs px-6 py-2.5 rounded-xl shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Recording Digital Signature...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Accept &amp; Digitally Sign Offer
                    </>
                  )}
                </Button>
              </div>

            </CardContent>
          </Card>
        )}

      </div>

      {/* ── DECLINE OFFER MODAL ── */}
      <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
        <DialogContent className="max-w-md bg-white rounded-2xl p-6 shadow-2xl border-none">
          <DialogHeader>
            <div className="h-10 w-10 rounded-xl bg-rose-100 flex items-center justify-center mb-2">
              <XCircle className="h-5 w-5 text-rose-600" />
            </div>
            <DialogTitle className="text-base font-black text-slate-900">Decline Employment Offer</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Please share your reason for declining this offer. This feedback helps us understand candidate expectations.
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
                <option value="Accepted another counter-offer">Accepted another job / counter-offer</option>
                <option value="Compensation & benefits expectation not met">Compensation &amp; benefits expectation not met</option>
                <option value="Location / Commute / Relocation constraint">Location / Commute / Relocation constraint</option>
                <option value="Role & responsibilities differ from expectations">Role &amp; responsibilities differ from expectations</option>
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
                placeholder="Share any specific notes or feedback with our HR recruitment team..."
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
              onClick={handleDeclineOffer}
              disabled={rejecting || !rejectReason}
              className="text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg px-4"
            >
              {rejecting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Declining...
                </>
              ) : (
                "Confirm & Decline Offer"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}

export default function OfferAcceptancePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
        </div>
      }
    >
      <OfferAcceptanceContent />
    </Suspense>
  );
}
