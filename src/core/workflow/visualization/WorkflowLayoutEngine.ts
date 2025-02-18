import { 
  WorkflowGraph, 
  WorkflowNode, 
  WorkflowEdge,
  LayoutOptions,
  NodeLevel 
} from './types';
import { Logger } from '../../../utils/logger/Logger';

export class WorkflowLayoutEngine {
  private readonly logger: Logger;
  private readonly defaultLayout: LayoutOptions = {
    direction: 'LR',
    nodeSpacing: 100,
    rankSpacing: 200,
    marginX: 50,
    marginY: 50,
  };

  constructor() {
    this.logger = new Logger('WorkflowLayoutEngine');
  }

  calculateLayout(
    graph: WorkflowGraph,
    options?: Partial<LayoutOptions>
  ): WorkflowGraph {
    try {
      const layout = { ...this.defaultLayout, ...options };
      const levels = this.calculateNodeLevels(graph.nodes, graph.edges);
      
      this.assignNodePositions(levels, layout);

      return {
        nodes: graph.nodes,
        edges: graph.edges,
      };
    } catch (error) {
      this.logger.error('Failed to calculate layout', { error });
      throw error;
    }
  }

  private calculateNodeLevels(
    nodes: WorkflowNode[],
    edges: WorkflowEdge[]
  ): NodeLevel[] {
    const levels: NodeLevel[] = [];
    const visited = new Set<string>();
    const incomingEdges = new Map<string, number>();

    // Count incoming edges for each node
    edges.forEach(edge => {
      const count = incomingEdges.get(edge.target) || 0;
      incomingEdges.set(edge.target, count + 1);
    });

    // Find root nodes (nodes with no incoming edges)
    const rootNodes = nodes.filter(node => !incomingEdges.has(node.id));
    
    // Assign levels using topological sort
    const assignLevel = (node: WorkflowNode, levelNum: number) => {
      if (visited.has(node.id)) return;

      let level = levels.find(l => l.level === levelNum);
      if (!level) {
        level = { level: levelNum, nodes: [] };
        levels.push(level);
      }

      level.nodes.push(node);
      visited.add(node.id);

      // Process outgoing edges
      const outgoingEdges = edges.filter(e => e.source === node.id);
      outgoingEdges.forEach(edge => {
        const targetNode = nodes.find(n => n.id === edge.target);
        if (targetNode) {
          const count = incomingEdges.get(targetNode.id) || 0;
          if (count > 1) {
            // For nodes with multiple parents, use the maximum level of parents + 1
            const parentLevels = edges
              .filter(e => e.target === targetNode.id)
              .map(e => {
                const parentNode = nodes.find(n => n.id === e.source);
                return levels.find(l => l.nodes.includes(parentNode!))?.level || 0;
              });
            const maxParentLevel = Math.max(...parentLevels);
            assignLevel(targetNode, maxParentLevel + 1);
          } else {
            assignLevel(targetNode, levelNum + 1);
          }
        }
      });
    };

    // Start with root nodes
    rootNodes.forEach(node => assignLevel(node, 0));

    return levels.sort((a, b) => a.level - b.level);
  }

  private assignNodePositions(
    levels: NodeLevel[],
    options: LayoutOptions
  ): void {
    const maxNodesInLevel = Math.max(
      ...levels.map(level => level.nodes.length)
    );

    levels.forEach(level => {
      const levelWidth = level.nodes.length * options.nodeSpacing;
      const startX = (maxNodesInLevel * options.nodeSpacing - levelWidth) / 2;

      level.nodes.forEach((node, index) => {
        if (options.direction === 'LR') {
          node.position = {
            x: level.level * options.rankSpacing + options.marginX,
            y: startX + index * options.nodeSpacing + options.marginY,
          };
        } else {
          node.position = {
            x: startX + index * options.nodeSpacing + options.marginX,
            y: level.level * options.rankSpacing + options.marginY,
          };
        }
      });
    });
  }

  private optimizeNodePositions(
    levels: NodeLevel[],
    edges: WorkflowEdge[]
  ): void {
    // Minimize edge crossings by reordering nodes within each level
    levels.forEach(level => {
      if (level.nodes.length <= 1) return;

      // Calculate edge crossings for current order
      const currentCrossings = this.calculateEdgeCrossings(level.nodes, edges);

      // Try different node orderings to minimize crossings
      let improved = true;
      while (improved) {
        improved = false;
        for (let i = 0; i < level.nodes.length - 1; i++) {
          // Swap adjacent nodes
          [level.nodes[i], level.nodes[i + 1]] = [level.nodes[i + 1], level.nodes[i]];
          
          const newCrossings = this.calculateEdgeCrossings(level.nodes, edges);
          if (newCrossings < currentCrossings) {
            improved = true;
            break;
          } else {
            // Revert swap if no improvement
            [level.nodes[i], level.nodes[i + 1]] = [level.nodes[i + 1], level.nodes[i]];
          }
        }
      }
    });
  }

  private calculateEdgeCrossings(
    nodes: WorkflowNode[],
    edges: WorkflowEdge[]
  ): number {
    let crossings = 0;
    const nodeIndices = new Map(nodes.map((node, index) => [node.id, index]));

    for (let i = 0; i < edges.length; i++) {
      for (let j = i + 1; j < edges.length; j++) {
        const edge1 = edges[i];
        const edge2 = edges[j];

        const source1Index = nodeIndices.get(edge1.source);
        const target1Index = nodeIndices.get(edge1.target);
        const source2Index = nodeIndices.get(edge2.source);
        const target2Index = nodeIndices.get(edge2.target);

        if (
          source1Index !== undefined &&
          target1Index !== undefined &&
          source2Index !== undefined &&
          target2Index !== undefined
        ) {
          if (
            (source1Index < source2Index && target1Index > target2Index) ||
            (source1Index > source2Index && target1Index < target2Index)
          ) {
            crossings++;
          }
        }
      }
    }

    return crossings;
  }
} 