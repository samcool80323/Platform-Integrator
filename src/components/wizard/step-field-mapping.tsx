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

export function StepFieldMapping({
  connectorId,
  credentials,
  credentialId,
  onConfirm,
  onBack,
}: StepFieldMappingProps) {
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
      .then(async (r) => {
        if (!r.ok) throw new Error("Failed to discover fields");
        return r.json();
      })
      .then((data) => {
        setFields(data.fields || []);
        setMappings(data.mappings || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [connectorId, credentials]);

  function updateMapping(sourceField: string, targetField: string) {
    setMappings((prev) => {
      const existing = prev.find((m) => m.sourceField === sourceField);
      if (existing) {
        return prev.map((m) =>
          m.sourceField === sourceField
            ? {
                ...m,
                targetField,
                targetType: targetField.startsWith("custom:")
                  ? ("custom" as const)
                  : ("standard" as const),
              }
            : m
        );
      }
      return [
        ...prev,
        {
          sourceField,
          targetField,
          targetType: targetField.startsWith("custom:")
            ? ("custom" as const)
            : ("standard" as const),
        },
      ];
    });
  }

  function removeMapping(sourceField: string) {
    setMappings((prev) => prev.filter((m) => m.sourceField !== sourceField));
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        <div className="text-center">
          <p className="font-medium">Discovering fields from source platform...</p>
          <p className="mt-1 text-sm">This may take a moment depending on the platform.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" /> Back
        </Button>
        <div className="flex items-start gap-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-500/10 p-4">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-600 dark:text-red-400">Failed to discover fields</p>
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
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Back to GHL selection
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Field Mapping</CardTitle>
          <CardDescription>
            Review how source fields will map to GoHighLevel contact fields.
            Fields are auto-matched where possible. You can change any mapping
            using the dropdown, or skip fields you don&apos;t want to import.
            Choosing &quot;Create Custom Field&quot; will create a new custom
            field in GHL automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Summary badges */}
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="gap-1.5 text-xs px-3 py-1">
              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              {standardMapped} auto-mapped
            </Badge>
            <Badge variant="outline" className="gap-1.5 text-xs px-3 py-1 text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700">
              {customMapped} custom field{customMapped !== 1 ? "s" : ""}
            </Badge>
            <Badge variant="outline" className="gap-1.5 text-xs px-3 py-1">
              {skipped} skipped
            </Badge>
          </div>

          {/* Info tip */}
          <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>
              <strong>Tip:</strong> Fields marked &quot;auto-mapped&quot; were matched
              automatically. &quot;Custom&quot; fields will be created as new
              custom contact fields in GoHighLevel.
            </span>
          </div>

          {/* Mapping table header */}
          <div className="space-y-2">
            <div className="grid grid-cols-[1fr,auto,1fr,5rem] items-center gap-3 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              <span>Source Field</span>
              <span />
              <span>GHL Field</span>
              <span className="text-right">Status</span>
            </div>

            {/* Mapping rows */}
            <div className="space-y-1.5">
              {fields.map((field) => {
                const mapping = mappings.find((m) => m.sourceField === field.key);
                return (
                  <div
                    key={field.key}
                    className="grid grid-cols-[1fr,auto,1fr,5rem] items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/30"
                  >
                    {/* Source field */}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{field.label}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                          {field.type}
                        </Badge>
                        {field.sampleValues?.[0] && (
                          <span className="truncate text-[11px] text-muted-foreground/60">
                            e.g. {field.sampleValues[0]}
                          </span>
                        )}
                      </div>
                    </div>

                    <ArrowRight className="h-4 w-4 text-muted-foreground/30 shrink-0" />

                    {/* Target field selector */}
                    <select
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 transition-colors"
                      value={mapping?.targetField || "skip"}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "skip") {
                          removeMapping(field.key);
                        } else {
                          updateMapping(field.key, val);
                        }
                      }}
                    >
                      <option value="skip">-- Skip this field --</option>
                      <optgroup label="Standard GHL Fields">
                        {GHL_STANDARD_FIELDS.map((gf) => (
                          <option key={gf.key} value={gf.key}>
                            {gf.label}
                          </option>
                        ))}
                      </optgroup>
                      <option value={`custom:${field.key}`}>
                        + Create Custom Field
                      </option>
                    </select>

                    {/* Status badge */}
                    <div className="text-right">
                      {mapping?.targetType === "standard" && (
                        <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                          mapped
                        </span>
                      )}
                      {mapping?.targetType === "custom" && (
                        <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                          custom
                        </span>
                      )}
                      {!mapping && (
                        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
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
