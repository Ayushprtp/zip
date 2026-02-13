"use client";

import { useState, useCallback } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export interface SSHConnection {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authMethod: "password" | "key";
  password?: string;
  privateKey?: string;
}

interface SSHConnectionManagerProps {
  connections: SSHConnection[];
  activeSessionId: string | null;
  activeConnectionId: string | null;
  onConnect: (connection: SSHConnection) => void;
  onDisconnect: () => void;
  onSaveConnections: (connections: SSHConnection[]) => void;
  onClose?: () => void;
}

export function SSHConnectionManager({
  connections,
  activeSessionId,
  activeConnectionId,
  onConnect,
  onDisconnect,
  onSaveConnections,
  onClose,
}: SSHConnectionManagerProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    id: string;
    success: boolean;
    message: string;
  } | null>(null);
  const [editForm, setEditForm] = useState<SSHConnection>({
    id: "",
    name: "",
    host: "",
    port: 22,
    username: "",
    authMethod: "password",
    password: "",
    privateKey: "",
  });

  const resetForm = useCallback(() => {
    setEditForm({
      id: "",
      name: "",
      host: "",
      port: 22,
      username: "",
      authMethod: "password",
      password: "",
      privateKey: "",
    });
    setShowAddForm(false);
  }, []);

  const handleSave = useCallback(() => {
    if (!editForm.host || !editForm.username) {
      toast.error("Host and username are required");
      return;
    }

    const newConnection: SSHConnection = {
      ...editForm,
      id: editForm.id || `ssh_${Date.now()}`,
      name: editForm.name || `${editForm.username}@${editForm.host}`,
    };

    const updated = editForm.id
      ? connections.map((c) => (c.id === editForm.id ? newConnection : c))
      : [...connections, newConnection];

    onSaveConnections(updated);
    resetForm();
    toast.success(editForm.id ? "Connection updated" : "Connection saved");
  }, [editForm, connections, onSaveConnections, resetForm]);

  const handleDelete = useCallback(
    (id: string) => {
      if (activeConnectionId === id) {
        onDisconnect();
      }
      onSaveConnections(connections.filter((c) => c.id !== id));
      toast.success("Connection removed");
    },
    [connections, activeConnectionId, onDisconnect, onSaveConnections],
  );

  const handleTest = useCallback(async (connection: SSHConnection) => {
    setTestingId(connection.id);
    setTestResult(null);

    try {
      const res = await fetch("/api/builder/ssh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test",
          host: connection.host,
          port: connection.port,
          username: connection.username,
          password:
            connection.authMethod === "password"
              ? connection.password
              : undefined,
          privateKey:
            connection.authMethod === "key" ? connection.privateKey : undefined,
        }),
      });

      const data = await res.json();
      setTestResult({
        id: connection.id,
        success: data.success,
        message: data.success
          ? "Connection successful!"
          : data.error || "Connection failed",
      });
    } catch (err: any) {
      setTestResult({
        id: connection.id,
        success: false,
        message: err.message || "Test failed",
      });
    } finally {
      setTestingId(null);
    }
  }, []);

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <Globe className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold uppercase text-muted-foreground">
            SSH Connections
          </span>
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
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-muted-foreground font-medium">
                  Name (optional)
                </label>
                <input
                  type="text"
                  placeholder="My Server"
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, name: e.target.value }))
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
                  value={editForm.port}
                  onChange={(e) =>
                    setEditForm((f) => ({
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
                  value={editForm.host}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, host: e.target.value }))
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
                  value={editForm.username}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, username: e.target.value }))
                  }
                  className="w-full h-7 pl-7 pr-2 text-xs bg-background border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] text-muted-foreground font-medium">
                Auth Method
              </label>
              <div className="flex gap-1">
                <button
                  type="button"
                  className={`flex-1 h-7 text-xs rounded flex items-center justify-center gap-1 border ${editForm.authMethod === "password" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
                  onClick={() =>
                    setEditForm((f) => ({ ...f, authMethod: "password" }))
                  }
                >
                  <Lock className="h-3 w-3" /> Password
                </button>
                <button
                  type="button"
                  className={`flex-1 h-7 text-xs rounded flex items-center justify-center gap-1 border ${editForm.authMethod === "key" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
                  onClick={() =>
                    setEditForm((f) => ({ ...f, authMethod: "key" }))
                  }
                >
                  <Key className="h-3 w-3" /> Private Key
                </button>
              </div>
            </div>

            {editForm.authMethod === "password" ? (
              <div>
                <label className="text-[10px] text-muted-foreground font-medium">
                  Password
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={editForm.password || ""}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, password: e.target.value }))
                  }
                  className="w-full h-7 px-2 text-xs bg-background border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            ) : (
              <div>
                <label className="text-[10px] text-muted-foreground font-medium">
                  Private Key (PEM)
                </label>
                <textarea
                  placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
                  value={editForm.privateKey || ""}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      privateKey: e.target.value,
                    }))
                  }
                  rows={3}
                  className="w-full px-2 py-1 text-xs bg-background border rounded focus:outline-none focus:ring-1 focus:ring-primary font-mono resize-none"
                />
              </div>
            )}

            <div className="flex gap-1 pt-1">
              <Button
                size="sm"
                variant="default"
                onClick={handleSave}
                className="h-7 text-xs flex-1"
              >
                Save
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
        {connections.length === 0 && !showAddForm && (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Globe className="h-8 w-8 mb-2 opacity-30" />
            <p className="text-xs">No SSH connections</p>
            <p className="text-[10px] opacity-60">
              Click + to add a remote server
            </p>
          </div>
        )}

        {connections.map((conn) => {
          const isActive = activeConnectionId === conn.id;
          const isTesting = testingId === conn.id;
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
                </div>
                <p className="text-[10px] text-muted-foreground ml-[18px] truncate">
                  {conn.username}@{conn.host}:{conn.port}
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
                {/* Test button */}
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
                    onClick={onDisconnect}
                    className="h-6 text-[10px] px-2"
                  >
                    Disconnect
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => onConnect(conn)}
                    disabled={!!activeSessionId}
                    className="h-6 text-[10px] px-2"
                  >
                    Connect
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
