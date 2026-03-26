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
  Tag,
  Plus,
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
  extraTags?: string[];
  contactSource?: string;
}

interface StepReviewProps {
  state: WizardState;
  onStart: () => Promise<void>;
  onBack: () => void;
}

export function StepReview({ state, onStart, onBack }: StepReviewProps) {
  const [starting, setStarting] = useState(false);
  const [showAllMappings, setShowAllMappings] = useState(false);

  const standardMappings = state.fieldMappings.filter((m) => m.targetType === "standard");
  const customMappings = state.fieldMappings.filter((m) => m.targetType === "custom");
  const displayMappings = showAllMappings ? state.fieldMappings : state.fieldMappings.slice(0, 10);

  async function handleStart() {
    setStarting(true);
    await onStart();
  }

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
        <ChevronLeft className="h-4 w-4" /> Back
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Review Migration</CardTitle>
          <CardDescription>
            Double-check everything below. Once started, data will begin importing into GHL.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Source & Dest */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-border p-5">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground mb-3">
                <Database className="h-3.5 w-3.5" />
                Source
              </div>
              <p className="text-lg font-bold text-foreground tracking-tight capitalize">{state.connectorName}</p>
              {state.credentialLabel && (
                <p className="mt-1 text-sm text-muted-foreground">{state.credentialLabel}</p>
              )}
            </div>
            <div className="rounded-xl border border-border p-5">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground mb-3">
                <MapPin className="h-3.5 w-3.5" />
                Destination
              </div>
              <p className="text-lg font-bold text-foreground tracking-tight">{state.ghlLocationName}</p>
            </div>
          </div>

          {/* Tags & Source */}
          <div className="rounded-xl border border-border p-5 space-y-3">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
              <Tag className="h-3.5 w-3.5" />
              Tags & Source
            </div>
            <div className="flex flex-wrap gap-1.5">
              <span className="inline-flex items-center rounded-lg border border-border bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
                imported-from-{state.connectorId}
              </span>
              {(state.extraTags || []).map((tag) => (
                <span key={tag} className="inline-flex items-center rounded-lg border border-border bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
                  {tag}
                </span>
              ))}
            </div>
            {state.contactSource && (
              <p className="text-sm text-muted-foreground">
                Contact source: <span className="font-medium text-foreground">{state.contactSource}</span>
              </p>
            )}
          </div>

          {/* Mappings */}
          <div className="rounded-xl border border-border p-5 space-y-4">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
              <Columns3 className="h-3.5 w-3.5" />
              Field Mappings
            </div>
            <div className="flex gap-2">
              <Badge variant="secondary" className="gap-1.5 text-xs px-3 py-1 rounded-lg">
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                {standardMappings.length} standard
              </Badge>
              {customMappings.length > 0 && (
                <Badge variant="outline" className="gap-1.5 text-xs px-3 py-1 rounded-lg">
                  <Plus className="h-3 w-3" />
                  {customMappings.length} custom fields to create
                </Badge>
              )}
            </div>
            <div className="rounded-xl bg-muted/50 p-3.5 space-y-1.5">
              {displayMappings.map((m) => (
                <div key={m.sourceField} className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground truncate min-w-0">{m.sourceField}</span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground/30 shrink-0" />
                  <span className="font-medium text-foreground truncate min-w-0">{m.targetField.replace("custom:", "")}</span>
                  {m.targetType === "custom" && (
                    <span className="inline-flex items-center rounded-md border border-border px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground shrink-0">new</span>
                  )}
                </div>
              ))}
              {!showAllMappings && state.fieldMappings.length > 10 && (
                <button
                  type="button"
                  onClick={() => setShowAllMappings(true)}
                  className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors pt-1"
                >
                  Show all {state.fieldMappings.length} mappings
                </button>
              )}
            </div>
          </div>

          {/* Start */}
          <div className="border-t border-border pt-6">
            <Button
              size="lg"
              onClick={handleStart}
              disabled={starting}
              className="w-full h-12 text-[15px] gap-2.5"
            >
              {starting ? (
                <><Loader2 className="h-5 w-5 animate-spin" /> Starting Migration...</>
              ) : (
                <><Rocket className="h-5 w-5" /> Start Migration</>
              )}
            </Button>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              You&apos;ll be taken to a live progress page.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
