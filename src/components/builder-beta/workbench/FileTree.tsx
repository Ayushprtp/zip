"use client";

import { memo, useMemo } from "react";
import { useStore } from "@nanostores/react";
import {
  ChevronRight,
  File,
  Folder,
  FolderOpen,
} from "lucide-react";
import type { FileMap } from "@/lib/builder-beta/stores/files";

interface FileTreeProps {
  files: FileMap;
  selectedFile?: string;
  onFileSelect: (filePath: string) => void;
  unsavedFiles?: Set<string>;
  className?: string;
}

interface TreeNode {
  name: string;
  fullPath: string;
  type: "file" | "folder";
  children: TreeNode[];
}

function buildTree(files: FileMap): TreeNode[] {
  const root: TreeNode[] = [];
  const folderMap = new Map<string, TreeNode>();

  const sortedPaths = Object.keys(files).sort();

  for (const path of sortedPaths) {
    const dirent = files[path];
    if (!dirent) continue;

    const segments = path.split("/").filter(Boolean);
    const name = segments[segments.length - 1];

    if (dirent.type === "folder") {
      const node: TreeNode = {
        name,
        fullPath: path,
        type: "folder",
        children: [],
      };
      folderMap.set(path, node);

      // Find parent
      const parentPath = segments.slice(0, -1).join("/") + "/";
      const parent = folderMap.get(parentPath);
      if (parent) {
        parent.children.push(node);
      } else {
        root.push(node);
      }
    } else {
      const node: TreeNode = {
        name,
        fullPath: path,
        type: "file",
        children: [],
      };

      const parentPath = segments.slice(0, -1).join("/") + "/";
      const parent = folderMap.get(parentPath);
      if (parent) {
        parent.children.push(node);
      } else {
        root.push(node);
      }
    }
  }

  return root;
}

function TreeItem({
  node,
  selectedFile,
  onFileSelect,
  unsavedFiles,
  depth = 0,
}: {
  node: TreeNode;
  selectedFile?: string;
  onFileSelect: (path: string) => void;
  unsavedFiles?: Set<string>;
  depth?: number;
}) {
  const isSelected = node.fullPath === selectedFile;
  const isUnsaved = unsavedFiles?.has(node.fullPath);

  if (node.type === "file") {
    return (
      <button
        onClick={() => onFileSelect(node.fullPath)}
        className={`flex items-center gap-1.5 w-full px-2 py-1 text-xs rounded-md transition-colors ${
          isSelected
            ? "bg-violet-500/20 text-violet-300"
            : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/30"
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        <File className="w-3.5 h-3.5 shrink-0 text-zinc-500" />
        <span className="truncate">{node.name}</span>
        {isUnsaved && (
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 ml-auto" />
        )}
      </button>
    );
  }

  return (
    <details className="group" open>
      <summary
        className="flex items-center gap-1.5 w-full px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/30 rounded-md cursor-pointer select-none transition-colors list-none"
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        <ChevronRight className="w-3 h-3 shrink-0 transition-transform group-open:rotate-90" />
        <FolderOpen className="w-3.5 h-3.5 shrink-0 text-violet-400 hidden group-open:block" />
        <Folder className="w-3.5 h-3.5 shrink-0 text-violet-400 group-open:hidden" />
        <span className="truncate font-medium">{node.name}</span>
      </summary>
      <div>
        {node.children.map((child) => (
          <TreeItem
            key={child.fullPath}
            node={child}
            selectedFile={selectedFile}
            onFileSelect={onFileSelect}
            unsavedFiles={unsavedFiles}
            depth={depth + 1}
          />
        ))}
      </div>
    </details>
  );
}

export const FileTree = memo(
  ({
    files,
    selectedFile,
    onFileSelect,
    unsavedFiles,
    className,
  }: FileTreeProps) => {
    const tree = useMemo(() => buildTree(files), [files]);

    if (tree.length === 0) {
      return (
        <div className={`p-4 text-xs text-zinc-500 ${className || ""}`}>
          No files yet
        </div>
      );
    }

    return (
      <div className={`py-1 overflow-y-auto ${className || ""}`}>
        {tree.map((node) => (
          <TreeItem
            key={node.fullPath}
            node={node}
            selectedFile={selectedFile}
            onFileSelect={onFileSelect}
            unsavedFiles={unsavedFiles}
          />
        ))}
      </div>
    );
  },
);

FileTree.displayName = "FileTree";
