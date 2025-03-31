// lib/findBestPosition.ts
import { TLShapeId } from "@tldraw/tlschema";
import { CHATSHAPE_DIMENSIONS } from "@/components/chatshape/ChatShapeUtil";
import { calculateOptimalPosition, rebuildPartialLayout } from "./dagreLayoutManager";
import { ChatShape } from "@/components/chatshape/ChatShapeTypes";

/**
 * Finds the best position to place a new box using Dagre layout algorithm
 * 
 * @param editor - The TLDraw editor instance
 * @param parentId - The ID of the parent shape
 * @param boxType - Whether this is a standard box or suggestion box (affects dimensions)
 * @returns The {x, y} position for the new box
 */
export function findBestPosition(
  editor: any, 
  parentId: TLShapeId, 
  boxType: 'standard' | 'suggestion' = 'standard'
): { x: number, y: number, direction?: 'right' | 'bottom' | 'left' | 'top' } {
  // Use Dagre to calculate the optimal position with specific layout settings
  const layoutConfig = {
    // Use different layout settings for suggestions vs standard nodes
    direction: boxType === 'suggestion' ? 'LR' as const : 'TB' as const,
    nodeSeparation: boxType === 'suggestion' ? 60 : 80,
    rankSeparation: boxType === 'suggestion' ? 80 : 100,
  };
  
  const position = calculateOptimalPosition(editor, parentId, boxType, layoutConfig);
  
  // Determine direction (can be useful for additional positioning logic)
  const parentShape = editor.getShape(parentId) as ChatShape | undefined;
  let direction: 'right' | 'bottom' | 'left' | 'top' = 'right';
  
  if (parentShape) {
    const parentCenterX = parentShape.x + (parentShape.props.w / 2);
    const parentCenterY = parentShape.y + (parentShape.props.h / 2);
    
    const dx = position.x - parentCenterX;
    const dy = position.y - parentCenterY;
    
    // Determine dominant direction
    if (Math.abs(dx) > Math.abs(dy)) {
      direction = dx > 0 ? 'right' : 'left';
    } else {
      direction = dy > 0 ? 'bottom' : 'top';
    }
  }
  
  return { 
    x: position.x, 
    y: position.y, 
    direction 
  };
}

/**
 * Reorganizes the layout of a specific branch or subtree
 * 
 * @param editor - The TLDraw editor instance
 * @param parentId - The ID of the parent/root node for this reorganization
 * @param nodeIds - Optional array of specific node IDs to include in the reorganization
 */
export function reorganizeBranch(
  editor: any,
  parentId: TLShapeId,
  nodeIds: TLShapeId[] = []
): void {
  // Use partial layout rebuild with animation
  rebuildPartialLayout(editor, parentId, nodeIds, {
    animate: true,
    direction: 'TB',
    nodeSeparation: 80,
    rankSeparation: 100
  });
}

/**
 * Special layout function for suggestion fans
 * 
 * @param editor - The TLDraw editor instance
 * @param parentId - The ID of the parent node for the suggestion fan
 * @param suggestionIds - Array of suggestion node IDs to arrange in a fan
 */
export function arrangeSuggestionFan(
  editor: any,
  parentId: TLShapeId,
  suggestionIds: TLShapeId[]
): void {
  // Use partial layout rebuild with fan-specific settings
  rebuildPartialLayout(editor, parentId, suggestionIds, {
    animate: true,
    direction: 'LR',
    nodeSeparation: 60,
    rankSeparation: 80,
    alignSuggestions: true
  });
}