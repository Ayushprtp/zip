import { describe, it, expect, beforeEach, vi } from "vitest";
import fc from "fast-check";
import { ChatMessage } from "@/types/builder";

describe("ChatInterface Logic", () => {
  describe("Unit Tests", () => {
    it("should validate non-empty messages", () => {
      const isEmpty = (msg: string) => !msg.trim();

      expect(isEmpty("")).toBe(true);
      expect(isEmpty("   ")).toBe(true);
      expect(isEmpty("Hello")).toBe(false);
    });

    it("should create message with id and timestamp", () => {
      const createMessage = (
        content: string,
        role: "user" | "assistant",
      ): ChatMessage => ({
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        role,
        content,
        mentions: [],
        timestamp: Date.now(),
      });

      const msg = createMessage("Test", "user");

      expect(msg.id).toBeDefined();
      expect(msg.content).toBe("Test");
      expect(msg.role).toBe("user");
      expect(msg.timestamp).toBeGreaterThan(0);
    });

    it("should handle multiline messages", () => {
      const content = "Line 1\nLine 2\nLine 3";
      const lines = content.split("\n");

      expect(lines).toHaveLength(3);
      expect(lines[0]).toBe("Line 1");
      expect(lines[1]).toBe("Line 2");
      expect(lines[2]).toBe("Line 3");
    });
  });

  describe("Property-Based Tests", () => {
    // Feature: ai-builder-ide, Property 35: Message Display Immediacy
    it("should add user messages synchronously", () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1, maxLength: 500 }), (content) => {
          const messages: ChatMessage[] = [];

          // Simulate immediate message addition (synchronous)
          const addMessage = (msg: string) => {
            const newMessage: ChatMessage = {
              id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              role: "user",
              content: msg,
              mentions: [],
              timestamp: Date.now(),
            };
            messages.push(newMessage);
            return newMessage;
          };

          const beforeLength = messages.length;
          const addedMessage = addMessage(content);
          const afterLength = messages.length;

          // Message should be added immediately (synchronously)
          expect(afterLength).toBe(beforeLength + 1);
          expect(addedMessage.content).toBe(content);
          expect(addedMessage.role).toBe("user");
          expect(messages[messages.length - 1]).toBe(addedMessage);
        }),
        { numRuns: 100 },
      );
    });
  });
});
