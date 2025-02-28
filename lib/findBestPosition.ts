import { TLShapeId } from "@tldraw/tlschema";
import { CHATSHAPE_DIMENSIONS } from "@/components/chatshape/ChatShapeUtil";

// The four possible directions to place a new box
type Direction = 'right' | 'bottom' | 'left' | 'top';

// Padding between boxes
const BOX_PADDING = 40;

// Interface for shape information used in collision detection
interface ShapeInfo {
  id: TLShapeId;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Finds the best position to place a new box around the parent box
 * 
 * @param editor - The TLDraw editor instance
 * @param parentId - The ID of the parent shape
 * @param boxType - Whether this is a standard box or suggestion box (affects dimensions)
 * @returns The {x, y, direction} position and direction for the new box
 */
export function findBestPosition(
  editor: any, 
  parentId: TLShapeId, 
  boxType: 'standard' | 'suggestion' = 'standard'
): { x: number, y: number, direction: Direction } {
  // Get all shapes on the current page
  const allShapes = editor.getCurrentPageShapes();
  
  // Find the parent shape
  const parentShape = editor.getShape(parentId);
  if (!parentShape) {
    console.error("Parent shape not found");
    // Fallback to default positioning to the right
    return { x: 0, y: 0, direction: 'right' };
  }
  
  // Get the dimensions for the new box based on type
  const newBoxDimensions = boxType === 'standard' 
    ? CHATSHAPE_DIMENSIONS.STANDARD 
    : CHATSHAPE_DIMENSIONS.SUGGESTION;
  
  // Convert shapes to a simplified format for collision detection
  const shapesInfo: ShapeInfo[] = allShapes.map((s: any) => ({
    id: s.id,
    x: s.x,
    y: s.y,
    w: s.props.w || 0,
    h: s.props.h || 0
  }));
  
  // Get the viewport bounds to ensure shapes are visible
  const viewport = editor.getViewportPageBounds ? 
    editor.getViewportPageBounds() :
    { x: 0, y: 0, width: 5000, height: 5000 }; // fallback if method not available
  
  // Define the four directions and their base positions
  const directions: Direction[] = ['right', 'bottom', 'left', 'top'];
  
  // Calculate a score for each direction based on available space and visibility
  const directionScores = directions.map(direction => {
    // Get base position for this direction
    const position = getBasePosition(
      parentShape, 
      direction, 
      newBoxDimensions.width, 
      newBoxDimensions.height
    );
    
    // Check if position is fully in viewport
    const isFullyVisible = 
      position.x >= viewport.x &&
      position.y >= viewport.y &&
      position.x + newBoxDimensions.width <= viewport.x + viewport.width &&
      position.y + newBoxDimensions.height <= viewport.y + viewport.height;
    
    // Box shape for collision detection
    const newBox = { 
      x: position.x, 
      y: position.y, 
      w: newBoxDimensions.width, 
      h: newBoxDimensions.height 
    };
    
    // Count collisions with other shapes (excluding the parent)
    const otherShapes = shapesInfo.filter(s => s.id !== parentId);
    const collisionCount = countCollisions(newBox, otherShapes);
    
    // Score: Visibility is most important, then lack of collisions
    let score = 0;
    if (isFullyVisible) score += 1000;
    score -= collisionCount * 100;
    
    // Additional points for preferred directions (right is often preferred)
    if (direction === 'right') score += 50;
    if (direction === 'bottom') score += 30;
    
    return { direction, position, score };
  });
  
  // Sort directions by their scores (highest first)
  directionScores.sort((a, b) => b.score - a.score);
  
  // Use the direction with the highest score
  const best = directionScores[0];
  
  return { 
    x: best.position.x, 
    y: best.position.y, 
    direction: best.direction 
  };
}

/**
 * Gets the base position for a new box in the specified direction
 */
function getBasePosition(
  parentShape: any, 
  direction: Direction, 
  newWidth: number, 
  newHeight: number
): { x: number, y: number } {
  switch (direction) {
    case 'right':
      return {
        x: parentShape.x + parentShape.props.w + BOX_PADDING,
        y: parentShape.y + (parentShape.props.h / 2) - (newHeight / 2)
      };
    case 'bottom':
      return {
        x: parentShape.x + (parentShape.props.w / 2) - (newWidth / 2),
        y: parentShape.y + parentShape.props.h + BOX_PADDING
      };
    case 'left':
      return {
        x: parentShape.x - newWidth - BOX_PADDING,
        y: parentShape.y + (parentShape.props.h / 2) - (newHeight / 2)
      };
    case 'top':
      return {
        x: parentShape.x + (parentShape.props.w / 2) - (newWidth / 2),
        y: parentShape.y - newHeight - BOX_PADDING
      };
    default:
      return { x: parentShape.x + parentShape.props.w + BOX_PADDING, y: parentShape.y };
  }
}

/**
 * Checks if two boxes collide
 */
function checkCollision(
  box1: { x: number, y: number, w: number, h: number },
  box2: { x: number, y: number, w: number, h: number }
): boolean {
  return (
    box1.x < box2.x + box2.w &&
    box1.x + box1.w > box2.x &&
    box1.y < box2.y + box2.h &&
    box1.y + box1.h > box2.y
  );
}

/**
 * Counts how many shapes collide with the given box
 */
function countCollisions(
  box: { x: number, y: number, w: number, h: number },
  shapes: ShapeInfo[]
): number {
  return shapes.filter(shape => checkCollision(box, shape)).length;
}

/**
 * Checks if a box collides with any shape in the array
 */
function hasCollisionWithAnyShape(
  box: { x: number, y: number, w: number, h: number },
  shapes: ShapeInfo[]
): boolean {
  return shapes.some(shape => checkCollision(box, shape));
}

/**
 * Tries to find a position without collisions by adjusting along the direction
 */
function findNonCollidingPosition(
  basePosition: { x: number, y: number },
  direction: Direction,
  width: number,
  height: number,
  shapes: ShapeInfo[]
): { x: number, y: number } {
  // Start with the base position
  let position = { ...basePosition };
  const box = { ...position, w: width, h: height };
  
  // If there's no collision, return the base position
  if (!hasCollisionWithAnyShape(box, shapes)) {
    return position;
  }
  
  // Try up to 5 different offsets to find a non-colliding position
  const offsetSteps = [40, 80, 120, 160, 200];
  
  for (const step of offsetSteps) {
    // Try positive offset
    const posOffset = applyOffset(position, direction, step);
    const posBox = { ...posOffset, w: width, h: height };
    if (!hasCollisionWithAnyShape(posBox, shapes)) {
      return posOffset;
    }
    
    // Try negative offset
    const negOffset = applyOffset(position, direction, -step);
    const negBox = { ...negOffset, w: width, h: height };
    if (!hasCollisionWithAnyShape(negBox, shapes)) {
      return negOffset;
    }
  }
  
  // If all positions have collisions, try a different direction
  // or simply return the base position plus a large offset
  const lastResortOffset = 300;
  switch (direction) {
    case 'right':
      return { x: position.x + lastResortOffset, y: position.y };
    case 'bottom':
      return { x: position.x, y: position.y + lastResortOffset };
    case 'left':
      return { x: position.x - lastResortOffset, y: position.y };
    case 'top':
      return { x: position.x, y: position.y - lastResortOffset };
    default:
      return { x: position.x + lastResortOffset, y: position.y };
  }
}

/**
 * Applies an offset to a position based on the direction
 */
function applyOffset(
  position: { x: number, y: number },
  direction: Direction,
  offset: number
): { x: number, y: number } {
  switch (direction) {
    case 'right':
    case 'left':
      // For horizontal directions, offset vertically
      return { x: position.x, y: position.y + offset };
    case 'top':
    case 'bottom':
      // For vertical directions, offset horizontally
      return { x: position.x + offset, y: position.y };
    default:
      return position;
  }
}