import { AgentId, AgentState } from '../../agents/base/types';
import { StateStore } from './StatePersistence';
import { Logger } from '../../utils/logger';

export class InMemoryStateStore implements StateStore {
  private states: Map<AgentId, AgentState>;
  private readonly logger: Logger;

  constructor(logger: Logger) {
    this.states = new Map();
    this.logger = logger;
  }

  async saveState(agentId: AgentId, state: AgentState): Promise<void> {
    this.states.set(agentId, { ...state });
    this.logger.info({
      message: 'Agent state saved to memory',
      agentId,
      timestamp: new Date(),
    });
  }

  async loadState(agentId: AgentId): Promise<AgentState | null> {
    const state = this.states.get(agentId);
    if (!state) {
      this.logger.info({
        message: 'No state found for agent',
        agentId,
        timestamp: new Date(),
      });
      return null;
    }

    return { ...state };
  }

  async clearState(agentId: AgentId): Promise<void> {
    this.states.delete(agentId);
    this.logger.info({
      message: 'Agent state cleared from memory',
      agentId,
      timestamp: new Date(),
    });
  }

  async getAllStates(): Promise<Map<AgentId, AgentState>> {
    return new Map(this.states);
  }
} 