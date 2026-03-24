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
  Settings2,
  Trash2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
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

// Only OAuth2 connectors need app credentials configured here
const OAUTH2_CONNECTORS = [
  {
    id: "podium",
    name: "Podium",
    logo: "/logos/podium.svg",
    devPortalUrl: "https://app.podium.com",
    devPortalLabel: "Podium Developer Settings",
    helpSteps: [
      "Log in to Podium → Settings → Integrations → API",
      'Click "Create New Application"',
      "Set the Redirect URI to the value shown below",
      "Copy the Client ID and Client Secret from the app",
    ],
  },
];

export default function SettingsPage() {
  const searchParams = useSearchParams();

  // ── GHL State ─────────────────────────────────────────────────────────────
  const [ghlClientId, setGhlClientId] = useState("");
  const [ghlClientSecret, setGhlClientSecret] = useState("");
  const [ghlSaving, setGhlSaving] = useState(false);
  const [ghlStatus, setGhlStatus] = useState<GhlStatus | null>(null);
  const [ghlMessage, setGhlMessage] = useState("");

  // ── Connector OAuth App State ──────────────────────────────────────────────
  const [oauthAppStatuses, setOauthAppStatuses] = useState<Record<string, OAuthAppStatus>>({});
  const [expandedConnector, setExpandedConnector] = useState<string | null>(null);
  const [connectorForms, setConnectorForms] = useState<Record<string, { clientId: string; clientSecret: string }>>({});
  const [connectorSaving, setConnectorSaving] = useState<Record<string, boolean>>({});
  const [connectorMessages, setConnectorMessages] = useState<Record<string, { type: "success" | "error"; text: string }>>({});

  // ── Init ──────────────────────────────────────────────────────────────────
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

  // Auto-expand connector if redirected from settings needed
  useEffect(() => {
    const needed = searchParams.get("oauth_setup_needed");
    if (needed) {
      setExpandedConnector(needed);
      // Scroll to connector section
      setTimeout(() => {
        document.getElementById(`connector-${needed}`)?.scrollIntoView({ behavior: "smooth" });
      }, 300);
    }
  }, [searchParams]);

  // ── GHL Handlers ──────────────────────────────────────────────────────────
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

  // ── Connector OAuth App Handlers ───────────────────────────────────────────
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
          [connectorId]: { type: "success", text: `Saved! Redirect URI: ${data.redirectUri}` },
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

  const baseUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXTAUTH_URL || "";

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Configure your GoHighLevel connection and platform integrations
        </p>
      </div>

      {/* ── GHL Connection ──────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            GoHighLevel Connection
          </CardTitle>
          <CardDescription>
            Connect your GHL Marketplace App to access sub-accounts.
            Each agency enters their own GHL app credentials here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {ghlStatus?.connected ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <span className="font-medium text-green-500">Connected</span>
                <Badge variant="secondary">{ghlStatus.companyName}</Badge>
              </div>
              {ghlStatus.tokenExpiresAt && (
                <p className="text-sm text-muted-foreground">
                  Token expires: {new Date(ghlStatus.tokenExpiresAt).toLocaleString()}
                </p>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setGhlStatus({ connected: false })}
              >
                Reconnect with different credentials
              </Button>
            </div>
          ) : (
            <form onSubmit={handleGhlSave} className="space-y-4">
              <div className="rounded-md border bg-muted/30 p-4 text-sm space-y-2">
                <p className="font-medium">How to get your GHL App credentials:</p>
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                  <li>Go to <strong>marketplace.gohighlevel.com</strong> and sign in</li>
                  <li>Click <strong>"My Apps"</strong> → create or open your app</li>
                  <li>Go to the <strong>"Auth"</strong> tab</li>
                  <li>Copy the <strong>Client ID</strong> and <strong>Client Secret</strong></li>
                  <li>Set the redirect URI to: <code className="bg-muted px-1 rounded text-xs">{baseUrl}/api/oauth/callback</code></li>
                </ol>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ghlClientId">GHL App Client ID</Label>
                <Input
                  id="ghlClientId"
                  value={ghlClientId}
                  onChange={(e) => setGhlClientId(e.target.value)}
                  placeholder="e.g. 69ba5c34xxxxxxxxxxxxxxxx"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ghlClientSecret">GHL App Client Secret</Label>
                <Input
                  id="ghlClientSecret"
                  type="password"
                  value={ghlClientSecret}
                  onChange={(e) => setGhlClientSecret(e.target.value)}
                  placeholder="Enter your GHL app client secret"
                  required
                />
              </div>

              {ghlMessage && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <AlertCircle className="h-4 w-4" />
                  {ghlMessage}
                </div>
              )}

              <Button type="submit" disabled={ghlSaving}>
                {ghlSaving ? "Saving..." : "Save & Connect GHL"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {/* ── Platform OAuth App Credentials ─────────────────────────────── */}
      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Platform Connections</h2>
          <p className="text-sm text-muted-foreground">
            For platforms that use OAuth login (like Podium), each agency registers
            their own app and enters those credentials here. API-key platforms (Dentally,
            Cliniko, HubSpot, etc.) do not need setup here — you enter keys directly
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
              className={isExpanded ? "ring-2 ring-primary" : ""}
            >
              <CardHeader
                className="cursor-pointer select-none"
                onClick={() => setExpandedConnector(isExpanded ? null : connector.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div>
                      <CardTitle className="text-base">{connector.name}</CardTitle>
                      <CardDescription className="text-xs">
                        OAuth 2.0 — register your own app to connect
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {status?.configured ? (
                      <Badge variant="default" className="bg-green-500 text-white text-xs">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Configured
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-orange-500 border-orange-500">
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
                  <div className="rounded-md border bg-muted/30 p-4 text-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">How to set this up:</p>
                      <a
                        href={connector.devPortalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        Open {connector.name}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                    <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                      {connector.helpSteps.map((step, i) => (
                        <li key={i}>{step}</li>
                      ))}
                    </ol>
                    <div className="rounded bg-muted p-2">
                      <p className="text-xs font-medium text-foreground mb-1">
                        Your redirect URI (copy this exactly into {connector.name}):
                      </p>
                      <code className="text-xs break-all text-primary">{redirectUri}</code>
                    </div>
                  </div>

                  {/* Current status if configured */}
                  {status?.configured && (
                    <div className="flex items-center justify-between rounded-md bg-green-500/10 p-3 text-sm">
                      <div>
                        <p className="font-medium text-green-600 dark:text-green-400">App credentials saved</p>
                        <p className="text-muted-foreground text-xs">
                          Client ID: {status.clientIdPreview}
                          {status.updatedAt && ` · Updated ${new Date(status.updatedAt).toLocaleDateString()}`}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleConnectorDelete(connector.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}

                  {/* Form to enter / update credentials */}
                  <div className="space-y-3">
                    <p className="text-sm font-medium">
                      {status?.configured ? "Update credentials:" : "Enter your app credentials:"}
                    </p>
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

                    {message && (
                      <div
                        className={`flex items-start gap-2 rounded-md p-3 text-sm ${
                          message.type === "success"
                            ? "bg-green-500/10 text-green-600 dark:text-green-400"
                            : "bg-destructive/10 text-destructive"
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
                    >
                      {saving ? "Saving..." : status?.configured ? "Update Credentials" : "Save Credentials"}
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
