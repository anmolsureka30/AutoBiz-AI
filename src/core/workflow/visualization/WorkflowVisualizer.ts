import { WorkflowStep } from '../types';
import { 
  WorkflowGraph, 
  WorkflowNode, 
  WorkflowEdge,
  WorkflowExecution,
  ExecutionStatus
} from './types';
import { Logger } from '../../../utils/logger/Logger';

interface WorkflowError {
  name: string;
  message: string;
  step: string;
  timestamp: Date;
}

export class WorkflowVisualizer {
  private readonly logger: Logger;

  constructor() {
    this.logger = new Logger('WorkflowVisualizer');
  }

  createGraph(
    steps: WorkflowStep[],
    execution?: WorkflowExecution
  ): WorkflowGraph {
    try {
      const nodes = this.createNodes(steps, execution);
      const edges = this.createEdges(steps);

      return {
        nodes,
        edges,
      };
    } catch (error) {
      this.logger.error('Failed to create workflow graph', { error });
      throw error;
    }
  }

  private createNodes(
    steps: WorkflowStep[],
    execution?: WorkflowExecution
  ): WorkflowNode[] {
    return steps.map(step => {
      const stepResult = execution?.result.stepResults[step.id];
      const errors = this.getStepErrors(step.id, execution);

      return {
        id: step.id,
        type: 'step',
        label: step.name,
        status: this.determineStepStatus(step, stepResult, errors),
        position: { x: 0, y: 0 },
        metrics: {
          executionTime: stepResult?.duration || 0,
          retryCount: errors.length,
          errorRate: errors.length > 0 ? errors.length / (errors.length + 1) : 0,
        },
      };
    });
  }

  private createEdges(steps: WorkflowStep[]): WorkflowEdge[] {
    return steps.flatMap(step =>
      step.dependencies.map(dep => ({
        id: `${dep}-${step.id}`,
        source: dep,
        target: step.id,
        type: 'dependency',
      }))
    );
  }

  private getStepErrors(
    stepId: string,
    execution?: WorkflowExecution
  ): WorkflowError[] {
    if (!execution) return [];

    const stepResult = execution.result.stepResults[stepId];
    if (!stepResult?.error) return [];

    return [{
      name: stepResult.error.name || 'Error',
      message: stepResult.error.message,
      step: stepId,
      timestamp: new Date(stepResult.startTime)
    }];
  }

  private determineStepStatus(
    step: WorkflowStep,
    stepResult?: { status: ExecutionStatus },
    errors: WorkflowError[] = []
  ): ExecutionStatus {
    if (!stepResult) return 'pending';
    return stepResult.status;
  }

  updateNodeStatus(
    graph: WorkflowGraph,
    nodeId: string,
    status: ExecutionStatus,
    result?: { duration: number },
    errors: WorkflowError[] = []
  ): void {
    const node = graph.nodes.find(n => n.id === nodeId);
    if (!node) {
      this.logger.warn('Node not found in graph', { nodeId });
      return;
    }

    node.status = status;
    node.metrics = {
      executionTime: result?.duration || 0,
      retryCount: errors.length,
      errorRate: errors.length > 0 ? errors.length / (errors.length + 1) : 0,
    };
  }
} 