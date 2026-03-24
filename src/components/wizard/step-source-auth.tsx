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
} from "lucide-react";

interface ConnectorDetail {
  id: string;
  name: string;
  authConfig: {
    type: string;
    fields?: {
      key: string;
      label: string;
      placeholder: string;
      secret: boolean;
      helpText?: string;
    }[];
    scopes?: string[];
    scopeDescriptions?: Record<string, string>;
  };
}

interface StepSourceAuthProps {
  connectorId: string;
  onAuthenticated: (credentials: Record<string, string>, label: string) => void;
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

export function StepSourceAuth({
  connectorId,
  onAuthenticated,
  onBack,
}: StepSourceAuthProps) {
  const searchParams = useSearchParams();
  const [connector, setConnector] = useState<ConnectorDetail | null>(null);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [label, setLabel] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ valid: boolean; error?: string } | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [oauthStatus, setOauthStatus] = useState<"idle" | "fetching" | "done" | "error">("idle");
  const [oauthError, setOauthError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/connectors")
      .then((r) => r.json())
      .then((data) => {
        const c = data.connectors?.find((c: ConnectorDetail) => c.id === connectorId);
        setConnector(c || null);
      });
  }, [connectorId]);

  // Handle redirect back from OAuth provider
  const fetchOAuthToken = useCallback(async () => {
    setOauthStatus("fetching");
    try {
      const res = await fetch(`/api/connectors/${connectorId}/oauth/token`);
      const data = await res.json();
      if (res.ok && data.credentials?.accessToken) {
        setCredentials(data.credentials);
        setOauthStatus("done");
        // Auto-test the connection
        const testRes = await fetch(`/api/connectors/${connectorId}/test`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ credentials: data.credentials }),
        });
        const testData = await testRes.json();
        setTestResult(testData);
      } else {
        setOauthError(data.error || "Failed to retrieve access token.");
        setOauthStatus("error");
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
      return;
    }

    if (oauthDone === "1") {
      fetchOAuthToken();
    }
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
      const result = await res.json();
      setTestResult(result);
    } catch {
      setTestResult({ valid: false, error: "Connection test failed" });
    }
    setTesting(false);
  }

  if (!connector) {
    return (
      <div className="py-12 text-center text-muted-foreground">Loading...</div>
    );
  }

  const fields = connector.authConfig.fields || [];
  const isOAuth = connector.authConfig.type === "oauth2";
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

          {/* ── OAuth2 Flow ── */}
          {isOAuth && (
            <div className="space-y-4">

              {/* Permissions being requested */}
              {scopes.length > 0 && (
                <div className="rounded-lg border bg-muted/40 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <ShieldCheck className="h-4 w-4 text-green-500" />
                    Permissions this integration will request:
                  </div>
                  <ul className="space-y-1.5">
                    {scopes.map((scope) => (
                      <li key={scope} className="flex items-start gap-2 text-sm">
                        <Badge variant="secondary" className="mt-0.5 shrink-0 text-xs font-mono">
                          {scope}
                        </Badge>
                        <span className="text-muted-foreground">
                          {scopeDescriptions[scope] || scope}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* OAuth status feedback */}
              {oauthStatus === "fetching" && (
                <div className="flex items-center gap-2 rounded-md bg-blue-500/10 p-3 text-sm text-blue-500">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                  Completing connection with {connector.name}...
                </div>
              )}

              {oauthStatus === "done" && testResult?.valid && (
                <div className="flex items-center gap-2 rounded-md bg-green-500/10 p-3 text-sm text-green-500">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  Successfully connected to {connector.name}!
                </div>
              )}

              {oauthStatus === "error" && oauthError && (
                <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {oauthError}
                </div>
              )}

              {/* Connect button — only show if not already done */}
              {oauthStatus !== "done" && (
                <Button
                  asChild
                  className="w-full sm:w-auto"
                  disabled={oauthStatus === "fetching"}
                >
                  <a href={`/api/connectors/${connectorId}/oauth/start`}>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Connect with {connector.name}
                  </a>
                </Button>
              )}

              {/* Reconnect option after done */}
              {oauthStatus === "done" && (
                <Button variant="outline" size="sm" asChild>
                  <a href={`/api/connectors/${connectorId}/oauth/start`}>
                    Reconnect {connector.name}
                  </a>
                </Button>
              )}

              {/* Manual entry toggle */}
              <button
                type="button"
                onClick={() => setShowManual((p) => !p)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {showManual ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
                {showManual ? "Hide" : "Enter token manually instead"}
              </button>

              {showManual && (
                <div className="space-y-2 rounded-md border p-4">
                  <p className="text-xs text-muted-foreground mb-3">
                    If you already have an access token from {connector.name}, paste it below.
                  </p>
                  <div className="space-y-2">
                    <Label>Access Token</Label>
                    <Input
                      type="password"
                      placeholder="Paste your access token"
                      value={credentials.accessToken || ""}
                      onChange={(e) =>
                        setCredentials((p) => ({ ...p, accessToken: e.target.value }))
                      }
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── API Key / Header Auth ── */}
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
                    onChange={(e) =>
                      setCredentials((p) => ({ ...p, [field.key]: e.target.value }))
                    }
                  />
                  {field.helpText && (
                    <p className="text-xs text-muted-foreground/70">{field.helpText}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── Label field ── */}
          <div className="space-y-2">
            <Label htmlFor="label">Label <span className="text-muted-foreground text-xs">(for your reference)</span></Label>
            <Input
              id="label"
              placeholder={`e.g., Dr. Smith's ${connector.name}`}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>

          {/* ── Test result (for manual entry) ── */}
          {testResult && oauthStatus !== "done" && (
            <div
              className={`flex items-center gap-2 rounded-md p-3 text-sm ${
                testResult.valid
                  ? "bg-green-500/10 text-green-500"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              {testResult.valid ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0" />
              )}
              {testResult.valid
                ? "Connection successful!"
                : testResult.error || "Connection failed"}
            </div>
          )}

          {/* ── Actions ── */}
          <div className="flex gap-3 pt-1">
            {(!isOAuth || showManual) && (
              <Button variant="outline" onClick={handleTest} disabled={testing || !hasCredentials}>
                {testing ? "Testing..." : "Test Connection"}
              </Button>
            )}
            <Button
              onClick={() => onAuthenticated(credentials, label || `${connector.name} account`)}
              disabled={
                oauthStatus === "fetching" ||
                (!hasCredentials && oauthStatus !== "done")
              }
            >
              Continue
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
