"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft,
  Rocket,
  CheckCircle2,
  ArrowRight,
  Database,
  MapPin,
  Columns3,
  Loader2,
} from "lucide-react";
import type { FieldMapping, FieldSchema } from "@/lib/universal-model/types";

interface WizardState {
  connectorId: string;
  connectorName: string;
  credentialId?: string;
  credentials?: Record<string, string>;
  credentialLabel: string;
  ghlLocationId: string;
  ghlLocationName: string;
  fields: FieldSchema[];
  fieldMappings: FieldMapping[];
  options: Record<string, boolean>;
}

interface StepReviewProps {
  state: WizardState;
  onStart: () => Promise<void>;
  onBack: () => void;
}

export function StepReview({ state, onStart, onBack }: StepReviewProps) {
  const [starting, setStarting] = useState(false);

  const standardMappings = state.fieldMappings.filter(
    (m) => m.targetType === "standard"
  );
  const customMappings = state.fieldMappings.filter(
    (m) => m.targetType === "custom"
  );

  async function handleStart() {
    setStarting(true);
    await onStart();
  }

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Back to field mapping
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Review Migration</CardTitle>
          <CardDescription>
            Double-check everything below before starting. Once started, the
            migration will begin importing data into your GHL sub-account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Source & Destination */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                <Database className="h-3.5 w-3.5" />
                Source Platform
              </div>
              <p className="text-lg font-semibold text-foreground">
                {state.connectorName}
              </p>
              {state.credentialLabel && (
                <p className="mt-1 text-sm text-muted-foreground">
                  Account: {state.credentialLabel}
                </p>
              )}
            </div>
            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                <MapPin className="h-3.5 w-3.5" />
                GHL Destination
              </div>
              <p className="text-lg font-semibold text-foreground">
                {state.ghlLocationName}
              </p>
            </div>
          </div>

          {/* Field Mapping Summary */}
          <div className="rounded-lg border border-border p-4 space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Columns3 className="h-3.5 w-3.5" />
              Field Mappings
            </div>
            <div className="flex gap-3">
              <Badge variant="secondary" className="gap-1.5 text-xs px-3 py-1">
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                {standardMappings.length} standard
              </Badge>
              <Badge variant="outline" className="gap-1.5 text-xs px-3 py-1 text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700">
                {customMappings.length} custom (will be created)
              </Badge>
            </div>
            <div className="rounded-lg bg-muted/50 p-3 space-y-1.5">
              {state.fieldMappings.slice(0, 8).map((m) => (
                <div key={m.sourceField} className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground truncate min-w-0">{m.sourceField}</span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                  <span className="font-medium text-foreground truncate min-w-0">
                    {m.targetField.replace("custom:", "")}
                  </span>
                  {m.targetType === "custom" && (
                    <span className="inline-flex items-center rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400 shrink-0">
                      new
                    </span>
                  )}
                </div>
              ))}
              {state.fieldMappings.length > 8 && (
                <p className="text-xs text-muted-foreground pt-1">
                  + {state.fieldMappings.length - 8} more field{state.fieldMappings.length - 8 !== 1 ? "s" : ""}
                </p>
              )}
            </div>
          </div>

          {/* Start button */}
          <div className="border-t border-border pt-5">
            <Button
              size="lg"
              onClick={handleStart}
              disabled={starting}
              className="w-full h-12 text-base gap-2"
            >
              {starting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Starting Migration...
                </>
              ) : (
                <>
                  <Rocket className="h-5 w-5" />
                  Start Migration
                </>
              )}
            </Button>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              You&apos;ll be taken to a live progress page once the migration begins.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
