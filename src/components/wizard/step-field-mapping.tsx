"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ChevronLeft, ArrowRight, CheckCircle2, Loader2, AlertCircle, Info, Code, ChevronDown, ChevronUp, Plus, Tag, X } from "lucide-react";
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
  onConfirm: (fields: FieldSchema[], mappings: FieldMapping[], extraTags?: string[], contactSource?: string) => void;
  onBack: () => void;
}

export function StepFieldMapping({ connectorId, credentials, credentialId, onConfirm, onBack }: StepFieldMappingProps) {
  const [fields, setFields] = useState<FieldSchema[]>([]);
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showRawPayload, setShowRawPayload] = useState(false);
  const [extraTags, setExtraTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [contactSource, setContactSource] = useState(connectorId);

  useEffect(() => {
    fetch(`/api/connectors/${connectorId}/discover`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(credentialId ? { credentialId } : { credentials }),
    })
      .then(async (r) => { if (!r.ok) throw new Error("Failed to discover fields"); return r.json(); })
      .then((data) => { setFields(data.fields || []); setMappings(data.mappings || []); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, [connectorId, credentials, credentialId]);

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

  function addTag() {
    const tag = tagInput.trim();
    if (tag && !extraTags.includes(tag)) {
      setExtraTags((prev) => [...prev, tag]);
      setTagInput("");
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-foreground" />
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

  const samplePayloadField = fields.find((f) => f.key === "_samplePayload");
  const mappableFields = fields.filter((f) => f.key !== "_samplePayload");

  const standardMapped = mappings.filter((m) => m.targetType === "standard").length;
  const customMappings = mappings.filter((m) => m.targetType === "custom");
  const skipped = mappableFields.length - mappings.length;

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
        <ChevronLeft className="h-4 w-4" /> Back
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Field Mapping</CardTitle>
          <CardDescription>
            Review how source fields map to GHL. Auto-matched where possible.
            Change any mapping with the dropdown, or select &quot;Create Custom Field&quot; to auto-create it in GHL.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Summary */}
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="gap-1.5 text-xs px-3 py-1 rounded-lg">
              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              {standardMapped} standard
            </Badge>
            {customMappings.length > 0 && (
              <Badge variant="outline" className="gap-1.5 text-xs px-3 py-1 rounded-lg">
                <Plus className="h-3 w-3" />
                {customMappings.length} custom (will be created)
              </Badge>
            )}
            <Badge variant="secondary" className="gap-1.5 text-xs px-3 py-1 rounded-lg">
              {skipped} skipped
            </Badge>
          </div>

          {/* Custom fields that will be created */}
          {customMappings.length > 0 && (
            <div className="rounded-xl border border-border bg-muted/50 p-4 space-y-2">
              <p className="text-xs font-semibold text-foreground">Custom fields to be created in GHL:</p>
              <div className="flex flex-wrap gap-1.5">
                {customMappings.map((m) => (
                  <span key={m.sourceField} className="inline-flex items-center rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground">
                    {m.targetField.replace("custom:", "")}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-start gap-2 rounded-xl bg-muted/50 border border-border p-3 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-foreground" />
            <span>
              Contacts are auto-tagged <code className="rounded bg-secondary px-1 py-0.5 text-foreground text-[11px]">imported-from-{connectorId}</code>.
              Add more tags or set a contact source below.
            </span>
          </div>

          {/* Raw payload viewer */}
          {samplePayloadField && samplePayloadField.sampleValues?.[0] && (
            <div className="rounded-xl border border-border overflow-hidden">
              <button type="button" onClick={() => setShowRawPayload((p) => !p)}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-xs font-semibold text-muted-foreground hover:bg-muted/50 transition-colors">
                <Code className="h-3.5 w-3.5" />
                View raw sample contact from source
                {showRawPayload ? <ChevronUp className="ml-auto h-3.5 w-3.5" /> : <ChevronDown className="ml-auto h-3.5 w-3.5" />}
              </button>
              {showRawPayload && (
                <pre className="max-h-[480px] overflow-auto p-4 text-[11px] leading-relaxed font-mono"
                  style={{ background: "#09090b", color: "#a1a1aa" }}>
                  {samplePayloadField.sampleValues[0]}
                </pre>
              )}
            </div>
          )}

          {/* Mapping table */}
          <div className="space-y-2">
            <div className="grid grid-cols-[1fr,auto,1fr,5rem] items-center gap-3 px-3 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
              <span>Source Field</span>
              <span />
              <span>GHL Field</span>
              <span className="text-right">Status</span>
            </div>

            <div className="space-y-1.5">
              {mappableFields.map((field) => {
                const mapping = mappings.find((m) => m.sourceField === field.key);
                return (
                  <div key={field.key}
                    className="grid grid-cols-[1fr,auto,1fr,5rem] items-center gap-3 rounded-xl border border-border p-3 transition-all hover:shadow-sm">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{field.label}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] text-muted-foreground font-mono">{field.type}</span>
                        {field.sampleValues?.[0] && (
                          <span className="truncate text-[10px] text-muted-foreground/60">
                            e.g. {field.sampleValues[0]}
                          </span>
                        )}
                      </div>
                    </div>

                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0" />

                    {/* Fixed dark-mode select */}
                    <select
                      className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 transition-all cursor-pointer [&_option]:bg-background [&_option]:text-foreground"
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
                        <span className="inline-flex items-center rounded-lg border border-border px-2 py-0.5 text-[10px] font-bold text-foreground">
                          + custom
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

          {/* Extra settings: tags and source */}
          <div className="rounded-xl border border-border p-5 space-y-5">
            <p className="text-sm font-semibold text-foreground">Additional Settings</p>

            {/* Custom tags */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Extra Tags (added to every contact)</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. imported, Q1-2026"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                  className="flex-1"
                />
                <Button variant="outline" size="sm" onClick={addTag} disabled={!tagInput.trim()}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
              {extraTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {extraTags.map((tag) => (
                    <span key={tag} className="inline-flex items-center gap-1 rounded-lg border border-border bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
                      <Tag className="h-3 w-3 text-muted-foreground" />
                      {tag}
                      <button onClick={() => setExtraTags((p) => p.filter((t) => t !== tag))} className="text-muted-foreground hover:text-foreground ml-0.5">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">
                <code className="rounded bg-secondary px-1 py-0.5 text-[10px]">imported-from-{connectorId}</code> is always added automatically.
              </p>
            </div>

            {/* Contact source */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Contact Source (GHL source field)</Label>
              <Input
                placeholder="e.g. Podium Import"
                value={contactSource}
                onChange={(e) => setContactSource(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                Sets the &quot;Source&quot; field on each contact in GHL. Helps track where leads came from.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-border pt-5">
            <p className="text-sm text-muted-foreground">
              {mappings.length} of {mappableFields.length} fields will be imported
            </p>
            <Button onClick={() => onConfirm(fields, mappings, extraTags, contactSource)} className="gap-2">
              Confirm Mapping
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
