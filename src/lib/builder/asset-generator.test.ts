/**
 * Tests for AssetGenerator class
 * Validates asset detection, generation, and placeholder creation
 */

import { describe, it, expect, beforeEach } from "vitest";
import { AssetGenerator, resetAssetGenerator } from "./asset-generator";
import type { RuntimeError } from "@/types/builder";

describe("AssetGenerator", () => {
  let generator: AssetGenerator;

  beforeEach(() => {
    resetAssetGenerator();
    generator = new AssetGenerator();
  });

  describe("isMissingAssetError", () => {
    it("should detect 404 errors with image extensions", () => {
      const error: RuntimeError = {
        type: "fatal",
        message: "GET /images/logo.png 404 Not Found",
        stack: "",
      };

      expect(generator.isMissingAssetError(error)).toBe(true);
    });

    it('should detect "not found" errors with image extensions', () => {
      const error: RuntimeError = {
        type: "fatal",
        message: "Image not found: /assets/banner.jpg",
        stack: "",
      };

      expect(generator.isMissingAssetError(error)).toBe(true);
    });

    it('should detect "failed to load" errors with image extensions', () => {
      const error: RuntimeError = {
        type: "fatal",
        message: "Failed to load resource",
        stack: "at /public/icon.svg",
      };

      expect(generator.isMissingAssetError(error)).toBe(true);
    });

    it("should not detect errors without asset extensions", () => {
      const error: RuntimeError = {
        type: "fatal",
        message: "GET /api/data 404 Not Found",
        stack: "",
      };

      expect(generator.isMissingAssetError(error)).toBe(false);
    });

    it("should not detect non-404 errors", () => {
      const error: RuntimeError = {
        type: "fatal",
        message: "Syntax error in file.js",
        stack: "",
      };

      expect(generator.isMissingAssetError(error)).toBe(false);
    });
  });

  describe("extractFilePath", () => {
    it("should extract path from quoted string", () => {
      const error: RuntimeError = {
        type: "fatal",
        message: 'Failed to load "/images/logo.png"',
        stack: "",
      };

      const path = generator.extractFilePath(error);
      expect(path).toBe("/images/logo.png");
    });

    it("should extract path from GET request", () => {
      const error: RuntimeError = {
        type: "fatal",
        message: "GET /assets/banner.jpg 404",
        stack: "",
      };

      const path = generator.extractFilePath(error);
      expect(path).toBe("/assets/banner.jpg");
    });

    it("should extract path from URL", () => {
      const error: RuntimeError = {
        type: "fatal",
        message: "Failed to load http://localhost:3000/public/icon.svg",
        stack: "",
      };

      const path = generator.extractFilePath(error);
      expect(path).toBe("/public/icon.svg");
    });

    it("should extract path from src attribute", () => {
      const error: RuntimeError = {
        type: "fatal",
        message: 'Image error: src="/images/photo.png"',
        stack: "",
      };

      const path = generator.extractFilePath(error);
      expect(path).toBe("/images/photo.png");
    });

    it("should normalize paths without leading slash", () => {
      const error: RuntimeError = {
        type: "fatal",
        message: 'Failed to load "images/logo.png"',
        stack: "",
      };

      const path = generator.extractFilePath(error);
      expect(path).toBe("/images/logo.png");
    });

    it("should return null if no path found", () => {
      const error: RuntimeError = {
        type: "fatal",
        message: "Generic error",
        stack: "",
      };

      const path = generator.extractFilePath(error);
      expect(path).toBeNull();
    });

    it("should use error.file if available", () => {
      const error: RuntimeError = {
        type: "fatal",
        message: "Error",
        stack: "",
        file: "/direct/path.png",
      };

      const path = generator.extractFilePath(error);
      expect(path).toBe("/direct/path.png");
    });
  });

  describe("getAssetType", () => {
    it("should detect icon types", () => {
      expect(generator.getAssetType("/favicon.ico")).toBe("icon");
      expect(generator.getAssetType("/icon-32x32.png")).toBe("icon");
      expect(generator.getAssetType("/app-icon.svg")).toBe("icon");
    });

    it("should detect image types", () => {
      expect(generator.getAssetType("/photo.png")).toBe("image");
      expect(generator.getAssetType("/banner.jpg")).toBe("image");
      expect(generator.getAssetType("/logo.svg")).toBe("image");
      expect(generator.getAssetType("/image.webp")).toBe("image");
    });

    it("should return unknown for other types", () => {
      expect(generator.getAssetType("/file.txt")).toBe("unknown");
      expect(generator.getAssetType("/data.json")).toBe("unknown");
    });
  });

  describe("generatePlaceholder", () => {
    it("should generate SVG placeholder for images", async () => {
      const result = await generator.generatePlaceholder(
        "/images/logo.png",
        "",
      );

      expect(result.path).toBe("/images/logo.png");
      expect(result.type).toBe("image");
      expect(result.content).toContain("<svg");
      expect(result.content).toContain("</svg>");
      expect(result.content).toContain("Logo"); // Inferred label
    });

    it("should generate icon placeholder for icons", async () => {
      const result = await generator.generatePlaceholder("/favicon.ico", "");

      expect(result.path).toBe("/favicon.ico");
      expect(result.type).toBe("icon");
      expect(result.content).toContain("<svg");
      expect(result.content).toContain("<circle"); // Icons have circles
    });

    it("should infer dimensions from context", async () => {
      const result = await generator.generatePlaceholder(
        "/banner.png",
        "Image size 1200x300",
      );

      expect(result.content).toContain('width="1200"');
      expect(result.content).toContain('height="300"');
    });

    it("should infer label from filename", async () => {
      const result = await generator.generatePlaceholder(
        "/user-profile-photo.png",
        "",
      );

      expect(result.content).toContain("User Profile Photo");
    });

    it("should mark asset as generated", async () => {
      await generator.generatePlaceholder("/test.png", "");

      expect(generator.hasGenerated("/test.png")).toBe(true);
    });

    it("should call onAssetGenerated callback", async () => {
      let callbackCalled = false;
      let callbackResult: any = null;

      const generatorWithCallback = new AssetGenerator({
        onAssetGenerated: (result) => {
          callbackCalled = true;
          callbackResult = result;
        },
      });

      await generatorWithCallback.generatePlaceholder("/test.png", "");

      expect(callbackCalled).toBe(true);
      expect(callbackResult).toBeDefined();
      expect(callbackResult.path).toBe("/test.png");
    });
  });

  describe("processError", () => {
    it("should generate asset for missing asset errors", async () => {
      const error: RuntimeError = {
        type: "fatal",
        message: "GET /images/logo.png 404 Not Found",
        stack: "",
      };

      const result = await generator.processError(error);

      expect(result).toBeDefined();
      expect(result?.path).toBe("/images/logo.png");
      expect(result?.content).toContain("<svg");
    });

    it("should return null for non-asset errors", async () => {
      const error: RuntimeError = {
        type: "fatal",
        message: "Syntax error",
        stack: "",
      };

      const result = await generator.processError(error);

      expect(result).toBeNull();
    });

    it("should return null if path cannot be extracted", async () => {
      const error: RuntimeError = {
        type: "fatal",
        message: "404 error with no path",
        stack: "",
      };

      const result = await generator.processError(error);

      expect(result).toBeNull();
    });

    it("should not generate same asset twice", async () => {
      const error: RuntimeError = {
        type: "fatal",
        message: "GET /images/logo.png 404 Not Found",
        stack: "",
      };

      const result1 = await generator.processError(error);
      const result2 = await generator.processError(error);

      expect(result1).toBeDefined();
      expect(result2).toBeNull(); // Already generated
    });
  });

  describe("clearCache", () => {
    it("should clear generated assets cache", async () => {
      await generator.generatePlaceholder("/test.png", "");
      expect(generator.hasGenerated("/test.png")).toBe(true);

      generator.clearCache();
      expect(generator.hasGenerated("/test.png")).toBe(false);
    });
  });
});
