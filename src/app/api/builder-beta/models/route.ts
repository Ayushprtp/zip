/**
 * Builder Beta Models API Route
 * GET /api/builder-beta/models
 *
 * Returns available AI models for the Builder Beta UI.
 */

import { NextResponse } from 'next/server';

const AVAILABLE_MODELS = [
  { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', provider: 'anthropic', default: true },
  { id: 'claude-3-5-sonnet-20240620', name: 'Claude 3.5 Sonnet', provider: 'anthropic' },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai' },
  { id: 'o3-mini', name: 'o3-mini', provider: 'openai' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'google' },
  { id: 'deepseek-chat', name: 'DeepSeek Chat', provider: 'deepseek' },
  { id: 'deepseek-coder', name: 'DeepSeek Coder', provider: 'deepseek' },
];

export async function GET() {
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;

  return NextResponse.json({
    models: AVAILABLE_MODELS,
    providers: {
      openai: hasOpenAI,
      anthropic: hasAnthropic,
    },
  });
}
