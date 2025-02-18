import { IndexedDBService } from '../storage/IndexedDBService';
import { Workflow } from './types';
import { WorkflowTemplate } from './template-types';
import { Logger } from '../../utils/logger/Logger';

export class WorkflowStorageService {
  private readonly logger: Logger;
  private readonly db: IndexedDBService;

  constructor() {
    this.logger = new Logger('WorkflowStorageService');
    this.db = new IndexedDBService('js-autoagent-workflows', 1);
  }

  async initialize(): Promise<void> {
    await this.db.initialize();
  }

  async saveWorkflow(workflow: Workflow): Promise<void> {
    try {
      await this.db.transaction('workflows', 'readwrite', async (store) => {
        await store.put(workflow);
      });
    } catch (error) {
      this.logger.error('Failed to save workflow', { error, workflowId: workflow.id });
      throw error;
    }
  }

  async getWorkflow(workflowId: string): Promise<Workflow | null> {
    try {
      return await this.db.transaction('workflows', 'readonly', async (store) => {
        return store.get(workflowId);
      });
    } catch (error) {
      this.logger.error('Failed to get workflow', { error, workflowId });
      throw error;
    }
  }

  async saveTemplate(template: WorkflowTemplate): Promise<void> {
    try {
      await this.db.transaction('templates', 'readwrite', async (store) => {
        await store.put(template);
      });
    } catch (error) {
      this.logger.error('Failed to save template', { error, templateId: template.id });
      throw error;
    }
  }

  async getTemplate(templateId: string): Promise<WorkflowTemplate | null> {
    try {
      return await this.db.transaction('templates', 'readonly', async (store) => {
        return store.get(templateId);
      });
    } catch (error) {
      this.logger.error('Failed to get template', { error, templateId });
      throw error;
    }
  }

  async listTemplates(filter?: TemplateFilter): Promise<WorkflowTemplate[]> {
    try {
      return await this.db.transaction('templates', 'readonly', async (store) => {
        const templates: WorkflowTemplate[] = [];
        const cursor = await store.openCursor();

        while (cursor) {
          const template = cursor.value as WorkflowTemplate;
          if (!filter || this.matchesTemplateFilter(template, filter)) {
            templates.push(template);
          }
          await cursor.continue();
        }

        return templates;
      });
    } catch (error) {
      this.logger.error('Failed to list templates', { error });
      throw error;
    }
  }

  private matchesTemplateFilter(template: WorkflowTemplate, filter: TemplateFilter): boolean {
    if (filter.category && !template.metadata.category.includes(filter.category)) {
      return false;
    }
    if (filter.tags && !filter.tags.every(tag => template.metadata.tags.includes(tag))) {
      return false;
    }
    if (filter.author && template.metadata.author !== filter.author) {
      return false;
    }
    return true;
  }

  async updateTemplateStats(templateId: string, executionTime: number, success: boolean): Promise<void> {
    try {
      await this.db.transaction('templates', 'readwrite', async (store) => {
        const template = await store.get(templateId) as WorkflowTemplate;
        if (!template) return;

        const newUsageCount = template.metadata.usageCount + 1;
        const newAvgTime = template.metadata.averageExecutionTime
          ? (template.metadata.averageExecutionTime * template.metadata.usageCount + executionTime) / newUsageCount
          : executionTime;
        const newSuccessRate = template.metadata.successRate
          ? (template.metadata.successRate * template.metadata.usageCount + (success ? 1 : 0)) / newUsageCount
          : success ? 1 : 0;

        template.metadata = {
          ...template.metadata,
          usageCount: newUsageCount,
          averageExecutionTime: newAvgTime,
          successRate: newSuccessRate,
          lastModified: new Date(),
        };

        await store.put(template);
      });
    } catch (error) {
      this.logger.error('Failed to update template stats', { error, templateId });
      throw error;
    }
  }
}

interface TemplateFilter {
  category?: string;
  tags?: string[];
  author?: string;
} 