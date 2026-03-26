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
  ChevronRight,
} from "lucide-react";

const navItems = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    description: "Overview & recent migrations",
  },
  {
    label: "New Migration",
    href: "/migrations/new",
    icon: Plus,
    description: "Start importing data",
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
    description: "GHL & platform connections",
  },
];

interface DashboardShellProps {
  children: React.ReactNode;
  user: { name?: string | null; email?: string | null };
}

export function DashboardShell({ children, user }: DashboardShellProps) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="flex w-[272px] flex-col border-r border-sidebar-border bg-sidebar">
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ArrowRightLeft className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground leading-none">
              Platform Integrator
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              CRM Migration Tool
            </p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1">
          <p className="px-3 pb-2 pt-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            Navigation
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
                  "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-150",
                  isActive
                    ? "bg-sidebar-active font-medium text-sidebar-active-foreground"
                    : "text-sidebar-foreground hover:bg-muted/60 hover:text-foreground"
                )}
              >
                <item.icon className={cn(
                  "h-[18px] w-[18px] shrink-0",
                  isActive ? "text-sidebar-active-foreground" : "text-muted-foreground group-hover:text-foreground"
                )} />
                <span className="flex-1">{item.label}</span>
                {isActive && (
                  <ChevronRight className="h-3.5 w-3.5 text-sidebar-active-foreground/50" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className="border-t border-sidebar-border p-3 space-y-2">
          <div className="flex items-center justify-between px-2">
            <ThemeToggle />
          </div>
          <div className="flex items-center gap-3 rounded-lg px-3 py-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
              {(user.name?.[0] || user.email?.[0] || "U").toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium text-foreground leading-none">
                {user.name || "User"}
              </p>
              <p className="truncate text-[11px] text-muted-foreground mt-0.5">
                {user.email}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto bg-background">
        <div className="mx-auto max-w-5xl px-8 py-8">{children}</div>
      </main>
    </div>
  );
}
