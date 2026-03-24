"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, Rocket, CheckCircle2 } from "lucide-react";
import type { FieldMapping, FieldSchema } from "@/lib/universal-model/types";

interface WizardState {
  connectorId: string;
  connectorName: string;
  credentials: Record<string, string>;
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
      <Button variant="ghost" size="sm" onClick={onBack}>
        <ChevronLeft className="mr-1 h-4 w-4" /> Back
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Review Migration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Source */}
          <div>
            <h3 className="text-sm font-medium text-neutral-500">Source</h3>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-lg font-medium">{state.connectorName}</span>
              {state.credentialLabel && (
                <Badge variant="outline">{state.credentialLabel}</Badge>
              )}
            </div>
          </div>

          {/* Destination */}
          <div>
            <h3 className="text-sm font-medium text-neutral-500">
              Destination (GHL Sub-Account)
            </h3>
            <p className="mt-1 text-lg font-medium">{state.ghlLocationName}</p>
          </div>

          {/* Field Mapping Summary */}
          <div>
            <h3 className="text-sm font-medium text-neutral-500">
              Field Mappings
            </h3>
            <div className="mt-2 flex gap-3">
              <Badge variant="secondary">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                {standardMappings.length} standard fields
              </Badge>
              <Badge variant="outline">
                {customMappings.length} custom fields to create
              </Badge>
            </div>
            <div className="mt-2 rounded-md bg-neutral-50 p-3">
              <div className="space-y-1 text-sm">
                {state.fieldMappings.slice(0, 8).map((m) => (
                  <div key={m.sourceField} className="flex items-center gap-2">
                    <span className="text-neutral-600">{m.sourceField}</span>
                    <span className="text-neutral-300">→</span>
                    <span className="font-medium">
                      {m.targetField.replace("custom:", "")}
                    </span>
                    {m.targetType === "custom" && (
                      <Badge className="bg-yellow-100 text-yellow-700 text-xs">
                        new
                      </Badge>
                    )}
                  </div>
                ))}
                {state.fieldMappings.length > 8 && (
                  <p className="text-neutral-400">
                    +{state.fieldMappings.length - 8} more fields
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Start button */}
          <div className="border-t pt-4">
            <Button
              size="lg"
              onClick={handleStart}
              disabled={starting}
              className="w-full"
            >
              <Rocket className="mr-2 h-5 w-5" />
              {starting ? "Starting Migration..." : "Start Migration"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
