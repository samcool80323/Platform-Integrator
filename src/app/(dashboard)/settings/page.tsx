"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CheckCircle2,
  AlertCircle,
  Trash2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
  Link2,
  Copy,
  ShieldCheck,
  Check,
} from "lucide-react";

interface GhlStatus { connected: boolean; companyName?: string; tokenExpiresAt?: string; }
interface OAuthAppStatus { configured: boolean; clientIdPreview?: string; redirectUri?: string; updatedAt?: string; }

const OAUTH2_CONNECTORS = [
  {
    id: "podium",
    name: "Podium",
    logo: "/logos/podium.svg",
    devPortalUrl: "https://app.podium.com",
    devPortalLabel: "Podium Developer Settings",
    helpSteps: [
      "Log in to Podium \u2192 Settings \u2192 Integrations \u2192 API",
      'Click "Create New Application" to register an OAuth app',
      "Set the Redirect URI to the value shown below (copy it exactly)",
      "Copy Client ID and Client Secret and paste them here",
    ],
  },
];

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const [ghlClientId, setGhlClientId] = useState("");
  const [ghlClientSecret, setGhlClientSecret] = useState("");
  const [ghlSaving, setGhlSaving] = useState(false);
  const [ghlStatus, setGhlStatus] = useState<GhlStatus | null>(null);
  const [ghlMessage, setGhlMessage] = useState("");
  const [oauthAppStatuses, setOauthAppStatuses] = useState<Record<string, OAuthAppStatus>>({});
  const [expandedConnector, setExpandedConnector] = useState<string | null>(null);
  const [connectorForms, setConnectorForms] = useState<Record<string, { clientId: string; clientSecret: string }>>({});
  const [connectorSaving, setConnectorSaving] = useState<Record<string, boolean>>({});
  const [connectorMessages, setConnectorMessages] = useState<Record<string, { type: "success" | "error"; text: string }>>({});
  const [copiedUri, setCopiedUri] = useState<string | null>(null);

  useEffect(() => { fetch("/api/ghl/status").then((r) => r.json()).then(setGhlStatus).catch(() => {}); }, []);

  const loadOAuthStatuses = useCallback(async () => {
    const results: Record<string, OAuthAppStatus> = {};
    await Promise.all(OAUTH2_CONNECTORS.map(async (c) => {
      try { const res = await fetch(`/api/connectors/${c.id}/oauth-app`); results[c.id] = await res.json(); }
      catch { results[c.id] = { configured: false }; }
    }));
    setOauthAppStatuses(results);
  }, []);

  useEffect(() => { loadOAuthStatuses(); }, [loadOAuthStatuses]);

  useEffect(() => {
    const needed = searchParams.get("oauth_setup_needed");
    if (needed) { setExpandedConnector(needed); setTimeout(() => { document.getElementById(`connector-${needed}`)?.scrollIntoView({ behavior: "smooth" }); }, 300); }
  }, [searchParams]);

  async function handleGhlSave(e: React.FormEvent) {
    e.preventDefault();
    setGhlSaving(true); setGhlMessage("");
    try {
      const res = await fetch("/api/ghl/credentials", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId: ghlClientId, clientSecret: ghlClientSecret }) });
      if (res.ok) { setGhlMessage("Saved! Redirecting to GHL..."); const data = await res.json(); if (data.authUrl) window.location.href = data.authUrl; }
      else { const data = await res.json(); setGhlMessage(data.error || "Failed to save"); }
    } catch { setGhlMessage("Something went wrong"); }
    setGhlSaving(false);
  }

  async function handleConnectorSave(connectorId: string) {
    const form = connectorForms[connectorId];
    if (!form?.clientId || !form?.clientSecret) { setConnectorMessages((p) => ({ ...p, [connectorId]: { type: "error", text: "Both fields required" } })); return; }
    setConnectorSaving((p) => ({ ...p, [connectorId]: true }));
    setConnectorMessages((p) => ({ ...p, [connectorId]: { type: "success", text: "" } }));
    try {
      const res = await fetch(`/api/connectors/${connectorId}/oauth-app`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId: form.clientId, clientSecret: form.clientSecret }) });
      const data = await res.json();
      if (res.ok) { setConnectorMessages((p) => ({ ...p, [connectorId]: { type: "success", text: "Saved!" } })); await loadOAuthStatuses(); setConnectorForms((p) => ({ ...p, [connectorId]: { clientId: "", clientSecret: "" } })); }
      else { setConnectorMessages((p) => ({ ...p, [connectorId]: { type: "error", text: data.error || "Failed" } })); }
    } catch { setConnectorMessages((p) => ({ ...p, [connectorId]: { type: "error", text: "Something went wrong" } })); }
    setConnectorSaving((p) => ({ ...p, [connectorId]: false }));
  }

  async function handleConnectorDelete(connectorId: string) {
    await fetch(`/api/connectors/${connectorId}/oauth-app`, { method: "DELETE" });
    await loadOAuthStatuses();
    setConnectorMessages((p) => ({ ...p, [connectorId]: { type: "success", text: "Removed" } }));
  }

  function copyUri(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopiedUri(key);
    setTimeout(() => setCopiedUri(null), 2000);
  }

  const baseUrl = typeof window !== "undefined" ? window.location.origin : process.env.NEXTAUTH_URL || "";

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-[22px] text-foreground">Settings</h1>
        <p className="mt-1 text-[14px] text-muted-foreground">
          Connect GoHighLevel first, then set up any OAuth platforms you need.
        </p>
      </div>

      {/* GHL Connection */}
      <section className="rounded-lg border border-border bg-card shadow-xs">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
          <div className="flex h-8 w-8 items-center justify-center rounded-md gradient-primary">
            <ShieldCheck className="h-4 w-4 text-white" />
          </div>
          <div>
            <h2 className="text-[15px] font-semibold text-foreground">GoHighLevel</h2>
            <p className="text-[13px] text-muted-foreground">Connect your GHL Marketplace App for sub-account access.</p>
          </div>
        </div>
        <div className="p-5">
          {ghlStatus?.connected ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-lg border border-success/20 bg-success/8 p-3.5">
                <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                <div className="text-[13px]">
                  <span className="font-medium text-success">Connected</span>
                  <span className="text-muted-foreground ml-2">
                    Agency: <strong className="text-foreground">{ghlStatus.companyName}</strong>
                    {ghlStatus.tokenExpiresAt && <> &middot; Expires {new Date(ghlStatus.tokenExpiresAt).toLocaleDateString()}</>}
                  </span>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setGhlStatus({ connected: false })}>
                Reconnect
              </Button>
            </div>
          ) : (
            <form onSubmit={handleGhlSave} className="space-y-5">
              <div className="rounded-lg border border-border bg-secondary/50 p-4 space-y-3">
                <p className="text-[13px] font-semibold text-foreground">Setup instructions</p>
                <ol className="space-y-2">
                  {[
                    <>Go to <a href="https://marketplace.gohighlevel.com" target="_blank" rel="noopener noreferrer" className="font-medium text-accent-foreground hover:underline">marketplace.gohighlevel.com</a> and sign in</>,
                    <>Open <strong>&quot;My Apps&quot;</strong> &rarr; create or select an app</>,
                    <>Go to <strong>&quot;Auth&quot;</strong> tab &rarr; copy <strong>Client ID</strong> and <strong>Client Secret</strong></>,
                    <>Set the redirect URI in GHL to the value below:</>,
                  ].map((content, i) => (
                    <li key={i} className="flex gap-2.5 text-[13px]">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[11px] font-bold bg-primary text-primary-foreground">{i + 1}</span>
                      <span className="text-muted-foreground">{content}</span>
                    </li>
                  ))}
                </ol>
                <CopyableUri value={`${baseUrl}/api/oauth/callback`} copied={copiedUri === "ghl"} onCopy={() => copyUri(`${baseUrl}/api/oauth/callback`, "ghl")} />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-[12px] font-medium text-muted-foreground">Client ID</Label>
                  <Input value={ghlClientId} onChange={(e) => setGhlClientId(e.target.value)} placeholder="e.g. 69ba5c34xxxx..." required />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[12px] font-medium text-muted-foreground">Client Secret</Label>
                  <Input type="password" value={ghlClientSecret} onChange={(e) => setGhlClientSecret(e.target.value)} placeholder="Your app secret" required />
                </div>
              </div>

              {ghlMessage && (
                <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary p-3 text-[13px] text-muted-foreground">
                  <AlertCircle className="h-4 w-4 shrink-0" /> {ghlMessage}
                </div>
              )}

              <Button type="submit" disabled={ghlSaving} className="gap-2">
                {ghlSaving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : <><ShieldCheck className="h-4 w-4" /> Save & Connect</>}
              </Button>
            </form>
          )}
        </div>
      </section>

      {/* OAuth Platforms */}
      <section className="space-y-3">
        <div>
          <h2 className="text-[15px] font-semibold text-foreground flex items-center gap-2">
            <Link2 className="h-4 w-4 text-accent-foreground" />
            OAuth Platforms
          </h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            For OAuth platforms (like Podium), register a developer app and enter credentials here.
            <strong> API-key platforms</strong> (Dentally, HubSpot, etc.) don&apos;t need setup here.
          </p>
        </div>

        {OAUTH2_CONNECTORS.map((connector) => {
          const status = oauthAppStatuses[connector.id];
          const form = connectorForms[connector.id] || { clientId: "", clientSecret: "" };
          const saving = connectorSaving[connector.id] || false;
          const message = connectorMessages[connector.id];
          const isExpanded = expandedConnector === connector.id;
          const redirectUri = `${baseUrl}/api/connectors/${connector.id}/oauth/callback`;

          return (
            <div key={connector.id} id={`connector-${connector.id}`}
              className={`rounded-lg border bg-card shadow-xs transition-colors duration-150 ${isExpanded ? "border-accent-foreground/20" : "border-border"}`}>
              <button
                className="flex w-full items-center justify-between px-5 py-3.5 text-left"
                onClick={() => setExpandedConnector(isExpanded ? null : connector.id)}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-secondary text-[13px] font-bold text-secondary-foreground">
                    {connector.name[0]}
                  </div>
                  <div>
                    <p className="text-[14px] font-medium text-foreground">{connector.name}</p>
                    <p className="text-[12px] text-muted-foreground">OAuth 2.0</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {status?.configured ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-success/10 px-2 py-0.5 text-[12px] font-medium text-success">
                      <CheckCircle2 className="h-3 w-3" /> Ready
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-md bg-warning/10 px-2 py-0.5 text-[12px] font-medium text-warning">
                      Setup needed
                    </span>
                  )}
                  {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </div>
              </button>

              {isExpanded && (
                <div className="space-y-4 border-t border-border px-5 py-4">
                  <div className="rounded-lg border border-border bg-secondary/50 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[13px] font-semibold text-foreground">Setup</p>
                      <a href={connector.devPortalUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[12px] font-medium text-accent-foreground hover:underline">
                        Open {connector.name} <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                    <ol className="space-y-2">
                      {connector.helpSteps.map((s, i) => (
                        <li key={i} className="flex gap-2.5 text-[13px]">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[11px] font-bold bg-primary text-primary-foreground">{i + 1}</span>
                          <span className="text-muted-foreground">{s}</span>
                        </li>
                      ))}
                    </ol>
                    <CopyableUri
                      value={redirectUri}
                      label={`Redirect URI for ${connector.name}:`}
                      copied={copiedUri === connector.id}
                      onCopy={() => copyUri(redirectUri, connector.id)}
                    />
                  </div>

                  {status?.configured && (
                    <div className="flex items-center justify-between rounded-lg border border-success/20 bg-success/8 p-3.5">
                      <div className="text-[13px]">
                        <span className="font-medium text-success">Credentials saved</span>
                        <span className="text-muted-foreground ml-2">
                          Client ID: {status.clientIdPreview}
                          {status.updatedAt && ` \u00b7 ${new Date(status.updatedAt).toLocaleDateString()}`}
                        </span>
                      </div>
                      <Button variant="ghost" size="icon-xs" className="text-destructive hover:text-destructive hover:bg-destructive/8"
                        onClick={() => handleConnectorDelete(connector.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}

                  <div className="space-y-3">
                    <p className="text-[13px] font-medium text-foreground">
                      {status?.configured ? "Update credentials" : "Enter credentials"}
                    </p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="text-[12px] font-medium text-muted-foreground">Client ID</Label>
                        <Input placeholder={`${connector.name} Client ID`} value={form.clientId}
                          onChange={(e) => setConnectorForms((p) => ({ ...p, [connector.id]: { ...form, clientId: e.target.value } }))} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[12px] font-medium text-muted-foreground">Client Secret</Label>
                        <Input type="password" placeholder={`${connector.name} Client Secret`} value={form.clientSecret}
                          onChange={(e) => setConnectorForms((p) => ({ ...p, [connector.id]: { ...form, clientSecret: e.target.value } }))} />
                      </div>
                    </div>

                    {message && message.text && (
                      <div className={`flex items-start gap-2 rounded-lg border p-3 text-[13px] font-medium ${
                        message.type === "success" ? "border-success/20 bg-success/8 text-success"
                          : "border-destructive/15 bg-destructive/8 text-destructive"
                      }`}>
                        {message.type === "success" ? <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" /> : <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />}
                        {message.text}
                      </div>
                    )}

                    <Button onClick={() => handleConnectorSave(connector.id)} disabled={saving || !form.clientId || !form.clientSecret} size="sm" className="gap-2">
                      {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : status?.configured ? "Update" : "Save"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}

function CopyableUri({ value, label, copied, onCopy }: { value: string; label?: string; copied: boolean; onCopy: () => void }) {
  return (
    <div className="rounded-md bg-muted p-2.5 space-y-1">
      {label && <p className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wide">{label}</p>}
      <div className="flex items-center gap-2">
        <code className="flex-1 text-[12px] text-foreground break-all font-mono">{value}</code>
        <button onClick={onCopy}
          className="shrink-0 flex h-6 w-6 items-center justify-center rounded-md bg-background border border-border text-muted-foreground hover:text-foreground transition-colors">
          {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
        </button>
      </div>
    </div>
  );
}
