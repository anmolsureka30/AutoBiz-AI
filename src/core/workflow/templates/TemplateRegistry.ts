import { WorkflowTemplate } from '../template-types';
import { documentAnalysisTemplate } from './DocumentAnalysisTemplate';
import { dataExtractionTemplate } from './DataExtractionTemplate';
import { documentSummarizationTemplate } from './DocumentSummarizationTemplate';
import { Logger } from '../../../utils/logger/Logger';

export class TemplateRegistry {
  private readonly logger: Logger;
  private readonly templates: Map<string, WorkflowTemplate>;

  constructor() {
    this.logger = new Logger('TemplateRegistry');
    this.templates = new Map();
    this.registerDefaultTemplates();
  }

  private registerDefaultTemplates(): void {
    this.registerTemplate(documentAnalysisTemplate);
    this.registerTemplate(dataExtractionTemplate);
    this.registerTemplate(documentSummarizationTemplate);
  }

  registerTemplate(template: WorkflowTemplate): void {
    if (this.templates.has(template.id)) {
      this.logger.warn('Template already registered, updating', { templateId: template.id });
    }
    this.templates.set(template.id, template);
  }

  getTemplate(id: string): WorkflowTemplate | undefined {
    return this.templates.get(id);
  }

  listTemplates(): WorkflowTemplate[] {
    return Array.from(this.templates.values());
  }

  getTemplatesByCategory(category: string): WorkflowTemplate[] {
    return this.listTemplates().filter(template => 
      template.metadata.category.includes(category)
    );
  }
} 