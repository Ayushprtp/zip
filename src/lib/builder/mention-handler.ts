import { ContextMention, ConsoleLog } from "@/types/builder";

/**
 * Handles context mentions (@Files, @Terminal, @Docs) in chat
 */
export class MentionHandler {
  /**
   * Handle @Files mention - reads selected files and includes their content
   */
  async handleFilesMention(
    selectedFiles: string[],
    fileSystem: Record<string, string>,
  ): Promise<ContextMention> {
    const fileContents = selectedFiles.map((path) => ({
      path,
      content: fileSystem[path] || "",
    }));

    return {
      type: "files",
      data: fileContents,
    };
  }

  /**
   * Handle @Terminal mention - captures last 50 lines from console
   */
  handleTerminalMention(consoleOutput: ConsoleLog[]): ContextMention {
    // Capture last 50 lines
    const logs = consoleOutput.slice(-50);

    return {
      type: "terminal",
      data: { logs },
    };
  }

  /**
   * Handle @Docs mention - fetches documentation for specified library
   */
  async handleDocsMention(query: string): Promise<ContextMention> {
    try {
      // This would integrate with a documentation API
      // For now, return a placeholder structure
      const docs = await this.fetchDocumentation(query);

      return {
        type: "docs",
        data: {
          query,
          content: docs,
        },
      };
    } catch (_error) {
      return {
        type: "docs",
        data: {
          query,
          content: null,
          error: "Documentation not found",
        },
      };
    }
  }

  /**
   * Fetch documentation from external source
   * This is a placeholder that would integrate with real documentation APIs
   */
  private async fetchDocumentation(_query: string): Promise<string | null> {
    // Placeholder implementation
    // In a real implementation, this would call documentation APIs like:
    // - MDN for web APIs
    // - React docs for React
    // - Tailwind docs for Tailwind
    // etc.

    // For now, return null to simulate "not found"
    return null;
  }

  /**
   * Parse message content to extract mentions
   */
  parseMentions(content: string): {
    type: "files" | "terminal" | "docs";
    query?: string;
  }[] {
    const mentions: {
      type: "files" | "terminal" | "docs";
      query?: string;
    }[] = [];

    // Match @Files, @Terminal, @Docs patterns
    const filesMention = /@Files/gi;
    const terminalMention = /@Terminal/gi;
    const docsMention = /@Docs\s+(\S+)/gi;

    if (filesMention.test(content)) {
      mentions.push({ type: "files" });
    }

    if (terminalMention.test(content)) {
      mentions.push({ type: "terminal" });
    }

    let docsMatch;
    while ((docsMatch = docsMention.exec(content)) !== null) {
      mentions.push({ type: "docs", query: docsMatch[1] });
    }

    return mentions;
  }
}
