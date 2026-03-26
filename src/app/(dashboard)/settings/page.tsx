"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
} from "lucide-react";

interface GhlStatus {
  connected: boolean;
  companyName?: string;
  tokenExpiresAt?: string;
}

interface OAuthAppStatus {
  configured: boolean;
  clientIdPreview?: string;
  redirectUri?: string;
  updatedAt?: string;
}

const OAUTH2_CONNECTORS = [
  {
    id: "podium",
    name: "Podium",
    logo: "/logos/podium.svg",
    devPortalUrl: "https://app.podium.com",
    devPortalLabel: "Podium Developer Settings",
    helpSteps: [
      "Log in to Podium and go to Settings → Integrations → API",
      'Click "Create New Application" to register a new OAuth app',
      "Set the Redirect URI to the value shown below (copy it exactly)",
      "Copy the Client ID and Client Secret from the created app and paste them here",
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

  useEffect(() => {
    fetch("/api/ghl/status")
      .then((r) => r.json())
      .then(setGhlStatus)
      .catch(() => {});
  }, []);

  const loadOAuthStatuses = useCallback(async () => {
    const results: Record<string, OAuthAppStatus> = {};
    await Promise.all(
      OAUTH2_CONNECTORS.map(async (c) => {
        try {
          const res = await fetch(`/api/connectors/${c.id}/oauth-app`);
          results[c.id] = await res.json();
        } catch {
          results[c.id] = { configured: false };
        }
      })
    );
    setOauthAppStatuses(results);
  }, []);

  useEffect(() => {
    loadOAuthStatuses();
  }, [loadOAuthStatuses]);

  useEffect(() => {
    const needed = searchParams.get("oauth_setup_needed");
    if (needed) {
      setExpandedConnector(needed);
      setTimeout(() => {
        document.getElementById(`connector-${needed}`)?.scrollIntoView({ behavior: "smooth" });
      }, 300);
    }
  }, [searchParams]);

  async function handleGhlSave(e: React.FormEvent) {
    e.preventDefault();
    setGhlSaving(true);
    setGhlMessage("");
    try {
      const res = await fetch("/api/ghl/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: ghlClientId, clientSecret: ghlClientSecret }),
      });
      if (res.ok) {
        setGhlMessage("Credentials saved. Redirecting to GHL authorization...");
        const data = await res.json();
        if (data.authUrl) window.location.href = data.authUrl;
      } else {
        const data = await res.json();
        setGhlMessage(data.error || "Failed to save credentials");
      }
    } catch {
      setGhlMessage("Something went wrong");
    }
    setGhlSaving(false);
  }

  async function handleConnectorSave(connectorId: string) {
    const form = connectorForms[connectorId];
    if (!form?.clientId || !form?.clientSecret) {
      setConnectorMessages((p) => ({
        ...p,
        [connectorId]: { type: "error", text: "Both Client ID and Client Secret are required" },
      }));
      return;
    }

    setConnectorSaving((p) => ({ ...p, [connectorId]: true }));
    setConnectorMessages((p) => ({ ...p, [connectorId]: { type: "success", text: "" } }));

    try {
      const res = await fetch(`/api/connectors/${connectorId}/oauth-app`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: form.clientId, clientSecret: form.clientSecret }),
      });
      const data = await res.json();
      if (res.ok) {
        setConnectorMessages((p) => ({
          ...p,
          [connectorId]: { type: "success", text: `Credentials saved successfully!` },
        }));
        await loadOAuthStatuses();
        setConnectorForms((p) => ({ ...p, [connectorId]: { clientId: "", clientSecret: "" } }));
      } else {
        setConnectorMessages((p) => ({
          ...p,
          [connectorId]: { type: "error", text: data.error || "Failed to save" },
        }));
      }
    } catch {
      setConnectorMessages((p) => ({
        ...p,
        [connectorId]: { type: "error", text: "Something went wrong" },
      }));
    }

    setConnectorSaving((p) => ({ ...p, [connectorId]: false }));
  }

  async function handleConnectorDelete(connectorId: string) {
    await fetch(`/api/connectors/${connectorId}/oauth-app`, { method: "DELETE" });
    await loadOAuthStatuses();
    setConnectorMessages((p) => ({
      ...p,
      [connectorId]: { type: "success", text: "Credentials removed" },
    }));
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }

  const baseUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXTAUTH_URL || "";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="mt-1 text-muted-foreground">
          Configure your GoHighLevel connection and platform integrations.
          Complete the GHL setup first, then configure any OAuth platforms you plan to use.
        </p>
      </div>

      {/* ── GHL Connection ──────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Settings2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">GoHighLevel Connection</CardTitle>
              <CardDescription>
                Connect your GHL Marketplace App to access sub-accounts for data migration.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {ghlStatus?.connected ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-500/10 p-4">
                <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                <div>
                  <p className="font-medium text-emerald-600 dark:text-emerald-400">
                    Connected to GoHighLevel
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Agency: <strong>{ghlStatus.companyName}</strong>
                    {ghlStatus.tokenExpiresAt && (
                      <> · Token expires {new Date(ghlStatus.tokenExpiresAt).toLocaleDateString()}</>
                    )}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setGhlStatus({ connected: false })}
              >
                Reconnect with different credentials
              </Button>
            </div>
          ) : (
            <form onSubmit={handleGhlSave} className="space-y-5">
              {/* Step-by-step instructions */}
              <div className="rounded-lg border border-border bg-muted/30 p-5 space-y-4">
                <p className="text-sm font-semibold text-foreground">
                  How to get your GHL App credentials:
                </p>
                <ol className="space-y-3 text-sm">
                  <li className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">1</span>
                    <span className="text-muted-foreground">
                      Go to{" "}
                      <a href="https://marketplace.gohighlevel.com" target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">
                        marketplace.gohighlevel.com
                      </a>{" "}
                      and sign in with your agency account
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">2</span>
                    <span className="text-muted-foreground">
                      Click <strong>&quot;My Apps&quot;</strong> → create a new app or open an existing one
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">3</span>
                    <span className="text-muted-foreground">
                      Go to the <strong>&quot;Auth&quot;</strong> tab and copy the <strong>Client ID</strong> and <strong>Client Secret</strong>
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">4</span>
                    <span className="text-muted-foreground">
                      Set the redirect URI in GHL to:
                    </span>
                  </li>
                </ol>
                <div className="flex items-center gap-2 rounded-lg bg-muted p-3">
                  <code className="flex-1 text-xs text-primary break-all font-mono">
                    {baseUrl}/api/oauth/callback
                  </code>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="shrink-0 h-7 px-2"
                    onClick={() => copyToClipboard(`${baseUrl}/api/oauth/callback`)}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="ghlClientId">Client ID</Label>
                  <Input
                    id="ghlClientId"
                    value={ghlClientId}
                    onChange={(e) => setGhlClientId(e.target.value)}
                    placeholder="e.g. 69ba5c34xxxxxxxxxxxxxxxx"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ghlClientSecret">Client Secret</Label>
                  <Input
                    id="ghlClientSecret"
                    type="password"
                    value={ghlClientSecret}
                    onChange={(e) => setGhlClientSecret(e.target.value)}
                    placeholder="Your GHL app client secret"
                    required
                  />
                </div>
              </div>

              {ghlMessage && (
                <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {ghlMessage}
                </div>
              )}

              <Button type="submit" disabled={ghlSaving} className="gap-2">
                {ghlSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4" />
                    Save & Connect to GHL
                  </>
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {/* ── Platform OAuth App Credentials ─────────────────────────────── */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Link2 className="h-5 w-5 text-muted-foreground" />
            Platform Connections (OAuth)
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            For platforms that use OAuth login (like Podium), you need to register your own developer
            app and enter its credentials here. <strong>API-key platforms</strong> (Dentally, Cliniko,
            HubSpot, Pipedrive, etc.) do <em>not</em> need setup here — you enter those keys directly
            when starting a migration.
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
            <Card
              key={connector.id}
              id={`connector-${connector.id}`}
              className={`transition-shadow ${isExpanded ? "ring-2 ring-primary/50 shadow-md" : ""}`}
            >
              <CardHeader
                className="cursor-pointer select-none"
                onClick={() => setExpandedConnector(isExpanded ? null : connector.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-sm font-bold text-muted-foreground">
                      {connector.name[0]}
                    </div>
                    <div>
                      <CardTitle className="text-base">{connector.name}</CardTitle>
                      <CardDescription className="text-xs mt-0.5">
                        OAuth 2.0 — requires your own registered developer app
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {status?.configured ? (
                      <Badge variant="outline" className="text-xs text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700 gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Configured
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700">
                        Not configured
                      </Badge>
                    )}
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </div>
              </CardHeader>

              {isExpanded && (
                <CardContent className="space-y-5 border-t pt-5">
                  {/* Step-by-step guide */}
                  <div className="rounded-lg border border-border bg-muted/30 p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-foreground">Setup instructions:</p>
                      <a
                        href={connector.devPortalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                      >
                        Open {connector.name}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                    <ol className="space-y-2.5">
                      {connector.helpSteps.map((step, i) => (
                        <li key={i} className="flex gap-3 text-sm">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                            {i + 1}
                          </span>
                          <span className="text-muted-foreground">{step}</span>
                        </li>
                      ))}
                    </ol>
                    <div className="flex items-center gap-2 rounded-lg bg-muted p-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-medium text-muted-foreground mb-1">
                          Redirect URI (copy this into {connector.name}):
                        </p>
                        <code className="text-xs break-all text-primary font-mono">{redirectUri}</code>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="shrink-0 h-7 px-2"
                        onClick={() => copyToClipboard(redirectUri)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Current status */}
                  {status?.configured && (
                    <div className="flex items-center justify-between rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-500/10 p-4">
                      <div>
                        <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                          App credentials saved
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Client ID: {status.clientIdPreview}
                          {status.updatedAt && ` · Updated ${new Date(status.updatedAt).toLocaleDateString()}`}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleConnectorDelete(connector.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}

                  {/* Credential form */}
                  <div className="space-y-4">
                    <p className="text-sm font-medium text-foreground">
                      {status?.configured ? "Update credentials:" : "Enter your app credentials:"}
                    </p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor={`${connector.id}-clientId`}>Client ID</Label>
                        <Input
                          id={`${connector.id}-clientId`}
                          placeholder={`Your ${connector.name} app Client ID`}
                          value={form.clientId}
                          onChange={(e) =>
                            setConnectorForms((p) => ({
                              ...p,
                              [connector.id]: { ...form, clientId: e.target.value },
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`${connector.id}-clientSecret`}>Client Secret</Label>
                        <Input
                          id={`${connector.id}-clientSecret`}
                          type="password"
                          placeholder={`Your ${connector.name} app Client Secret`}
                          value={form.clientSecret}
                          onChange={(e) =>
                            setConnectorForms((p) => ({
                              ...p,
                              [connector.id]: { ...form, clientSecret: e.target.value },
                            }))
                          }
                        />
                      </div>
                    </div>

                    {message && message.text && (
                      <div
                        className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
                          message.type === "success"
                            ? "border-emerald-200 dark:border-emerald-800 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "border-red-200 dark:border-red-800 bg-red-500/10 text-red-600 dark:text-red-400"
                        }`}
                      >
                        {message.type === "success" ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                        )}
                        {message.text}
                      </div>
                    )}

                    <Button
                      onClick={() => handleConnectorSave(connector.id)}
                      disabled={saving || !form.clientId || !form.clientSecret}
                      size="sm"
                      className="gap-2"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        status?.configured ? "Update Credentials" : "Save Credentials"
                      )}
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
