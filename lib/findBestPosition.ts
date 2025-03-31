import { TLShapeId } from "@tldraw/tlschema";
import { CHATSHAPE_DIMENSIONS } from "@/components/chatshape/ChatShapeUtil";
import { calculateOptimalPosition } from "./dagreLayoutManager";
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
  // Use Dagre to calculate the optimal position
  const position = calculateOptimalPosition(editor, parentId, boxType);
  
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