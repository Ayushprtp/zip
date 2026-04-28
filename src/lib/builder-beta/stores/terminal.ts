/**
 * Builder Beta Terminal Store
 * Ported from builderbeta — adapted for Next.js.
 */

import { atom, type WritableAtom } from 'nanostores';

export type TerminalType = 'e2b';

interface TerminalStoreOptions {
  onOutput?: (line: string) => void;
}

export interface ITerminal {
  write: (data: string) => void;
  onData: (callback: (data: string) => void) => void;
  cols: number;
  rows: number;
}

export interface TerminalInstance {
  terminal: ITerminal | null;
  process: Promise<any> | null;
  type: TerminalType;
}

export class TerminalStore {
  #onOutput?: (line: string) => void;
  #outputBuffers = new Map<number, string>();

  terminals = atom<TerminalInstance[]>([]);
  showTerminal: WritableAtom<boolean> = atom(false);

  constructor(options: TerminalStoreOptions = {}) {
    this.#onOutput = options.onOutput;
    this.terminals.set([{ terminal: null, process: null, type: 'e2b' }]);
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

    if (inst.process) {
      inst.process.then((p) => {
        if (p?.kill) {
          p.kill();
        }
      });
    }

    const newList = list.filter((_, i) => i !== index);

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
