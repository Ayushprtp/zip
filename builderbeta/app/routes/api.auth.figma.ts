import { type ActionFunctionArgs, json } from '@remix-run/cloudflare';

export async function action({ request, context }: ActionFunctionArgs) {
  const { code, redirectUri } = (await request.json()) as { code: string; redirectUri: string };
  const env = context.cloudflare.env;

  if (!code) {
    return json({ error: 'No code provided' }, { status: 400 });
  }

  const clientId = env.FIGMA_CLIENT_ID;
  const clientSecret = env.FIGMA_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return json({ error: 'Figma OAuth not configured' }, { status: 500 });
  }

  try {
    const response = await fetch('https://www.figma.com/api/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });

    const data: any = await response.json();

    if (data.error) {
      throw new Error(data.error_description || data.error);
    }

    return json({ access_token: data.access_token });
  } catch (error: any) {
    return json({ error: error.message }, { status: 500 });
  }
}
