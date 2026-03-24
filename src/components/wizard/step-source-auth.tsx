"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Plus,
  User,
  Trash2,
  RefreshCw,
} from "lucide-react";

interface ConnectorDetail {
  id: string;
  name: string;
  authConfig: {
    type: string;
    fields?: { key: string; label: string; placeholder: string; secret: boolean; helpText?: string }[];
    scopes?: string[];
    scopeDescriptions?: Record<string, string>;
  };
}

interface SavedAccount {
  id: string;
  connectorId: string;
  label: string;
  isValid: boolean;
  lastValidated: string | null;
  createdAt: string;
}

interface StepSourceAuthProps {
  connectorId: string;
  // Returns either a saved credentialId OR raw credentials for a new account
  onAuthenticated: (
    data: { credentialId: string; label: string } | { credentials: Record<string, string>; label: string }
  ) => void;
  onBack: () => void;
}

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  missing_params: "OAuth response was missing required parameters.",
  session_expired: "Your OAuth session expired. Please try again.",
  invalid_state: "Security check failed. Please try again.",
  state_mismatch: "Security token mismatch. Please try again.",
  token_exchange_failed: "Failed to exchange code for access token. Check your app credentials.",
  not_configured: "OAuth credentials are not configured on the server. Contact your admin.",
  server_error: "An unexpected server error occurred during OAuth.",
  access_denied: "You denied access to the application.",
};

export function StepSourceAuth({ connectorId, onAuthenticated, onBack }: StepSourceAuthProps) {
  const searchParams = useSearchParams();

  const [connector, setConnector] = useState<ConnectorDetail | null>(null);
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [mode, setMode] = useState<"select" | "add">("select");

  // New account form state
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [label, setLabel] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ valid: boolean; error?: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // OAuth state
  const [showManual, setShowManual] = useState(false);
  const [oauthStatus, setOauthStatus] = useState<"idle" | "fetching" | "done" | "error">("idle");
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [oauthAppConfigured, setOauthAppConfigured] = useState<boolean | null>(null);

  // Load connector details
  useEffect(() => {
    fetch("/api/connectors")
      .then((r) => r.json())
      .then((data) => {
        const c = data.connectors?.find((c: ConnectorDetail) => c.id === connectorId);
        setConnector(c || null);
        if (c?.authConfig?.type === "oauth2") {
          fetch(`/api/connectors/${connectorId}/oauth-app`)
            .then((r) => r.json())
            .then((d) => setOauthAppConfigured(d.configured ?? false))
            .catch(() => setOauthAppConfigured(false));
        }
      });
  }, [connectorId]);

  // Load saved accounts for this connector
  const loadSavedAccounts = useCallback(async () => {
    setLoadingAccounts(true);
    try {
      const res = await fetch(`/api/connected-accounts?connectorId=${connectorId}`);
      const data = await res.json();
      setSavedAccounts(data.accounts || []);
      // If no saved accounts, jump straight to add mode
      if ((data.accounts || []).length === 0) setMode("add");
    } catch {
      setSavedAccounts([]);
      setMode("add");
    }
    setLoadingAccounts(false);
  }, [connectorId]);

  useEffect(() => {
    loadSavedAccounts();
  }, [loadSavedAccounts]);

  // Handle OAuth redirect back
  const fetchOAuthToken = useCallback(async () => {
    setOauthStatus("fetching");
    try {
      const res = await fetch(`/api/connectors/${connectorId}/oauth/token`);
      const data = await res.json();
      if (res.ok && data.credentials?.accessToken) {
        setCredentials(data.credentials);
        setOauthStatus("done");
        const testRes = await fetch(`/api/connectors/${connectorId}/test`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ credentials: data.credentials }),
        });
        setTestResult(await testRes.json());
        setMode("add");
      } else {
        setOauthError(data.error || "Failed to retrieve access token.");
        setOauthStatus("error");
        setMode("add");
      }
    } catch {
      setOauthError("Network error while retrieving token.");
      setOauthStatus("error");
    }
  }, [connectorId]);

  useEffect(() => {
    const oauthDone = searchParams.get("oauth_done");
    const oauthConnector = searchParams.get("oauth_connector");
    const oauthErrParam = searchParams.get("oauth_error");
    if (oauthConnector !== connectorId) return;
    if (oauthErrParam) {
      setOauthError(OAUTH_ERROR_MESSAGES[oauthErrParam] || `OAuth error: ${oauthErrParam}`);
      setOauthStatus("error");
      setShowManual(true);
      setMode("add");
      return;
    }
    if (oauthDone === "1") fetchOAuthToken();
  }, [searchParams, connectorId, fetchOAuthToken]);

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`/api/connectors/${connectorId}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credentials }),
      });
      setTestResult(await res.json());
    } catch {
      setTestResult({ valid: false, error: "Connection test failed" });
    }
    setTesting(false);
  }

  async function handleSaveAndContinue() {
    if (!label.trim()) {
      setSaveError("Please enter a name for this account");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/connected-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectorId, label, credentials }),
      });
      const data = await res.json();
      if (res.ok) {
        // Continue with the saved credential ID
        onAuthenticated({ credentialId: data.account.id, label: data.account.label });
      } else {
        setSaveError(data.error || "Failed to save account");
      }
    } catch {
      setSaveError("Something went wrong saving the account");
    }
    setSaving(false);
  }

  function handleDeleteAccount(id: string) {
    fetch(`/api/connected-accounts/${id}`, { method: "DELETE" }).then(() => {
      loadSavedAccounts();
      if (selectedAccountId === id) setSelectedAccountId(null);
    });
  }

  if (!connector || loadingAccounts) {
    return <div className="py-12 text-center text-muted-foreground">Loading...</div>;
  }

  const isOAuth = connector.authConfig.type === "oauth2";
  const fields = connector.authConfig.fields || [];
  const scopes = connector.authConfig.scopes || [];
  const scopeDescriptions = connector.authConfig.scopeDescriptions || {};
  const hasCredentials = Object.values(credentials).some((v) => v.length > 0);

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack}>
        <ChevronLeft className="mr-1 h-4 w-4" /> Back
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Connect to {connector.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">

          {/* ── SAVED ACCOUNTS ── */}
          {mode === "select" && savedAccounts.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">
                Select a saved {connector.name} account:
              </p>
              <div className="space-y-2">
                {savedAccounts.map((account) => (
                  <div
                    key={account.id}
                    onClick={() => setSelectedAccountId(account.id)}
                    className={`flex items-center justify-between rounded-lg border p-3 cursor-pointer transition-colors ${
                      selectedAccountId === account.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50 hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-full ${
                        selectedAccountId === account.id ? "bg-primary text-primary-foreground" : "bg-muted"
                      }`}>
                        <User className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{account.label}</p>
                        <p className="text-xs text-muted-foreground">
                          Added {new Date(account.createdAt).toLocaleDateString()}
                          {account.lastValidated && ` · Last checked ${new Date(account.lastValidated).toLocaleDateString()}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {account.isValid ? (
                        <Badge variant="outline" className="text-xs text-green-600 border-green-500">
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Valid
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-orange-500 border-orange-400">
                          <AlertCircle className="h-3 w-3 mr-1" /> Expired
                        </Badge>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteAccount(account.id); }}
                        className="text-muted-foreground hover:text-destructive transition-colors p-1"
                        title="Remove account"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => { setMode("add"); setSelectedAccountId(null); }}
                className="flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <Plus className="h-4 w-4" />
                Add a different {connector.name} account
              </button>

              <div className="flex gap-3 pt-2">
                <Button
                  onClick={() => {
                    const account = savedAccounts.find((a) => a.id === selectedAccountId);
                    if (account) onAuthenticated({ credentialId: account.id, label: account.label });
                  }}
                  disabled={!selectedAccountId}
                >
                  Continue with selected account
                </Button>
              </div>
            </div>
          )}

          {/* ── ADD NEW ACCOUNT ── */}
          {mode === "add" && (
            <div className="space-y-5">
              {savedAccounts.length > 0 && (
                <button
                  type="button"
                  onClick={() => setMode("select")}
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronLeft className="h-3 w-3" />
                  Back to saved accounts
                </button>
              )}

              {/* OAuth2 flow */}
              {isOAuth && (
                <div className="space-y-4">
                  {scopes.length > 0 && (
                    <div className="rounded-lg border bg-muted/40 p-4 space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <ShieldCheck className="h-4 w-4 text-green-500" />
                        Permissions this will request:
                      </div>
                      <ul className="space-y-1.5">
                        {scopes.map((scope) => (
                          <li key={scope} className="flex items-start gap-2 text-sm">
                            <Badge variant="secondary" className="mt-0.5 shrink-0 text-xs font-mono">{scope}</Badge>
                            <span className="text-muted-foreground">{scopeDescriptions[scope] || scope}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {oauthStatus === "fetching" && (
                    <div className="flex items-center gap-2 rounded-md bg-blue-500/10 p-3 text-sm text-blue-500">
                      <RefreshCw className="h-4 w-4 animate-spin shrink-0" />
                      Completing connection with {connector.name}...
                    </div>
                  )}
                  {oauthStatus === "done" && testResult?.valid && (
                    <div className="flex items-center gap-2 rounded-md bg-green-500/10 p-3 text-sm text-green-500">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      Connected to {connector.name}! Give this account a name to save it.
                    </div>
                  )}
                  {oauthStatus === "error" && oauthError && (
                    <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      {oauthError}
                    </div>
                  )}

                  {oauthAppConfigured === false && (
                    <div className="rounded-md border border-orange-500/40 bg-orange-500/10 p-4 space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium text-orange-600 dark:text-orange-400">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        {connector.name} app not configured yet
                      </div>
                      <p className="text-xs text-muted-foreground">
                        You need to set up your {connector.name} developer app credentials in Settings first.
                      </p>
                      <Button asChild size="sm" variant="outline">
                        <a href={`/settings?oauth_setup_needed=${connectorId}`}>
                          Go to Settings <ExternalLink className="ml-2 h-3 w-3" />
                        </a>
                      </Button>
                    </div>
                  )}

                  {oauthStatus !== "done" && oauthAppConfigured !== false && (
                    <Button asChild disabled={oauthStatus === "fetching"}>
                      <a href={`/api/connectors/${connectorId}/oauth/start`}>
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Connect with {connector.name}
                      </a>
                    </Button>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowManual((p) => !p)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showManual ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    {showManual ? "Hide" : "Enter token manually instead"}
                  </button>

                  {showManual && (
                    <div className="rounded-md border p-4 space-y-2">
                      <Label>Access Token</Label>
                      <Input
                        type="password"
                        placeholder="Paste your access token"
                        value={credentials.accessToken || ""}
                        onChange={(e) => setCredentials((p) => ({ ...p, accessToken: e.target.value }))}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* API Key / Header Auth */}
              {!isOAuth && (
                <div className="space-y-3">
                  {fields.map((field) => (
                    <div key={field.key} className="space-y-2">
                      <Label htmlFor={field.key}>{field.label}</Label>
                      <Input
                        id={field.key}
                        type={field.secret ? "password" : "text"}
                        placeholder={field.placeholder}
                        value={credentials[field.key] || ""}
                        onChange={(e) => setCredentials((p) => ({ ...p, [field.key]: e.target.value }))}
                      />
                      {field.helpText && (
                        <p className="text-xs text-muted-foreground/70">{field.helpText}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Account label */}
              {(hasCredentials || oauthStatus === "done") && (
                <div className="space-y-2">
                  <Label htmlFor="label">
                    Account Name <span className="text-muted-foreground text-xs">(so you can reuse it later)</span>
                  </Label>
                  <Input
                    id="label"
                    placeholder={`e.g. Dr. Smith's ${connector.name}, ABC Clinic ${connector.name}`}
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    This account will be saved so you can reuse it for future migrations without re-entering credentials.
                  </p>
                </div>
              )}

              {/* Test result */}
              {testResult && (
                <div className={`flex items-center gap-2 rounded-md p-3 text-sm ${
                  testResult.valid ? "bg-green-500/10 text-green-500" : "bg-destructive/10 text-destructive"
                }`}>
                  {testResult.valid
                    ? <CheckCircle2 className="h-4 w-4 shrink-0" />
                    : <AlertCircle className="h-4 w-4 shrink-0" />}
                  {testResult.valid ? "Connection successful!" : testResult.error || "Connection failed"}
                </div>
              )}

              {saveError && (
                <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {saveError}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                {(!isOAuth || showManual) && oauthStatus !== "done" && (
                  <Button variant="outline" onClick={handleTest} disabled={testing || !hasCredentials}>
                    {testing ? "Testing..." : "Test Connection"}
                  </Button>
                )}
                {(testResult?.valid || oauthStatus === "done") && (
                  <Button onClick={handleSaveAndContinue} disabled={saving || !label.trim()}>
                    {saving ? "Saving..." : "Save & Continue"}
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
