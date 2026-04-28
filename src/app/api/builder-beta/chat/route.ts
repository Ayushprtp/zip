/**
 * Builder Beta Chat API Route
 * POST /api/builder-beta/chat
 *
 * Ported from builderbeta/app/routes/api.chat.ts (Remix) to Next.js App Router.
 */

import { NextRequest, NextResponse } from 'next/server';
import { streamText, type Messages, type LLMRuntimeContext } from '@/lib/builder-beta/server/llm/stream-text';

interface ChatRequestBody {
  messages: Messages;
  model?: string;
  preferences?: string;
  mode?: string;
  runtimeContext?: LLMRuntimeContext;
}

function sanitizeRuntimeContext(runtimeContext: LLMRuntimeContext | undefined): LLMRuntimeContext | undefined {
  if (!runtimeContext) {
    return undefined;
  }

  const previewBaseUrls = Array.isArray(runtimeContext.previewBaseUrls)
    ? runtimeContext.previewBaseUrls
        .map((url) => (typeof url === 'string' ? url.trim() : ''))
        .filter((url): url is string => url.length > 0)
    : undefined;

  const browserServerUrl =
    typeof runtimeContext.browserServerUrl === 'string' && runtimeContext.browserServerUrl.trim().length > 0
      ? runtimeContext.browserServerUrl.trim()
      : undefined;

  const browserServerApiKey =
    typeof runtimeContext.browserServerApiKey === 'string' && runtimeContext.browserServerApiKey.trim().length > 0
      ? runtimeContext.browserServerApiKey.trim()
      : undefined;

  const browserExtensionBridgeSessionId =
    typeof runtimeContext.browserExtensionBridgeSessionId === 'string' &&
    runtimeContext.browserExtensionBridgeSessionId.trim().length > 0
      ? runtimeContext.browserExtensionBridgeSessionId.trim()
      : undefined;

  const browserExtensionName =
    typeof runtimeContext.browserExtensionName === 'string' && runtimeContext.browserExtensionName.trim().length > 0
      ? runtimeContext.browserExtensionName.trim()
      : undefined;

  if (
    !previewBaseUrls?.length &&
    !browserServerUrl &&
    !browserServerApiKey &&
    !browserExtensionBridgeSessionId &&
    !browserExtensionName
  ) {
    return undefined;
  }

  return {
    previewBaseUrls,
    browserServerUrl,
    browserServerApiKey,
    browserExtensionBridgeSessionId,
    browserExtensionName,
  };
}

export async function POST(request: NextRequest) {
  let body: ChatRequestBody;

  try {
    body = (await request.json()) as ChatRequestBody;
  } catch (e) {
    console.error('[Builder Beta Chat] Failed to parse request body', e);
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { messages, model, preferences, mode, runtimeContext } = body;

  if (!Array.isArray(messages)) {
    return NextResponse.json({ error: 'Invalid messages payload' }, { status: 400 });
  }

  const resolvedRuntimeContext = sanitizeRuntimeContext(runtimeContext);

  console.log('[Builder Beta Chat] Request:', {
    model,
    messagesCount: messages.length,
    hasOpenAIKey: !!process.env.OPENAI_API_KEY,
    hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
    hasPreferences: !!preferences,
    mode,
    hasRuntimeContext: !!resolvedRuntimeContext,
  });

  try {
    const result = await streamText(messages, {}, model, preferences, mode, resolvedRuntimeContext);

    return new Response(result.toAIStream(), {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Selected-Model': model || 'default',
      },
    });
  } catch (error) {
    console.error('[Builder Beta Chat] StreamText Error:', error);

    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
