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

  /** Parse AI plan response into tasks */
  static parsePlanToTasks(planText: string): TaskItem[] {
    const tasks: TaskItem[] = [];
    const lines = planText.split("\n");

    // Stack to track nesting: [level, parentReference]
    const stack: { level: number; items: TaskItem[] }[] = [
      { level: 0, items: tasks },
    ];

    for (const line of lines) {
      // Match numbered items like "1.", "1.1", "1.1.1", "2.", etc.
      const match = line.match(/^(\s*)(\d+(?:\.\d+)*)[.)]\s+(.+)/);
      if (!match) continue;

      const numbering = match[2];
      const text = match[3].trim();
      const level = numbering.split(".").length;

      const item: TaskItem = {
        id: `task-${numbering.replace(/\./g, "-")}`,
        label: numbering,
        description: text,
        status: "pending",
        subtasks: [],
      };

      // Find the right parent level
      while (stack.length > 1 && stack[stack.length - 1].level >= level) {
        stack.pop();
      }

      const parent = stack[stack.length - 1];
      parent.items.push(item);

      if (item.subtasks) {
        stack.push({ level, items: item.subtasks });
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

    return tasks;
  }
}
