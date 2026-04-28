/**
 * Builder Beta Editor Store
 * Ported from builderbeta — adapted for Next.js.
 */

import {
  atom,
  computed,
  map,
  type MapStore,
  type WritableAtom,
} from "nanostores";
import type { FileMap, FilesStore } from "./files";

export interface EditorDocument {
  value: string;
  isBinary?: boolean;
  filePath: string;
  scroll?: ScrollPosition;
}

export interface ScrollPosition {
  top: number;
  left: number;
}

export type EditorDocuments = Record<string, EditorDocument>;

type SelectedFile = WritableAtom<string | undefined>;

export class EditorStore {
  selectedFile: SelectedFile = atom<string | undefined>();
  documents: MapStore<EditorDocuments> = map({});

  currentDocument = computed(
    [this.documents, this.selectedFile],
    (documents, selectedFile) => {
      if (!selectedFile) {
        return undefined;
      }

      return documents[selectedFile];
    },
  );

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_filesStore: FilesStore) {
    // filesStore reserved for future use
  }

  setDocuments(files: FileMap) {
    const previousDocuments = this.documents.value;

    this.documents.set(
      Object.fromEntries<EditorDocument>(
        Object.entries(files)
          .map(([filePath, dirent]) => {
            if (dirent === undefined || dirent.type === "folder") {
              return undefined;
            }

            const previousDocument = previousDocuments?.[filePath];

            return [
              filePath,
              {
                value: dirent.content,
                filePath,
                scroll: previousDocument?.scroll,
              },
            ] as [string, EditorDocument];
          })
          .filter(Boolean) as Array<[string, EditorDocument]>,
      ),
    );
  }

  setSelectedFile(filePath: string | undefined) {
    this.selectedFile.set(filePath);
  }

  updateScrollPosition(filePath: string, position: ScrollPosition) {
    const documents = this.documents.get();
    const documentState = documents[filePath];

    if (!documentState) {
      return;
    }

    this.documents.setKey(filePath, {
      ...documentState,
      scroll: position,
    });
  }

  updateFile(filePath: string, newContent: string) {
    const documents = this.documents.get();
    const documentState = documents[filePath];

    if (!documentState) {
      this.documents.setKey(filePath, {
        value: newContent,
        isBinary: false,
        filePath,
      });

      return;
    }

    const currentContent = documentState.value;
    const contentChanged = currentContent !== newContent;

    if (contentChanged) {
      this.documents.setKey(filePath, {
        ...documentState,
        value: newContent,
      });
    }
  }
}
