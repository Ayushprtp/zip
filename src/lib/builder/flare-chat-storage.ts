/**
 * .flare-sh Chat History Storage
 *
 * Stores chat history per-project in a .flare-sh folder structure:
 *   .flare-sh/
 *     chats/
 *       {chatId}.json     – individual chat sessions
 *       index.json         – chat list metadata
 *     tasks/
 *       {taskId}.json      – task plan files
 *
 * All operations go through the API which writes to the server filesystem
 * relative to the project root.
 */

export interface StoredChat {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  mode: "ask" | "plan" | "agent";
  messages: StoredMessage[];
}

export interface StoredMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  mentions?: any[];
}

export interface ChatIndex {
  activeChat: string | null;
  chats: Array<{
    id: string;
    title: string;
    createdAt: number;
    updatedAt: number;
    mode: string;
    messageCount: number;
  }>;
}

export interface TaskPlan {
  id: string;
  chatId: string;
  title: string;
  createdAt: number;
  status: "pending" | "in-progress" | "completed";
  tasks: TaskItem[];
}

export interface TaskItem {
  id: string;
  label: string;
  description: string;
  status: "pending" | "in-progress" | "completed" | "failed";
  subtasks?: TaskItem[];
}

// Generate a short unique ID
function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * In-memory chat manager that persists to the builder store files.
 * For the web IDE, we store chats in the virtual file system under .flare-sh/
 */
export class FlareChatStorage {
  private projectFiles: Record<string, string>;
  private updateFile: (path: string, content: string) => void;
  private deleteFile: (path: string) => void;
  private chatPrefix = "/.flare-sh/chats/";
  private indexPath = "/.flare-sh/chats/index.json";
  private taskPrefix = "/.flare-sh/tasks/";

  constructor(
    files: Record<string, string>,
    updateFile: (path: string, content: string) => void,
    deleteFile: (path: string) => void,
  ) {
    this.projectFiles = files;
    this.updateFile = updateFile;
    this.deleteFile = deleteFile;
  }

  /** Update file references (call when project files change) */
  updateFiles(files: Record<string, string>) {
    this.projectFiles = files;
  }

  /** Read the chat index */
  getIndex(): ChatIndex {
    const raw = this.projectFiles[this.indexPath];
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {
        // corrupted, rebuild
      }
    }
    return { activeChat: null, chats: [] };
  }

  /** Write the chat index */
  private saveIndex(index: ChatIndex) {
    this.updateFile(this.indexPath, JSON.stringify(index, null, 2));
  }

  /** Get a specific chat by ID */
  getChat(chatId: string): StoredChat | null {
    const raw = this.projectFiles[`${this.chatPrefix}${chatId}.json`];
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    }
    return null;
  }

  /** Save a chat */
  private saveChat(chat: StoredChat) {
    this.updateFile(
      `${this.chatPrefix}${chat.id}.json`,
      JSON.stringify(chat, null, 2),
    );
  }

  /** Create a new chat session */
  createChat(
    mode: "ask" | "plan" | "agent" = "agent",
    title?: string,
  ): StoredChat {
    const id = generateId();
    const now = Date.now();
    const chat: StoredChat = {
      id,
      title: title || `Chat ${new Date().toLocaleTimeString()}`,
      createdAt: now,
      updatedAt: now,
      mode,
      messages: [],
    };

    this.saveChat(chat);

    // Update index
    const index = this.getIndex();
    index.chats.push({
      id: chat.id,
      title: chat.title,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
      mode: chat.mode,
      messageCount: 0,
    });
    index.activeChat = chat.id;
    this.saveIndex(index);

    return chat;
  }

  /** Add a message to a chat */
  addMessage(
    chatId: string,
    role: "user" | "assistant" | "system",
    content: string,
    mentions?: any[],
  ): StoredMessage | null {
    const chat = this.getChat(chatId);
    if (!chat) return null;

    const msg: StoredMessage = {
      id: generateId(),
      role,
      content,
      timestamp: Date.now(),
      mentions,
    };

    chat.messages.push(msg);
    chat.updatedAt = Date.now();
    this.saveChat(chat);

    // Update index counts
    const index = this.getIndex();
    const entry = index.chats.find((c) => c.id === chatId);
    if (entry) {
      entry.messageCount = chat.messages.length;
      entry.updatedAt = chat.updatedAt;
      this.saveIndex(index);
    }

    return msg;
  }

  /** Set active chat */
  setActiveChat(chatId: string) {
    const index = this.getIndex();
    index.activeChat = chatId;
    this.saveIndex(index);
  }

  /** Delete a chat session */
  deleteChat(chatId: string) {
    this.deleteFile(`${this.chatPrefix}${chatId}.json`);
    const index = this.getIndex();
    index.chats = index.chats.filter((c) => c.id !== chatId);
    if (index.activeChat === chatId) {
      index.activeChat = index.chats.length > 0 ? index.chats[0].id : null;
    }
    this.saveIndex(index);
  }

  /** Rename a chat */
  renameChat(chatId: string, newTitle: string) {
    const chat = this.getChat(chatId);
    if (!chat) return;
    chat.title = newTitle;
    this.saveChat(chat);

    const index = this.getIndex();
    const entry = index.chats.find((c) => c.id === chatId);
    if (entry) {
      entry.title = newTitle;
      this.saveIndex(index);
    }
  }

  /** List all chat IDs + metadata (from index) */
  listChats(): ChatIndex["chats"] {
    return this.getIndex().chats;
  }

  // ─── Task Plans ───────────────────────────────────────────────────────

  /** Save a task plan */
  saveTaskPlan(plan: TaskPlan) {
    this.updateFile(
      `${this.taskPrefix}${plan.id}.json`,
      JSON.stringify(plan, null, 2),
    );
  }

  /** Get a task plan */
  getTaskPlan(planId: string): TaskPlan | null {
    const raw = this.projectFiles[`${this.taskPrefix}${planId}.json`];
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    }
    return null;
  }

  /** Save the task plan to the unified tasklist.json */
  saveTaskList(plan: TaskPlan) {
    this.updateFile(
      "/.flare-sh/tasks/tasklist.json",
      JSON.stringify(plan, null, 2),
    );
  }

  /** Get the unified task list */
  getTaskList(): TaskPlan | null {
    const raw = this.projectFiles["/.flare-sh/tasks/tasklist.json"];
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    }
    return null;
  }

  /** List task plans */
  listTaskPlans(): TaskPlan[] {
    const plans: TaskPlan[] = [];
    for (const path of Object.keys(this.projectFiles)) {
      if (path.startsWith(this.taskPrefix) && path.endsWith(".json")) {
        try {
          plans.push(JSON.parse(this.projectFiles[path]));
        } catch {
          continue;
        }
      }
    }
    return plans.sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Parse AI plan response (markdown format) into hierarchical tasks.
   *
   * Handles:
   * - ## H2 headers → top-level tasks (phase/section)
   * - ### H3 headers → subtasks of the nearest H2
   * - #### H4 headers → subtasks of the nearest H3
   * - Numbered lists (1., 2., 1.1, etc.) → tasks at appropriate depth
   * - Bullet points (- or *) → subtasks inside the current context
   * - **Bold text** within bullets/numbers as task labels
   */
  static parsePlanToTasks(planText: string): TaskItem[] {
    const tasks: TaskItem[] = [];
    const lines = planText.split("\n");

    let taskCounter = 0;
    // Stack tracks parent containers at each depth
    // level 1 = h2, level 2 = h3, level 3 = h4/numbered, level 4 = bullets
    const stack: { level: number; items: TaskItem[] }[] = [
      { level: 0, items: tasks },
    ];

    function getNextId(): string {
      taskCounter++;
      return `task-${taskCounter}`;
    }

    function pushToLevel(level: number, item: TaskItem) {
      // Pop stack to the right level
      while (stack.length > 1 && stack[stack.length - 1].level >= level) {
        stack.pop();
      }
      const parent = stack[stack.length - 1];
      parent.items.push(item);
      if (item.subtasks) {
        stack.push({ level, items: item.subtasks });
      }
    }

    function cleanText(text: string): string {
      // Remove markdown bold/italic markers
      return text
        .replace(/\*\*/g, "")
        .replace(/\*/g, "")
        .replace(/__/g, "")
        .trim();
    }

    function extractTitleAndDesc(text: string): {
      title: string;
      desc: string;
    } {
      // If text has a colon or dash separator, split into title + description
      const boldMatch = text.match(/^\*\*(.+?)\*\*[:\-–—]?\s*(.*)/);
      if (boldMatch) {
        return {
          title: boldMatch[1].trim(),
          desc: boldMatch[2].trim() || boldMatch[1].trim(),
        };
      }
      // Check for colon separator
      const colonIdx = text.indexOf(":");
      if (colonIdx > 0 && colonIdx < 60) {
        return {
          title: cleanText(text.substring(0, colonIdx)),
          desc:
            cleanText(text.substring(colonIdx + 1)) ||
            cleanText(text.substring(0, colonIdx)),
        };
      }
      return { title: cleanText(text), desc: cleanText(text) };
    }

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Skip code blocks
      if (trimmed.startsWith("```")) continue;

      // Skip pure metadata lines like "---", "===", or lines that are just symbols
      if (/^[-=]{3,}$/.test(trimmed)) continue;

      // ## H2 headers → top-level tasks (Phase / Section)
      const h2Match = trimmed.match(/^##\s+(.+)/);
      if (h2Match && !trimmed.startsWith("###")) {
        const text = h2Match[1].trim();
        // Skip overview/generic headers
        if (
          /^(project overview|technology stack|timeline|additional|table of contents)/i.test(
            text,
          )
        )
          continue;

        const { title } = extractTitleAndDesc(text);
        const item: TaskItem = {
          id: getNextId(),
          label: `${tasks.length + 1}`,
          description: title,
          status: "pending",
          subtasks: [],
        };
        // Reset stack to root
        while (stack.length > 1) stack.pop();
        stack[0].items.push(item);
        stack.push({ level: 1, items: item.subtasks! });
        continue;
      }

      // ### H3 headers → subtasks of the current H2
      const h3Match = trimmed.match(/^###\s+(.+)/);
      if (h3Match && !trimmed.startsWith("####")) {
        const text = h3Match[1].trim();
        const { title } = extractTitleAndDesc(text);
        // Pop to h2 level
        while (stack.length > 2) stack.pop();
        // If no H2 parent, create at root
        if (stack.length < 2) {
          while (stack.length > 1) stack.pop();
        }
        const parent = stack[stack.length - 1];
        const item: TaskItem = {
          id: getNextId(),
          label: `${stack.length > 1 ? (stack[1].items.length > 0 ? tasks.length : tasks.length + 1) : tasks.length + 1}.${parent.items.length + 1}`,
          description: title,
          status: "pending",
          subtasks: [],
        };
        parent.items.push(item);
        stack.push({ level: 2, items: item.subtasks! });
        continue;
      }

      // #### H4 headers → subtasks of current H3
      const h4Match = trimmed.match(/^####\s+(.+)/);
      if (h4Match) {
        const text = h4Match[1].trim();
        const { title } = extractTitleAndDesc(text);
        while (stack.length > 3) stack.pop();
        if (stack.length < 3) {
          // No parent h3, add under current context
        }
        const parent = stack[stack.length - 1];
        const item: TaskItem = {
          id: getNextId(),
          label: `${parent.items.length + 1}`,
          description: title,
          status: "pending",
          subtasks: [],
        };
        parent.items.push(item);
        stack.push({ level: 3, items: item.subtasks! });
        continue;
      }

      // Numbered items: "1.", "2.", "1.1", "1.1.1", "1)", etc.
      const numMatch = trimmed.match(/^(\d+(?:\.\d+)*)[.)]\s+(.+)/);
      if (numMatch) {
        const numbering = numMatch[1];
        const text = numMatch[2];
        const numLevel = numbering.split(".").length;
        const { title } = extractTitleAndDesc(text);

        const item: TaskItem = {
          id: getNextId(),
          label: numbering,
          description: title,
          status: "pending",
          subtasks: [],
        };

        // Determine where to attach: numbered depth + stack context
        const targetLevel = Math.min(
          numLevel + (stack.length > 1 ? stack[1].level : 0),
          stack.length + 1,
        );
        pushToLevel(targetLevel, item);
        continue;
      }

      // Bullet points: "- item" or "* item"
      const bulletMatch = trimmed.match(/^[-*]\s+(.+)/);
      if (bulletMatch) {
        const text = bulletMatch[1];
        // Skip lines that look like descriptions (too long, starts with lowercase)
        if (text.length > 120 && text[0] === text[0].toLowerCase()) continue;
        // Skip tech stack listing lines like "**Framework**: React.js"
        if (/^\*\*\w+\*\*:\s/.test(text) && text.length < 50) continue;

        const { title } = extractTitleAndDesc(text);
        const parent = stack[stack.length - 1];

        const item: TaskItem = {
          id: getNextId(),
          label: `${parent.items.length + 1}`,
          description: title,
          status: "pending",
        };
        parent.items.push(item);
        continue;
      }
    }

    // Clean up empty subtasks arrays
    function cleanSubtasks(items: TaskItem[]) {
      for (const item of items) {
        if (item.subtasks && item.subtasks.length === 0) {
          delete item.subtasks;
        } else if (item.subtasks) {
          cleanSubtasks(item.subtasks);
        }
      }
    }
    cleanSubtasks(tasks);

    // If no tasks were parsed (fallback), create a single task
    if (tasks.length === 0) {
      tasks.push({
        id: getNextId(),
        label: "1",
        description: "Review and implement the plan above",
        status: "pending",
      });
    }

    return tasks;
  }
}
