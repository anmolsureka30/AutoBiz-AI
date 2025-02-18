import React, { useState } from 'react';
import { WorkflowTemplate } from '../../../core/workflow/template-types';
import { WorkflowDiagramComponent } from '../WorkflowDiagramComponent';
import styles from './TemplateDetails.module.css';

interface TemplateDetailsProps {
  template: WorkflowTemplate;
  onCompareClick: (template: WorkflowTemplate) => void;
  onMigrateClick: () => void;
}

export const TemplateDetails: React.FC<TemplateDetailsProps> = ({
  template,
  onCompareClick,
  onMigrateClick,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'steps' | 'parameters' | 'metadata'>('overview');

  const renderOverview = () => (
    <div className={styles.overview}>
      <div className={styles.header}>
        <div className={styles.title}>
          <h1>{template.name}</h1>
          <span className={styles.version}>v{template.version}</span>
        </div>
        <div className={styles.actions}>
          <button onClick={onMigrateClick} className={styles.actionButton}>
            Migrate Template
          </button>
          <button onClick={() => onCompareClick(template)} className={styles.actionButton}>
            Compare Versions
          </button>
        </div>
      </div>
      <p className={styles.description}>{template.description}</p>
      <div className={styles.metadata}>
        <div className={styles.categories}>
          {template.metadata.category.map(category => (
            <span key={category} className={styles.category}>
              {category}
            </span>
          ))}
        </div>
        <div className={styles.tags}>
          {template.metadata.tags.map(tag => (
            <span key={tag} className={styles.tag}>
              {tag}
            </span>
          ))}
        </div>
      </div>
      <div className={styles.workflowPreview}>
        <WorkflowDiagramComponent
          graph={{
            nodes: template.steps.map(step => ({
              id: step.templateId,
              label: step.name,
              type: step.type,
              status: 'pending',
              position: { x: 0, y: 0 }, // Position will be calculated by layout engine
            })),
            edges: template.steps.flatMap(step =>
              step.dependencies.map(dep => ({
                id: `${dep}-${step.templateId}`,
                source: dep,
                target: step.templateId,
                type: 'dependency',
              }))
            ),
          }}
        />
      </div>
    </div>
  );

  const renderSteps = () => (
    <div className={styles.steps}>
      {template.steps.map(step => (
        <div key={step.templateId} className={styles.step}>
          <div className={styles.stepHeader}>
            <h3>{step.name}</h3>
            <span className={styles.stepType}>{step.type}</span>
          </div>
          <p className={styles.stepDescription}>{step.description}</p>
          {step.dependencies.length > 0 && (
            <div className={styles.dependencies}>
              <h4>Dependencies:</h4>
              <ul>
                {step.dependencies.map(dep => (
                  <li key={dep}>{template.steps.find(s => s.templateId === dep)?.name || dep}</li>
                ))}
              </ul>
            </div>
          )}
          {step.config && (
            <div className={styles.config}>
              <h4>Configuration:</h4>
              <pre>{JSON.stringify(step.config, null, 2)}</pre>
            </div>
          )}
        </div>
      ))}
    </div>
  );

  const renderParameters = () => (
    <div className={styles.parameters}>
      {template.parameters.map(param => (
        <div key={param.id} className={styles.parameter}>
          <div className={styles.parameterHeader}>
            <h3>{param.name}</h3>
            <div className={styles.parameterMeta}>
              <span className={styles.parameterType}>{param.type}</span>
              {param.required && <span className={styles.required}>Required</span>}
            </div>
          </div>
          <p className={styles.parameterDescription}>{param.description}</p>
          {param.defaultValue !== undefined && (
            <div className={styles.defaultValue}>
              <h4>Default Value:</h4>
              <pre>{JSON.stringify(param.defaultValue, null, 2)}</pre>
            </div>
          )}
          {param.validation && (
            <div className={styles.validation}>
              <h4>Validation Rules:</h4>
              <pre>{JSON.stringify(param.validation, null, 2)}</pre>
            </div>
          )}
        </div>
      ))}
    </div>
  );

  const renderMetadata = () => (
    <div className={styles.metadataDetails}>
      <div className={styles.metadataSection}>
        <h3>Template Information</h3>
        <div className={styles.metadataGrid}>
          <div className={styles.metadataItem}>
            <label>Created</label>
            <span>{new Date(template.metadata.created).toLocaleString()}</span>
          </div>
          <div className={styles.metadataItem}>
            <label>Last Modified</label>
            <span>{new Date(template.metadata.lastModified).toLocaleString()}</span>
          </div>
          <div className={styles.metadataItem}>
            <label>Author</label>
            <span>{template.metadata.author}</span>
          </div>
        </div>
      </div>
      <div className={styles.metadataSection}>
        <h3>Usage Statistics</h3>
        <div className={styles.metadataGrid}>
          <div className={styles.metadataItem}>
            <label>Usage Count</label>
            <span>{template.metadata.usageCount}</span>
          </div>
          <div className={styles.metadataItem}>
            <label>Average Execution Time</label>
            <span>{(template.metadata.averageExecutionTime / 1000).toFixed(2)}s</span>
          </div>
          <div className={styles.metadataItem}>
            <label>Success Rate</label>
            <span>{(template.metadata.successRate * 100).toFixed(1)}%</span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className={styles.container}>
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'overview' ? styles.active : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'steps' ? styles.active : ''}`}
          onClick={() => setActiveTab('steps')}
        >
          Steps
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'parameters' ? styles.active : ''}`}
          onClick={() => setActiveTab('parameters')}
        >
          Parameters
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'metadata' ? styles.active : ''}`}
          onClick={() => setActiveTab('metadata')}
        >
          Metadata
        </button>
      </div>
      <div className={styles.content}>
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'steps' && renderSteps()}
        {activeTab === 'parameters' && renderParameters()}
        {activeTab === 'metadata' && renderMetadata()}
      </div>
    </div>
  );
}; 