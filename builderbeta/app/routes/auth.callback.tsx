import { useEffect } from 'react';
import { useSearchParams, useNavigate } from '@remix-run/react';
import { saveAuthToken, saveGithubInstallation } from '~/lib/runtime/auth';
import { toast } from 'react-toastify';

export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const installationId = searchParams.get('installation_id');
    const setupAction = searchParams.get('setup_action');
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      toast.error(`Authentication failed: ${error}`);
      navigate('/');

      return;
    }

    // GitHub App installation callback
    if (installationId) {
      handleGithubAppInstall(Number(installationId), setupAction);

      return;
    }

    // Figma OAuth callback (legacy)
    if (code) {
      exchangeFigmaCode(code);
    }
  }, [searchParams]);

  async function handleGithubAppInstall(installationId: number, setupAction: string | null) {
    try {
      if (setupAction === 'install' || setupAction === 'update' || !setupAction) {
        // exchange installation_id for an access token via our backend
        const response = await fetch('/api/auth/github', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ installationId }),
        });

        const data = (await response.json()) as {
          error?: string;
          access_token?: string;
          installation_id?: number;
        };

        if (data.error) {
          throw new Error(data.error);
        }

        if (!data.access_token) {
          throw new Error('No access token received');
        }

        saveGithubInstallation(installationId, data.access_token);
        toast.success('GitHub App installed & connected!');
      }

      navigate('/');
    } catch (error: any) {
      toast.error(`GitHub App installation failed: ${error.message}`);
      navigate('/');
    }
  }

  async function exchangeFigmaCode(code: string) {
    try {
      const response = await fetch('/api/auth/figma', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          redirectUri: window.location.origin + '/auth/callback',
        }),
      });

      const data = (await response.json()) as { error?: string; access_token?: string };

      if (data.error) {
        throw new Error(data.error);
      }

      if (!data.access_token) {
        throw new Error('No access token received');
      }

      await saveAuthToken('figma', data.access_token);
      toast.success('Figma connected successfully!');
      navigate('/');
    } catch (error: any) {
      toast.error(`Failed to exchange code: ${error.message}`);
      navigate('/');
    }
  }

  return (
    <div className="flex items-center justify-center h-full bg-flare-elements-background-depth-1">
      <div className="flex flex-col items-center gap-4">
        <div className="i-svg-spinners:90-ring-with-bg text-white text-4xl"></div>
        <div className="text-white/70 text-lg font-medium">Connecting to Flare...</div>
      </div>
    </div>
  );
}
