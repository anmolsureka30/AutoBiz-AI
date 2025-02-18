import React, { useEffect, useState } from 'react';
import { WorkflowTemplate } from '../../../core/workflow/template-types';
import { TemplateComparisonService } from '../../../core/workflow/versioning/comparison/TemplateComparisonService';
import { TemplateDiff, StepDiff, ParameterDiff } from '../../../core/workflow/versioning/comparison/types';
import { WorkflowDiagramComponent } from '../WorkflowDiagramComponent';
import styles from './TemplateComparison.module.css';

interface TemplateComparisonProps {
  oldTemplate: WorkflowTemplate;
  newTemplate: WorkflowTemplate;
  comparisonService: TemplateComparisonService;
}

export const TemplateComparison: React.FC<TemplateComparisonProps> = ({
  oldTemplate,
  newTemplate,
  comparisonService,
}) => {
  const [diff, setDiff] = useState<TemplateDiff | null>(null);
  const [activeSection, setActiveSection] = useState<'steps' | 'parameters' | 'metadata'>('steps');

  useEffect(() => {
    const comparison = comparisonService.compareTemplates(oldTemplate, newTemplate);
    setDiff(comparison);
  }, [oldTemplate, newTemplate]);

  if (!diff) {
    return <div className={styles.loading}>Comparing templates...</div>;
  }

  const renderStepDiff = (stepDiff: StepDiff) => (
    <div
      key={stepDiff.stepId}
      className={`${styles.diffItem} ${styles[stepDiff.type]}`}
    >
      <div className={styles.diffHeader}>
        <span className={styles.diffType}>{stepDiff.type}</span>
        <h3>{stepDiff.name}</h3>
      </div>
      {stepDiff.changes && (
        <div className={styles.changes}>
          {stepDiff.changes.dependencies && (
            <div className={styles.changeSection}>
              <h4>Dependencies</h4>
              <ul>
                {stepDiff.changes.dependencies.map(dep => (
                  <li key={dep.dependencyId} className={styles[dep.type]}>
                    {dep.type === 'added' ? '+ ' : '- '}
                    {dep.dependencyId}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {stepDiff.changes.config && (
            <div className={styles.changeSection}>
              <h4>Configuration Changes</h4>
              <div className={styles.configChanges}>
                {stepDiff.changes.config.map(change => (
                  <div key={change.path} className={styles.configChange}>
                    <span className={styles.path}>{change.path}</span>
                    <div className={styles.changeValues}>
                      {change.oldValue !== undefined && (
                        <pre className={styles.oldValue}>
                          - {JSON.stringify(change.oldValue, null, 2)}
                        </pre>
                      )}
                      {change.newValue !== undefined && (
                        <pre className={styles.newValue}>
                          + {JSON.stringify(change.newValue, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderParameterDiff = (paramDiff: ParameterDiff) => (
    <div
      key={paramDiff.parameterId}
      className={`${styles.diffItem} ${styles[paramDiff.type]}`}
    >
      <div className={styles.diffHeader}>
        <span className={styles.diffType}>{paramDiff.type}</span>
        <h3>{paramDiff.name}</h3>
      </div>
      {paramDiff.changes && (
        <div className={styles.changes}>
          {Object.entries(paramDiff.changes).map(([field, value]) => (
            <div key={field} className={styles.parameterChange}>
              <span className={styles.fieldName}>{field}</span>
              <pre className={styles.newValue}>
                {JSON.stringify(value, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderMetadataDiff = () => (
    <div className={styles.metadataDiff}>
      <div className={styles.categoryChanges}>
        <h3>Category Changes</h3>
        <div className={styles.arrayChanges}>
          {diff.metadata.category.added.map(cat => (
            <span key={cat} className={`${styles.arrayItem} ${styles.added}`}>
              + {cat}
            </span>
          ))}
          {diff.metadata.category.removed.map(cat => (
            <span key={cat} className={`${styles.arrayItem} ${styles.removed}`}>
              - {cat}
            </span>
          ))}
        </div>
      </div>
      <div className={styles.tagChanges}>
        <h3>Tag Changes</h3>
        <div className={styles.arrayChanges}>
          {diff.metadata.tags.added.map(tag => (
            <span key={tag} className={`${styles.arrayItem} ${styles.added}`}>
              + {tag}
            </span>
          ))}
          {diff.metadata.tags.removed.map(tag => (
            <span key={tag} className={`${styles.arrayItem} ${styles.removed}`}>
              - {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Template Comparison</h2>
        <div className={styles.versions}>
          <span>{oldTemplate.version}</span>
          <span className={styles.arrow}>→</span>
          <span>{newTemplate.version}</span>
        </div>
      </div>
      <div className={styles.summary}>
        <div className={styles.summaryItem}>
          <span>Steps</span>
          <div className={styles.counts}>
            <span className={styles.added}>+{diff.summary.stepsAdded}</span>
            <span className={styles.removed}>-{diff.summary.stepsRemoved}</span>
            <span className={styles.modified}>~{diff.summary.stepsModified}</span>
          </div>
        </div>
        <div className={styles.summaryItem}>
          <span>Parameters</span>
          <div className={styles.counts}>
            <span className={styles.added}>+{diff.summary.parametersAdded}</span>
            <span className={styles.removed}>-{diff.summary.parametersRemoved}</span>
            <span className={styles.modified}>~{diff.summary.parametersModified}</span>
          </div>
        </div>
      </div>
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeSection === 'steps' ? styles.active : ''}`}
          onClick={() => setActiveSection('steps')}
        >
          Steps
        </button>
        <button
          className={`${styles.tab} ${activeSection === 'parameters' ? styles.active : ''}`}
          onClick={() => setActiveSection('parameters')}
        >
          Parameters
        </button>
        <button
          className={`${styles.tab} ${activeSection === 'metadata' ? styles.active : ''}`}
          onClick={() => setActiveSection('metadata')}
        >
          Metadata
        </button>
      </div>
      <div className={styles.content}>
        {activeSection === 'steps' && (
          <div className={styles.stepDiffs}>
            {diff.steps.map(renderStepDiff)}
          </div>
        )}
        {activeSection === 'parameters' && (
          <div className={styles.parameterDiffs}>
            {diff.parameters.map(renderParameterDiff)}
          </div>
        )}
        {activeSection === 'metadata' && renderMetadataDiff()}
      </div>
    </div>
  );
}; 