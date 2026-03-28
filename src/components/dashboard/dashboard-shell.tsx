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
  Sparkles,
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
      {/* Sidebar */}
      <aside
        className="flex w-[260px] flex-col glass"
        style={{
          background: "var(--sidebar-bg)",
          borderRight: "1px solid var(--sidebar-border)",
        }}
      >
        {/* Logo */}
        <div
          className="flex h-[68px] items-center gap-3 px-5"
          style={{ borderBottom: "1px solid var(--sidebar-border)" }}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl gradient-primary shadow-lg shadow-indigo-500/20">
            <ArrowRightLeft className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-[13px] font-bold text-white/90 leading-none tracking-tight">
              Platform Integrator
            </p>
            <p
              className="text-[11px] mt-1 flex items-center gap-1"
              style={{ color: "var(--sidebar-heading)" }}
            >
              <Sparkles className="h-2.5 w-2.5" />
              CRM Migration
            </p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 pt-6 space-y-1">
          <p
            className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.12em]"
            style={{ color: "var(--sidebar-heading)" }}
          >
            Menu
          </p>
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-200",
                  isActive && "nav-active-indicator",
                )}
                style={{
                  color: isActive
                    ? "var(--sidebar-active-foreground)"
                    : "var(--sidebar-foreground)",
                  background: isActive ? "var(--sidebar-active)" : undefined,
                }}
                onMouseEnter={(e) => {
                  if (!isActive)
                    e.currentTarget.style.background = "var(--sidebar-hover)";
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.background = "";
                }}
              >
                <item.icon
                  className={cn(
                    "h-4 w-4 transition-colors",
                    isActive ? "text-indigo-400" : "opacity-50",
                  )}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div
          className="p-3 space-y-1"
          style={{ borderTop: "1px solid var(--sidebar-border)" }}
        >
          <div className="flex items-center justify-between px-2 py-1">
            <ThemeToggle />
          </div>
          <div className="flex items-center gap-2.5 rounded-xl px-3 py-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg gradient-primary text-[11px] font-bold text-white shadow-sm">
              {(user.name?.[0] || user.email?.[0] || "U").toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-[13px] font-semibold text-white/85 leading-none">
                {user.name || "User"}
              </p>
              <p
                className="truncate text-[11px] mt-1"
                style={{ color: "var(--sidebar-heading)" }}
              >
                {user.email}
              </p>
            </div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-200"
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
