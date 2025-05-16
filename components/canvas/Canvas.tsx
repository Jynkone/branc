// components/canvas/Canvas.tsx
"use client";

import React, { useMemo, useState, useRef } from 'react';
import {
  Editor,
  TLStoreWithStatus,
  DefaultKeyboardShortcutsDialog,
  DefaultKeyboardShortcutsDialogContent,
  DefaultToolbar,
  DefaultToolbarContent,
  TLComponents,
  TLUiOverrides,
  DefaultMainMenu,
  TLUiAssetUrlOverrides,
  TldrawUiMenuItem,
  useIsToolSelected,
  useTools,
  defaultShapeUtils,
} from "tldraw";
import "tldraw/tldraw.css";

import { chatTool } from "@/tools/ChatTool";
import { ChatShapeUtil } from "@/components/chatshape/ChatShapeUtil";

import { useBoardManager } from './hooks/useBoardManager';
import { usePageSelector } from './hooks/usePageSelector';
import { useShareDialog } from './hooks/useShareDialog';
// useDynamicPositioning is removed if selectorPosition is not used
// import { useDynamicPositioning } from './hooks/useDynamicPositioning'; 

import { SyncedTldrawCanvas } from './SyncedTldrawCanvas';
import { CanvasUI } from './CanvasUI';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

const uiOverrides: TLUiOverrides = {
  tools(editor, tools) {
    tools.chat = {
      id: "chat",
      icon: "chat-icon",
      label: "Chat",
      kbd: "c",
      onSelect: () => editor.setCurrentTool("chat"),
    };
    return tools;
  },
};

const staticComponents: TLComponents = {
  Toolbar: (props) => {
    const tools = useTools();
    const isChatSelected = useIsToolSelected(tools.chat);
    return (
      <DefaultToolbar {...props}>
        {tools.chat && <TldrawUiMenuItem {...tools.chat} isSelected={isChatSelected} />}
        <DefaultToolbarContent />
      </DefaultToolbar>
    );
  },
  KeyboardShortcutsDialog: (props) => {
    const tools = useTools();
    return (
      <DefaultKeyboardShortcutsDialog {...props}>
        <DefaultKeyboardShortcutsDialogContent />
        {tools.chat && <TldrawUiMenuItem {...tools.chat} />}
      </DefaultKeyboardShortcutsDialog>
    );
  },
  PageMenu: null,
  MainMenu: DefaultMainMenu,
  DebugPanel: null,
};

const customAssetUrls: TLUiAssetUrlOverrides = {
  icons: {
    "chat-icon": "/BranchBox.svg",
  },
};

const customTools = [chatTool];

const getFormattedWorkerUrl = () => {
  const url = process.env.NEXT_PUBLIC_WORKER_URL || "branc.ajeenkya29.workers.dev";
  return url.startsWith("http") ? url : `https://${url}`;
};
const WORKER_URL = getFormattedWorkerUrl();

const getFormattedBoardId = (boardId: string) => {
  if (!boardId) return '';
  return boardId.replace(/^(user-)+/, 'user-');
};

export const getCustomShapeUtils = () => [ChatShapeUtil, ...defaultShapeUtils];

export function Canvas({ userId }: { userId: string }) {
  const boardManager = useBoardManager(userId);
  const { isLoading, currentRoom, availableRooms, selectBoard, createNewBoard, renameBoard, ensureBoardIsShareable, error: boardManagerError } = boardManager;

  const pageSelectorHook = usePageSelector({ currentRoom, availableRooms, selectBoard, createNewBoard, renameBoard });
  const shareDialogHook = useShareDialog({ currentRoom, ensureBoardIsShareable });

  const tldrawContainerRef = useRef<HTMLDivElement>(null);
  // selectorPosition is removed if not used
  // const { selectorPosition } = useDynamicPositioning(tldrawContainerRef); 
  const [editor, setEditor] = useState<Editor | null>(null);

  const customShapeUtilsArray = useMemo(() => getCustomShapeUtils(), []);

  const syncUri = useMemo(() => {
    if (!currentRoom || !currentRoom.id) return '';
    const formattedId = getFormattedBoardId(currentRoom.id);
    return `${WORKER_URL}/connect/${formattedId}`;
  }, [currentRoom]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading Canvas Data...</div>;
  }
  
  if (boardManagerError) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Alert variant="destructive" className="max-w-md">
          <AlertTitle>Error Loading Boards</AlertTitle>
          <AlertDescription>Could not load board data: {boardManagerError}</AlertDescription>
          <Button onClick={() => window.location.reload()} className="mt-4">Reload Page</Button>
        </Alert>
      </div>
    );
  }
  
  if (!currentRoom || !syncUri) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Alert variant="destructive" className="max-w-md">
          <AlertTitle>Initialization Error</AlertTitle>
          <AlertDescription>Board not available or sync URI could not be determined.</AlertDescription>
          <Button onClick={() => window.location.reload()} className="mt-4">Reload Page</Button>
        </Alert>
      </div>
    );
  }

  return (
    <SyncedTldrawCanvas
      key={currentRoom.id}
      syncUri={syncUri}
      initialCurrentRoomName={currentRoom.name}
      initialCurrentRoomId={currentRoom.id}
      editorInstance={editor}
      onEditorMount={setEditor}
      customShapeUtils={customShapeUtilsArray}
    >
      {(store: TLStoreWithStatus, _editorFromSync: Editor | null, _onEditorMountFromSync: (editor: Editor) => void) => (
        <CanvasUI
          userId={userId}
          store={store}
          shapeUtils={customShapeUtilsArray}
          tools={customTools}
          overrides={uiOverrides}
          components={staticComponents}
          assetUrls={customAssetUrls}
          editor={editor} // Pass the editor state here
          onEditorMount={setEditor} // Allow CanvasUI to also call onEditorMount if it needs to
          tldrawContainerRef={tldrawContainerRef}
          // selectorPosition={selectorPosition} // Removed
          boardManager={boardManager}
          pageSelectorHook={pageSelectorHook}
          shareDialogHook={shareDialogHook}
        />
      )}
    </SyncedTldrawCanvas>
  );
}