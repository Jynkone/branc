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
        {tools["chat"] && <TldrawUiMenuItem {...tools["chat"]} isSelected={isChatSelected} />}
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

  console.log(`[SyncedTldrawCanvas] Initializing useSync with URI: ${syncUri}`);
  const store = useSync({
    uri: syncUri,
    assets: multiplayerAssetStore,
    shapeUtils: customShapeUtils,
  });

  const [connectionFailedPermanently, setConnectionFailedPermanently] = useState(false);
  const [currentConnectionAttempt, setCurrentConnectionAttempt] = useState(0);
  const maxRetries = 3;

  useEffect(() => {
    console.log(`[SyncedTldrawCanvas] New syncUri detected: ${syncUri}. Resetting connection state.`);
    setConnectionFailedPermanently(false);
    setCurrentConnectionAttempt(0);
  }, [syncUri]);

  useEffect(() => {
    const successfullyConnectedStatus = 'synced-remote';
    const currentStatus = store.status;

    // console.log(`[SyncedTldrawCanvas] Store status for URI ${syncUri}: ${currentStatus}, Attempt: ${currentConnectionAttempt}`);

    if (currentStatus === 'error') {
      if (currentConnectionAttempt < maxRetries) {
        // Only set connectionFailedPermanently to false if it was true, to allow retry UI to clear
        if (connectionFailedPermanently) setConnectionFailedPermanently(false);

        console.error(`[SyncedTldrawCanvas] Sync connection error (Attempt ${currentConnectionAttempt + 1}/${maxRetries}) for URI: ${syncUri}. Status: ${currentStatus}. Will retry.`);
        
        const retryDelay = 3000 * (currentConnectionAttempt + 1);
        const timer = setTimeout(() => {
          setCurrentConnectionAttempt(prev => prev + 1);
        }, retryDelay);
        return () => clearTimeout(timer);
      } else if (!connectionFailedPermanently) { // Only set to true once if max retries reached
        console.error(`[SyncedTldrawCanvas] Max retries (${maxRetries}) reached for URI: ${syncUri}. Marking as permanently failed.`);
        setConnectionFailedPermanently(true);
      }
    } else if (currentStatus === successfullyConnectedStatus) {
      if (currentConnectionAttempt > 0 || connectionFailedPermanently) {
        console.log(`[SyncedTldrawCanvas] Successfully connected to URI: ${syncUri} after ${currentConnectionAttempt} attempt(s).`);
      }
      setConnectionFailedPermanently(false);
      setCurrentConnectionAttempt(0);
    } else {
      // For 'loading', 'connecting', 'not-synced', 'synced-local'
      // If we were in a permanently failed state, but the status changes to something else
      // (e.g. user clicked "Try Again" which reset state, and now it's 'loading'),
      // ensure connectionFailedPermanently is false.
      if (connectionFailedPermanently) {
        setConnectionFailedPermanently(false);
      }
      // console.log(`[SyncedTldrawCanvas] Store in transient state for ${syncUri}: ${currentStatus}`);
    }
  }, [store.status, syncUri, currentConnectionAttempt, maxRetries, connectionFailedPermanently]);


  if (connectionFailedPermanently) {
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
                  setConnectionFailedPermanently(false);
                  setCurrentConnectionAttempt(0); 
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