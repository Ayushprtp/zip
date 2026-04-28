import { useStore } from '@nanostores/react';
import { chatStore } from '~/lib/stores/chat';
import { workbenchStore } from '~/lib/stores/workbench';
import { classNames } from '~/utils/classNames';

interface HeaderActionButtonsProps {}

export function HeaderActionButtons({}: HeaderActionButtonsProps) {
  const showWorkbench = useStore(workbenchStore.showWorkbench);
  const { showChat } = useStore(chatStore);

  const canHideChat = showWorkbench || !showChat;

  return (
    <div className="flex gap-2">
      <div className="flex border border-flare-elements-borderColor rounded-md overflow-hidden bg-flare-elements-background-depth-2 shadow-sm">
        <Button
          active={showChat}
          disabled={!canHideChat}
          onClick={() => {
            if (canHideChat) {
              chatStore.setKey('showChat', !showChat);
            }
          }}
        >
          <div className="i-flare:chat text-sm" />
        </Button>
        <div className="w-[1px] bg-flare-elements-borderColor" />
        <Button
          active={showWorkbench}
          onClick={() => {
            if (showWorkbench && !showChat) {
              chatStore.setKey('showChat', true);
            }

            if (showWorkbench) {
               workbenchStore.currentView.set('code');
            } else {
               workbenchStore.showWorkbench.set(!showWorkbench);
               workbenchStore.currentView.set('code');
            }
          }}
        >
          <div className="i-ph:code-bold" />
        </Button>
      </div>
    </div>
  );
}

interface ButtonProps {
  active?: boolean;
  disabled?: boolean;
  children?: any;
  onClick?: VoidFunction;
}

function Button({ active = false, disabled = false, children, onClick }: ButtonProps) {
  return (
    <button
      className={classNames('flex items-center p-1.5 transition-colors', {
        'bg-flare-elements-item-backgroundDefault hover:bg-flare-elements-item-backgroundActive text-flare-elements-textTertiary hover:text-flare-elements-textPrimary':
          !active,
        'bg-flare-elements-item-backgroundAccent text-flare-elements-item-contentAccent': active && !disabled,
        'bg-flare-elements-item-backgroundDefault text-alpha-gray-20 dark:text-alpha-white-20 cursor-not-allowed':
          disabled,
      })}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
