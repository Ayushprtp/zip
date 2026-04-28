/**
 * Builder Beta Workbench Store
 * Ported from builderbeta — adapted for Next.js.
 *
 * Central orchestrator for the Builder Beta workbench.
 * Manages artifacts, files, editor, terminal, and preview state.
 */

import { atom, map, type MapStore, type ReadableAtom, type WritableAtom } from 'nanostores';
import type { EditorDocument, ScrollPosition } from './editor';
import { EditorStore } from './editor';
import { FilesStore, type FileMap } from './files';
import { PreviewsStore } from './previews';
import { TerminalStore, type TerminalType, type ITerminal } from './terminal';
import { WORK_DIR } from '@/lib/builder-beta/utils/constants';

export interface ArtifactState {
  id: string;
  title: string;
  closed: boolean;
}

export type ArtifactUpdateState = Pick<ArtifactState, 'title' | 'closed'>;

type Artifacts = MapStore<Record<string, ArtifactState>>;

export type WorkbenchViewType = 'code' | 'preview' | 'git';

export interface ArtifactCallbackData {
  messageId: string;
  title: string;
  id: string;
}

export interface ActionCallbackData {
  messageId: string;
  actionId: string;
  action: {
    type: string;
    content: string;
    filePath?: string;
  };
}

const LOCALHOST_PORT_REGEX = /(?:https?:\/\/)?(?:localhost|127\.0\.0\.1|0\.0\.0\.0)(?::|\/)(\\d{2,5})/i;

export class WorkbenchStore {
  #previewsStore: PreviewsStore | undefined;
  #filesStore: FilesStore | undefined;
  #editorStoreStore: EditorStore | undefined;
  #terminalStoreInstance: TerminalStore | undefined;
  #knownPreviewPorts = new Set<number>();

  get previews() {
    if (!this.#previewsStore) {
      this.#previewsStore = new PreviewsStore();
    }

    return this.#previewsStore.previews;
  }

  get files() {
    if (!this.#filesStore) {
      this.#filesStore = new FilesStore();
    }

    return this.#filesStore.files;
  }

  get filesStore() {
    if (!this.#filesStore) {
      this.#filesStore = new FilesStore();
    }

    return this.#filesStore;
  }

  get #editor() {
    if (!this.#editorStoreStore) {
      this.#editorStoreStore = new EditorStore(this.#files_store_internal);
    }

    return this.#editorStoreStore;
  }

  get #files_store_internal() {
    if (!this.#filesStore) {
      this.#filesStore = new FilesStore();
    }

    return this.#filesStore;
  }

  get terminalStore() {
    if (!this.#terminalStoreInstance) {
      this.#terminalStoreInstance = new TerminalStore({
        onOutput: (line) => {
          this.#registerPreviewFromTerminalOutput(line);
        },
      });
    }

    return this.#terminalStoreInstance;
  }

  artifacts: Artifacts = map({});
  showWorkbench: WritableAtom<boolean> = atom(false);
  showGit: WritableAtom<boolean> = atom(false);
  currentView: WritableAtom<WorkbenchViewType> = atom('code');
  unsavedFiles: WritableAtom<Set<string>> = atom(new Set<string>());
  modifiedFiles = new Set<string>();
  artifactIdList: string[] = [];

  constructor() {
    this.files.subscribe((files) => {
      this.setDocuments(files);
    });
  }

  addExternalPreview(port: number, baseUrl: string) {
    if (!this.#previewsStore) {
      this.#previewsStore = new PreviewsStore();
    }

    this.#knownPreviewPorts.add(port);
    this.#previewsStore.addExternalPreview(port, baseUrl);

    if (this.currentView.get() !== 'preview') {
      this.currentView.set('preview');
    }
  }

  get currentDocument(): ReadableAtom<EditorDocument | undefined> {
    return this.#editor.currentDocument;
  }

  get selectedFile(): ReadableAtom<string | undefined> {
    return this.#editor.selectedFile;
  }

  get firstArtifact(): ArtifactState | undefined {
    return this.#getArtifact(this.artifactIdList[0]);
  }

  get filesCount(): number {
    return this.#files_store_internal.filesCount;
  }

  get showTerminal() {
    return this.terminalStore.showTerminal;
  }

  toggleTerminal(value?: boolean) {
    this.terminalStore.toggleTerminal(value);
  }

  attachTerminal(terminal: ITerminal, runtime?: TerminalType) {
    this.terminalStore.addTerminal(runtime);
  }

  onTerminalResize(cols: number, rows: number) {
    this.terminalStore.onTerminalResize(cols, rows);
  }

  setDocuments(files: FileMap) {
    this.#editor.setDocuments(files);

    if (this.#files_store_internal.filesCount > 0 && this.currentDocument.get() === undefined) {
      for (const [filePath, dirent] of Object.entries(files)) {
        if (dirent?.type === 'file') {
          this.setSelectedFile(filePath);
          break;
        }
      }
    }
  }

  setShowWorkbench(show: boolean) {
    this.showWorkbench.set(show);
  }

  toggleGit(value?: boolean) {
    this.showGit.set(value ?? !this.showGit.get());
  }

  setCurrentDocumentContent(newContent: string) {
    const filePath = this.currentDocument.get()?.filePath;

    if (!filePath) {
      return;
    }

    const originalContent = this.#files_store_internal.getFile(filePath)?.content;
    const unsavedChanges = originalContent !== undefined && originalContent !== newContent;

    this.#editor.updateFile(filePath, newContent);

    const currentDocument = this.currentDocument.get();

    if (currentDocument) {
      const previousUnsavedFiles = this.unsavedFiles.get();

      if (unsavedChanges && previousUnsavedFiles.has(currentDocument.filePath)) {
        return;
      }

      const newUnsavedFiles = new Set(previousUnsavedFiles);

      if (unsavedChanges) {
        newUnsavedFiles.add(currentDocument.filePath);
      } else {
        newUnsavedFiles.delete(currentDocument.filePath);
      }

      this.unsavedFiles.set(newUnsavedFiles);
    }
  }

  setCurrentDocumentScrollPosition(position: ScrollPosition) {
    const editorDocument = this.currentDocument.get();

    if (!editorDocument) {
      return;
    }

    const { filePath } = editorDocument;
    this.#editor.updateScrollPosition(filePath, position);
  }

  setSelectedFile(filePath: string | undefined) {
    this.#editor.setSelectedFile(filePath);
  }

  async saveFile(filePath: string) {
    const documents = this.#editor.documents.get();
    const document = documents[filePath];

    if (document === undefined) {
      return;
    }

    await this.#files_store_internal.saveFile(filePath, document.value);

    const newUnsavedFiles = new Set(this.unsavedFiles.get());
    newUnsavedFiles.delete(filePath);

    this.unsavedFiles.set(newUnsavedFiles);
  }

  async saveCurrentDocument() {
    const currentDocument = this.currentDocument.get();

    if (currentDocument === undefined) {
      return;
    }

    await this.saveFile(currentDocument.filePath);
  }

  resetCurrentDocument() {
    const currentDocument = this.currentDocument.get();

    if (currentDocument === undefined) {
      return;
    }

    const { filePath } = currentDocument;
    const file = this.#files_store_internal.getFile(filePath);

    if (!file) {
      return;
    }

    this.setCurrentDocumentContent(file.content);
  }

  async saveAllFiles() {
    for (const filePath of this.unsavedFiles.get()) {
      await this.saveFile(filePath);
    }
  }

  getFileModifcations() {
    return this.#files_store_internal.getFileModifications();
  }

  resetAllFileModifications() {
    this.#files_store_internal.resetFileModifications();
  }

  abortAllActions() {
    // TODO: implement action abort
  }

  addArtifact({ messageId, title, id }: ArtifactCallbackData) {
    const artifact = this.#getArtifact(messageId);

    if (artifact) {
      return;
    }

    if (!this.artifactIdList.includes(messageId)) {
      this.artifactIdList.push(messageId);
    }

    this.artifacts.setKey(messageId, {
      id,
      title,
      closed: false,
    });
  }

  updateArtifact({ messageId }: ArtifactCallbackData, state: Partial<ArtifactUpdateState>) {
    const artifact = this.#getArtifact(messageId);

    if (!artifact) {
      return;
    }

    this.artifacts.setKey(messageId, { ...artifact, ...state });
  }

  streamFileAction(data: ActionCallbackData) {
    const { action } = data;

    if (action.type !== 'file' || !action.filePath) {
      return;
    }

    const filePath = action.filePath.startsWith(WORK_DIR)
      ? action.filePath
      : `${WORK_DIR}/${action.filePath.replace(/^\/+/, '')}`;

    // Ensure parent directories exist
    const segments = filePath.split('/');
    let currentPath = '';

    for (let i = 0; i < segments.length - 1; i++) {
      currentPath += segments[i] + '/';

      if (currentPath.length > 1) {
        const existing = this.#files_store_internal.files.get()[currentPath];

        if (!existing) {
          this.#files_store_internal.files.setKey(currentPath, { type: 'folder' });
        }
      }
    }

    this.#files_store_internal.files.setKey(filePath, { type: 'file', content: action.content, isBinary: false });

    const currentDocument = this.currentDocument.get();

    if (!currentDocument || currentDocument.filePath !== filePath) {
      this.setSelectedFile(filePath);
    }

    this.#editor.updateFile(filePath, action.content);
  }

  #getArtifact(id: string) {
    const artifacts = this.artifacts.get();
    return artifacts[id];
  }

  #registerPreviewFromTerminalOutput(line: string) {
    const match = line.match(LOCALHOST_PORT_REGEX);
    if (!match?.[1]) return;

    const port = Number.parseInt(match[1], 10);
    if (!Number.isFinite(port) || port <= 0 || this.#knownPreviewPorts.has(port)) return;

    this.#knownPreviewPorts.add(port);
    this.addExternalPreview(port, `http://localhost:${port}`);
  }
}

export const workbenchStore = new WorkbenchStore();
