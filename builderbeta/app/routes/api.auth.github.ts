import { type ActionFunctionArgs, json } from '@remix-run/cloudflare';
import * as jose from 'jose';

/**
 * GitHub App Installation Token Exchange
 *
 * This endpoint receives an `installation_id` from the client after
 * the user installs (or has already installed) the GitHub App.
 * It generates a JWT signed with the App's private key, then exchanges
 * that JWT for an installation access token.
 */
export async function action({ request, context }: ActionFunctionArgs) {
  const { installationId } = (await request.json()) as { installationId: number };
  const env = context.cloudflare.env;

  if (!installationId) {
    return json({ error: 'No installation_id provided' }, { status: 400 });
  }

  const appId = env.GITHUB_APP_ID;
  const privateKeyPem = env.GITHUB_APP_PRIVATE_KEY;

  if (!appId || !privateKeyPem) {
    return json({ error: 'GitHub App not configured (missing GITHUB_APP_ID or GITHUB_APP_PRIVATE_KEY)' }, { status: 500 });
  }

  try {
    // generate a JWT for the GitHub App
    const privateKey = await jose.importPKCS8(privateKeyPem, 'RS256');
    const now = Math.floor(Date.now() / 1000);

    const jwt = await new jose.SignJWT({})
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuedAt(now - 60)
      .setExpirationTime(now + 600)
      .setIssuer(appId)
      .sign(privateKey);

    // exchange JWT for an installation access token
    const tokenResponse = await fetch(
      `https://api.github.com/app/installations/${installationId}/access_tokens`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${jwt}`,
          'X-GitHub-Api-Version': '2022-11-28',
        },
      },
    );

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      throw new Error(`GitHub API error (${tokenResponse.status}): ${errText}`);
    }

    const tokenData: any = await tokenResponse.json();

    return json({
      access_token: tokenData.token,
      expires_at: tokenData.expires_at,
      installation_id: installationId,
    });
  } catch (error: any) {
    console.error('GitHub App token exchange failed:', error);

    return json({ error: error.message }, { status: 500 });
  }
}
