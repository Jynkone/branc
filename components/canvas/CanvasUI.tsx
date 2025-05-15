/* components/canvas/CanvasUI.tsx */
'use client';

import React, { RefObject, useEffect, useRef } from 'react';
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
  TLBinding,
} from 'tldraw';
import { SignOutButton } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { getBookmarkPreview } from '@/lib/getBookmarkPreview';
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

  /* --- unchanged arrow-binding listener omitted for brevity --- */

  return (
    <div ref={tldrawContainerRef} style={{ position: 'fixed', inset: 0 }}>
      <Tldraw
        store={store}
        shapeUtils={shapeUtils}
        tools={tools}
        initialState="select"
        overrides={overrides}
        components={components}
        assetUrls={assetUrls}
        hideUi={false}          
        onMount={(e) => {
          e.registerExternalAssetHandler('url', getBookmarkPreview);
          onEditorMount(e);
        }}
      />

      {currentRoom && (
        <div
          className="tldraw-page-selector-container"
          style={{
            position: 'absolute',
            left: selectorPosition,
            top: 0,
            zIndex: 3000,
          }}
        >
          <PageSelector
            currentRoom={currentRoom}
            availableRooms={availableRooms}
            pageSelectorHook={pageSelectorHook}
          />
        </div>
      )}

      <div className="absolute top-1 right-1 flex gap-1" style={{ zIndex: 2000 }}>
        {currentRoom && (
          <Button
            size="sm"
            variant="outline"
            onClick={shareDialogHook.handleOpenShareDialog}
          >
            Share
          </Button>
        )}
        <SignOutButton>
          <Button size="sm">Sign out</Button>
        </SignOutButton>
      </div>

      <ShareDialogComponent shareDialogHook={shareDialogHook} />
    </div>
  );
}
