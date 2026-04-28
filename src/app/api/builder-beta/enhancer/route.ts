/**
 * Builder Beta Enhancer API Route
 * POST /api/builder-beta/enhancer
 *
 * Takes a user prompt and enhances it for optimal AI coding results.
 * Ported from builderbeta/app/routes/api.enhancer.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from 'auth/server';
import { streamText } from '@/lib/builder-beta/server/llm/stream-text';
import { stripIndents } from '@/lib/builder-beta/utils/stripIndent';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  let body: any;

  try {
    body = await request.json();
  } catch (e) {
    console.error('[Builder Beta Enhancer] Failed to parse request body', e);
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { message, model } = body as { message: string; model?: string };

  try {
    const result = await streamText(
      [
        {
          role: 'system',
          content: stripIndents`
            You are a master Prompt Engineer specializing in Software Development and AI Coding Agents.
            Your task is to take a user's raw prompt and enhance it to be the perfect instructions for an elite AI coding agent.
            
            Key objectives for the enhanced prompt:
            1. Be extremely specific and unambiguous.
            2. Infer missing technical details (frameworks, stack, patterns) that make sense for the request.
            3. Structure the prompt logically: Objective, Requirements, Technical Constraints, and Expected Outcomes.
            4. Emphasize production readiness, error handling, and performance.
            5. Instruct the AI to think before acting.
            
            IMPORTANT RULES:
            - Respond ONLY with the enhanced prompt text.
            - Do NOT include any preamble, introduction, or conclusion.
            - Do NOT use XML tags like <enhanced_prompt> in your output.
            - Write from the perspective of the user instructing the AI (e.g., "Create a...", "I need...").
          `,
        },
        {
          role: 'user',
          content: stripIndents`
          Here is the original prompt to enhance:

          ${message}
        `,
        },
      ],
      {},
      model,
    );

    // Stream the result directly — the Builder Beta stream-text already
    // returns an AI-compatible stream format
    const aiStream = result.toAIStream();

    // Transform to extract just the text content from the SSE-like stream
    const transformStream = new TransformStream({
      transform(chunk, controller) {
        const text = decoder.decode(chunk);
        const lines = text.split('\n').filter((line) => line !== '');

        for (const line of lines) {
          // Lines are in format: 0:"text content"
          const match = line.match(/^0:(.+)$/);
          if (match) {
            try {
              const parsed = JSON.parse(match[1]);
              if (typeof parsed === 'string') {
                controller.enqueue(encoder.encode(parsed));
              }
            } catch {
              // Skip unparseable lines
            }
          }
        }
      },
    });

    const transformedStream = aiStream.pipeThrough(transformStream);

    return new Response(transformedStream, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  } catch (error) {
    console.error('[Builder Beta Enhancer] Error:', error);

    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
