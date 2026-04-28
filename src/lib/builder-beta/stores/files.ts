/**
 * Builder Beta Files Store
 * Ported from builderbeta — adapted for Next.js (removed import.meta.hot, Vite HMR).
 * Uses Nanostores for reactive state management.
 */

import { map, type MapStore } from 'nanostores';

export interface File {
  type: 'file';
  content: string;
  isBinary: boolean;
}

export interface Folder {
  type: 'folder';
}

type Dirent = File | Folder;

export type FileMap = Record<string, Dirent | undefined>;

export class FilesStore {
  #size = 0;
  #modifiedFiles: Map<string, string> = new Map();

  files: MapStore<FileMap> = map({});

  get filesCount() {
    return this.#size;
  }

  getFile(filePath: string) {
    const dirent = this.files.get()[filePath];

    if (dirent?.type !== 'file') {
      return undefined;
    }

    return dirent;
  }

  getFileModifications() {
    return this.#computeFileModifications();
  }

  resetFileModifications() {
    this.#modifiedFiles.clear();
  }

  async saveFile(filePath: string, content: string) {
    const oldContent = this.getFile(filePath)?.content;

    if (oldContent && !this.#modifiedFiles.has(filePath)) {
      this.#modifiedFiles.set(filePath, oldContent);
    }

    this.files.setKey(filePath, { type: 'file', content, isBinary: false });
  }

  setFile(filePath: string, content: string) {
    this.files.setKey(filePath, { type: 'file', content, isBinary: false });
    this.#size++;
  }

  #computeFileModifications() {
    const files = this.files.get();
    const modifications: Record<string, { type: 'file'; content: string }> = {};

    for (const [path, original] of this.#modifiedFiles.entries()) {
      const current = files[path];
      if (current?.type === 'file' && current.content !== original) {
        modifications[path] = { type: 'file', content: current.content };
      }
    }

    return Object.keys(modifications).length > 0 ? modifications : undefined;
  }
}
