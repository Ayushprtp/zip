export type RuntimeEventType =
  | 'runtime:session_created'
  | 'runtime:task_created'
  | 'runtime:task_updated'
  | 'runtime:task_output'
  | 'runtime:agent_started'
  | 'runtime:agent_message'
  | 'runtime:agent_tool_start'
  | 'runtime:agent_tool_complete'
  | 'runtime:agent_paused'
  | 'runtime:agent_complete'
  | 'runtime:tool_started'
  | 'runtime:tool_progress'
  | 'runtime:tool_completed'
  | 'runtime:tool_failed';

export interface RuntimeEvent<T = unknown> {
  id: string;
  type: RuntimeEventType;
  sessionId: string;
  taskId?: string;
  timestamp: number;
  data?: T;
}

type RuntimeEventListener = (event: RuntimeEvent) => void;

const listeners = new Set<RuntimeEventListener>();
const eventsBySession = new Map<string, RuntimeEvent[]>();
const MAX_EVENTS_PER_SESSION = 500;

function nextEventId() {
  return `evt-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

export function publishRuntimeEvent<T = unknown>(event: Omit<RuntimeEvent<T>, 'id' | 'timestamp'>): RuntimeEvent<T> {
  const fullEvent: RuntimeEvent<T> = {
    ...event,
    id: nextEventId(),
    timestamp: Date.now(),
  };

  const history = eventsBySession.get(fullEvent.sessionId) ?? [];
  history.push(fullEvent as RuntimeEvent);

  if (history.length > MAX_EVENTS_PER_SESSION) {
    history.splice(0, history.length - MAX_EVENTS_PER_SESSION);
  }

  eventsBySession.set(fullEvent.sessionId, history);

  for (const listener of listeners) {
    try {
      listener(fullEvent);
    } catch (error) {
      console.error('[AgentRuntime] Event listener failed:', error);
    }
  }

  return fullEvent;
}

export function listRuntimeEvents(sessionId: string, options?: { afterEventId?: string; limit?: number }): RuntimeEvent[] {
  const history = eventsBySession.get(sessionId) ?? [];

  let startIndex = 0;

  if (options?.afterEventId) {
    const index = history.findIndex((event) => event.id === options.afterEventId);

    if (index >= 0) {
      startIndex = index + 1;
    }
  }

  const remaining = history.slice(startIndex);

  if (!options?.limit || options.limit <= 0) {
    return remaining;
  }

  return remaining.slice(-options.limit);
}

export function subscribeRuntimeEvents(listener: RuntimeEventListener): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function clearRuntimeEvents(sessionId: string): void {
  eventsBySession.delete(sessionId);
}
