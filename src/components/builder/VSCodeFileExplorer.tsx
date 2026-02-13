"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useSandpack } from "@codesandbox/sandpack-react";
import {
  FolderIcon,
  FolderOpenIcon,
  FilePlus,
  FolderPlus,
  Trash2,
  ChevronRight,
  ChevronDown,
  Search,
  Pencil,
  Copy,
  FileText,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface FileNode {
  name: string;
  path: string;
  type: "file" | "folder";
  children?: FileNode[];
  size?: number;
}

function getFileIcon(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase();
  const iconMap: Record<string, string> = {
    js: "📄",
    jsx: "⚛️",
    ts: "🔷",
    tsx: "⚛️",
    json: "📋",
    html: "🌐",
    css: "🎨",
    scss: "🎨",
    md: "📝",
    txt: "📄",
    png: "🖼️",
    jpg: "🖼️",
    svg: "🎭",
    gif: "🖼️",
    yaml: "⚙️",
    yml: "⚙️",
    env: "🔒",
    gitignore: "🔒",
    lock: "🔒",
    sh: "💻",
    py: "🐍",
  };
  return iconMap[ext || ""] || "📄";
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function buildFileTree(files: Record<string, string>): FileNode[] {
  const root: FileNode[] = [];
  const folders = new Map<string, FileNode>();

  Object.keys(files).forEach((path) => {
    const parts = path.replace(/^\//, "").split("/");
    let currentLevel = root;
    let currentPath = "";

    parts.forEach((part, index) => {
      currentPath += (currentPath ? "/" : "") + part;
      const isFile = index === parts.length - 1;

      if (isFile) {
        currentLevel.push({
          name: part,
          path: "/" + currentPath,
          type: "file",
          size: files[path]?.length || 0,
        });
      } else {
        let folder = folders.get(currentPath);
        if (!folder) {
          folder = {
            name: part,
            path: "/" + currentPath,
            type: "folder",
            children: [],
          };
          folders.set(currentPath, folder);
          currentLevel.push(folder);
        }
        currentLevel = folder.children!;
      }
    });
  });

  return root;
}

function FileTreeItem({
  node,
  level = 0,
  onFileClick,
  onNewFile,
  onNewFolder,
  onDelete,
  onRename,
  onCopyPath,
  onDuplicate,
  activeFile,
  searchQuery,
}: {
  node: FileNode;
  level?: number;
  onFileClick: (path: string) => void;
  onNewFile: (folderPath: string) => void;
  onNewFolder: (folderPath: string) => void;
  onDelete: (path: string) => void;
  onRename: (path: string) => void;
  onCopyPath: (path: string) => void;
  onDuplicate: (path: string) => void;
  activeFile?: string;
  searchQuery?: string;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const isActive = activeFile === node.path;

  // If searching and this item doesn't match, check children
  const matchesSearch = searchQuery
    ? node.name.toLowerCase().includes(searchQuery.toLowerCase())
    : true;

  const childrenMatch = searchQuery
    ? node.children?.some(
        (child) =>
          child.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (child.type === "folder" &&
            child.children?.some((gc) =>
              gc.name.toLowerCase().includes(searchQuery.toLowerCase()),
            )),
      )
    : false;

  if (searchQuery && !matchesSearch && !childrenMatch && node.type === "file") {
    return null;
  }

  const handleClick = () => {
    if (node.type === "folder") {
      setIsOpen(!isOpen);
    } else {
      onFileClick(node.path);
    }
  };

  return (
    <div>
      <ContextMenu>
        <ContextMenuTrigger>
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className={`flex items-center gap-1 px-2 py-0.5 cursor-pointer text-xs group transition-colors ${
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-accent/50"
                } ${searchQuery && matchesSearch ? "bg-yellow-500/10" : ""}`}
                style={{ paddingLeft: `${level * 12 + 8}px` }}
                onClick={handleClick}
              >
                {node.type === "folder" && (
                  <span className="shrink-0">
                    {isOpen ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                  </span>
                )}
                {node.type === "folder" ? (
                  isOpen ? (
                    <FolderOpenIcon className="h-3 w-3 shrink-0 text-blue-400" />
                  ) : (
                    <FolderIcon className="h-3 w-3 shrink-0 text-blue-400" />
                  )
                ) : (
                  <span className="shrink-0">{getFileIcon(node.name)}</span>
                )}
                <span className="truncate flex-1">{node.name}</span>
                {node.type === "file" && node.size !== undefined && (
                  <span className="text-[9px] text-muted-foreground/60 opacity-0 group-hover:opacity-100 shrink-0">
                    {formatSize(node.size)}
                  </span>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">
              <p className="font-mono">{node.path}</p>
              {node.type === "file" && node.size !== undefined && (
                <p className="text-muted-foreground">{formatSize(node.size)}</p>
              )}
            </TooltipContent>
          </Tooltip>
        </ContextMenuTrigger>
        <ContextMenuContent>
          {node.type === "folder" && (
            <>
              <ContextMenuItem onClick={() => onNewFile(node.path)}>
                <FilePlus className="h-3 w-3 mr-2" />
                New File
              </ContextMenuItem>
              <ContextMenuItem onClick={() => onNewFolder(node.path)}>
                <FolderPlus className="h-3 w-3 mr-2" />
                New Folder
              </ContextMenuItem>
              <ContextMenuSeparator />
            </>
          )}
          <ContextMenuItem onClick={() => onRename(node.path)}>
            <Pencil className="h-3 w-3 mr-2" />
            Rename
          </ContextMenuItem>
          {node.type === "file" && (
            <ContextMenuItem onClick={() => onDuplicate(node.path)}>
              <Copy className="h-3 w-3 mr-2" />
              Duplicate
            </ContextMenuItem>
          )}
          <ContextMenuItem onClick={() => onCopyPath(node.path)}>
            <FileText className="h-3 w-3 mr-2" />
            Copy Path
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={() => onDelete(node.path)}
            className="text-destructive"
          >
            <Trash2 className="h-3 w-3 mr-2" />
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {node.type === "folder" && isOpen && node.children && (
        <div>
          {[...node.children]
            .sort((a, b) => {
              // Folders first, then files, alphabetically
              if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
              return a.name.localeCompare(b.name);
            })
            .map((child) => (
              <FileTreeItem
                key={child.path}
                node={child}
                level={level + 1}
                onFileClick={onFileClick}
                onNewFile={onNewFile}
                onNewFolder={onNewFolder}
                onDelete={onDelete}
                onRename={onRename}
                onCopyPath={onCopyPath}
                onDuplicate={onDuplicate}
                activeFile={activeFile}
                searchQuery={searchQuery}
              />
            ))}
        </div>
      )}
    </div>
  );
}

export function VSCodeFileExplorer() {
  const { sandpack } = useSandpack();
  const { files, openFile, deleteFile, addFile, activeFile } = sandpack;
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Focus search input when opened
  useEffect(() => {
    if (showSearch && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showSearch]);

  // Convert SandpackBundlerFiles to Record<string, string>
  const fileEntries = useMemo(
    () =>
      Object.entries(files).reduce(
        (acc, [path, file]) => {
          acc[path] = typeof file === "string" ? file : file.code;
          return acc;
        },
        {} as Record<string, string>,
      ),
    [files],
  );

  const fileTree = useMemo(() => buildFileTree(fileEntries), [fileEntries]);

  const fileCount = Object.keys(fileEntries).length;
  const totalSize = useMemo(
    () =>
      Object.values(fileEntries).reduce(
        (sum, content) => sum + content.length,
        0,
      ),
    [fileEntries],
  );

  const handleNewFile = useCallback(
    (folderPath: string) => {
      const fileName = prompt("Enter file name:");
      if (fileName) {
        const newPath = folderPath
          ? `${folderPath}/${fileName}`
          : `/${fileName}`;
        addFile(newPath, "");
        openFile(newPath);
      }
    },
    [addFile, openFile],
  );

  const handleNewFolder = useCallback(
    (folderPath: string) => {
      const folderName = prompt("Enter folder name:");
      if (folderName) {
        const newPath = folderPath
          ? `${folderPath}/${folderName}/.gitkeep`
          : `/${folderName}/.gitkeep`;
        addFile(newPath, "");
      }
    },
    [addFile],
  );

  const handleDelete = useCallback(
    (path: string) => {
      if (confirm(`Delete ${path}?`)) {
        deleteFile(path);
      }
    },
    [deleteFile],
  );

  const handleRename = useCallback(
    (path: string) => {
      const parts = path.split("/");
      const oldName = parts.pop() || "";
      const dirPath = parts.join("/");
      const newName = prompt("Enter new name:", oldName);
      if (newName && newName !== oldName) {
        const newPath = `${dirPath}/${newName}`;
        const content =
          typeof files[path] === "string"
            ? (files[path] as string)
            : files[path]?.code || "";
        addFile(newPath, content);
        deleteFile(path);
        openFile(newPath);
      }
    },
    [files, addFile, deleteFile, openFile],
  );

  const handleCopyPath = useCallback((path: string) => {
    navigator.clipboard.writeText(path).catch(() => {});
  }, []);

  const handleDuplicate = useCallback(
    (path: string) => {
      const parts = path.split(".");
      const ext = parts.length > 1 ? "." + parts.pop() : "";
      const basePath = parts.join(".");
      const newPath = `${basePath}-copy${ext}`;
      const content =
        typeof files[path] === "string"
          ? (files[path] as string)
          : files[path]?.code || "";
      addFile(newPath, content);
      openFile(newPath);
    },
    [files, addFile, openFile],
  );

  const handleRefresh = useCallback(() => {
    // Force re-render by toggling search
    setSearchQuery("");
  }, []);

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center justify-between px-2 py-1 border-b shrink-0">
        <span className="text-[10px] font-semibold uppercase text-muted-foreground">
          Explorer
        </span>
        <div className="flex gap-0.5">
          <Button
            size="icon"
            variant="ghost"
            className="h-5 w-5"
            onClick={() => setShowSearch(!showSearch)}
            title="Search Files"
          >
            <Search className="h-3 w-3" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-5 w-5"
            onClick={() => handleNewFile("")}
            title="New File"
          >
            <FilePlus className="h-3 w-3" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-5 w-5"
            onClick={() => handleNewFolder("")}
            title="New Folder"
          >
            <FolderPlus className="h-3 w-3" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-5 w-5"
            onClick={handleRefresh}
            title="Refresh"
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      {showSearch && (
        <div className="px-1.5 py-1 border-b shrink-0">
          <Input
            ref={searchInputRef}
            type="text"
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-6 text-xs bg-muted/50"
          />
        </div>
      )}

      {/* File Tree */}
      <div className="flex-1 overflow-auto">
        {fileTree
          .sort((a, b) => {
            if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
            return a.name.localeCompare(b.name);
          })
          .map((node) => (
            <FileTreeItem
              key={node.path}
              node={node}
              onFileClick={openFile}
              onNewFile={handleNewFile}
              onNewFolder={handleNewFolder}
              onDelete={handleDelete}
              onRename={handleRename}
              onCopyPath={handleCopyPath}
              onDuplicate={handleDuplicate}
              activeFile={activeFile}
              searchQuery={searchQuery || undefined}
            />
          ))}
      </div>

      {/* File Stats Footer */}
      <div className="px-2 py-1 border-t text-[9px] text-muted-foreground/60 flex justify-between shrink-0">
        <span>{fileCount} files</span>
        <span>{formatSize(totalSize)}</span>
      </div>
    </div>
  );
}
