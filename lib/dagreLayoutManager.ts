// lib/dagreLayoutManager.ts
import * as dagre from "@dagrejs/dagre";
import { Editor } from "tldraw";
import { TLShapeId, TLShape } from "@tldraw/tlschema";
import { CHATSHAPE_DIMENSIONS } from "@/components/chatshape/ChatShapeUtil";
import { ChatShape } from "@/components/chatshape/ChatShapeTypes";

// Interface for our layout node
interface LayoutNode {
  id: string;
  width: number;
  height: number;
  x?: number;
  y?: number;
  branchType?: string;
  isSuggestion?: boolean;
  suggestionGeneration?: number;
  parentId?: string;
}

// Interface for layout edge
interface LayoutEdge {
  source: string;
  target: string;
  isSuggestion?: boolean;
  weight?: number;
}

// Type guard to check if a shape is a ChatShape
function isChatShape(shape: TLShape): shape is ChatShape {
  return shape.type === "chat";
}

// Layout configuration
interface LayoutConfig {
  direction?: 'TB' | 'BT' | 'LR' | 'RL';
  nodeSeparation?: number;
  rankSeparation?: number;
  edgeSeparation?: number;
  marginX?: number;
  marginY?: number;
  animate?: boolean;
  alignSuggestions?: boolean;
}

const DEFAULT_CONFIG: LayoutConfig = {
  direction: "TB",       // Top to bottom layout
  nodeSeparation: 80,    // Horizontal separation between nodes
  rankSeparation: 100,   // Vertical separation between ranks
  edgeSeparation: 20,    // Edge separation
  marginX: 20,           // Horizontal margin
  marginY: 20,           // Vertical margin
  animate: true,         // Animate layout changes
  alignSuggestions: true, // Align suggestion nodes radially
};

// Main layout function to replace findBestPosition
export function calculateOptimalPosition(
  editor: Editor,
  parentId: TLShapeId,
  boxType: 'standard' | 'suggestion' = 'standard',
  config: Partial<LayoutConfig> = {}
): { x: number, y: number } {
  // Merge provided config with defaults
  const layoutConfig = { ...DEFAULT_CONFIG, ...config };
  
  // Get existing nodes and build a graph
  const graph = buildGraphFromEditor(editor, layoutConfig);
  
  // Add a new node for the shape we're placing
  const parentShape = editor.getShape(parentId);
  if (!parentShape) {
    console.error("Parent shape not found");
    return { x: 0, y: 0 };
  }
  
  // Get dimensions for the new box
  const dimensions = boxType === 'standard' 
    ? CHATSHAPE_DIMENSIONS.STANDARD 
    : CHATSHAPE_DIMENSIONS.SUGGESTION;
  
  // Create a temporary ID for the new node
  const tempId = `temp-node-${Date.now()}`;
  
  // Add our new node to the graph
  graph.setNode(tempId, {
    width: dimensions.width,
    height: dimensions.height,
    id: tempId,
    isSuggestion: boxType === 'suggestion'
  });
  
  // Connect it to the parent
  graph.setEdge(parentId, tempId, {
    weight: boxType === 'suggestion' ? 1 : 3,
    minlen: boxType === 'suggestion' ? 2 : 1
  });
  
  // Run the layout algorithm
  dagre.layout(graph);
  
  // Get the computed position for our new node
  const newNodePos = graph.node(tempId);
  
  // Return the position (center-based to top-left based conversion)
  return {
    x: newNodePos.x - dimensions.width / 2,
    y: newNodePos.y - dimensions.height / 2
  };
}

// Function to rebuild the entire layout
export function rebuildEntireLayout(
  editor: Editor, 
  config: Partial<LayoutConfig> = {}
): void {
  // Merge provided config with defaults
  const layoutConfig = { ...DEFAULT_CONFIG, ...config };
  
  // Build graph from all existing shapes
  const graph = buildGraphFromEditor(editor, layoutConfig);
  
  // Run layout algorithm
  dagre.layout(graph);
  
  // Apply new positions to all shapes
  applyLayoutToEditor(editor, graph, layoutConfig.animate || false);
}

// Function to rebuild only a part of the layout around a specific node
export function rebuildPartialLayout(
  editor: Editor,
  focusNodeId: TLShapeId,
  relatedNodeIds: TLShapeId[] = [],
  config: Partial<LayoutConfig> = {}
): void {
  // Merge provided config with defaults
  const layoutConfig = { ...DEFAULT_CONFIG, ...config };
  
  // Get the subgraph related to this node
  const subgraphNodeIds = getConnectedSubgraph(editor, focusNodeId, relatedNodeIds);
  
  // Build a graph with just these nodes
  const graph = buildPartialGraphFromEditor(editor, subgraphNodeIds, layoutConfig);
  
  // Run layout algorithm on the subgraph
  dagre.layout(graph);
  
  // Apply new positions only to this subgraph
  applyLayoutToEditor(editor, graph, layoutConfig.animate || false, subgraphNodeIds);
}

// Helper to get all connected nodes from a starting node
function getConnectedSubgraph(
  editor: Editor,
  startNodeId: TLShapeId,
  additionalNodeIds: TLShapeId[] = []
): Set<string> {
  const result = new Set<string>([startNodeId, ...additionalNodeIds]);
  const nodesToVisit = [startNodeId, ...additionalNodeIds];
  
  // Simple breadth-first traversal of the node graph
  while (nodesToVisit.length > 0) {
    const currentId = nodesToVisit.shift()!;
    
    // Get all chat shapes that are connected to this node
    const shapes = editor.getCurrentPageShapes();
    
    // Look for parent-child relationships
    shapes.forEach(shape => {
      if (isChatShape(shape)) {
        // If this shape has the current node as parent
        if (shape.props.parentId === currentId && !result.has(shape.id)) {
          result.add(shape.id);
          nodesToVisit.push(shape.id);
        }
        
        // If this shape is the parent of our current node
        if (currentId === shape.props.parentId && !result.has(shape.id)) {
          result.add(shape.id);
          nodesToVisit.push(shape.id);
        }
      }
    });
    
    // Also look for arrow connections
    const arrows = shapes.filter(shape => shape.type === "arrow");
    
    arrows.forEach(arrow => {
      const meta = arrow.meta as any;
      if (meta && meta.connectedFrom && meta.connectedTo) {
        if (meta.connectedFrom === currentId && !result.has(meta.connectedTo)) {
          result.add(meta.connectedTo);
          nodesToVisit.push(meta.connectedTo);
        }
        if (meta.connectedTo === currentId && !result.has(meta.connectedFrom)) {
          result.add(meta.connectedFrom);
          nodesToVisit.push(meta.connectedFrom);
        }
      }
    });
  }
  
  return result;
}

// Build a graph from just a subset of nodes
function buildPartialGraphFromEditor(
  editor: Editor,
  nodeIds: Set<string>,
  config: LayoutConfig
): dagre.graphlib.Graph {
  // Create a new directed graph
  const graph = new dagre.graphlib.Graph();
  
  // Set graph configuration
  graph.setGraph({
    rankdir: config.direction,
    nodesep: config.nodeSeparation,
    ranksep: config.rankSeparation,
    edgesep: config.edgeSeparation,
    marginx: config.marginX,
    marginy: config.marginY
  });
  
  // Default to assigning a new object as a label for each new edge
  graph.setDefaultEdgeLabel(() => ({}));
  
  // Get all chat shapes that are in our nodeIds set
  const chatShapes = editor.getCurrentPageShapes()
    .filter(shape => shape.type === "chat" && nodeIds.has(shape.id)) as ChatShape[];
  
  // Add all chat shapes as nodes
  chatShapes.forEach(shape => {
    graph.setNode(shape.id, {
      id: shape.id,
      width: shape.props.w,
      height: shape.props.h,
      branchType: shape.props.branchType,
      isSuggestion: shape.props.isSuggestion,
      suggestionGeneration: shape.props.suggestionGeneration
    });
  });
  
  // Find all connections between chat shapes
  chatShapes.forEach(shape => {
    // Check for parent-child relationships from parentId property
    if (shape.props.parentId && shape.props.parentId !== "") {
      const parentExists = chatShapes.some(s => s.id === shape.props.parentId);
      
      if (parentExists) {
        // Add edge for parent-child relationship
        graph.setEdge(shape.props.parentId, shape.id, {
          weight: shape.props.isSuggestion ? 1 : 3,
          minlen: shape.props.isSuggestion ? 2 : 1
        });
      }
    }
  });
  
  // Also look for arrow connections between shapes
  const arrows = editor.getCurrentPageShapes()
    .filter(shape => shape.type === "arrow");
  
  // Process arrows to create edges
  arrows.forEach(arrow => {
    // Instead of looking for bindings, look at the arrow's meta data
    const meta = arrow.meta as any;
    
    // If this arrow has source/target info in its meta
    if (meta && meta.connectedFrom && meta.connectedTo) {
      const sourceId = meta.connectedFrom;
      const targetId = meta.connectedTo;
      
      // Only add the edge if both nodes are in our subset
      if (nodeIds.has(sourceId) && nodeIds.has(targetId)) {
        const sourceShape = editor.getShape(sourceId);
        const targetShape = editor.getShape(targetId);
        
        if (sourceShape && targetShape && 
            isChatShape(sourceShape) && isChatShape(targetShape)) {
          // Check if this is a suggestion arrow
          const isSuggestion = meta.isSuggestion || false;
          
          // Add the edge to our graph
          graph.setEdge(sourceId, targetId, {
            weight: isSuggestion ? 1 : 3,
            minlen: isSuggestion ? 2 : 1
          });
        }
      }
    }
  });
  
  // Handle special suggestion groups if configured
  if (config.alignSuggestions) {
    handleSuggestionGroups(graph, chatShapes);
  }
  
  return graph;
}

// Main function to build a Dagre graph from editor shapes
function buildGraphFromEditor(editor: Editor, config: LayoutConfig): dagre.graphlib.Graph {
  // Create a new directed graph
  const graph = new dagre.graphlib.Graph();
  
  // Set graph configuration
  graph.setGraph({
    rankdir: config.direction,
    nodesep: config.nodeSeparation,
    ranksep: config.rankSeparation,
    edgesep: config.edgeSeparation,
    marginx: config.marginX,
    marginy: config.marginY
  });
  
  // Default to assigning a new object as a label for each new edge
  graph.setDefaultEdgeLabel(() => ({}));
  
  // Get all chat shapes
  const chatShapes = editor.getCurrentPageShapes()
    .filter(shape => shape.type === "chat") as ChatShape[];
  
  // Add all chat shapes as nodes
  chatShapes.forEach(shape => {
    graph.setNode(shape.id, {
      id: shape.id,
      width: shape.props.w,
      height: shape.props.h,
      branchType: shape.props.branchType,
      isSuggestion: shape.props.isSuggestion,
      suggestionGeneration: shape.props.suggestionGeneration
    });
  });
  
  // Find all connections between chat shapes
  chatShapes.forEach(shape => {
    // Check for parent-child relationships from parentId property
    if (shape.props.parentId && shape.props.parentId !== "") {
      const parentExists = chatShapes.some(s => s.id === shape.props.parentId);
      
      if (parentExists) {
        // Add edge for parent-child relationship
        graph.setEdge(shape.props.parentId, shape.id, {
          weight: shape.props.isSuggestion ? 1 : 3,
          minlen: shape.props.isSuggestion ? 2 : 1
        });
      }
    }
  });
  
  // Also look for arrow connections between shapes
  const arrows = editor.getCurrentPageShapes()
    .filter(shape => shape.type === "arrow");
  
  // Process arrows to create edges
  arrows.forEach(arrow => {
    // Instead of looking for bindings, look at the arrow's meta data
    const meta = arrow.meta as any;
    
    // If this arrow has source/target info in its meta
    if (meta && meta.connectedFrom && meta.connectedTo) {
      const sourceId = meta.connectedFrom;
      const targetId = meta.connectedTo;
      
      const sourceShape = editor.getShape(sourceId);
      const targetShape = editor.getShape(targetId);
      
      if (sourceShape && targetShape && 
          isChatShape(sourceShape) && isChatShape(targetShape)) {
        // Check if this is a suggestion arrow
        const isSuggestion = meta.isSuggestion || false;
        
        // Add the edge to our graph
        graph.setEdge(sourceId, targetId, {
          weight: isSuggestion ? 1 : 3,
          minlen: isSuggestion ? 2 : 1
        });
      }
    }
  });
    
  // Handle special suggestion groups if configured
  if (config.alignSuggestions) {
    handleSuggestionGroups(graph, chatShapes);
  }
  
  return graph;
}

// Apply layout positions to editor shapes
function applyLayoutToEditor(
  editor: Editor, 
  graph: dagre.graphlib.Graph, 
  animate: boolean = false,
  nodeIds?: Set<string>
): void {
  // Get all nodes to update
  const nodesToUpdate = nodeIds 
    ? graph.nodes().filter(id => nodeIds.has(id))
    : graph.nodes();
  
  // In a batch to optimize rendering
  editor.batch(() => {
    nodesToUpdate.forEach((nodeId: string) => {
      const node = graph.node(nodeId);
      const shape = editor.getShape(nodeId as TLShapeId);
      
      if (shape && isChatShape(shape)) {
        // Convert from center-based to top-left based coordinates
        const x = node.x - shape.props.w / 2;
        const y = node.y - shape.props.h / 2;
        
        // Apply the new position with or without animation
        editor.updateShape({
            id: shape.id,
            type: shape.type,
            x,
            y
          });
                }
    });
  });
}

// Handle special arrangement for suggestion groups
function handleSuggestionGroups(
  graph: dagre.graphlib.Graph, 
  chatShapes: ChatShape[]
): void {
  // Group suggestions by their parent
  const suggestionGroups = new Map<string, ChatShape[]>();
  
  chatShapes.forEach(shape => {
    if (shape.props.isSuggestion && shape.props.parentId) {
      if (!suggestionGroups.has(shape.props.parentId)) {
        suggestionGroups.set(shape.props.parentId, []);
      }
      
      const group = suggestionGroups.get(shape.props.parentId);
      if (group) {
        group.push(shape);
      }
    }
  });
  
  // Process each suggestion group to apply special constraints
  suggestionGroups.forEach((suggestions, parentId) => {
    if (suggestions.length > 1) {
      // Sort by generation to ensure consistent ordering
      suggestions.sort((a, b) => 
        (b.props.suggestionGeneration || 0) - (a.props.suggestionGeneration || 0));
      
      // Apply ranking constraints to ensure suggestions appear at same level
      suggestions.forEach((suggestion, index) => {
        // Add rank constraint to the node
        graph.setNode(suggestion.id, {
          ...graph.node(suggestion.id),
          // Use a consistent rank for all suggestions in this group
          // but offset within the rank to create a fan pattern
          rank: `parent_${parentId}_suggestions`,
          order: index
        });
      });
    }
  });
}

// Debounced function to trigger layout updates without too many recalculations
export const debouncedRebuildLayout = debounce((editor: Editor, config?: Partial<LayoutConfig>) => {
  rebuildEntireLayout(editor, config);
}, 500);


// Simple debounce implementation
function debounce(func: Function, wait: number) {
  let timeout: NodeJS.Timeout | null = null;
  
  return function executedFunction(...args: any[]) {
    const later = () => {
      timeout = null;
      func(...args);
    };
    
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}