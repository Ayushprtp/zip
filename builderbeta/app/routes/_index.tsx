import { json, type MetaFunction } from '@remix-run/cloudflare';
import { ClientOnly } from 'remix-utils/client-only';
import { Chat } from '~/components/chat/Chat.client';
import { Header } from '~/components/header/Header';

export const meta: MetaFunction = () => {
  return [{ title: 'Flare' }, { name: 'description', content: 'Talk with Flare, an expert AI assistant' }];
};

export const loader = () => json({});

export default function Index() {
  return (
    <div className="flex flex-col h-full w-full">
      <Header />
      <ClientOnly fallback={<BaseChatFallback />}>{() => <Chat />}</ClientOnly>
    </div>
  );
}

function BaseChatFallback() {
  return (
    <div className="flex-1 bg-flare-elements-background-depth-1 flex items-center justify-center">
      {/* Ghost layout for initial SSR flash */}
    </div>
  );
}
