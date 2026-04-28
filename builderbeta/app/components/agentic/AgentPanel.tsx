import { useStore } from '@nanostores/react';
import { memo, useEffect, useMemo, useState } from 'react';
import {
  agentsStore,
  activeToolCalls,
  agentDefinitionsStore,
  skillDefinitionsStore,
  isCoordinatorMode,
  pendingQuestionRequests,
  registerQuestionUiConsumer,
  type AskUserQuestionRequest,
  type AskUserQuestionResponse,
} from '~/lib/agentic/stores';
import { useAgenticExecutor } from '~/lib/hooks/useAgenticExecutor';
import type { AgentState, AgentDefinition, SkillDefinition } from '~/lib/agentic/types';

export const AgentPanel = memo(() => {
  const agents = useStore(agentsStore);
  const toolCalls = useStore(activeToolCalls);
  const agentDefs = useStore(agentDefinitionsStore);
  const skills = useStore(skillDefinitionsStore);
  const coordMode = useStore(isCoordinatorMode);
  const questionRequests = useStore(pendingQuestionRequests);
  const { submitQuestionAnswers } = useAgenticExecutor();
  const [activeTab, setActiveTab] = useState<'agents' | 'tools' | 'skills' | 'questions'>('agents');

  useEffect(() => {
    const unregister = registerQuestionUiConsumer();
    return unregister;
  }, []);

  const agentList = Object.values(agents);
  const activeTools = Object.entries(toolCalls);
  const runningAgents = agentList.filter((a) => a.status === 'running');
  const pendingQuestions = useMemo(
    () => Object.values(questionRequests).filter((request) => request.status === 'pending'),
    [questionRequests],
  );

  return (
    <div className="agent-panel">
      <div className="agent-panel-header">
        <div className="agent-panel-title">
          <div className="agent-panel-icon">🧠</div>
          <span>Agentic System</span>
          {runningAgents.length > 0 && <span className="agent-running-badge">{runningAgents.length} active</span>}
        </div>
        <div className="agent-panel-controls">
          <button
            className={`coordinator-toggle ${coordMode ? 'active' : ''}`}
            onClick={() => isCoordinatorMode.set(!coordMode)}
            title="Toggle Coordinator Mode"
          >
            ⚡
          </button>
        </div>
      </div>

      <div className="agent-panel-tabs">
        <button className={`agent-tab ${activeTab === 'agents' ? 'active' : ''}`} onClick={() => setActiveTab('agents')}>
          🤖 Agents {agentList.length > 0 ? `(${agentList.length})` : ''}
        </button>
        <button className={`agent-tab ${activeTab === 'tools' ? 'active' : ''}`} onClick={() => setActiveTab('tools')}>
          🔧 Tools {activeTools.length > 0 ? `(${activeTools.length})` : ''}
        </button>
        <button className={`agent-tab ${activeTab === 'skills' ? 'active' : ''}`} onClick={() => setActiveTab('skills')}>
          ⚡ Skills
        </button>
        <button className={`agent-tab ${activeTab === 'questions' ? 'active' : ''}`} onClick={() => setActiveTab('questions')}>
          ❓ Questions {pendingQuestions.length > 0 ? `(${pendingQuestions.length})` : ''}
        </button>
      </div>

      <div className="agent-panel-content">
        {activeTab === 'agents' && <AgentsList agents={agentList} definitions={agentDefs} />}
        {activeTab === 'tools' && <ToolCallsList toolCalls={activeTools} />}
        {activeTab === 'skills' && <SkillsList skills={skills} />}
        {activeTab === 'questions' && <PendingQuestionsList requests={pendingQuestions} onSubmit={submitQuestionAnswers} />}
      </div>
    </div>
  );
});

const PendingQuestionsList = memo(({
  requests,
  onSubmit,
}: {
  requests: AskUserQuestionRequest[];
  onSubmit: (input: { requestId: string; answers: AskUserQuestionResponse['answers'] }) => Promise<{ success: boolean; error?: string }>;
}) => {
  if (requests.length === 0) {
    return (
      <div className="agent-empty">
        <div className="agent-empty-icon">❓</div>
        <p>No pending questions</p>
        <p className="agent-empty-hint">Approval and clarification prompts will appear here.</p>
      </div>
    );
  }

  return (
    <div className="agents-list">
      {requests
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((request) => (
          <PendingQuestionCard key={request.id} request={request} onSubmit={onSubmit} />
        ))}
    </div>
  );
});

const PendingQuestionCard = memo(({
  request,
  onSubmit,
}: {
  request: AskUserQuestionRequest;
  onSubmit: (input: { requestId: string; answers: AskUserQuestionResponse['answers'] }) => Promise<{ success: boolean; error?: string }>;
}) => {
  const [selectedByQuestion, setSelectedByQuestion] = useState<Record<string, string>>({});
  const [freeTextByQuestion, setFreeTextByQuestion] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setIsSubmitting(true);
    setError(null);

    const answers = request.questions.map((question) => ({
      questionId: question.id,
      selectedOption: selectedByQuestion[question.id],
      freeText: freeTextByQuestion[question.id],
    }));

    const result = await onSubmit({
      requestId: request.id,
      answers,
    });

    if (!result.success) {
      setError(result.error || 'Failed to submit answers.');
    }

    setIsSubmitting(false);
  };

  return (
    <div className="agent-card agent-card-pending">
      <div className="agent-card-header">
        <div className="agent-card-info">
          <div className="agent-card-title">
            <span className="agent-card-type">Approval Needed</span>
            <span className="agent-card-desc">{request.title || 'Input required'}</span>
          </div>
          {request.instructions && (
            <div className="agent-card-meta">
              <span>{request.instructions}</span>
            </div>
          )}
        </div>
      </div>

      <div className="agent-card-body">
        {request.questions.map((question) => (
          <div key={question.id} style={{ marginBottom: 12 }}>
            <div className="agent-result-label">{question.prompt}</div>

            {question.options && question.options.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                {question.options.map((option) => (
                  <button
                    key={option}
                    className={`agent-tab ${selectedByQuestion[question.id] === option ? 'active' : ''}`}
                    onClick={() => setSelectedByQuestion((prev) => ({ ...prev, [question.id]: option }))}
                    type="button"
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}

            <textarea
              value={freeTextByQuestion[question.id] || ''}
              onChange={(event) => {
                const value = event.target.value;
                setFreeTextByQuestion((prev) => ({ ...prev, [question.id]: value }));
              }}
              placeholder="Optional details"
              style={{ width: '100%', marginTop: 8 }}
              rows={2}
            />
          </div>
        ))}

        {error && (
          <div className="agent-error">
            <div className="agent-error-label">Error:</div>
            <pre className="agent-error-content">{error}</pre>
          </div>
        )}

        <button className="coordinator-toggle active" disabled={isSubmitting} onClick={submit} type="button">
          {isSubmitting ? 'Submitting…' : 'Submit answers'}
        </button>
      </div>
    </div>
  );
});

const AgentsList = memo(({ agents, definitions }: { agents: AgentState[]; definitions: AgentDefinition[] }) => {
  if (agents.length === 0) {
    return (
      <div className="agent-empty">
        <div className="agent-empty-icon">🤖</div>
        <p>No active agents</p>
        <p className="agent-empty-hint">Agents are spawned automatically when the AI needs specialized help.</p>
        <div className="agent-types-grid">
          {definitions.map((def) => (
            <div key={def.agentType} className="agent-type-card">
              <span className="agent-type-icon">{def.icon}</span>
              <span className="agent-type-name">{def.displayName}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="agents-list">
      {agents
        .sort((a, b) => b.startTime - a.startTime)
        .map((agent) => (
          <AgentCard key={agent.id} agent={agent} />
        ))}
    </div>
  );
});

const AgentCard = memo(({ agent }: { agent: AgentState }) => {
  const [expanded, setExpanded] = useState(false);
  const duration = ((agent.endTime ?? Date.now()) - agent.startTime) / 1000;

  const statusColors: Record<string, string> = {
    pending: '#fbbf24',
    running: '#3b82f6',
    completed: '#10b981',
    failed: '#ef4444',
    killed: '#6b7280',
  };

  return (
    <div className={`agent-card agent-card-${agent.status}`}>
      <div className="agent-card-header" onClick={() => setExpanded(!expanded)}>
        <div className="agent-card-status">
          <div
            className={`agent-status-dot ${agent.status === 'running' ? 'pulse' : ''}`}
            style={{ backgroundColor: statusColors[agent.status] }}
          />
        </div>
        <div className="agent-card-info">
          <div className="agent-card-title">
            <span className="agent-card-type">{agent.agentType}</span>
            <span className="agent-card-desc">{agent.description}</span>
          </div>
          <div className="agent-card-meta">
            <span>{duration.toFixed(1)}s</span>
            <span>•</span>
            <span>{agent.toolCalls.length} tool calls</span>
          </div>
        </div>
        <div className="agent-card-chevron">{expanded ? '▼' : '▶'}</div>
      </div>

      {expanded && (
        <div className="agent-card-body">
          {agent.result && (
            <div className="agent-result">
              <div className="agent-result-label">Result:</div>
              <pre className="agent-result-content">{agent.result}</pre>
            </div>
          )}
          {agent.error && (
            <div className="agent-error">
              <div className="agent-error-label">Error:</div>
              <pre className="agent-error-content">{agent.error}</pre>
            </div>
          )}
          {agent.toolCalls.length > 0 && (
            <div className="agent-tool-calls">
              <div className="agent-tool-calls-label">Tool Calls:</div>
              {agent.toolCalls.map((tc) => (
                <div key={tc.id} className={`agent-tool-call agent-tool-call-${tc.status}`}>
                  <span className="tool-call-name">{tc.toolName}</span>
                  <span className={`tool-call-status tool-call-status-${tc.status}`}>{tc.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

const ToolCallsList = memo(({
  toolCalls,
}: {
  toolCalls: [string, { toolName: string; status: string; startTime: number; output?: unknown }][];
}) => {
  if (toolCalls.length === 0) {
    return (
      <div className="agent-empty">
        <div className="agent-empty-icon">🔧</div>
        <p>No active tool calls</p>
        <p className="agent-empty-hint">Tool calls appear here when agents interact with the sandbox.</p>
      </div>
    );
  }

  return (
    <div className="tool-calls-list">
      {toolCalls.map(([id, call]) => (
        <div key={id} className={`tool-call-card tool-call-card-${call.status}`}>
          <div className="tool-call-header">
            <span className="tool-call-name">{call.toolName}</span>
            <span className={`tool-call-badge tool-call-badge-${call.status}`}>{call.status}</span>
          </div>
          <div className="tool-call-time">{((Date.now() - call.startTime) / 1000).toFixed(1)}s</div>
        </div>
      ))}
    </div>
  );
});

const SkillsList = memo(({ skills }: { skills: SkillDefinition[] }) => {
  return (
    <div className="skills-list">
      {skills.length === 0 ? (
        <div className="agent-empty">
          <div className="agent-empty-icon">⚡</div>
          <p>No skills loaded</p>
        </div>
      ) : (
        skills.map((skill) => (
          <div key={skill.name} className="skill-card">
            <div className="skill-icon">{skill.icon || '⚡'}</div>
            <div className="skill-info">
              <div className="skill-name">/{skill.name}</div>
              <div className="skill-desc">{skill.description}</div>
            </div>
          </div>
        ))
      )}
    </div>
  );
});
