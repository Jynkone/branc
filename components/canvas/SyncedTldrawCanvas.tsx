// File: Jynkone/branc/branc-35acf07df2bc3fdbf1d7d97ee2c139d0fcf9291a/components/canvas/SyncedTldrawCanvas.tsx
"use client";

import React, { useMemo, useState, useEffect, RefObject } from 'react';
import {
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
  Editor,
  TLStoreWithStatus,
  // Tldraw component is used by CanvasUI
} from "tldraw";
import { useSync } from '@tldraw/sync';
import "tldraw/tldraw.css";
import { chatTool } from "@/tools/ChatTool";
import { ChatShapeUtil } from "@/components/chatshape/ChatShapeUtil";
import { multiplayerAssetStore } from "@/lib/multiplayerAssetStore";

import { CanvasUI } from './CanvasUI';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

import type { RoomData } from './hooks/useBoardManager';
import type { useBoardManager } from './hooks/useBoardManager';
import type { usePageSelector } from './hooks/usePageSelector';
import type { useShareDialog } from './hooks/useShareDialog';

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

const components: TLComponents = {
  Toolbar: (props) => {
    const tools = useTools();
    const isChatSelected = useIsToolSelected(tools["chat"]);
    return (
      <DefaultToolbar {...props}>
        <TldrawUiMenuItem {...tools["chat"]} isSelected={isChatSelected} />
        <DefaultToolbarContent />
      </DefaultToolbar>
    );
  },
  KeyboardShortcutsDialog: (props) => {
    const tools = useTools();
    return (
      <DefaultKeyboardShortcutsDialog {...props}>
        <DefaultKeyboardShortcutsDialogContent />
        {tools["chat"] && <TldrawUiMenuItem {...tools["chat"]} />}
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

interface SyncedTldrawCanvasProps {
  userId: string;
  syncUri: string;
  initialCurrentRoom: RoomData;
  boardManager: ReturnType<typeof useBoardManager>;
  pageSelectorHook: ReturnType<typeof usePageSelector>;
  shareDialogHook: ReturnType<typeof useShareDialog>;
  tldrawContainerRef: RefObject<HTMLDivElement>;
  selectorPosition: number;
  editorInstance: Editor | null;
  onEditorMount: (editor: Editor) => void;
}

export function SyncedTldrawCanvas({
  userId,
  syncUri,
  initialCurrentRoom,
  boardManager,
  pageSelectorHook,
  shareDialogHook,
  tldrawContainerRef,
  selectorPosition,
  editorInstance,
  onEditorMount,
}: SyncedTldrawCanvasProps) {

  const customShapeUtils = useMemo(() => {
    return [ChatShapeUtil, ...defaultShapeUtils] as any;
  }, []);

  const store = useSync({
    uri: syncUri,
    assets: multiplayerAssetStore,
    shapeUtils: customShapeUtils,
  });

  const [connectionFailed, setConnectionFailed] = useState(false);
  const [connectionRetries, setConnectionRetries] = useState(0);
  const maxRetries = 3;

  useEffect(() => {
    setConnectionFailed(false);
    setConnectionRetries(0);
    console.log(`[SyncedTldrawCanvas] Initializing or URI changed. Attempting to connect to: ${syncUri}`);
  }, [syncUri]);

  useEffect(() => {
    const successfullyConnectedStatus = 'synced-remote';
    const currentStatus = store.status;

    // console.log(`[SyncedTldrawCanvas] Store status update for URI ${syncUri}: ${currentStatus}`);

    if (currentStatus === 'error') {
      if (!connectionFailed && connectionRetries < maxRetries) {
        console.error(`[SyncedTldrawCanvas] Sync connection error for URI: ${syncUri}. Status: ${currentStatus}. Retry ${connectionRetries + 1}/${maxRetries}`);
        setConnectionFailed(true);
        
        const timer = setTimeout(() => {
          console.log(`[SyncedTldrawCanvas] Re-attempting connection (${connectionRetries + 1}/${maxRetries}) for URI: ${syncUri}.`);
          setConnectionRetries(prev => prev + 1);
          setConnectionFailed(false); 
        }, 3000 * (connectionRetries + 1));
        
        return () => clearTimeout(timer);
      } else if (connectionRetries >= maxRetries) {
        if (!connectionFailed) setConnectionFailed(true); // Ensure UI reflects max retries reached
        console.error(`[SyncedTldrawCanvas] Max retries reached for URI: ${syncUri}.`);
      }
    } else if (currentStatus === successfullyConnectedStatus) {
      if (connectionFailed || connectionRetries > 0) {
        console.log(`[SyncedTldrawCanvas] Successfully connected to URI: ${syncUri} after ${connectionRetries} retries.`);
      } else {
        // console.log(`[SyncedTldrawCanvas] Store status for ${syncUri}: ${currentStatus}`);
      }
      setConnectionFailed(false);
      setConnectionRetries(0);
    } else {
      // Handle other transient states: 'loading', 'connecting', 'not-synced', 'synced-local'
      // console.log(`[SyncedTldrawCanvas] Store in transient state for ${syncUri}: ${currentStatus}`);
      // If it was previously marked as failed, but is now in a (non-error, non-success) transient state,
      // it means a retry might be in progress or it's recovering. Keep connectionFailed as true
      // until success or max retries are hit for the 'error' state.
      // No specific action needed here other than potentially logging.
      // The `connectionFailed` flag will only be reset by a successful connection
      // or by the user clicking "Try Again".
    }

  }, [store.status, syncUri, connectionFailed, connectionRetries, maxRetries]);

  if (connectionFailed && connectionRetries >= maxRetries) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-full max-w-md p-6">
          <Alert variant="destructive">
            <AlertTitle>Connection Error</AlertTitle>
            <AlertDescription className="mt-2">
              Failed to connect to board: "{initialCurrentRoom.name}" ({initialCurrentRoom.id}) after {maxRetries} retries.
              You can try reloading or selecting a different board.
            </AlertDescription>
            <div className="mt-4 flex justify-end space-x-2">
              <Button 
                variant="destructive"
                onClick={() => {
                  setConnectionFailed(false);
                  setConnectionRetries(0); 
                }}
              >
                Try Again
              </Button>
              <Button 
                variant="outline"
                onClick={() => window.location.reload()}
              >
                Reload Page
              </Button>
            </div>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <CanvasUI
      userId={userId}
      store={store}
      shapeUtils={customShapeUtils}
      tools={customTools}
      overrides={uiOverrides}
      components={components}
      assetUrls={customAssetUrls}
      editor={editorInstance}
      onEditorMount={onEditorMount}
      tldrawContainerRef={tldrawContainerRef}
      selectorPosition={selectorPosition}
      boardManager={boardManager}
      pageSelectorHook={pageSelectorHook}
      shareDialogHook={shareDialogHook}
    />
  );
}