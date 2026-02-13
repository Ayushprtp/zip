"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Folder,
  File,
  FileCode,
  FileJson,
  FileText,
  FileImage,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  FolderOpen,
  ArrowUp,
  Home,
  Plus,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRemoteDevStore } from "@/stores/remote-dev-store";
import type { RemoteFileInfo } from "@/types/builder/remote";

interface RemoteFileBrowserProps {
  onFileSelect?: (path: string) => void;
  onDirectoryChange?: (path: string) => void;
}

const FILE_ICONS: Record<string, typeof File> = {
  ts: FileCode,
  tsx: FileCode,
  js: FileCode,
  jsx: FileCode,
  py: FileCode,
  rb: FileCode,
  go: FileCode,
  rs: FileCode,
  json: FileJson,
  md: FileText,
  txt: FileText,
  yml: FileText,
  yaml: FileText,
  png: FileImage,
  jpg: FileImage,
  jpeg: FileImage,
  svg: FileImage,
  gif: FileImage,
  webp: FileImage,
};

function getFileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  return FILE_ICONS[ext] || File;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)}M`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}G`;
}

export function RemoteFileBrowser({
  onFileSelect,
  onDirectoryChange,
}: RemoteFileBrowserProps) {
  const {
    connectionStatus,
    workingDirectory,
    remoteFiles,
    listRemoteFiles,
    changeDirectory,
  } = useRemoteDevStore();

  const [loading, setLoading] = useState(false);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [subDirFiles, setSubDirFiles] = useState<
    Record<string, RemoteFileInfo[]>
  >({});
  const [showHidden, setShowHidden] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [newItemType, setNewItemType] = useState<"file" | "folder" | null>(
    null,
  );
  const [newItemName, setNewItemName] = useState("");

  const isConnected = connectionStatus === "connected";

  // Refresh files on mount and directory change
  useEffect(() => {
    if (isConnected) {
      refreshFiles();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workingDirectory, isConnected]);

  const refreshFiles = useCallback(async () => {
    setLoading(true);
    await listRemoteFiles(workingDirectory);
    setLoading(false);
  }, [listRemoteFiles, workingDirectory]);

  const handleNavigateUp = useCallback(async () => {
    const parent = workingDirectory.split("/").slice(0, -1).join("/") || "/";
    await changeDirectory(parent);
    onDirectoryChange?.(parent);
  }, [workingDirectory, changeDirectory, onDirectoryChange]);

  const handleNavigateHome = useCallback(async () => {
    await changeDirectory("~");
    onDirectoryChange?.("~");
  }, [changeDirectory, onDirectoryChange]);

  const handleToggleDir = useCallback(
    async (dirPath: string) => {
      const newExpanded = new Set(expandedDirs);
      if (newExpanded.has(dirPath)) {
        newExpanded.delete(dirPath);
      } else {
        newExpanded.add(dirPath);
        // Load sub-directory files
        if (!subDirFiles[dirPath]) {
          const files = await listRemoteFiles(dirPath);
          setSubDirFiles((prev) => ({ ...prev, [dirPath]: files }));
        }
      }
      setExpandedDirs(newExpanded);
    },
    [expandedDirs, subDirFiles, listRemoteFiles],
  );

  const handleFileClick = useCallback(
    (file: RemoteFileInfo) => {
      if (file.type === "directory") {
        handleToggleDir(file.path);
      } else {
        setSelectedFile(file.path);
        onFileSelect?.(file.path);
      }
    },
    [handleToggleDir, onFileSelect],
  );

  const handleDoubleClickDir = useCallback(
    async (dirPath: string) => {
      await changeDirectory(dirPath);
      onDirectoryChange?.(dirPath);
      setExpandedDirs(new Set());
      setSubDirFiles({});
    },
    [changeDirectory, onDirectoryChange],
  );

  const handleCreateItem = useCallback(async () => {
    if (!newItemName.trim() || !newItemType) return;

    const store = useRemoteDevStore.getState();
    const fullPath = `${workingDirectory}/${newItemName.trim()}`;

    if (newItemType === "folder") {
      await store.createRemoteDirectory(fullPath);
    } else {
      await store.writeRemoteFile(fullPath, "");
    }

    setNewItemType(null);
    setNewItemName("");
    await refreshFiles();
  }, [newItemName, newItemType, workingDirectory, refreshFiles]);

  const filteredFiles = showHidden
    ? remoteFiles
    : remoteFiles.filter((f) => !f.isHidden);

  // Sort: directories first, then alphabetical
  const sortedFiles = [...filteredFiles].sort((a, b) => {
    if (a.type === "directory" && b.type !== "directory") return -1;
    if (a.type !== "directory" && b.type === "directory") return 1;
    return a.name.localeCompare(b.name);
  });

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-muted-foreground">
        <Folder className="h-8 w-8 mb-2 opacity-30" />
        <p className="text-xs">Connect to a remote server to browse files</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full text-xs">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-1.5 py-1 border-b bg-muted/30 shrink-0">
        <Button
          size="icon"
          variant="ghost"
          onClick={handleNavigateUp}
          className="h-5 w-5"
          title="Go up"
        >
          <ArrowUp className="h-3 w-3" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={handleNavigateHome}
          className="h-5 w-5"
          title="Home directory"
        >
          <Home className="h-3 w-3" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={refreshFiles}
          disabled={loading}
          className="h-5 w-5"
          title="Refresh"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
        </Button>

        <div className="flex-1" />

        <Button
          size="icon"
          variant="ghost"
          onClick={() => setNewItemType("file")}
          className="h-5 w-5"
          title="New file"
        >
          <Plus className="h-3 w-3" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setNewItemType("folder")}
          className="h-5 w-5"
          title="New folder"
        >
          <FolderOpen className="h-3 w-3" />
        </Button>

        <button
          onClick={() => setShowHidden(!showHidden)}
          className={`px-1 h-5 text-[9px] rounded ${showHidden ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          title="Toggle hidden files"
        >
          .*
        </button>
      </div>

      {/* Current path */}
      <div className="px-2 py-1 border-b bg-muted/10 text-[10px] text-muted-foreground truncate shrink-0">
        {workingDirectory}
      </div>

      {/* New item form */}
      {newItemType && (
        <div className="px-2 py-1.5 border-b bg-muted/20 flex gap-1 shrink-0">
          <input
            type="text"
            placeholder={newItemType === "folder" ? "folder name" : "file name"}
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreateItem();
              if (e.key === "Escape") {
                setNewItemType(null);
                setNewItemName("");
              }
            }}
            className="flex-1 h-5 px-1.5 text-[10px] bg-background border rounded focus:outline-none focus:ring-1 focus:ring-primary"
            autoFocus
          />
          <Button
            size="sm"
            variant="ghost"
            onClick={handleCreateItem}
            className="h-5 text-[10px] px-1"
          >
            Create
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setNewItemType(null);
              setNewItemName("");
            }}
            className="h-5 text-[10px] px-1"
          >
            Cancel
          </Button>
        </div>
      )}

      {/* File list */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {loading && sortedFiles.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : sortedFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <FolderOpen className="h-6 w-6 mb-1 opacity-30" />
            <p className="text-[10px]">Empty directory</p>
          </div>
        ) : (
          <div className="py-0.5">
            {sortedFiles.map((file) => (
              <FileEntry
                key={file.path}
                file={file}
                isSelected={selectedFile === file.path}
                isExpanded={expandedDirs.has(file.path)}
                onClick={() => handleFileClick(file)}
                onDoubleClick={() => {
                  if (file.type === "directory") {
                    handleDoubleClickDir(file.path);
                  } else {
                    onFileSelect?.(file.path);
                  }
                }}
                depth={0}
                subFiles={subDirFiles[file.path]}
                expandedDirs={expandedDirs}
                selectedFile={selectedFile}
                onSubFileClick={(f) => handleFileClick(f)}
                onSubDirDoubleClick={(path) => handleDoubleClickDir(path)}
                onToggleSubDir={(path) => handleToggleDir(path)}
                subDirFiles={subDirFiles}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// File Entry Component
// ============================================================================

interface FileEntryProps {
  file: RemoteFileInfo;
  isSelected: boolean;
  isExpanded: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
  depth: number;
  subFiles?: RemoteFileInfo[];
  expandedDirs: Set<string>;
  selectedFile: string | null;
  onSubFileClick: (file: RemoteFileInfo) => void;
  onSubDirDoubleClick: (path: string) => void;
  onToggleSubDir: (path: string) => void;
  subDirFiles: Record<string, RemoteFileInfo[]>;
}

function FileEntry({
  file,
  isSelected,
  isExpanded,
  onClick,
  onDoubleClick,
  depth,
  subFiles,
  expandedDirs,
  selectedFile,
  onSubFileClick,
  onSubDirDoubleClick,
  onToggleSubDir,
  subDirFiles,
}: FileEntryProps) {
  const isDir = file.type === "directory";
  const Icon = isDir
    ? isExpanded
      ? FolderOpen
      : Folder
    : getFileIcon(file.name);
  const iconColor = isDir
    ? "text-yellow-500"
    : file.name.endsWith(".ts") || file.name.endsWith(".tsx")
      ? "text-blue-400"
      : file.name.endsWith(".py")
        ? "text-green-400"
        : "text-muted-foreground";

  return (
    <>
      <div
        className={`flex items-center gap-1 px-1 py-0.5 cursor-pointer hover:bg-muted/50 ${
          isSelected ? "bg-primary/10 text-primary" : ""
        }`}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        title={`${file.path} (${formatSize(file.size)})`}
      >
        {isDir ? (
          <span className="shrink-0 w-3 h-3 flex items-center justify-center">
            {isExpanded ? (
              <ChevronDown className="h-2.5 w-2.5" />
            ) : (
              <ChevronRight className="h-2.5 w-2.5" />
            )}
          </span>
        ) : (
          <span className="w-3 shrink-0" />
        )}
        <Icon className={`h-3.5 w-3.5 shrink-0 ${iconColor}`} />
        <span className="truncate text-[11px]">{file.name}</span>
        <span className="ml-auto text-[9px] text-muted-foreground shrink-0 pl-2">
          {!isDir && formatSize(file.size)}
        </span>
      </div>

      {/* Render sub-entries if directory is expanded */}
      {isDir && isExpanded && subFiles && (
        <div>
          {[...subFiles]
            .sort((a, b) => {
              if (a.type === "directory" && b.type !== "directory") return -1;
              if (a.type !== "directory" && b.type === "directory") return 1;
              return a.name.localeCompare(b.name);
            })
            .filter((f) => !f.isHidden)
            .map((subFile) => (
              <FileEntry
                key={subFile.path}
                file={subFile}
                isSelected={selectedFile === subFile.path}
                isExpanded={expandedDirs.has(subFile.path)}
                onClick={() => onSubFileClick(subFile)}
                onDoubleClick={() => {
                  if (subFile.type === "directory") {
                    onSubDirDoubleClick(subFile.path);
                  }
                }}
                depth={depth + 1}
                subFiles={subDirFiles[subFile.path]}
                expandedDirs={expandedDirs}
                selectedFile={selectedFile}
                onSubFileClick={onSubFileClick}
                onSubDirDoubleClick={onSubDirDoubleClick}
                onToggleSubDir={onToggleSubDir}
                subDirFiles={subDirFiles}
              />
            ))}
        </div>
      )}
    </>
  );
}
