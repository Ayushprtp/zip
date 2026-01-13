"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "ui/card";
import { Label } from "ui/label";
import { Input } from "ui/input";
import { Button } from "ui/button";
import { Key, Eye, EyeOff, Save } from "lucide-react";
import { toast } from "sonner";
import { UserPreferences } from "app-types/user";

interface UserApiKeysCardProps {
  preferences: UserPreferences | null;
  onUpdate?: () => void;
}

export function UserApiKeysCard({
  preferences,
  onUpdate,
}: UserApiKeysCardProps) {
  const [showOpenAI, setShowOpenAI] = useState(false);
  const [showGemini, setShowGemini] = useState(false);
  const [openAIKey, setOpenAIKey] = useState(preferences?.openAIKey || "");
  const [geminiKey, setGeminiKey] = useState(
    preferences?.googleGeminiKey || "",
  );
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/user/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...preferences,
          openAIKey: openAIKey || undefined,
          googleGeminiKey: geminiKey || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save API keys");
      }

      toast.success("API keys saved successfully");
      onUpdate?.();
    } catch (error) {
      toast.error("Failed to save API keys");
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="transition-all duration-200 hover:shadow-md">
      <CardHeader className="pb-4">
        <CardTitle className="text-xl font-semibold flex items-center gap-2">
          <Key className="h-5 w-5 text-primary" />
          Personal API Keys
        </CardTitle>
        <CardDescription>
          Add your own API keys to use your personal quotas. Keys are encrypted
          and stored securely.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* OpenAI API Key */}
        <div className="space-y-2">
          <Label htmlFor="openai-key" className="flex items-center gap-2">
            OpenAI API Key
            <span className="text-xs text-muted-foreground">(Optional)</span>
          </Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                id="openai-key"
                type={showOpenAI ? "text" : "password"}
                value={openAIKey}
                onChange={(e) => setOpenAIKey(e.target.value)}
                placeholder="sk-..."
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full"
                onClick={() => setShowOpenAI(!showOpenAI)}
              >
                {showOpenAI ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Get your API key from{" "}
            <a
              href="https://platform.openai.com/api-keys"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-primary"
            >
              OpenAI Platform
            </a>
          </p>
        </div>

        {/* Google Gemini API Key */}
        <div className="space-y-2">
          <Label htmlFor="gemini-key" className="flex items-center gap-2">
            Google Gemini API Key
            <span className="text-xs text-muted-foreground">(Optional)</span>
          </Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                id="gemini-key"
                type={showGemini ? "text" : "password"}
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                placeholder="AIza..."
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full"
                onClick={() => setShowGemini(!showGemini)}
              >
                {showGemini ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Get your API key from{" "}
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-primary"
            >
              Google AI Studio
            </a>
          </p>
        </div>

        {/* Save Button */}
        <Button onClick={handleSave} disabled={isSaving} className="w-full">
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? "Saving..." : "Save API Keys"}
        </Button>

        {/* Info Notice */}
        <div className="p-3 bg-muted rounded-lg text-xs text-muted-foreground">
          <p className="font-medium mb-1">🔒 Security Notice</p>
          <p>
            Your API keys are stored encrypted in the database and are only used
            for your personal requests. They are never shared with other users
            or logged.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
