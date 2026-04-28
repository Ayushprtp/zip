import { useLoaderData, useNavigate } from '@remix-run/react';
import { useState, useEffect } from 'react';
import { atom } from 'nanostores';
import type { Message } from 'ai';
import { toast } from 'react-toastify';
import { workbenchStore } from '~/lib/stores/workbench';
import { getMessages, getNextId, getUrlId, openDatabase, setMessages } from './db';

export interface ChatHistoryItem {
  id: string;
  urlId?: string;
  description?: string;
  messages: Message[];
  timestamp: string;
}

const persistenceEnabled = !import.meta.env.SSR && !import.meta.env.VITE_DISABLE_PERSISTENCE;

export const db = persistenceEnabled ? await openDatabase() : undefined;

export const chatId = atom<string | undefined>(undefined);
export const description = atom<string | undefined>(undefined);

export function useChatHistory() {
  const navigate = useNavigate();
  const { id: mixedId } = useLoaderData<{ id?: string }>();

  const [initialMessages, setInitialMessages] = useState<Message[]>([]);
  const [ready, setReady] = useState<boolean>(false);
  const [urlId, setUrlId] = useState<string | undefined>();

  useEffect(() => {
    if (!db) {
      setReady(true);

      if (persistenceEnabled) {
        toast.error(`Chat persistence is unavailable`);
      }

      return;
    }

    if (mixedId) {
      getMessages(db, mixedId)
        .then((storedMessages) => {
          if (storedMessages && storedMessages.messages.length > 0) {
            setInitialMessages(storedMessages.messages);
            setUrlId(storedMessages.urlId);
            description.set(storedMessages.description);
            chatId.set(storedMessages.id);
          } else {
            navigate(`/`, { replace: true });
          }

          setReady(true);
        })
        .catch((error) => {
          toast.error(error.message);
        });
    }
  }, []);

  return {
    ready: !mixedId || ready,
    initialMessages,
    storeMessageHistory: async (messages: Message[]) => {
      if (!db || messages.length === 0) {
        return;
      }

      const { firstArtifact } = workbenchStore;

      // Track the ID we are currently using, as State updates are asynchronous
      let currentUrlId = urlId;

      if (!currentUrlId && firstArtifact?.id) {
        currentUrlId = await getUrlId(db, firstArtifact.id);

        navigateChat(currentUrlId);
        setUrlId(currentUrlId);
      }

      if (!description.get() && firstArtifact?.title) {
        description.set(firstArtifact?.title);
      }

      if (!chatId.get()) {
        const nextId = await getNextId(db);

        chatId.set(nextId);

        if (!currentUrlId) {
          currentUrlId = nextId;
          navigateChat(nextId);
        }
      }

      const idToSave = chatId.get() as string;
      if (idToSave) {
        await setMessages(db, idToSave, messages, currentUrlId, description.get());
      }
    },
  };
}

function navigateChat(nextId: string) {
  const url = new URL(window.location.href);
  url.pathname = `/chat/${nextId}`;

  window.history.replaceState({}, '', url);
}
