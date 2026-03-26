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

  useEffect(() => { loadSavedAccounts(); }, [loadSavedAccounts]);

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
        const testData = await testRes.json();
        setTestResult(testData);

        // Auto-save and continue if test passed — no manual steps needed
        if (testData.valid) {
          const autoLabel = `${connectorId} (OAuth ${new Date().toLocaleDateString()})`;
          const saveRes = await fetch("/api/connected-accounts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ connectorId, label: autoLabel, credentials: data.credentials }),
          });
          const saveData = await saveRes.json();
          if (saveRes.ok) {
            onAuthenticated({ credentialId: saveData.account.id, label: saveData.account.label });
            return; // done — wizard advances to next step
          }
        }
        setMode("add"); // fallback if auto-save failed
      } else {
        setOauthError(data.error || "Failed to retrieve access token.");
        setOauthStatus("error");
        setMode("add");
      }
    } catch {
      setOauthError("Network error while retrieving token.");
      setOauthStatus("error");
    }
  }, [connectorId, onAuthenticated]);

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
    if (!label.trim()) { setSaveError("Please enter a name for this account"); return; }
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/connected-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectorId, label, credentials }),
      });
      const data = await res.json();
      if (res.ok) onAuthenticated({ credentialId: data.account.id, label: data.account.label });
      else setSaveError(data.error || "Failed to save account");
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
      <div className="flex items-center justify-center gap-2.5 py-20 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
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
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
        <ChevronLeft className="h-4 w-4" /> Back
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10">
              <KeyRound className="h-4 w-4 text-violet-500" />
            </div>
            Connect to {connector.name}
          </CardTitle>
          <CardDescription>
            {isOAuth
              ? `Authorize access to ${connector.name} via OAuth. No password sharing needed.`
              : `Enter your ${connector.name} API credentials. They're encrypted and saved for reuse.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">

          {/* Saved accounts */}
          {mode === "select" && savedAccounts.length > 0 && (
            <div className="space-y-4">
              <p className="text-sm font-semibold text-foreground">
                Previously connected accounts
              </p>
              <div className="space-y-2">
                {savedAccounts.map((account) => (
                  <div
                    key={account.id}
                    onClick={() => setSelectedAccountId(account.id)}
                    className={`flex items-center justify-between rounded-xl border p-4 cursor-pointer transition-all duration-200 ${
                      selectedAccountId === account.id
                        ? "border-primary bg-primary/5 shadow-glow"
                        : "border-border hover:border-primary/20 hover:shadow-card-hover"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl transition-all ${
                        selectedAccountId === account.id ? "gradient-primary text-white" : "bg-muted"
                      }`}>
                        <User className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{account.label}</p>
                        <p className="text-xs text-muted-foreground">
                          Added {new Date(account.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {account.isValid ? (
                        <Badge variant="secondary" className="text-xs text-emerald-600 dark:text-emerald-400 gap-1 rounded-lg">
                          <CheckCircle2 className="h-3 w-3" /> Valid
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs text-amber-600 dark:text-amber-400 gap-1 rounded-lg">
                          <AlertCircle className="h-3 w-3" /> Expired
                        </Badge>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteAccount(account.id); }}
                        className="text-muted-foreground hover:text-red-500 transition-colors p-1.5 rounded-lg hover:bg-red-500/10"
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
                className="flex items-center gap-2 text-sm font-medium text-primary hover:underline"
              >
                <Plus className="h-4 w-4" />
                Add a different account
              </button>
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
          )}

          {/* Add new account */}
          {mode === "add" && (
            <div className="space-y-5">
              {savedAccounts.length > 0 && (
                <button type="button" onClick={() => setMode("select")}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <ChevronLeft className="h-3.5 w-3.5" /> Back to saved accounts
                </button>
              )}

              {isOAuth && (
                <div className="space-y-4">
                  {scopes.length > 0 && (
                    <div className="rounded-xl border border-border bg-secondary/50 p-4 space-y-3">
                      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <ShieldCheck className="h-4 w-4 text-emerald-500" />
                        Permissions (read-only):
                      </div>
                      <ul className="space-y-2">
                        {scopes.map((scope) => (
                          <li key={scope} className="flex items-start gap-2 text-sm">
                            <Badge variant="secondary" className="mt-0.5 shrink-0 text-[11px] font-mono px-1.5 rounded-md">{scope}</Badge>
                            <span className="text-muted-foreground">{scopeDescriptions[scope] || scope}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {oauthStatus === "fetching" && (
                    <StatusAlert variant="info">
                      <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                      Completing connection with {connector.name}...
                    </StatusAlert>
                  )}
                  {oauthStatus === "done" && testResult?.valid && (
                    <StatusAlert variant="success">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      Connected to {connector.name}! Name this account below to save it.
                    </StatusAlert>
                  )}
                  {oauthStatus === "error" && oauthError && (
                    <StatusAlert variant="error">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      {oauthError}
                    </StatusAlert>
                  )}

                  {oauthAppConfigured === false && (
                    <StatusAlert variant="warning">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <div className="space-y-2">
                        <p className="font-semibold">{connector.name} OAuth not configured</p>
                        <p className="text-muted-foreground font-normal">Register a developer app and enter credentials in Settings first.</p>
                        <Button asChild size="sm" variant="outline">
                          <a href={`/settings?oauth_setup_needed=${connectorId}`}>
                            Go to Settings <ExternalLink className="ml-2 h-3 w-3" />
                          </a>
                        </Button>
                      </div>
                    </StatusAlert>
                  )}

                  {oauthStatus !== "done" && oauthAppConfigured !== false && (
                    <Button
                      disabled={oauthStatus === "fetching"}
                      className="gap-2"
                      onClick={() => {
                        // Save wizard state so it survives the OAuth redirect
                        try {
                          sessionStorage.setItem(
                            "migration_wizard_state",
                            JSON.stringify({ step: 1, state: { connectorId, connectorName: connector.name } })
                          );
                        } catch { /* ignore */ }
                        window.location.href = `/api/connectors/${connectorId}/oauth/start`;
                      }}
                    >
                      <ExternalLink className="h-4 w-4" />
                      Connect with {connector.name}
                    </Button>
                  )}

                  <button type="button" onClick={() => setShowManual((p) => !p)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    {showManual ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    {showManual ? "Hide manual entry" : "Have a token already? Enter manually"}
                  </button>

                  {showManual && (
                    <div className="rounded-xl border border-border p-4 space-y-3">
                      <p className="text-xs text-muted-foreground">Paste an existing access token below.</p>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Access Token</Label>
                        <Input type="password" placeholder="Paste token here"
                          value={credentials.accessToken || ""}
                          onChange={(e) => setCredentials((p) => ({ ...p, accessToken: e.target.value }))} />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {!isOAuth && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-border bg-secondary/50 p-4">
                    <p className="text-sm text-muted-foreground">
                      Enter your client&apos;s {connector.name} API credentials.
                      Typically found in the platform&apos;s settings or developer section.
                    </p>
                  </div>
                  {fields.map((field) => (
                    <div key={field.key} className="space-y-1.5">
                      <Label htmlFor={field.key} className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        {field.label}
                      </Label>
                      <Input id={field.key} type={field.secret ? "password" : "text"}
                        placeholder={field.placeholder}
                        value={credentials[field.key] || ""}
                        onChange={(e) => setCredentials((p) => ({ ...p, [field.key]: e.target.value }))} />
                      {field.helpText && <p className="text-xs text-muted-foreground">{field.helpText}</p>}
                    </div>
                  ))}
                </div>
              )}

              {(hasCredentials || oauthStatus === "done") && (
                <div className="rounded-xl border border-border bg-secondary/50 p-4 space-y-3">
                  <Label htmlFor="label" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Account Name
                  </Label>
                  <Input id="label" placeholder={`e.g. Dr. Smith's ${connector.name}`}
                    value={label} onChange={(e) => setLabel(e.target.value)} />
                  <p className="text-xs text-muted-foreground">
                    A recognizable name so you can reuse this connection for future migrations.
                  </p>
                </div>
              )}

              {testResult && (
                <StatusAlert variant={testResult.valid ? "success" : "error"}>
                  {testResult.valid ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
                  {testResult.valid ? "Connection successful!" : testResult.error || "Connection failed. Double-check credentials."}
                </StatusAlert>
              )}

              {saveError && (
                <StatusAlert variant="error">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {saveError}
                </StatusAlert>
              )}

              <div className="flex flex-wrap gap-3 pt-1">
                {(!isOAuth || showManual) && oauthStatus !== "done" && (
                  <Button variant="outline" onClick={handleTest} disabled={testing || !hasCredentials} className="gap-2">
                    {testing ? <><Loader2 className="h-4 w-4 animate-spin" /> Testing...</> : <><RefreshCw className="h-4 w-4" /> Test Connection</>}
                  </Button>
                )}
                {(testResult?.valid || oauthStatus === "done") && (
                  <Button onClick={handleSaveAndContinue} disabled={saving || !label.trim()} className="gap-2">
                    {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : "Save & Continue"}
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

function StatusAlert({ variant, children }: { variant: "success" | "error" | "warning" | "info"; children: React.ReactNode }) {
  const styles = {
    success: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    error: "border-red-500/20 bg-red-500/10 text-red-500",
    warning: "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    info: "border-violet-500/20 bg-violet-500/10 text-violet-600 dark:text-violet-400",
  };
  return (
    <div className={`flex items-start gap-2.5 rounded-xl border p-4 text-sm font-medium ${styles[variant]}`}>
      {children}
    </div>
  );
}
