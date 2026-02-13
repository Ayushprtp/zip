import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  Tool,
  UIMessage,
} from "ai";

import { customModelProvider, isToolCallUnsupportedModel } from "lib/ai/models";

import { mcpClientsManager } from "lib/ai/mcp/mcp-manager";

import { chatRepository } from "lib/db/repository";
import globalLogger from "logger";
import {
  buildMcpServerCustomizationsSystemPrompt,
  buildUserSystemPrompt,
  buildToolCallUnsupportedModelSystemPrompt,
} from "lib/ai/prompts";
import {
  chatApiSchemaRequestBodySchema,
  ChatMention,
  ChatMetadata,
} from "app-types/chat";

import { safe } from "ts-safe";

import {
  excludeToolExecution,
  mergeSystemPrompt,
  filterMcpServerCustomizations,
  loadMcpTools,
  loadWorkFlowTools,
  loadAppDefaultTools,
} from "./shared.chat";
import {
  rememberAgentAction,
  rememberMcpServerCustomizationsAction,
} from "./actions";
import { getSession } from "auth/server";
import { colorize } from "consola/utils";
import {
  nanoBananaTool,
  openaiImageTool,
  fluxImageTool,
} from "lib/ai/tools/image";
import { ImageToolName } from "lib/ai/tools";
import { WebAgentDefinition } from "lib/ai/agent/web-agent";
import { buildCsvIngestionPreviewParts } from "@/lib/ai/ingest/csv-ingest";
import { serverFileStorage } from "lib/file-storage";
import { getUserApiKeys } from "lib/ai/user-api-keys";
import { generateUUID } from "lib/utils";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getLocaleAction } from "@/i18n/get-locale";

// Billing imports
import { getCurrentUser, canUserAccessModel } from "lib/auth/rbac-guards";
import { checkRateLimit } from "lib/billing/billing-service";
import {
  getRateLimitCounts,
  getModelDailyUsage,
  logUsage,
  deductCredits,
  getUserCredits,
} from "lib/billing/usage-repository";
import { getModelPricingByModel } from "lib/admin/billing-repository";
import type { UserPlan } from "@/types/roles";

const logger = globalLogger.withDefaults({
  message: colorize("blackBright", `Chat API: `),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();

    const session = await getSession();

    if (!session?.user.id) {
      return new Response("Unauthorized", { status: 401 });
    }
    const {
      id,
      message,
      chatModel,
      toolChoice,
      allowedAppDefaultToolkit,
      allowedMcpServers,
      imageTool,
      mentions = [],
      attachments = [],
      webAgentMode = false,
    } = chatApiSchemaRequestBodySchema.parse(json);
    message.parts ??= [];

    // Get user's personal API keys
    const userApiKeys = await getUserApiKeys();
    const model = customModelProvider.getModel(chatModel, userApiKeys);

    // ====================================================================
    // BILLING ENFORCEMENT
    // ====================================================================
    const currentUser = await getCurrentUser();
    const userPlan: UserPlan = currentUser?.plan || "free";
    const modelProvider = chatModel?.provider || "openai";
    const modelName = chatModel?.model || "gpt-4o-mini";

    // 1. Check model access (plan tier + partner restrictions)
    let modelPricing: Awaited<ReturnType<typeof getModelPricingByModel>> = null;
    try {
      modelPricing = await getModelPricingByModel(modelProvider, modelName);
    } catch (billingErr) {
      // DB may not have billing tables yet — skip enforcement but log
      logger.warn(
        "Billing table lookup failed (skipping enforcement):",
        billingErr,
      );
    }

    if (modelPricing && currentUser) {
      if (!canUserAccessModel(currentUser, modelPricing)) {
        return Response.json(
          {
            error: "model_restricted",
            message: `Your ${userPlan} plan does not have access to ${modelPricing.displayName || modelName}. Please upgrade your plan.`,
          },
          { status: 403 },
        );
      }

      // 2. Check per-model daily limits (if configured)
      const tierSuffix = userPlan.charAt(0).toUpperCase() + userPlan.slice(1);
      const dailyInputLimit = modelPricing[
        `dailyInputTokens${tierSuffix}` as keyof typeof modelPricing
      ] as number | null;
      const dailyOutputLimit = modelPricing[
        `dailyOutputTokens${tierSuffix}` as keyof typeof modelPricing
      ] as number | null;
      const dailyRequestLimit = modelPricing[
        `dailyRequests${tierSuffix}` as keyof typeof modelPricing
      ] as number | null;
      const rpmLimit = modelPricing[
        `rpm${tierSuffix}` as keyof typeof modelPricing
      ] as number | null;

      if (
        dailyInputLimit ||
        dailyOutputLimit ||
        dailyRequestLimit ||
        rpmLimit
      ) {
        const modelUsage = await getModelDailyUsage(
          session.user.id,
          modelProvider,
          modelName,
        );

        if (
          dailyRequestLimit &&
          modelUsage.dailyRequests >= dailyRequestLimit
        ) {
          return Response.json(
            {
              error: "model_daily_request_limit",
              message: `You've reached the daily request limit (${dailyRequestLimit}) for ${modelPricing.displayName || modelName} on your ${userPlan} plan.`,
            },
            { status: 429 },
          );
        }

        if (rpmLimit && modelUsage.minuteRequests >= rpmLimit) {
          return Response.json(
            {
              error: "model_rpm_limit",
              message: `Rate limit exceeded for ${modelPricing.displayName || modelName}. Please wait a moment.`,
            },
            { status: 429 },
          );
        }

        if (dailyInputLimit && modelUsage.dailyInputTokens >= dailyInputLimit) {
          return Response.json(
            {
              error: "model_daily_input_limit",
              message: `You've reached the daily input token limit (${dailyInputLimit.toLocaleString()}) for ${modelPricing.displayName || modelName} on your ${userPlan} plan.`,
            },
            { status: 429 },
          );
        }

        if (
          dailyOutputLimit &&
          modelUsage.dailyOutputTokens >= dailyOutputLimit
        ) {
          return Response.json(
            {
              error: "model_daily_output_limit",
              message: `You've reached the daily output token limit (${dailyOutputLimit.toLocaleString()}) for ${modelPricing.displayName || modelName} on your ${userPlan} plan.`,
            },
            { status: 429 },
          );
        }
      }
    }

    // 3. Check global rate limits (plan-based)
    try {
      const rateCounts = await getRateLimitCounts(session.user.id);
      const rateCheck = checkRateLimit(userPlan, rateCounts);
      if (!rateCheck.allowed) {
        const limitMessages: Record<string, string> = {
          rpm: "Too many requests per minute",
          rpd: "Daily request limit reached",
          tpm: "Token rate limit exceeded",
          tpd: "Daily token limit reached",
          concurrent: "Too many concurrent requests",
        };
        return Response.json(
          {
            error: "rate_limited",
            message:
              limitMessages[rateCheck.limitType || "rpm"] ||
              "Rate limit exceeded",
            limitType: rateCheck.limitType,
            limit: rateCheck.limit,
            resetAt: rateCheck.resetAt?.toISOString(),
          },
          { status: 429 },
        );
      }
    } catch (rateLimitErr) {
      // If rate limit tables not set up, skip enforcement but log
      logger.warn(
        "Rate limit check failed (skipping enforcement):",
        rateLimitErr,
      );
    }

    // 4. Check credit balance
    try {
      const isAdmin =
        currentUser?.role === "super_admin" || currentUser?.role === "admin";
      if (!isAdmin) {
        const userCredits = await getUserCredits(session.user.id);
        const balance = parseFloat(userCredits.balance);
        if (balance <= 0) {
          return Response.json(
            {
              error: "insufficient_credits",
              message:
                "You have no credits remaining. Please purchase more credits or upgrade your plan to continue.",
            },
            { status: 402 },
          );
        }
      }
    } catch (creditsErr) {
      // If credits table not set up, skip enforcement but log
      logger.warn("Credits check failed (skipping enforcement):", creditsErr);
    }
    // ====================================================================
    // END BILLING ENFORCEMENT
    // ====================================================================

    let thread = await chatRepository.selectThreadDetails(id);

    if (!thread) {
      logger.info(`create chat thread: ${id}`);
      const newThread = await chatRepository.insertThread({
        id,
        title: "",
        userId: session.user.id,
      });
      thread = await chatRepository.selectThreadDetails(newThread.id);
    }

    if (thread!.userId !== session.user.id) {
      return new Response("Forbidden", { status: 403 });
    }

    const messages: UIMessage[] = (thread?.messages ?? [])
      .filter((m: any) => m && m.role && m.parts)
      .map((m) => {
        return {
          id: m.id,
          role: m.role,
          content:
            (m.parts || [])
              .filter((p: any) => p.type === "text")
              .map((p: any) => p.text)
              .join("") || "",
          parts: m.parts || [],
          metadata: m.metadata,
        };
      });

    if (messages.at(-1)?.id == message.id) {
      messages.pop();
    }
    const ingestionPreviewParts = await buildCsvIngestionPreviewParts(
      attachments,
      (key) => serverFileStorage.download(key),
    );
    if (ingestionPreviewParts.length) {
      const baseParts = [...(message.parts || [])];
      let insertionIndex = -1;
      for (let i = baseParts.length - 1; i >= 0; i -= 1) {
        if (baseParts[i]?.type === "text") {
          insertionIndex = i;
          break;
        }
      }
      if (insertionIndex !== -1) {
        baseParts.splice(insertionIndex, 0, ...ingestionPreviewParts);
        message.parts = baseParts;
      } else {
        message.parts = [...baseParts, ...ingestionPreviewParts];
      }
    }

    if (attachments.length) {
      const firstTextIndex = (message.parts || []).findIndex(
        (part: any) => part?.type === "text",
      );
      const attachmentParts: any[] = [];

      attachments.forEach((attachment) => {
        const exists = (message.parts || []).some(
          (part: any) =>
            part?.type === attachment.type && part?.url === attachment.url,
        );
        if (exists) return;

        if (attachment.type === "file") {
          attachmentParts.push({
            type: "file",
            url: attachment.url,
            mediaType: attachment.mediaType,
            filename: attachment.filename,
          });
        } else if (attachment.type === "source-url") {
          attachmentParts.push({
            type: "source-url",
            url: attachment.url,
            mediaType: attachment.mediaType,
            title: attachment.filename,
          });
        }
      });

      if (attachmentParts.length) {
        if (firstTextIndex >= 0) {
          message.parts = [
            ...(message.parts || []).slice(0, firstTextIndex),
            ...attachmentParts,
            ...(message.parts || []).slice(firstTextIndex),
          ];
        } else {
          message.parts = [...(message.parts || []), ...attachmentParts];
        }
      }
    }

    messages.push(message);

    const supportToolCall = !isToolCallUnsupportedModel(model);

    const agentId = (
      mentions.find((m) => m.type === "agent") as Extract<
        ChatMention,
        { type: "agent" }
      >
    )?.agentId;

    const agent = await rememberAgentAction(agentId, session.user.id);

    if (agent?.instructions?.mentions) {
      mentions.push(...agent.instructions.mentions);
    }

    // ── Web Agent Mode: inject built-in web agent tools & system prompt ──
    const webAgent = webAgentMode && !agent ? WebAgentDefinition : undefined;
    if (webAgent?.instructions?.mentions) {
      logger.info(
        `🌐 Web Agent mode activated — injecting ${webAgent.instructions.mentions.length} tools`,
      );
      mentions.push(...webAgent.instructions.mentions);
    }

    const useImageTool = Boolean(imageTool?.model);

    const isToolCallAllowed =
      supportToolCall &&
      (toolChoice != "none" || mentions.length > 0) &&
      !useImageTool;

    const mcpClients = await mcpClientsManager.getClients();
    const mcpTools = await mcpClientsManager.tools();
    logger.info(
      `mcp-server count: ${mcpClients.length}, mcp-tools count :${Object.keys(mcpTools).length}`,
    );
    const MCP_TOOLS = isToolCallAllowed
      ? await loadMcpTools({
          mentions,
          allowedMcpServers,
        })
      : {};

    const WORKFLOW_TOOLS = isToolCallAllowed
      ? await loadWorkFlowTools({
          mentions,
          dataStream: undefined as any,
        })
      : {};

    const APP_DEFAULT_TOOLS = isToolCallAllowed
      ? await loadAppDefaultTools({
          mentions,
          allowedAppDefaultToolkit,
        })
      : {};
    // const inProgressToolParts = extractInProgressToolPart(message);
    // Commented out to avoid runtime error with undefined dataStream
    // if (inProgressToolParts.length) {
    //   await Promise.all(
    //     inProgressToolParts.map(async (part) => {
    //       const output = await manualToolExecuteByLastMessage(
    //         part,
    //         { ...MCP_TOOLS, ...WORKFLOW_TOOLS, ...APP_DEFAULT_TOOLS },
    //         request.signal,
    //       );
    //       part.output = output;
    //
    //       dataStream.write({
    //         type: "tool-output-available",
    //         toolCallId: part.toolCallId,
    //         output,
    //       });
    //     }),
    //   );
    // }

    const userPreferences = thread?.userPreferences || undefined;
    const locale = await getLocaleAction();

    const mcpServerCustomizations = await safe()
      .map(() => {
        if (Object.keys(MCP_TOOLS ?? {}).length === 0)
          throw new Error("No tools found");
        return rememberMcpServerCustomizationsAction(session.user.id);
      })
      .map((v) => filterMcpServerCustomizations(MCP_TOOLS!, v))
      .orElse({});

    const systemPrompt = mergeSystemPrompt(
      buildUserSystemPrompt(session.user, userPreferences, agent, locale),
      buildMcpServerCustomizationsSystemPrompt(mcpServerCustomizations),
      !supportToolCall && buildToolCallUnsupportedModelSystemPrompt,
      webAgent?.instructions?.systemPrompt,
    );

    const IMAGE_TOOL: Record<string, Tool> = useImageTool
      ? {
          [ImageToolName]:
            imageTool?.model === "google"
              ? nanoBananaTool
              : imageTool?.model === "flux"
                ? fluxImageTool
                : openaiImageTool,
        }
      : {};
    const vercelAITooles = safe({
      ...MCP_TOOLS,
      ...WORKFLOW_TOOLS,
    })
      .map((t) => {
        const bindingTools =
          toolChoice === "manual" ||
          (message.metadata as ChatMetadata)?.toolChoice === "manual"
            ? excludeToolExecution(t)
            : t;
        return {
          ...bindingTools,
          ...APP_DEFAULT_TOOLS, // APP_DEFAULT_TOOLS Not Supported Manual
          ...IMAGE_TOOL,
        };
      })
      .unwrap();
    // const stream = createUIMessageStream({
    //   chatId: message.id,
    //   process: (dataStream) => { ... },
    //   ...
    // });

    const modelMessages = await convertToModelMessages(messages);
    const filteredMessages = (modelMessages || []).filter(
      (m) =>
        m &&
        ((typeof m.content === "string" && (m.content?.length ?? 0) > 0) ||
          (Array.isArray(m.content) && (m.content?.length ?? 0) > 0) ||
          (m as any).toolCalls ||
          (m as any).toolResults ||
          m.role === "system"),
    );

    // Save user message immediately to ensure it's persisted even if stream is interrupted
    await chatRepository.upsertMessage({
      ...message,
      metadata: message.metadata as ChatMetadata,
      threadId: id,
    });

    // ====================================================================
    // DIRECT IMAGE GENERATION (bypass streamText for reliability)
    // ====================================================================
    if (useImageTool) {
      const imageProvider = imageTool?.model || "flux";
      const userPrompt =
        typeof (message.parts?.find((p: any) => p.type === "text") as any)
          ?.text === "string"
          ? (message.parts.find((p: any) => p.type === "text") as any).text
          : "Generate an image";

      const toolCallId = generateUUID();
      const assistantId = generateUUID();

      try {
        // Directly execute the image generation function
        const imageToolFn =
          imageProvider === "google"
            ? nanoBananaTool
            : imageProvider === "flux"
              ? fluxImageTool
              : openaiImageTool;

        const modelMessages = await convertToModelMessages(messages);
        const toolResult = await (imageToolFn as any).execute(
          { mode: "create", prompt: userPrompt },
          { messages: modelMessages || [], abortSignal: request.signal },
        );

        // Download images and save locally with clean URLs
        const userName = (session.user.name || session.user.id)
          .replace(/[^a-zA-Z0-9_-]/g, "_")
          .toLowerCase();
        if (toolResult.images?.length) {
          const imagesDir = join(process.cwd(), ".data", "images", userName);
          await mkdir(imagesDir, { recursive: true });
          for (let i = 0; i < toolResult.images.length; i++) {
            const img = toolResult.images[i];
            // Skip if already a local URL
            if (img.url.startsWith("/api/images/")) continue;
            try {
              // For external URLs, download and save locally
              const imgResp = await fetch(img.url);
              if (!imgResp.ok) continue;
              const buffer = Buffer.from(await imgResp.arrayBuffer());
              const ext =
                img.mimeType === "image/webp"
                  ? "webp"
                  : img.mimeType === "image/jpeg"
                    ? "jpg"
                    : "png";
              const filename = `img-${generateUUID().slice(0, 8)}.${ext}`;
              await writeFile(join(imagesDir, filename), buffer);
              img.url = `/api/images/${userName}/${filename}`;
            } catch (dlErr) {
              logger.error("Failed to download image:", dlErr);
            }
          }
        }

        // Build assistant message parts
        const assistantParts = [
          {
            type: "tool-invocation" as const,
            toolInvocation: {
              toolCallId,
              toolName: ImageToolName,
              args: { mode: "create", prompt: userPrompt },
              state: "result" as const,
              result: toolResult,
            },
          },
          {
            type: "text" as const,
            text: toolResult.guide || "Image generated successfully.",
          },
        ];

        // Save assistant message
        await chatRepository.upsertMessage({
          id: assistantId,
          role: "assistant",
          parts: assistantParts as any,
          threadId: id,
          metadata: {
            chatModel: {
              provider: imageProvider,
              model: toolResult.model || imageProvider,
            },
            usage: {
              inputTokens: 0,
              outputTokens: 0,
              totalTokens: 0,
              inputTokenDetails: {
                noCacheTokens: undefined,
                cacheReadTokens: undefined,
                cacheWriteTokens: undefined,
              },
              outputTokenDetails: {
                textTokens: undefined,
                reasoningTokens: undefined,
              },
            },
          },
        });

        // Return a SSE stream response using the correct wire protocol
        const textPartId = generateUUID();
        const wireEvents = [
          { type: "start", messageId: assistantId },
          { type: "start-step" },
          {
            type: "tool-input-available",
            toolCallId,
            toolName: ImageToolName,
            input: JSON.stringify({ mode: "create", prompt: userPrompt }),
          },
          {
            type: "tool-output-available",
            toolCallId,
            output: toolResult,
          },
          { type: "text-start", id: textPartId },
          {
            type: "text-delta",
            id: textPartId,
            delta: toolResult.guide || "Image generated successfully.",
          },
          { type: "text-end", id: textPartId },
          { type: "finish-step" },
          { type: "finish", finishReason: "stop" },
        ];

        const sseBody =
          wireEvents.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("") +
          "data: [DONE]\n\n";

        return new Response(sseBody, {
          status: 200,
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
            "X-Vercel-AI-UI-Message-Stream": "v1",
            "X-Accel-Buffering": "no",
          },
        });
      } catch (imageError: any) {
        logger.error("Direct image generation failed:", imageError);
        return Response.json(
          { message: `Image generation failed: ${imageError.message}` },
          { status: 500 },
        );
      }
    }

    // Direct streamText integration
    const result = streamText({
      model,
      system: systemPrompt,
      messages: filteredMessages as any,
      maxRetries: 2,
      tools: vercelAITooles,
      stopWhen: stepCountIs(10),
      toolChoice: "auto",
      abortSignal: request.signal,
      onFinish: async (event) => {
        try {
          // Save assistant message(s)
          if (event.response?.messages?.length) {
            const responseMessages = event.response.messages;

            // Build a map of tool results from role: "tool" messages
            const toolResultMap = new Map<string, any>();
            for (const m of responseMessages) {
              if (m.role === "tool" && Array.isArray(m.content)) {
                for (const part of m.content) {
                  if (part.type === "tool-result") {
                    toolResultMap.set(part.toolCallId, {
                      result: (part as any).result,
                      isError: (part as any).isError || false,
                    });
                  }
                }
              }
            }

            for (const m of responseMessages) {
              const parts: any[] = [];
              if (typeof m.content === "string") {
                parts.push({ type: "text", text: m.content });
              } else if (Array.isArray(m.content)) {
                for (const part of m.content) {
                  if (part.type === "text") {
                    parts.push({ type: "text", text: part.text });
                  } else if (part.type === "tool-call") {
                    // Merge the tool result into the invocation if available
                    const toolResult = toolResultMap.get(part.toolCallId);
                    if (toolResult) {
                      parts.push({
                        type: "tool-invocation",
                        toolInvocation: {
                          toolCallId: part.toolCallId,
                          toolName: part.toolName,
                          args: (part as any).args,
                          state: toolResult.isError
                            ? "output-error"
                            : "output-available",
                          output: toolResult.result,
                        },
                      });
                    } else {
                      parts.push({
                        type: "tool-invocation",
                        toolInvocation: {
                          toolCallId: part.toolCallId,
                          toolName: part.toolName,
                          args: (part as any).args,
                          state: "call",
                        },
                      });
                    }
                  }
                }
              }

              if (m.role === "assistant") {
                await chatRepository.upsertMessage({
                  id: (m as any).id || generateUUID(),
                  role: m.role,
                  parts: parts,
                  threadId: id,
                  metadata: {
                    chatModel: {
                      provider: modelProvider,
                      model: modelName,
                    },
                    usage: event.usage
                      ? {
                          inputTokens: event.usage.inputTokens || 0,
                          outputTokens: event.usage.outputTokens || 0,
                          totalTokens:
                            (event.usage.inputTokens || 0) +
                            (event.usage.outputTokens || 0),
                          inputTokenDetails: event.usage.inputTokenDetails ?? {
                            noCacheTokens: undefined,
                            cacheReadTokens: undefined,
                            cacheWriteTokens: undefined,
                          },
                          outputTokenDetails: event.usage
                            .outputTokenDetails ?? {
                            textTokens: undefined,
                            reasoningTokens: undefined,
                          },
                        }
                      : undefined,
                  },
                });
              }
            }
          }

          // ====================================================================
          // USAGE LOGGING & CREDIT DEDUCTION
          // ====================================================================
          try {
            const usage = event.usage;
            if (
              usage &&
              ((usage.inputTokens ?? 0) > 0 || (usage.outputTokens ?? 0) > 0)
            ) {
              const { usageLog, cost } = await logUsage(session.user.id, {
                threadId: id,
                messageId: message.id,
                provider: modelProvider,
                model: modelName,
                inputTokens: usage.inputTokens || 0,
                outputTokens: usage.outputTokens || 0,
                requestType: "chat",
                status: "success",
              });

              // Deduct credits (non-blocking, don't fail the request)
              if (cost.creditsCharged > 0) {
                try {
                  await deductCredits(
                    session.user.id,
                    cost.creditsCharged,
                    usageLog.id,
                  );
                } catch (creditError) {
                  logger.warn(
                    "Credit deduction failed (user may have insufficient credits):",
                    creditError,
                  );
                }
              }

              logger.info(
                `Usage logged: ${usage.inputTokens} in / ${usage.outputTokens} out, ` +
                  `cost: $${cost.totalCost.toFixed(6)}, credits: ${cost.creditsCharged.toFixed(2)}`,
              );
            }
          } catch (usageError) {
            logger.warn("Failed to log usage:", usageError);
          }
        } catch (e) {
          console.error("Failed to save chat history:", e);
        }
      },
    });

    // Return the UI message stream response (expected by DefaultChatTransport on the client)
    return result.toUIMessageStreamResponse();
  } catch (error: any) {
    logger.error(error);
    return Response.json(
      { message: "An internal error occurred. Please try again." },
      { status: 500 },
    );
  }
}
