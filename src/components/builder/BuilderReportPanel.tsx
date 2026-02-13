"use client";

import { useState, useEffect, useRef } from "react";
import { useSandpack } from "@codesandbox/sandpack-react";
import { useProject } from "@/lib/builder/project-context";
import { useBuilderUIStore } from "@/stores/builder-ui-store";
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Info,
  Wifi,
  WifiOff,
  HardDrive,
  Clock,
  FileCode,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ReportEntry {
  id: number;
  type: "error" | "warning" | "info" | "success";
  source: "build" | "runtime" | "network" | "system";
  message: string;
  detail?: string;
  timestamp: number;
  file?: string;
  line?: number;
}

interface BuilderReportPanelProps {
  onClose?: () => void;
}

export function BuilderReportPanel({ onClose }: BuilderReportPanelProps) {
  const { listen } = useSandpack();
  const { state } = useProject();
  const serverStatus = useBuilderUIStore((s) => s.serverStatus);
  const [reports, setReports] = useState<ReportEntry[]>([]);
  const [filter, setFilter] = useState<"all" | "error" | "warning" | "info">(
    "all",
  );
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const reportIdRef = useRef(0);
  const listenRef = useRef(listen);
  listenRef.current = listen;

  // Listen for Sandpack errors and messages
  useEffect(() => {
    const unsubscribe = listenRef.current((msg: any) => {
      if (msg.type === "action" && msg.action === "show-error") {
        const id = reportIdRef.current++;
        setReports((prev) => [
          {
            id,
            type: "error",
            source: "build",
            message: msg.title || "Build Error",
            detail: msg.message || msg.stack,
            timestamp: Date.now(),
            file: msg.path,
            line: msg.line,
          },
          ...prev,
        ]);
      }

      if (msg.type === "console" && msg.log) {
        for (const log of msg.log) {
          if (log.method === "error" || log.method === "warn") {
            const id = reportIdRef.current++;
            setReports((prev) => [
              {
                id,
                type: log.method === "error" ? "error" : "warning",
                source: "runtime",
                message:
                  typeof log.data?.[0] === "string"
                    ? log.data[0]
                    : "Runtime " + log.method,
                detail: log.data?.slice(1).join(" "),
                timestamp: Date.now(),
              },
              ...prev,
            ]);
          }
        }
      }

      if (msg.type === "status" && msg.status === "transpiling-error") {
        const id = reportIdRef.current++;
        setReports((prev) => [
          {
            id,
            type: "error",
            source: "build",
            message: "Transpilation Error",
            detail: msg.message,
            timestamp: Date.now(),
          },
          ...prev,
        ]);
      }

      // Successful compile
      if (msg.type === "done") {
        const id = reportIdRef.current++;
        setReports((prev) => [
          {
            id,
            type: "success",
            source: "build",
            message: "Build completed successfully",
            timestamp: Date.now(),
          },
          ...prev,
        ]);
      }
    });

    return () => unsubscribe();
  }, []);

  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearReports = () => setReports([]);

  const filteredReports =
    filter === "all" ? reports : reports.filter((r) => r.type === filter);

  const errorCount = reports.filter((r) => r.type === "error").length;
  const warningCount = reports.filter((r) => r.type === "warning").length;
  const infoCount = reports.filter(
    (r) => r.type === "info" || r.type === "success",
  ).length;

  const getIcon = (type: ReportEntry["type"]) => {
    switch (type) {
      case "error":
        return <XCircle className="h-3 w-3 text-red-500 shrink-0" />;
      case "warning":
        return <AlertTriangle className="h-3 w-3 text-yellow-500 shrink-0" />;
      case "info":
        return <Info className="h-3 w-3 text-blue-500 shrink-0" />;
      case "success":
        return <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />;
    }
  };

  const getSourceLabel = (source: ReportEntry["source"]) => {
    switch (source) {
      case "build":
        return "Build";
      case "runtime":
        return "Runtime";
      case "network":
        return "Network";
      case "system":
        return "System";
    }
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  return (
    <div className="flex flex-col h-full bg-background text-xs">
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-1 border-b shrink-0">
        <span className="text-[10px] font-semibold uppercase text-muted-foreground">
          Report & Status
        </span>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-5 w-5"
            onClick={clearReports}
            title="Clear Reports"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
          {onClose && (
            <Button
              size="icon"
              variant="ghost"
              className="h-5 w-5"
              onClick={onClose}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Connection Status */}
      <div className="px-2 py-1.5 border-b space-y-1 shrink-0">
        <div className="flex items-center gap-2">
          {serverStatus === "running" ? (
            <Wifi className="h-3 w-3 text-green-500" />
          ) : serverStatus === "booting" ? (
            <RefreshCw className="h-3 w-3 text-yellow-500 animate-spin" />
          ) : (
            <WifiOff className="h-3 w-3 text-red-500" />
          )}
          <span className="font-medium">Sandbox</span>
          <Badge
            variant={
              serverStatus === "running"
                ? "default"
                : serverStatus === "booting"
                  ? "secondary"
                  : "destructive"
            }
            className="h-4 px-1 text-[9px]"
          >
            {serverStatus}
          </Badge>
        </div>
        <div className="flex items-center gap-4 text-muted-foreground">
          <span className="flex items-center gap-1">
            <FileCode className="h-3 w-3" />
            {Object.keys(state.files).length} files
          </span>
          <span className="flex items-center gap-1">
            <HardDrive className="h-3 w-3" />
            {(
              Object.values(state.files).reduce((s, c) => s + c.length, 0) /
              1024
            ).toFixed(1)}{" "}
            KB
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {state.template || "–"}
          </span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-0.5 px-1 py-0.5 border-b shrink-0">
        <Button
          size="sm"
          variant={filter === "all" ? "secondary" : "ghost"}
          onClick={() => setFilter("all")}
          className="h-5 px-1.5 text-[10px] gap-1"
        >
          All
          <Badge variant="outline" className="h-3.5 px-1 text-[9px]">
            {reports.length}
          </Badge>
        </Button>
        <Button
          size="sm"
          variant={filter === "error" ? "secondary" : "ghost"}
          onClick={() => setFilter("error")}
          className="h-5 px-1.5 text-[10px] gap-1"
        >
          <XCircle className="h-2.5 w-2.5 text-red-500" />
          {errorCount}
        </Button>
        <Button
          size="sm"
          variant={filter === "warning" ? "secondary" : "ghost"}
          onClick={() => setFilter("warning")}
          className="h-5 px-1.5 text-[10px] gap-1"
        >
          <AlertTriangle className="h-2.5 w-2.5 text-yellow-500" />
          {warningCount}
        </Button>
        <Button
          size="sm"
          variant={filter === "info" ? "secondary" : "ghost"}
          onClick={() => setFilter("info")}
          className="h-5 px-1.5 text-[10px] gap-1"
        >
          <Info className="h-2.5 w-2.5 text-blue-500" />
          {infoCount}
        </Button>
      </div>

      {/* Report List */}
      <div className="flex-1 overflow-auto min-h-0">
        {filteredReports.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground/50">
            <div className="text-center">
              <CheckCircle2 className="h-6 w-6 mx-auto mb-1 opacity-50" />
              <p className="text-[10px]">No reports</p>
            </div>
          </div>
        ) : (
          filteredReports.map((report) => (
            <div
              key={report.id}
              className="border-b last:border-0 hover:bg-muted/30 transition-colors"
            >
              <div
                className="flex items-start gap-1.5 px-2 py-1 cursor-pointer"
                onClick={() => report.detail && toggleExpand(report.id)}
              >
                {report.detail && (
                  <span className="shrink-0 mt-0.5">
                    {expandedIds.has(report.id) ? (
                      <ChevronDown className="h-2.5 w-2.5" />
                    ) : (
                      <ChevronRight className="h-2.5 w-2.5" />
                    )}
                  </span>
                )}
                {getIcon(report.type)}
                <div className="flex-1 min-w-0">
                  <p className="truncate">{report.message}</p>
                  <div className="flex items-center gap-2 text-[9px] text-muted-foreground/60">
                    <span>{getSourceLabel(report.source)}</span>
                    {report.file && (
                      <span className="font-mono">
                        {report.file}
                        {report.line ? `:${report.line}` : ""}
                      </span>
                    )}
                    <span>{formatTime(report.timestamp)}</span>
                  </div>
                </div>
              </div>
              {report.detail && expandedIds.has(report.id) && (
                <div className="px-6 pb-1.5">
                  <pre className="text-[10px] text-muted-foreground font-mono whitespace-pre-wrap break-all bg-muted/30 rounded p-1.5 max-h-32 overflow-auto">
                    {report.detail}
                  </pre>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
