import { motion, type Variants } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { Dialog, DialogButton, DialogDescription, DialogRoot, DialogTitle } from '~/components/ui/Dialog';
import { IconButton } from '~/components/ui/IconButton';
import { ThemeSwitch } from '~/components/ui/ThemeSwitch';
import { db, deleteById, getAll, chatId, type ChatHistoryItem } from '~/lib/persistence';
import { cubicEasingFn } from '~/utils/easings';
import { logger } from '~/utils/logger';
import { HistoryItem } from './HistoryItem';
import { binDates } from './date-binning';
import { useStore } from '@nanostores/react';
import { authStore, getGithubAppInstallUrl, getFigmaAuthUrl, disconnectGithub } from '~/lib/runtime/auth';
import { GithubPanel } from './GithubPanel';
import { FigmaPanel } from './FigmaPanel';
import { classNames } from '~/utils/classNames';

const menuVariants = {
  closed: {
    opacity: 0,
    visibility: 'hidden',
    left: '-150px',
    transition: {
      duration: 0.2,
      ease: cubicEasingFn,
    },
  },
  open: {
    opacity: 1,
    visibility: 'initial',
    left: 0,
    transition: {
      duration: 0.2,
      ease: cubicEasingFn,
    },
  },
} satisfies Variants;

type DialogContent = { type: 'delete'; item: ChatHistoryItem } | null;

export function Menu() {
  const menuRef = useRef<HTMLDivElement>(null);
  const [list, setList] = useState<ChatHistoryItem[]>([]);
  const [open, setOpen] = useState(false);
  const [dialogContent, setDialogContent] = useState<DialogContent>(null);
  const [activeTab, setActiveTab] = useState<'chats' | 'github' | 'figma'>('chats');

  const loadEntries = useCallback(() => {
    if (db) {
      getAll(db)
        .then((list) => list.filter((item) => item.urlId && item.description))
        .then(setList)
        .catch((error) => toast.error(error.message));
    }
  }, []);

  const deleteItem = useCallback((event: React.UIEvent, item: ChatHistoryItem) => {
    event.preventDefault();

    if (db) {
      deleteById(db, item.id)
        .then(() => {
          loadEntries();

          if (chatId.get() === item.id) {
            // hard page navigation to clear the stores
            window.location.pathname = '/';
          }
        })
        .catch((error) => {
          toast.error('Failed to delete conversation');
          logger.error(error);
        });
    }
  }, []);

  const closeDialog = () => {
    setDialogContent(null);
  };

  useEffect(() => {
    if (open) {
      loadEntries();
    }
  }, [open]);

  useEffect(() => {
    const enterThreshold = 40;
    const exitThreshold = 40;

    function onMouseMove(event: MouseEvent) {
      if (event.pageX < enterThreshold) {
        setOpen(true);
      }

      if (menuRef.current && event.clientX > menuRef.current.getBoundingClientRect().right + exitThreshold) {
        setOpen(false);
      }
    }

    window.addEventListener('mousemove', onMouseMove);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
    };
  }, []);

  return (
    <motion.div
      ref={menuRef}
      initial="closed"
      animate={open ? 'open' : 'closed'}
      variants={menuVariants}
      className="flex flex-col side-menu fixed top-0 w-[350px] h-full glass-effect border-r rounded-r-[32px] border-white/5 z-sidebar shadow-2xl text-sm"
    >
      <div className="flex items-center h-[var(--header-height)]">{/* Placeholder */}</div>
      <div className="flex-1 flex flex-col h-full w-full overflow-hidden">
        <div className="flex px-4 pt-2 gap-2 border-b border-flare-elements-borderColor">
          <TabButton
            active={activeTab === 'chats'}
            onClick={() => setActiveTab('chats')}
            icon="i-ph:chat-teardrop-dots-fill"
            label="Chats"
          />
          <TabButton
            active={activeTab === 'github'}
            onClick={() => setActiveTab('github')}
            icon="i-ph:github-logo-fill"
            label="GitHub"
          />
          <TabButton
            active={activeTab === 'figma'}
            onClick={() => setActiveTab('figma')}
            icon="i-ph:figma-logo-fill"
            label="Figma"
          />
        </div>

        {activeTab === 'chats' ? (
          <>
            {/* Same Chat Content */}
            <div className="p-4">
              <a
                href="/"
                className="flex gap-2 items-center bg-flare-elements-sidebar-buttonBackgroundDefault text-flare-elements-sidebar-buttonText hover:bg-flare-elements-sidebar-buttonBackgroundHover rounded-md p-2 transition-theme"
              >
                <span className="inline-block i-flare:chat scale-110" />
                Start new chat
              </a>
            </div>
            <div className="text-flare-elements-textPrimary font-medium pl-6 pr-5 my-2">Your Chats</div>
            <div className="flex-1 overflow-scroll pl-4 pr-5 pb-5">
              {list.length === 0 && (
                <div className="pl-2 text-flare-elements-textTertiary">No previous conversations</div>
              )}
              <DialogRoot open={dialogContent !== null}>
                {binDates(list).map(({ category, items }) => (
                  <div key={category} className="mt-4 first:mt-0 space-y-1">
                    <div className="text-flare-elements-textTertiary sticky top-0 z-1 bg-flare-elements-background-depth-2 pl-2 pt-2 pb-1">
                      {category}
                    </div>
                    {items.map((item) => (
                      <HistoryItem
                        key={item.id}
                        item={item}
                        onDelete={() => setDialogContent({ type: 'delete', item })}
                      />
                    ))}
                  </div>
                ))}
                <Dialog onBackdrop={closeDialog} onClose={closeDialog}>
                  {dialogContent?.type === 'delete' && (
                    <>
                      <DialogTitle>Delete Chat?</DialogTitle>
                      <DialogDescription asChild>
                        <div>
                          <p>
                            You are about to delete <strong>{dialogContent.item.description}</strong>.
                          </p>
                          <p className="mt-1">Are you sure you want to delete this chat?</p>
                        </div>
                      </DialogDescription>
                      <div className="px-5 pb-4 bg-flare-elements-background-depth-2 flex gap-2 justify-end">
                        <DialogButton type="secondary" onClick={closeDialog}>
                          Cancel
                        </DialogButton>
                        <DialogButton
                          type="danger"
                          onClick={(event) => {
                            deleteItem(event, dialogContent.item);
                            closeDialog();
                          }}
                        >
                          Delete
                        </DialogButton>
                      </div>
                    </>
                  )}
                </Dialog>
              </DialogRoot>
            </div>
          </>
        ) : activeTab === 'github' ? (
          <div className="flex-1 overflow-hidden">
            <GithubPanel />
          </div>
        ) : (
          <div className="flex-1 overflow-hidden">
            <FigmaPanel />
          </div>
        )}

        <div className="flex flex-col p-4 gap-2 border-t border-flare-elements-borderColor">
          <AuthButtons />
          <div className="flex items-center mt-2">
            <ThemeSwitch className="ml-auto" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={classNames('flex-1 pb-2 flex flex-col items-center gap-1 transition-all border-b-2', {
        'text-white border-white': active,
        'text-white/30 border-transparent hover:text-white/50': !active,
      })}
    >
      <div className={classNames(icon, 'text-lg')} />
      <span className="text-[10px] uppercase font-bold tracking-tighter">{label}</span>
    </button>
  );
}

function AuthButtons() {
  const session = useStore(authStore);

  const handleGithubConnect = () => {
    const appSlug = (window as any).ENV?.GITHUB_APP_SLUG || 'flare-sh';
    const url = getGithubAppInstallUrl(appSlug);
    window.location.href = url;
  };

  const handleFigmaConnect = () => {
    const clientId = (window as any).ENV?.FIGMA_CLIENT_ID;

    if (!clientId) {
      toast.error('Figma Client ID not found in environment');
      return;
    }

    const redirectUri = `${window.location.origin}/auth/callback`;
    const url = getFigmaAuthUrl(clientId, redirectUri);
    window.location.href = url;
  };

  return (
    <div className="flex flex-col gap-2">
      {!session.githubToken ? (
        <button
          onClick={handleGithubConnect}
          className="flex items-center gap-2 w-full px-3 py-2 bg-[#24292e] hover:bg-[#2f363d] text-white rounded-lg transition-colors text-xs font-bold"
        >
          <div className="i-ph:github-logo-fill text-lg" />
          Install GitHub App
        </button>
      ) : (
        <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 text-green-400 rounded-lg text-xs font-bold border border-green-500/20">
          <div className="i-ph:github-logo-duotone text-lg" />
          <span className="flex-1">GitHub Connected</span>
          <button
            onClick={() => {
              disconnectGithub();
              toast.info('GitHub disconnected');
            }}
            className="text-white/30 hover:text-red-400 transition-colors"
            title="Disconnect GitHub"
          >
            <div className="i-ph:x-bold text-sm" />
          </button>
        </div>
      )}

      {!session.figmaToken ? (
        <button
          onClick={handleFigmaConnect}
          className="flex items-center gap-2 w-full px-3 py-2 bg-[#f24e1e] hover:bg-[#e0451a] text-white rounded-lg transition-colors text-xs font-bold"
        >
          <div className="i-ph:figma-logo-fill text-lg" />
          Connect Figma
        </button>
      ) : (
        <div className="flex items-center gap-2 px-3 py-2 bg-purple-500/10 text-purple-400 rounded-lg text-xs font-bold border border-purple-500/20">
          <div className="i-ph:figma-logo-duotone text-lg" />
          Figma Connected
        </div>
      )}
    </div>
  );
}
