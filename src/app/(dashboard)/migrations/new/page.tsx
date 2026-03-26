"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { StepSelectSource } from "@/components/wizard/step-select-source";
import { StepSourceAuth } from "@/components/wizard/step-source-auth";
import { StepSelectGHL } from "@/components/wizard/step-select-ghl";
import { StepFieldMapping } from "@/components/wizard/step-field-mapping";
import { StepReview } from "@/components/wizard/step-review";
import { AlertCircle, Check } from "lucide-react";
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
  { label: "Source", description: "Choose where data comes from" },
  { label: "Authenticate", description: "Connect to the source platform" },
  { label: "Destination", description: "Pick a GHL sub-account" },
  { label: "Map Fields", description: "Match source fields to GHL" },
  { label: "Review", description: "Confirm and start importing" },
];

const WIZARD_STORAGE_KEY = "migration_wizard_state";

export default function NewMigrationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState(0);
  const [state, setState] = useState<Partial<WizardState>>({});
  const [startError, setStartError] = useState<string | null>(null);

  // Restore wizard state after OAuth redirect (page was navigated away and came back)
  useEffect(() => {
    const oauthDone = searchParams.get("oauth_done");
    const oauthConnector = searchParams.get("oauth_connector");
    const oauthError = searchParams.get("oauth_error");

    if ((oauthDone || oauthError) && oauthConnector) {
      try {
        const saved = sessionStorage.getItem(WIZARD_STORAGE_KEY);
        if (saved) {
          const { step: savedStep, state: savedState } = JSON.parse(saved);
          setState(savedState);
          setStep(savedStep);
          sessionStorage.removeItem(WIZARD_STORAGE_KEY);
        }
      } catch {
        // ignore parse errors
      }
    }
  }, [searchParams]);

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
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">New Migration</h1>
        <p className="mt-1 text-muted-foreground">
          Import data from your client&apos;s platform into GoHighLevel.
        </p>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-1">
        {STEPS.map((s, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <div key={s.label} className="flex flex-1 items-center gap-1">
              <div className="flex items-center gap-2.5">
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold transition-all duration-200 ${
                    done
                      ? "gradient-primary text-white shadow-sm shadow-sm"
                      : active
                        ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </div>
                <span
                  className={`hidden md:block text-xs font-medium whitespace-nowrap ${
                    active ? "text-foreground" : "text-muted-foreground/60"
                  }`}
                >
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className="flex-1 mx-1">
                  <div className={`h-px w-full transition-colors ${done ? "bg-primary" : "bg-border"}`} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Step hint */}
      <div className="rounded-xl bg-secondary/60 border border-primary/10 px-4 py-3">
        <p className="text-sm">
          <span className="font-semibold text-primary">Step {step + 1}:</span>{" "}
          <span className="text-muted-foreground">{STEPS[step].description}</span>
        </p>
      </div>

      {/* Content */}
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
                updateState({ credentialId: data.credentialId, credentials: undefined, credentialLabel: data.label });
              } else {
                updateState({ credentialId: undefined, credentials: data.credentials, credentialLabel: data.label });
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
              <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-500">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {startError}
              </div>
            )}
            <StepReview state={state as WizardState} onStart={handleStart} onBack={() => setStep(3)} />
          </>
        )}
      </div>
    </div>
  );
}
