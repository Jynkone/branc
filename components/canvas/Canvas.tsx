/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* components/canvas/Canvas.tsx */
'use client';

import { useMemo, useRef, useState } from 'react';
import {
  TLUiOverrides,
  TLComponents,
  useTools,
  useIsToolSelected,
  defaultShapeUtils,
  Editor,
  TLStoreWithStatus,
  DefaultToolbar,
  DefaultToolbarContent,
  TldrawUiMenuItem,
} from 'tldraw';

import { SyncedTldrawCanvas } from './SyncedTldrawCanvas';
import { CanvasUI } from './CanvasUI';

import { chatTool } from '@/tools/ChatTool';
import { ChatShapeUtil } from '@/components/chatshape/ChatShapeUtil';

import { useBoardManager } from './hooks/useBoardManager';
import { usePageSelector } from './hooks/usePageSelector';
import { useShareDialog } from './hooks/useShareDialog';
import { useDynamicPositioning } from './hooks/useDynamicPositioning';

/* ------------------------------------------------------------------ */
/* 1 · Custom shapes / tools                                           */
/* ------------------------------------------------------------------ */
export const getCustomShapeUtils = () => [ChatShapeUtil];
const customTools = [chatTool];

/* ------------------------------------------------------------------ */
/* 2 · Add the Chat tool to the standard toolbar                       */
/* ------------------------------------------------------------------ */
const uiOverrides: TLUiOverrides = {
  tools(editor, tools) {
    tools.chat = {
      id: 'chat',
      icon: 'chat-icon',
      label: 'Chat',
      kbd: 'c',
      onSelect: () => editor.setCurrentTool('chat'),
    };
    return tools;
  },
};

const Toolbar: TLComponents['Toolbar'] = () => {
  const tools = useTools();
  const isChatSelected = useIsToolSelected(tools.chat);

  return (
    <DefaultToolbar>
      {tools.chat && (
        <TldrawUiMenuItem {...tools.chat} isSelected={isChatSelected} />
      )}
      <DefaultToolbarContent />
    </DefaultToolbar>
  );
};

const components: TLComponents = {
  Toolbar,
  DebugPanel: null,
};

/* ------------------------------------------------------------------ */
/* 3 · Helper to build the sync URL                                    */
/* ------------------------------------------------------------------ */
const WORKER_ROOT =
  (process.env.NEXT_PUBLIC_WORKER_URL ?? 'branc.ajeenkya29.workers.dev').replace(
    /^(?!https?:)/,
    'https://',
  );
const toRoomUrl = (id: string) =>
  `${WORKER_ROOT}/connect/${id.replace(/^user-*/, 'user-')}`;

/* ------------------------------------------------------------------ */
/* 4 · Main exported component                                         */
/* ------------------------------------------------------------------ */
export function Canvas({ userId }: { userId: string }) {
  const boardMgr = useBoardManager(userId);
  const {
    currentRoom,
    availableRooms,
    selectBoard,
    createNewBoard,
    renameBoard,
    ensureBoardIsShareable,
    isLoading,
    error,
  } = boardMgr;

  const pageSelHook = usePageSelector({
    currentRoom,
    availableRooms,
    selectBoard,
    createNewBoard,
    renameBoard,
  });
  const shareHook = useShareDialog({ currentRoom, ensureBoardIsShareable });

  /* page-selector positioning */
  const tlRef = useRef<HTMLDivElement>(null);
  const { selectorPosition } = useDynamicPositioning(tlRef);

  const [editor, setEditor] = useState<Editor | null>(null);

  const shapeUtils = useMemo(
    () => [...defaultShapeUtils, ...getCustomShapeUtils()],
    [],
  );

  /* loading / error UI */
  if (isLoading)
    return <div className="flex h-screen items-center justify-center">Loading…</div>;
  if (!currentRoom || error)
    return (
      <div className="flex h-screen items-center justify-center">
        {error ?? 'No board selected'}
      </div>
    );

  return (
    <SyncedTldrawCanvas
      key={currentRoom.id}
      syncUri={toRoomUrl(currentRoom.id)}
      initialCurrentRoomName={currentRoom.name}
      initialCurrentRoomId={currentRoom.id}
      editorInstance={editor}
      onEditorMount={setEditor}
    >
      {(store: TLStoreWithStatus) => (
        <CanvasUI
          userId={userId}
          store={store}
          shapeUtils={shapeUtils}
          tools={customTools}
          overrides={uiOverrides}
          components={components}
          assetUrls={{ icons: { 'chat-icon': '/BranchBox.svg' } }}
          editor={editor}
          onEditorMount={setEditor}
          tldrawContainerRef={tlRef}
          selectorPosition={selectorPosition}
          boardManager={boardMgr}
          pageSelectorHook={pageSelHook}
          shareDialogHook={shareHook}
        />
      )}
    </SyncedTldrawCanvas>
  );
}
