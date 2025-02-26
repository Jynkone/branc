// chatshape/hooks/usePromptResize.ts
import { useState, useEffect } from 'react'

interface UsePromptResizeOptions {
  /** Starting height (pixels) for the prompt region */
  initialHeight: number
  /** Total available height for the interior (shape height minus header) */
  totalHeight: number
  /** Minimum pixel height for the prompt region */
  minHeight?: number
  /** Maximum pixel height for the prompt region (optional) */
  maxHeight?: number
  /** Callback when height changes - used to sync the height to the shape */
  onHeightChange?: (height: number) => void
}

export function usePromptResize({
  initialHeight,
  totalHeight,
  minHeight = 60,
  maxHeight,
  onHeightChange,
}: UsePromptResizeOptions) {
  const [promptHeight, setPromptHeight] = useState(initialHeight)
  const [isDragging, setIsDragging] = useState(false)
  const [startY, setStartY] = useState(0)
  const [startHeight, setStartHeight] = useState(initialHeight)

  // Effect to update promptHeight when initialHeight prop changes (e.g. from sync)
  useEffect(() => {
    if (!isDragging && initialHeight !== promptHeight) {
      setPromptHeight(initialHeight)
    }
  }, [initialHeight, isDragging, promptHeight])

  // If the bounding box changes (totalHeight changes), ensure prompt isn't bigger than total
  useEffect(() => {
    if (promptHeight > totalHeight) {
      setPromptHeight(totalHeight)
      if (onHeightChange) onHeightChange(totalHeight)
    }
  }, [promptHeight, totalHeight, onHeightChange])

  function handleDividerMouseDown(e: React.MouseEvent) {
    e.stopPropagation()
    e.preventDefault()
    setIsDragging(true)
    setStartY(e.clientY)
    setStartHeight(promptHeight)
  }

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!isDragging) return
      e.preventDefault()
      const delta = e.clientY - startY
      // Because we want to drag the top edge of the prompt,
      // subtract delta from the original height
      let newHeight = startHeight - delta

      // Enforce min / max
      if (minHeight !== undefined && newHeight < minHeight) {
        newHeight = minHeight
      }
      if (maxHeight !== undefined && newHeight > maxHeight) {
        newHeight = maxHeight
      }
      if (newHeight > totalHeight) {
        newHeight = totalHeight
      }

      setPromptHeight(newHeight)
    }

    function onMouseUp(e: MouseEvent) {
      if (!isDragging) return
      e.preventDefault()
      setIsDragging(false)
      
      // When mouse is released, notify parent of the final height change
      if (onHeightChange && promptHeight !== startHeight) {
        onHeightChange(promptHeight)
      }
    }

    if (isDragging) {
      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    }
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [isDragging, startY, startHeight, promptHeight, minHeight, maxHeight, totalHeight, onHeightChange])

  return { promptHeight, handleDividerMouseDown }
}