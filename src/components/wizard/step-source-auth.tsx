"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, AlertCircle, ChevronLeft } from "lucide-react";

interface ConnectorDetail {
  id: string;
  name: string;
  authConfig: {
    type: string;
    fields?: { key: string; label: string; placeholder: string; secret: boolean; helpText?: string }[];
  };
}

interface StepSourceAuthProps {
  connectorId: string;
  onAuthenticated: (credentials: Record<string, string>, label: string) => void;
  onBack: () => void;
}

export function StepSourceAuth({
  connectorId,
  onAuthenticated,
  onBack,
}: StepSourceAuthProps) {
  const [connector, setConnector] = useState<ConnectorDetail | null>(null);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [label, setLabel] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ valid: boolean; error?: string } | null>(null);

  useEffect(() => {
    fetch("/api/connectors")
      .then((r) => r.json())
      .then((data) => {
        const c = data.connectors?.find((c: ConnectorDetail) => c.id === connectorId);
        setConnector(c || null);
      });
  }, [connectorId]);

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
    return <div className="py-12 text-center text-neutral-500">Loading...</div>;
  }

  const fields = connector.authConfig.fields || [];
  const isOAuth = connector.authConfig.type === "oauth2";

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack}>
        <ChevronLeft className="mr-1 h-4 w-4" /> Back
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Connect to {connector.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isOAuth ? (
            <div className="space-y-3">
              <p className="text-sm text-neutral-600">
                Click below to authenticate with {connector.name} via OAuth.
              </p>
              <Button onClick={() => {
                // For OAuth, we would redirect to the OAuth flow
                // For now, show API key fields as fallback
              }}>
                Connect with {connector.name}
              </Button>
              <p className="text-xs text-neutral-400">
                Or enter credentials manually below:
              </p>
              <div className="space-y-3">
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
            </div>
          ) : (
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
                    <p className="text-xs text-neutral-400">{field.helpText}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="label">Label (for your reference)</Label>
            <Input
              id="label"
              placeholder={`e.g., Dr. Smith's ${connector.name}`}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>

          {testResult && (
            <div
              className={`flex items-center gap-2 rounded-md p-3 text-sm ${
                testResult.valid
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {testResult.valid ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              {testResult.valid
                ? "Connection successful!"
                : testResult.error || "Connection failed"}
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="outline" onClick={handleTest} disabled={testing}>
              {testing ? "Testing..." : "Test Connection"}
            </Button>
            <Button
              onClick={() => onAuthenticated(credentials, label)}
              disabled={!testResult?.valid && Object.keys(credentials).length === 0}
            >
              Continue
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
