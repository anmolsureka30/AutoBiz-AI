import React, { useState, useEffect } from 'react';
import { WorkflowTemplate } from '../../../core/workflow/template-types';
import { TemplateList } from './TemplateList';
import { TemplateDetails } from './TemplateDetails';
import { TemplateComparison } from './TemplateComparison';
import { TemplateMigration } from './TemplateMigration';
import { TemplateRegistry } from '../../../core/workflow/templates/TemplateRegistry';
import { TemplateComparisonService } from '../../../core/workflow/versioning/comparison/TemplateComparisonService';
import { TemplateMigrationService } from '../../../core/workflow/versioning/TemplateMigrationService';
import styles from './TemplateManagement.module.css';

export const TemplateManagementView: React.FC = () => {
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<WorkflowTemplate | null>(null);
  const [comparisonTemplate, setComparisonTemplate] = useState<WorkflowTemplate | null>(null);
  const [activeView, setActiveView] = useState<'details' | 'compare' | 'migrate'>('details');

  const registry = new TemplateRegistry();
  const comparisonService = new TemplateComparisonService();
  const migrationService = new TemplateMigrationService();

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    const loadedTemplates = registry.listTemplates();
    setTemplates(loadedTemplates);
  };

  const handleTemplateSelect = (template: WorkflowTemplate) => {
    setSelectedTemplate(template);
    setActiveView('details');
  };

  const handleCompareSelect = (template: WorkflowTemplate) => {
    setComparisonTemplate(template);
    setActiveView('compare');
  };

  const handleMigrateClick = () => {
    setActiveView('migrate');
  };

  return (
    <div className={styles.container}>
      <div className={styles.sidebar}>
        <TemplateList
          templates={templates}
          selectedTemplate={selectedTemplate}
          onTemplateSelect={handleTemplateSelect}
        />
      </div>
      <div className={styles.content}>
        {activeView === 'details' && selectedTemplate && (
          <TemplateDetails
            template={selectedTemplate}
            onCompareClick={handleCompareSelect}
            onMigrateClick={handleMigrateClick}
          />
        )}
        {activeView === 'compare' && selectedTemplate && comparisonTemplate && (
          <TemplateComparison
            oldTemplate={selectedTemplate}
            newTemplate={comparisonTemplate}
            comparisonService={comparisonService}
          />
        )}
        {activeView === 'migrate' && selectedTemplate && (
          <TemplateMigration
            template={selectedTemplate}
            migrationService={migrationService}
            onMigrationComplete={loadTemplates}
          />
        )}
      </div>
    </div>
  );
}; 