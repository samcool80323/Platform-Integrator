"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft, ArrowRight, CheckCircle2 } from "lucide-react";
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
  credentialId?: string; // if set, server will look up credentials by ID
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
      <div className="py-12 text-center text-muted-foreground">
        Discovering fields from source platform...
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ChevronLeft className="mr-1 h-4 w-4" /> Back
        </Button>
        <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive dark:bg-destructive/20">
          {error}
        </div>
      </div>
    );
  }

  const standardMapped = mappings.filter((m) => m.targetType === "standard").length;
  const customMapped = mappings.filter((m) => m.targetType === "custom").length;
  const skipped = fields.length - mappings.length;

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack}>
        <ChevronLeft className="mr-1 h-4 w-4" /> Back
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Field Mapping</CardTitle>
          <p className="text-sm text-muted-foreground">
            Map source fields to GoHighLevel contact fields. Unmatched fields
            will be created as custom fields.
          </p>
        </CardHeader>
        <CardContent>
          {/* Summary */}
          <div className="mb-4 flex gap-3">
            <Badge variant="secondary">
              <CheckCircle2 className="mr-1 h-3 w-3" />
              {standardMapped} auto-mapped
            </Badge>
            <Badge variant="outline">{customMapped} custom fields</Badge>
            <Badge variant="outline">{skipped} skipped</Badge>
          </div>

          {/* Mapping table */}
          <div className="space-y-2">
            <div className="grid grid-cols-[1fr,auto,1fr,auto] items-center gap-2 px-2 text-xs font-medium text-muted-foreground">
              <span>Source Field</span>
              <span />
              <span>GHL Field</span>
              <span />
            </div>

            {fields.map((field) => {
              const mapping = mappings.find((m) => m.sourceField === field.key);
              return (
                <div
                  key={field.key}
                  className="grid grid-cols-[1fr,auto,1fr,auto] items-center gap-2 rounded-md border border-border p-2"
                >
                  {/* Source field */}
                  <div>
                    <p className="text-sm font-medium text-foreground">{field.label}</p>
                    <div className="flex items-center gap-1">
                      <Badge variant="outline" className="text-xs">
                        {field.type}
                      </Badge>
                      {field.sampleValues?.[0] && (
                        <span className="truncate text-xs text-muted-foreground/60">
                          e.g. {field.sampleValues[0]}
                        </span>
                      )}
                    </div>
                  </div>

                  <ArrowRight className="h-4 w-4 text-muted-foreground/40" />

                  {/* Target field selector */}
                  <select
                    className="rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
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
                    <option value="skip">-- Skip --</option>
                    <optgroup label="Standard Fields">
                      {GHL_STANDARD_FIELDS.map((gf) => (
                        <option key={gf.key} value={gf.key}>
                          {gf.label}
                        </option>
                      ))}
                    </optgroup>
                    <option value={`custom:${field.key}`}>
                      Create Custom Field
                    </option>
                  </select>

                  {/* Status badge */}
                  <div className="w-16 text-right">
                    {mapping?.targetType === "standard" && (
                      <Badge className="bg-green-500/15 text-green-600 dark:text-green-400 text-xs">
                        mapped
                      </Badge>
                    )}
                    {mapping?.targetType === "custom" && (
                      <Badge className="bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 text-xs">
                        custom
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6">
            <Button onClick={() => onConfirm(fields, mappings)}>
              Confirm Mapping
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
