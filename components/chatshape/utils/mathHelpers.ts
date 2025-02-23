/**
 * Generates a radial branch offset for child shapes, distributing them
 * in an arc around the parent shape (rather than just up/down).
 *
 * @param childIndex - The index of the child shape (starting at 0).
 * @param radius - The distance from the parent shape (default 120).
 * @param angleStep - The angle in degrees between each branch (default 30).
 * @returns An { x, y } offset from the parent shape’s position.
 */
export function getBranchOffset(
  childIndex: number,
  radius: number = 120,
  angleStep: number = 30
): { x: number; y: number } {
  // For the very first child (index=0), place it directly to the right.
  if (childIndex === 0) {
    return { x: radius, y: 0 }
  }

  // We’ll alternate angles: +angleStep, -angleStep, +2*angleStep, -2*angleStep, etc.
  // This is similar to your old sign flipping logic but now in polar coordinates.
  const n = Math.ceil(childIndex / 2)
  const sign = childIndex % 2 === 1 ? 1 : -1
  const angleDegrees = n * angleStep * sign

  // Convert degrees to radians
  const angleRadians = (Math.PI / 180) * angleDegrees

  // Compute offsets
  const x = radius * Math.cos(angleRadians)
  const y = radius * Math.sin(angleRadians)
  return { x, y }
}
