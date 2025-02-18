import React, { useState, useEffect } from 'react';
import { WorkflowTemplate } from '../../../core/workflow/template-types';
import { TemplateMigrationService } from '../../../core/workflow/versioning/TemplateMigrationService';
import { MigrationResult } from '../../../core/workflow/versioning/types';
import styles from './TemplateMigration.module.css';

interface TemplateMigrationProps {
  template: WorkflowTemplate;
  migrationService: TemplateMigrationService;
  onMigrationComplete: () => void;
}

export const TemplateMigration: React.FC<TemplateMigrationProps> = ({
  template,
  migrationService,
  onMigrationComplete,
}) => {
  const [targetVersion, setTargetVersion] = useState<string>('');
  const [migrationResult, setMigrationResult] = useState<MigrationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleMigrate = async () => {
    if (!targetVersion) {
      setError('Please select a target version');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await migrationService.migrateTemplate(template, targetVersion);
      setMigrationResult(result);
      
      if (result.success) {
        onMigrationComplete();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Migration failed');
    } finally {
      setIsLoading(false);
    }
  };

  const renderMigrationSummary = () => {
    if (!migrationResult) return null;

    return (
      <div className={styles.summary}>
        <h3>Migration Summary</h3>
        <div className={styles.summaryContent}>
          <div className={styles.versions}>
            <span className={styles.version}>{migrationResult.fromVersion}</span>
            <span className={styles.arrow}>→</span>
            <span className={styles.version}>{migrationResult.toVersion}</span>
          </div>
          <div className={styles.changes}>
            <h4>Changes Applied</h4>
            {migrationResult.changes.map((change, index) => (
              <div key={index} className={styles.change}>
                <span className={styles.changeType}>{change.type}</span>
                <span className={styles.field}>{change.field}</span>
                <span className={styles.action}>{change.action}</span>
              </div>
            ))}
          </div>
          {migrationResult.errors.length > 0 && (
            <div className={styles.errors}>
              <h4>Errors</h4>
              {migrationResult.errors.map((error, index) => (
                <div key={index} className={styles.error}>
                  <span className={styles.errorMessage}>{error.message}</span>
                  {error.details && (
                    <pre className={styles.errorDetails}>
                      {JSON.stringify(error.details, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Template Migration</h2>
        <div className={styles.currentVersion}>
          Current Version: <span>{template.version}</span>
        </div>
      </div>
      <div className={styles.content}>
        <div className={styles.migrationForm}>
          <div className={styles.formGroup}>
            <label htmlFor="targetVersion">Target Version</label>
            <select
              id="targetVersion"
              value={targetVersion}
              onChange={(e) => setTargetVersion(e.target.value)}
              disabled={isLoading}
            >
              <option value="">Select version</option>
              {/* Add available versions */}
              <option value="2.0.0">2.0.0</option>
              <option value="1.1.0">1.1.0</option>
            </select>
          </div>
          {error && <div className={styles.error}>{error}</div>}
          <button
            className={styles.migrateButton}
            onClick={handleMigrate}
            disabled={isLoading || !targetVersion}
          >
            {isLoading ? 'Migrating...' : 'Start Migration'}
          </button>
        </div>
        {migrationResult && renderMigrationSummary()}
      </div>
    </div>
  );
}; 