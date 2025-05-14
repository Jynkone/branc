// components/canvas/Canvas.tsx
"use client";

import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import {
  Editor,
  TLStoreWithStatus, // We'll get these from SyncedTldrawCanvas render prop
  // Imports needed for uiOverrides, staticComponents, etc.
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
  defaultShapeUtils, // <<< IMPORT THIS
} from "tldraw";
import "tldraw/tldraw.css";

// Import your custom utils and tools
import { chatTool } from "@/tools/ChatTool";
import { ChatShapeUtil } from "@/components/chatshape/ChatShapeUtil"; // <<< IMPORT THIS

// Import Hooks
import { useBoardManager, RoomData } from './hooks/useBoardManager';
import { usePageSelector } from './hooks/usePageSelector';
import { useShareDialog } from './hooks/useShareDialog';
import { useDynamicPositioning } from './hooks/useDynamicPositioning';

// Import Components
import { SyncedTldrawCanvas } from './SyncedTldrawCanvas';
import { CanvasUI } from './CanvasUI';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

// Constants for Tldraw setup
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

// NOTE: If useTools() and useIsToolSelected() are used inside these component definitions,
// they must be called within a component that is a child of <Tldraw />.
// It's generally safer to define these more complex components where they have access to Tldraw's context,
// or pass the necessary state/callbacks to them.
// For this example, we keep them here, but ensure CanvasUI correctly provides the Tldraw context.
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

export function Canvas({ userId }: { userId: string }) {
  const boardManager = useBoardManager(userId);
  const { isLoading, currentRoom, availableRooms, selectBoard, createNewBoard, renameBoard, ensureBoardIsShareable, error: boardManagerError } = boardManager;

  const pageSelectorHook = usePageSelector({ currentRoom, availableRooms, selectBoard, createNewBoard, renameBoard });
  const shareDialogHook = useShareDialog({ currentRoom, ensureBoardIsShareable });

  const tldrawContainerRef = useRef<HTMLDivElement>(null);
  const { selectorPosition } = useDynamicPositioning(tldrawContainerRef);
  const [editor, setEditor] = useState<Editor | null>(null);

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

  // Define customShapeUtils here as it uses ChatShapeUtil and defaultShapeUtils
  const customShapeUtilsArray = useMemo(() => {
    return [ChatShapeUtil, ...defaultShapeUtils];
  }, []);


  return (
    <SyncedTldrawCanvas
      key={currentRoom.id}
      syncUri={syncUri}
      initialCurrentRoomName={currentRoom.name}
      initialCurrentRoomId={currentRoom.id}
      editorInstance={editor}
      onEditorMount={setEditor}
    >
      {(store: TLStoreWithStatus, _editorFromSync: Editor | null, _onEditorMountFromSync: (editor: Editor) => void) => (
        <CanvasUI
          userId={userId}
          store={store}
          shapeUtils={customShapeUtilsArray} // Pass the memoized array
          tools={customTools}
          overrides={uiOverrides}
          components={staticComponents}
          assetUrls={customAssetUrls}
          editor={editor}
          onEditorMount={setEditor}
          tldrawContainerRef={tldrawContainerRef}
          selectorPosition={selectorPosition}
          boardManager={boardManager}
          pageSelectorHook={pageSelectorHook}
          shareDialogHook={shareDialogHook}
        />
      )}
    </SyncedTldrawCanvas>
  );
}