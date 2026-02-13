"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Globe,
  Plus,
  Trash2,
  Wifi,
  WifiOff,
  Key,
  Lock,
  Server,
  User,
  X,
  TestTube,
  Loader2,
  Check,
  ChevronDown,
  ChevronRight,
  Maximize2,
  Minimize2,
  Terminal,
  Settings2,
  Zap,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useRemoteDevStore } from "@/stores/remote-dev-store";
import type { SSHConnectionConfig } from "@/types/builder/remote";

interface RemoteConnectionPanelProps {
  onClose?: () => void;
  isMaximized?: boolean;
  onToggleMaximize?: () => void;
}

type AuthMethod = "password" | "key";

interface ConnectionForm {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authMethod: AuthMethod;
  password: string;
  privateKey: string;
  passphrase: string;
  preferredShell: string;
  // Jump host
  useJumpHost: boolean;
  jumpHost: string;
  jumpPort: number;
  jumpUsername: string;
  jumpAuthMethod: AuthMethod;
  jumpPassword: string;
  jumpPrivateKey: string;
  // Env vars
  envVars: { key: string; value: string }[];
  // Identity file path
  identityFile: string;
}

const DEFAULT_FORM: ConnectionForm = {
  id: "",
  name: "",
  host: "",
  port: 22,
  username: "",
  authMethod: "password",
  password: "",
  privateKey: "",
  passphrase: "",
  preferredShell: "",
  useJumpHost: false,
  jumpHost: "",
  jumpPort: 22,
  jumpUsername: "",
  jumpAuthMethod: "password",
  jumpPassword: "",
  jumpPrivateKey: "",
  envVars: [],
  identityFile: "",
};

export function RemoteConnectionPanel({
  onClose,
  isMaximized,
  onToggleMaximize,
}: RemoteConnectionPanelProps) {
  const {
    connectionStatus,
    activeConnection,
    savedConnections,
    connect,
    disconnect,
    setSavedConnections,
    saveConnections,
    loadSavedConnections,
  } = useRemoteDevStore();

  const [showAddForm, setShowAddForm] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    id: string;
    success: boolean;
    message: string;
  } | null>(null);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [form, setForm] = useState<ConnectionForm>({ ...DEFAULT_FORM });

  const isConnected = connectionStatus === "connected";

  useEffect(() => {
    loadSavedConnections();
  }, [loadSavedConnections]);

  const resetForm = useCallback(() => {
    setForm({ ...DEFAULT_FORM });
    setShowAddForm(false);
    setShowAdvanced(false);
  }, []);

  const formToConfig = useCallback((f: ConnectionForm): SSHConnectionConfig => {
    const config: SSHConnectionConfig = {
      id: f.id || `ssh_${Date.now()}`,
      name: f.name || `${f.username}@${f.host}`,
      host: f.host,
      port: f.port,
      username: f.username,
      authMethod: f.authMethod,
      preferredShell: f.preferredShell || undefined,
    };

    if (f.authMethod === "password") {
      config.password = f.password;
    } else {
      config.privateKey = f.privateKey;
      if (f.passphrase) config.passphrase = f.passphrase;
    }

    if (f.identityFile) {
      config.identityFile = f.identityFile;
    }

    if (f.useJumpHost && f.jumpHost) {
      config.jumpHost = {
        host: f.jumpHost,
        port: f.jumpPort,
        username: f.jumpUsername || f.username,
        authMethod: f.jumpAuthMethod,
        ...(f.jumpAuthMethod === "password"
          ? { password: f.jumpPassword }
          : { privateKey: f.jumpPrivateKey }),
      };
    }

    if (f.envVars.length > 0) {
      config.envVars = {};
      for (const ev of f.envVars) {
        if (ev.key.trim()) {
          config.envVars[ev.key.trim()] = ev.value;
        }
      }
    }

    return config;
  }, []);

  const handleSave = useCallback(() => {
    if (!form.host || !form.username) {
      toast.error("Host and username are required");
      return;
    }

    const config = formToConfig(form);

    // Save to store
    const store = useRemoteDevStore.getState();
    const existing = store.savedConnections;
    const updated = form.id
      ? existing.map((c) => (c.id === form.id ? config : c))
      : [...existing, config];

    // Persist
    try {
      localStorage.setItem("flare-ssh-connections", JSON.stringify(updated));
    } catch {}
    store.loadSavedConnections();
    resetForm();
    toast.success(form.id ? "Connection updated" : "Connection saved");
  }, [form, formToConfig, resetForm]);

  const handleConnect = useCallback(
    async (config: SSHConnectionConfig) => {
      setConnectingId(config.id);
      try {
        await connect(config);
      } finally {
        setConnectingId(null);
      }
    },
    [connect],
  );

  const handleTest = useCallback(async (config: SSHConnectionConfig) => {
    setTestingId(config.id);
    setTestResult(null);

    try {
      const body: Record<string, unknown> = {
        action: "test",
        host: config.host,
        port: config.port,
        username: config.username,
      };

      if (config.authMethod === "password") {
        body.password = config.password;
      } else {
        body.privateKey = config.privateKey;
        if (config.passphrase) body.passphrase = config.passphrase;
      }

      if (config.jumpHost) {
        body.jumpHost = config.jumpHost;
      }

      const res = await fetch("/api/builder/ssh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      setTestResult({
        id: config.id,
        success: data.success,
        message: data.success
          ? "Connection successful!"
          : data.error || "Connection failed",
      });
    } catch (err: unknown) {
      setTestResult({
        id: config.id,
        success: false,
        message: err instanceof Error ? err.message : "Test failed",
      });
    } finally {
      setTestingId(null);
    }
  }, []);

  const handleDelete = useCallback(
    (id: string) => {
      const isActive = activeConnection?.id === id && isConnected;
      if (isActive) {
        disconnect();
      }
      const updated = savedConnections.filter((c) => c.id !== id);
      setSavedConnections(updated);
      saveConnections();
      toast.success("Connection removed");
    },
    [
      activeConnection,
      isConnected,
      disconnect,
      savedConnections,
      setSavedConnections,
      saveConnections,
    ],
  );

  const addEnvVar = useCallback(() => {
    setForm((f) => ({
      ...f,
      envVars: [...f.envVars, { key: "", value: "" }],
    }));
  }, []);

  const removeEnvVar = useCallback((index: number) => {
    setForm((f) => ({
      ...f,
      envVars: f.envVars.filter((_, i) => i !== index),
    }));
  }, []);

  const updateEnvVar = useCallback(
    (index: number, field: "key" | "value", val: string) => {
      setForm((f) => ({
        ...f,
        envVars: f.envVars.map((ev, i) =>
          i === index ? { ...ev, [field]: val } : ev,
        ),
      }));
    },
    [],
  );

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30 shrink-0">
        <div className="flex items-center gap-2">
          <Globe className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold uppercase text-muted-foreground">
            Remote Development
          </span>
          {isConnected && (
            <span className="px-1.5 py-0.5 text-[8px] rounded bg-green-500/20 text-green-600 font-bold uppercase">
              Connected
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => {
              resetForm();
              setShowAddForm(true);
            }}
            className="h-6 w-6"
            title="Add Connection"
          >
            <Plus className="h-3 w-3" />
          </Button>
          {onToggleMaximize && (
            <Button
              size="icon"
              variant="ghost"
              onClick={onToggleMaximize}
              className="h-6 w-6"
            >
              {isMaximized ? (
                <Minimize2 className="h-3 w-3" />
              ) : (
                <Maximize2 className="h-3 w-3" />
              )}
            </Button>
          )}
          {onClose && (
            <Button
              size="icon"
              variant="ghost"
              onClick={onClose}
              className="h-6 w-6"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Add/Edit Form */}
        {showAddForm && (
          <div className="p-3 border-b bg-muted/10 space-y-2">
            <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Server className="h-3 w-3" />
              {form.id ? "Edit Connection" : "New Connection"}
            </h3>

            {/* Basic fields */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-muted-foreground font-medium">
                  Name
                </label>
                <input
                  type="text"
                  placeholder="My Server"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  className="w-full h-7 px-2 text-xs bg-background border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground font-medium">
                  Port
                </label>
                <input
                  type="number"
                  value={form.port}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      port: Number.parseInt(e.target.value) || 22,
                    }))
                  }
                  className="w-full h-7 px-2 text-xs bg-background border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] text-muted-foreground font-medium">
                Host *
              </label>
              <div className="relative">
                <Server className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="192.168.1.100 or example.com"
                  value={form.host}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, host: e.target.value }))
                  }
                  className="w-full h-7 pl-7 pr-2 text-xs bg-background border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] text-muted-foreground font-medium">
                Username *
              </label>
              <div className="relative">
                <User className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="root"
                  value={form.username}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, username: e.target.value }))
                  }
                  className="w-full h-7 pl-7 pr-2 text-xs bg-background border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            {/* Auth method */}
            <div>
              <label className="text-[10px] text-muted-foreground font-medium">
                Authentication
              </label>
              <div className="flex gap-1">
                <button
                  type="button"
                  className={`flex-1 h-7 text-xs rounded flex items-center justify-center gap-1 border ${form.authMethod === "password" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
                  onClick={() =>
                    setForm((f) => ({ ...f, authMethod: "password" }))
                  }
                >
                  <Lock className="h-3 w-3" /> Password
                </button>
                <button
                  type="button"
                  className={`flex-1 h-7 text-xs rounded flex items-center justify-center gap-1 border ${form.authMethod === "key" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
                  onClick={() => setForm((f) => ({ ...f, authMethod: "key" }))}
                >
                  <Key className="h-3 w-3" /> Private Key
                </button>
              </div>
            </div>

            {form.authMethod === "password" ? (
              <div>
                <label className="text-[10px] text-muted-foreground font-medium">
                  Password
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, password: e.target.value }))
                  }
                  className="w-full h-7 px-2 text-xs bg-background border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            ) : (
              <>
                <div>
                  <label className="text-[10px] text-muted-foreground font-medium">
                    Private Key (PEM)
                  </label>
                  <textarea
                    placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
                    value={form.privateKey}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, privateKey: e.target.value }))
                    }
                    rows={3}
                    className="w-full px-2 py-1 text-xs bg-background border rounded focus:outline-none focus:ring-1 focus:ring-primary font-mono resize-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground font-medium">
                    Passphrase (optional)
                  </label>
                  <input
                    type="password"
                    placeholder="Key passphrase..."
                    value={form.passphrase}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, passphrase: e.target.value }))
                    }
                    className="w-full h-7 px-2 text-xs bg-background border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </>
            )}

            {/* Advanced Settings */}
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              {showAdvanced ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              <Settings2 className="h-3 w-3" />
              <span>Advanced Settings</span>
            </button>

            {showAdvanced && (
              <div className="space-y-2 pl-2 border-l-2 border-primary/20">
                {/* Preferred Shell */}
                <div>
                  <label className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                    <Terminal className="h-2.5 w-2.5" />
                    Preferred Shell
                  </label>
                  <select
                    value={form.preferredShell}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        preferredShell: e.target.value,
                      }))
                    }
                    className="w-full h-7 px-2 text-xs bg-background border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">Default</option>
                    <option value="/bin/bash">Bash</option>
                    <option value="/bin/zsh">Zsh</option>
                    <option value="/bin/sh">sh</option>
                    <option value="/bin/fish">Fish</option>
                  </select>
                </div>

                {/* Identity file */}
                <div>
                  <label className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                    <Key className="h-2.5 w-2.5" />
                    Identity File Path (remote)
                  </label>
                  <input
                    type="text"
                    placeholder="~/.ssh/id_rsa"
                    value={form.identityFile}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, identityFile: e.target.value }))
                    }
                    className="w-full h-7 px-2 text-xs bg-background border rounded focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                  />
                </div>

                {/* Jump Host */}
                <div>
                  <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.useJumpHost}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          useJumpHost: e.target.checked,
                        }))
                      }
                      className="rounded"
                    />
                    <ExternalLink className="h-2.5 w-2.5" />
                    Use Jump Host (ProxyJump)
                  </label>
                </div>

                {form.useJumpHost && (
                  <div className="space-y-2 pl-2 border-l border-yellow-500/30">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-muted-foreground font-medium">
                          Jump Host *
                        </label>
                        <input
                          type="text"
                          placeholder="bastion.example.com"
                          value={form.jumpHost}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              jumpHost: e.target.value,
                            }))
                          }
                          className="w-full h-7 px-2 text-xs bg-background border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground font-medium">
                          Jump Port
                        </label>
                        <input
                          type="number"
                          value={form.jumpPort}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              jumpPort: Number.parseInt(e.target.value) || 22,
                            }))
                          }
                          className="w-full h-7 px-2 text-xs bg-background border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground font-medium">
                        Jump Username
                      </label>
                      <input
                        type="text"
                        placeholder={form.username || "same as target"}
                        value={form.jumpUsername}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            jumpUsername: e.target.value,
                          }))
                        }
                        className="w-full h-7 px-2 text-xs bg-background border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground font-medium">
                        Jump Auth
                      </label>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          className={`flex-1 h-6 text-[10px] rounded flex items-center justify-center gap-1 border ${form.jumpAuthMethod === "password" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              jumpAuthMethod: "password",
                            }))
                          }
                        >
                          <Lock className="h-2.5 w-2.5" /> Password
                        </button>
                        <button
                          type="button"
                          className={`flex-1 h-6 text-[10px] rounded flex items-center justify-center gap-1 border ${form.jumpAuthMethod === "key" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              jumpAuthMethod: "key",
                            }))
                          }
                        >
                          <Key className="h-2.5 w-2.5" /> Key
                        </button>
                      </div>
                    </div>
                    {form.jumpAuthMethod === "password" ? (
                      <input
                        type="password"
                        placeholder="Jump host password..."
                        value={form.jumpPassword}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            jumpPassword: e.target.value,
                          }))
                        }
                        className="w-full h-7 px-2 text-xs bg-background border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    ) : (
                      <textarea
                        placeholder="Jump host private key..."
                        value={form.jumpPrivateKey}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            jumpPrivateKey: e.target.value,
                          }))
                        }
                        rows={2}
                        className="w-full px-2 py-1 text-xs bg-background border rounded focus:outline-none focus:ring-1 focus:ring-primary font-mono resize-none"
                      />
                    )}
                  </div>
                )}

                {/* Environment Variables */}
                <div>
                  <label className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                    <Zap className="h-2.5 w-2.5" />
                    Environment Variables
                  </label>
                  <div className="space-y-1 mt-1">
                    {form.envVars.map((ev, i) => (
                      <div key={i} className="flex gap-1 items-center">
                        <input
                          type="text"
                          placeholder="KEY"
                          value={ev.key}
                          onChange={(e) =>
                            updateEnvVar(i, "key", e.target.value)
                          }
                          className="w-1/3 h-6 px-1.5 text-[10px] bg-background border rounded font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                        <span className="text-[10px] text-muted-foreground">
                          =
                        </span>
                        <input
                          type="text"
                          placeholder="value"
                          value={ev.value}
                          onChange={(e) =>
                            updateEnvVar(i, "value", e.target.value)
                          }
                          className="flex-1 h-6 px-1.5 text-[10px] bg-background border rounded font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                        <button
                          type="button"
                          onClick={() => removeEnvVar(i)}
                          className="h-6 w-6 flex items-center justify-center text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    ))}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={addEnvVar}
                      className="h-5 text-[10px] px-1.5"
                    >
                      <Plus className="h-2.5 w-2.5 mr-0.5" />
                      Add Variable
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Form actions */}
            <div className="flex gap-1 pt-1">
              <Button
                size="sm"
                variant="default"
                onClick={handleSave}
                className="h-7 text-xs flex-1"
              >
                Save Connection
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={resetForm}
                className="h-7 text-xs"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Connection List */}
        {savedConnections.length === 0 && !showAddForm && (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Globe className="h-8 w-8 mb-2 opacity-30" />
            <p className="text-xs">No remote connections</p>
            <p className="text-[10px] opacity-60 mb-3">
              Add a remote server to start developing
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowAddForm(true)}
              className="h-7 text-xs gap-1"
            >
              <Plus className="h-3 w-3" />
              Add Connection
            </Button>
          </div>
        )}

        {savedConnections.map((conn) => {
          const isActive = activeConnection?.id === conn.id && isConnected;
          const isTesting = testingId === conn.id;
          const isConnecting = connectingId === conn.id;
          const result =
            testResult && testResult.id === conn.id ? testResult : null;

          return (
            <div
              key={conn.id}
              className={`flex items-center gap-2 px-3 py-2 border-b hover:bg-muted/30 transition-colors ${isActive ? "bg-green-500/10 border-l-2 border-l-green-500" : ""}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  {isActive ? (
                    <Wifi className="h-3 w-3 text-green-500 shrink-0" />
                  ) : (
                    <WifiOff className="h-3 w-3 text-muted-foreground shrink-0" />
                  )}
                  <span className="text-xs font-medium truncate">
                    {conn.name || `${conn.username}@${conn.host}`}
                  </span>
                  {conn.jumpHost && (
                    <span className="px-1 py-0 text-[8px] rounded bg-yellow-500/20 text-yellow-600 font-medium">
                      via jump
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground ml-[18px] truncate">
                  {conn.username}@{conn.host}:{conn.port}
                  {conn.jumpHost && (
                    <span className="text-yellow-500/70">
                      {" "}
                      (via {conn.jumpHost.host})
                    </span>
                  )}
                </p>
                {result && (
                  <p
                    className={`text-[10px] ml-[18px] ${result.success ? "text-green-500" : "text-red-500"}`}
                  >
                    {result.message}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-0.5 shrink-0">
                {/* Test */}
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleTest(conn)}
                  disabled={isTesting}
                  className="h-6 w-6"
                  title="Test Connection"
                >
                  {isTesting ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : result?.success ? (
                    <Check className="h-3 w-3 text-green-500" />
                  ) : (
                    <TestTube className="h-3 w-3" />
                  )}
                </Button>

                {/* Connect/Disconnect */}
                {isActive ? (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => disconnect()}
                    className="h-6 text-[10px] px-2"
                  >
                    Disconnect
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => handleConnect(conn)}
                    disabled={isConnected || isConnecting}
                    className="h-6 text-[10px] px-2"
                  >
                    {isConnecting ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      "Connect"
                    )}
                  </Button>
                )}

                {/* Delete */}
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleDelete(conn.id)}
                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                  title="Remove"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
