/**
 * FileTree - Hierarchical file and directory browser
 * Displays project files in a tree structure with expand/collapse
 */

"use client";

import { useMemo, useState, useCallback } from "react";
import {
  ChevronRight,
  ChevronDown,
  File,
  Folder,
  FolderOpen,
} from "lucide-react";
import { useProject } from "@/lib/builder/project-context";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
}

// ============================================================================
// File Tree Builder
// ============================================================================

/**
 * Builds a hierarchical tree structure from flat file paths
 */
function buildFileTree(files: Record<string, string>): FileNode[] {
  const root: FileNode[] = [];
  const pathMap = new Map<string, FileNode>();

  // Sort paths to ensure consistent ordering
  const sortedPaths = Object.keys(files).sort();

  for (const filePath of sortedPaths) {
    const parts = filePath.split("/").filter(Boolean);
    let currentLevel = root;
    let currentPath = "";

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      currentPath += (currentPath ? "/" : "") + part;
      const isFile = i === parts.length - 1;

      // Check if node already exists at this level
      let existingNode = currentLevel.find((node) => node.name === part);

      if (!existingNode) {
        const node: FileNode = {
          name: part,
          path: currentPath,
          type: isFile ? "file" : "directory",
          children: isFile ? undefined : [],
        };

        currentLevel.push(node);
        pathMap.set(currentPath, node);
        existingNode = node;
      }

      // Move to next level if this is a directory
      if (!isFile && existingNode.children) {
        currentLevel = existingNode.children;
      }
    }
  }

  return root;
}

// ============================================================================
// File Tree Node Component
// ============================================================================

interface FileTreeNodeProps {
  node: FileNode;
  level: number;
  activeFile: string | null;
  expandedDirs: Set<string>;
  onFileSelect: (path: string) => void;
  onToggleDir: (path: string) => void;
}

function FileTreeNode({
  node,
  level,
  activeFile,
  expandedDirs,
  onFileSelect,
  onToggleDir,
}: FileTreeNodeProps) {
  const isDirectory = node.type === "directory";
  const isExpanded = expandedDirs.has(node.path);
  const isActive = activeFile === node.path;

  const handleClick = useCallback(() => {
    if (isDirectory) {
      onToggleDir(node.path);
    } else {
      onFileSelect(node.path);
    }
  }, [isDirectory, node.path, onFileSelect, onToggleDir]);

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-accent rounded-sm transition-colors",
          isActive && "bg-accent text-accent-foreground font-medium",
        )}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={handleClick}
      >
        {/* Expand/Collapse Icon for directories */}
        {isDirectory && (
          <span className="flex-shrink-0">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </span>
        )}

        {/* File/Folder Icon */}
        <span className="flex-shrink-0">
          {isDirectory ? (
            isExpanded ? (
              <FolderOpen className="h-4 w-4 text-blue-500" />
            ) : (
              <Folder className="h-4 w-4 text-blue-500" />
            )
          ) : (
            <File className="h-4 w-4 text-muted-foreground" />
          )}
        </span>

        {/* File/Folder Name */}
        <span className="truncate text-sm">{node.name}</span>
      </div>

      {/* Render children if directory is expanded */}
      {isDirectory && isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTreeNode
              key={child.path}
              node={child}
              level={level + 1}
              activeFile={activeFile}
              expandedDirs={expandedDirs}
              onFileSelect={onFileSelect}
              onToggleDir={onToggleDir}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// File Tree Component
// ============================================================================

interface FileTreeProps {
  /** Optional className for styling */
  className?: string;
}

export function FileTree({ className }: FileTreeProps) {
  const { state, actions } = useProject();
  const { files, activeFile } = state;

  // Track expanded directories
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());

  // Build tree structure from flat file list
  const fileTree = useMemo(() => buildFileTree(files), [files]);

  // Handle file selection
  const handleFileSelect = useCallback(
    (path: string) => {
      actions.setActiveFile(path);
    },
    [actions],
  );

  // Handle directory toggle
  const handleToggleDir = useCallback((path: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  // Show empty state if no files
  if (fileTree.length === 0) {
    return (
      <div
        className={cn("flex h-full items-center justify-center p-4", className)}
      >
        <div className="text-center text-muted-foreground">
          <Folder className="mx-auto h-12 w-12 mb-2 opacity-50" />
          <p className="text-sm">No files yet</p>
          <p className="text-xs">Files will appear here as you create them</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("h-full overflow-auto", className)}>
      <div className="py-2">
        {fileTree.map((node) => (
          <FileTreeNode
            key={node.path}
            node={node}
            level={0}
            activeFile={activeFile}
            expandedDirs={expandedDirs}
            onFileSelect={handleFileSelect}
            onToggleDir={handleToggleDir}
          />
        ))}
      </div>
    </div>
  );
}

// Export tree builder for testing
export { buildFileTree };
export type { FileNode };
