/**
 * Template configurations for different project types
 * Defines dependencies, structure, and entry points for each template
 */

import type { TemplateType, TemplateConfig } from "@/types/builder";

export const TEMPLATE_CONFIGS: Record<TemplateType, TemplateConfig> = {
  "vite-react": {
    entry: "/src/main.tsx",
    dependencies: {
      react: "^18.3.1",
      "react-dom": "^18.3.1",
    },
    devDependencies: {
      vite: "^5.4.11",
      "@vitejs/plugin-react": "^4.3.4",
      "@types/react": "^18.3.12",
      "@types/react-dom": "^18.3.1",
    },
    structure: [
      "/index.html",
      "/src/main.tsx",
      "/src/App.tsx",
      "/src/App.css",
      "/src/index.css",
      "/vite.config.ts",
      "/package.json",
    ],
  },
  nextjs: {
    entry: "/app/page.tsx",
    dependencies: {
      next: "^14.2.21",
      react: "^18.3.1",
      "react-dom": "^18.3.1",
    },
    devDependencies: {
      "@types/node": "^20.17.10",
      "@types/react": "^18.3.12",
      "@types/react-dom": "^18.3.1",
      typescript: "^5.7.3",
    },
    structure: [
      "/app/layout.tsx",
      "/app/page.tsx",
      "/app/globals.css",
      "/next.config.js",
      "/tsconfig.json",
      "/package.json",
    ],
  },
  node: {
    entry: "/index.js",
    dependencies: {},
    devDependencies: {
      "@types/node": "^20.17.10",
    },
    runtime: "node",
    structure: ["/index.js", "/package.json"],
  },
  static: {
    entry: "/index.html",
    dependencies: {},
    devDependencies: {},
    runtime: "static",
    structure: ["/index.html", "/style.css", "/script.js"],
  },
  httpchain: {
    entry: "/src/main.tsx",
    dependencies: {
      react: "^18.3.1",
      "react-dom": "^18.3.1",
    },
    devDependencies: {
      vite: "^5.4.11",
      "@vitejs/plugin-react": "^4.3.4",
      "@types/react": "^18.3.12",
      "@types/react-dom": "^18.3.1",
    },
    structure: [
      "/index.html",
      "/src/main.tsx",
      "/src/App.tsx",
      "/src/index.css",
      "/package.json",
    ],
  },
};

/**
 * Get the default files for a template
 */
export function getDefaultFiles(
  template: TemplateType,
): Record<string, string> {
  switch (template) {
    case "vite-react":
      return {
        "/index.html": `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vite + React</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`,
        "/src/main.tsx": `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`,
        "/src/App.tsx": `import React from 'react';
import './App.css';

function App() {
  return (
    <div className="App">
      <h1>Hello from Vite + React!</h1>
      <p>Start building your application.</p>
    </div>
  );
}

export default App;`,
        "/src/App.css": `.App {
  text-align: center;
  padding: 2rem;
}

h1 {
  color: #646cff;
}`,
        "/src/index.css": `body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}`,
        "/vite.config.ts": `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
});`,
        "/package.json": JSON.stringify(
          {
            name: "vite-react-app",
            private: true,
            version: "0.0.0",
            type: "module",
            scripts: {
              dev: "vite",
              build: "vite build",
              preview: "vite preview",
            },
            dependencies: TEMPLATE_CONFIGS["vite-react"].dependencies,
            devDependencies: TEMPLATE_CONFIGS["vite-react"].devDependencies,
          },
          null,
          2,
        ),
      };

    case "nextjs":
      return {
        "/app/layout.tsx": `export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}`,
        "/app/page.tsx": `export default function Home() {
  return (
    <main>
      <h1>Hello from Next.js!</h1>
      <p>Start building your application.</p>
    </main>
  );
}`,
        "/app/globals.css": `body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
}

main {
  padding: 2rem;
}`,
        "/next.config.js": `/** @type {import('next').NextConfig} */
const nextConfig = {};

module.exports = nextConfig;`,
        "/tsconfig.json": JSON.stringify(
          {
            compilerOptions: {
              target: "ES2017",
              lib: ["dom", "dom.iterable", "esnext"],
              allowJs: true,
              skipLibCheck: true,
              strict: true,
              forceConsistentCasingInFileNames: true,
              noEmit: true,
              esModuleInterop: true,
              module: "esnext",
              moduleResolution: "bundler",
              resolveJsonModule: true,
              isolatedModules: true,
              jsx: "preserve",
              incremental: true,
              plugins: [{ name: "next" }],
              paths: { "@/*": ["./*"] },
            },
            include: [
              "next-env.d.ts",
              "**/*.ts",
              "**/*.tsx",
              ".next/types/**/*.ts",
            ],
            exclude: ["node_modules"],
          },
          null,
          2,
        ),
        "/package.json": JSON.stringify(
          {
            name: "nextjs-app",
            version: "0.1.0",
            private: true,
            scripts: {
              dev: "next dev",
              build: "next build",
              start: "next start",
            },
            dependencies: TEMPLATE_CONFIGS.nextjs.dependencies,
            devDependencies: TEMPLATE_CONFIGS.nextjs.devDependencies,
          },
          null,
          2,
        ),
      };

    case "node":
      return {
        "/index.js": `console.log('Hello from Node.js!');

// Your Node.js code here
function greet(name) {
  return \`Hello, \${name}!\`;
}

console.log(greet('World'));`,
        "/package.json": JSON.stringify(
          {
            name: "node-app",
            version: "1.0.0",
            main: "index.js",
            scripts: {
              start: "node index.js",
            },
            dependencies: TEMPLATE_CONFIGS.node.dependencies,
            devDependencies: TEMPLATE_CONFIGS.node.devDependencies,
          },
          null,
          2,
        ),
      };

    case "static":
      return {
        "/index.html": `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Static Site</title>
    <link rel="stylesheet" href="style.css" />
  </head>
  <body>
    <div class="container">
      <h1>Hello from Static HTML!</h1>
      <p>Start building your static site.</p>
    </div>
    <script src="script.js"></script>
  </body>
</html>`,
        "/style.css": `body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  background-color: #f5f5f5;
}

.container {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
  text-align: center;
}

h1 {
  color: #333;
}`,
        "/script.js": `console.log('Hello from JavaScript!');

// Your JavaScript code here
document.addEventListener('DOMContentLoaded', () => {
  console.log('Page loaded!');
});`,
        "/package.json": JSON.stringify(
          {
            name: "static-site",
            version: "1.0.0",
            description: "A static HTML site",
            dependencies: TEMPLATE_CONFIGS.static.dependencies,
            devDependencies: TEMPLATE_CONFIGS.static.devDependencies,
          },
          null,
          2,
        ),
      };

    case "httpchain":
      return {
        "/index.html": `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>HTTP Chain Workflow</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`,
        "/src/main.tsx": `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`,
        "/src/App.tsx": `import React from 'react';

function App() {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">HTTP Chain Workflow</h1>
      <p>This project is configured for the HTTP Chain Builder.</p>
    </div>
  );
}

export default App;`,
        "/src/index.css": `@tailwind base;
@tailwind components;
@tailwind utilities;`,
        "/package.json": JSON.stringify(
          {
            name: "httpchain-workflow",
            private: true,
            version: "0.0.0",
            type: "module",
            scripts: {
              dev: "vite",
              build: "vite build",
              preview: "vite preview",
            },
            dependencies: TEMPLATE_CONFIGS.httpchain.dependencies,
            devDependencies: TEMPLATE_CONFIGS.httpchain.devDependencies,
          },
          null,
          2,
        ),
      };

    default:
      return {};
  }
}
