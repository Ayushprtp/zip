import { type ActionFunctionArgs } from '@remix-run/cloudflare';
import { StreamingTextResponse, parseStreamPart } from 'ai';
import { streamText } from '~/lib/.server/llm/stream-text';
import { stripIndents } from '~/utils/stripIndent';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export async function action({ context, request }: ActionFunctionArgs) {
  let body: any;

  try {
    body = await request.json();
  } catch (e) {
    console.error('Failed to parse request body', e);
    throw new Response('Invalid JSON', { status: 400 });
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
      context.cloudflare?.env,
      {},
      model,
    );

    const transformStream = new TransformStream({
      transform(chunk, controller) {
        const processedChunk = decoder
          .decode(chunk)
          .split('\n')
          .filter((line) => line !== '')
          .map(parseStreamPart)
          .map((part) => part.value)
          .join('');

        controller.enqueue(encoder.encode(processedChunk));
      },
    });

    const transformedStream = result.toAIStream().pipeThrough(transformStream);

    return new StreamingTextResponse(transformedStream);
  } catch (error) {
    console.log(error);

    throw new Response(null, {
      status: 500,
      statusText: 'Internal Server Error',
    });
  }
}
