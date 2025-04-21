import React, { RefObject, useEffect } from 'react'; // Import useEffect
import {
  Tldraw,
  TLComponents,
  TLUiOverrides,
  TLUiAssetUrlOverrides,
  Editor,
  TLStoreWithStatus,
  HistoryEntry, // Import HistoryEntry type
  TLRecord, // Import TLRecord type
  TLShape, // Import TLShape type
  TLShapeId, // Import TLShapeId type
  TLBinding // Import TLBinding type
} from "tldraw";
import { SignOutButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button"; // Reverted to alias path
import { getBookmarkPreview } from "@/lib/getBookmarkPreview"; // Reverted to alias path
import { PageSelector } from './PageSelector'; // Path is correct
import { ShareDialogComponent } from './ShareDialogComponent'; // Path is correct
import type { useBoardManager } from './hooks/useBoardManager'; // Path is correct
import type { usePageSelector } from './hooks/usePageSelector'; // Path is correct
import type { useShareDialog } from './hooks/useShareDialog'; // Path is correct
// Import toast if needed later: import { toast } from "sonner";

// Define the props expected by CanvasUI
interface CanvasUIProps {
  userId: string; // Keep userId if needed for any direct rendering logic, though likely not
  store: TLStoreWithStatus;
  shapeUtils: any[]; // Consider defining a more specific type if possible
  tools: any[]; // Consider defining a more specific type if possible
  overrides: TLUiOverrides;
  components: TLComponents;
  assetUrls: TLUiAssetUrlOverrides;
  editor: Editor | null; // Receive editor instance
  onEditorMount: (editor: Editor) => void; // Receive mount callback
  tldrawContainerRef: RefObject<HTMLDivElement>;
  selectorPosition: number; // Reverted back to number type
  boardManager: ReturnType<typeof useBoardManager>;
  pageSelectorHook: ReturnType<typeof usePageSelector>;
  shareDialogHook: ReturnType<typeof useShareDialog>;
}

export function CanvasUI({
  store,
  shapeUtils,
  tools,
  overrides,
  components,
  assetUrls,
  editor, // Destructure editor
  onEditorMount, // Destructure mount callback
  tldrawContainerRef,
  selectorPosition,
  boardManager,
  pageSelectorHook,
  shareDialogHook,
}: CanvasUIProps) {

  const { currentRoom, availableRooms } = boardManager; // Destructure needed state

  // Effect to add listener for manual arrow connections (Binding-based)
  useEffect(() => {
    if (!editor) return;

    // Helper to check if a record is a shape
    const isShape = (record: TLRecord | undefined): record is TLShape => {
      return typeof record === 'object' && record !== null && 'typeName' in record && record.typeName === 'shape';
    };

    // Helper to check if a record is an arrow binding
    const isArrowBinding = (record: TLRecord | undefined): record is TLBinding => {
       return typeof record === 'object' && record !== null && 'typeName' in record && record.typeName === 'binding' && record.type === 'arrow';
    };

    // Store partial connections keyed by arrowId
    const partialConnections = new Map<TLShapeId, { start?: TLShapeId, end?: TLShapeId }>();

    const handleChanges = (entry: HistoryEntry<TLRecord>) => {
      // Check added and updated bindings
      // Combine added and updated records for processing
      const changedRecords: Record<string, TLRecord> = { ...entry.changes.added };
      Object.values(entry.changes.updated).forEach(([_, next]) => {
        changedRecords[next.id] = next;
      });


      Object.values(changedRecords).forEach(record => {
        if (!isArrowBinding(record)) return;

        // Assert record type after check for type safety
        const binding = record as TLBinding;
        // Further check if props and terminal exist before accessing
        if (!binding.props || typeof binding.props !== 'object' || !('terminal' in binding.props)) return;

        const arrowId = binding.fromId;
        const connectedShapeId = binding.toId;
        const terminal = binding.props.terminal; // Now safe to access

        // Update partial connection info
        let connection = partialConnections.get(arrowId) ?? {};
        if (terminal === 'start') {
          connection.start = connectedShapeId;
        } else if (terminal === 'end') {
          connection.end = connectedShapeId;
        }
        partialConnections.set(arrowId, connection);

        // Check if we have both ends connected for this arrow
        if (connection.start && connection.end) {
          const sourceShapeId = connection.start;
          const targetShapeId = connection.end;

          // Clear the partial connection now that we've processed it
          partialConnections.delete(arrowId);

          // Get the shapes using the non-null editor instance
          const sourceShape = editor.getShape(sourceShapeId);
          const targetShape = editor.getShape(targetShapeId);

          // Validate and update parentId
          if (isShape(sourceShape) && sourceShape.type === 'chat' &&
              isShape(targetShape) && targetShape.type === 'chat' &&
              typeof targetShape.props === 'object' && targetShape.props !== null)
          {
              let currentParentId: string | undefined = undefined;
              let hasParent = false;
              // Check if parentId exists and is non-empty
              if ('parentId' in targetShape.props &&
                  targetShape.props.parentId !== undefined &&
                  targetShape.props.parentId !== '')
              {
                  currentParentId = targetShape.props.parentId as string | undefined;
                  hasParent = true;
              }

              if (!hasParent) {
                console.log(`CanvasUI Listener (Binding): Manually connecting ${targetShapeId} to parent ${sourceShapeId} via arrow ${arrowId}`);
                editor.batch(() => {
                  editor.updateShape({
                    id: targetShapeId,
                    type: 'chat',
                    props: { parentId: sourceShapeId },
                  });
                });
                // toast("Context linked successfully!"); // Add toast notification here if sonner is installed
              }
          }
        }
      });

      // Handle binding deletion (optional: clear parentId if arrow is removed?)
      // if (entry.changes.removed) { ... }

    }; // End handleChanges

    const disposer = editor.store.listen(handleChanges, { source: 'user', scope: 'session' });

    return () => {
      disposer();
    };
  }, [editor]);


  return (
    // Add ref to the main container for dynamic positioning hook
    <div ref={tldrawContainerRef} style={{ position: "fixed", inset: 0 }}>
      <Tldraw
        store={store}
        shapeUtils={shapeUtils}
        hideUi={false}
        tools={tools}
        initialState="select"
        overrides={overrides}
        components={components}
        assetUrls={assetUrls}
        onMount={(editorInstance) => {
          // Register bookmark handler
          editorInstance.registerExternalAssetHandler('url', getBookmarkPreview);
          // Call the mount callback passed from parent
          onEditorMount(editorInstance);
          // Log store initialization (optional)
          if (currentRoom) {
            // console.log("TLDraw mounted for room:", currentRoom.id);
          }
          // No need to call updateSelectorPosition here, the hook handles it
        }}
      />

      {/* Page Selector using the new component and dynamic positioning */}
      {currentRoom && ( // Only render PageSelector if there's a current room
        <div
          className="tldraw-page-selector-container"
          style={{
            position: "absolute",
            left: `${selectorPosition}px`, // Use number directly
            top: "0px", // Adjust top position if needed based on tldraw UI
            zIndex: 3000 // Ensure it's above tldraw UI elements
          }}
        >
          <PageSelector
            currentRoom={currentRoom}
            availableRooms={availableRooms}
            pageSelectorHook={pageSelectorHook}
          />
        </div>
      )}


      {/* Header Buttons (Share, Sign Out) */}
      <div className="absolute top-1 right-1 flex gap-1" style={{ zIndex: 2000 }}>
        {currentRoom && ( // Only show Share button if there's a room
           <Button
             size="sm"
             variant="outline"
             onClick={shareDialogHook.handleOpenShareDialog} // Use handler from hook
             className="match-height" // Keep existing style
           >
             Share
           </Button>
        )}
        <SignOutButton>
          <Button size="sm" variant="default">
            Sign Out
          </Button>
        </SignOutButton>
      </div>

      {/* Share Dialog using the new component */}
      <ShareDialogComponent shareDialogHook={shareDialogHook} />

      {/* Global styles removed from here */}
    </div>
  );
}
