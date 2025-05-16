import React, { RefObject, useEffect, useMemo } from 'react';
import {
  Tldraw,
  TLComponents,
  TLUiOverrides,
  TLUiAssetUrlOverrides,
  Editor,
  TLStoreWithStatus,
  HistoryEntry,
  TLRecord,
  TLShape,
  TLShapeId,
  TLBinding
} from "tldraw";
import { SignOutButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { getBookmarkPreview } from "@/lib/getBookmarkPreview";
import { PageSelector } from './PageSelector';
import { ShareDialogComponent } from './ShareDialogComponent';
import type { useBoardManager } from './hooks/useBoardManager';
import type { usePageSelector } from './hooks/usePageSelector';
import type { useShareDialog } from './hooks/useShareDialog';

// Define the props expected by CanvasUI
interface CanvasUIProps {
  userId: string;
  store: TLStoreWithStatus;
  shapeUtils: any[]; // Array of shape utils
  tools: any[]; // Array of custom tools
  overrides: TLUiOverrides;
  components: TLComponents;
  assetUrls: TLUiAssetUrlOverrides;
  editor: Editor | null;
  onEditorMount: (editor: Editor) => void;
  tldrawContainerRef: RefObject<HTMLDivElement>;
  selectorPosition: number;
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
  editor,
  onEditorMount,
  tldrawContainerRef,
  selectorPosition,
  boardManager,
  pageSelectorHook,
  shareDialogHook,
}: CanvasUIProps) {
  const { currentRoom, availableRooms } = boardManager;

  // Define helpers for type checking outside the effect to avoid re-creation
  const isShape = (record: TLRecord | undefined): record is TLShape => {
    return typeof record === 'object' && record !== null && 'typeName' in record && record.typeName === 'shape';
  };

  const isArrowBinding = (record: TLRecord | undefined): record is TLBinding => {
    return typeof record === 'object' && record !== null && 'typeName' in record && record.typeName === 'binding' && record.type === 'arrow';
  };

  // Store partial connections using ref to maintain state across renders
  const partialConnectionsRef = React.useRef(new Map<TLShapeId, { start?: TLShapeId, end?: TLShapeId }>());

  // Effect to add listener for manual arrow connections (Binding-based)
  useEffect(() => {
    if (!editor) return;

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
        let partialConnections = partialConnectionsRef.current;
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
            }
          }
        }
      });
    };

    const disposer = editor.store.listen(handleChanges, { source: 'user', scope: 'session' });

    return () => {
      disposer();
    };
  }, [editor]); // Only depend on editor to avoid unnecessary re-subscriptions

  return (
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
        }}
      />

      {/* Header Buttons (Page Selector, Share, Sign Out) */}
      <div className="absolute top-1 right-1 flex gap-1" style={{ zIndex: 2000 }}>
        {currentRoom && (
          <div className="tldraw-page-selector-container">
            <PageSelector
              currentRoom={currentRoom}
              availableRooms={availableRooms}
              pageSelectorHook={{
                ...pageSelectorHook,
              }}
            />
          </div>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={shareDialogHook.handleOpenShareDialog}
          className="match-height"
        >
          Share
        </Button>
        <SignOutButton>
          <Button size="sm" variant="default">
            Sign Out
          </Button>
        </SignOutButton>
      </div>

      {/* Share Dialog using the new component */}
      <ShareDialogComponent shareDialogHook={shareDialogHook} />
    </div>
  );
}