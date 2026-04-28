import { type ActionFunctionArgs } from '@remix-run/cloudflare';
import { streamText, type Messages, type StreamingOptions } from '~/lib/.server/llm/stream-text';

interface ChatRequestRuntimeContext {
  previewBaseUrls?: string[];
  browserServerUrl?: string;
  browserServerApiKey?: string;
  browserExtensionBridgeSessionId?: string;
  browserExtensionName?: string;
}

interface ChatRequestBody {
  messages: Messages;
  model?: string;
  preferences?: string;
  mode?: string;
  runtimeContext?: ChatRequestRuntimeContext;
}

function sanitizeRuntimeContext(runtimeContext: ChatRequestRuntimeContext | undefined): ChatRequestRuntimeContext | undefined {
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

export async function action({ context, request }: ActionFunctionArgs) {
  let body: ChatRequestBody;

  try {
    body = (await request.json()) as ChatRequestBody;
  } catch (e) {
    console.error('Failed to parse request body', e);
    throw new Response('Invalid JSON', { status: 400 });
  }

  const { messages, model, preferences, mode, runtimeContext } = body;

  if (!Array.isArray(messages)) {
    throw new Response('Invalid messages payload', { status: 400 });
  }

  const resolvedRuntimeContext = sanitizeRuntimeContext(runtimeContext);
  const nodeEnv = typeof process !== 'undefined' ? process.env : {};
  const hasCloudflareOpenAIKey = !!context.cloudflare?.env?.OPENAI_API_KEY;
  const hasNodeOpenAIKey = !!(nodeEnv.OPENAI_API_KEY || nodeEnv.VITE_OPENAI_API_KEY);
  const hasCloudflareAnthropicKey = !!context.cloudflare?.env?.ANTHROPIC_API_KEY;
  const hasNodeAnthropicKey = !!nodeEnv.ANTHROPIC_API_KEY;

  console.log('Chat API Request:', {
    model,
    messagesCount: messages.length,
    hasOpenAIKey: hasCloudflareOpenAIKey || hasNodeOpenAIKey,
    hasAnthropicKey: hasCloudflareAnthropicKey || hasNodeAnthropicKey,
    openAIKeySource: hasCloudflareOpenAIKey ? 'cloudflare' : hasNodeOpenAIKey ? 'node' : 'none',
    anthropicKeySource: hasCloudflareAnthropicKey ? 'cloudflare' : hasNodeAnthropicKey ? 'node' : 'none',
    hasOpenAIBaseUrl: !!(context.cloudflare?.env?.OPENAI_API_BASE_URL || nodeEnv.OPENAI_API_BASE_URL),
    hasPreferences: !!preferences,
    mode,
    hasRuntimeContext: !!resolvedRuntimeContext,
    previewBaseUrlsCount: resolvedRuntimeContext?.previewBaseUrls?.length || 0,
    hasBrowserServerUrl: !!resolvedRuntimeContext?.browserServerUrl,
    hasBrowserServerApiKey: !!resolvedRuntimeContext?.browserServerApiKey,
    hasBrowserExtensionBridgeSessionId: !!resolvedRuntimeContext?.browserExtensionBridgeSessionId,
    hasBrowserExtensionName: !!resolvedRuntimeContext?.browserExtensionName,
  });

  try {
    const result = await streamText(messages, context.cloudflare?.env, {}, model, preferences, mode, resolvedRuntimeContext);

    return new Response(result.toAIStream(), {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Selected-Model': model || 'default',
      },
    });
  } catch (error) {
    console.error('StreamText Error:', error);

    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
