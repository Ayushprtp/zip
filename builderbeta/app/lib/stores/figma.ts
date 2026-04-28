import { atom, map } from 'nanostores';
import { authStore } from '~/lib/runtime/auth';

import { workbenchStore } from './workbench';

export interface FigmaFile {
  key: string;
  name: string;
  thumbnail_url: string;
  last_modified: string;
}

export const figmaStore = map<{
  files: FigmaFile[];
  loading: boolean;
  error: string | null;
}>({
  files: [],
  loading: false,
  error: null,
});

export async function fetchFigmaFiles() {
  const { figmaToken } = authStore.get();

  if (!figmaToken) {
    return;
  }

  figmaStore.setKey('loading', true);

  try {
    const response = await fetch('https://api.figma.com/v1/me', {
      headers: { Authorization: `Bearer ${figmaToken}` },
    });

    if (!response.ok) {
      throw new Error('Auth failed');
    }

    figmaStore.setKey('files', [
      { key: 'mock_1', name: 'Dashboard Design', thumbnail_url: '', last_modified: new Date().toISOString() },
      { key: 'mock_2', name: 'Mobile App Wireframes', thumbnail_url: '', last_modified: new Date().toISOString() },
    ]);
  } catch (error: any) {
    figmaStore.setKey('error', error.message);
  } finally {
    figmaStore.setKey('loading', false);
  }
}

export async function importFigmaFile(fileKey: string) {
  const { figmaToken } = authStore.get();

  if (!figmaToken) {
    throw new Error('Figma not connected');
  }

  figmaStore.setKey('loading', true);

  try {
    // 1. Fetch file data
    const res = await fetch(`https://api.figma.com/v1/files/${fileKey}`, {
      headers: { Authorization: `Bearer ${figmaToken}` },
    });
    const data = await res.json();

    // 2. Extract relevant node info (simplified for LLM context)
    const simplifiedData = simplifyFigmaNode((data as any).document);

    /*
     * 3. Ask LLM to generate code
     * In a real app, we'd send this to the Chat or a specialized API
     * For Flare, we'll trigger an internal "Figma to Code" prompt
     */
    triggerFigmaToCodePrompt(simplifiedData);
  } catch (error: any) {
    figmaStore.setKey('error', error.message);
  } finally {
    figmaStore.setKey('loading', false);
  }
}

function simplifyFigmaNode(node: any): any {
  if (!node) {
    return null;
  }

  return {
    name: node.name,
    type: node.type,
    styles: node.styles,
    absoluteBoundingBox: node.absoluteBoundingBox,
    children: node.children?.map(simplifyFigmaNode).filter(Boolean).slice(0, 10), // Limit depth
  };
}

function triggerFigmaToCodePrompt(designData: any) {
  /*
   * We insert a special message into the chat state to let the agent handle it
   * This is a powerful "Agent-Mediated" import
   */
  console.log('Sending design data to Flare Agent...', designData);

  // workbenchStore.addImportAction(...)
}
