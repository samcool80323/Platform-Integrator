"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  ChevronLeft, ArrowRight, CheckCircle2, Loader2, AlertCircle,
  Info, Code, ChevronDown, ChevronUp, Plus, Tag, X, Settings2, Search
} from "lucide-react";
import type { FieldSchema, FieldMapping } from "@/lib/universal-model/types";

const GHL_STANDARD_FIELDS = [
  { key: "name", label: "Full Name" },
  { key: "firstName", label: "First Name" },
  { key: "lastName", label: "Last Name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "address1", label: "Address Line 1" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "postalCode", label: "Postal / Zip Code" },
  { key: "country", label: "Country" },
  { key: "companyName", label: "Company Name" },
  { key: "website", label: "Website" },
  { key: "dateOfBirth", label: "Date of Birth" },
  { key: "gender", label: "Gender" },
  { key: "timezone", label: "Timezone" },
  { key: "source", label: "Source" },
  { key: "tags", label: "Tags" },
  { key: "dnd", label: "Do Not Disturb" },
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
  const [showSettings, setShowSettings] = useState(false);
  const [showSkipped, setShowSkipped] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");
  const [addFieldName, setAddFieldName] = useState("");

  useEffect(() => {
    fetch(`/api/connectors/${connectorId}/discover`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(credentialId ? { credentialId } : { credentials }),
    })
      .then(async (r) => {
        if (!r.ok) {
          const data = await r.json().catch(() => ({}));
          throw new Error(data.error || `Discovery failed (${r.status})`);
        }
        return r.json();
      })
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

  function addCustomField() {
    const name = addFieldName.trim();
    if (!name) return;
    // Don't add duplicates
    if (fields.some((f) => f.key === name)) {
      setAddFieldName("");
      return;
    }
    const newField: FieldSchema = {
      key: name,
      label: name.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      type: "text",
      isStandard: false,
    };
    setFields((prev) => [...prev, newField]);
    // Auto-map as custom
    setMappings((prev) => [...prev, {
      sourceField: name,
      targetField: `custom:${name}`,
      targetType: "custom" as const,
    }]);
    setAddFieldName("");
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

  // Split into mapped and skipped
  const mappedFields = mappableFields.filter((f) => mappings.some((m) => m.sourceField === f.key));
  const skippedFields = mappableFields.filter((f) => !mappings.some((m) => m.sourceField === f.key));

  const standardMapped = mappings.filter((m) => m.targetType === "standard").length;
  const customMappings = mappings.filter((m) => m.targetType === "custom");

  // Filter by search
  const filterField = (f: FieldSchema) => {
    if (!searchFilter) return true;
    const q = searchFilter.toLowerCase();
    return f.label.toLowerCase().includes(q) || f.key.toLowerCase().includes(q);
  };

  const filteredMapped = mappedFields.filter(filterField);
  const filteredSkipped = skippedFields.filter(filterField);

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
        <ChevronLeft className="h-4 w-4" /> Back
      </Button>

      {/* Header + summary */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-bold text-foreground">Field Mapping</h3>
          <p className="text-sm text-muted-foreground">Match source fields to GHL. Auto-matched where possible.</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="secondary" className="gap-1 text-[11px] px-2.5 py-0.5 rounded-md">
            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
            {standardMapped} standard
          </Badge>
          {customMappings.length > 0 && (
            <Badge variant="outline" className="gap-1 text-[11px] px-2.5 py-0.5 rounded-md">
              <Plus className="h-3 w-3" />
              {customMappings.length} custom
            </Badge>
          )}
          <Badge variant="secondary" className="gap-1 text-[11px] px-2.5 py-0.5 rounded-md">
            {skippedFields.length} skipped
          </Badge>
        </div>
      </div>

      {/* Search + add field */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Filter fields..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <div className="flex gap-1.5">
          <Input
            placeholder="Add custom field..."
            value={addFieldName}
            onChange={(e) => setAddFieldName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomField(); } }}
            className="w-44 h-9 text-sm"
          />
          <Button variant="outline" size="sm" onClick={addCustomField} disabled={!addFieldName.trim()} className="h-9 px-3">
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Mapped fields */}
      <Card>
        <CardHeader className="pb-3 pt-4 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">
              Mapped Fields ({mappedFields.length})
            </CardTitle>
            <span className="text-[11px] text-muted-foreground">
              {standardMapped} standard, {customMappings.length} custom
            </span>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-0">
          {filteredMapped.length === 0 ? (
            <p className="text-sm text-muted-foreground py-3">No mapped fields{searchFilter ? " matching filter" : ""}.</p>
          ) : (
            <div className="space-y-1">
              {/* Column header */}
              <div className="grid grid-cols-[1fr,1.2fr,auto] items-center gap-2 px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <span>Source</span>
                <span>GHL Target</span>
                <span className="w-14 text-center">Status</span>
              </div>
              {filteredMapped.map((field) => {
                const mapping = mappings.find((m) => m.sourceField === field.key)!;
                return (
                  <MappingRow
                    key={field.key}
                    field={field}
                    mapping={mapping}
                    connectorId={connectorId}
                    onUpdate={updateMapping}
                    onRemove={removeMapping}
                  />
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Skipped fields (collapsible) */}
      {skippedFields.length > 0 && (
        <div className="rounded-xl border border-border overflow-hidden">
          <button
            type="button"
            onClick={() => setShowSkipped((p) => !p)}
            className="flex w-full items-center gap-2 px-4 py-3 text-sm font-semibold text-muted-foreground hover:bg-muted/50 transition-colors"
          >
            Skipped Fields ({skippedFields.length})
            {showSkipped ? <ChevronUp className="ml-auto h-3.5 w-3.5" /> : <ChevronDown className="ml-auto h-3.5 w-3.5" />}
          </button>
          {showSkipped && (
            <div className="px-4 pb-4 space-y-1">
              <p className="text-[11px] text-muted-foreground pb-2">
                These fields won&apos;t be imported. Change the dropdown to map them.
              </p>
              {/* Column header */}
              <div className="grid grid-cols-[1fr,1.2fr,auto] items-center gap-2 px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <span>Source</span>
                <span>GHL Target</span>
                <span className="w-14 text-center">Status</span>
              </div>
              {filteredSkipped.map((field) => (
                <MappingRow
                  key={field.key}
                  field={field}
                  mapping={undefined}
                  connectorId={connectorId}
                  onUpdate={updateMapping}
                  onRemove={removeMapping}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Raw payload viewer */}
      {samplePayloadField && samplePayloadField.sampleValues?.[0] && (
        <div className="rounded-xl border border-border overflow-hidden">
          <button type="button" onClick={() => setShowRawPayload((p) => !p)}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-xs font-semibold text-muted-foreground hover:bg-muted/50 transition-colors">
            <Code className="h-3.5 w-3.5" />
            Raw sample contact
            {showRawPayload ? <ChevronUp className="ml-auto h-3.5 w-3.5" /> : <ChevronDown className="ml-auto h-3.5 w-3.5" />}
          </button>
          {showRawPayload && (
            <pre className="max-h-[360px] overflow-auto p-4 text-[11px] leading-relaxed font-mono"
              style={{ background: "#09090b", color: "#a1a1aa" }}>
              {samplePayloadField.sampleValues[0]}
            </pre>
          )}
        </div>
      )}

      {/* Additional Settings (collapsible) */}
      <div className="rounded-xl border border-border overflow-hidden">
        <button
          type="button"
          onClick={() => setShowSettings((p) => !p)}
          className="flex w-full items-center gap-2 px-4 py-3 text-sm font-semibold text-foreground hover:bg-muted/50 transition-colors"
        >
          <Settings2 className="h-4 w-4 text-muted-foreground" />
          Tags & Source
          {extraTags.length > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 rounded-md ml-1">
              {extraTags.length} tag{extraTags.length !== 1 ? "s" : ""}
            </Badge>
          )}
          {showSettings ? <ChevronUp className="ml-auto h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="ml-auto h-3.5 w-3.5 text-muted-foreground" />}
        </button>
        {showSettings && (
          <div className="px-4 pb-4 space-y-4 border-t border-border pt-4">
            <div className="flex items-start gap-2 rounded-lg bg-muted/50 border border-border p-2.5 text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-foreground" />
              <span>
                Contacts are auto-tagged <code className="rounded bg-secondary px-1 py-0.5 text-foreground text-[11px]">{connectorId}</code>.
                Add more tags or set a custom source below.
              </span>
            </div>

            {/* Custom tags */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Extra Tags</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. imported, Q1-2026"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                  className="flex-1 h-9 text-sm"
                />
                <Button variant="outline" size="sm" onClick={addTag} disabled={!tagInput.trim()} className="h-9">
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
              {extraTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {extraTags.map((tag) => (
                    <span key={tag} className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                      <Tag className="h-2.5 w-2.5 text-muted-foreground" />
                      {tag}
                      <button onClick={() => setExtraTags((p) => p.filter((t) => t !== tag))} className="text-muted-foreground hover:text-foreground ml-0.5">
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Contact source */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Contact Source</Label>
              <Input
                placeholder="e.g. Podium Import"
                value={contactSource}
                onChange={(e) => setContactSource(e.target.value)}
                className="h-9 text-sm"
              />
              <p className="text-[11px] text-muted-foreground">
                Sets the &quot;Source&quot; field on each contact in GHL.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2">
        <p className="text-sm text-muted-foreground">
          {mappings.length} of {mappableFields.length} fields will be imported
        </p>
        <Button onClick={() => onConfirm(fields, mappings, extraTags, contactSource)} className="gap-2">
          Confirm Mapping
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/* ── Compact mapping row ── */

function MappingRow({
  field,
  mapping,
  connectorId,
  onUpdate,
  onRemove,
}: {
  field: FieldSchema;
  mapping: FieldMapping | undefined;
  connectorId: string;
  onUpdate: (sourceField: string, targetField: string) => void;
  onRemove: (sourceField: string) => void;
}) {
  return (
    <div className="grid grid-cols-[1fr,1.2fr,auto] items-center gap-2 rounded-lg border border-border/60 px-2 py-2 transition-all hover:border-border">
      {/* Source */}
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{field.label}</p>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground font-mono">{field.type}</span>
          {field.sampleValues?.[0] && (
            <span className="truncate text-[10px] text-muted-foreground/60">
              e.g. {field.sampleValues[0]}
            </span>
          )}
        </div>
      </div>

      {/* Target select */}
      <select
        className="w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 transition-all cursor-pointer [&_option]:bg-background [&_option]:text-foreground"
        value={mapping?.targetField || "skip"}
        onChange={(e) => {
          const val = e.target.value;
          if (val === "skip") onRemove(field.key);
          else onUpdate(field.key, val);
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

      {/* Status badge */}
      <div className="w-14 text-center">
        {mapping?.targetType === "standard" && (
          <span className="inline-flex items-center rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
            mapped
          </span>
        )}
        {mapping?.targetType === "custom" && (
          <span className="inline-flex items-center rounded-md border border-border px-1.5 py-0.5 text-[10px] font-bold text-foreground">
            custom
          </span>
        )}
        {!mapping && (
          <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
            skip
          </span>
        )}
      </div>
    </div>
  );
}
