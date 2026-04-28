import { useStore } from '@nanostores/react';
import React, { Suspense, lazy } from 'react';
import { ClientOnly } from 'remix-utils/client-only';
import { chatStore } from '~/lib/stores/chat';
import { classNames } from '~/utils/classNames';
import { HeaderActionButtons } from './HeaderActionButtons.client';
import { ChatDescription } from '~/lib/persistence/ChatDescription.client';

const HeaderOrb3D = lazy(() =>
  import('~/components/ui/HeaderOrb3D.client').then((mod) => ({ default: mod.HeaderOrb3D })),
);

export function Header() {
  const chat = useStore(chatStore);

  return (
    <header
      className={classNames(
        'flex items-center glass-effect sticky top-0 z-header px-8 h-[70px] border-b border-white/5 shadow-lg',
      )}
    >
      <div className="flex items-center gap-2 z-logo text-flare-elements-textPrimary cursor-pointer">
        <div className="w-[36px] h-[36px] flex items-center justify-center bg-white/5 rounded-lg border border-white/10 shadow-inner">
          <div className="i-ph:lightning-fill text-xl text-flare-elements-textPrimary animate-pulse" />
        </div>
        <a
          href="/"
          className="text-2xl font-bold bg-gradient-to-r from-white to-zinc-500 bg-clip-text text-transparent flex items-center tracking-tighter"
        >
          Flare
        </a>
      </div>
      <span className="flex-1 px-4 truncate text-center text-flare-elements-textPrimary">
        <ClientOnly>{() => <ChatDescription />}</ClientOnly>
      </span>
      {chat.started && (
        <ClientOnly>
          {() => (
            <div className="mr-1">
              <HeaderActionButtons />
            </div>
          )}
        </ClientOnly>
      )}
    </header>
  );
}
