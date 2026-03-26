"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StepSelectSource } from "@/components/wizard/step-select-source";
import { StepSourceAuth } from "@/components/wizard/step-source-auth";
import { StepSelectGHL } from "@/components/wizard/step-select-ghl";
import { StepFieldMapping } from "@/components/wizard/step-field-mapping";
import { StepReview } from "@/components/wizard/step-review";
import { AlertCircle, CheckCircle2 } from "lucide-react";
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

const STEPS = [
  { label: "Source Platform", description: "Choose where data is coming from" },
  { label: "Authentication", description: "Connect to the source" },
  { label: "GHL Account", description: "Pick destination sub-account" },
  { label: "Field Mapping", description: "Map source fields to GHL" },
  { label: "Review & Start", description: "Confirm and begin migration" },
];

export default function NewMigrationPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [state, setState] = useState<Partial<WizardState>>({});
  const [startError, setStartError] = useState<string | null>(null);

  function updateState(updates: Partial<WizardState>) {
    setState((prev) => ({ ...prev, ...updates }));
  }

  async function handleStart() {
    setStartError(null);
    try {
      const body: Record<string, unknown> = {
        connectorId: state.connectorId,
        ghlLocationId: state.ghlLocationId,
        ghlLocationName: state.ghlLocationName,
        fieldMappings: state.fieldMappings,
        options: state.options || {},
        credentialLabel: state.credentialLabel || `${state.connectorName} Import`,
      };

      if (state.credentialId) {
        body.credentialId = state.credentialId;
      } else {
        body.credentials = state.credentials;
      }

      const res = await fetch("/api/migrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        setStartError(data.error || "Failed to create migration");
        return;
      }

      const { migration } = await res.json();
      await fetch(`/api/migrations/${migration.id}/start`, { method: "POST" });
      router.push(`/migrations/${migration.id}`);
    } catch (error) {
      setStartError(error instanceof Error ? error.message : "Failed to start migration");
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">New Migration</h1>
        <p className="mt-1 text-muted-foreground">
          Follow the steps below to import data from your client&apos;s platform into GoHighLevel.
        </p>
      </div>

      {/* Step indicator */}
      <div className="relative">
        <div className="flex items-center justify-between">
          {STEPS.map((s, i) => {
            const isCompleted = i < step;
            const isCurrent = i === step;
            return (
              <div key={s.label} className="flex flex-1 items-center">
                <div className="flex flex-col items-center text-center">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-semibold transition-all ${
                      isCompleted
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : isCurrent
                          ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/25"
                          : "border-border bg-background text-muted-foreground"
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      i + 1
                    )}
                  </div>
                  <p className={`mt-2 text-xs font-medium hidden sm:block ${
                    isCurrent ? "text-foreground" : "text-muted-foreground"
                  }`}>
                    {s.label}
                  </p>
                </div>
                {i < STEPS.length - 1 && (
                  <div className="flex-1 px-2">
                    <div
                      className={`h-0.5 w-full rounded-full transition-colors ${
                        i < step ? "bg-emerald-500" : "bg-border"
                      }`}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Current step description */}
      <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
        <p className="text-sm">
          <span className="font-medium text-foreground">Step {step + 1}:</span>{" "}
          <span className="text-muted-foreground">{STEPS[step].description}</span>
        </p>
      </div>

      {/* Step content */}
      <div>
        {step === 0 && (
          <StepSelectSource
            onSelect={(connectorId, connectorName) => {
              updateState({ connectorId, connectorName });
              setStep(1);
            }}
          />
        )}

        {step === 1 && state.connectorId && (
          <StepSourceAuth
            connectorId={state.connectorId}
            onAuthenticated={(data) => {
              if ("credentialId" in data) {
                updateState({
                  credentialId: data.credentialId,
                  credentials: undefined,
                  credentialLabel: data.label,
                });
              } else {
                updateState({
                  credentialId: undefined,
                  credentials: data.credentials,
                  credentialLabel: data.label,
                });
              }
              setStep(2);
            }}
            onBack={() => setStep(0)}
          />
        )}

        {step === 2 && (
          <StepSelectGHL
            onSelect={(locationId, locationName) => {
              updateState({ ghlLocationId: locationId, ghlLocationName: locationName });
              setStep(3);
            }}
            onBack={() => setStep(1)}
          />
        )}

        {step === 3 && state.connectorId && (state.credentials || state.credentialId) && (
          <StepFieldMapping
            connectorId={state.connectorId}
            credentials={state.credentials || {}}
            credentialId={state.credentialId}
            onConfirm={(fields, mappings) => {
              updateState({ fields, fieldMappings: mappings });
              setStep(4);
            }}
            onBack={() => setStep(2)}
          />
        )}

        {step === 4 && (
          <>
            {startError && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {startError}
              </div>
            )}
            <StepReview
              state={state as WizardState}
              onStart={handleStart}
              onBack={() => setStep(3)}
            />
          </>
        )}
      </div>
    </div>
  );
}
