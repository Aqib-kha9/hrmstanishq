"use client";

import React, { useState, useEffect } from "react";
import { apiGet, apiPost } from "@/lib/api-client";
import {
  ShieldAlert,
  Plus,
  Edit,
  CheckCircle2,
  RefreshCw,
  Building,
  Scale,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface MinimumWageRecord {
  id?: number;
  state: string;
  wages_category: string;
  monthly_wage: number;
  remark?: string;
  effective_from?: string;
}

interface PTSlabRecord {
  id: number;
  state: string;
  state_short: string;
  gender: string;
  salary_from: number;
  salary_to: number | null;
  monthly_tax: number;
  yearly_tax: number;
  is_applicable: boolean;
}

export function MinimumWagesMaster() {
  const [wages, setWages] = useState<MinimumWageRecord[]>([]);
  const [ptSlabs, setPtSlabs] = useState<PTSlabRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Edit / Create Dialog State
  const [dialogOpen, setDialogOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<MinimumWageRecord | null>(null);
  const [formState, setFormState] = useState<string>("MP");
  const [formCategory, setFormCategory] = useState<string>("Skilled");
  const [formWage, setFormWage] = useState<string>("15294");
  const [formRemark, setFormRemark] = useState<string>("From October 2026");
  const [saving, setSaving] = useState<boolean>(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [mwRes, ptRes] = await Promise.all([
        apiGet<any>("/payroll/minimum-wages"),
        apiGet<any>("/payroll/pt-slabs"),
      ]);
      if (mwRes && mwRes.data) {
        setWages(mwRes.data.records || []);
      }
      if (ptRes && ptRes.data) {
        setPtSlabs(ptRes.data || []);
      }
    } catch (err) {
      console.error("Failed to load minimum wages or PT slabs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreateDialog = () => {
    setEditingItem(null);
    setFormState("MP");
    setFormCategory("Skilled");
    setFormWage("");
    setFormRemark("From Oct 2026");
    setDialogOpen(true);
  };

  const openEditDialog = (item: MinimumWageRecord) => {
    setEditingItem(item);
    setFormState(item.state);
    setFormCategory(item.wages_category);
    setFormWage(String(item.monthly_wage));
    setFormRemark(item.remark || "");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiPost("/payroll/minimum-wages", {
        state: formState,
        wages_category: formCategory,
        monthly_wage: parseFloat(formWage) || 0,
        remark: formRemark,
      });
      setDialogOpen(false);
      await loadData();
    } catch (err) {
      console.error("Error saving minimum wage:", err);
    } finally {
      setSaving(false);
    }
  };

  const fmt = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

  return (
    <div className="space-y-6">
      {/* ── SECTION 1: STATE MINIMUM WAGES MASTER ── */}
      <Card className="rounded-2xl border-slate-200 shadow-sm bg-white overflow-hidden">
        <CardHeader className="p-5 pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/60">
          <div>
            <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <Scale className="h-4 w-4 text-blue-600" />
              State Statutory Minimum Wages Catalog
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 mt-0.5">
              Governs the statutory wage floor across Madhya Pradesh, Uttar Pradesh (Lucknow), Rajasthan, and Maharashtra (Nagpur).
            </CardDescription>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              disabled={loading}
              className="h-8 px-3 rounded-xl border-slate-200 text-xs font-bold text-slate-700 cursor-pointer"
            >
              <RefreshCw className={`h-3 w-3 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
            <Button
              size="sm"
              onClick={openCreateDialog}
              className="h-8 px-3.5 rounded-xl bg-blue-900 hover:bg-blue-800 text-white font-black text-xs uppercase tracking-wider cursor-pointer shadow-xs flex items-center gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" /> Add / Update Rate
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/70 text-[10px] font-black uppercase text-slate-600 tracking-wider">
                  <th className="py-2.5 px-4">State / Region</th>
                  <th className="py-2.5 px-4">Wages Category</th>
                  <th className="py-2.5 px-4 text-right">Monthly Minimum Wage (₹)</th>
                  <th className="py-2.5 px-4 text-right">Annual Floor (₹)</th>
                  <th className="py-2.5 px-4">Effective Remark</th>
                  <th className="py-2.5 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {wages.map((item) => (
                  <tr key={`${item.state}-${item.wages_category}`} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-4 font-black text-slate-900">{item.state}</td>
                    <td className="py-2.5 px-4 font-bold text-slate-700">{item.wages_category}</td>
                    <td className="py-2.5 px-4 text-right font-black text-blue-900 text-sm">
                      {fmt(item.monthly_wage)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-bold text-slate-700">
                      {fmt(item.monthly_wage * 12)}
                    </td>
                    <td className="py-2.5 px-4 text-slate-500 font-medium">
                      <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded-md font-bold">
                        {item.remark || "Active"}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(item)}
                        className="h-7 w-7 p-0 rounded-lg text-slate-600 hover:text-blue-600 cursor-pointer"
                        title="Edit Rate"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ── SECTION 2: PROFESSIONAL TAX (PT) SLABS ── */}
      <Card className="rounded-2xl border-slate-200 shadow-sm bg-white overflow-hidden">
        <CardHeader className="p-5 pb-3 border-b border-slate-100 bg-slate-50/60">
          <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
            <Building className="h-4 w-4 text-blue-600" />
            State Professional Tax (PT) Statutory Slabs
          </CardTitle>
          <CardDescription className="text-xs text-slate-500 mt-0.5">
            Auto-applied during payroll deduction based on state jurisdiction and gross salary bracket.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/70 text-[10px] font-black uppercase text-slate-600 tracking-wider">
                  <th className="py-2.5 px-4">State</th>
                  <th className="py-2.5 px-4">Code</th>
                  <th className="py-2.5 px-4">Gender</th>
                  <th className="py-2.5 px-4">Monthly Gross Bracket</th>
                  <th className="py-2.5 px-4 text-right">Monthly PT (₹)</th>
                  <th className="py-2.5 px-4 text-right">Yearly PT (₹)</th>
                  <th className="py-2.5 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ptSlabs.map((slab) => (
                  <tr key={slab.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-4 font-black text-slate-900">{slab.state}</td>
                    <td className="py-2.5 px-4 font-bold text-slate-500">{slab.state_short}</td>
                    <td className="py-2.5 px-4 font-bold text-slate-700">{slab.gender}</td>
                    <td className="py-2.5 px-4 font-bold text-slate-800">
                      {fmt(slab.salary_from)} – {slab.salary_to ? fmt(slab.salary_to) : "& Above"}
                    </td>
                    <td className="py-2.5 px-4 text-right font-black text-rose-700">
                      {slab.monthly_tax > 0 ? fmt(slab.monthly_tax) : "₹0"}
                    </td>
                    <td className="py-2.5 px-4 text-right font-bold text-slate-700">
                      {slab.yearly_tax > 0 ? fmt(slab.yearly_tax) : "₹0"}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <Badge
                        className={`text-[9px] font-black uppercase ${
                          slab.is_applicable
                            ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                            : "bg-slate-100 text-slate-500 border-slate-200"
                        }`}
                      >
                        {slab.is_applicable ? "Applicable" : "Exempt / 0"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ── CREATE / EDIT MINIMUM WAGE DIALOG ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[420px] p-6 rounded-3xl bg-white border border-slate-200 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-black uppercase text-slate-900 tracking-tight">
              {editingItem ? "Update Minimum Wage Rate" : "Add Statutory Minimum Wage Rate"}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              When government revises minimum wages, updating here instantly flows to the CTC calculator and payroll roster.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3 text-xs">
            <div>
              <Label className="text-[10px] font-black uppercase text-slate-600">State / Region</Label>
              <Input
                value={formState}
                onChange={(e) => setFormState(e.target.value)}
                placeholder="e.g. MP, Lucknow, Rajsthan, Nagpur"
                className="h-9 mt-1 text-xs font-bold bg-white"
              />
            </div>

            <div>
              <Label className="text-[10px] font-black uppercase text-slate-600">Wages Category</Label>
              <select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                className="h-9 w-full mt-1 text-xs font-bold bg-white border border-slate-200 rounded-xl px-3 text-slate-900"
              >
                <option value="Unskilled">Unskilled</option>
                <option value="Semi-skilled">Semi-skilled</option>
                <option value="Skilled">Skilled</option>
                <option value="Highly Skilled">Highly Skilled</option>
              </select>
            </div>

            <div>
              <Label className="text-[10px] font-black uppercase text-slate-600">Monthly Minimum Wage (₹)</Label>
              <Input
                type="number"
                value={formWage}
                onChange={(e) => setFormWage(e.target.value)}
                placeholder="e.g. 15294"
                className="h-9 mt-1 text-xs font-bold bg-white"
              />
            </div>

            <div>
              <Label className="text-[10px] font-black uppercase text-slate-600">Effective Remark</Label>
              <Input
                value={formRemark}
                onChange={(e) => setFormRemark(e.target.value)}
                placeholder="e.g. From October 2026"
                className="h-9 mt-1 text-xs font-bold bg-white"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDialogOpen(false)}
              className="h-9 px-4 rounded-xl border-slate-200 cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="h-9 px-5 rounded-xl bg-blue-900 hover:bg-blue-800 text-white font-black uppercase text-xs tracking-wider cursor-pointer"
            >
              {saving ? "Saving..." : "Save Rate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
