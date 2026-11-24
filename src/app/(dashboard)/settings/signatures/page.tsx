"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { 
  FileSignature, Plus, Trash2, Edit2, CheckCircle2, 
  AlertCircle, Loader2, Image as ImageIcon, X 
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api-client";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";

const cn = (...classes: string[]) => classes.filter(Boolean).join(" ");

type Signatory = {
  id: number;
  name: string;
  designation: string;
  signature_url: string;
  is_active: boolean;
};

export default function SignaturesPage() {
  const [signatories, setSignatories] = useState<Signatory[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Dialog State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  
  // Form State
  const [name, setName] = useState("");
  const [designation, setDesignation] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchSignatories = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<any>("/signatories");
      const rows = Array.isArray(data) ? data : (data?.data || data?.rows || []);
      setSignatories(rows);
    } catch (err: any) {
      setError(err.message || "Failed to fetch signatories");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSignatories();
  }, [fetchSignatories]);

  const handleOpenDialog = (sig?: Signatory) => {
    setError("");
    setSuccess("");
    if (sig) {
      setEditingId(sig.id);
      setName(sig.name);
      setDesignation(sig.designation);
      setIsActive(sig.is_active);
      setPreviewUrl(sig.signature_url);
      setFile(null);
    } else {
      setEditingId(null);
      setName("");
      setDesignation("");
      setIsActive(true);
      setPreviewUrl(null);
      setFile(null);
    }
    setIsDialogOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !designation) {
      setError("Name and designation are required.");
      return;
    }
    
    if (!editingId && !file) {
      setError("Please upload a signature image.");
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const formData = new FormData();
      formData.append("name", name);
      formData.append("designation", designation);
      formData.append("is_active", String(isActive));
      if (file) {
        formData.append("signature", file);
      }

      const token = typeof window !== "undefined" ? localStorage.getItem("hrms_auth_token") : null;
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "https://hrmsbackend-z7do.onrender.com/api/v1";
      const endpoint = editingId ? `/signatories/${editingId}` : "/signatories";
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(`${baseUrl}${endpoint}`, {
        method,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to save signatory");
      }

      setSuccess(`Signatory ${editingId ? "updated" : "created"} successfully!`);
      setTimeout(() => {
        setIsDialogOpen(false);
        fetchSignatories();
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this signatory?")) return;
    try {
      await apiDelete(`/signatories/${id}`);
      fetchSignatories();
    } catch (err: any) {
      alert(err.message || "Failed to delete");
    }
  };

  return (
    <ProtectedRoute module="SETTINGS" action="READ">
      <div className="space-y-8 pb-20 max-w-5xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black text-slate-900 flex items-center gap-3 italic uppercase tracking-tighter">
              <FileSignature className="h-6 w-6 text-rose-500" /> Authorised Signatories
            </h1>
            <p className="text-[8px] font-black text-slate-400 mt-2 uppercase tracking-[0.4em]">
              Manage digital signatures for official letters & documents
            </p>
          </div>
          <Button 
            onClick={() => handleOpenDialog()}
            className="bg-[#D9F99D] hover:bg-[#C7F07A] text-slate-900 font-black text-[10px] uppercase tracking-widest rounded-xl px-5 shadow-sm"
          >
            <Plus className="h-4 w-4 mr-2" /> Add Signatory
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
          </div>
        ) : signatories.length === 0 ? (
          <Card className="border-2 border-slate-50 bg-white rounded-2xl shadow-sm text-center py-20">
            <CardContent>
              <FileSignature className="h-12 w-12 text-slate-200 mx-auto mb-4" />
              <p className="text-sm font-bold text-slate-600">No signatories found.</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase mt-2 tracking-widest">Add your first authorised signatory to start generating documents.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {signatories.map((sig) => (
              <Card key={sig.id} className="border-2 border-slate-50 rounded-2xl bg-white shadow-sm overflow-hidden group">
                <div className="h-32 bg-slate-50 flex items-center justify-center p-4 relative border-b border-slate-100">
                  {sig.signature_url ? (
                    <img src={sig.signature_url} alt={`${sig.name} signature`} className="max-h-full max-w-full object-contain" />
                  ) : (
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <ImageIcon className="h-4 w-4" /> No Signature
                    </div>
                  )}
                  <Badge className={cn(
                    "absolute top-3 left-3 border-none font-black text-[7px] uppercase tracking-widest px-2",
                    sig.is_active ? "bg-[#D1FAE5] text-emerald-600" : "bg-slate-200 text-slate-500"
                  )}>
                    {sig.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <CardContent className="p-5">
                  <h3 className="font-black text-slate-900 text-lg uppercase italic tracking-tighter">{sig.name}</h3>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">{sig.designation}</p>
                  
                  <div className="flex items-center gap-2 mt-6 pt-4 border-t border-slate-50">
                    <Button variant="outline" size="sm" onClick={() => handleOpenDialog(sig)} className="flex-1 text-[9px] font-black uppercase tracking-widest h-8 rounded-lg border-slate-200">
                      <Edit2 className="h-3 w-3 mr-1.5" /> Edit
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(sig.id)} className="h-8 w-8 p-0 rounded-lg text-rose-500 hover:bg-rose-50 hover:text-rose-600">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="rounded-2xl border-none shadow-2xl p-0 overflow-hidden max-w-md">
            <div className="bg-[#0f172a] p-6 text-white relative">
              <DialogTitle className="font-black text-xl italic uppercase tracking-tighter text-[#D9F99D]">
                {editingId ? "Edit Signatory" : "Add Signatory"}
              </DialogTitle>
              <DialogDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">
                Configure details for document generation
              </DialogDescription>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 bg-white space-y-5">
              {error && (
                <div className="flex items-center gap-3 p-3 bg-rose-50 text-rose-600 rounded-xl text-xs font-bold">
                  <AlertCircle className="h-4 w-4 shrink-0" /> {error}
                </div>
              )}
              {success && (
                <div className="flex items-center gap-3 p-3 bg-emerald-50 text-emerald-600 rounded-xl text-xs font-bold">
                  <CheckCircle2 className="h-4 w-4 shrink-0" /> {success}
                </div>
              )}

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                  <Input 
                    value={name} onChange={(e) => setName(e.target.value)} 
                    className="h-11 bg-slate-50 border-none rounded-xl focus-visible:ring-1 focus-visible:ring-[#D9F99D] font-bold"
                    placeholder="e.g. John Doe"
                  />
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Designation</label>
                  <Input 
                    value={designation} onChange={(e) => setDesignation(e.target.value)} 
                    className="h-11 bg-slate-50 border-none rounded-xl focus-visible:ring-1 focus-visible:ring-[#D9F99D] font-bold"
                    placeholder="e.g. HR Manager"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Signature Image</label>
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 p-4 text-center cursor-pointer hover:border-[#D9F99D] hover:bg-[#D9F99D]/5 transition-all group"
                  >
                    {previewUrl ? (
                      <div className="relative inline-block">
                        <img src={previewUrl} alt="Preview" className="max-h-20 max-w-full object-contain mx-auto" />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded">
                          <span className="text-white text-[9px] font-bold uppercase tracking-widest">Change</span>
                        </div>
                      </div>
                    ) : (
                      <div className="py-4">
                        <ImageIcon className="h-8 w-8 text-slate-300 mx-auto mb-2 group-hover:text-[#D9F99D] transition-colors" />
                        <p className="text-xs font-bold text-slate-500">Click to upload signature</p>
                        <p className="text-[9px] font-bold text-slate-400 mt-1">PNG with transparent background recommended</p>
                      </div>
                    )}
                  </div>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    accept="image/png, image/jpeg, image/webp" 
                    className="hidden" 
                  />
                </div>

                <div className="flex items-center gap-3 pt-2 ml-1">
                  <input 
                    type="checkbox" 
                    id="isActive" 
                    checked={isActive} 
                    onChange={(e) => setIsActive(e.target.checked)} 
                    className="h-4 w-4 rounded border-slate-300 text-[#D9F99D] focus:ring-[#D9F99D] accent-[#a3e635]"
                  />
                  <label htmlFor="isActive" className="text-xs font-bold text-slate-700 cursor-pointer">
                    Active (Available for letters)
                  </label>
                </div>
              </div>

              <DialogFooter className="pt-4 border-t border-slate-50">
                <Button 
                  type="button" 
                  variant="ghost" 
                  onClick={() => setIsDialogOpen(false)}
                  className="font-black text-[10px] uppercase tracking-widest text-slate-400 hover:text-slate-600 rounded-xl"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={submitting}
                  className="bg-[#D9F99D] hover:bg-[#C7F07A] text-slate-900 font-black text-[10px] uppercase tracking-widest rounded-xl px-6 h-10 shadow-sm"
                >
                  {submitting ? (
                    <><Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> Saving</>
                  ) : (
                    "Save Signatory"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </ProtectedRoute>
  );
}
