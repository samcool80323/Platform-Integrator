"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StepSelectSource } from "@/components/wizard/step-select-source";
import { StepSourceAuth } from "@/components/wizard/step-source-auth";
import { StepSelectGHL } from "@/components/wizard/step-select-ghl";
import { StepFieldMapping } from "@/components/wizard/step-field-mapping";
import { StepReview } from "@/components/wizard/step-review";
import type { FieldMapping, FieldSchema } from "@/lib/universal-model/types";

interface WizardState {
  connectorId: string;
  connectorName: string;
  // Exactly one of these will be set:
  credentialId?: string;          // Reusing a saved account
  credentials?: Record<string, string>; // New credentials entered this session
  credentialLabel: string;
  ghlLocationId: string;
  ghlLocationName: string;
  fields: FieldSchema[];
  fieldMappings: FieldMapping[];
  options: Record<string, boolean>;
}

const STEPS = [
  "Select Source",
  "Authenticate",
  "Select GHL Account",
  "Map Fields",
  "Review & Start",
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

      // Pass either the saved credentialId OR the raw credentials
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">New Migration</h1>
        <p className="text-sm text-muted-foreground">
          Import data from your client&apos;s platform into GoHighLevel
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex flex-wrap items-center gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
              i <= step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}>
              {i < step ? "✓" : i + 1}
            </div>
            <span className={`text-sm ${i === step ? "font-medium text-foreground" : "text-muted-foreground"}`}>
              {label}
            </span>
            {i < STEPS.length - 1 && <div className="mx-2 h-px w-8 bg-border" />}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="mt-6">
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
                // Using a saved account
                updateState({
                  credentialId: data.credentialId,
                  credentials: undefined,
                  credentialLabel: data.label,
                });
              } else {
                // New credentials (already saved to DB inside step-source-auth)
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
              <div className="mb-4 flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
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
