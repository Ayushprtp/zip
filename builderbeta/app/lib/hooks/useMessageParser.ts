import type { Message } from 'ai';
import { useCallback, useRef, useState } from 'react';
import { StreamingMessageParser } from '~/lib/runtime/message-parser';
import { workbenchStore } from '~/lib/stores/workbench';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('useMessageParser');

const messageParser = new StreamingMessageParser({
  callbacks: {
    onArtifactOpen: (data) => {
      logger.trace('onArtifactOpen', data);

      workbenchStore.showWorkbench.set(true);
      workbenchStore.addArtifact(data);
    },
    onArtifactClose: (data) => {
      logger.trace('onArtifactClose');

      workbenchStore.updateArtifact(data, { closed: true });
    },
    onActionOpen: (data) => {
      logger.trace('onActionOpen', data.action);

      // we only add shell actions when when the close tag got parsed because only then we have the content
      if (data.action.type !== 'shell') {
        workbenchStore.addAction(data);
      }
    },
    onActionClose: (data) => {
      logger.trace('onActionClose', data.action);

      if (data.action.type === 'shell') {
        workbenchStore.addAction(data);
      }

      workbenchStore.runAction(data);
    },
    onActionStream: (data) => {
      if (data.action.type === 'file') {
        workbenchStore.streamFileAction(data);
      }
    },
  },
});

export function useMessageParser() {
  const [parsedMessages, setParsedMessages] = useState<{ [key: number]: string }>({});
  const finalizedMessageIdsRef = useRef<Set<string>>(new Set());

  const parseMessages = useCallback((messages: Message[], isLoading: boolean) => {
    let reset = false;

    if (import.meta.env.DEV && !isLoading) {
      reset = true;
      messageParser.reset();
      finalizedMessageIdsRef.current.clear();
    }

    for (const [index, message] of messages.entries()) {
      if (message.role !== 'assistant') {
        continue;
      }

      const newParsedContent = messageParser.parse(message.id, message.content);

      setParsedMessages((prevParsed) => ({
        ...prevParsed,
        [index]: !reset ? (prevParsed[index] || '') + newParsedContent : newParsedContent,
      }));

      if (!isLoading && !finalizedMessageIdsRef.current.has(message.id)) {
        messageParser.finalize(message.id);
        finalizedMessageIdsRef.current.add(message.id);
      }
    }
  }, []);

  return { parsedMessages, parseMessages };
}
