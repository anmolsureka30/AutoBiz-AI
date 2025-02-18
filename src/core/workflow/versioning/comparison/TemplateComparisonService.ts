import { Logger } from '../../../../utils/logger/Logger';
import { WorkflowTemplate, WorkflowTemplateStep, TemplateParameter } from '../../template-types';
import {
  TemplateDiff,
  StepDiff,
  ParameterDiff,
  MetadataDiff,
  DiffSummary,
  ArrayDiff,
  ConfigChange,
} from './types';

export class TemplateComparisonService {
  private readonly logger: Logger;

  constructor() {
    this.logger = new Logger('TemplateComparisonService');
  }

  compareTemplates(oldTemplate: WorkflowTemplate, newTemplate: WorkflowTemplate): TemplateDiff {
    try {
      const stepDiffs = this.compareSteps(oldTemplate.steps, newTemplate.steps);
      const parameterDiffs = this.compareParameters(oldTemplate.parameters, newTemplate.parameters);
      const metadataDiff = this.compareMetadata(oldTemplate.metadata, newTemplate.metadata);

      const summary = this.generateDiffSummary(stepDiffs, parameterDiffs);

      return {
        fromVersion: oldTemplate.version,
        toVersion: newTemplate.version,
        steps: stepDiffs,
        parameters: parameterDiffs,
        metadata: metadataDiff,
        summary,
      };

    } catch (error) {
      this.logger.error('Template comparison failed', {
        error,
        oldVersion: oldTemplate.version,
        newVersion: newTemplate.version,
      });
      throw error;
    }
  }

  private compareSteps(
    oldSteps: WorkflowTemplateStep[],
    newSteps: WorkflowTemplateStep[]
  ): StepDiff[] {
    const diffs: StepDiff[] = [];
    const processedSteps = new Set<string>();

    // Find modified and unchanged steps
    oldSteps.forEach(oldStep => {
      const newStep = newSteps.find(s => s.templateId === oldStep.templateId);
      if (newStep) {
        processedSteps.add(oldStep.templateId);
        const changes = this.compareStep(oldStep, newStep);
        diffs.push({
          type: Object.keys(changes).length > 0 ? 'modified' : 'unchanged',
          stepId: oldStep.templateId,
          name: newStep.name,
          changes: Object.keys(changes).length > 0 ? changes : undefined,
        });
      } else {
        // Step was removed
        diffs.push({
          type: 'removed',
          stepId: oldStep.templateId,
          name: oldStep.name,
        });
      }
    });

    // Find added steps
    newSteps.forEach(newStep => {
      if (!processedSteps.has(newStep.templateId)) {
        diffs.push({
          type: 'added',
          stepId: newStep.templateId,
          name: newStep.name,
        });
      }
    });

    return diffs;
  }

  private compareStep(
    oldStep: WorkflowTemplateStep,
    newStep: WorkflowTemplateStep
  ): StepDiff['changes'] {
    const changes: StepDiff['changes'] = {};

    // Compare dependencies
    const dependencyChanges = this.compareArrays(oldStep.dependencies, newStep.dependencies);
    if (dependencyChanges.added.length > 0 || dependencyChanges.removed.length > 0) {
      changes.dependencies = [
        ...dependencyChanges.added.map(dep => ({ type: 'added' as const, dependencyId: dep })),
        ...dependencyChanges.removed.map(dep => ({ type: 'removed' as const, dependencyId: dep })),
      ];
    }

    // Compare configuration
    const configChanges = this.compareObjects(oldStep.config || {}, newStep.config || {});
    if (configChanges.length > 0) {
      changes.config = configChanges;
    }

    // Compare other fields
    const otherChanges = this.compareObjects(
      this.getBasicStepFields(oldStep),
      this.getBasicStepFields(newStep)
    );
    if (otherChanges.length > 0) {
      changes.other = otherChanges.map(change => ({
        field: change.path,
        oldValue: change.oldValue,
        newValue: change.newValue,
      }));
    }

    return Object.keys(changes).length > 0 ? changes : undefined;
  }

  private compareParameters(
    oldParams: TemplateParameter[],
    newParams: TemplateParameter[]
  ): ParameterDiff[] {
    const diffs: ParameterDiff[] = [];
    const processedParams = new Set<string>();

    // Find modified and unchanged parameters
    oldParams.forEach(oldParam => {
      const newParam = newParams.find(p => p.id === oldParam.id);
      if (newParam) {
        processedParams.add(oldParam.id);
        const changes = this.compareParameter(oldParam, newParam);
        diffs.push({
          type: Object.keys(changes).length > 0 ? 'modified' : 'unchanged',
          parameterId: oldParam.id,
          name: newParam.name,
          changes: Object.keys(changes).length > 0 ? changes : undefined,
        });
      } else {
        // Parameter was removed
        diffs.push({
          type: 'removed',
          parameterId: oldParam.id,
          name: oldParam.name,
        });
      }
    });

    // Find added parameters
    newParams.forEach(newParam => {
      if (!processedParams.has(newParam.id)) {
        diffs.push({
          type: 'added',
          parameterId: newParam.id,
          name: newParam.name,
        });
      }
    });

    return diffs;
  }

  private compareParameter(
    oldParam: TemplateParameter,
    newParam: TemplateParameter
  ): Partial<ParameterDiff['changes']> {
    const changes: Partial<ParameterDiff['changes']> = {};

    if (oldParam.type !== newParam.type) {
      changes.type = newParam.type;
    }
    if (oldParam.required !== newParam.required) {
      changes.required = newParam.required;
    }
    if (!this.deepEqual(oldParam.defaultValue, newParam.defaultValue)) {
      changes.defaultValue = newParam.defaultValue;
    }
    if (!this.deepEqual(oldParam.validation, newParam.validation)) {
      changes.validation = newParam.validation;
    }

    return changes;
  }

  private compareMetadata(
    oldMetadata: Record<string, unknown>,
    newMetadata: Record<string, unknown>
  ): MetadataDiff {
    const categoryDiff = this.compareArrays(
      oldMetadata.category as string[],
      newMetadata.category as string[]
    );
    const tagsDiff = this.compareArrays(
      oldMetadata.tags as string[],
      newMetadata.tags as string[]
    );

    const diff: MetadataDiff = {
      category: categoryDiff,
      tags: tagsDiff,
    };

    // Compare other metadata fields
    const otherChanges = this.compareObjects(oldMetadata, newMetadata);
    otherChanges.forEach(change => {
      if (!['category', 'tags'].includes(change.path)) {
        diff[change.path] = {
          oldValue: change.oldValue,
          newValue: change.newValue,
          changed: true,
        };
      }
    });

    return diff;
  }

  private compareArrays<T>(oldArray: T[], newArray: T[]): ArrayDiff<T> {
    return {
      added: newArray.filter(item => !oldArray.includes(item)),
      removed: oldArray.filter(item => !newArray.includes(item)),
      unchanged: oldArray.filter(item => newArray.includes(item)),
    };
  }

  private compareObjects(
    oldObj: Record<string, unknown>,
    newObj: Record<string, unknown>
  ): ConfigChange[] {
    const changes: ConfigChange[] = [];

    // Check for modified and removed fields
    Object.entries(oldObj).forEach(([key, oldValue]) => {
      if (!(key in newObj)) {
        changes.push({ path: key, oldValue, newValue: undefined });
      } else if (!this.deepEqual(oldValue, newObj[key])) {
        changes.push({ path: key, oldValue, newValue: newObj[key] });
      }
    });

    // Check for added fields
    Object.entries(newObj).forEach(([key, newValue]) => {
      if (!(key in oldObj)) {
        changes.push({ path: key, oldValue: undefined, newValue });
      }
    });

    return changes;
  }

  private getBasicStepFields(step: WorkflowTemplateStep): Record<string, unknown> {
    const { templateId, config, dependencies, ...basicFields } = step;
    return basicFields;
  }

  private generateDiffSummary(
    stepDiffs: StepDiff[],
    parameterDiffs: ParameterDiff[]
  ): DiffSummary {
    return {
      stepsAdded: stepDiffs.filter(d => d.type === 'added').length,
      stepsRemoved: stepDiffs.filter(d => d.type === 'removed').length,
      stepsModified: stepDiffs.filter(d => d.type === 'modified').length,
      parametersAdded: parameterDiffs.filter(d => d.type === 'added').length,
      parametersRemoved: parameterDiffs.filter(d => d.type === 'removed').length,
      parametersModified: parameterDiffs.filter(d => d.type === 'modified').length,
      totalChanges:
        stepDiffs.filter(d => d.type !== 'unchanged').length +
        parameterDiffs.filter(d => d.type !== 'unchanged').length,
    };
  }

  private deepEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (typeof a !== typeof b) return false;
    if (typeof a !== 'object' || a === null || b === null) return false;

    const aKeys = Object.keys(a as object);
    const bKeys = Object.keys(b as object);

    if (aKeys.length !== bKeys.length) return false;

    return aKeys.every(key => 
      this.deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])
    );
  }
} 