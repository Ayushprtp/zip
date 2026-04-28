import { atom, map } from 'nanostores';
import { Octokit } from '@octokit/rest';
import { authStore } from '~/lib/runtime/auth';

export interface GithubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string;
  html_url: string;
  stargazers_count: number;
  language: string;
  updated_at: string;
}

export const githubStore = map<{
  repos: GithubRepo[];
  loading: boolean;
  error: string | null;
}>({
  repos: [],
  loading: false,
  error: null,
});

export async function fetchUserRepos() {
  const { githubToken } = authStore.get();

  if (!githubToken) {
    githubStore.setKey('error', 'GitHub not connected');
    return;
  }

  githubStore.setKey('loading', true);
  githubStore.setKey('error', null);

  try {
    const octokit = new Octokit({ auth: githubToken });
    const { data } = await octokit.repos.listForAuthenticatedUser({
      sort: 'updated',
      per_page: 50,
    });

    githubStore.setKey('repos', data as GithubRepo[]);
  } catch (error: any) {
    githubStore.setKey('error', error.message);
  } finally {
    githubStore.setKey('loading', false);
  }
}

export async function searchRepos(query: string) {
  const { githubToken } = authStore.get();

  if (!githubToken) {
    return;
  }

  githubStore.setKey('loading', true);

  try {
    const octokit = new Octokit({ auth: githubToken });
    const { data } = await octokit.search.repos({
      q: `user:${(await octokit.users.getAuthenticated()).data.login} ${query}`,
      sort: 'updated',
    });

    githubStore.setKey('repos', data.items as GithubRepo[]);
  } catch (error: any) {
    githubStore.setKey('error', error.message);
  } finally {
    githubStore.setKey('loading', false);
  }
}
