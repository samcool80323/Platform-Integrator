"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  AlertCircle,
  Trash2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
  Settings2,
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
      "Log in to Podium → Settings → Integrations → API",
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
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Settings</h1>
        <p className="mt-1 text-muted-foreground">
          Connect GoHighLevel first, then set up any OAuth platforms you need.
        </p>
      </div>

      {/* GHL Connection */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl gradient-primary shadow-md shadow-sm">
              <Settings2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg">GoHighLevel</CardTitle>
              <CardDescription>Connect your GHL Marketplace App for sub-account access.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {ghlStatus?.connected ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                <div>
                  <p className="font-semibold text-emerald-600 dark:text-emerald-400">Connected</p>
                  <p className="text-sm text-muted-foreground">
                    Agency: <strong>{ghlStatus.companyName}</strong>
                    {ghlStatus.tokenExpiresAt && <> · Expires {new Date(ghlStatus.tokenExpiresAt).toLocaleDateString()}</>}
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setGhlStatus({ connected: false })}>
                Reconnect
              </Button>
            </div>
          ) : (
            <form onSubmit={handleGhlSave} className="space-y-5">
              <div className="rounded-xl border border-border bg-secondary/50 p-5 space-y-4">
                <p className="text-sm font-bold text-foreground">How to get your credentials:</p>
                <ol className="space-y-3 text-sm">
                  {[
                    <>Go to <a href="https://marketplace.gohighlevel.com" target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">marketplace.gohighlevel.com</a> and sign in</>,
                    <>Open <strong>&quot;My Apps&quot;</strong> → create or select an app</>,
                    <>Go to <strong>&quot;Auth&quot;</strong> tab → copy <strong>Client ID</strong> and <strong>Client Secret</strong></>,
                    <>Set the redirect URI in GHL to the value below:</>,
                  ].map((content, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg gradient-primary text-[11px] font-bold text-white">{i + 1}</span>
                      <span className="text-muted-foreground">{content}</span>
                    </li>
                  ))}
                </ol>
                <CopyableUri value={`${baseUrl}/api/oauth/callback`} copied={copiedUri === "ghl"} onCopy={() => copyUri(`${baseUrl}/api/oauth/callback`, "ghl")} />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Client ID</Label>
                  <Input value={ghlClientId} onChange={(e) => setGhlClientId(e.target.value)} placeholder="e.g. 69ba5c34xxxx..." required />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Client Secret</Label>
                  <Input type="password" value={ghlClientSecret} onChange={(e) => setGhlClientSecret(e.target.value)} placeholder="Your app secret" required />
                </div>
              </div>

              {ghlMessage && (
                <div className="flex items-center gap-2 rounded-xl border border-border bg-secondary/50 p-3 text-sm text-muted-foreground">
                  <AlertCircle className="h-4 w-4 shrink-0" /> {ghlMessage}
                </div>
              )}

              <Button type="submit" disabled={ghlSaving} className="gap-2">
                {ghlSaving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : <><ShieldCheck className="h-4 w-4" /> Save & Connect</>}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {/* OAuth Platforms */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-foreground tracking-tight flex items-center gap-2">
            <Link2 className="h-5 w-5 text-zinc-600" />
            OAuth Platforms
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
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
            <Card key={connector.id} id={`connector-${connector.id}`}
              className={`transition-all ${isExpanded ? "shadow-glow border-primary/20" : ""}`}>
              <CardHeader className="cursor-pointer select-none"
                onClick={() => setExpandedConnector(isExpanded ? null : connector.id)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-500/10 text-sm font-bold text-zinc-600">
                      {connector.name[0]}
                    </div>
                    <div>
                      <CardTitle className="text-base">{connector.name}</CardTitle>
                      <CardDescription className="text-xs mt-0.5">OAuth 2.0</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {status?.configured ? (
                      <Badge variant="secondary" className="text-xs text-emerald-600 dark:text-emerald-400 gap-1 rounded-lg">
                        <CheckCircle2 className="h-3 w-3" /> Ready
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs text-amber-600 dark:text-amber-400 rounded-lg">
                        Setup needed
                      </Badge>
                    )}
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </div>
              </CardHeader>

              {isExpanded && (
                <CardContent className="space-y-5 border-t pt-5">
                  <div className="rounded-xl border border-border bg-secondary/50 p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-foreground">Setup:</p>
                      <a href={connector.devPortalUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                        Open {connector.name} <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                    <ol className="space-y-2.5">
                      {connector.helpSteps.map((s, i) => (
                        <li key={i} className="flex gap-3 text-sm">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md gradient-primary text-[10px] font-bold text-white">{i + 1}</span>
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
                    <div className="flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                      <div>
                        <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Credentials saved</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Client ID: {status.clientIdPreview}
                          {status.updatedAt && ` · ${new Date(status.updatedAt).toLocaleDateString()}`}
                        </p>
                      </div>
                      <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-500 hover:bg-red-500/10"
                        onClick={() => handleConnectorDelete(connector.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}

                  <div className="space-y-4">
                    <p className="text-sm font-semibold text-foreground">
                      {status?.configured ? "Update:" : "Enter credentials:"}
                    </p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Client ID</Label>
                        <Input placeholder={`${connector.name} Client ID`} value={form.clientId}
                          onChange={(e) => setConnectorForms((p) => ({ ...p, [connector.id]: { ...form, clientId: e.target.value } }))} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Client Secret</Label>
                        <Input type="password" placeholder={`${connector.name} Client Secret`} value={form.clientSecret}
                          onChange={(e) => setConnectorForms((p) => ({ ...p, [connector.id]: { ...form, clientSecret: e.target.value } }))} />
                      </div>
                    </div>

                    {message && message.text && (
                      <div className={`flex items-start gap-2 rounded-xl border p-3 text-sm font-medium ${
                        message.type === "success" ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "border-red-500/20 bg-red-500/10 text-red-500"
                      }`}>
                        {message.type === "success" ? <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" /> : <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />}
                        {message.text}
                      </div>
                    )}

                    <Button onClick={() => handleConnectorSave(connector.id)} disabled={saving || !form.clientId || !form.clientSecret} size="sm" className="gap-2">
                      {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : status?.configured ? "Update" : "Save"}
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function CopyableUri({ value, label, copied, onCopy }: { value: string; label?: string; copied: boolean; onCopy: () => void }) {
  return (
    <div className="rounded-xl bg-muted p-3 space-y-1">
      {label && <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/60">{label}</p>}
      <div className="flex items-center gap-2">
        <code className="flex-1 text-xs text-primary break-all font-mono">{value}</code>
        <button onClick={onCopy}
          className="shrink-0 flex h-7 w-7 items-center justify-center rounded-lg bg-background border border-border text-muted-foreground hover:text-foreground transition-colors">
          {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
        </button>
      </div>
    </div>
  );
}
