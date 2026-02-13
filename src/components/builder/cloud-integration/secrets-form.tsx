/**
 * Secrets Form — Per-Provider Secret Input Form
 *
 * Shows a form with all the required keys for a provider (Firebase, Supabase, etc.)
 * and lets the user paste their API keys, project IDs, etc.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Eye,
  EyeOff,
  Save,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
} from "lucide-react";
import type {
  IntegrationProvider,
  SecretEntry,
} from "@/lib/builder/cloud-integration/secrets-manager";
import { PROVIDER_KEY_DEFINITIONS } from "@/lib/builder/cloud-integration/secrets-manager";
import type { UseSecretsManagerReturn } from "@/lib/builder/cloud-integration/use-secrets-manager";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SecretsFormProps {
  provider: IntegrationProvider;
  secretsManager: UseSecretsManagerReturn;
  onSaved?: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function SecretsForm({
  provider,
  secretsManager,
  onSaved,
}: SecretsFormProps) {
  const definitions = PROVIDER_KEY_DEFINITIONS[provider];
  const [values, setValues] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Load existing values
  useEffect(() => {
    const existing = secretsManager.getProviderSecrets(provider);
    const map: Record<string, string> = {};
    for (const entry of existing) {
      map[entry.key] = entry.value;
    }
    setValues(map);
  }, [provider, secretsManager]);

  const handleChange = useCallback((key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }, []);

  const toggleReveal = useCallback((key: string) => {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const handleCopy = useCallback(async (key: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      for (const def of definitions) {
        const value = values[def.key] || "";
        const entry: SecretEntry = {
          key: def.key,
          value,
          provider,
          label: def.label,
        };
        await secretsManager.setSecret(entry);
      }
      setSaved(true);
      onSaved?.();
    } catch (err) {
      console.error("Failed to save secrets:", err);
    } finally {
      setSaving(false);
    }
  }, [definitions, values, provider, secretsManager, onSaved]);

  const handleClearAll = useCallback(async () => {
    await secretsManager.clearProvider(provider);
    setValues({});
    setSaved(false);
  }, [provider, secretsManager]);

  const isConfigured = secretsManager.isProviderConfigured(provider);
  const hasAnyValue = Object.values(values).some((v) => v && v.length > 0);

  return (
    <div className="space-y-4">
      {/* Status Badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isConfigured ? (
            <Badge
              variant="default"
              className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
            >
              <CheckCircle2 className="mr-1 h-3 w-3" />
              Configured
            </Badge>
          ) : (
            <Badge
              variant="secondary"
              className="bg-amber-500/10 text-amber-400 border-amber-500/30"
            >
              <AlertCircle className="mr-1 h-3 w-3" />
              Not Configured
            </Badge>
          )}
        </div>

        {hasAnyValue && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearAll}
            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
          >
            <Trash2 className="mr-1 h-3 w-3" />
            Clear All
          </Button>
        )}
      </div>

      {/* Secret Fields */}
      <div className="space-y-3">
        {definitions.map((def) => (
          <div key={def.key} className="space-y-1.5">
            <Label
              htmlFor={`secret-${def.key}`}
              className="text-xs font-medium text-muted-foreground"
            >
              {def.label}
            </Label>
            <div className="relative flex gap-1">
              <div className="relative flex-1">
                <Input
                  id={`secret-${def.key}`}
                  type={revealed.has(def.key) ? "text" : "password"}
                  placeholder={def.placeholder}
                  value={values[def.key] || ""}
                  onChange={(e) => handleChange(def.key, e.target.value)}
                  className="pr-20 font-mono text-xs bg-background/50 border-border/50 focus:border-primary/50"
                />
                <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-0.5">
                  <button
                    type="button"
                    onClick={() => toggleReveal(def.key)}
                    className="p-1 rounded hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
                    title={revealed.has(def.key) ? "Hide" : "Show"}
                  >
                    {revealed.has(def.key) ? (
                      <EyeOff className="h-3.5 w-3.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                  </button>
                  {values[def.key] && (
                    <button
                      type="button"
                      onClick={() => handleCopy(def.key, values[def.key])}
                      className="p-1 rounded hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
                      title="Copy"
                    >
                      {copiedKey === def.key ? (
                        <Check className="h-3.5 w-3.5 text-green-400" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground/60 font-mono">
              {def.key}
            </p>
          </div>
        ))}
      </div>

      {/* Save Button */}
      <div className="flex items-center gap-2 pt-2">
        <Button
          onClick={handleSave}
          disabled={saving || !hasAnyValue}
          size="sm"
          className="w-full"
        >
          {saving ? (
            <>
              <span className="mr-2 h-3 w-3 animate-spin rounded-full border-2 border-background border-t-transparent" />
              Encrypting & Saving...
            </>
          ) : saved ? (
            <>
              <CheckCircle2 className="mr-2 h-3.5 w-3.5" />
              Saved Securely
            </>
          ) : (
            <>
              <Save className="mr-2 h-3.5 w-3.5" />
              Save Keys (Encrypted)
            </>
          )}
        </Button>
      </div>

      {/* Security note */}
      <p className="text-[10px] text-muted-foreground/50 text-center leading-relaxed">
        🔐 Keys are AES-256-GCM encrypted in your browser&apos;s localStorage.
        <br />
        They are never sent to or stored on our servers.
      </p>
    </div>
  );
}
