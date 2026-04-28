export interface ITerminal {
  readonly cols?: number;
  readonly rows?: number;

  reset: () => void;
  write: (data: string | Uint8Array) => void;
  onData: (cb: (data: string) => void) => void;
}
