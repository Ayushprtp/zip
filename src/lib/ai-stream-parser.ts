import type { Template } from "@/hooks/useBuilderEngine";

interface ParsedFile {
  path: string;
  content: string;
}

// Parse XML-like file tags from AI stream: <file path="/App.js">content</file>
export function parseFilesFromStream(text: string): ParsedFile[] {
  const regex = /<file\s+path=["']([^"']+)["']>([\s\S]*?)<\/file>/g;
  const files: ParsedFile[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    files.push({ path: match[1], content: match[2].trim() });
  }

  return files;
}

// Convert parsed files to Sandpack format
export function filesToSandpackFormat(files: ParsedFile[]): Record<string, string> {
  return files.reduce(
    (acc, file) => {
      const path = file.path.startsWith("/") ? file.path : `/${file.path}`;
      acc[path] = file.content;
      return acc;
    },
    {} as Record<string, string>
  );
}

// Auto-detect template from file paths
export function detectTemplateFromFiles(files: Record<string, string>): Template {
  const paths = Object.keys(files);
  if (paths.some((p) => p.includes("next.config") || p.includes("/pages/") || p.includes("/app/"))) {
    return "nextjs";
  }
  if (paths.some((p) => p.includes("vite.config"))) {
    return "vite-react";
  }
  if (paths.some((p) => p.endsWith(".jsx") || p.endsWith(".tsx"))) {
    return "react";
  }
  if (paths.some((p) => p.endsWith(".js") && !p.includes("config"))) {
    return "vanilla";
  }
  return "static";
}

// Streaming parser class for incremental updates
export class StreamingFileParser {
  private buffer = "";
  private completedFiles: ParsedFile[] = [];

  append(chunk: string): ParsedFile[] {
    this.buffer += chunk;
    const newFiles = parseFilesFromStream(this.buffer);

    // Return only newly completed files
    const newCompleted = newFiles.slice(this.completedFiles.length);
    this.completedFiles = newFiles;

    return newCompleted;
  }

  getAll(): ParsedFile[] {
    return this.completedFiles;
  }

  reset() {
    this.buffer = "";
    this.completedFiles = [];
  }
}
