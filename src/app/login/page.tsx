"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/theme-toggle";
import { ArrowRightLeft, ArrowRight, Loader2, Shield, Zap, Database } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const name = formData.get("name") as string;

    try {
      if (isRegister) {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, name }),
        });
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "Registration failed");
          setLoading(false);
          return;
        }
      }

      const result = await signIn("credentials", { email, password, redirect: false });

      if (result?.error) {
        setError("Invalid email or password.");
        setLoading(false);
        return;
      }

      router.push("/dashboard");
    } catch {
      setError("Something went wrong.");
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center gradient-hero overflow-hidden">
      {/* Animated gradient mesh */}
      <div className="gradient-mesh" />

      {/* Grid pattern overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />

      <div className="absolute right-5 top-5 z-10">
        <ThemeToggle />
      </div>

      <div className="relative z-10 w-full max-w-[420px] px-5">
        {/* Logo */}
        <div className="mb-10 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl gradient-primary shadow-lg shadow-indigo-500/25">
            <ArrowRightLeft className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Platform Integrator
          </h1>
          <p className="mt-1.5 text-sm text-white/30">
            CRM migration for GoHighLevel
          </p>
        </div>

        {/* Form */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-8 glass shadow-2xl shadow-black/20">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-white tracking-tight">
              {isRegister ? "Create account" : "Welcome back"}
            </h2>
            <p className="mt-1 text-sm text-white/35">
              {isRegister ? "Get started in under a minute" : "Sign in to continue"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs font-medium text-white/50">Name</Label>
                <Input id="name" name="name" placeholder="John Smith" required
                  className="bg-white/[0.06] border-white/[0.08] text-white placeholder:text-white/20 focus:border-indigo-500/40 focus:ring-indigo-500/15" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-medium text-white/50">Email</Label>
              <Input id="email" name="email" type="email" placeholder="you@agency.com" required
                className="bg-white/[0.06] border-white/[0.08] text-white placeholder:text-white/20 focus:border-indigo-500/40 focus:ring-indigo-500/15" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-medium text-white/50">Password</Label>
              <Input id="password" name="password" type="password"
                placeholder={isRegister ? "Min. 6 characters" : "Enter password"} required minLength={6}
                className="bg-white/[0.06] border-white/[0.08] text-white placeholder:text-white/20 focus:border-indigo-500/40 focus:ring-indigo-500/15" />
            </div>

            {error && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-2.5 text-sm text-red-400">
                {error}
              </div>
            )}

            <Button type="submit"
              className="w-full h-11 gap-2 gradient-primary border-0 text-white shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 hover:opacity-90 transition-all"
              disabled={loading}>
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Please wait...</>
              ) : (
                <>{isRegister ? "Create Account" : "Sign In"}<ArrowRight className="h-4 w-4" /></>
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-white/30">
            {isRegister ? "Have an account?" : "No account?"}{" "}
            <button type="button"
              onClick={() => { setIsRegister(!isRegister); setError(""); }}
              className="font-medium text-indigo-400/80 hover:text-indigo-300 transition-colors">
              {isRegister ? "Sign in" : "Create one"}
            </button>
          </p>
        </div>

        {/* Feature badges */}
        <div className="mt-8 flex items-center justify-center gap-4">
          {[
            { icon: Database, label: "10+ platforms" },
            { icon: Shield, label: "Encrypted" },
            { icon: Zap, label: "Auto mapping" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-1.5 text-[11px] text-white/15">
              <Icon className="h-3 w-3" />
              {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
