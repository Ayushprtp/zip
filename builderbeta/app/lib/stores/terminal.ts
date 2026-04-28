import { atom, type WritableAtom } from 'nanostores';
import type { ITerminal } from '~/types/terminal';
import { newE2BShellProcess } from '~/utils/e2b-shell';
import { coloredText } from '~/utils/terminal';

export type TerminalType = 'e2b';

interface TerminalStoreOptions {
  onOutput?: (line: string) => void;
}

export interface TerminalInstance {
  terminal: ITerminal | null;
  process: Promise<any> | null;
  type: TerminalType;
}

export class TerminalStore {
  #onOutput?: (line: string) => void;
  #outputBuffers = new Map<number, string>();

  // Use a store for terminals so the UI can subscribe to it
  terminals = atom<TerminalInstance[]>([]);
  showTerminal: WritableAtom<boolean> = import.meta.hot?.data.showTerminal ?? atom(false);

  constructor(options: TerminalStoreOptions = {}) {
    this.#onOutput = options.onOutput;

    // Initialize with a single E2B terminal placeholder
    this.terminals.set([{ terminal: null, process: null, type: 'e2b' }]);

    if (import.meta.hot) {
      import.meta.hot.data.showTerminal = this.showTerminal;
    }
  }

  toggleTerminal(value?: boolean) {
    this.showTerminal.set(value !== undefined ? value : !this.showTerminal.get());
  }

  removeTerminal(index: number) {
    const list = this.terminals.get();
    const inst = list[index];

    if (!inst) {
      return;
    }

    // Kill the process if possible
    if (inst.process) {
      inst.process.then((p) => {
        if (p?.kill) {
          p.kill();
        }
      });
    }

    const newList = list.filter((_, i) => i !== index);

    // Ensure we always have at least one terminal
    if (newList.length === 0) {
      newList.push({ terminal: null, process: null, type: 'e2b' });
    }

    this.#reindexOutputBuffers(index);
    this.terminals.set(newList);
  }

  addTerminal(type: TerminalType = 'e2b') {
    const list = this.terminals.get();
    this.terminals.set([...list, { terminal: null, process: null, type }]);
  }

  async setTerminalReady(index: number, terminal: ITerminal) {
    const list = this.terminals.get();
    const inst = list[index];

    if (!inst || inst.terminal) {
      return;
    }

    // Bind the actual terminal object
    inst.terminal = terminal;

    // Spawn the E2B shell process
    inst.process = this.#spawnProcess(index, terminal);

    this.terminals.set([...list]); // Trigger update
  }

  async #spawnProcess(index: number, terminal: ITerminal) {
    try {
      return await newE2BShellProcess(terminal, {
        onOutput: (data) => {
          this.captureOutput(index, data);
        },
      });
    } catch (error: any) {
      terminal.write(coloredText.red(`Failed to spawn E2B shell\n\n`) + error.message);
      return null;
    }
  }

  captureOutput(index: number, chunk: string) {
    this.#handleOutput(index, chunk);
  }

  #handleOutput(index: number, chunk: string) {
    if (!this.#onOutput || !chunk) {
      return;
    }

    const normalized = chunk.replace(/\r/g, '');
    const combined = `${this.#outputBuffers.get(index) ?? ''}${normalized}`;
    const lines = combined.split('\n');
    const remainder = lines.pop() ?? '';

    this.#outputBuffers.set(index, remainder);

    for (const line of lines) {
      if (line) {
        this.#onOutput(line);
      }
    }

    if (remainder) {
      this.#onOutput(remainder);
    }
  }

  #reindexOutputBuffers(removedIndex: number) {
    const next = new Map<number, string>();

    for (const [index, buffer] of this.#outputBuffers.entries()) {
      if (index === removedIndex) {
        continue;
      }

      next.set(index > removedIndex ? index - 1 : index, buffer);
    }

    this.#outputBuffers = next;
  }

  onTerminalResize(cols: number, rows: number) {
    for (const { process } of this.terminals.get()) {
      if (process) {
        process.then((p) => {
          if (p?.resize) {
            p.resize({ cols, rows });
          }
        });
      }
    }
  }
}
