"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft, AlertCircle, Building2 } from "lucide-react";

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
      <Button variant="ghost" size="sm" onClick={onBack}>
        <ChevronLeft className="mr-1 h-4 w-4" /> Back
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Select GHL Sub-Account</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && (
            <div className="py-8 text-center text-muted-foreground">
              Loading sub-accounts...
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-4 text-sm text-destructive dark:bg-destructive/20">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">{error}</p>
                <p className="mt-1 text-destructive/80">
                  Make sure you&apos;ve connected your GHL agency in{" "}
                  <a href="/settings" className="underline">
                    Settings
                  </a>
                </p>
              </div>
            </div>
          )}

          {!loading && !error && accounts.length === 0 && (
            <div className="py-8 text-center text-muted-foreground">
              No sub-accounts found
            </div>
          )}

          <div className="space-y-2">
            {accounts.map((account) => (
              <button
                key={account.id}
                onClick={() => onSelect(account.id, account.name)}
                className="flex w-full items-center gap-3 rounded-lg border border-border p-4 text-left transition-colors hover:bg-muted/50 hover:text-foreground"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium text-foreground">{account.name}</p>
                  {(account.address || account.city) && (
                    <p className="text-sm text-muted-foreground">
                      {[account.address, account.city].filter(Boolean).join(", ")}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
