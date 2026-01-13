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

import { errorIf, safe } from "ts-safe";

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
import { nanoBananaTool, openaiImageTool } from "lib/ai/tools/image";
import { ImageToolName } from "lib/ai/tools";
import { buildCsvIngestionPreviewParts } from "@/lib/ai/ingest/csv-ingest";
import { serverFileStorage } from "lib/file-storage";
import { getUserApiKeys } from "lib/ai/user-api-keys";

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
    } = chatApiSchemaRequestBodySchema.parse(json);
    message.parts ??= [];

    // Get user's personal API keys
    const userApiKeys = await getUserApiKeys();
    const model = customModelProvider.getModel(chatModel, userApiKeys);

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
    const MCP_TOOLS = await safe()
      .map(errorIf(() => !isToolCallAllowed && "Not allowed"))
      .map(() =>
        loadMcpTools({
          mentions,
          allowedMcpServers,
        }),
      )
      .unwrap();

    const WORKFLOW_TOOLS = await safe()
      .map(errorIf(() => !isToolCallAllowed && "Not allowed"))
      .map(() =>
        loadWorkFlowTools({
          mentions,
          dataStream: undefined as any,
        }),
      )
      .unwrap();

    const APP_DEFAULT_TOOLS = await safe()
      .map(errorIf(() => !isToolCallAllowed && "Not allowed"))
      .map(() =>
        loadAppDefaultTools({
          mentions,
          allowedAppDefaultToolkit,
        }),
      )
      .unwrap();
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

    const mcpServerCustomizations = await safe()
      .map(() => {
        if (Object.keys(MCP_TOOLS ?? {}).length === 0)
          throw new Error("No tools found");
        return rememberMcpServerCustomizationsAction(session.user.id);
      })
      .map((v) => filterMcpServerCustomizations(MCP_TOOLS!, v))
      .orElse({});

    const systemPrompt = mergeSystemPrompt(
      buildUserSystemPrompt(session.user, userPreferences, agent),
      buildMcpServerCustomizationsSystemPrompt(mcpServerCustomizations),
      !supportToolCall && buildToolCallUnsupportedModelSystemPrompt,
    );

    const IMAGE_TOOL: Record<string, Tool> = useImageTool
      ? {
          [ImageToolName]:
            imageTool?.model === "google" ? nanoBananaTool : openaiImageTool,
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
        // Basic placeholder to allow compilation
        try {
          if (event.response?.messages?.length) {
            // Logic would go here
          }
        } catch (e) {
          console.error(e);
        }
      },
    });

    // Return the text stream response
    return result.toTextStreamResponse();
  } catch (error: any) {
    logger.error(error);
    return Response.json({ message: error.message }, { status: 500 });
  }
}
