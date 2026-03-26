"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  ChevronLeft,
  AlertCircle,
  Building2,
  Loader2,
  MapPin,
  ArrowRight,
  ExternalLink,
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

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
        <ChevronLeft className="h-4 w-4" /> Back
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Select GHL Sub-Account</CardTitle>
          <CardDescription>
            Choose which GoHighLevel location should receive the imported data.
            Contacts, conversations, and other records will be created here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading && (
            <div className="flex items-center justify-center gap-2.5 py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              Loading sub-accounts...
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-5">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <p className="font-semibold text-red-500">{error}</p>
                  <p className="text-sm text-muted-foreground">
                    This usually means your GHL connection isn&apos;t set up or the token expired.
                  </p>
                  <Button asChild variant="outline" size="sm">
                    <a href="/settings">
                      Go to Settings
                      <ExternalLink className="ml-2 h-3 w-3" />
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          )}

          {!loading && !error && accounts.length === 0 && (
            <div className="py-16 text-center">
              <Building2 className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
              <p className="font-semibold text-foreground">No sub-accounts found</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Your GHL agency has no locations, or the token lacks permission to list them.
              </p>
            </div>
          )}

          {!loading && !error && accounts.length > 0 && (
            <div className="space-y-2">
              <p className="mb-3 text-sm text-muted-foreground">
                {accounts.length} location{accounts.length !== 1 ? "s" : ""} found. Click to continue.
              </p>
              {accounts.map((account) => (
                <button
                  key={account.id}
                  onClick={() => onSelect(account.id, account.name)}
                  className="group flex w-full items-center gap-4 rounded-xl border border-border bg-card p-4 text-left shadow-card transition-all duration-200 hover:shadow-card-hover hover:border-primary/30"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 group-hover:gradient-primary group-hover:text-white transition-all duration-200">
                    <Building2 className="h-5 w-5 text-violet-500 group-hover:text-white transition-colors" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground tracking-tight">
                      {account.name}
                    </p>
                    {(account.address || account.city) && (
                      <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
                        <MapPin className="h-3 w-3 shrink-0" />
                        {[account.address, account.city].filter(Boolean).join(", ")}
                      </p>
                    )}
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground/20 group-hover:text-primary transition-all group-hover:translate-x-0.5" />
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
