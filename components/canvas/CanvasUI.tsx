// components/canvas/CanvasUI.tsx
import React, { RefObject, useEffect } from 'react';
import {
  Tldraw,
  TLComponents,
  TLUiOverrides,
  TLUiAssetUrlOverrides,
  Editor,
  TLStoreWithStatus,
} from "tldraw";
import { SignOutButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { getBookmarkPreview } from "@/lib/getBookmarkPreview";
import { PageSelector } from './PageSelector';
import { ShareDialogComponent } from './ShareDialogComponent';
import type { useBoardManager } from './hooks/useBoardManager';
import type { usePageSelector } from './hooks/usePageSelector';
import type { useShareDialog } from './hooks/useShareDialog';

interface CanvasUIProps {
  userId: string;
  store: TLStoreWithStatus;
  shapeUtils: any[];
  tools: any[];
  overrides: TLUiOverrides;
  components: TLComponents;
  assetUrls: TLUiAssetUrlOverrides;
  editor: Editor | null; // This prop receives the editor instance from Canvas.tsx
  onEditorMount: (editor: Editor) => void;
  tldrawContainerRef: RefObject<HTMLDivElement>;
  // selectorPosition prop removed as it seemed unused for PageSelector
  boardManager: ReturnType<typeof useBoardManager>;
  pageSelectorHook: ReturnType<typeof usePageSelector>;
  shareDialogHook: ReturnType<typeof useShareDialog>;
}

export function CanvasUI({
  userId, // Kept userId as it was in your original props
  store,
  shapeUtils,
  tools,
  overrides,
  components,
  assetUrls,
  editor, // Use the editor instance passed as a prop
  onEditorMount,
  tldrawContainerRef,
  boardManager,
  pageSelectorHook,
  shareDialogHook,
}: CanvasUIProps) {
  const { currentRoom, availableRooms } = boardManager;

  // The listener logic for arrow connections was removed in the previous step for brevity.
  // If you need it, ensure it correctly uses the `editor` prop.
  // For example, if you had:
  // useEffect(() => {
  //   if (!editorFromHook) return; // where editorFromHook was from useState
  //   // ... listener logic ...
  // }, [editorFromHook]);
  // It should now correctly use the `editor` prop directly if the listener
  // needs to be in this component:
  // useEffect(() => {
  //   if (!editor) return; // editor from props
  //   // ... listener logic ...
  // }, [editor]);

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
          editorInstance.registerExternalAssetHandler('url', getBookmarkPreview);
          onEditorMount(editorInstance); 
        }}
      />

      <div className="absolute top-1 right-1 flex gap-1 items-center" style={{ zIndex: 2000 }}>
        {currentRoom && (
          <div className="tldraw-page-selector-container">
            <PageSelector
              currentRoom={currentRoom}
              availableRooms={availableRooms}
              pageSelectorHook={pageSelectorHook}
              shareDialogHook={shareDialogHook}
            />
          </div>
        )}
        <SignOutButton>
          <Button size="sm" variant="default" className="h-8">
            Sign Out
          </Button>
        </SignOutButton>
      </div>

      <ShareDialogComponent shareDialogHook={shareDialogHook} />
    </div>
  );
}