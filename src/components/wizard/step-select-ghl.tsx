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
            <div className="py-8 text-center text-neutral-500">
              Loading sub-accounts...
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-md bg-red-50 p-4 text-sm text-red-700">
              <AlertCircle className="h-4 w-4" />
              <div>
                <p className="font-medium">{error}</p>
                <p className="mt-1">
                  Make sure you&apos;ve connected your GHL agency in{" "}
                  <a href="/settings" className="underline">
                    Settings
                  </a>
                </p>
              </div>
            </div>
          )}

          {!loading && !error && accounts.length === 0 && (
            <div className="py-8 text-center text-neutral-500">
              No sub-accounts found
            </div>
          )}

          <div className="space-y-2">
            {accounts.map((account) => (
              <button
                key={account.id}
                onClick={() => onSelect(account.id, account.name)}
                className="flex w-full items-center gap-3 rounded-lg border p-4 text-left transition-colors hover:bg-neutral-50"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-100">
                  <Building2 className="h-5 w-5 text-neutral-600" />
                </div>
                <div>
                  <p className="font-medium text-neutral-900">{account.name}</p>
                  {(account.address || account.city) && (
                    <p className="text-sm text-neutral-500">
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
