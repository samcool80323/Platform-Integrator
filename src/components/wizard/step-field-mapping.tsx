"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ChevronLeft, ArrowRight, CheckCircle2, Loader2, AlertCircle, Info } from "lucide-react";
import type { FieldSchema, FieldMapping } from "@/lib/universal-model/types";

const GHL_STANDARD_FIELDS = [
  { key: "firstName", label: "First Name" },
  { key: "lastName", label: "Last Name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "address1", label: "Address" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "postalCode", label: "Postal Code" },
  { key: "country", label: "Country" },
  { key: "website", label: "Website" },
  { key: "companyName", label: "Company" },
  { key: "tags", label: "Tags" },
  { key: "source", label: "Source" },
];

interface StepFieldMappingProps {
  connectorId: string;
  credentials: Record<string, string>;
  credentialId?: string;
  onConfirm: (fields: FieldSchema[], mappings: FieldMapping[]) => void;
  onBack: () => void;
}

export function StepFieldMapping({ connectorId, credentials, credentialId, onConfirm, onBack }: StepFieldMappingProps) {
  const [fields, setFields] = useState<FieldSchema[]>([]);
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/connectors/${connectorId}/discover`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(credentialId ? { credentialId } : { credentials }),
    })
      .then(async (r) => { if (!r.ok) throw new Error("Failed to discover fields"); return r.json(); })
      .then((data) => { setFields(data.fields || []); setMappings(data.mappings || []); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, [connectorId, credentials]);

  function updateMapping(sourceField: string, targetField: string) {
    setMappings((prev) => {
      const existing = prev.find((m) => m.sourceField === sourceField);
      if (existing) {
        return prev.map((m) =>
          m.sourceField === sourceField
            ? { ...m, targetField, targetType: targetField.startsWith("custom:") ? ("custom" as const) : ("standard" as const) }
            : m
        );
      }
      return [...prev, { sourceField, targetField, targetType: targetField.startsWith("custom:") ? ("custom" as const) : ("standard" as const) }];
    });
  }

  function removeMapping(sourceField: string) {
    setMappings((prev) => prev.filter((m) => m.sourceField !== sourceField));
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <div className="text-center">
          <p className="font-semibold text-foreground">Discovering fields...</p>
          <p className="mt-1 text-sm">This may take a moment.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
          <ChevronLeft className="h-4 w-4" /> Back
        </Button>
        <div className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-5">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-500">Failed to discover fields</p>
            <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const standardMapped = mappings.filter((m) => m.targetType === "standard").length;
  const customMapped = mappings.filter((m) => m.targetType === "custom").length;
  const skipped = fields.length - mappings.length;

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
        <ChevronLeft className="h-4 w-4" /> Back
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Field Mapping</CardTitle>
          <CardDescription>
            Map source fields to GHL contact fields. Auto-matched where possible.
            Use the dropdown to change mappings, skip fields, or create custom GHL fields.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="gap-1.5 text-xs px-3 py-1 rounded-lg">
              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              {standardMapped} mapped
            </Badge>
            <Badge variant="secondary" className="gap-1.5 text-xs px-3 py-1 rounded-lg text-orange-600 dark:text-orange-400">
              {customMapped} custom
            </Badge>
            <Badge variant="secondary" className="gap-1.5 text-xs px-3 py-1 rounded-lg">
              {skipped} skipped
            </Badge>
          </div>

          <div className="flex items-start gap-2 rounded-xl bg-secondary/60 border border-primary/10 p-3 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary" />
            <span>
              <strong className="text-foreground">Tip:</strong> &quot;Custom&quot; fields will be created as new
              custom contact fields in GoHighLevel automatically.
            </span>
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-[1fr,auto,1fr,4.5rem] items-center gap-3 px-3 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/60">
              <span>Source</span>
              <span />
              <span>GHL Field</span>
              <span className="text-right">Status</span>
            </div>

            <div className="space-y-1.5">
              {fields.map((field) => {
                const mapping = mappings.find((m) => m.sourceField === field.key);
                return (
                  <div
                    key={field.key}
                    className="grid grid-cols-[1fr,auto,1fr,4.5rem] items-center gap-3 rounded-xl border border-border p-3 transition-all hover:border-primary/15 hover:shadow-sm"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{field.label}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] text-muted-foreground/50 font-mono">{field.type}</span>
                        {field.sampleValues?.[0] && (
                          <span className="truncate text-[10px] text-muted-foreground/40">
                            e.g. {field.sampleValues[0]}
                          </span>
                        )}
                      </div>
                    </div>

                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/20 shrink-0" />

                    <select
                      className="w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-all cursor-pointer"
                      value={mapping?.targetField || "skip"}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "skip") removeMapping(field.key);
                        else updateMapping(field.key, val);
                      }}
                    >
                      <option value="skip">-- Skip --</option>
                      <optgroup label="Standard GHL Fields">
                        {GHL_STANDARD_FIELDS.map((gf) => (
                          <option key={gf.key} value={gf.key}>{gf.label}</option>
                        ))}
                      </optgroup>
                      <option value={`custom:${field.key}`}>+ Create Custom Field</option>
                    </select>

                    <div className="text-right">
                      {mapping?.targetType === "standard" && (
                        <span className="inline-flex items-center rounded-lg bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                          mapped
                        </span>
                      )}
                      {mapping?.targetType === "custom" && (
                        <span className="inline-flex items-center rounded-lg bg-orange-500/10 px-2 py-0.5 text-[10px] font-bold text-orange-600 dark:text-orange-400">
                          custom
                        </span>
                      )}
                      {!mapping && (
                        <span className="inline-flex items-center rounded-lg bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                          skip
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-border pt-5">
            <p className="text-sm text-muted-foreground">
              {mappings.length} of {fields.length} fields will be imported
            </p>
            <Button onClick={() => onConfirm(fields, mappings)} className="gap-2">
              Confirm Mapping
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
