// components/canvas/Canvas.tsx
"use client";

import React, { useMemo, useState, useRef, useEffect } from 'react'; // Removed useCallback for now, add if specific functions need it
import {
  Editor, TLStoreWithStatus,
  DefaultKeyboardShortcutsDialog, DefaultKeyboardShortcutsDialogContent,
  DefaultToolbar, DefaultToolbarContent, TLComponents, TLUiOverrides,
  DefaultMainMenu, TLUiAssetUrlOverrides, TldrawUiMenuItem,
  useIsToolSelected, useTools, defaultShapeUtils,
} from "tldraw";
import { useSync } from '@tldraw/sync';
import "tldraw/tldraw.css";

import { chatTool } from "@/tools/ChatTool";
import { ChatShapeUtil } from "@/components/chatshape/ChatShapeUtil";
import { multiplayerAssetStore } from "@/lib/multiplayerAssetStore";

import { useBoardManager, RoomData } from './hooks/useBoardManager';
import { usePageSelector } from './hooks/usePageSelector';
import { useShareDialog } from './hooks/useShareDialog';
import { useDynamicPositioning } from './hooks/useDynamicPositioning';

import { CanvasUI } from './CanvasUI';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

const getFormattedWorkerUrl = () => {
  const url = process.env.NEXT_PUBLIC_WORKER_URL || "branc.ajeenkya29.workers.dev";
  return url.startsWith("http") ? url : `https://${url}`;
};
const WORKER_URL = getFormattedWorkerUrl();

const getFormattedBoardId = (boardId: string) => {
  if (!boardId) return '';
  return boardId.replace(/^(user-)+/, 'user-');
};

// --- Tldraw UI Customizations (defined once outside component) ---
const uiOverrides: TLUiOverrides = {
  tools(editor, tools) {
    tools.chat = { id: "chat", icon: "chat-icon", label: "Chat", kbd: "c", onSelect: () => editor.setCurrentTool("chat") };
    return tools;
  },
};
const customAssetUrls: TLUiAssetUrlOverrides = { icons: { "chat-icon": "/BranchBox.svg" } };
const customTools = [chatTool];

// Moved shapeUtils here, to be memoized inside the component if needed or kept static if possible
// const staticShapeUtils = [ChatShapeUtil, ...defaultShapeUtils];
// This function can be outside if ChatShapeUtil and defaultShapeUtils are always available at module scope
export const getCustomShapeUtils = () => [ChatShapeUtil, ...defaultShapeUtils];


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
  PageMenu: null, MainMenu: DefaultMainMenu, DebugPanel: null,
};

export function Canvas({ userId }: { userId: string }) {
  const boardManager = useBoardManager(userId);
  const { isLoading, currentRoom, availableRooms, selectBoard, createNewBoard, renameBoard, ensureBoardIsShareable, error: boardManagerError } = boardManager;

  const pageSelectorHook = usePageSelector({ currentRoom, availableRooms, selectBoard, createNewBoard, renameBoard });
  const shareDialogHook = useShareDialog({ currentRoom, ensureBoardIsShareable });

  const tldrawContainerRef = useRef<HTMLDivElement>(null);
  const { selectorPosition } = useDynamicPositioning(tldrawContainerRef);
  const [editor, setEditor] = useState<Editor | null>(null);

  const customShapeUtilsArray = useMemo(() => getCustomShapeUtils(), []); // Memoize it

  const syncUri = useMemo(() => {
    if (!currentRoom?.id) return '';
    const formattedId = getFormattedBoardId(currentRoom.id);
    return `${WORKER_URL}/connect/${formattedId}`;
  }, [currentRoom]);

  // --- useSync and connection handling logic directly in Canvas.tsx ---
  const store = useSync({
    uri: syncUri,
    assets: multiplayerAssetStore,
    shapeUtils: customShapeUtilsArray, // Use the memoized array
  });

  const [connectionFailedPermanently, setConnectionFailedPermanently] = useState(false);
  const [currentConnectionAttempt, setCurrentConnectionAttempt] = useState(0);
  const maxRetries = 3;

  useEffect(() => {
    console.log(`[Canvas.tsx] Sync URI changed to: ${syncUri}. Resetting connection state.`);
    setConnectionFailedPermanently(false);
    setCurrentConnectionAttempt(0);
  }, [syncUri]);

  useEffect(() => {
    if (!syncUri) {
      setConnectionFailedPermanently(false); return;
    }
    const currentStatus = store.status;
    const successfullyConnectedStatus = 'synced-remote';

    console.log(`[Canvas.tsx] Store status for ${syncUri}: ${currentStatus}, Attempt: ${currentConnectionAttempt + 1}`);

    if (currentStatus === 'error') {
      if (currentConnectionAttempt < maxRetries) {
        if (connectionFailedPermanently) setConnectionFailedPermanently(false);
        console.error(`[Canvas.tsx] Sync connection error (Attempt ${currentConnectionAttempt + 1}/${maxRetries}). Retrying...`);
        const retryDelay = 3000 * (currentConnectionAttempt + 1);
        const timer = setTimeout(() => {
          setCurrentConnectionAttempt(prev => prev + 1);
        }, retryDelay);
        return () => clearTimeout(timer);
      } else if (!connectionFailedPermanently) {
        console.error(`[Canvas.tsx] Max retries (${maxRetries}) reached for ${syncUri}. Marking as permanently failed.`);
        setConnectionFailedPermanently(true);
      }
    } else if (currentStatus === successfullyConnectedStatus) {
      if (currentConnectionAttempt > 0 || connectionFailedPermanently) {
        console.log(`[Canvas.tsx] Successfully connected to ${syncUri}.`);
      }
      setConnectionFailedPermanently(false);
      setCurrentConnectionAttempt(0);
    } else {
      if (connectionFailedPermanently) setConnectionFailedPermanently(false);
    }
  }, [store.status, syncUri, currentConnectionAttempt, maxRetries, connectionFailedPermanently]);

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
          {/* Consider adding a button to create a new board if appropriate */}
          <Button onClick={() => createNewBoard().then(newRoom => newRoom && selectBoard(newRoom.id))} className="mt-2">Create New Board</Button>
          <Button onClick={() => window.location.reload()} className="mt-2 ml-2">Reload Page</Button>
        </Alert>
      </div>
    );
  }
  if (connectionFailedPermanently) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-full max-w-md p-6">
          <Alert variant="destructive">
            <AlertTitle>Connection Error</AlertTitle>
            <AlertDescription className="mt-2">
              Failed to connect to board: "{currentRoom.name}" ({currentRoom.id}) after {maxRetries} retries.
            </AlertDescription>
            <div className="mt-4 flex justify-end space-x-2">
              <Button variant="destructive" onClick={() => { setConnectionFailedPermanently(false); setCurrentConnectionAttempt(0); }}>
                Try Again
              </Button>
              <Button variant="outline" onClick={() => window.location.reload()}>Reload Page</Button>
            </div>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <CanvasUI
      key={currentRoom.id} // Keying CanvasUI is important for tldraw to remount cleanly with a new store/room
      userId={userId}
      store={store}
      shapeUtils={customShapeUtilsArray}
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
  );
}