import { atom, map, type MapStore, type ReadableAtom, type WritableAtom } from 'nanostores';
import type { EditorDocument, ScrollPosition } from '~/components/editor/codemirror/CodeMirrorEditor';
import { ActionRunner } from '~/lib/runtime/action-runner';
import type { ActionCallbackData, ArtifactCallbackData } from '~/lib/runtime/message-parser';
import type { ITerminal } from '~/types/terminal';
import { WORK_DIR } from '~/utils/constants';
import { EditorStore } from './editor';
import { FilesStore, type FileMap } from './files';
import { PreviewsStore } from './previews';
import { TerminalStore, type TerminalType } from './terminal';
import { getE2BSandbox, scheduleAutoSnapshot } from '~/lib/e2b/sandbox';

export interface ArtifactState {
  id: string;
  title: string;
  closed: boolean;
  runner: ActionRunner;
}

export type ArtifactUpdateState = Pick<ArtifactState, 'title' | 'closed'>;

type Artifacts = MapStore<Record<string, ArtifactState>>;

export type WorkbenchViewType = 'code' | 'preview' | 'git';

const LOCALHOST_PORT_REGEX = /(?:https?:\/\/)?(?:localhost|127\.0\.0\.1|0\.0\.0\.0)(?::|\/)(\d{2,5})/i;
const BARE_PORT_REGEX = /\b(?:port|localhost|127\.0\.0\.1|0\.0\.0\.0)\s*[: ]\s*(\d{2,5})\b/i;
const E2B_HOST_PORT_REGEX = /https?:\/\/(\d{2,5})-[a-z0-9-]+\.[\w.-]*e2b\./i;

export class WorkbenchStore {
  #previewsStore: PreviewsStore | undefined;
  #filesStore: FilesStore | undefined;
  #editorStoreStore: EditorStore | undefined;
  #terminalStoreInstance: TerminalStore | undefined;
  #knownPreviewPorts = new Set<number>();
  #pendingPreviewPorts = new Set<number>();

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

  artifacts: Artifacts = import.meta.hot?.data.artifacts ?? map({});

  showWorkbench: WritableAtom<boolean> = import.meta.hot?.data.showWorkbench ?? atom(false);
  showGit: WritableAtom<boolean> = import.meta.hot?.data.showGit ?? atom(false);
  currentView: WritableAtom<WorkbenchViewType> = import.meta.hot?.data.currentView ?? atom('code');
  unsavedFiles: WritableAtom<Set<string>> = import.meta.hot?.data.unsavedFiles ?? atom(new Set<string>());
  modifiedFiles = new Set<string>();
  artifactIdList: string[] = [];

  constructor() {
    if (import.meta.hot) {
      import.meta.hot.data.artifacts = this.artifacts;
      import.meta.hot.data.unsavedFiles = this.unsavedFiles;
      import.meta.hot.data.showWorkbench = this.showWorkbench;
      import.meta.hot.data.currentView = this.currentView;
    }

    // Synchronize files store with editor store for E2B
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

  removeExternalPreview(port: number) {
    this.#knownPreviewPorts.delete(port);
    this.#pendingPreviewPorts.delete(port);
    this.#previewsStore?.removeExternalPreview(port);
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
    // TODO: what do we wanna do and how do we wanna recover from this?
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
      runner: new ActionRunner(),
    });
  }

  updateArtifact({ messageId }: ArtifactCallbackData, state: Partial<ArtifactUpdateState>) {
    const artifact = this.#getArtifact(messageId);

    if (!artifact) {
      return;
    }

    this.artifacts.setKey(messageId, { ...artifact, ...state });
  }

  async addAction(data: ActionCallbackData) {
    const { messageId } = data;

    const artifact = this.#getArtifact(messageId);

    if (!artifact) {
      throw new Error('Artifact not found');
    }

    artifact.runner.addAction(data);
  }

  async runAction(data: ActionCallbackData) {
    const { messageId } = data;

    const artifact = this.#getArtifact(messageId);

    if (!artifact) {
      throw new Error('Artifact not found');
    }

    artifact.runner.runAction(data, this.files.get() as any);
  }

  #getArtifact(id: string) {
    const artifacts = this.artifacts.get();
    return artifacts[id];
  }

  streamFileAction(data: ActionCallbackData) {
    const { action } = data;

    if (action.type !== 'file' || !action.filePath) {
      return;
    }

    // Fast-path absolute resolution relative to WORK_DIR
    const filePath = action.filePath.startsWith(WORK_DIR)
      ? action.filePath
      : `${WORK_DIR}/${action.filePath.replace(/^\/+/, '')}`;

    // Ensure parent directories exist in the file tree
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

    // Inject file directly into FileStore (bypass FileWatcher)
    this.#files_store_internal.files.setKey(filePath, { type: 'file', content: action.content, isBinary: false });

    // Auto-select and update the editor for real-time streaming
    const currentDocument = this.currentDocument.get();

    if (!currentDocument || currentDocument.filePath !== filePath) {
      // Auto-focus the file being streamed so user sees the code appearing
      this.setSelectedFile(filePath);
    }

    // Always update the editor document content for real-time streaming
    this.#editor.updateFile(filePath, action.content);
  }

  #registerPreviewFromTerminalOutput(line: string) {
    const port = this.#extractPortFromLine(line);

    if (!port || this.#knownPreviewPorts.has(port) || this.#pendingPreviewPorts.has(port)) {
      return;
    }

    this.#pendingPreviewPorts.add(port);
    void this.#registerPreview(port).finally(() => {
      this.#pendingPreviewPorts.delete(port);
    });
  }

  #extractPortFromLine(line: string): number | null {
    const localhostMatch = line.match(LOCALHOST_PORT_REGEX);

    if (localhostMatch?.[1]) {
      const parsed = Number.parseInt(localhostMatch[1], 10);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    }

    const barePortMatch = line.match(BARE_PORT_REGEX);

    if (barePortMatch?.[1]) {
      const parsed = Number.parseInt(barePortMatch[1], 10);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    }

    const e2bHostMatch = line.match(E2B_HOST_PORT_REGEX);

    if (e2bHostMatch?.[1]) {
      const parsed = Number.parseInt(e2bHostMatch[1], 10);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    }

    return null;
  }

  async #registerPreview(port: number) {
    try {
      const sandbox = await getE2BSandbox();
      const host = sandbox.getHost(port);
      const baseUrl = host.startsWith('http://') || host.startsWith('https://') ? host : `https://${host}`;
      this.#knownPreviewPorts.add(port);
      this.addExternalPreview(port, baseUrl);
      scheduleAutoSnapshot(`preview_registered:${port}`);
    } catch {
      // ignore preview registration failures while sandbox/session is not ready
    }
  }
}

export const workbenchStore = new WorkbenchStore();
