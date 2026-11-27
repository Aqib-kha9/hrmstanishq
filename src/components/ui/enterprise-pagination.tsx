"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
} from "lucide-react";

interface EnterprisePaginationProps {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    pageSizeOptions?: number[];
    onPageChange: (page: number) => void;
    onPageSizeChange?: (pageSize: number) => void;
    itemName?: string;
    className?: string;
}

export function EnterprisePagination({
    currentPage,
    totalPages,
    totalItems,
    itemsPerPage,
    pageSizeOptions = [10, 25, 50, 100],
    onPageChange,
    onPageSizeChange,
    itemName = "Employees",
    className,
}: EnterprisePaginationProps) {
    const [jumpInput, setJumpInput] = useState("");

    const safeTotalPages = Math.max(1, totalPages);
    const safeCurrent = Math.min(Math.max(1, currentPage), safeTotalPages);
    const startItem = totalItems === 0 ? 0 : (safeCurrent - 1) * itemsPerPage + 1;
    const endItem = Math.min(safeCurrent * itemsPerPage, totalItems);

    /**
     * Sliding window pagination range:
     * Guarantees max 7-8 visible page buttons + ellipsis
     * Never wraps or overflows even with 50+ pages
     */
    const getPageNumbers = (): (number | string)[] => {
        if (safeTotalPages <= 7) {
            return Array.from({ length: safeTotalPages }, (_, i) => i + 1);
        }
        if (safeCurrent <= 4) {
            return [1, 2, 3, 4, 5, "...", safeTotalPages];
        }
        if (safeCurrent >= safeTotalPages - 3) {
            return [1, "...", safeTotalPages - 4, safeTotalPages - 3, safeTotalPages - 2, safeTotalPages - 1, safeTotalPages];
        }
        return [1, "...", safeCurrent - 1, safeCurrent, safeCurrent + 1, "...", safeTotalPages];
    };

    const handleJump = (e: React.FormEvent) => {
        e.preventDefault();
        const p = parseInt(jumpInput, 10);
        if (!isNaN(p) && p >= 1 && p <= safeTotalPages) {
            onPageChange(p);
            setJumpInput("");
        }
    };

    return (
        <div
            className={cn(
                "bg-slate-50/80 px-6 py-3.5 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4 text-slate-600 select-none",
                className
            )}
        >
            {/* Left: Summary & Page Size Selector */}
            <div className="flex flex-wrap items-center gap-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                <p>
                    Showing <span className="text-slate-900 font-extrabold">{startItem}</span> to{" "}
                    <span className="text-slate-900 font-extrabold">{endItem}</span> of{" "}
                    <span className="text-slate-900 font-extrabold">{totalItems}</span> {itemName}
                </p>

                {onPageSizeChange && (
                    <div className="flex items-center gap-1.5 pl-3 border-l border-slate-200">
                        <span className="text-slate-400">Per Page:</span>
                        <Select
                            value={String(itemsPerPage)}
                            onValueChange={(val) => {
                                onPageSizeChange(Number(val));
                                onPageChange(1);
                            }}
                        >
                            <SelectTrigger className="h-7 w-[70px] rounded-lg border-slate-200 bg-white text-[10px] font-black text-slate-800 shadow-none focus:ring-0">
                                <SelectValue placeholder={String(itemsPerPage)} />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-slate-200">
                                {pageSizeOptions.map((sz) => (
                                    <SelectItem key={sz} value={String(sz)} className="text-[10px] font-black cursor-pointer">
                                        {sz}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}
            </div>

            {/* Right: Navigation Controls */}
            <div className="flex items-center gap-1.5 flex-wrap justify-center">
                {/* First Page Button */}
                <Button
                    variant="outline"
                    size="sm"
                    title="First Page"
                    disabled={safeCurrent <= 1}
                    onClick={() => onPageChange(1)}
                    className="h-8 w-8 p-0 rounded-xl border-slate-200 text-slate-600 hover:bg-white hover:text-slate-900 disabled:opacity-25 transition-all cursor-pointer"
                >
                    <ChevronsLeft className="h-3.5 w-3.5" />
                </Button>

                {/* Previous Page Button */}
                <Button
                    variant="outline"
                    size="sm"
                    title="Previous Page"
                    disabled={safeCurrent <= 1}
                    onClick={() => onPageChange(Math.max(1, safeCurrent - 1))}
                    className="h-8 px-2.5 rounded-xl border-slate-200 font-black text-[9px] uppercase tracking-widest text-slate-600 hover:bg-white hover:text-slate-900 disabled:opacity-25 transition-all cursor-pointer flex items-center gap-1"
                >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Prev</span>
                </Button>

                {/* Page Number Buttons */}
                <div className="flex items-center gap-1">
                    {getPageNumbers().map((p, i) =>
                        typeof p === "number" ? (
                            <Button
                                key={`page-${p}`}
                                variant="ghost"
                                size="sm"
                                onClick={() => onPageChange(p)}
                                className={cn(
                                    "h-8 min-w-[32px] px-2 rounded-xl font-black text-[10px] transition-all cursor-pointer",
                                    safeCurrent === p
                                        ? "bg-slate-900 text-white hover:bg-black shadow-sm"
                                        : "text-slate-500 hover:bg-white hover:text-slate-900 border border-transparent hover:border-slate-200"
                                )}
                            >
                                {p}
                            </Button>
                        ) : (
                            <span
                                key={`ellipsis-${i}`}
                                className="h-8 w-6 flex items-center justify-center text-slate-400 font-black text-xs select-none"
                            >
                                ...
                            </span>
                        )
                    )}
                </div>

                {/* Next Page Button */}
                <Button
                    variant="outline"
                    size="sm"
                    title="Next Page"
                    disabled={safeCurrent >= safeTotalPages}
                    onClick={() => onPageChange(Math.min(safeTotalPages, safeCurrent + 1))}
                    className="h-8 px-2.5 rounded-xl border-slate-200 font-black text-[9px] uppercase tracking-widest text-slate-600 hover:bg-white hover:text-slate-900 disabled:opacity-25 transition-all cursor-pointer flex items-center gap-1"
                >
                    <span className="hidden sm:inline">Next</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                </Button>

                {/* Last Page Button */}
                <Button
                    variant="outline"
                    size="sm"
                    title="Last Page"
                    disabled={safeCurrent >= safeTotalPages}
                    onClick={() => onPageChange(safeTotalPages)}
                    className="h-8 w-8 p-0 rounded-xl border-slate-200 text-slate-600 hover:bg-white hover:text-slate-900 disabled:opacity-25 transition-all cursor-pointer"
                >
                    <ChevronsRight className="h-3.5 w-3.5" />
                </Button>

                {/* Jump to Page Form */}
                {safeTotalPages > 3 && (
                    <form onSubmit={handleJump} className="hidden sm:flex items-center gap-1.5 pl-2.5 ml-1 border-l border-slate-200">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Go:</span>
                        <input
                            type="number"
                            min={1}
                            max={safeTotalPages}
                            value={jumpInput}
                            onChange={(e) => setJumpInput(e.target.value)}
                            placeholder={String(safeCurrent)}
                            className="h-7 w-12 rounded-lg border border-slate-200 bg-white text-center text-[10px] font-black text-slate-800 placeholder-slate-300 focus:outline-none focus:border-slate-400"
                        />
                    </form>
                )}
            </div>
        </div>
    );
}
