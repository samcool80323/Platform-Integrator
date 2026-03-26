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
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Back to authentication
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Select GHL Sub-Account</CardTitle>
          <CardDescription>
            Choose which GoHighLevel location (sub-account) should receive the imported data.
            This is the destination where contacts, conversations, and other records will be created.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading && (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading your GHL sub-accounts...
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-500/10 p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <p className="font-medium text-red-600 dark:text-red-400">{error}</p>
                  <p className="text-sm text-muted-foreground">
                    This usually means your GHL agency connection hasn&apos;t been set up yet, or the token has expired.
                  </p>
                  <Button asChild variant="outline" size="sm">
                    <a href="/settings">
                      Go to Settings to connect GHL
                      <ExternalLink className="ml-2 h-3 w-3" />
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          )}

          {!loading && !error && accounts.length === 0 && (
            <div className="py-12 text-center">
              <Building2 className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="font-medium text-foreground">No sub-accounts found</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Your GHL agency doesn&apos;t have any locations/sub-accounts, or the current
                token doesn&apos;t have permission to list them.
              </p>
            </div>
          )}

          {!loading && !error && accounts.length > 0 && (
            <div className="space-y-2">
              <p className="mb-3 text-sm text-muted-foreground">
                {accounts.length} sub-account{accounts.length !== 1 ? "s" : ""} found. Click one to continue.
              </p>
              {accounts.map((account) => (
                <button
                  key={account.id}
                  onClick={() => onSelect(account.id, account.name)}
                  className="group flex w-full items-center gap-4 rounded-lg border border-border p-4 text-left transition-all hover:border-primary/40 hover:bg-accent/50 hover:shadow-sm"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted group-hover:bg-primary/10 transition-colors">
                    <Building2 className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground group-hover:text-primary transition-colors">
                      {account.name}
                    </p>
                    {(account.address || account.city) && (
                      <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
                        <MapPin className="h-3 w-3 shrink-0" />
                        {[account.address, account.city].filter(Boolean).join(", ")}
                      </p>
                    )}
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary transition-all group-hover:translate-x-0.5" />
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
