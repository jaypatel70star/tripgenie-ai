"use client";

import { useState } from "react";
import { Compass, Eye, EyeOff, Lock, LogIn, Mail, Sparkles, User, UserPlus } from "lucide-react";
import GenieOrb3D from "@/components/GenieOrb3D";
import TiltCard3D from "@/components/TiltCard3D";
import type { AuthUser } from "@/types/travel";

interface AuthGateProps {
  onAuthenticated: (user: AuthUser) => void;
}

export default function AuthGate({ onAuthenticated }: AuthGateProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const payload =
        mode === "login" ? { email, password } : { name, email, password };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.user) {
        setError(data.error || "Authentication failed. Please check your details.");
        return;
      }
      onAuthenticated(data.user);
    } catch {
      setError("Network error while signing in. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative z-10 min-h-[100dvh] flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md card-enter-3d">
        <TiltCard3D intensity={4} className="rounded-3xl">
          <div className="glass-panel rounded-3xl p-6 sm:p-7 space-y-6">
            {/* Brand Header */}
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="flex items-center gap-3">
                <GenieOrb3D isThinking={isSubmitting} isPaused={false} size={56} />
                <div className="text-left">
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-teal-400/30 bg-teal-400/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-teal-300 mb-1">
                    <Compass className="h-3 w-3" />
                    Private Travel Workspace
                  </div>
                  <h1 className="text-2xl font-bold tracking-tight text-white font-display">
                    TripGenie AI
                  </h1>
                </div>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed max-w-sm">
                Sign in or create an account to plan routes on the 3D Globe, track itemized ₹ budgets, and keep your chat history private to your account.
              </p>
            </div>

            {/* Mode Switcher */}
            <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-slate-950/70 p-1.5 border border-white/10">
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setError(null);
                }}
                className={`inline-flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition-all cursor-pointer ${
                  mode === "login"
                    ? "bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 shadow-sm"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                <LogIn className="h-3.5 w-3.5" />
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("register");
                  setError(null);
                }}
                className={`inline-flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition-all cursor-pointer ${
                  mode === "register"
                    ? "bg-gradient-to-r from-teal-400 to-cyan-500 text-slate-950 shadow-sm"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                <UserPlus className="h-3.5 w-3.5" />
                Create Account
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "register" && (
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-300">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      required
                      minLength={2}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Jay Patel"
                      className="w-full rounded-xl border border-white/15 bg-slate-950/75 py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400/70 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-300">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-xl border border-white/15 bg-slate-950/75 py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400/70 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-300">
                  Password
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === "register" ? "At least 6 characters" : "Enter your password"}
                    className="w-full rounded-xl border border-white/15 bg-slate-950/75 py-2.5 pl-9 pr-10 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400/70 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="rounded-xl border border-rose-400/40 bg-rose-500/15 px-3 py-2 text-xs text-rose-200">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 via-orange-400 to-teal-400 py-2.5 px-4 text-sm font-bold text-slate-950 shadow-lg shadow-amber-500/20 transition hover:brightness-110 disabled:opacity-60 cursor-pointer"
              >
                <Sparkles className="h-4 w-4" />
                {isSubmitting
                  ? mode === "login"
                    ? "Signing in..."
                    : "Creating account..."
                  : mode === "login"
                    ? "Sign In to TripGenie AI"
                    : "Create Private Account"}
              </button>
            </form>

            <div className="border-t border-white/10 pt-3 text-center text-[11px] text-slate-400">
              Each account only sees its own saved trips &amp; chat history.
            </div>
          </div>
        </TiltCard3D>
      </div>
    </div>
  );
}
