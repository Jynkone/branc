// New utility function to find the best position for a new chat box
// Goes in lib/findBestPosition.ts

import { TLShapeId } from "@tldraw/tlschema";
import { CHATSHAPE_DIMENSIONS } from "@/components/chatshape/ChatShapeUtil";

// The four possible directions to place a new box
type Direction = 'right' | 'bottom' | 'left' | 'top';

// Padding between boxes
const BOX_PADDING = 40;

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
 * @returns The {x, y} position for the new box
 */
export function findBestPosition(
  editor: any, 
  parentId: TLShapeId, 
  boxType: 'standard' | 'suggestion' = 'standard'
): { x: number, y: number } {
  // Get all shapes on the current page
  const allShapes = editor.getCurrentPageShapes();
  
  // Find the parent shape
  const parentShape = editor.getShape(parentId);
  if (!parentShape) {
    console.error("Parent shape not found");
    // Fallback to default positioning to the right
    return { x: 0, y: 0 };
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
    
  // Define the four directions and their base positions
  const directions: Direction[] = ['right', 'bottom', 'left', 'top'];
  
  // Calculate a score for each direction based on available space
  const directionScores = directions.map(direction => {
    // Start with four potential positions in each direction
    const positionsToCheck = getPositionsInDirection(
      parentShape, 
      direction, 
      newBoxDimensions.width, 
      newBoxDimensions.height
    );
    
    // Count how many positions have no collisions
    let availablePositions = 0;
    for (const pos of positionsToCheck) {
      const hasCollision = checkCollision(
        { ...pos, w: newBoxDimensions.width, h: newBoxDimensions.height },
        shapesInfo.filter(s => s.id !== parentId) // Exclude parent from collision check
      );
      
      if (!hasCollision) {
        availablePositions++;
      }
    }
    
    return { direction, score: availablePositions };
  });
  
  // Sort directions by their scores (highest first)
  directionScores.sort((a, b) => b.score - a.score);
  
  // Use the direction with the highest score
  const bestDirection = directionScores[0].direction;
  
  // Get the base position for this direction
  const basePosition = getBasePosition(
    parentShape, 
    bestDirection, 
    newBoxDimensions.width, 
    newBoxDimensions.height
  );
  
  // Try to find a non-colliding position along this direction
  const finalPosition = findNonCollidingPosition(
    basePosition, 
    bestDirection, 
    newBoxDimensions.width, 
    newBoxDimensions.height,
    shapesInfo.filter(s => s.id !== parentId)
  );
  
  return finalPosition;
}

/**
 * Gets several sample positions along a direction to check for collisions
 */
function getPositionsInDirection(
  parentShape: any, 
  direction: Direction, 
  newWidth: number, 
  newHeight: number
): Array<{x: number, y: number}> {
  const basePos = getBasePosition(parentShape, direction, newWidth, newHeight);
  const positions = [];
  
  // Create a spread of positions to check along the chosen direction
  // This helps evaluate how "crowded" a direction is
  switch (direction) {
    case 'right':
    case 'left':
      // Check positions along the vertical axis
      for (let i = -2; i <= 2; i++) {
        positions.push({
          x: basePos.x,
          y: basePos.y + (i * 80) // Spread vertically
        });
      }
      break;
    case 'top':
    case 'bottom':
      // Check positions along the horizontal axis
      for (let i = -2; i <= 2; i++) {
        positions.push({
          x: basePos.x + (i * 80), // Spread horizontally
          y: basePos.y
        });
      }
      break;
  }
  
  return positions;
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
  if (!checkCollision(box, shapes)) {
    return position;
  }
  
  // Try up to 5 different offsets to find a non-colliding position
  const offsetSteps = [40, 80, 120, 160, 200];
  
  for (const step of offsetSteps) {
    // Try positive offset
    const posOffset = applyOffset(position, direction, step);
    const posBox = { ...posOffset, w: width, h: height };
    if (!checkCollision(posBox, shapes)) {
      return posOffset;
    }
    
    // Try negative offset
    const negOffset = applyOffset(position, direction, -step);
    const negBox = { ...negOffset, w: width, h: height };
    if (!checkCollision(negBox, shapes)) {
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

/**
 * Checks if a box collides with any of the existing shapes
 */
function checkCollision(
  box: { x: number, y: number, w: number, h: number },
  shapes: ShapeInfo[]
): boolean {
  for (const shape of shapes) {
    if (
      box.x < shape.x + shape.w &&
      box.x + box.w > shape.x &&
      box.y < shape.y + shape.h &&
      box.y + box.h > shape.y
    ) {
      return true; // Collision detected
    }
  }
  return false; // No collision
}