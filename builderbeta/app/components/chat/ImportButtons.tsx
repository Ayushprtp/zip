import React, { useState } from 'react';
import { IconButton } from '~/components/ui/IconButton';
import { classNames } from '~/utils/classNames';

interface ImportButtonsProps {
  onImport: (content: string) => void;
  disabled?: boolean;
}

export function ImportButtons({ onImport, disabled }: ImportButtonsProps) {
  const [showFigma, setShowFigma] = useState(false);
  const [showGithub, setShowGithub] = useState(false);
  const [url, setUrl] = useState('');

  const handleImport = (type: 'github' | 'figma') => {
    if (!url.trim()) {
      return;
    }

    if (type === 'github') {
      onImport(`Please import this GitHub repository and analyze its structure: ${url}`);
      setShowGithub(false);
    } else {
      onImport(`Please import this Figma design and convert it to code: ${url}`);
      setShowFigma(false);
    }

    setUrl('');
  };

  return (
    <div className="flex gap-1 items-center relative">
      {/* GitHub Import */}
      <IconButton
        title="Import from GitHub"
        className={classNames('text-white/60 hover:text-white transition-colors')}
        onClick={() => {
          setShowGithub(!showGithub);
          setShowFigma(false);
        }}
        disabled={disabled}
      >
        <div className="i-ph:github-logo-duotone text-xl" />
      </IconButton>

      {/* Figma Import */}
      <IconButton
        title="Import from Figma"
        className={classNames('text-white/60 hover:text-white transition-colors')}
        onClick={() => {
          setShowFigma(!showFigma);
          setShowGithub(false);
        }}
        disabled={disabled}
      >
        <div className="i-ph:figma-logo-duotone text-xl" />
      </IconButton>

      {/* Popovers */}
      {(showGithub || showFigma) && (
        <div className="absolute bottom-full left-0 mb-2 w-72 glass-effect-strong p-3 rounded-xl border border-white/10 shadow-2xl z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="text-xs font-bold text-white/50 mb-2 uppercase tracking-widest">
            {showGithub ? 'Import Repository' : 'Import Design'}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              autoFocus
              placeholder={showGithub ? 'https://github.com/user/repo' : 'Figma File URL'}
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-white/30"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleImport(showGithub ? 'github' : 'figma');
                }

                if (e.key === 'Escape') {
                  setShowGithub(false);
                  setShowFigma(false);
                }
              }}
            />
            <button
              className="bg-flare-elements-item-backgroundAccent text-flare-elements-item-contentAccent px-3 py-1.5 rounded-lg text-xs font-bold hover:scale-105 transition-transform"
              onClick={() => handleImport(showGithub ? 'github' : 'figma')}
            >
              Go
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
