/**
 * Builder Beta Message Parser
 * Ported from builderbeta — parses streaming LLM output to extract
 * <flareArtifact> and <flareAction> tags for the workbench.
 */

// Inline action/artifact types to avoid circular dependency chains
export type ActionType = 'file' | 'shell' | 'terminal';

export interface FileAction {
  type: 'file';
  filePath: string;
  content: string;
}

export interface ShellAction {
  type: 'shell';
  content: string;
}

export interface TerminalAction {
  type: 'terminal';
  content: string;
}

export type BoltAction = FileAction | ShellAction | TerminalAction;

export interface BoltActionData {
  type?: ActionType;
  filePath?: string;
  content: string;
}

export interface BoltArtifactData {
  id: string;
  title: string;
}

const ARTIFACT_TAGS = ['<flareArtifact'];
const ARTIFACT_CLOSE_TAGS = ['</flareArtifact>'];
const ACTION_TAGS = ['<flareAction'];
const ACTION_CLOSE_TAGS = ['</flareAction>'];

export interface ArtifactCallbackData extends BoltArtifactData {
  messageId: string;
}

export interface ActionCallbackData {
  artifactId: string;
  messageId: string;
  actionId: string;
  action: BoltAction;
}

export type ArtifactCallback = (data: ArtifactCallbackData) => void;
export type ActionCallback = (data: ActionCallbackData) => void;

export interface ParserCallbacks {
  onArtifactOpen?: ArtifactCallback;
  onArtifactClose?: ArtifactCallback;
  onActionOpen?: ActionCallback;
  onActionClose?: ActionCallback;
  onActionStream?: ActionCallback;
}

interface ElementFactoryProps {
  messageId: string;
}

type ElementFactory = (props: ElementFactoryProps) => string;

export interface StreamingMessageParserOptions {
  callbacks?: ParserCallbacks;
  artifactElement?: ElementFactory;
}

interface MessageState {
  position: number;
  insideArtifact: boolean;
  insideAction: boolean;
  currentArtifact?: BoltArtifactData;
  currentAction: BoltActionData;
  actionId: number;
}

export class StreamingMessageParser {
  #messages = new Map<string, MessageState>();

  constructor(private _options: StreamingMessageParserOptions = {}) {}

  parse(messageId: string, input: string) {
    let state = this.#messages.get(messageId);

    if (!state) {
      state = {
        position: 0,
        insideAction: false,
        insideArtifact: false,
        currentAction: { content: '' },
        actionId: 0,
      };

      this.#messages.set(messageId, state);
    }

    let output = '';
    let i = state.position;

    while (i < input.length) {
      if (state.insideArtifact) {
        const currentArtifact = state.currentArtifact!;

        if (state.insideAction) {
          const { index: closeIndex, tag: matchedCloseTag } = this.#findFirstTag(input, ACTION_CLOSE_TAGS, i);
          const currentAction = state.currentAction;

          if (closeIndex !== -1) {
            currentAction.content += input.slice(i, closeIndex);
            this.#closeCurrentAction(state, messageId, currentArtifact);
            i = closeIndex + matchedCloseTag!.length;
          } else {
            const partialIndex = this.#findPartialMatch(input, ACTION_CLOSE_TAGS, i);
            if (partialIndex !== -1) {
              currentAction.content += input.slice(i, partialIndex);
              this._options.callbacks?.onActionStream?.({
                artifactId: currentArtifact.id,
                messageId,
                actionId: String(state.actionId - 1),
                action: currentAction as BoltAction,
              });
              i = partialIndex;
              break;
            } else {
              currentAction.content += input.slice(i);
              this._options.callbacks?.onActionStream?.({
                artifactId: currentArtifact.id,
                messageId,
                actionId: String(state.actionId - 1),
                action: currentAction as BoltAction,
              });
              i = input.length;
            }
          }
        } else {
          const { index: actionOpenIndex } = this.#findFirstTag(input, ACTION_TAGS, i);
          const { index: artifactCloseIndex, tag: matchedArtifactCloseTag } = this.#findFirstTag(
            input,
            ARTIFACT_CLOSE_TAGS,
            i,
          );

          if (actionOpenIndex !== -1 && (artifactCloseIndex === -1 || actionOpenIndex < artifactCloseIndex)) {
            const actionEndIndex = input.indexOf('>', actionOpenIndex);

            if (actionEndIndex !== -1) {
              state.insideAction = true;
              state.currentAction = this.#parseActionTag(input, actionOpenIndex, actionEndIndex);
              this._options.callbacks?.onActionOpen?.({
                artifactId: currentArtifact.id,
                messageId,
                actionId: String(state.actionId++),
                action: state.currentAction as BoltAction,
              });
              i = actionEndIndex + 1;
            } else {
              break;
            }
          } else if (artifactCloseIndex !== -1) {
            this._options.callbacks?.onArtifactClose?.({ messageId, ...currentArtifact });
            state.insideArtifact = false;
            state.currentArtifact = undefined;
            i = artifactCloseIndex + matchedArtifactCloseTag!.length;
          } else {
            const partialAction = this.#findPartialMatch(input, ACTION_TAGS, i);
            const partialClose = this.#findPartialMatch(input, ARTIFACT_CLOSE_TAGS, i);
            const firstPartial = partialAction !== -1 && partialClose !== -1
              ? Math.min(partialAction, partialClose)
              : Math.max(partialAction, partialClose);

            if (firstPartial !== -1) {
              i = firstPartial;
              break;
            } else {
              i = input.length;
            }
          }
        }
      } else {
        const { index: artifactOpenIndex } = this.#findFirstTag(input, ARTIFACT_TAGS, i);

        if (artifactOpenIndex !== -1) {
          if (input[artifactOpenIndex - 1] === '/') {
            output += input.slice(i, artifactOpenIndex + 1);
            i = artifactOpenIndex + 1;
            continue;
          }

          const openTagEnd = input.indexOf('>', artifactOpenIndex);

          if (openTagEnd !== -1) {
            output += input.slice(i, artifactOpenIndex);

            const artifactTag = input.slice(artifactOpenIndex, openTagEnd + 1);
            const artifactTitle = this.#extractAttribute(artifactTag, 'title');
            const artifactId = this.#extractAttribute(artifactTag, 'id');

            state.insideArtifact = true;
            state.currentArtifact = { id: artifactId || 'unknown', title: artifactTitle || 'Untitled' };
            this._options.callbacks?.onArtifactOpen?.({ messageId, ...state.currentArtifact });

            const artifactFactory =
              this._options.artifactElement ??
              ((props: any) => `<div class="__flareArtifact__" data-message-id="${props.messageId}"></div>`);
            output += artifactFactory({ messageId });
            i = openTagEnd + 1;
          } else {
            output += input.slice(i, artifactOpenIndex);
            i = artifactOpenIndex;
            break;
          }
        } else {
          const partialMatchIndex = this.#findPartialMatch(input, ARTIFACT_TAGS, i);
          if (partialMatchIndex !== -1) {
            output += input.slice(i, partialMatchIndex);
            i = partialMatchIndex;
            break;
          } else {
            output += input.slice(i);
            i = input.length;
          }
        }
      }
    }

    state.position = i;

    return output;
  }

  finalize(messageId: string) {
    const state = this.#messages.get(messageId);

    if (!state?.insideArtifact || !state.currentArtifact) {
      return;
    }

    if (state.insideAction) {
      this.#closeCurrentAction(state, messageId, state.currentArtifact);
    }

    if (state.insideArtifact && state.currentArtifact) {
      this._options.callbacks?.onArtifactClose?.({ messageId, ...state.currentArtifact });
      state.insideArtifact = false;
      state.currentArtifact = undefined;
    }
  }

  #findFirstTag(input: string, tags: string[], searchIndex: number) {
    let minIndex = -1;
    let matchedTag: string | null = null;

    for (const tag of tags) {
      let idx = searchIndex;
      while (true) {
        idx = input.indexOf(tag, idx);
        if (idx === -1) break;

        if (!tag.endsWith('>')) {
          const nextChar = input[idx + tag.length];
          if (nextChar && nextChar !== ' ' && nextChar !== '>' && nextChar !== '\n') {
            idx += tag.length;
            continue;
          }
        }

        if (minIndex === -1 || idx < minIndex) {
          minIndex = idx;
          matchedTag = tag;
        }
        break;
      }
    }

    return { index: minIndex, tag: matchedTag };
  }

  #findPartialMatch(input: string, tags: string[], searchIndex: number): number {
    for (let j = searchIndex; j < input.length; j++) {
      if (input[j] === '<') {
        const suffix = input.slice(j);
        if (tags.some((tag) => tag.startsWith(suffix))) {
          return j;
        }
      }
    }
    return -1;
  }

  reset() {
    this.#messages.clear();
  }

  #parseActionTag(input: string, actionOpenIndex: number, actionEndIndex: number) {
    const actionTag = input.slice(actionOpenIndex, actionEndIndex + 1);
    const actionType = this.#extractAttribute(actionTag, 'type') as ActionType;
    const actionAttributes: any = { type: actionType, content: '' };

    if (actionType === 'file') {
      const filePath = this.#extractAttribute(actionTag, 'filePath') as string;
      (actionAttributes as FileAction).filePath = filePath;
    }

    return actionAttributes as BoltAction;
  }

  #closeCurrentAction(state: MessageState, messageId: string, currentArtifact: BoltArtifactData) {
    const currentAction = state.currentAction;
    let content = currentAction.content.trim();

    if ('type' in currentAction && currentAction.type === 'file') {
      content += '\n';
    }

    currentAction.content = content;

    this._options.callbacks?.onActionClose?.({
      artifactId: currentArtifact.id,
      messageId,
      actionId: String(state.actionId - 1),
      action: currentAction as BoltAction,
    });

    state.insideAction = false;
    state.currentAction = { content: '' };
  }

  #extractAttribute(tag: string, attributeName: string): string | undefined {
    const match = tag.match(new RegExp(`${attributeName}\\s*=\\s*(["'])(.*?)\\1`, 'i'));
    return match ? match[2] : undefined;
  }
}
