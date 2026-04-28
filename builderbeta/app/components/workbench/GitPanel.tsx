import { useState, useEffect, useCallback } from 'react';
import { useStore } from '@nanostores/react';
import { getGitStatus, gitCommit, gitPush, gitPull, type GitStatus } from '~/lib/runtime/git-service';
import { workbenchStore } from '~/lib/stores/workbench';
import { IconButton } from '~/components/ui/IconButton';
import { classNames } from '~/utils/classNames';
import { toast } from 'react-toastify';

interface FilePreview {
  filepath: string;
  original: string;
  current: string;
}

export function GitPanel() {
  const [status, setStatus] = useState<GitStatus[]>([]);
  const [commitMessage, setCommitMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [preview, setPreview] = useState<FilePreview | null>(null);
  const [stagedFiles, setStagedFiles] = useState<Set<string>>(new Set());

  const refreshStatus = useCallback(async () => {
    try {
      const currentStatus = await getGitStatus();
      setStatus(currentStatus);
    } catch (error) {
      console.error('Failed to get git status:', error);
    }
  }, []);

  useEffect(() => {
    refreshStatus();

    const interval = setInterval(refreshStatus, 5000);

    return () => clearInterval(interval);
  }, [refreshStatus]);

  const handleFileClick = useCallback(
    (filepath: string) => {
      if (selectedFile === filepath) {
        setSelectedFile(null);
        setPreview(null);

        return;
      }

      setSelectedFile(filepath);

      // Try to get file content for diff preview
      try {
        const filesStore = workbenchStore.filesStore;

        if (filesStore) {
          const fullPath = `/home/project/${filepath}`;
          const file = filesStore.getFile(fullPath);
          const currentContent = file?.content || '';

          // For now, show the current content (original tracking comes from modifications)
          setPreview({
            filepath,
            original: '', // Will be populated when we have proper git history
            current: currentContent,
          });
        }
      } catch {
        setPreview(null);
      }
    },
    [selectedFile],
  );

  const handleStageFile = useCallback((filepath: string) => {
    setStagedFiles((prev) => {
      const next = new Set(prev);

      if (next.has(filepath)) {
        next.delete(filepath);
      } else {
        next.add(filepath);
      }

      return next;
    });
  }, []);

  const handleStageAll = useCallback(() => {
    setStagedFiles(new Set(status.map((s) => s.filepath)));
  }, [status]);

  const handleUnstageAll = useCallback(() => {
    setStagedFiles(new Set());
  }, []);

  const handleAcceptFile = useCallback((filepath: string) => {
    toast.success(`Accepted changes to ${filepath}`);

    // Mark as staged
    setStagedFiles((prev) => {
      const next = new Set(prev);
      next.add(filepath);

      return next;
    });
  }, []);

  const handleRejectFile = useCallback(
    (filepath: string) => {
      // Reset the file to its original content
      try {
        const fullPath = `/home/project/${filepath}`;
        workbenchStore.resetCurrentDocument?.();
        toast.info(`Rejected changes to ${filepath}`);
        refreshStatus();
      } catch {
        toast.error('Failed to reject changes');
      }
    },
    [refreshStatus],
  );

  const handleCommit = async () => {
    if (!commitMessage.trim()) {
      return;
    }

    setLoading(true);

    try {
      await gitCommit(commitMessage);
      setCommitMessage('');
      setStagedFiles(new Set());
      toast.success('Committed successfully!');
      refreshStatus();
    } catch (error: any) {
      toast.error(`Commit failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePush = async () => {
    setLoading(true);

    try {
      await gitPush();
      toast.success('Pushed successfully!');
    } catch (error: any) {
      toast.error(`Push failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePull = async () => {
    setLoading(true);

    try {
      await gitPull();
      toast.success('Pulled successfully!');
      refreshStatus();
    } catch (error: any) {
      toast.error(`Pull failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const unstagedFiles = status.filter((s) => !stagedFiles.has(s.filepath));
  const staged = status.filter((s) => stagedFiles.has(s.filepath));

  return (
    <div className="flex flex-col h-full bg-flare-elements-background-depth-1 border-l border-flare-elements-borderColor shadow-2xl">
      {/* Header */}
      <div className="p-4 border-b border-flare-elements-borderColor flex items-center justify-between bg-white/2">
        <h3 className="text-white font-bold flex items-center gap-2">
          <div className="i-ph:git-branch-fill text-purple-400" />
          Source Control
        </h3>
        <div className="flex gap-1">
          <IconButton icon="i-ph:arrow-down-bold" size="sm" title="Pull" onClick={handlePull} disabled={loading} />
          <IconButton icon="i-ph:arrow-up-bold" size="sm" title="Push" onClick={handlePush} disabled={loading} />
          <IconButton
            icon="i-ph:arrows-clockwise-bold"
            size="sm"
            title="Refresh"
            onClick={refreshStatus}
            disabled={loading}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {/* Staged Changes */}
        {staged.length > 0 && (
          <div className="p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] font-bold text-green-400/60 uppercase tracking-widest">
                Staged Changes ({staged.length})
              </div>
              <button
                onClick={handleUnstageAll}
                className="text-[10px] text-white/30 hover:text-white/60 transition-colors"
              >
                Unstage All
              </button>
            </div>
            <div className="space-y-0.5">
              {staged.map((item) => (
                <FileRow
                  key={item.filepath}
                  item={item}
                  isSelected={selectedFile === item.filepath}
                  isStaged={true}
                  onClick={() => handleFileClick(item.filepath)}
                  onStage={() => handleStageFile(item.filepath)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Unstaged Changes */}
        <div className="p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
              Changes ({unstagedFiles.length})
            </div>
            {unstagedFiles.length > 0 && (
              <button
                onClick={handleStageAll}
                className="text-[10px] text-white/30 hover:text-white/60 transition-colors"
              >
                Stage All
              </button>
            )}
          </div>
          {unstagedFiles.length === 0 && staged.length === 0 ? (
            <div className="text-white/20 text-xs italic p-4 text-center border border-dashed border-white/5 rounded-lg">
              No changes detected
            </div>
          ) : unstagedFiles.length === 0 ? (
            <div className="text-white/20 text-xs italic p-2 text-center">All changes staged</div>
          ) : (
            <div className="space-y-0.5">
              {unstagedFiles.map((item) => (
                <FileRow
                  key={item.filepath}
                  item={item}
                  isSelected={selectedFile === item.filepath}
                  isStaged={false}
                  onClick={() => handleFileClick(item.filepath)}
                  onStage={() => handleStageFile(item.filepath)}
                  onAccept={() => handleAcceptFile(item.filepath)}
                  onReject={() => handleRejectFile(item.filepath)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Diff Preview */}
        {preview && selectedFile && (
          <div className="p-3 border-t border-white/5">
            <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">
              Preview: {preview.filepath}
            </div>
            <div className="bg-black/30 rounded-lg border border-white/5 overflow-hidden">
              <div className="p-3 overflow-x-auto max-h-[300px] overflow-y-auto custom-scrollbar">
                <pre className="text-[11px] font-mono leading-relaxed text-white/70 whitespace-pre-wrap break-all">
                  {preview.current || '(empty file)'}
                </pre>
              </div>
            </div>
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => handleAcceptFile(preview.filepath)}
                className="flex-1 py-1.5 rounded-lg text-[10px] font-bold bg-green-600/20 text-green-400 hover:bg-green-600/30 transition-colors flex items-center justify-center gap-1 border border-green-500/20"
              >
                <div className="i-ph:check-bold text-xs" />
                Accept
              </button>
              <button
                onClick={() => handleRejectFile(preview.filepath)}
                className="flex-1 py-1.5 rounded-lg text-[10px] font-bold bg-red-600/20 text-red-400 hover:bg-red-600/30 transition-colors flex items-center justify-center gap-1 border border-red-500/20"
              >
                <div className="i-ph:x-bold text-xs" />
                Reject
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Commit Section */}
      <div className="p-4 border-t border-flare-elements-borderColor bg-white/2">
        <textarea
          placeholder="Commit message..."
          className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-purple-500/50 min-h-[60px] mb-3 resize-none"
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
        />
        <button
          className={classNames(
            'w-full py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg flex items-center justify-center gap-2',
            commitMessage.trim()
              ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-500/20'
              : 'bg-white/5 text-white/20 cursor-not-allowed border border-white/5',
          )}
          onClick={handleCommit}
          disabled={loading || !commitMessage.trim()}
        >
          {loading ? <div className="i-svg-spinners:90-ring-with-bg" /> : <div className="i-ph:check-bold" />}
          Commit {staged.length > 0 ? `(${staged.length} staged)` : 'changes'}
        </button>
      </div>
    </div>
  );
}

interface FileRowProps {
  item: GitStatus;
  isSelected: boolean;
  isStaged: boolean;
  onClick: () => void;
  onStage: () => void;
  onAccept?: () => void;
  onReject?: () => void;
}

function FileRow({ item, isSelected, isStaged, onClick, onStage, onAccept, onReject }: FileRowProps) {
  return (
    <div
      className={classNames(
        'flex items-center justify-between gap-1 p-2 rounded-lg transition-colors group cursor-pointer',
        {
          'bg-white/8 ring-1 ring-white/10': isSelected,
          'hover:bg-white/5': !isSelected,
        },
      )}
      onClick={onClick}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <StatusIcon status={isStaged ? 'staged' : item.status} />
        <span className="text-xs text-white/70 truncate" title={item.filepath}>
          {item.filepath}
        </span>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {!isStaged && onAccept && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAccept();
            }}
            className="p-1 px-2 rounded-full bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20 transition-all"
            title="Accept changes"
          >
            <div className="i-ph:check-bold text-[10px]" />
          </button>
        )}
        {!isStaged && onReject && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onReject();
            }}
            className="p-1 px-2 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-all"
            title="Reject changes"
          >
            <div className="i-ph:x-bold text-[10px]" />
          </button>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onStage();
          }}
          className="p-1 px-2 rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white border border-white/5 transition-all"
          title={isStaged ? 'Unstage' : 'Stage'}
        >
          <div className={isStaged ? 'i-ph:minus-bold text-[10px]' : 'i-ph:plus-bold text-[10px]'} />
        </button>
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: GitStatus['status'] }) {
  switch (status) {
    case 'modified': {
      return <div className="i-ph:circle-fill text-[8px] text-yellow-500 shrink-0" />;
    }
    case 'added': {
      return <div className="i-ph:circle-fill text-[8px] text-green-500 shrink-0" />;
    }
    case 'deleted': {
      return <div className="i-ph:circle-fill text-[8px] text-red-500 shrink-0" />;
    }
    case 'staged': {
      return <div className="i-ph:circle-fill text-[8px] text-blue-500 shrink-0" />;
    }
    case 'untracked': {
      return <div className="i-ph:circle-fill text-[8px] text-white/20 shrink-0" />;
    }
    default: {
      return <div className="i-ph:circle-fill text-[8px] text-white/20 shrink-0" />;
    }
  }
}
