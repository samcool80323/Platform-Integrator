"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  Loader2,
  KeyRound,
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
  token_exchange_failed: "Failed to exchange code for access token. Check your app credentials in Settings.",
  not_configured: "OAuth credentials are not configured. Go to Settings to set up this connector first.",
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

  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [label, setLabel] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ valid: boolean; error?: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [showManual, setShowManual] = useState(false);
  const [oauthStatus, setOauthStatus] = useState<"idle" | "fetching" | "done" | "error">("idle");
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [oauthAppConfigured, setOauthAppConfigured] = useState<boolean | null>(null);

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

  const loadSavedAccounts = useCallback(async () => {
    setLoadingAccounts(true);
    try {
      const res = await fetch(`/api/connected-accounts?connectorId=${connectorId}`);
      const data = await res.json();
      setSavedAccounts(data.accounts || []);
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
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading...
      </div>
    );
  }

  const isOAuth = connector.authConfig.type === "oauth2";
  const fields = connector.authConfig.fields || [];
  const scopes = connector.authConfig.scopes || [];
  const scopeDescriptions = connector.authConfig.scopeDescriptions || {};
  const hasCredentials = Object.values(credentials).some((v) => v.length > 0);

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Back to platform selection
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-muted-foreground" />
            Connect to {connector.name}
          </CardTitle>
          <CardDescription>
            {isOAuth
              ? `Authorize access to ${connector.name} using OAuth. This securely connects without sharing your password.`
              : `Enter your ${connector.name} API credentials below. These are securely encrypted and stored for future use.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">

          {/* ── SAVED ACCOUNTS ── */}
          {mode === "select" && savedAccounts.length > 0 && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Previously connected {connector.name} accounts
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Select an account to reuse it, or add a new one below.
                </p>
              </div>

              <div className="space-y-2">
                {savedAccounts.map((account) => (
                  <div
                    key={account.id}
                    onClick={() => setSelectedAccountId(account.id)}
                    className={`flex items-center justify-between rounded-lg border p-4 cursor-pointer transition-all ${
                      selectedAccountId === account.id
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border hover:border-primary/30 hover:bg-accent/50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
                        selectedAccountId === account.id ? "bg-primary text-primary-foreground" : "bg-muted"
                      }`}>
                        <User className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{account.label}</p>
                        <p className="text-xs text-muted-foreground">
                          Added {new Date(account.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          {account.lastValidated && ` · Last checked ${new Date(account.lastValidated).toLocaleDateString()}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {account.isValid ? (
                        <Badge variant="outline" className="text-xs text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700">
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Valid
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700">
                          <AlertCircle className="h-3 w-3 mr-1" /> Expired
                        </Badge>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteAccount(account.id); }}
                        className="text-muted-foreground hover:text-destructive transition-colors p-1.5 rounded-md hover:bg-destructive/10"
                        title="Remove this saved account"
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
                Connect a different {connector.name} account
              </button>

              <div className="pt-2">
                <Button
                  onClick={() => {
                    const account = savedAccounts.find((a) => a.id === selectedAccountId);
                    if (account) onAuthenticated({ credentialId: account.id, label: account.label });
                  }}
                  disabled={!selectedAccountId}
                  className="gap-2"
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
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Back to saved accounts
                </button>
              )}

              {/* OAuth2 flow */}
              {isOAuth && (
                <div className="space-y-4">
                  {scopes.length > 0 && (
                    <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <ShieldCheck className="h-4 w-4 text-emerald-500" />
                        Permissions requested (read-only):
                      </div>
                      <ul className="space-y-2">
                        {scopes.map((scope) => (
                          <li key={scope} className="flex items-start gap-2 text-sm">
                            <Badge variant="secondary" className="mt-0.5 shrink-0 text-[11px] font-mono px-1.5">{scope}</Badge>
                            <span className="text-muted-foreground">{scopeDescriptions[scope] || scope}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {oauthStatus === "fetching" && (
                    <div className="flex items-center gap-2 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-500/10 p-4 text-sm text-blue-600 dark:text-blue-400">
                      <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                      Completing connection with {connector.name}...
                    </div>
                  )}
                  {oauthStatus === "done" && testResult?.valid && (
                    <div className="flex items-center gap-2 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-500/10 p-4 text-sm text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      Successfully connected to {connector.name}! Give this account a name below to save it.
                    </div>
                  )}
                  {oauthStatus === "error" && oauthError && (
                    <div className="flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      {oauthError}
                    </div>
                  )}

                  {oauthAppConfigured === false && (
                    <div className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-500/10 p-4 space-y-3">
                      <div className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-400">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        {connector.name} OAuth app not configured
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Before you can connect via OAuth, you need to register your {connector.name} developer app
                        and enter its credentials in Settings.
                      </p>
                      <Button asChild size="sm" variant="outline">
                        <a href={`/settings?oauth_setup_needed=${connectorId}`}>
                          Go to Settings
                          <ExternalLink className="ml-2 h-3 w-3" />
                        </a>
                      </Button>
                    </div>
                  )}

                  {oauthStatus !== "done" && oauthAppConfigured !== false && (
                    <Button asChild disabled={oauthStatus === "fetching"} className="gap-2">
                      <a href={`/api/connectors/${connectorId}/oauth/start`}>
                        <ExternalLink className="h-4 w-4" />
                        Connect with {connector.name}
                      </a>
                    </Button>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowManual((p) => !p)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showManual ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    {showManual ? "Hide manual token entry" : "Have a token already? Enter it manually"}
                  </button>

                  {showManual && (
                    <div className="rounded-lg border border-border p-4 space-y-3">
                      <p className="text-xs text-muted-foreground">
                        If you already have an access token (e.g. from a developer dashboard), paste it below.
                      </p>
                      <div className="space-y-2">
                        <Label>Access Token</Label>
                        <Input
                          type="password"
                          placeholder="Paste your access token here"
                          value={credentials.accessToken || ""}
                          onChange={(e) => setCredentials((p) => ({ ...p, accessToken: e.target.value }))}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* API Key / Header Auth */}
              {!isOAuth && (
                <div className="space-y-4">
                  <div className="rounded-lg border border-border bg-muted/30 p-4">
                    <p className="text-sm text-muted-foreground">
                      Enter the API credentials for your client&apos;s {connector.name} account.
                      These are typically found in the platform&apos;s settings or developer section.
                    </p>
                  </div>
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
                        <p className="text-xs text-muted-foreground">{field.helpText}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Account label */}
              {(hasCredentials || oauthStatus === "done") && (
                <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="label">
                      Account Name
                    </Label>
                    <Input
                      id="label"
                      placeholder={`e.g. Dr. Smith's ${connector.name}, ABC Clinic`}
                      value={label}
                      onChange={(e) => setLabel(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Give this connection a recognizable name. It will be saved so you can
                      reuse it for future migrations without re-entering credentials.
                    </p>
                  </div>
                </div>
              )}

              {/* Test result */}
              {testResult && (
                <div className={`flex items-center gap-2 rounded-lg border p-4 text-sm ${
                  testResult.valid
                    ? "border-emerald-200 dark:border-emerald-800 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "border-red-200 dark:border-red-800 bg-red-500/10 text-red-600 dark:text-red-400"
                }`}>
                  {testResult.valid
                    ? <CheckCircle2 className="h-4 w-4 shrink-0" />
                    : <AlertCircle className="h-4 w-4 shrink-0" />}
                  {testResult.valid ? "Connection successful! The credentials are working." : testResult.error || "Connection failed. Please double-check your credentials."}
                </div>
              )}

              {saveError && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {saveError}
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-3 pt-1">
                {(!isOAuth || showManual) && oauthStatus !== "done" && (
                  <Button variant="outline" onClick={handleTest} disabled={testing || !hasCredentials} className="gap-2">
                    {testing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Testing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4" />
                        Test Connection
                      </>
                    )}
                  </Button>
                )}
                {(testResult?.valid || oauthStatus === "done") && (
                  <Button onClick={handleSaveAndContinue} disabled={saving || !label.trim()} className="gap-2">
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save & Continue"
                    )}
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
