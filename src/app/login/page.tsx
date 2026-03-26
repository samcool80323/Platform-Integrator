"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/theme-toggle";
import { ArrowRightLeft, ArrowRight } from "lucide-react";

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
      {/* Subtle ambient light */}
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-[600px] w-[600px] rounded-full bg-blue-500/[0.03] blur-[120px]" />

      <div className="absolute right-5 top-5 z-10">
        <ThemeToggle />
      </div>

      <div className="relative z-10 w-full max-w-[420px] px-5">
        {/* Logo */}
        <div className="mb-12 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 border border-white/10 glass">
            <ArrowRightLeft className="h-5 w-5 text-white/80" />
          </div>
          <h1 className="text-xl font-semibold text-white tracking-tight">
            Platform Integrator
          </h1>
          <p className="mt-1 text-sm text-white/30">
            CRM migration for GoHighLevel
          </p>
        </div>

        {/* Form */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-8 glass">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-white tracking-tight">
              {isRegister ? "Create account" : "Welcome back"}
            </h2>
            <p className="mt-1 text-sm text-white/40">
              {isRegister ? "Get started in under a minute" : "Sign in to continue"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs font-medium text-white/50">Name</Label>
                <Input id="name" name="name" placeholder="John Smith" required
                  className="bg-white/[0.06] border-white/[0.08] text-white placeholder:text-white/25 focus:border-white/20 focus:ring-white/10" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-medium text-white/50">Email</Label>
              <Input id="email" name="email" type="email" placeholder="you@agency.com" required
                className="bg-white/[0.06] border-white/[0.08] text-white placeholder:text-white/25 focus:border-white/20 focus:ring-white/10" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-medium text-white/50">Password</Label>
              <Input id="password" name="password" type="password"
                placeholder={isRegister ? "Min. 6 characters" : "Enter password"} required minLength={6}
                className="bg-white/[0.06] border-white/[0.08] text-white placeholder:text-white/25 focus:border-white/20 focus:ring-white/10" />
            </div>

            {error && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-2.5 text-sm text-red-400">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full h-11 gap-2 bg-white text-zinc-900 hover:bg-white/90" disabled={loading}>
              {loading ? "Please wait..." : (
                <>{isRegister ? "Create Account" : "Sign In"}<ArrowRight className="h-4 w-4" /></>
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-white/30">
            {isRegister ? "Have an account?" : "No account?"}{" "}
            <button type="button"
              onClick={() => { setIsRegister(!isRegister); setError(""); }}
              className="font-medium text-white/60 hover:text-white transition-colors">
              {isRegister ? "Sign in" : "Create one"}
            </button>
          </p>
        </div>

        <p className="mt-8 text-center text-[11px] text-white/15">
          10+ platforms supported · Encrypted credentials · Auto field mapping
        </p>
      </div>
    </div>
  );
}
