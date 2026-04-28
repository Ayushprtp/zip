import { useStore } from '@nanostores/react';
import { figmaStore, fetchFigmaFiles, importFigmaFile, type FigmaFile } from '~/lib/stores/figma';
import { authStore } from '~/lib/runtime/auth';

import { IconButton } from '~/components/ui/IconButton';
import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';

export function FigmaPanel() {
  const { files, loading, error } = useStore(figmaStore);
  const { figmaToken } = useStore(authStore);
  const [fileUrl, setFileUrl] = useState('');

  useEffect(() => {
    if (figmaToken && files.length === 0) {
      fetchFigmaFiles();
    }
  }, [figmaToken]);

  const handleAddFile = (e: React.FormEvent) => {
    e.preventDefault();

    // Logic to extract key from URL and add to list
    alert('Direct file import coming soon!');
  };

  if (!figmaToken) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <div className="i-ph:figma-logo-duotone text-5xl text-white/20 mb-4" />
        <h3 className="text-white font-bold mb-2 text-sm uppercase tracking-wider">Connect Figma</h3>
        <p className="text-white/40 text-xs mb-6">
          Import your designs and convert them to React components instantly.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-flare-elements-background-depth-1">
      <div className="p-4 border-b border-flare-elements-borderColor">
        <h3 className="text-white font-bold mb-3 flex items-center gap-2 text-xs uppercase tracking-widest">
          <div className="i-ph:figma-logo-fill text-[#f24e1e]" />
          Figma Designs
        </h3>
        <form onSubmit={handleAddFile} className="relative">
          <input
            type="text"
            placeholder="Paste Figma file URL..."
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 pl-8 text-[10px] text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-orange-500/50"
            value={fileUrl}
            onChange={(e) => setFileUrl(e.target.value)}
          />
          <div className="absolute left-2.5 top-1/2 -translate-y-1/2 i-ph:link-bold text-white/30" />
        </form>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <div className="i-svg-spinners:90-ring-with-bg text-white/50 text-2xl" />
          </div>
        ) : error ? (
          <div className="p-4 text-center text-red-500/80 text-[10px] font-medium">{error}</div>
        ) : (
          <div className="p-2 space-y-1">
            {files.map((file) => (
              <FigmaFileItem key={file.key} file={file} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FigmaFileItem({ file }: { file: FigmaFile }) {
  const [importing, setImporting] = useState(false);

  const handleImport = async () => {
    setImporting(true);

    try {
      await importFigmaFile(file.key);
      toast.success('Design sent to Flare Agent for conversion!');
    } catch (error: any) {
      toast.error(`Import failed: ${error.message}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="p-3 bg-white/2 hover:bg-white/5 border border-white/5 hover:border-white/10 rounded-xl transition-all group flex items-center gap-3 cursor-pointer">
      <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0 border border-white/5">
        <div className="i-ph:paint-brush-duotone text-lg text-white/30" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-white text-[11px] font-bold truncate group-hover:text-orange-400 transition-colors">
          {file.name}
        </div>
        <div className="text-white/30 text-[9px] uppercase tracking-tighter mt-0.5">
          Modified {new Date(file.last_modified).toLocaleDateString()}
        </div>
      </div>
      <IconButton
        icon={importing ? 'i-svg-spinners:90-ring-with-bg' : 'i-ph:magic-wand-bold'}
        size="sm"
        title="Convert to Code"
        onClick={handleImport}
        disabled={importing}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-orange-400 hover:bg-orange-400/10"
      />
    </div>
  );
}
