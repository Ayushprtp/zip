/**
 * Property-based tests for VirtualFileSystem
 * Tests universal properties that should hold for all file system operations
 */

import { describe, it, expect, beforeEach } from "vitest";
import fc from "fast-check";
import { VirtualFileSystem } from "./virtual-file-system";

describe("VirtualFileSystem Property Tests", () => {
  let _vfs: VirtualFileSystem;

  beforeEach(() => {
    _vfs = new VirtualFileSystem();
  });

  // Feature: ai-builder-ide, Property 37: File Creation State Consistency
  it("should update both file system and file tree when creating a file", () => {
    fc.assert(
      fc.property(
        fc
          .string({ minLength: 1, maxLength: 50 })
          .filter(
            (s) => !s.includes("\x00") && !/[<>:"|?*\x00-\x1F\/]/.test(s),
          ), // Also filter out slashes
        fc.string({ maxLength: 1000 }),
        (filename, content) => {
          const vfs = new VirtualFileSystem();
          const path = `/test/${filename}.txt`;

          // Create file
          vfs.createFile(path, content);

          // Verify file exists in file system
          expect(vfs.fileExists(path)).toBe(true);

          // Verify file content matches
          expect(vfs.readFile(path)).toBe(content);

          // Verify file appears in parent directory's children
          const parentDir = vfs.getDirectory("/test");
          expect(parentDir).toBeDefined();
          expect(parentDir?.children).toContain(path);

          // Verify file metadata is correct
          const file = vfs.getFile(path);
          expect(file).toBeDefined();
          expect(file?.content).toBe(content);
          expect(file?.size).toBe(content.length);
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: ai-builder-ide, Property 38: File Modification State Update
  it("should update file content and metadata when modifying a file", () => {
    fc.assert(
      fc.property(
        fc
          .string({ minLength: 1, maxLength: 50 })
          .filter(
            (s) => !s.includes("\x00") && !/[<>:"|?*\x00-\x1F\/]/.test(s),
          ),
        fc.string({ maxLength: 1000 }),
        fc.string({ maxLength: 1000 }),
        (filename, initialContent, newContent) => {
          const vfs = new VirtualFileSystem();
          const path = `/test/${filename}.txt`;

          // Create file with initial content
          vfs.createFile(path, initialContent);
          const initialFile = vfs.getFile(path);
          const _initialTimestamp = initialFile?.lastModified || 0;

          // Small delay to ensure timestamp changes
          const beforeUpdate = Date.now();

          // Update file
          vfs.updateFile(path, newContent);

          // Verify content updated
          expect(vfs.readFile(path)).toBe(newContent);

          // Verify metadata updated
          const updatedFile = vfs.getFile(path);
          expect(updatedFile?.content).toBe(newContent);
          expect(updatedFile?.size).toBe(newContent.length);
          expect(updatedFile?.lastModified).toBeGreaterThanOrEqual(
            beforeUpdate,
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: ai-builder-ide, Property 39: File Deletion State Consistency
  it("should remove file from both file system and parent directory when deleting", () => {
    fc.assert(
      fc.property(
        fc
          .string({ minLength: 1, maxLength: 50 })
          .filter(
            (s) => !s.includes("\x00") && !/[<>:"|?*\x00-\x1F\/]/.test(s),
          ),
        fc.string({ maxLength: 1000 }),
        (filename, content) => {
          const vfs = new VirtualFileSystem();
          const path = `/test/${filename}.txt`;

          // Create file
          vfs.createFile(path, content);
          expect(vfs.fileExists(path)).toBe(true);

          // Delete file
          vfs.deleteFile(path);

          // Verify file no longer exists
          expect(vfs.fileExists(path)).toBe(false);

          // Verify file removed from parent directory's children
          const parentDir = vfs.getDirectory("/test");
          expect(parentDir?.children).not.toContain(path);

          // Verify reading deleted file throws error
          expect(() => vfs.readFile(path)).toThrow("File not found");
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: ai-builder-ide, Property 41: Deep Directory Nesting Support
  it("should correctly handle directories nested up to 10 levels deep", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        fc.string({ maxLength: 500 }),
        (depth, content) => {
          const vfs = new VirtualFileSystem();

          // Build a path with the specified depth
          // For depth=10, we want 10 directory levels, so /dir0/dir1/.../dir9/file.txt
          // This means the file is at depth 10 (10 directories before it)
          const pathParts = Array.from({ length: depth }, (_, i) => `dir${i}`);
          const dirPath = "/" + pathParts.join("/");
          const filePath = `${dirPath}/file.txt`;

          // Create file (should auto-create all parent directories)
          vfs.createFile(filePath, content);

          // Verify file exists and is readable
          expect(vfs.fileExists(filePath)).toBe(true);
          expect(vfs.readFile(filePath)).toBe(content);

          // Verify all parent directories were created
          for (let i = 1; i <= depth; i++) {
            const parentPath = "/" + pathParts.slice(0, i).join("/");
            expect(vfs.directoryExists(parentPath)).toBe(true);
          }

          // Verify directory hierarchy is correct
          for (let i = 0; i < depth - 1; i++) {
            const currentPath = "/" + pathParts.slice(0, i + 1).join("/");
            const childPath = "/" + pathParts.slice(0, i + 2).join("/");
            const dir = vfs.getDirectory(currentPath);
            expect(dir?.children).toContain(childPath);
          }

          // Verify file is in the deepest directory's children
          const deepestDir = vfs.getDirectory(dirPath);
          expect(deepestDir?.children).toContain(filePath);
        },
      ),
      { numRuns: 100 },
    );
  });

  // Additional property: Paths exceeding max depth should be rejected
  it("should reject paths that exceed maximum nesting depth of 10", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 11, max: 20 }),
        fc.string({ maxLength: 100 }),
        (depth, content) => {
          const vfs = new VirtualFileSystem();

          // Build a path with depth > 10
          const pathParts = Array.from({ length: depth }, (_, i) => `dir${i}`);
          const filePath = "/" + pathParts.join("/") + "/file.txt";

          // Attempt to create file should throw error
          expect(() => vfs.createFile(filePath, content)).toThrow(
            "exceeds maximum nesting depth",
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  // Additional property: File operations should be idempotent for reads
  it("should return the same content on multiple reads", () => {
    fc.assert(
      fc.property(
        fc
          .string({ minLength: 1, maxLength: 50 })
          .filter(
            (s) => !s.includes("\x00") && !/[<>:"|?*\x00-\x1F\/]/.test(s),
          ),
        fc.string({ maxLength: 1000 }),
        (filename, content) => {
          const vfs = new VirtualFileSystem();
          const path = `/test/${filename}.txt`;

          vfs.createFile(path, content);

          // Read multiple times
          const read1 = vfs.readFile(path);
          const read2 = vfs.readFile(path);
          const read3 = vfs.readFile(path);

          // All reads should return identical content
          expect(read1).toBe(content);
          expect(read2).toBe(content);
          expect(read3).toBe(content);
          expect(read1).toBe(read2);
          expect(read2).toBe(read3);
        },
      ),
      { numRuns: 100 },
    );
  });

  // Additional property: Directory deletion should remove all descendants
  it("should recursively delete all files and subdirectories when deleting a directory", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc
            .string({ minLength: 1, maxLength: 20 })
            .filter(
              (s) => !s.includes("\x00") && !/[<>:"|?*\x00-\x1F\/]/.test(s),
            ),
          { minLength: 1, maxLength: 10 },
        ),
        fc.string({ maxLength: 500 }),
        (filenames, content) => {
          const vfs = new VirtualFileSystem();
          const basePath = "/testdir";

          // Create multiple files in the directory
          const filePaths = filenames.map((name) => `${basePath}/${name}.txt`);
          for (const path of filePaths) {
            vfs.createFile(path, content);
          }

          // Verify all files exist
          for (const path of filePaths) {
            expect(vfs.fileExists(path)).toBe(true);
          }

          // Delete the directory
          vfs.deleteDirectory(basePath);

          // Verify directory and all files are gone
          expect(vfs.directoryExists(basePath)).toBe(false);
          for (const path of filePaths) {
            expect(vfs.fileExists(path)).toBe(false);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  // Additional property: getAllFiles should return all created files
  it("should return all files in getAllFiles() after creating multiple files", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            path: fc
              .string({ minLength: 1, maxLength: 30 })
              .filter(
                (s) => !s.includes("\x00") && !/[<>:"|?*\x00-\x1F\/]/.test(s),
              ),
            content: fc.string({ maxLength: 500 }),
          }),
          { minLength: 0, maxLength: 20 },
        ),
        (fileSpecs) => {
          const vfs = new VirtualFileSystem();

          // Create all files
          const createdPaths = new Set<string>();
          for (const spec of fileSpecs) {
            const path = `/test/${spec.path}.txt`;
            try {
              vfs.createFile(path, spec.content);
              createdPaths.add(path);
            } catch {
              // Skip files that fail validation
            }
          }

          // Get all files
          const allFiles = vfs.getAllFiles();

          // Verify all created files are in the result
          for (const path of createdPaths) {
            expect(allFiles[path]).toBeDefined();
            expect(allFiles[path]).toBe(vfs.readFile(path));
          }

          // Verify count matches
          expect(Object.keys(allFiles).length).toBe(createdPaths.size);
        },
      ),
      { numRuns: 100 },
    );
  });
});
