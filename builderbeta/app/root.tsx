import { useStore } from '@nanostores/react';
import { json, type LoaderFunctionArgs } from '@remix-run/cloudflare';
import type { LinksFunction } from '@remix-run/cloudflare';
import { Links, Meta, Outlet, Scripts, ScrollRestoration, useLoaderData } from '@remix-run/react';
import tailwindReset from '@unocss/reset/tailwind-compat.css?url';
import { themeStore } from './lib/stores/theme';
import { stripIndents } from './utils/stripIndent';
import { createHead } from 'remix-island';
import { useEffect } from 'react';
import { loadAuthTokens } from './lib/runtime/auth';
import { initializeAgenticSystem } from './lib/agentic';

// Initialize the agentic system (tools, agents, skills) on app load
initializeAgenticSystem();

import reactToastifyStyles from 'react-toastify/dist/ReactToastify.css?url';
import globalStyles from './styles/index.scss?url';
import xtermStyles from '@xterm/xterm/css/xterm.css?url';

import 'virtual:uno.css';

export const links: LinksFunction = () => [
  {
    rel: 'icon',
    href: '/favicon.svg',
    type: 'image/svg+xml',
  },
  { rel: 'stylesheet', href: reactToastifyStyles },
  { rel: 'stylesheet', href: tailwindReset },
  { rel: 'stylesheet', href: globalStyles },
  { rel: 'stylesheet', href: xtermStyles },
  {
    rel: 'preconnect',
    href: 'https://fonts.googleapis.com',
  },
  {
    rel: 'preconnect',
    href: 'https://fonts.gstatic.com',
    crossOrigin: 'anonymous',
  },
  {
    rel: 'stylesheet',
    href: 'https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap',
  },
];

const inlineThemeCode = stripIndents`
  function setTutorialKitTheme() {
    let theme = localStorage.getItem('flare_theme');

    if (!theme) {
      theme = 'dark';
    }

    document.querySelector('html')?.setAttribute('data-theme', theme);
  }

  setTutorialKitTheme();
`;

export async function loader({ context }: LoaderFunctionArgs) {
  const env = context.cloudflare.env;

  return json({
    ENV: {
      GITHUB_CLIENT_ID: env.GITHUB_CLIENT_ID,
      FIGMA_CLIENT_ID: env.FIGMA_CLIENT_ID,
      E2B_API_KEY: env.E2B_API_KEY || env.VITE_E2B_API_KEY,
      E2B_TEMPLATE_ID: env.E2B_TEMPLATE_ID || env.VITE_E2B_TEMPLATE_ID,
    },
  });
}

export const Head = createHead(() => {
  const data = useLoaderData<typeof loader>();

  return (
    <>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <Meta />
      <Links />
      <script dangerouslySetInnerHTML={{ __html: inlineThemeCode }} />
      <script
        dangerouslySetInnerHTML={{
          __html: `window.ENV = ${JSON.stringify(data.ENV)}`,
        }}
      />
    </>
  );
});

export function Layout({ children }: { children: React.ReactNode }) {
  const theme = useStore(themeStore);

  useEffect(() => {
    document.querySelector('html')?.setAttribute('data-theme', theme);
    loadAuthTokens();
  }, [theme]);

  return (
    <>
      {children}
      <ScrollRestoration />
      <Scripts />
    </>
  );
}

export default function App() {
  return <Outlet />;
}
