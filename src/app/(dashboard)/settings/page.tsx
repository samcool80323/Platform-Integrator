"use client";

import { useState, useEffect } from "react";
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
import { CheckCircle2, AlertCircle } from "lucide-react";

interface GhlStatus {
  connected: boolean;
  companyName?: string;
  tokenExpiresAt?: string;
}

export default function SettingsPage() {
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<GhlStatus | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/ghl/status")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => {});
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/ghl/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, clientSecret }),
      });
      if (res.ok) {
        setMessage("Credentials saved. Redirecting to GHL authorization...");
        const data = await res.json();
        if (data.authUrl) {
          window.location.href = data.authUrl;
        }
      } else {
        const data = await res.json();
        setMessage(data.error || "Failed to save credentials");
      }
    } catch {
      setMessage("Something went wrong");
    }
    setSaving(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Settings</h1>
        <p className="text-sm text-neutral-500">
          Configure your GoHighLevel agency connection
        </p>
      </div>

      {/* GHL Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">GoHighLevel Connection</CardTitle>
          <CardDescription>
            Connect your GHL Marketplace App to access sub-accounts
          </CardDescription>
        </CardHeader>
        <CardContent>
          {status?.connected ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span className="font-medium text-green-700">Connected</span>
                <Badge variant="secondary">{status.companyName}</Badge>
              </div>
              {status.tokenExpiresAt && (
                <p className="text-sm text-neutral-500">
                  Token expires: {new Date(status.tokenExpiresAt).toLocaleString()}
                </p>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStatus({ connected: false })}
              >
                Reconnect
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="clientId">GHL App Client ID</Label>
                <Input
                  id="clientId"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="Enter your GHL marketplace app client ID"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clientSecret">GHL App Client Secret</Label>
                <Input
                  id="clientSecret"
                  type="password"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  placeholder="Enter your GHL marketplace app client secret"
                  required
                />
              </div>
              <div className="rounded-md bg-neutral-100 p-3 text-sm text-neutral-600">
                <p className="font-medium">How to get these credentials:</p>
                <ol className="mt-1 list-inside list-decimal space-y-1">
                  <li>Go to marketplace.gohighlevel.com</li>
                  <li>Create or select your Marketplace App</li>
                  <li>Copy the Client ID and Client Secret from the app settings</li>
                  <li>Ensure the redirect URI is set to your callback URL</li>
                </ol>
              </div>

              {message && (
                <div className="flex items-center gap-2 text-sm">
                  <AlertCircle className="h-4 w-4" />
                  {message}
                </div>
              )}

              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save & Connect"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
