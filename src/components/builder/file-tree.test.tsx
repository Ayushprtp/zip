/**
 * Unit tests for FileTree component
 */

import { describe, it, expect } from "vitest";
import { buildFileTree } from "./file-tree";
import type { FileNode } from "./file-tree";

describe("FileTree", () => {
  describe("buildFileTree", () => {
    it("should build tree from flat file list", () => {
      const files = {
        "/src/app.ts": "content",
        "/src/utils.ts": "content",
        "/package.json": "content",
      };

      const tree = buildFileTree(files);

      expect(tree).toHaveLength(2); // src and package.json
      expect(tree[0].name).toBe("package.json");
      expect(tree[0].type).toBe("file");
      expect(tree[1].name).toBe("src");
      expect(tree[1].type).toBe("directory");
      expect(tree[1].children).toHaveLength(2);
    });

    it("should handle nested directories", () => {
      const files = {
        "/src/components/Button.tsx": "content",
        "/src/components/Input.tsx": "content",
        "/src/utils/helpers.ts": "content",
      };

      const tree = buildFileTree(files);

      expect(tree).toHaveLength(1); // src
      expect(tree[0].name).toBe("src");
      expect(tree[0].children).toHaveLength(2); // components and utils

      const componentsDir = tree[0].children?.find(
        (n) => n.name === "components",
      );
      expect(componentsDir?.children).toHaveLength(2);
    });

    it("should handle deeply nested directories (10 levels)", () => {
      const files = {
        "/a/b/c/d/e/f/g/h/i/j/file.ts": "content",
      };

      const tree = buildFileTree(files);

      let current = tree;
      let depth = 0;

      while (current.length > 0 && current[0].type === "directory") {
        depth++;
        current = current[0].children || [];
      }

      expect(depth).toBe(10);
    });

    it("should handle files at root level", () => {
      const files = {
        "/README.md": "content",
        "/package.json": "content",
        "/tsconfig.json": "content",
      };

      const tree = buildFileTree(files);

      expect(tree).toHaveLength(3);
      expect(tree.every((node) => node.type === "file")).toBe(true);
    });

    it("should handle mixed root files and directories", () => {
      const files = {
        "/README.md": "content",
        "/src/app.ts": "content",
        "/package.json": "content",
      };

      const tree = buildFileTree(files);

      expect(tree).toHaveLength(3);
      expect(tree.filter((n) => n.type === "file")).toHaveLength(2);
      expect(tree.filter((n) => n.type === "directory")).toHaveLength(1);
    });

    it("should sort files alphabetically", () => {
      const files = {
        "/z.ts": "content",
        "/a.ts": "content",
        "/m.ts": "content",
      };

      const tree = buildFileTree(files);

      expect(tree[0].name).toBe("a.ts");
      expect(tree[1].name).toBe("m.ts");
      expect(tree[2].name).toBe("z.ts");
    });

    it("should handle empty file list", () => {
      const files = {};
      const tree = buildFileTree(files);
      expect(tree).toHaveLength(0);
    });

    it("should handle paths without leading slash", () => {
      const files = {
        "src/app.ts": "content",
        "package.json": "content",
      };

      const tree = buildFileTree(files);

      expect(tree).toHaveLength(2);
    });

    it("should preserve correct paths in nodes", () => {
      const files = {
        "/src/components/Button.tsx": "content",
      };

      const tree = buildFileTree(files);

      expect(tree[0].path).toBe("src");
      expect(tree[0].children?.[0].path).toBe("src/components");
      expect(tree[0].children?.[0].children?.[0].path).toBe(
        "src/components/Button.tsx",
      );
    });

    it("should handle multiple files in same directory", () => {
      const files = {
        "/src/a.ts": "content",
        "/src/b.ts": "content",
        "/src/c.ts": "content",
      };

      const tree = buildFileTree(files);

      expect(tree).toHaveLength(1);
      expect(tree[0].children).toHaveLength(3);
    });

    it("should handle complex nested structure", () => {
      const files = {
        "/src/app/page.tsx": "content",
        "/src/app/layout.tsx": "content",
        "/src/components/ui/button.tsx": "content",
        "/src/components/ui/input.tsx": "content",
        "/src/lib/utils.ts": "content",
        "/public/logo.svg": "content",
        "/package.json": "content",
        "/README.md": "content",
      };

      const tree = buildFileTree(files);

      expect(tree).toHaveLength(4); // README.md, package.json, public, src

      const srcDir = tree.find((n) => n.name === "src");
      expect(srcDir?.children).toHaveLength(3); // app, components, lib

      const componentsDir = srcDir?.children?.find(
        (n) => n.name === "components",
      );
      expect(componentsDir?.children).toHaveLength(1); // ui

      const uiDir = componentsDir?.children?.[0];
      expect(uiDir?.children).toHaveLength(2); // button.tsx, input.tsx
    });

    it("should display all files in virtual file system", () => {
      const files = {
        "/a.ts": "content",
        "/b/c.ts": "content",
        "/b/d/e.ts": "content",
      };

      const tree = buildFileTree(files);

      // Count all file nodes
      function countFiles(nodes: FileNode[]): number {
        let count = 0;
        for (const node of nodes) {
          if (node.type === "file") {
            count++;
          }
          if (node.children) {
            count += countFiles(node.children);
          }
        }
        return count;
      }

      expect(countFiles(tree)).toBe(3);
    });
  });
});
