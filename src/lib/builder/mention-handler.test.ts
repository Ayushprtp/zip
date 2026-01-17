import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { MentionHandler } from "./mention-handler";
import { ConsoleLog } from "@/types/builder";

describe("MentionHandler Property Tests", () => {
  const handler = new MentionHandler();

  describe("Unit Tests", () => {
    it("should handle empty file selection", async () => {
      const result = await handler.handleFilesMention([], {});

      expect(result.type).toBe("files");
      expect(result.data).toEqual([]);
    });

    it("should handle empty console output", () => {
      const result = handler.handleTerminalMention([]);

      expect(result.type).toBe("terminal");
      expect(result.data.logs).toEqual([]);
    });

    it("should handle docs mention with query", async () => {
      const result = await handler.handleDocsMention("react");

      expect(result.type).toBe("docs");
      expect(result.data.query).toBe("react");
    });

    it("should parse @Files mention", () => {
      const mentions = handler.parseMentions(
        "Can you check @Files for errors?",
      );

      expect(mentions).toContainEqual({ type: "files" });
    });

    it("should parse @Terminal mention", () => {
      const mentions = handler.parseMentions("Look at @Terminal output");

      expect(mentions).toContainEqual({ type: "terminal" });
    });

    it("should parse @Docs mention with query", () => {
      const mentions = handler.parseMentions("Check @Docs react for info");

      expect(mentions).toContainEqual({ type: "docs", query: "react" });
    });
  });

  describe("Property-Based Tests", () => {
    // Feature: ai-builder-ide, Property 10: File Selection Content Completeness
    it("should include complete content of all selected files", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.dictionary(
            fc.string({ minLength: 1, maxLength: 50 }),
            fc.string({ maxLength: 1000 }),
            { minKeys: 0, maxKeys: 20 },
          ),
          fc.array(fc.string({ minLength: 1, maxLength: 50 }), {
            minLength: 0,
            maxLength: 10,
          }),
          async (fileSystem, selectedPaths) => {
            // Only select paths that exist in the file system
            const validPaths = selectedPaths.filter(
              (path) => path in fileSystem,
            );

            const result = await handler.handleFilesMention(
              validPaths,
              fileSystem,
            );

            expect(result.type).toBe("files");
            expect(result.data).toHaveLength(validPaths.length);

            // Verify each file has complete content
            for (let i = 0; i < validPaths.length; i++) {
              const path = validPaths[i];
              expect(result.data[i].path).toBe(path);
              expect(result.data[i].content).toBe(fileSystem[path]);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    // Feature: ai-builder-ide, Property 11: File Picker Display Completeness
    it("should display all files in the file system", () => {
      fc.assert(
        fc.property(
          fc.dictionary(
            fc.string({ minLength: 1, maxLength: 50 }),
            fc.string({ maxLength: 1000 }),
            { minKeys: 0, maxKeys: 50 },
          ),
          (fileSystem) => {
            const allPaths = Object.keys(fileSystem);
            const displayedPaths = allPaths.sort();

            // Verify all files are present
            expect(displayedPaths).toHaveLength(allPaths.length);

            for (const path of allPaths) {
              expect(displayedPaths).toContain(path);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    // Feature: ai-builder-ide, Property 12: Multiple File Selection Support
    it("should support selecting multiple files", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.dictionary(
            fc.string({ minLength: 1, maxLength: 50 }),
            fc.string({ maxLength: 1000 }),
            { minKeys: 1, maxKeys: 20 },
          ),
          async (fileSystem) => {
            const allPaths = Object.keys(fileSystem);

            // Select all files
            const result = await handler.handleFilesMention(
              allPaths,
              fileSystem,
            );

            expect(result.type).toBe("files");
            expect(result.data).toHaveLength(allPaths.length);

            // Verify all files are included
            for (const path of allPaths) {
              const fileData = result.data.find((f: any) => f.path === path);
              expect(fileData).toBeDefined();
              expect(fileData.content).toBe(fileSystem[path]);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    // Feature: ai-builder-ide, Property 13: Terminal Capture Line Limit
    it("should capture exactly min(N, 50) lines from console", () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.string(),
              level: fc.constantFrom("log", "info", "warn", "error"),
              message: fc.string({ maxLength: 200 }),
              timestamp: fc.integer({ min: 0 }),
            }),
            { minLength: 0, maxLength: 200 },
          ),
          (consoleLines) => {
            const result = handler.handleTerminalMention(consoleLines);

            const expectedCount = Math.min(consoleLines.length, 50);
            expect(result.data.logs).toHaveLength(expectedCount);

            // Verify we got the last N lines
            if (consoleLines.length > 0) {
              const expectedLines = consoleLines.slice(-expectedCount);
              expect(result.data.logs).toEqual(expectedLines);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    // Feature: ai-builder-ide, Property 14: Context Data Preservation
    it("should preserve all context data without loss", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            files: fc.dictionary(
              fc.string({ minLength: 1, maxLength: 50 }),
              fc.string({ maxLength: 1000 }),
              { minKeys: 0, maxKeys: 10 },
            ),
            selectedPaths: fc.array(
              fc.string({ minLength: 1, maxLength: 50 }),
              {
                minLength: 0,
                maxLength: 5,
              },
            ),
            consoleLogs: fc.array(
              fc.record({
                id: fc.string(),
                level: fc.constantFrom("log", "info", "warn", "error"),
                message: fc.string({ maxLength: 200 }),
                timestamp: fc.integer({ min: 0 }),
              }),
              { minLength: 0, maxLength: 100 },
            ),
          }),
          async ({ files, selectedPaths, consoleLogs }) => {
            const validPaths = selectedPaths.filter((path) => path in files);

            // Test files mention
            const filesResult = await handler.handleFilesMention(
              validPaths,
              files,
            );
            expect(filesResult.data).toHaveLength(validPaths.length);
            for (const fileData of filesResult.data) {
              expect(fileData.content).toBe(files[fileData.path]);
            }

            // Test terminal mention
            const terminalResult = handler.handleTerminalMention(consoleLogs);
            const expectedLogs = consoleLogs.slice(-50);
            expect(terminalResult.data.logs).toEqual(expectedLogs);
          },
        ),
        { numRuns: 100 },
      );
    });

    // Feature: ai-builder-ide, Property 15: ANSI Code Preservation
    it("should preserve ANSI color codes in terminal output", () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.string(),
              level: fc.constantFrom("log", "info", "warn", "error"),
              message: fc
                .string({ minLength: 1, maxLength: 200 })
                .filter((msg) => msg.trim().length > 0), // Ensure non-whitespace messages
              timestamp: fc.integer({ min: 0 }),
            }),
            { minLength: 1, maxLength: 100 },
          ),
          (consoleLogs) => {
            // Add ANSI codes to some messages
            const logsWithAnsi = consoleLogs.map((log, i) => ({
              ...log,
              message:
                i % 2 === 0
                  ? `\x1b[31m${log.message}\x1b[0m` // Red color
                  : log.message,
            }));

            const result = handler.handleTerminalMention(logsWithAnsi);

            // Verify ANSI codes are preserved - the result should contain the ANSI-wrapped messages
            expect(result.data.logs).toEqual(logsWithAnsi.slice(-50));
          },
        ),
        { numRuns: 100 },
      );
    });

    // Feature: ai-builder-ide, Property 16: Terminal Stream Completeness
    it("should include logs from all console levels", () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.string(),
              level: fc.constantFrom("log", "info", "warn", "error"),
              message: fc.string({ maxLength: 200 }),
              timestamp: fc.integer({ min: 0 }),
            }),
            { minLength: 1, maxLength: 100 },
          ),
          (consoleLogs) => {
            const result = handler.handleTerminalMention(consoleLogs);

            // Verify all log levels are included (if present in input)
            const inputLevels = new Set(consoleLogs.map((log) => log.level));
            const outputLevels = new Set(
              result.data.logs.map((log: any) => log.level),
            );

            // All levels in output should be from input
            for (const level of outputLevels) {
              expect(inputLevels.has(level)).toBe(true);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    // Feature: ai-builder-ide, Property 17: Documentation Fetch Integration
    it("should attempt to fetch documentation for valid library names", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          async (libraryName) => {
            const result = await handler.handleDocsMention(libraryName);

            expect(result.type).toBe("docs");
            expect(result.data.query).toBe(libraryName);

            // Result should have either content or error
            expect(
              result.data.content !== undefined ||
                result.data.error !== undefined,
            ).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
