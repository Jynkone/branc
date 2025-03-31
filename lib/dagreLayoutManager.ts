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
}

// Type guard to check if a shape is a ChatShape
function isChatShape(shape: TLShape): shape is ChatShape {
  return shape.type === "chat";
}

// Main layout function to replace findBestPosition
export function calculateOptimalPosition(
  editor: Editor,
  parentId: TLShapeId,
  boxType: 'standard' | 'suggestion' = 'standard'
): { x: number, y: number } {
  // Get existing nodes and build a graph
  const graph = buildGraphFromEditor(editor);
  
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
    id: tempId
  });
  
  // Connect it to the parent
  graph.setEdge(parentId, tempId);
  
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
export function rebuildEntireLayout(editor: Editor): void {
  // Build graph from all existing shapes
  const graph = buildGraphFromEditor(editor);
  
  // Run layout algorithm
  dagre.layout(graph);
  
  // Apply new positions to all shapes
  editor.batch(() => {
    graph.nodes().forEach((nodeId: string) => {
      const node = graph.node(nodeId);
      const shape = editor.getShape(nodeId as TLShapeId);
      
      if (shape && isChatShape(shape)) {
        // Convert from center-based to top-left based coordinates
        const x = node.x - shape.props.w / 2;
        const y = node.y - shape.props.h / 2;
        
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

// Main function to build a Dagre graph from editor shapes
function buildGraphFromEditor(editor: Editor) {
  // Create a new directed graph
  const graph = new dagre.graphlib.Graph();
  
  // Set graph configuration
  graph.setGraph({
    rankdir: "TB",       // Top to bottom layout
    nodesep: 80,         // Horizontal separation between nodes
    ranksep: 100,        // Vertical separation between ranks
    edgesep: 20,         // Edge separation
    marginx: 20,         // Horizontal margin
    marginy: 20          // Vertical margin
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
  
  // Process arrows to create edges - using direct binding queries
// Process arrows to create edges - using direct shape queries
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
    
  // Handle special suggestion groups
  // Group suggestions by their parent
  const suggestionGroups = new Map<string, TLShapeId[]>();
  
  chatShapes.forEach(shape => {
    if (shape.props.isSuggestion && shape.props.parentId) {
      if (!suggestionGroups.has(shape.props.parentId)) {
        suggestionGroups.set(shape.props.parentId, []);
      }
      
      const group = suggestionGroups.get(shape.props.parentId);
      if (group) {
        group.push(shape.id);
      }
    }
  });
  
  // Optional: Apply special constraints for suggestion groups
  // This could position suggestions in a fan or circular pattern
  
  return graph;
}

// Debounced function to trigger layout updates without too many recalculations
export const debouncedRebuildLayout = debounce((editor: Editor) => {
  rebuildEntireLayout(editor);
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