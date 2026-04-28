import { atom } from 'nanostores';

export interface AuthSession {
  githubToken?: string;
  figmaToken?: string;
  githubUser?: {
    login: string;
    avatar_url: string;
  };
  githubInstallationId?: number;
}

export const authStore = atom<AuthSession>({});

/**
 * GitHub App installation flow:
 * User clicks "Install GitHub App" -> redirected to GitHub App install page
 * After install, GitHub redirects back with `installation_id` and `setup_action`
 * We then exchange that for an installation access token via our backend
 */
export function getGithubAppInstallUrl(appSlug: string) {
  return `https://github.com/apps/${appSlug}/installations/new`;
}

export function getFigmaAuthUrl(clientId: string, redirectUri: string) {
  const scope = 'file_read,file_write';

  return `https://www.figma.com/oauth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&state=${Math.random().toString(36).substring(7)}&response_type=code`;
}

export async function saveAuthToken(type: 'github' | 'figma', token: string) {
  const session = authStore.get();
  authStore.set({ ...session, [`${type}Token`]: token });

  // persist to localStorage
  localStorage.setItem(`flare_${type}_token`, token);
}

export function saveGithubInstallation(installationId: number, token: string) {
  const session = authStore.get();

  authStore.set({
    ...session,
    githubToken: token,
    githubInstallationId: installationId,
  });

  localStorage.setItem('flare_github_token', token);
  localStorage.setItem('flare_github_installation_id', String(installationId));
}

export function loadAuthTokens() {
  const githubToken = localStorage.getItem('flare_github_token');
  const figmaToken = localStorage.getItem('flare_figma_token');
  const installationId = localStorage.getItem('flare_github_installation_id');

  if (githubToken || figmaToken) {
    authStore.set({
      ...authStore.get(),
      githubToken: githubToken || undefined,
      figmaToken: figmaToken || undefined,
      githubInstallationId: installationId ? Number(installationId) : undefined,
    });
  }
}

export function disconnectGithub() {
  const session = authStore.get();

  authStore.set({
    ...session,
    githubToken: undefined,
    githubUser: undefined,
    githubInstallationId: undefined,
  });

  localStorage.removeItem('flare_github_token');
  localStorage.removeItem('flare_github_installation_id');
}
