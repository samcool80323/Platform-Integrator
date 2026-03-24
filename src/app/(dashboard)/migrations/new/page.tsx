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
  credentials: Record<string, string>;
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

  function updateState(updates: Partial<WizardState>) {
    setState((prev) => ({ ...prev, ...updates }));
  }

  async function handleStart() {
    try {
      const res = await fetch("/api/migrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectorId: state.connectorId,
          credentials: state.credentials,
          credentialLabel: state.credentialLabel || `${state.connectorName} Import`,
          ghlLocationId: state.ghlLocationId,
          ghlLocationName: state.ghlLocationName,
          fieldMappings: state.fieldMappings,
          options: state.options || {},
        }),
      });

      if (!res.ok) throw new Error("Failed to create migration");
      const { migration } = await res.json();

      // Start the migration
      await fetch(`/api/migrations/${migration.id}/start`, { method: "POST" });

      router.push(`/migrations/${migration.id}`);
    } catch (error) {
      console.error("Failed to start migration:", error);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">New Migration</h1>
        <p className="text-sm text-neutral-500">
          Import data from your client&apos;s CRM into GoHighLevel
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                i < step
                  ? "bg-neutral-900 text-white"
                  : i === step
                    ? "bg-neutral-900 text-white"
                    : "bg-neutral-100 text-neutral-400"
              }`}
            >
              {i < step ? "✓" : i + 1}
            </div>
            <span
              className={`text-sm ${
                i === step ? "font-medium text-neutral-900" : "text-neutral-400"
              }`}
            >
              {label}
            </span>
            {i < STEPS.length - 1 && (
              <div className="mx-2 h-px w-8 bg-neutral-200" />
            )}
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
            onAuthenticated={(credentials, label) => {
              updateState({ credentials, credentialLabel: label });
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
        {step === 3 && state.connectorId && state.credentials && (
          <StepFieldMapping
            connectorId={state.connectorId}
            credentials={state.credentials}
            onConfirm={(fields, mappings) => {
              updateState({ fields, fieldMappings: mappings });
              setStep(4);
            }}
            onBack={() => setStep(2)}
          />
        )}
        {step === 4 && (
          <StepReview
            state={state as WizardState}
            onStart={handleStart}
            onBack={() => setStep(3)}
          />
        )}
      </div>
    </div>
  );
}
