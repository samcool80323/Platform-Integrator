"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  LayoutDashboard,
  ArrowRightLeft,
  Settings,
  LogOut,
  Plus,
} from "lucide-react";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "New Migration", href: "/migrations/new", icon: Plus },
  { label: "Settings", href: "/settings", icon: Settings },
];

interface DashboardShellProps {
  children: React.ReactNode;
  user: { name?: string | null; email?: string | null };
}

export function DashboardShell({ children, user }: DashboardShellProps) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen">
      {/* Sidebar — always dark, glass */}
      <aside
        className="flex w-[260px] flex-col glass"
        style={{
          background: "var(--sidebar-bg)",
          borderRight: "1px solid var(--sidebar-border)",
        }}
      >
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 px-5"
          style={{ borderBottom: "1px solid var(--sidebar-border)" }}>
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 border border-white/[0.08]">
            <ArrowRightLeft className="h-3.5 w-3.5 text-white/70" />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-white/90 leading-none tracking-tight">
              Platform Integrator
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: "var(--sidebar-heading)" }}>
              CRM Migration
            </p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 pt-5 space-y-0.5">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-medium transition-all duration-150",
                )}
                style={{
                  color: isActive ? "var(--sidebar-active-foreground)" : "var(--sidebar-foreground)",
                  background: isActive ? "var(--sidebar-active)" : undefined,
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.background = "var(--sidebar-hover)";
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.background = "";
                }}
              >
                <item.icon className="h-4 w-4 opacity-60" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="p-3 space-y-1" style={{ borderTop: "1px solid var(--sidebar-border)" }}>
          <div className="flex items-center justify-between px-2 py-1">
            <ThemeToggle />
          </div>
          <div className="flex items-center gap-2.5 rounded-xl px-3 py-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/10 text-[11px] font-semibold text-white/70">
              {(user.name?.[0] || user.email?.[0] || "U").toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-[13px] font-medium text-white/80 leading-none">
                {user.name || "User"}
              </p>
              <p className="truncate text-[11px] mt-0.5" style={{ color: "var(--sidebar-heading)" }}>
                {user.email}
              </p>
            </div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-medium transition-colors"
            style={{ color: "var(--sidebar-foreground)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "#f87171";
              e.currentTarget.style.background = "rgba(239, 68, 68, 0.08)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--sidebar-foreground)";
              e.currentTarget.style.background = "";
            }}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto bg-background">
        <div className="mx-auto max-w-5xl px-8 py-8">{children}</div>
      </main>
    </div>
  );
}
