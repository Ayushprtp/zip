import { useStore } from '@nanostores/react';
import { githubStore, fetchUserRepos, searchRepos, type GithubRepo } from '~/lib/stores/github';
import { authStore } from '~/lib/runtime/auth';

import { IconButton } from '~/components/ui/IconButton';
import { useState, useEffect } from 'react';
import { classNames } from '~/utils/classNames';
import { cloneRepository } from '~/lib/runtime/git-service';
import { toast } from 'react-toastify';

export function GithubPanel() {
  const { repos, loading, error } = useStore(githubStore);
  const { githubToken } = useStore(authStore);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (githubToken && repos.length === 0) {
      fetchUserRepos();
    }
  }, [githubToken]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();

    if (searchQuery.trim()) {
      searchRepos(searchQuery);
    } else {
      fetchUserRepos();
    }
  };

  if (!githubToken) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <div className="i-ph:github-logo-duotone text-5xl text-white/20 mb-4" />
        <h3 className="text-white font-bold mb-2">Connect GitHub</h3>
        <p className="text-white/50 text-xs mb-4">Integrate your repositories to start importing projects.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-flare-elements-background-depth-1">
      <div className="p-4 border-b border-flare-elements-borderColor">
        <h3 className="text-white font-bold mb-3 flex items-center gap-2">
          <div className="i-ph:github-logo-fill" />
          Repositories
        </h3>
        <form onSubmit={handleSearch} className="relative">
          <input
            type="text"
            placeholder="Search your repos..."
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 pl-8 text-xs text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-white/30"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div className="absolute left-2.5 top-1/2 -translate-y-1/2 i-ph:magnifying-glass text-white/30" />
        </form>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <div className="i-svg-spinners:90-ring-with-bg text-white/50 text-2xl" />
          </div>
        ) : error ? (
          <div className="p-4 text-center text-red-400 text-xs">{error}</div>
        ) : (
          <div className="divide-y divide-white/5">
            {repos.map((repo) => (
              <RepoItem key={repo.id} repo={repo} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RepoItem({ repo }: { repo: GithubRepo }) {
  const [isCloning, setIsCloning] = useState(false);

  const handleClone = async () => {
    setIsCloning(true);

    try {
      await cloneRepository(repo.html_url, repo.name);
      toast.success(`Successfully cloned ${repo.name}!`);
    } catch (error: any) {
      toast.error(`Failed to clone: ${error.message}`);
    } finally {
      setIsCloning(false);
    }
  };

  return (
    <div className="p-3 hover:bg-white/5 transition-colors group">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-white text-xs font-bold truncate mb-0.5" title={repo.full_name}>
            {repo.name}
          </div>
          <div className="text-white/40 text-[10px] truncate" title={repo.description}>
            {repo.description || 'No description'}
          </div>
        </div>
        <IconButton
          icon={isCloning ? 'i-svg-spinners:90-ring-with-bg' : 'i-ph:download-simple-bold'}
          size="sm"
          title="Clone to Workspace"
          onClick={handleClone}
          disabled={isCloning}
          className="opacity-0 group-hover:opacity-100 transition-opacity bg-flare-elements-item-backgroundAccent text-flare-elements-item-contentAccent rounded-lg"
        />
      </div>
      <div className="flex items-center gap-3 mt-2">
        <div className="flex items-center gap-1 text-[10px] text-white/30">
          <div className="i-ph:circle-fill text-[8px] text-zinc-500" />
          {repo.language || 'Unknown'}
        </div>
        <div className="flex items-center gap-1 text-[10px] text-white/30">
          <div className="i-ph:star-bold" />
          {repo.stargazers_count}
        </div>
        <div className="text-[10px] text-white/20 ml-auto">{new Date(repo.updated_at).toLocaleDateString()}</div>
      </div>
    </div>
  );
}
