"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { Loader2, LogIn, ShieldAlert, ShieldCheck, UserCheck, Users, Zap, Smartphone } from "lucide-react";

interface QuickCredential {
  roleLabel: string;
  name: string;
  email: string;
  password: string;
  icon: any;
}

const DEV_CREDENTIALS: QuickCredential[] = [
  {
    roleLabel: "Super Admin",
    name: "Super Administrator",
    email: "admin@bpmarketing.com",
    password: "Admin@1234",
    icon: ShieldAlert,
  },
  {
    roleLabel: "Administrator",
    name: "System Admin",
    email: "admin@hrms.com",
    password: "Password@123",
    icon: ShieldCheck,
  },
  {
    roleLabel: "HR Manager",
    name: "Priya Sharma (HR)",
    email: "hr@hrms.com",
    password: "Password@123",
    icon: UserCheck,
  },
  {
    roleLabel: "Team Manager",
    name: "Amit Patel (Manager)",
    email: "manager@hrms.com",
    password: "Password@123",
    icon: Users,
  },
];

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password.trim()) {
      setError("Please enter both email and password.");
      return;
    }

    setIsLoading(true);
    try {
      await login(email.trim(), password);
      router.push("/");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Login failed. Please try again.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickLogin = async (credEmail: string, credPass: string) => {
    setEmail(credEmail);
    setPassword(credPass);
    setError("");
    setIsLoading(true);
    try {
      await login(credEmail, credPass);
      router.push("/");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Login failed. Please try again.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="shadow-lg border-slate-200">
      <CardHeader className="text-center pb-2">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl overflow-hidden bg-primary/10">
          <img
            src="/company_logopng.png"
            alt="Company Logo"
            className="h-14 w-14 object-contain"
          />
        </div>
        <CardTitle className="text-2xl font-bold">Welcome Back</CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          Sign in to your HRMS Web Portal
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Email
            </label>
            <Input
              id="email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              autoComplete="email"
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Password
            </label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              autoComplete="current-password"
              required
            />
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in…
              </>
            ) : (
              <>
                <LogIn className="mr-2 h-4 w-4" />
                Sign In
              </>
            )}
          </Button>
        </form>

        {/* ── Dev Quick 1-Click Login Helper for Management Tiers ── */}
        <div className="pt-3 border-t border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Zap className="h-3 w-3 text-amber-500 fill-amber-500" />
              Dev Quick Login (Web Management)
            </span>
            <span className="text-[9px] text-slate-400 font-medium">1-Click Sign In</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {DEV_CREDENTIALS.map((cred) => {
              const Icon = cred.icon;
              return (
                <button
                  key={cred.email}
                  type="button"
                  disabled={isLoading}
                  onClick={() => handleQuickLogin(cred.email, cred.password)}
                  className="p-2 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-100/90 hover:border-slate-300 transition-all text-left flex flex-col justify-between group disabled:opacity-50 cursor-pointer shadow-sm hover:shadow"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[7.5px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-700 truncate max-w-[120px]">
                      {cred.roleLabel}
                    </span>
                    <Icon className="h-3 w-3 text-slate-400 group-hover:text-indigo-600 shrink-0" />
                  </div>
                  <div className="text-[10px] font-bold text-slate-800 truncate">
                    {cred.name}
                  </div>
                  <div className="text-[8px] text-slate-400 truncate font-mono">
                    {cred.email}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Note regarding mobile app access for employees */}
          <div className="mt-2.5 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200/80 text-[10px] text-slate-500">
            <Smartphone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <span>
              Staff Employees log in exclusively via the <strong>Mobile App</strong>.
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
