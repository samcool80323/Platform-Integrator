"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/theme-toggle";
import { ArrowRightLeft, ArrowRight, Loader2 } from "lucide-react";

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
    <div className="relative flex min-h-screen">
      {/* Left: Brand panel — always dark regardless of theme */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[560px] flex-col justify-between bg-[#111113] p-10">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.08]">
            <ArrowRightLeft className="h-4 w-4 text-white/80" />
          </div>
          <span className="text-[15px] font-semibold text-white/85 tracking-tight">
            Platform Integrator
          </span>
        </div>

        <div className="space-y-5">
          <h1 className="text-[40px] font-bold text-white leading-[1.1] tracking-tight">
            Migrate CRM data<br />
            to GoHighLevel<br />
            <span className="text-white/30">in minutes.</span>
          </h1>
          <p className="text-[15px] text-white/30 leading-relaxed max-w-[340px]">
            Connect any platform, auto-map your fields, and import contacts, conversations, and appointments.
          </p>
        </div>

        <div className="flex items-center gap-6 text-[13px] text-white/20">
          <span>10+ platforms</span>
          <span className="w-px h-3 bg-white/[0.08]" />
          <span>Auto field mapping</span>
          <span className="w-px h-3 bg-white/[0.08]" />
          <span>Encrypted</span>
        </div>
      </div>

      {/* Right: Form */}
      <div className="flex flex-1 flex-col bg-background">
        <div className="flex items-center justify-between p-5">
          <div className="flex items-center gap-2 lg:hidden">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg gradient-primary">
              <ArrowRightLeft className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-sm font-semibold tracking-tight">Platform Integrator</span>
          </div>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center px-6">
          <div className="w-full max-w-[360px] animate-fade-in">
            <div className="mb-8">
              <h2 className="text-[22px] font-bold tracking-tight">
                {isRegister ? "Create your account" : "Welcome back"}
              </h2>
              <p className="mt-1.5 text-[14px] text-muted-foreground">
                {isRegister
                  ? "Get started with your first migration"
                  : "Sign in to continue to your dashboard"}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {isRegister && (
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-[13px] font-medium">
                    Full name
                  </Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder="John Smith"
                    required
                    autoComplete="name"
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-[13px] font-medium">
                  Email
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@agency.com"
                  required
                  autoComplete="email"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-[13px] font-medium">
                  Password
                </Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder={isRegister ? "Min. 6 characters" : "Enter password"}
                  required
                  minLength={6}
                  autoComplete={isRegister ? "new-password" : "current-password"}
                />
              </div>

              {error && (
                <div className="rounded-lg bg-destructive/8 border border-destructive/15 px-3 py-2.5 text-[13px] text-destructive font-medium">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-9 gap-2"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Please wait...
                  </>
                ) : (
                  <>
                    {isRegister ? "Create Account" : "Sign In"}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </Button>
            </form>

            <p className="mt-6 text-center text-[13px] text-muted-foreground">
              {isRegister ? "Already have an account?" : "Don\u2019t have an account?"}{" "}
              <button
                type="button"
                onClick={() => {
                  setIsRegister(!isRegister);
                  setError("");
                }}
                className="font-medium text-foreground hover:text-accent-foreground transition-colors"
              >
                {isRegister ? "Sign in" : "Create one"}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
