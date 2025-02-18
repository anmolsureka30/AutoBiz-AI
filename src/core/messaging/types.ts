import { AgentId, AgentMessage, MessagePriority } from '../../agents/base/types';

export interface MessageQueue<T = unknown> {
  enqueue(message: QueuedMessage<T>): Promise<void>;
  dequeue(): Promise<QueuedMessage<T> | null>;
  peek(): Promise<QueuedMessage<T> | null>;
  size(): Promise<number>;
  clear(): Promise<void>;
}

export interface QueuedMessage<T = unknown> extends AgentMessage<T> {
  sourceId: AgentId;
  targetId: AgentId;
  queuedAt: Date;
  attempts: number;
  maxAttempts: number;
}

export interface MessageRouter {
  registerAgent(agentId: AgentId): void;
  unregisterAgent(agentId: AgentId): void;
  sendMessage<T>(message: QueuedMessage<T>): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
}

export interface MessageSubscriber {
  onMessage(message: QueuedMessage): Promise<void>;
}

export interface RoutingConfig {
  maxQueueSize: number;
  maxRetries: number;
  retryDelay: number;
  priorityLevels: {
    [K in MessagePriority]: {
      maxWaitTime: number;
      weight: number;
    };
  };
} 