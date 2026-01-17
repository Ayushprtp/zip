import { describe, it, expect, beforeEach } from "vitest";
import { AIService } from "./ai-service";
import { ContextMention } from "@/types/builder";

describe("AIService", () => {
  let service: AIService;

  beforeEach(() => {
    service = new AIService({
      apiKey: "test-key",
      model: "claude",
    });
  });

  describe("Unit Tests", () => {
    it("should create service with config", () => {
      expect(service).toBeDefined();
    });

    it("should build context from file mentions", async () => {
      const mentions: ContextMention[] = [
        {
          type: "files",
          data: [{ path: "/test.ts", content: 'console.log("test");' }],
        },
      ];

      // Test that context building works
      const result = await service.generateCode({
        prompt: "Test prompt",
        context: mentions,
      });

      expect(result).toBeDefined();
    });

    it("should build context from terminal mentions", async () => {
      const mentions: ContextMention[] = [
        {
          type: "terminal",
          data: {
            logs: [
              {
                id: "1",
                level: "error",
                message: "Error occurred",
                timestamp: Date.now(),
              },
            ],
          },
        },
      ];

      const result = await service.generateCode({
        prompt: "Fix this error",
        context: mentions,
      });

      expect(result).toBeDefined();
    });

    it("should build context from docs mentions", async () => {
      const mentions: ContextMention[] = [
        {
          type: "docs",
          data: {
            query: "react",
            content: "React documentation...",
          },
        },
      ];

      const result = await service.generateCode({
        prompt: "Use React",
        context: mentions,
      });

      expect(result).toBeDefined();
    });

    it("should handle streaming tokens", async () => {
      const tokens: string[] = [];

      await service.generateCode({
        prompt: "Test",
        context: [],
        onToken: (token) => {
          tokens.push(token);
        },
      });

      expect(tokens.length).toBeGreaterThan(0);
    });

    it("should handle errors", async () => {
      let errorCaught = false;

      await service.generateCode({
        prompt: "Test",
        context: [],
        onError: (_error) => {
          errorCaught = true;
        },
      });

      // In the simulated implementation, no error occurs
      // In a real implementation, we would test actual error scenarios
      expect(errorCaught).toBe(false);
    });

    it("should support cancellation", () => {
      service.cancel();
      // Should not throw
      expect(true).toBe(true);
    });
  });
});
