import React from 'react';
import { WorkflowTemplate } from '../../../core/workflow/template-types';
import styles from './TemplateList.module.css';

interface TemplateListProps {
  templates: WorkflowTemplate[];
  selectedTemplate: WorkflowTemplate | null;
  onTemplateSelect: (template: WorkflowTemplate) => void;
}

export const TemplateList: React.FC<TemplateListProps> = ({
  templates,
  selectedTemplate,
  onTemplateSelect,
}) => {
  const sortedTemplates = [...templates].sort((a, b) => {
    // Sort by category then name
    const categoryCompare = (a.metadata.category[0] || '').localeCompare(b.metadata.category[0] || '');
    if (categoryCompare !== 0) return categoryCompare;
    return a.name.localeCompare(b.name);
  });

  const groupedTemplates = sortedTemplates.reduce((groups, template) => {
    const category = template.metadata.category[0] || 'Uncategorized';
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(template);
    return groups;
  }, {} as Record<string, WorkflowTemplate[]>);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Workflow Templates</h2>
      </div>
      <div className={styles.list}>
        {Object.entries(groupedTemplates).map(([category, templates]) => (
          <div key={category} className={styles.category}>
            <h3>{category}</h3>
            {templates.map(template => (
              <div
                key={template.id}
                className={`${styles.item} ${
                  selectedTemplate?.id === template.id ? styles.selected : ''
                }`}
                onClick={() => onTemplateSelect(template)}
              >
                <div className={styles.itemHeader}>
                  <span className={styles.name}>{template.name}</span>
                  <span className={styles.version}>v{template.version}</span>
                </div>
                <div className={styles.description}>{template.description}</div>
                <div className={styles.tags}>
                  {template.metadata.tags.map(tag => (
                    <span key={tag} className={styles.tag}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}; 