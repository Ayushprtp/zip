"use client";

import { useState } from "react";
import { useSandpack } from "@codesandbox/sandpack-react";
import {
  FolderIcon,
  FolderOpenIcon,
  FilePlus,
  FolderPlus,
  Trash2,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

interface FileNode {
  name: string;
  path: string;
  type: "file" | "folder";
  children?: FileNode[];
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
  };
  return iconMap[ext || ""] || "📄";
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
}: {
  node: FileNode;
  level?: number;
  onFileClick: (path: string) => void;
  onNewFile: (folderPath: string) => void;
  onNewFolder: (folderPath: string) => void;
  onDelete: (path: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(true);

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
          <div
            className="flex items-center gap-1 px-2 py-1 hover:bg-accent/50 cursor-pointer text-xs group"
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
          </div>
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
            </>
          )}
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
          {node.children.map((child) => (
            <FileTreeItem
              key={child.path}
              node={child}
              level={level + 1}
              onFileClick={onFileClick}
              onNewFile={onNewFile}
              onNewFolder={onNewFolder}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function VSCodeFileExplorer() {
  const { sandpack } = useSandpack();
  const { files, openFile, deleteFile, addFile } = sandpack;

  // Convert SandpackBundlerFiles to Record<string, string>
  const fileEntries = Object.entries(files).reduce(
    (acc, [path, file]) => {
      acc[path] = typeof file === "string" ? file : file.code;
      return acc;
    },
    {} as Record<string, string>,
  );

  const fileTree = buildFileTree(fileEntries);

  const handleNewFile = (folderPath: string) => {
    const fileName = prompt("Enter file name:");
    if (fileName) {
      const newPath = `${folderPath}/${fileName}`;
      addFile(newPath, "");
      openFile(newPath);
    }
  };

  const handleNewFolder = (folderPath: string) => {
    const folderName = prompt("Enter folder name:");
    if (folderName) {
      const newPath = `${folderPath}/${folderName}/.gitkeep`;
      addFile(newPath, "");
    }
  };

  const handleDelete = (path: string) => {
    if (confirm(`Delete ${path}?`)) {
      deleteFile(path);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center justify-between px-2 py-1.5 border-b shrink-0">
        <span className="text-xs font-semibold uppercase text-muted-foreground">
          Explorer
        </span>
        <div className="flex gap-1">
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
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        {fileTree.map((node) => (
          <FileTreeItem
            key={node.path}
            node={node}
            onFileClick={openFile}
            onNewFile={handleNewFile}
            onNewFolder={handleNewFolder}
            onDelete={handleDelete}
          />
        ))}
      </div>
    </div>
  );
}
