import { MessageRouter, MessageQueue, QueuedMessage, RoutingConfig } from './types';
import { AgentId } from '../../agents/base/types';
import { Logger } from '../utils/logger';
import { PriorityMessageQueue } from './PriorityMessageQueue';

export class DefaultMessageRouter implements MessageRouter {
  private readonly agents: Map<AgentId, MessageQueue>;
  private readonly config: RoutingConfig;
  private isRunning: boolean = false;
  private processingInterval: NodeJS.Timer | null = null;

  constructor(
    private readonly logger: Logger,
    config: RoutingConfig
  ) {
    this.config = config;
    this.agents = new Map();
  }

  registerAgent(agentId: AgentId): void {
    if (this.agents.has(agentId)) {
      throw new Error(`Agent already registered: ${agentId}`);
    }

    const queue = new PriorityMessageQueue(this.logger, this.config);
    this.agents.set(agentId, queue);

    this.logger.info({
      message: 'Agent registered',
      agentId,
    });
  }

  unregisterAgent(agentId: AgentId): void {
    const queue = this.agents.get(agentId);
    if (!queue) {
      throw new Error(`Agent not registered: ${agentId}`);
    }

    this.agents.delete(agentId);
    this.logger.info({
      message: 'Agent unregistered',
      agentId,
    });
  }

  async sendMessage<T>(message: QueuedMessage<T>): Promise<void> {
    const targetQueue = this.agents.get(message.targetId);
    if (!targetQueue) {
      throw new Error(`Target agent not found: ${message.targetId}`);
    }

    await targetQueue.enqueue(message);
  }

  async start(): Promise<void> {
    if (this.isRunning) return;

    this.isRunning = true;
    this.processingInterval = setInterval(
      () => this.processQueues(),
      100 // Process queues every 100ms
    );

    this.logger.info({
      message: 'Message router started',
    });
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }

    this.logger.info({
      message: 'Message router stopped',
    });
  }

  private async processQueues(): Promise<void> {
    for (const [agentId, queue] of this.agents.entries()) {
      try {
        const message = await queue.dequeue();
        if (!message) continue;

        // Process message
        await this.processMessage(message);
      } catch (error) {
        this.logger.error({
          message: 'Error processing queue',
          agentId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  private async processMessage(message: QueuedMessage): Promise<void> {
    try {
      // Implement message processing logic
      // This could involve calling the target agent's message handler
      this.logger.info({
        message: 'Message processed',
        messageId: message.id,
        sourceId: message.sourceId,
        targetId: message.targetId,
      });
    } catch (error) {
      if (message.attempts < message.maxAttempts) {
        // Requeue with increased attempt count
        await this.sendMessage({
          ...message,
          attempts: message.attempts + 1,
          queuedAt: new Date(),
        });
      } else {
        this.logger.error({
          message: 'Message processing failed',
          messageId: message.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
} 