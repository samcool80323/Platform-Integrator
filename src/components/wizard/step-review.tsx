"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
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

      <div className="rounded-lg border border-border bg-card shadow-xs">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-[15px] font-semibold text-foreground">Review Migration</h3>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Double-check everything below. Once started, data will begin importing into GHL.
          </p>
        </div>
        <div className="p-5 space-y-5">
          {/* Source & Dest */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                <Database className="h-3 w-3" />
                Source
              </div>
              <p className="text-[15px] font-semibold text-foreground capitalize">{state.connectorName}</p>
              {state.credentialLabel && (
                <p className="mt-0.5 text-[13px] text-muted-foreground">{state.credentialLabel}</p>
              )}
            </div>
            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                <MapPin className="h-3 w-3" />
                Destination
              </div>
              <p className="text-[15px] font-semibold text-foreground">{state.ghlLocationName}</p>
            </div>
          </div>

          {/* Tags & Source */}
          <div className="rounded-lg border border-border p-4 space-y-2.5">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <Tag className="h-3 w-3" />
              Tags & Source
            </div>
            <div className="flex flex-wrap gap-1.5">
              <span className="inline-flex items-center rounded-md border border-border bg-secondary px-2 py-0.5 text-[12px] font-medium text-foreground">
                {state.connectorId}
              </span>
              {(state.extraTags || []).map((tag) => (
                <span key={tag} className="inline-flex items-center rounded-md border border-border bg-secondary px-2 py-0.5 text-[12px] font-medium text-foreground">
                  {tag}
                </span>
              ))}
            </div>
            {state.contactSource && (
              <p className="text-[13px] text-muted-foreground">
                Contact source: <span className="font-medium text-foreground">{state.contactSource}</span>
              </p>
            )}
          </div>

          {/* Mappings */}
          <div className="rounded-lg border border-border p-4 space-y-3">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <Columns3 className="h-3 w-3" />
              Field Mappings
            </div>
            <div className="flex gap-2">
              <span className="inline-flex items-center gap-1 rounded-md bg-success/10 px-2 py-0.5 text-[12px] font-medium text-success">
                <CheckCircle2 className="h-3 w-3" />
                {standardMappings.length} standard
              </span>
              {customMappings.length > 0 && (
                <span className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[12px] font-medium text-muted-foreground">
                  <Plus className="h-3 w-3" />
                  {customMappings.length} custom
                </span>
              )}
            </div>
            <div className="rounded-md bg-secondary p-3 space-y-1">
              {displayMappings.map((m) => (
                <div key={m.sourceField} className="flex items-center gap-2 text-[13px]">
                  <span className="text-muted-foreground truncate min-w-0">{m.sourceField}</span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground/25 shrink-0" />
                  <span className="font-medium text-foreground truncate min-w-0">{m.targetField.replace("custom:", "")}</span>
                  {m.targetType === "custom" && (
                    <span className="inline-flex items-center rounded px-1 py-px text-[10px] font-semibold bg-accent text-accent-foreground shrink-0">new</span>
                  )}
                </div>
              ))}
              {!showAllMappings && state.fieldMappings.length > 10 && (
                <button
                  type="button"
                  onClick={() => setShowAllMappings(true)}
                  className="text-[12px] font-medium text-muted-foreground hover:text-foreground transition-colors pt-1"
                >
                  Show all {state.fieldMappings.length} mappings
                </button>
              )}
            </div>
          </div>

          {/* Start */}
          <div className="border-t border-border pt-5">
            <Button
              size="lg"
              onClick={handleStart}
              disabled={starting}
              variant="accent"
              className="w-full h-10 gap-2"
            >
              {starting ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Starting...</>
              ) : (
                <><Rocket className="h-4 w-4" /> Test with 10 Contacts First</>
              )}
            </Button>
            <p className="mt-2.5 text-center text-[12px] text-muted-foreground">
              We&apos;ll import 10 contacts first so you can review them in GHL before pushing all.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
