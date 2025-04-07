import { useState, useEffect, useCallback, RefObject } from 'react';

// Default position if the target element isn't found initially
const DEFAULT_SELECTOR_POSITION = 230;
// Selectors to try for finding the tldraw action menu/toolbar area
const TLDRW_ACTION_MENU_SELECTORS = '.tlui-menu-zone, .tlui-action-panel, .tlui-actions, .tlui-actions-menu, .tlui-toolbar';

export function useDynamicPositioning(containerRef: RefObject<HTMLElement>) {
  const [selectorPosition, setSelectorPosition] = useState<number>(DEFAULT_SELECTOR_POSITION);

  const updateSelectorPosition = useCallback(() => {
    if (!containerRef.current) {
      // console.warn("Dynamic positioning: Container ref not available.");
      // Keep the last known position or default if never calculated
      return;
    }

    // Try to find the action menu using various selectors
    const actionMenu = containerRef.current.querySelector(TLDRW_ACTION_MENU_SELECTORS);

    if (actionMenu) {
      const menuRect = actionMenu.getBoundingClientRect();
      // Calculate position relative to the container's left edge if needed,
      // but absolute positioning usually works fine based on viewport coordinates.
      // Position is the right edge of the menu + a small gap
      const newPosition = menuRect.right + 5; // 5px gap
      // Only update if the position actually changes to avoid unnecessary re-renders
      setSelectorPosition(prevPosition => {
        if (Math.abs(prevPosition - newPosition) > 1) { // Allow for minor pixel differences
          // console.log("Updating selector position to:", newPosition);
          return newPosition;
        }
        return prevPosition;
      });
    } else {
      // console.warn("Dynamic positioning: Could not find tldraw action menu element.");
      // Fallback or keep current position
      // setSelectorPosition(DEFAULT_SELECTOR_POSITION); // Optionally reset to default
    }
  }, [containerRef]); // Dependency on the container ref

  useEffect(() => {
    // Initial calculation attempt after a short delay for rendering
    const initialTimeoutId = setTimeout(() => {
      updateSelectorPosition();
    }, 300); // Increased delay slightly

    // --- Observers for robust updates ---
    const resizeObserver = new ResizeObserver(() => {
      // Use requestAnimationFrame to avoid layout thrashing during resize
      window.requestAnimationFrame(updateSelectorPosition);
    });

    const mutationObserver = new MutationObserver((mutations) => {
      // Check if relevant parts of the DOM might have changed
      // This is a basic check; could be refined if performance issues arise
      let relevantChange = false;
      for (const mutation of mutations) {
        if (mutation.type === 'childList' || mutation.type === 'attributes') {
           // Check if the mutation happened within the container or affected relevant elements
           if (containerRef.current?.contains(mutation.target)) {
             relevantChange = true;
             break;
           }
           // More specific checks could go here if needed
        }
      }
      if (relevantChange) {
         // console.log("Mutation detected, updating position");
         // Debounce or directly update
         window.requestAnimationFrame(updateSelectorPosition);
      }
    });

    // Start observing
    // Observe the container itself and the body for broader layout changes
    if (containerRef.current) {
       resizeObserver.observe(containerRef.current);
       mutationObserver.observe(containerRef.current, {
         childList: true,
         subtree: true,
         attributes: true, // Observe attribute changes too (like style/class)
       });
    }
    // Observing body can be heavy, but sometimes necessary for global layout shifts
    // resizeObserver.observe(document.body);
    // mutationObserver.observe(document.body, { childList: true, subtree: true });


    // Fallback: Window resize listener
    window.addEventListener('resize', updateSelectorPosition);

    // --- Cleanup ---
    return () => {
      clearTimeout(initialTimeoutId);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener('resize', updateSelectorPosition);
      // console.log("Dynamic positioning cleanup complete.");
    };
  }, [updateSelectorPosition, containerRef]); // Rerun effect if update function or ref changes

  return {
    selectorPosition,
    // Expose the update function if manual triggering is ever needed
    // updateSelectorPosition,
  };
}
