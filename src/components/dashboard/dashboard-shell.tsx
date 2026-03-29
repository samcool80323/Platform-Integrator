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
  ChevronsRight,
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
  const initials = (user.name?.[0] || user.email?.[0] || "U").toUpperCase();

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="flex w-[240px] shrink-0 flex-col border-r border-sidebar-border bg-[var(--sidebar-bg)]">
        {/* Logo */}
        <div className="flex h-14 items-center gap-2.5 px-5 border-b border-[var(--sidebar-border)]">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg gradient-primary">
            <ArrowRightLeft className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-[13px] font-semibold text-foreground tracking-tight">
            Platform Integrator
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 pt-4 space-y-0.5">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] font-medium transition-colors duration-150",
                  isActive
                    ? "nav-active-indicator bg-[var(--sidebar-active)] text-[var(--sidebar-active-foreground)]"
                    : "text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-hover)] hover:text-foreground",
                )}
              >
                <item.icon
                  className={cn(
                    "h-4 w-4 shrink-0 transition-colors duration-150",
                    isActive
                      ? "text-[var(--sidebar-active-foreground)]"
                      : "text-[var(--sidebar-foreground)] group-hover:text-foreground",
                  )}
                />
                {item.label}
                {item.href === "/migrations/new" && !isActive && (
                  <ChevronsRight className="ml-auto h-3 w-3 opacity-0 group-hover:opacity-40 transition-opacity" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="p-3 space-y-1 border-t border-[var(--sidebar-border)]">
          <div className="flex items-center justify-between px-2">
            <ThemeToggle />
          </div>
          <div className="flex items-center gap-2.5 rounded-lg px-2.5 py-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-secondary text-[11px] font-bold text-secondary-foreground">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-[13px] font-medium text-foreground leading-none">
                {user.name || "User"}
              </p>
              <p className="truncate text-[11px] mt-0.5 text-[var(--sidebar-foreground)]">
                {user.email}
              </p>
            </div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] font-medium text-[var(--sidebar-foreground)] hover:text-destructive hover:bg-destructive/8 transition-colors duration-150"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto bg-background">
        <div className="mx-auto max-w-[960px] px-8 py-8">{children}</div>
      </main>
    </div>
  );
}
