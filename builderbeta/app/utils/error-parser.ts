export interface TerminalDiagnostic {
  type: 'error' | 'warning';
  source: 'vite' | 'rollup' | 'postcss' | 'tsc' | 'node' | 'generic';
  message: string;
  file?: string;
  line?: number;
  column?: number;
}

export function parseTerminalOutput(data: string): TerminalDiagnostic | null {
  // Vite / Rollup Error patterns
  // e.g., [vite] Internal server error: Failed to parse source for /home/project/src/App.tsx
  const viteMatch = data.match(/\[vite\] (?:Internal server error|Error): (.*)/i);
  if (viteMatch) {
    return {
      type: 'error',
      source: 'vite',
      message: viteMatch[1].trim(),
    };
  }

  // Generic Node.js / Runtime errors
  // e.g., Error: Cannot find module 'react'
  const nodeMatch = data.match(/(?:Error|ReferenceError|TypeError|SyntaxError): (.*)/i);
  if (nodeMatch) {
    return {
      type: 'error',
      source: 'node',
      message: nodeMatch[1].trim(),
    };
  }

  // TSC Errors
  // e.g., src/App.tsx(10,5): error TS2322: Type 'string' is not assignable to type 'number'.
  const tscMatch = data.match(/(.*?)\((\d+),(\d+)\): error (TS\d+): (.*)/);
  if (tscMatch) {
    return {
      type: 'error',
      source: 'tsc',
      file: tscMatch[1],
      line: parseInt(tscMatch[2], 10),
      column: parseInt(tscMatch[3], 10),
      message: tscMatch[5].trim(),
    };
  }

  // Vite 6 host blocked error
  const viteHostMatch = data.match(/Blocked request. This host "(.*?)" is not allowed./i);
  if (viteHostMatch) {
    return {
      type: 'error',
      source: 'vite',
      message: `Vite 6 host blocked: ${viteHostMatch[1]}. Add to allowedHosts in vite.config.js`,
    };
  }

  // pnpm ignored build scripts (security check)
  if (data.includes('Ignored build scripts:') && data.includes('pnpm approve-builds')) {
    return {
      type: 'warning',
      source: 'node',
      message: 'pnpm security check: Build scripts ignored. Run "pnpm approve-builds" to enable them.',
    };
  }

  return null;
}
