"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ChevronLeft, ArrowRight, CheckCircle2, Loader2, AlertCircle,
  Info, Code, ChevronDown, ChevronUp, Plus, Tag, X, Settings2, Search,
  FolderOpen, Pencil,
} from "lucide-react";
import type { FieldSchema, FieldMapping } from "@/lib/universal-model/types";

/** Strip prefixes like "attr:", "Attr:", "custom:" and clean into a readable name */
function cleanDisplayName(raw: string): string {
  return raw
    .replace(/^attr:/i, "")
    .replace(/^custom:/i, "")
    .replace(/^_+/, "")
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

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

interface GHLFolder {
  id: string;
  name: string;
}

interface StepFieldMappingProps {
  connectorId: string;
  credentials: Record<string, string>;
  credentialId?: string;
  ghlLocationId?: string;
  onConfirm: (fields: FieldSchema[], mappings: FieldMapping[], extraTags?: string[], contactSource?: string, customFieldFolderId?: string) => void;
  onBack: () => void;
}

export function StepFieldMapping({ connectorId, credentials, credentialId, ghlLocationId, onConfirm, onBack }: StepFieldMappingProps) {
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

  // Custom field folder state
  const [folders, setFolders] = useState<GHLFolder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string>("");
  const [loadingFolders, setLoadingFolders] = useState(false);

  // Fetch available GHL custom field folders
  useEffect(() => {
    if (!ghlLocationId) return;
    setLoadingFolders(true);
    fetch(`/api/ghl/custom-field-folders?locationId=${ghlLocationId}`)
      .then((r) => r.json())
      .then((data) => { setFolders(data.folders || []); setLoadingFolders(false); })
      .catch(() => setLoadingFolders(false));
  }, [ghlLocationId]);

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
      .then((data) => {
        setFields(data.fields || []);
        // Auto-set customFieldName on custom mappings (cleaned, no "attr:")
        const enrichedMappings = (data.mappings || []).map((m: FieldMapping) => {
          if (m.targetType === "custom") {
            return { ...m, customFieldName: cleanDisplayName(m.customFieldName || m.sourceField) };
          }
          return m;
        });
        setMappings(enrichedMappings);
        setLoading(false);
      })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, [connectorId, credentials, credentialId]);

  function updateMapping(sourceField: string, targetField: string) {
    setMappings((prev) => {
      const existing = prev.find((m) => m.sourceField === sourceField);
      const isCustom = targetField.startsWith("custom:");
      const customFieldName = isCustom ? cleanDisplayName(sourceField) : undefined;
      if (existing) {
        return prev.map((m) =>
          m.sourceField === sourceField
            ? { ...m, targetField, targetType: isCustom ? ("custom" as const) : ("standard" as const), customFieldName }
            : m
        );
      }
      return [...prev, { sourceField, targetField, targetType: isCustom ? ("custom" as const) : ("standard" as const), customFieldName }];
    });
  }

  function updateCustomFieldName(sourceField: string, name: string) {
    setMappings((prev) =>
      prev.map((m) =>
        m.sourceField === sourceField ? { ...m, customFieldName: name } : m
      )
    );
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
    if (fields.some((f) => f.key === name)) {
      setAddFieldName("");
      return;
    }
    const cleanName = cleanDisplayName(name);
    const newField: FieldSchema = {
      key: name,
      label: cleanName,
      type: "text",
      isStandard: false,
    };
    setFields((prev) => [...prev, newField]);
    setMappings((prev) => [...prev, {
      sourceField: name,
      targetField: `custom:${name}`,
      targetType: "custom" as const,
      customFieldName: cleanName,
    }]);
    setAddFieldName("");
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-20 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin text-accent-foreground" />
        <div className="text-center">
          <p className="text-[14px] font-medium text-foreground">Discovering fields...</p>
          <p className="mt-0.5 text-[13px]">This may take a moment.</p>
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
        <div className="flex items-start gap-3 rounded-lg border border-destructive/15 bg-destructive/8 p-4">
          <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-[13px] font-medium text-destructive">Failed to discover fields</p>
            <p className="mt-1 text-[13px] text-muted-foreground">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const samplePayloadField = fields.find((f) => f.key === "_samplePayload");
  const mappableFields = fields.filter((f) => f.key !== "_samplePayload");

  const mappedFields = mappableFields.filter((f) => mappings.some((m) => m.sourceField === f.key));
  const skippedFields = mappableFields.filter((f) => !mappings.some((m) => m.sourceField === f.key));

  const standardMapped = mappings.filter((m) => m.targetType === "standard").length;
  const customMappingsList = mappings.filter((m) => m.targetType === "custom");

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

      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-[15px] font-semibold text-foreground">Field Mapping</h3>
          <p className="text-[13px] text-muted-foreground">Match source fields to GHL. Auto-matched where possible.</p>
        </div>
        <div className="flex flex-wrap gap-1">
          <span className="inline-flex items-center gap-1 rounded-md bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
            <CheckCircle2 className="h-3 w-3" />
            {standardMapped} standard
          </span>
          {customMappingsList.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              <Plus className="h-3 w-3" />
              {customMappingsList.length} custom
            </span>
          )}
          <span className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {skippedFields.length} skipped
          </span>
        </div>
      </div>

      {/* Custom field folder picker */}
      {customMappingsList.length > 0 && (
        <div className="rounded-lg border border-border bg-card shadow-xs p-4 space-y-2.5">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
            <Label className="text-[13px] font-medium text-foreground">Custom Field Folder</Label>
          </div>
          <p className="text-[12px] text-muted-foreground">
            Choose a GHL folder to put custom fields in. Create folders in GHL first if needed.
          </p>
          <select
            className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-[13px] text-foreground outline-none focus:border-ring focus:shadow-focus transition-all cursor-pointer"
            value={selectedFolderId}
            onChange={(e) => setSelectedFolderId(e.target.value)}
            disabled={loadingFolders}
          >
            <option value="">
              {loadingFolders ? "Loading folders..." : folders.length === 0 ? "No folders found — fields go to root" : "Auto-detect (Custom or connector name)"}
            </option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Search + add field */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
          <Input
            placeholder="Filter fields..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1.5">
          <Input
            placeholder="Add custom field..."
            value={addFieldName}
            onChange={(e) => setAddFieldName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomField(); } }}
            className="w-40"
          />
          <Button variant="outline" size="sm" onClick={addCustomField} disabled={!addFieldName.trim()} className="h-9 px-2.5">
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Mapped fields */}
      <div className="rounded-lg border border-border bg-card shadow-xs overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="text-[13px] font-medium text-foreground">
            Mapped Fields ({mappedFields.length})
          </span>
          <span className="text-[11px] text-muted-foreground">
            {standardMapped} standard, {customMappingsList.length} custom
          </span>
        </div>
        <div className="p-3">
          {filteredMapped.length === 0 ? (
            <p className="text-[13px] text-muted-foreground py-3 text-center">No mapped fields{searchFilter ? " matching filter" : ""}.</p>
          ) : (
            <div className="space-y-0.5">
              <div className="grid grid-cols-[1fr,1.2fr,auto] items-center gap-2 px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/60">
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
                    onUpdate={updateMapping}
                    onRemove={removeMapping}
                    onUpdateCustomName={updateCustomFieldName}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Skipped fields */}
      {skippedFields.length > 0 && (
        <div className="rounded-lg border border-border overflow-hidden">
          <button
            type="button"
            onClick={() => setShowSkipped((p) => !p)}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-[13px] font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
          >
            Skipped Fields ({skippedFields.length})
            {showSkipped ? <ChevronUp className="ml-auto h-3.5 w-3.5" /> : <ChevronDown className="ml-auto h-3.5 w-3.5" />}
          </button>
          {showSkipped && (
            <div className="px-3 pb-3 space-y-0.5">
              <p className="text-[11px] text-muted-foreground px-2 pb-2">
                These fields won&apos;t be imported. Change the dropdown to map them.
              </p>
              <div className="grid grid-cols-[1fr,1.2fr,auto] items-center gap-2 px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/60">
                <span>Source</span>
                <span>GHL Target</span>
                <span className="w-14 text-center">Status</span>
              </div>
              {filteredSkipped.map((field) => (
                <MappingRow
                  key={field.key}
                  field={field}
                  mapping={undefined}
                  onUpdate={updateMapping}
                  onRemove={removeMapping}
                  onUpdateCustomName={updateCustomFieldName}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Raw payload */}
      {samplePayloadField && samplePayloadField.sampleValues?.[0] && (
        <div className="rounded-lg border border-border overflow-hidden">
          <button type="button" onClick={() => setShowRawPayload((p) => !p)}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-[12px] font-medium text-muted-foreground hover:bg-muted/50 transition-colors">
            <Code className="h-3.5 w-3.5" />
            Raw sample contact
            {showRawPayload ? <ChevronUp className="ml-auto h-3.5 w-3.5" /> : <ChevronDown className="ml-auto h-3.5 w-3.5" />}
          </button>
          {showRawPayload && (
            <pre className="max-h-[360px] overflow-auto p-4 text-[11px] leading-relaxed font-mono bg-card border-t border-border text-muted-foreground">
              {samplePayloadField.sampleValues[0]}
            </pre>
          )}
        </div>
      )}

      {/* Tags & source settings */}
      <div className="rounded-lg border border-border overflow-hidden">
        <button
          type="button"
          onClick={() => setShowSettings((p) => !p)}
          className="flex w-full items-center gap-2 px-4 py-2.5 text-[13px] font-medium text-foreground hover:bg-muted/50 transition-colors"
        >
          <Settings2 className="h-4 w-4 text-muted-foreground" />
          Tags & Source
          {extraTags.length > 0 && (
            <span className="inline-flex items-center rounded px-1.5 py-px text-[10px] font-medium bg-secondary text-muted-foreground ml-1">
              {extraTags.length} tag{extraTags.length !== 1 ? "s" : ""}
            </span>
          )}
          {showSettings ? <ChevronUp className="ml-auto h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="ml-auto h-3.5 w-3.5 text-muted-foreground" />}
        </button>
        {showSettings && (
          <div className="px-4 pb-4 space-y-4 border-t border-border pt-4">
            <div className="flex items-start gap-2 rounded-md bg-secondary p-2.5 text-[12px] text-muted-foreground">
              <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-foreground" />
              <span>
                Contacts are auto-tagged <code className="rounded bg-muted px-1 py-0.5 text-foreground text-[11px]">{connectorId}</code>.
                Add more tags or set a custom source below.
              </span>
            </div>

            <div className="space-y-2">
              <Label className="text-[12px] font-medium text-muted-foreground">Extra Tags</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. imported, Q1-2026"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                  className="flex-1"
                />
                <Button variant="outline" size="sm" onClick={addTag} disabled={!tagInput.trim()} className="h-9">
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
              {extraTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {extraTags.map((tag) => (
                    <span key={tag} className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary px-2 py-0.5 text-[12px] font-medium text-foreground">
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

            <div className="space-y-2">
              <Label className="text-[12px] font-medium text-muted-foreground">Contact Source</Label>
              <Input
                placeholder="e.g. Podium Import"
                value={contactSource}
                onChange={(e) => setContactSource(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                Sets the &quot;Source&quot; field on each contact in GHL.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-1">
        <p className="text-[13px] text-muted-foreground">
          {mappings.length} of {mappableFields.length} fields will be imported
        </p>
        <Button onClick={() => onConfirm(fields, mappings, extraTags, contactSource, selectedFolderId || undefined)} className="gap-2">
          Confirm Mapping
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/* ── Mapping row with editable custom field name ── */

function MappingRow({
  field,
  mapping,
  onUpdate,
  onRemove,
  onUpdateCustomName,
}: {
  field: FieldSchema;
  mapping: FieldMapping | undefined;
  onUpdate: (sourceField: string, targetField: string) => void;
  onRemove: (sourceField: string) => void;
  onUpdateCustomName: (sourceField: string, name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const displayLabel = cleanDisplayName(field.label);

  return (
    <div className="rounded-md px-2 py-1.5 transition-colors hover:bg-muted/30">
      <div className="grid grid-cols-[1fr,1.2fr,auto] items-center gap-2">
        {/* Source */}
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-foreground truncate">{displayLabel}</p>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground font-mono">{field.type}</span>
            {field.sampleValues?.[0] && (
              <span className="truncate text-[10px] text-muted-foreground/50">
                e.g. {field.sampleValues[0]}
              </span>
            )}
          </div>
        </div>

        {/* Target */}
        <select
          className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-[13px] text-foreground outline-none focus:border-ring focus:shadow-focus transition-all cursor-pointer"
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

        {/* Status */}
        <div className="w-14 text-center">
          {mapping?.targetType === "standard" && (
            <span className="inline-flex items-center rounded px-1.5 py-px text-[10px] font-semibold bg-success/10 text-success">
              mapped
            </span>
          )}
          {mapping?.targetType === "custom" && (
            <span className="inline-flex items-center rounded px-1.5 py-px text-[10px] font-semibold bg-accent text-accent-foreground">
              custom
            </span>
          )}
          {!mapping && (
            <span className="inline-flex items-center rounded px-1.5 py-px text-[10px] font-semibold bg-secondary text-muted-foreground">
              skip
            </span>
          )}
        </div>
      </div>

      {/* Editable custom field name — shown for custom mappings */}
      {mapping?.targetType === "custom" && (
        <div className="mt-1.5 ml-0.5 flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground shrink-0">GHL name:</span>
          {editing ? (
            <input
              autoFocus
              className="flex-1 rounded border border-input bg-background px-1.5 py-0.5 text-[12px] text-foreground outline-none focus:border-ring"
              value={mapping.customFieldName || ""}
              onChange={(e) => onUpdateCustomName(field.key, e.target.value)}
              onBlur={() => setEditing(false)}
              onKeyDown={(e) => { if (e.key === "Enter") setEditing(false); }}
            />
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1 text-[12px] font-medium text-foreground hover:text-accent-foreground transition-colors"
            >
              {mapping.customFieldName || cleanDisplayName(field.key)}
              <Pencil className="h-2.5 w-2.5 text-muted-foreground" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
