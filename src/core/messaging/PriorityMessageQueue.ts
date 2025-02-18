import { MessageQueue, QueuedMessage, RoutingConfig } from './types';
import { Logger } from '../utils/logger';
import { MessagePriority } from '../../agents/base/types';

export class PriorityMessageQueue<T = unknown> implements MessageQueue<T> {
  private readonly queues: Map<MessagePriority, QueuedMessage<T>[]>;
  private readonly config: RoutingConfig;

  constructor(
    private readonly logger: Logger,
    config: RoutingConfig
  ) {
    this.config = config;
    this.queues = new Map([
      [1, []], // High priority
      [2, []], // Medium priority
      [3, []], // Low priority
    ]);
  }

  async enqueue(message: QueuedMessage<T>): Promise<void> {
    const queue = this.queues.get(message.priority);
    if (!queue) {
      throw new Error(`Invalid priority level: ${message.priority}`);
    }

    if (this.getTotalSize() >= this.config.maxQueueSize) {
      throw new Error('Queue is full');
    }

    queue.push(message);
    this.logger.info({
      message: 'Message enqueued',
      messageId: message.id,
      priority: message.priority,
      queueSize: queue.length,
    });
  }

  async dequeue(): Promise<QueuedMessage<T> | null> {
    const priorityQueue = this.selectPriorityQueue();
    if (!priorityQueue || priorityQueue.length === 0) {
      return null;
    }

    const message = priorityQueue.shift()!;
    this.logger.info({
      message: 'Message dequeued',
      messageId: message.id,
      priority: message.priority,
    });

    return message;
  }

  async peek(): Promise<QueuedMessage<T> | null> {
    const priorityQueue = this.selectPriorityQueue();
    return priorityQueue && priorityQueue.length > 0 ? priorityQueue[0] : null;
  }

  async size(): Promise<number> {
    return this.getTotalSize();
  }

  async clear(): Promise<void> {
    this.queues.forEach(queue => queue.length = 0);
    this.logger.info({
      message: 'Queue cleared',
    });
  }

  private getTotalSize(): number {
    return Array.from(this.queues.values())
      .reduce((total, queue) => total + queue.length, 0);
  }

  private selectPriorityQueue(): QueuedMessage<T>[] | null {
    // Check high priority first
    const highPriorityQueue = this.queues.get(1);
    if (highPriorityQueue && highPriorityQueue.length > 0) {
      return highPriorityQueue;
    }

    // Calculate weighted scores for medium and low priority queues
    const mediumPriorityQueue = this.queues.get(2);
    const lowPriorityQueue = this.queues.get(3);

    if (!mediumPriorityQueue || !lowPriorityQueue) {
      return null;
    }

    const mediumScore = this.calculateQueueScore(mediumPriorityQueue, 2);
    const lowScore = this.calculateQueueScore(lowPriorityQueue, 3);

    if (mediumScore > lowScore && mediumPriorityQueue.length > 0) {
      return mediumPriorityQueue;
    }

    return lowPriorityQueue.length > 0 ? lowPriorityQueue : null;
  }

  private calculateQueueScore(queue: QueuedMessage<T>[], priority: MessagePriority): number {
    if (queue.length === 0) return 0;

    const config = this.config.priorityLevels[priority];
    const oldestMessage = queue[0];
    const waitTime = Date.now() - oldestMessage.queuedAt.getTime();
    const waitScore = Math.min(waitTime / config.maxWaitTime, 1);

    return waitScore * config.weight;
  }
} 