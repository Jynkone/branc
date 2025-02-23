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
}

export function usePromptResize({
  initialHeight,
  totalHeight,
  minHeight = 60,
  maxHeight,
}: UsePromptResizeOptions) {
  const [promptHeight, setPromptHeight] = useState(initialHeight)
  const [isDragging, setIsDragging] = useState(false)
  const [startY, setStartY] = useState(0)
  const [startHeight, setStartHeight] = useState(initialHeight)

  // If the bounding box changes (totalHeight changes), ensure prompt isn't bigger than total
  useEffect(() => {
    if (promptHeight > totalHeight) {
      setPromptHeight(totalHeight)
    }
  }, [promptHeight, totalHeight])

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
    }

    if (isDragging) {
      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    }
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [isDragging, startY, startHeight, minHeight, maxHeight, totalHeight])

  return { promptHeight, handleDividerMouseDown }
}
