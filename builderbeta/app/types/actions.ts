export type ActionType = 'file' | 'shell' | 'terminal';

export interface BaseAction {
  content: string;
}

export interface FileAction extends BaseAction {
  type: 'file';
  filePath: string;
}

export interface ShellAction extends BaseAction {
  type: 'shell';
}

export interface TerminalAction extends BaseAction {
  type: 'terminal';
}

export type BoltAction = FileAction | ShellAction | TerminalAction;

export type BoltActionData = BoltAction | BaseAction;
