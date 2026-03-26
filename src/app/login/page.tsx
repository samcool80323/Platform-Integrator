"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { ArrowRightLeft, Users, Zap, Shield } from "lucide-react";

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

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid email or password. Please try again.");
        setLoading(false);
        return;
      }

      router.push("/dashboard");
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen bg-background">
      {/* Theme toggle */}
      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle />
      </div>

      {/* Left panel - branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-primary p-12 text-primary-foreground">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
              <ArrowRightLeft className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold">Platform Integrator</span>
          </div>
        </div>

        <div className="space-y-8">
          <div>
            <h1 className="text-4xl font-bold leading-tight">
              Migrate your CRM data
              <br />to GoHighLevel
            </h1>
            <p className="mt-4 text-lg text-primary-foreground/80">
              The easiest way to move contacts, conversations, and more from any
              platform into GHL sub-accounts.
            </p>
          </div>

          <div className="space-y-4">
            <FeatureItem
              icon={Users}
              title="10+ Platforms Supported"
              description="Podium, HubSpot, Pipedrive, Dentally, and more"
            />
            <FeatureItem
              icon={Zap}
              title="Automated Field Mapping"
              description="Smart field detection maps your data automatically"
            />
            <FeatureItem
              icon={Shield}
              title="Secure & Encrypted"
              description="All credentials are encrypted at rest"
            />
          </div>
        </div>

        <p className="text-sm text-primary-foreground/50">
          Built for GHL agencies and their clients
        </p>
      </div>

      {/* Right panel - form */}
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Mobile branding */}
          <div className="mb-8 text-center lg:hidden">
            <div className="mb-4 flex items-center justify-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <ArrowRightLeft className="h-5 w-5" />
              </div>
              <span className="text-xl font-bold text-foreground">Platform Integrator</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Migrate CRM data to GoHighLevel
            </p>
          </div>

          <Card className="border-border/50 shadow-lg">
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-2xl font-bold">
                {isRegister ? "Create your account" : "Welcome back"}
              </CardTitle>
              <CardDescription className="text-base">
                {isRegister
                  ? "Set up your account to start migrating data"
                  : "Sign in to manage your migrations"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {isRegister && (
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      name="name"
                      placeholder="e.g. John Smith"
                      required
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="you@agency.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    placeholder={isRegister ? "Min. 6 characters" : "Enter your password"}
                    required
                    minLength={6}
                  />
                </div>

                {error && (
                  <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    {error}
                  </div>
                )}

                <Button type="submit" className="w-full h-11 text-base" disabled={loading}>
                  {loading
                    ? "Please wait..."
                    : isRegister
                      ? "Create Account"
                      : "Sign In"}
                </Button>

                <div className="text-center">
                  <p className="text-sm text-muted-foreground">
                    {isRegister ? "Already have an account?" : "Don't have an account?"}{" "}
                    <button
                      type="button"
                      onClick={() => { setIsRegister(!isRegister); setError(""); }}
                      className="font-medium text-primary hover:underline"
                    >
                      {isRegister ? "Sign in" : "Create one"}
                    </button>
                  </p>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function FeatureItem({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-sm text-primary-foreground/70">{description}</p>
      </div>
    </div>
  );
}
