// chatshape/hooks/usePromptResize.ts
import { useState, useEffect, useRef } from 'react'

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
  
  // Use a ref to track real-time height during drag operations
  const currentHeightRef = useRef(initialHeight)
  // Track editor state to prevent updates during drag
  const editorLockedRef = useRef(false)

  // Effect to update promptHeight when initialHeight prop changes (e.g. from sync)
  useEffect(() => {
    if (!isDragging && initialHeight !== promptHeight) {
      setPromptHeight(initialHeight)
      currentHeightRef.current = initialHeight
    }
  }, [initialHeight, isDragging, promptHeight])

  // If the bounding box changes (totalHeight changes), ensure prompt isn't bigger than total
  useEffect(() => {
    if (promptHeight > totalHeight) {
      setPromptHeight(totalHeight)
      currentHeightRef.current = totalHeight
      if (onHeightChange) onHeightChange(totalHeight)
    }
  }, [promptHeight, totalHeight, onHeightChange])

  function handleDividerMouseDown(e: React.MouseEvent) {
    e.stopPropagation()
    e.preventDefault()
    
    // Lock editor state at the beginning of drag
    editorLockedRef.current = true
    setIsDragging(true)
    setStartY(e.clientY)
    setStartHeight(promptHeight)
    
    // Add a temporary overlay to prevent other interactions during resize
    const overlay = document.createElement('div')
    overlay.id = 'resize-overlay'
    overlay.style.position = 'fixed'
    overlay.style.top = '0'
    overlay.style.left = '0'
    overlay.style.right = '0'
    overlay.style.bottom = '0'
    overlay.style.zIndex = '9999'
    overlay.style.cursor = 'ns-resize'
    document.body.appendChild(overlay)
    
    // Change cursor for entire document during resize
    document.body.style.cursor = 'ns-resize'
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

      // Update the height in real-time
      currentHeightRef.current = newHeight
      setPromptHeight(newHeight)
      
      // Update parents in real-time for smooth visual feedback
      // But throttle these updates to avoid excessive re-renders
      if (onHeightChange) {
        requestAnimationFrame(() => {
          onHeightChange(newHeight)
        })
      }
    }

    function onMouseUp(e: MouseEvent) {
      if (!isDragging) return
      e.preventDefault()
      
      // Remove the overlay
      const overlay = document.getElementById('resize-overlay')
      if (overlay) {
        document.body.removeChild(overlay)
      }
      
      // Reset cursor
      document.body.style.cursor = ''
      
      setIsDragging(false)
      
      // Unlock editor state
      setTimeout(() => {
        editorLockedRef.current = false
        
        // When mouse is released, notify parent of the final height change
        if (onHeightChange) {
          onHeightChange(currentHeightRef.current)
        }
      }, 0)
    }

    if (isDragging) {
      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    }
    
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [isDragging, startY, startHeight, minHeight, maxHeight, totalHeight, onHeightChange])

  return { 
    promptHeight, 
    handleDividerMouseDown, 
    isDragging,
    isEditorLocked: () => editorLockedRef.current 
  }
}