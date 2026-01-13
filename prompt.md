# AI BUILDER MASTER PLAN (Nodebox Edition)

**Role:** You are the Lead AI Architect running on Claude Opus 4.5.
**Goal:** Implement a "Bolt.new" clone that uses **Sandpack's Nodebox Runtime** to support full-stack frameworks (Next.js, Remix, Vite) directly in the browser.

## CORE ARCHITECTURE
1.  **Runtime:** Use `@codesandbox/sandpack-react`.
2.  **Multi-Framework:** The `SandpackProvider` must accept a dynamic `template` prop (e.g., "nextjs", "vite", "astro").
3.  **Server Controls:** We need manual control over the WebContainer shell to Start, Stop, and Restart the dev server.

---

## EXECUTION PLAN (Execute Sequentially)

### PHASE 1: DEPENDENCIES & CLEANUP
- Install core packages: 
  `npm install @codesandbox/sandpack-react @codesandbox/sandpack-themes lucide-react jszip`
- **CRITICAL:** Do NOT install `next` or `react-scripts` in the main project. Those run *inside* the container.
- Ensure `vite.config.js` is optimized for large asset loading (Sandpack requires it).

### PHASE 2: THE DYNAMIC ENGINE (`SandpackWrapper.jsx`)
Create a robust wrapper component that handles the Nodebox instance.
- **Props:** Accepts `files` (object) and `template` (string).
- **Provider Config:** - Enable `bundlerURL` (if needed for custom Nodebox versions) or stick to standard templates.
  - Set `options={{ externalResources: ["https://cdn.tailwindcss.com"] }}` for quick styling.
- **Layout:**
  - Left: `SandpackCodeEditor` (Closable).
  - Right: `SandpackPreview` (With a custom toolbar).
  - Bottom: `SandpackConsole` (For server logs).

### PHASE 3: SERVER CONTROLS & STATE (`useBuilderEngine.js`)
We need a hook to control the internal environment.
- **Access:** Use `useSandpack()` and `useSandpackClient()` hooks.
- **Features:**
  - **Restart Server:** Logic to trigger the bundler to re-run.
  - **Status Indicator:** Show if the container is "Booting", "Running", or "Idle".
  - **Framework Selector:** Logic to switch templates. Warning: Switching templates wipes the current files (handle this gracefully).

### PHASE 4: THE UI (BUILDER PAGE)
Create a professional IDE layout.
- **Header:** - Framework Dropdown (React, Next.js, Vanilla, Astro).
  - **Server Actions:** [Play Icon] Start, [Square Icon] Stop, [Refresh Icon] Restart.
  - "Download Zip" button.
- **Main Area:** - Split pane view (Chat vs. Builder).
  - "Mobile Preview" Toggle (Resize iframe width).

### PHASE 5: INTELLIGENT PARSING (`AIStreamHandler.js`)
- The AI will stream XML-like tags. You must parse them *while streaming*.
- Regex Rule: Extract content between `<file path="...">` and `</file>`.
- **Auto-Detection:** If the AI creates a `next.config.js`, automatically switch the `template` state to "nextjs".

### PHASE 6: FINAL POLISH
- **Error Handling:** If the preview crashes (White screen), auto-switch the bottom tab to "Console" so the user sees why.
- **Netlify/Vercel:** Add a placeholder "Deploy" button that exports the files to a JSON object (ready for API upload).

---

## IMMEDIATE ACTION
Start with **Phase 1 and Phase 2**. Build the `SandpackWrapper` with the Framework Selector first.
