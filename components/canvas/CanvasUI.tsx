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

  /* ------------------------------------------------------------------ */
  /*  Type-guards used by arrow-binding listener                         */
  /* ------------------------------------------------------------------ */
  const isShape = (rec: TLRecord | undefined): rec is TLShape =>
    !!rec && rec.typeName === 'shape';

  const isArrowBinding = (rec: TLRecord | undefined): rec is TLBinding =>
    !!rec &&
    rec.typeName === 'binding' &&
    (rec as TLBinding).type === 'arrow';

  /* ------------------------------------------------------------------ */
  /*  Track partial arrow connections until both ends are known         */
  /* ------------------------------------------------------------------ */
  const partialConnectionsRef = useRef<
    Map<TLShapeId, { start?: TLShapeId; end?: TLShapeId }>
  >(new Map());

  useEffect(() => {
    if (!editor) return;

    const handleChanges = (entry: HistoryEntry<TLRecord>) => {
      /* merge added + updated */
      const changed: Record<string, TLRecord> = { ...entry.changes.added };
      Object.values(entry.changes.updated).forEach(([, next]) => {
        changed[next.id] = next;
      });

      Object.values(changed).forEach((record) => {
        if (!isArrowBinding(record)) return;

        const binding = record; // already TLBinding
        if (
          !binding.props ||
          typeof binding.props !== 'object' ||
          !('terminal' in binding.props)
        )
          return;

        const arrowId = binding.fromId;
        const connectedId = binding.toId;
        const terminal = binding.props.terminal as 'start' | 'end';

        const map = partialConnectionsRef.current;
        const conn = map.get(arrowId) ?? {};
        if (terminal === 'start') conn.start = connectedId;
        else conn.end = connectedId;
        map.set(arrowId, conn);

        /* when both ends are known, update parentId */
        if (conn.start && conn.end) {
          map.delete(arrowId);

          const src = editor.getShape(conn.start);
          const dst = editor.getShape(conn.end);

          if (
            isShape(src) &&
            src.type === 'chat' &&
            isShape(dst) &&
            dst.type === 'chat' &&
            !(dst.props as any).parentId
          ) {
            console.log(
              `CanvasUI: connecting ${dst.id} to parent ${src.id} via arrow ${arrowId}`,
            );
            editor.batch(() =>
              editor.updateShape({
                id: dst.id,
                type: 'chat',
                props: { parentId: src.id },
              }),
            );
          }
        }
      });
    };

    const dispose = editor.store.listen(handleChanges, {
      source: 'user',
      scope: 'session',
    });
    return dispose;
  }, [editor]);

  /* ------------------------------------------------------------------ */
  /*  Render                                                             */
  /* ------------------------------------------------------------------ */
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
