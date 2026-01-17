/**
 * Unit tests for MonacoEditor component
 */

import { describe, it, expect } from "vitest";
import { getLanguageFromPath } from "./monaco-editor";

describe("MonacoEditor", () => {
  describe("getLanguageFromPath", () => {
    it("should detect TypeScript files", () => {
      expect(getLanguageFromPath("/src/app.ts")).toBe("typescript");
      expect(getLanguageFromPath("/components/Button.tsx")).toBe("typescript");
    });

    it("should detect JavaScript files", () => {
      expect(getLanguageFromPath("/src/app.js")).toBe("javascript");
      expect(getLanguageFromPath("/components/Button.jsx")).toBe("javascript");
    });

    it("should detect CSS files", () => {
      expect(getLanguageFromPath("/styles/main.css")).toBe("css");
      expect(getLanguageFromPath("/styles/main.scss")).toBe("scss");
      expect(getLanguageFromPath("/styles/main.sass")).toBe("sass");
      expect(getLanguageFromPath("/styles/main.less")).toBe("less");
    });

    it("should detect HTML files", () => {
      expect(getLanguageFromPath("/public/index.html")).toBe("html");
    });

    it("should detect JSON files", () => {
      expect(getLanguageFromPath("/package.json")).toBe("json");
      expect(getLanguageFromPath("/tsconfig.json")).toBe("json");
    });

    it("should detect Markdown files", () => {
      expect(getLanguageFromPath("/README.md")).toBe("markdown");
      expect(getLanguageFromPath("/docs/guide.markdown")).toBe("markdown");
    });

    it("should detect various programming languages", () => {
      expect(getLanguageFromPath("/script.py")).toBe("python");
      expect(getLanguageFromPath("/app.rb")).toBe("ruby");
      expect(getLanguageFromPath("/main.go")).toBe("go");
      expect(getLanguageFromPath("/lib.rs")).toBe("rust");
      expect(getLanguageFromPath("/App.java")).toBe("java");
      expect(getLanguageFromPath("/main.c")).toBe("c");
      expect(getLanguageFromPath("/main.cpp")).toBe("cpp");
      expect(getLanguageFromPath("/Program.cs")).toBe("csharp");
      expect(getLanguageFromPath("/index.php")).toBe("php");
    });

    it("should detect shell scripts", () => {
      expect(getLanguageFromPath("/script.sh")).toBe("shell");
      expect(getLanguageFromPath("/script.bash")).toBe("shell");
    });

    it("should detect SQL files", () => {
      expect(getLanguageFromPath("/schema.sql")).toBe("sql");
    });

    it("should detect GraphQL files", () => {
      expect(getLanguageFromPath("/schema.graphql")).toBe("graphql");
    });

    it("should detect framework-specific files", () => {
      expect(getLanguageFromPath("/App.vue")).toBe("vue");
      expect(getLanguageFromPath("/Component.svelte")).toBe("svelte");
    });

    it("should detect YAML files", () => {
      expect(getLanguageFromPath("/config.yaml")).toBe("yaml");
      expect(getLanguageFromPath("/config.yml")).toBe("yaml");
    });

    it("should detect XML files", () => {
      expect(getLanguageFromPath("/config.xml")).toBe("xml");
    });

    it("should return plaintext for unknown extensions", () => {
      expect(getLanguageFromPath("/file.unknown")).toBe("plaintext");
      expect(getLanguageFromPath("/file.xyz")).toBe("plaintext");
    });

    it("should handle files without extensions", () => {
      expect(getLanguageFromPath("/Dockerfile")).toBe("plaintext");
      expect(getLanguageFromPath("/Makefile")).toBe("plaintext");
    });

    it("should handle paths with multiple dots", () => {
      expect(getLanguageFromPath("/src/app.test.ts")).toBe("typescript");
      expect(getLanguageFromPath("/src/app.spec.js")).toBe("javascript");
    });

    it("should be case-insensitive", () => {
      expect(getLanguageFromPath("/src/App.TS")).toBe("typescript");
      expect(getLanguageFromPath("/src/App.JS")).toBe("javascript");
      expect(getLanguageFromPath("/README.MD")).toBe("markdown");
    });

    it("should handle paths with no directory", () => {
      expect(getLanguageFromPath("app.ts")).toBe("typescript");
      expect(getLanguageFromPath("index.html")).toBe("html");
    });

    it("should handle deeply nested paths", () => {
      expect(getLanguageFromPath("/a/b/c/d/e/f/file.ts")).toBe("typescript");
    });
  });
});
