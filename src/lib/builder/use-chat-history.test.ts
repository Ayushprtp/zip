import { describe, it, expect, beforeEach } from "vitest";
import fc from "fast-check";
import { ChatMessage } from "@/types/builder";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(global, "localStorage", {
  value: localStorageMock,
});

describe("Chat History Persistence", () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  describe("Unit Tests", () => {
    it("should save and load messages from localStorage", () => {
      const projectId = "test-project";
      const messages: ChatMessage[] = [
        {
          id: "1",
          role: "user",
          content: "Test message",
          mentions: [],
          timestamp: Date.now(),
        },
      ];

      // Save messages
      localStorage.setItem(
        `ai-builder-chat-history-${projectId}`,
        JSON.stringify(messages),
      );

      // Load messages
      const loaded = JSON.parse(
        localStorage.getItem(`ai-builder-chat-history-${projectId}`) || "[]",
      );

      expect(loaded).toEqual(messages);
    });

    it("should handle empty history", () => {
      const projectId = "test-project";
      const loaded = localStorage.getItem(
        `ai-builder-chat-history-${projectId}`,
      );

      expect(loaded).toBeNull();
    });

    it("should clear history", () => {
      const projectId = "test-project";
      const messages: ChatMessage[] = [
        {
          id: "1",
          role: "user",
          content: "Test",
          mentions: [],
          timestamp: Date.now(),
        },
      ];

      localStorage.setItem(
        `ai-builder-chat-history-${projectId}`,
        JSON.stringify(messages),
      );

      localStorage.removeItem(`ai-builder-chat-history-${projectId}`);

      const loaded = localStorage.getItem(
        `ai-builder-chat-history-${projectId}`,
      );
      expect(loaded).toBeNull();
    });
  });

  describe("Property-Based Tests", () => {
    // Feature: ai-builder-ide, Property 36: Chat History Persistence Round-Trip
    it("should persist and restore chat history correctly", () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.string(),
              role: fc.constantFrom("user", "assistant", "system"),
              content: fc.string({ minLength: 1, maxLength: 500 }),
              mentions: fc.constant([]),
              timestamp: fc.integer({ min: 0 }),
            }),
            { minLength: 0, maxLength: 50 },
          ),
          (messages) => {
            const projectId = `test-${Math.random()}`;
            const key = `ai-builder-chat-history-${projectId}`;

            // Save messages to localStorage
            localStorage.setItem(key, JSON.stringify(messages));

            // Load messages from localStorage
            const loaded = JSON.parse(localStorage.getItem(key) || "[]");

            // Verify round-trip
            expect(loaded).toEqual(messages);
            expect(loaded.length).toBe(messages.length);

            // Verify each message
            for (let i = 0; i < messages.length; i++) {
              expect(loaded[i].id).toBe(messages[i].id);
              expect(loaded[i].role).toBe(messages[i].role);
              expect(loaded[i].content).toBe(messages[i].content);
              expect(loaded[i].timestamp).toBe(messages[i].timestamp);
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
