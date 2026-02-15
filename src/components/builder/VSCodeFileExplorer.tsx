"use client";

import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { useSandpack } from "@codesandbox/sandpack-react";
import {
  ChevronDown,
  ChevronRight,
  Copy,
  FilePlus,
  FileText,
  FolderIcon,
  FolderOpenIcon,
  FolderPlus,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  onMoveFile,
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
  onMoveFile?: (sourcePath: string, targetFolderPath: string) => void;
  activeFile?: string;
  searchQuery?: string;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const [isDragOver, setIsDragOver] = useState(false);
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

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("text/plain", node.path);
    e.dataTransfer.setData("application/x-file-path", node.path);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (node.type !== "folder") return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only reset if we're leaving the actual element, not entering a child
    const relatedTarget = e.relatedTarget as Node;
    if (e.currentTarget.contains(relatedTarget)) return;
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (node.type !== "folder") return;
    const sourcePath = e.dataTransfer.getData("application/x-file-path");
    if (
      sourcePath &&
      sourcePath !== node.path &&
      !sourcePath.startsWith(node.path + "/")
    ) {
      onMoveFile?.(sourcePath, node.path);
    }
  };

  return (
    <div>
      <ContextMenu>
        <ContextMenuTrigger>
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                draggable
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`flex items-center gap-1 px-2 py-0.5 cursor-pointer text-xs group transition-colors ${
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-accent/50"
                } ${searchQuery && matchesSearch ? "bg-yellow-500/10" : ""} ${isDragOver ? "bg-violet-500/20 outline outline-1 outline-violet-400/50" : ""}`}
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
                onMoveFile={onMoveFile}
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

  // Dialog State
  const [dialogState, setDialogState] = useState<{
    isOpen: boolean;
    type: "createFile" | "createFolder" | "rename" | "delete" | null;
    path: string;
    defaultValue?: string;
  }>({
    isOpen: false,
    type: null,
    path: "",
  });
  const [inputValue, setInputValue] = useState("");

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

  const handleNewFile = useCallback((folderPath: string) => {
    setInputValue("");
    setDialogState({
      isOpen: true,
      type: "createFile",
      path: folderPath,
    });
  }, []);

  const handleNewFolder = useCallback((folderPath: string) => {
    setInputValue("");
    setDialogState({
      isOpen: true,
      type: "createFolder",
      path: folderPath,
    });
  }, []);

  const handleDelete = useCallback((path: string) => {
    setDialogState({
      isOpen: true,
      type: "delete",
      path: path,
    });
  }, []);

  const handleRename = useCallback((path: string) => {
    const parts = path.split("/");
    const oldName = parts.pop() || "";
    setInputValue(oldName);
    setDialogState({
      isOpen: true,
      type: "rename",
      path: path,
      defaultValue: oldName,
    });
  }, []);

  const handleDialogSubmit = () => {
    if (!dialogState.type) return;

    const { type, path } = dialogState;

    // For delete, we don't need input value
    if (type === "delete") {
      deleteFile(path);
      setDialogState({ isOpen: false, type: null, path: "" });
      return;
    }

    // For other types, require input value
    if (!inputValue.trim()) return;

    if (type === "createFile") {
      const newPath = path ? `${path}/${inputValue}` : `/${inputValue}`;
      addFile(newPath, "");
      openFile(newPath);
    } else if (type === "createFolder") {
      const newPath = path
        ? `${path}/${inputValue}/.gitkeep`
        : `/${inputValue}/.gitkeep`;
      addFile(newPath, "");
    } else if (type === "rename") {
      const parts = path.split("/");
      const oldName = parts.pop() || ""; // remove old name
      const dirPath = parts.join("/");

      if (inputValue !== oldName) {
        const newPath = `${dirPath}/${inputValue}`;
        const content =
          typeof files[path] === "string"
            ? (files[path] as string)
            : files[path]?.code || "";
        addFile(newPath, content);
        deleteFile(path);
        openFile(newPath);
      }
    }

    setDialogState({ isOpen: false, type: null, path: "" });
    setInputValue("");
  };

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

  // File Upload Handlers
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList) return;

    Array.from(fileList).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          // For folder uploads, webkitRelativePath might be available
          const relativePath = file.webkitRelativePath || file.name;
          // Ensure it doesn't start with slash if we append to root, but Sandpack expects /
          const path = relativePath.startsWith("/")
            ? relativePath
            : `/${relativePath}`;
          addFile(path, event.target.result as string);
        }
      };
      reader.readAsText(file);
    });

    // Reset inputs
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (folderInputRef.current) folderInputRef.current.value = "";
  };

  const handleRefresh = useCallback(() => {
    // Force re-render by toggling search
    setSearchQuery("");
  }, []);

  // Move file/folder via drag and drop
  const handleMoveFile = useCallback(
    (sourcePath: string, targetFolderPath: string) => {
      const sourceFileName = sourcePath.split("/").pop() || "";
      const newPath = `${targetFolderPath}/${sourceFileName}`;

      // Check if file/folder exists at old path
      const sourceFile = files[sourcePath];
      if (sourceFile) {
        // It's a single file
        const content =
          typeof sourceFile === "string" ? sourceFile : sourceFile.code || "";
        addFile(newPath, content);
        deleteFile(sourcePath);
        openFile(newPath);
      } else {
        // It might be a folder — move all children
        const filesToMove = Object.entries(files).filter(([path]) =>
          path.startsWith(sourcePath + "/"),
        );
        filesToMove.forEach(([oldPath, fileData]) => {
          const relativePath = oldPath.substring(sourcePath.length);
          const movedPath = `${targetFolderPath}/${sourceFileName}${relativePath}`;
          const content =
            typeof fileData === "string" ? fileData : fileData.code || "";
          addFile(movedPath, content);
          deleteFile(oldPath);
        });
      }
    },
    [files, addFile, deleteFile, openFile],
  );

  // Root-level drop handler
  const handleRootDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const sourcePath = e.dataTransfer.getData("application/x-file-path");
      if (sourcePath) {
        const fileName = sourcePath.split("/").pop() || "";
        const newPath = `/${fileName}`;
        if (newPath !== sourcePath) {
          const sourceFile = files[sourcePath];
          if (sourceFile) {
            const content =
              typeof sourceFile === "string"
                ? sourceFile
                : sourceFile.code || "";
            addFile(newPath, content);
            deleteFile(sourcePath);
          }
        }
      }
    },
    [files, addFile, deleteFile],
  );

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center justify-end px-2 py-1 border-b shrink-0 bg-muted/10">
        <span className="text-xs font-semibold uppercase text-muted-foreground mr-auto pl-2">
          Explorer
        </span>
        <div className="flex gap-0.5">
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={() => handleNewFile("")}
            title="New File"
          >
            <FilePlus className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={() => handleNewFolder("")}
            title="New Folder"
          >
            <FolderPlus className="h-3.5 w-3.5" />
          </Button>

          {/* Upload Dropdown Trigger using simple buttons for now or a combined menu */}
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={() => fileInputRef.current?.click()}
            title="Upload Files"
          >
            <Upload className="h-3.5 w-3.5" />
          </Button>

          {/* Hidden Inputs */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
            multiple
          />
          <input
            type="file"
            ref={folderInputRef}
            onChange={handleFileUpload}
            className="hidden"
            {...({ webkitdirectory: "", directory: "" } as any)}
          />

          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={() => setShowSearch(!showSearch)}
            title="Toggle Filter"
          >
            <Search className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={handleRefresh}
            title="Refresh"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Search Bar (Local Filter) */}
      {showSearch && (
        <div className="px-2 py-1.5 border-b shrink-0">
          <Input
            ref={searchInputRef}
            type="text"
            placeholder="Filter files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-7 text-xs bg-muted/50"
          />
        </div>
      )}

      {/* File Tree */}
      <div
        className="flex-1 overflow-auto"
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        }}
        onDrop={handleRootDrop}
      >
        {fileTree.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground text-xs p-4 text-center">
            <FolderOpenIcon className="h-8 w-8 mb-2 opacity-50" />
            <p>No files found</p>
          </div>
        ) : (
          fileTree
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
                onMoveFile={handleMoveFile}
                activeFile={activeFile}
                searchQuery={searchQuery || undefined}
              />
            ))
        )}
      </div>

      {/* File Stats Footer */}
      <div className="px-3 py-1.5 border-t text-[10px] text-muted-foreground/60 flex justify-between shrink-0 bg-muted/10">
        <span>{fileCount} files</span>
        <span>{formatSize(totalSize)}</span>
      </div>

      <Dialog
        open={dialogState.isOpen}
        onOpenChange={(open) => {
          if (!open) setDialogState((prev) => ({ ...prev, isOpen: false }));
        }}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {dialogState.type === "createFile" && (
                <>
                  <FilePlus className="h-5 w-5 text-blue-500" />
                  Create New File
                </>
              )}
              {dialogState.type === "createFolder" && (
                <>
                  <FolderPlus className="h-5 w-5 text-yellow-500" />
                  Create New Folder
                </>
              )}
              {dialogState.type === "rename" && (
                <>
                  <Pencil className="h-5 w-5 text-orange-500" />
                  Rename Item
                </>
              )}
              {dialogState.type === "delete" && (
                <>
                  <Trash2 className="h-5 w-5 text-red-500" />
                  Delete Item
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {dialogState.type === "createFile" &&
                `Create a new file in ${dialogState.path || "root"}`}
              {dialogState.type === "createFolder" &&
                `Create a new folder in ${dialogState.path || "root"}`}
              {dialogState.type === "rename" &&
                `Enter a new name for this item`}
              {dialogState.type === "delete" &&
                `Are you sure you want to delete "${dialogState.path}"? This action cannot be undone.`}
            </DialogDescription>
          </DialogHeader>

          {dialogState.type !== "delete" && (
            <div className="grid gap-4 py-4">
              <Input
                id="name"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={
                  dialogState.type === "createFile"
                    ? "filename.ts"
                    : dialogState.type === "createFolder"
                      ? "folder-name"
                      : "new-name"
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleDialogSubmit();
                }}
                className="col-span-3"
                autoFocus
              />
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setDialogState((prev) => ({ ...prev, isOpen: false }))
              }
            >
              Cancel
            </Button>
            <Button
              variant={
                dialogState.type === "delete" ? "destructive" : "default"
              }
              onClick={handleDialogSubmit}
            >
              {dialogState.type === "delete" ? "Delete" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
