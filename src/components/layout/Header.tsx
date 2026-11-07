"use client";

import { useState, useEffect } from "react";
import { Search, Bell, Menu } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { MobileSidebar } from "./Sidebar";
import { useAuth } from "@/context/AuthContext";

export function Header() {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const { user } = useAuth();
    const [mounted, setMounted] = useState(false);
    const [greeting, setGreeting] = useState("Good Day");
    const [currentDate, setCurrentDate] = useState("");

    useEffect(() => {
        setMounted(true);

        const updateTimeAndDate = () => {
            const now = new Date();
            const hour = now.getHours();

            if (hour < 12) {
                setGreeting("Good Morning");
            } else if (hour < 17) {
                setGreeting("Good Afternoon");
            } else {
                setGreeting("Good Evening");
            }

            const formattedDate = now.toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
            });
            setCurrentDate(formattedDate);
        };

        updateTimeAndDate();
        const interval = setInterval(updateTimeAndDate, 60000);
        return () => clearInterval(interval);
    }, []);

    const userFirstName = user?.name ? user.name.trim().split(" ")[0] : "";
    const displayGreeting = userFirstName ? `${greeting}, ${userFirstName}` : greeting;
    const userInitials = user?.name
        ? user.name
            .trim()
            .split(" ")
            .filter(Boolean)
            .map((n) => n[0])
            .join("")
            .slice(0, 2)
            .toUpperCase()
        : "HR";

    return (
        <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between px-4 md:px-8 bg-transparent">
            {/* Left side: Dynamic Greeting & Date */}
            <div className="flex items-center gap-4">
                <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                    <SheetTrigger asChild>
                        <Button variant="ghost" size="icon" className="lg:hidden h-9 w-9 bg-white rounded-lg shadow-sm">
                            <Menu className="h-4 w-4 text-slate-600" />
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="p-0 w-80 border-none">
                        <MobileSidebar isOpen={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen} />
                    </SheetContent>
                </Sheet>

                <div className="flex flex-col">
                    <h1 className="text-lg md:text-xl font-bold text-slate-900 leading-tight">
                        {mounted ? displayGreeting : "Good Day"}
                    </h1>
                    <p className="text-[8px] md:text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                        {mounted && currentDate ? currentDate : "Today"}
                    </p>
                </div>
            </div>

            {/* Right side: Actions & User Avatar */}
            <div className="flex items-center gap-3 md:gap-4">
                <div className="relative group hidden sm:block">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 group-focus-within:text-slate-900 transition-colors" />
                    <Input
                        type="search"
                        placeholder="Search..."
                        className="w-40 md:w-64 bg-white border-none pl-10 h-9 text-[10px] font-semibold rounded-lg shadow-sm focus-visible:ring-1 focus-visible:ring-[#D9F99D] transition-all"
                    />
                </div>
                <Button variant="ghost" size="icon" className="relative h-9 w-9 bg-white rounded-lg shadow-sm hover:bg-slate-50">
                    <Bell className="h-3.5 w-3.5 text-slate-600" />
                    <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-rose-500 border border-white" />
                </Button>
                <div
                    title={user?.name || "User Profile"}
                    className="h-9 w-9 rounded-lg bg-slate-900 flex items-center justify-center text-[9px] font-bold text-white shadow-lg cursor-default select-none"
                >
                    {userInitials}
                </div>
            </div>
        </header>
    );
}
