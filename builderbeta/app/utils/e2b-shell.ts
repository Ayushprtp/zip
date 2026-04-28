import { getE2BSandbox } from '~/lib/e2b/sandbox';
import type { ITerminal } from '~/types/terminal';
import { WORK_DIR } from '~/utils/constants';

interface E2BShellProcessOptions {
  onOutput?: (data: string) => void;
}

const textEncoder = new TextEncoder();

export async function newE2BShellProcess(terminal: ITerminal, options: E2BShellProcessOptions = {}) {
  const sandbox = await getE2BSandbox();
  const textDecoder = new TextDecoder();
  let isClosed = false;

  const pty = await sandbox.pty.create({
    cols: terminal.cols ?? 120,
    rows: terminal.rows ?? 40,
    cwd: WORK_DIR,
    onData: (data: Uint8Array) => {
      terminal.write(data);

      const decoded = textDecoder.decode(data, { stream: true });

      if (decoded) {
        options.onOutput?.(decoded);
      }
    },
  });

  terminal.onData((data) => {
    if (isClosed) {
      return;
    }

    void sandbox.pty.sendInput(pty.pid, textEncoder.encode(data)).catch(() => {
      // ignore PTY input failures after session close
    });
  });

  return {
    resize: ({ cols, rows }: { cols: number; rows: number }) => {
      if (isClosed) {
        return;
      }

      return sandbox.pty.resize(pty.pid, { cols, rows }).catch(() => {
        // ignore resize failures for closed PTYs
      });
    },
    kill: async () => {
      isClosed = true;
      return pty.kill();
    },
    getExitCode: async () => pty.exitCode ?? 0,
  };
}
