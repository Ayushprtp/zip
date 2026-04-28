import type { ITheme } from '@xterm/xterm';

const style = getComputedStyle(document.documentElement);
const cssVar = (token: string) => style.getPropertyValue(token) || undefined;

export function getTerminalTheme(overrides?: ITheme): ITheme {
  return {
    cursor: cssVar('--flare-elements-terminal-cursorColor'),
    cursorAccent: cssVar('--flare-elements-terminal-cursorColorAccent'),
    foreground: cssVar('--flare-elements-terminal-textColor'),
    background: cssVar('--flare-elements-terminal-backgroundColor'),
    selectionBackground: cssVar('--flare-elements-terminal-selection-backgroundColor'),
    selectionForeground: cssVar('--flare-elements-terminal-selection-textColor'),
    selectionInactiveBackground: cssVar('--flare-elements-terminal-selection-backgroundColorInactive'),

    // ansi escape code colors
    black: cssVar('--flare-elements-terminal-color-black'),
    red: cssVar('--flare-elements-terminal-color-red'),
    green: cssVar('--flare-elements-terminal-color-green'),
    yellow: cssVar('--flare-elements-terminal-color-yellow'),
    blue: cssVar('--flare-elements-terminal-color-blue'),
    magenta: cssVar('--flare-elements-terminal-color-magenta'),
    cyan: cssVar('--flare-elements-terminal-color-cyan'),
    white: cssVar('--flare-elements-terminal-color-white'),
    brightBlack: cssVar('--flare-elements-terminal-color-brightBlack'),
    brightRed: cssVar('--flare-elements-terminal-color-brightRed'),
    brightGreen: cssVar('--flare-elements-terminal-color-brightGreen'),
    brightYellow: cssVar('--flare-elements-terminal-color-brightYellow'),
    brightBlue: cssVar('--flare-elements-terminal-color-brightBlue'),
    brightMagenta: cssVar('--flare-elements-terminal-color-brightMagenta'),
    brightCyan: cssVar('--flare-elements-terminal-color-brightCyan'),
    brightWhite: cssVar('--flare-elements-terminal-color-brightWhite'),

    ...overrides,
  };
}
