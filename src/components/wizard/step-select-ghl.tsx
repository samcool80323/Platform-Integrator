"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ChevronLeft,
  AlertCircle,
  Building2,
  Loader2,
  MapPin,
  ArrowRight,
  ExternalLink,
  Search,
} from "lucide-react";

interface SubAccount {
  id: string;
  name: string;
  address?: string;
  city?: string;
}

interface StepSelectGHLProps {
  onSelect: (locationId: string, locationName: string) => void;
  onBack: () => void;
}

export function StepSelectGHL({ onSelect, onBack }: StepSelectGHLProps) {
  const [accounts, setAccounts] = useState<SubAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/ghl/sub-accounts")
      .then(async (r) => {
        if (!r.ok) {
          const data = await r.json();
          throw new Error(data.error || "Failed to load accounts");
        }
        return r.json();
      })
      .then((data) => {
        setAccounts(data.subAccounts || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const filtered = search.trim()
    ? accounts.filter((a) => {
        const q = search.toLowerCase();
        return (
          a.name.toLowerCase().includes(q) ||
          a.address?.toLowerCase().includes(q) ||
          a.city?.toLowerCase().includes(q)
        );
      })
    : accounts;

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
        <ChevronLeft className="h-4 w-4" /> Back
      </Button>

      <div className="rounded-lg border border-border bg-card shadow-xs">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-[15px] font-semibold text-foreground">Select GHL Sub-Account</h3>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Choose which GoHighLevel location should receive the imported data.
          </p>
        </div>
        <div className="p-5">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-accent-foreground" />
              <span className="text-[13px]">Loading sub-accounts...</span>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-destructive/15 bg-destructive/8 p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <p className="text-[13px] font-medium text-destructive">{error}</p>
                  <p className="text-[13px] text-muted-foreground">
                    This usually means your GHL connection isn&apos;t set up or the token expired.
                  </p>
                  <Button asChild variant="outline" size="sm">
                    <a href="/settings">
                      Go to Settings
                      <ExternalLink className="ml-1.5 h-3 w-3" />
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          )}

          {!loading && !error && accounts.length === 0 && (
            <div className="py-16 text-center">
              <Building2 className="mx-auto mb-3 h-8 w-8 text-muted-foreground/25" />
              <p className="text-[14px] font-medium text-foreground">No sub-accounts found</p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Your GHL agency has no locations, or the token lacks permission to list them.
              </p>
            </div>
          )}

          {!loading && !error && accounts.length > 0 && (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
                <Input
                  placeholder={`Search ${accounts.length} sub-accounts...`}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              <p className="text-[12px] text-muted-foreground">
                {search ? `${filtered.length} of ${accounts.length} shown` : `${accounts.length} location${accounts.length !== 1 ? "s" : ""}`}
              </p>

              {filtered.length === 0 && search && (
                <div className="py-8 text-center text-muted-foreground">
                  <p className="text-[14px] font-medium text-foreground">No matches for &quot;{search}&quot;</p>
                  <p className="mt-1 text-[13px]">Try a different name or clear the search.</p>
                </div>
              )}

              <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
                {filtered.map((account) => (
                  <button
                    key={account.id}
                    onClick={() => onSelect(account.id, account.name)}
                    className="group flex w-full items-center gap-3 rounded-lg border border-transparent p-3 text-left transition-all duration-150 hover:border-border hover:bg-secondary/50"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary transition-colors duration-150 group-hover:bg-accent">
                      <Building2 className="h-4 w-4 text-muted-foreground transition-colors duration-150 group-hover:text-accent-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-medium text-foreground">
                        {account.name}
                      </p>
                      {(account.address || account.city) && (
                        <p className="mt-0.5 flex items-center gap-1 text-[12px] text-muted-foreground">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {[account.address, account.city].filter(Boolean).join(", ")}
                        </p>
                      )}
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground/0 transition-all duration-150 group-hover:text-accent-foreground shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
