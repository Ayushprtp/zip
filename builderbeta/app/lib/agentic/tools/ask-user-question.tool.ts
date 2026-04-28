/**
 * Ask User Question Tool — Pause execution for explicit user input.
 * Supports batched multi-question prompts with optional predefined choices.
 */

import type { Tool, ToolResult, ToolUseContext } from '../types';
import {
  addPendingQuestionRequest,
  failPendingQuestion,
  registerPendingQuestionWaiter,
  type AskUserQuestionItem,
  type AskUserQuestionResponse,
} from '../stores';
import { generateId } from '../executor';

interface AskUserQuestionInputQuestion {
  id?: string;
  prompt: string;
  options?: string[];
}

export interface AskUserQuestionInput {
  title?: string;
  instructions?: string;
  questions: AskUserQuestionInputQuestion[];
  timeout_ms?: number;
}

export interface AskUserQuestionOutput {
  requestId: string;
  status: 'answered' | 'failed';
  answers?: AskUserQuestionResponse['answers'];
  message: string;
}

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;
const MIN_TIMEOUT_MS = 5_000;
const MAX_TIMEOUT_MS = 60 * 60 * 1000;

function normalizeQuestions(questions: AskUserQuestionInputQuestion[]): AskUserQuestionItem[] {
  return questions.map((question, index) => {
    const normalizedOptions = Array.isArray(question.options)
      ? question.options.map((option) => option.trim()).filter(Boolean)
      : undefined;

    return {
      id: question.id?.trim() || `q${index + 1}`,
      prompt: question.prompt.trim(),
      options: normalizedOptions && normalizedOptions.length > 0 ? normalizedOptions : undefined,
    };
  });
}

function validateQuestions(questions: AskUserQuestionInputQuestion[]): string | undefined {
  if (!Array.isArray(questions)) {
    return 'The questions field must be an array.';
  }

  if (questions.length < 1 || questions.length > 4) {
    return 'ask_user_question requires between 1 and 4 questions.';
  }

  for (let index = 0; index < questions.length; index += 1) {
    const question = questions[index];

    if (!question || typeof question.prompt !== 'string' || question.prompt.trim().length === 0) {
      return `Question ${index + 1} must include a non-empty prompt.`;
    }

    if (!Array.isArray(question.options)) {
      continue;
    }

    if (question.options.length === 0) {
      return `Question ${index + 1} options cannot be an empty array.`;
    }

    const trimmedOptions = question.options.map((option) => option.trim()).filter(Boolean);
    if (trimmedOptions.length !== question.options.length) {
      return `Question ${index + 1} options cannot contain empty values.`;
    }
  }

  return undefined;
}

function toErrorResult(requestId: string, error: string): ToolResult<AskUserQuestionOutput> {
  return {
    success: false,
    data: {
      requestId,
      status: 'failed',
      message: error,
    },
    error,
  };
}

export const AskUserQuestionTool: Tool<AskUserQuestionInput, AskUserQuestionOutput> = {
  name: 'ask_user_question',
  displayName: 'Ask User Question',
  description: `Ask the user one or more clarifying/approval questions and pause execution until they answer.

Use when you need explicit user confirmation, preference selection, or missing requirements before continuing.
Questions support optional discrete options, and each question can also receive free-text responses.`,

  inputSchema: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'Optional short heading shown above the question set.',
      },
      instructions: {
        type: 'string',
        description: 'Optional additional context for why these answers are needed.',
      },
      questions: {
        type: 'array',
        description: 'One to four questions to ask the user.',
        minItems: 1,
        maxItems: 4,
        items: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Optional stable ID for the question. Auto-generated if omitted.',
            },
            prompt: {
              type: 'string',
              description: 'The question text shown to the user.',
            },
            options: {
              type: 'array',
              description: 'Optional list of selectable answers.',
              items: {
                type: 'string',
              },
            },
          },
          required: ['prompt'],
        },
      },
      timeout_ms: {
        type: 'number',
        description: `Optional timeout before failing (between ${MIN_TIMEOUT_MS} and ${MAX_TIMEOUT_MS} ms).`,
      },
    },
    required: ['questions'],
  },

  isReadOnly: false,
  isConcurrencySafe: true,
  category: 'agent',
  searchHint: 'ask user question approval confirmation clarification',

  async execute(input: AskUserQuestionInput, context: ToolUseContext): Promise<ToolResult<AskUserQuestionOutput>> {
    const validationError = validateQuestions(input.questions);
    const requestId = `qreq-${generateId()}`;

    if (validationError) {
      return toErrorResult(requestId, validationError);
    }

    const normalizedQuestions = normalizeQuestions(input.questions);
    const timeoutMs = Math.min(
      MAX_TIMEOUT_MS,
      Math.max(MIN_TIMEOUT_MS, Number(input.timeout_ms ?? DEFAULT_TIMEOUT_MS)),
    );

    addPendingQuestionRequest({
      id: requestId,
      taskId: context.taskId,
      source: 'tool',
      title: input.title?.trim() || 'Input needed',
      instructions: input.instructions?.trim() || 'Please answer before execution can continue.',
      questions: normalizedQuestions,
      createdAt: Date.now(),
      status: 'pending',
    });

    let response: AskUserQuestionResponse;

    try {
      response = await new Promise<AskUserQuestionResponse>((resolve, reject) => {
        let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

        const unregister = registerPendingQuestionWaiter(requestId, {
          resolve: (value) => {
            if (timeoutHandle) {
              clearTimeout(timeoutHandle);
            }
            unregister();
            resolve(value);
          },
          reject: (error) => {
            if (timeoutHandle) {
              clearTimeout(timeoutHandle);
            }
            unregister();
            reject(error);
          },
        });

        timeoutHandle = setTimeout(() => {
          const message = `Timed out waiting for user answers after ${Math.round(timeoutMs / 1000)} seconds.`;
          failPendingQuestion(requestId, message);
        }, timeoutMs);
      });
    } catch (error: any) {
      return toErrorResult(requestId, error?.message || 'Failed while waiting for user answers.');
    }

    if (!response || response.answers.length === 0) {
      return toErrorResult(requestId, 'No answers were submitted for ask_user_question.');
    }

    return {
      success: true,
      data: {
        requestId,
        status: 'answered',
        answers: response.answers,
        message: 'User provided answers.',
      },
    };
  },
};
