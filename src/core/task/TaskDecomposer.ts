import { Task, TaskType, TaskPriority, TaskMetadata } from './types';
import { Logger } from '../../utils/logger';
import { Document } from '../../agents/document/types';

export interface DecompositionStrategy<TInput = unknown, TOutput = unknown> {
  shouldDecompose(task: Task<TInput, TOutput>): boolean;
  decompose(task: Task<TInput, TOutput>): Promise<Task[]>;
}

export class TaskDecomposer {
  private strategies: Map<TaskType, DecompositionStrategy>;

  constructor(private readonly logger: Logger) {
    this.strategies = new Map();
    this.registerDefaultStrategies();
  }

  registerStrategy(type: TaskType, strategy: DecompositionStrategy): void {
    this.strategies.set(type, strategy);
  }

  async shouldDecomposeTask(task: Task): Promise<boolean> {
    const strategy = this.strategies.get(task.type as TaskType);
    if (!strategy) return false;

    return strategy.shouldDecompose(task);
  }

  async decomposeTask(task: Task): Promise<Task[]> {
    const strategy = this.strategies.get(task.type as TaskType);
    if (!strategy) {
      throw new Error(`No decomposition strategy found for task type: ${task.type}`);
    }

    try {
      const subtasks = await strategy.decompose(task);
      this.logger.info({
        message: 'Task decomposed',
        taskId: task.id,
        type: task.type,
        subtaskCount: subtasks.length
      });
      return subtasks;
    } catch (error) {
      this.logger.error({
        message: 'Task decomposition failed',
        taskId: task.id,
        type: task.type,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  private registerDefaultStrategies(): void {
    // Register document processing strategies
    this.registerStrategy('document_analysis', new DocumentAnalysisStrategy());
    this.registerStrategy('document_summarization', new DocumentSummarizationStrategy());
  }
}

// Example strategies for different task types

class DocumentAnalysisStrategy implements DecompositionStrategy<Document, unknown> {
  shouldDecompose(task: Task<Document>): boolean {
    const document = task.input;
    // Decompose if document is large or complex
    return (
      document.content.length > 10000 || // Large document
      document.metadata.type === 'pdf' || // Complex format
      (document.metadata.pageCount || 0) > 5 // Multi-page document
    );
  }

  async decompose(task: Task<Document>): Promise<Task[]> {
    const document = task.input;
    const subtasks: Task[] = [];

    // Split by sections or pages
    const sections = this.splitDocument(document);
    
    for (let i = 0; i < sections.length; i++) {
      const subtask: Task = {
        id: `${task.id}-section-${i}`,
        type: 'document_section_analysis',
        status: 'pending',
        priority: task.priority,
        input: {
          content: sections[i],
          metadata: {
            ...document.metadata,
            section: i + 1,
            totalSections: sections.length
          }
        },
        metadata: this.createSubtaskMetadata(task.metadata),
        parentTaskId: task.id
      };
      subtasks.push(subtask);
    }

    // Add a consolidation task
    subtasks.push({
      id: `${task.id}-consolidate`,
      type: 'document_analysis_consolidation',
      status: 'pending',
      priority: task.priority,
      input: {
        taskId: task.id,
        sectionCount: sections.length
      },
      metadata: this.createSubtaskMetadata(task.metadata),
      parentTaskId: task.id,
      dependencies: subtasks.map(t => ({
        taskId: t.id,
        type: 'hard'
      }))
    });

    return subtasks;
  }

  private splitDocument(document: Document): string[] {
    // Implement document splitting logic
    // This could be based on:
    // - Natural section breaks
    // - Page boundaries
    // - Size limits
    // - Content type
    return [];
  }

  private createSubtaskMetadata(parentMetadata: TaskMetadata): TaskMetadata {
    return {
      createdAt: new Date(),
      attempts: 0,
      maxAttempts: parentMetadata.maxAttempts,
      resourceUsage: {
        cpu: 0,
        memory: 0,
        duration: 0
      }
    };
  }
}

class DocumentSummarizationStrategy implements DecompositionStrategy<Document, unknown> {
  shouldDecompose(task: Task<Document>): boolean {
    const document = task.input;
    return document.content.length > 5000; // Decompose long documents
  }

  async decompose(task: Task<Document>): Promise<Task[]> {
    const document = task.input;
    const subtasks: Task[] = [];

    // Split into chunks for summarization
    const chunks = this.splitIntoChunks(document.content);
    
    // Create chunk summarization tasks
    for (let i = 0; i < chunks.length; i++) {
      subtasks.push({
        id: `${task.id}-chunk-${i}`,
        type: 'chunk_summarization',
        status: 'pending',
        priority: task.priority,
        input: {
          content: chunks[i],
          metadata: {
            chunkIndex: i,
            totalChunks: chunks.length
          }
        },
        metadata: {
          createdAt: new Date(),
          attempts: 0,
          maxAttempts: task.metadata.maxAttempts
        },
        parentTaskId: task.id
      });
    }

    // Add final summary consolidation task
    subtasks.push({
      id: `${task.id}-consolidate`,
      type: 'summary_consolidation',
      status: 'pending',
      priority: task.priority,
      input: {
        taskId: task.id,
        chunkCount: chunks.length
      },
      metadata: {
        createdAt: new Date(),
        attempts: 0,
        maxAttempts: task.metadata.maxAttempts
      },
      parentTaskId: task.id,
      dependencies: subtasks.map(t => ({
        taskId: t.id,
        type: 'hard'
      }))
    });

    return subtasks;
  }

  private splitIntoChunks(content: string): string[] {
    // Split content into manageable chunks
    // This could be based on:
    // - Sentence boundaries
    // - Paragraph breaks
    // - Fixed size limits
    // - Semantic units
    return [];
  }
} 