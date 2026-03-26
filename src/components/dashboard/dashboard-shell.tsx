"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
      {/* Sidebar — always dark */}
      <aside
        className="flex w-[260px] flex-col border-r"
        style={{
          background: "var(--sidebar-bg)",
          borderColor: "var(--sidebar-border)",
        }}
      >
        {/* Logo */}
        <div
          className="flex h-[68px] items-center gap-3 px-5"
          style={{ borderBottom: "1px solid var(--sidebar-border)" }}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl gradient-primary shadow-md shadow-violet-500/20">
            <ArrowRightLeft className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-[13px] font-bold text-white leading-none tracking-tight">
              Platform Integrator
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: "var(--sidebar-heading)" }}>
              CRM Migration Tool
            </p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 pt-6 space-y-1">
          <p
            className="px-3 pb-3 text-[10px] font-bold uppercase tracking-[0.12em]"
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
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-150",
                  isActive
                    ? "text-white"
                    : "hover:text-white"
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
                <item.icon className="h-[18px] w-[18px] shrink-0 opacity-70" />
                <span>{item.label}</span>
                {isActive && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-violet-400" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="p-3 space-y-2" style={{ borderTop: "1px solid var(--sidebar-border)" }}>
          <div className="flex items-center justify-between px-2">
            <ThemeToggle />
          </div>
          <div className="flex items-center gap-3 rounded-xl px-3 py-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full gradient-primary text-[11px] font-bold text-white">
              {(user.name?.[0] || user.email?.[0] || "U").toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-[13px] font-medium text-white/90 leading-none">
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
              e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)";
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
