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
  options: Record<string, string | boolean>;
  extraTags?: string[];
  contactSource?: string;
  customFieldFolderId?: string;
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

  // Restore wizard state after OAuth redirect
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

  function goBack(toStep: number) {
    setState((prev) => {
      const cleared = { ...prev };
      if (toStep < 3) {
        delete cleared.fields;
        delete cleared.fieldMappings;
        delete cleared.extraTags;
        delete cleared.contactSource;
      }
      if (toStep < 2) {
        delete cleared.ghlLocationId;
        delete cleared.ghlLocationName;
      }
      if (toStep < 1) {
        delete cleared.credentialId;
        delete cleared.credentials;
        delete cleared.credentialLabel;
      }
      return cleared;
    });
    setStep(toStep);
  }

  async function handleStart() {
    setStartError(null);
    try {
      const body: Record<string, unknown> = {
        connectorId: state.connectorId,
        ghlLocationId: state.ghlLocationId,
        ghlLocationName: state.ghlLocationName,
        fieldMappings: state.fieldMappings,
        options: {
          ...(state.options || {}),
          ...(state.customFieldFolderId ? { customFieldFolderId: state.customFieldFolderId } : {}),
        },
        credentialLabel: state.credentialLabel || `${state.connectorName} Import`,
        extraTags: state.extraTags || [],
        contactSource: state.contactSource || state.connectorId,
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
      await fetch(`/api/migrations/${migration.id}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testLimit: 10 }),
      });
      router.push(`/migrations/${migration.id}`);
    } catch (error) {
      setStartError(error instanceof Error ? error.message : "Failed to start migration");
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-[22px] text-foreground">New Migration</h1>
        <p className="mt-1 text-[14px] text-muted-foreground">
          Import data from your client&apos;s platform into GoHighLevel.
        </p>
      </div>

      {/* Stepper */}
      <div className="flex items-center">
        {STEPS.map((s, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <div key={s.label} className="flex flex-1 items-center">
              <div className="flex items-center gap-2">
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[12px] font-bold transition-all duration-200 ${
                    done
                      ? "bg-success text-white"
                      : active
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {done ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <span>{i + 1}</span>
                  )}
                </div>
                <span
                  className={`hidden md:block text-[12px] font-medium whitespace-nowrap transition-colors ${
                    active
                      ? "text-foreground"
                      : done
                        ? "text-success"
                        : "text-muted-foreground/40"
                  }`}
                >
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className="flex-1 mx-2">
                  <div
                    className={`h-px w-full transition-colors duration-300 ${
                      done ? "bg-success" : "bg-border"
                    }`}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Step context */}
      <div className="rounded-lg bg-secondary px-3.5 py-2.5">
        <p className="text-[13px]">
          <span className="font-medium text-foreground">Step {step + 1}:</span>{" "}
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
            onBack={() => goBack(0)}
          />
        )}
        {step === 2 && (
          <StepSelectGHL
            onSelect={(locationId, locationName) => {
              updateState({ ghlLocationId: locationId, ghlLocationName: locationName });
              setStep(3);
            }}
            onBack={() => goBack(1)}
          />
        )}
        {step === 3 && state.connectorId && (state.credentials || state.credentialId) && (
          <StepFieldMapping
            connectorId={state.connectorId}
            credentials={state.credentials || {}}
            credentialId={state.credentialId}
            ghlLocationId={state.ghlLocationId}
            onConfirm={(fields, mappings, extraTags, contactSource, customFieldFolderId) => {
              updateState({ fields, fieldMappings: mappings, extraTags, contactSource, customFieldFolderId });
              setStep(4);
            }}
            onBack={() => goBack(2)}
          />
        )}
        {step === 4 && (
          <>
            {startError && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/15 bg-destructive/8 p-3.5 text-[13px] text-destructive font-medium">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {startError}
              </div>
            )}
            <StepReview state={state as WizardState} onStart={handleStart} onBack={() => goBack(3)} />
          </>
        )}
      </div>
    </div>
  );
}
