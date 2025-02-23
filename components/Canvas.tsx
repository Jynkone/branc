"use client";

import {
  Tldraw,
  DefaultKeyboardShortcutsDialog,
  DefaultKeyboardShortcutsDialogContent,
  DefaultToolbar,
  DefaultToolbarContent,
  TLComponents,
  TLUiOverrides,
  TLUiAssetUrlOverrides,
  TldrawUiMenuItem,
  useIsToolSelected,
  useTools,
  useEditor,
  loadSnapshot,
} from "tldraw";
import "tldraw/tldraw.css";
import { chatTool } from "@/tools/ChatTool";
import { ChatShapeUtil } from "@/components/chatshape/ChatShapeUtil";
import { useEffect } from "react";
import { snapshot } from "@/lib/snapshot";
import { ChatShape } from "@/components/chatshape/ChatShapeTypes";
import { SignOutButton } from "@clerk/nextjs";
import { Button } from "./ui/button";

// [1] UI overrides: add the custom chat tool using a string key for the icon.
const uiOverrides: TLUiOverrides = {
  tools(editor, tools) {
    tools.chat = {
      id: "chat",
      icon: "chat-icon", // Use a string key for your asset
      label: "Chat",
      kbd: "c",
      onSelect: () => editor.setCurrentTool("chat"),
    };
    return tools;
  },
};

// [2] Components overrides: insert your chat tool’s menu item into the default Toolbar and KeyboardShortcutsDialog.
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
        <TldrawUiMenuItem {...tools["chat"]} />
      </DefaultKeyboardShortcutsDialog>
    );
  },
  // Let Tldraw render its default StylePanel
  PageMenu: null,
  MainMenu: null,
  DebugPanel: null,
};

// [3] Custom asset URLs: point the chat-icon key to /BranchBox.svg
const customAssetUrls: TLUiAssetUrlOverrides = {
  icons: {
    "chat-icon": "/BranchBox.svg",
  },
};

// [4] Register your custom tool.
const customTools = [chatTool];

export function Canvas() {
  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <Tldraw
        persistenceKey="tlweb"
        shapeUtils={[ChatShapeUtil]}
        hideUi={false}
        tools={customTools}
        initialState="select"
        overrides={uiOverrides}
        components={components}
        assetUrls={customAssetUrls}
        onMount={(editor) => {
          editor.sideEffects.registerBeforeChangeHandler("shape", (prev, next) => {
            if (prev.type === "chat" && next.type === "chat") {
              const chatNext = next as ChatShape;
              const { w, h } = chatNext.props as { w: number; h: number };
              const MIN_WIDTH = 190;
              const MIN_HEIGHT = 150;
              if (w < MIN_WIDTH || h < MIN_HEIGHT) {
                return prev;
              }
            }
            return next;
          });
        }}
      >
        {/* SnapshotLoader uses useEditor inside the Tldraw context */}
        <SnapshotLoader />
      </Tldraw>
      {/* Sign-out button overlay */}
      <div
        className="absolute top-1 right-1 flex gap-1"
        style={{ zIndex: 2000 }}
      >
        <SignOutButton>
          <Button size="sm" variant="default">
            Sign Out
          </Button>
        </SignOutButton>
      </div>
      {/* Global style override to move the style panel down */}
      <style jsx global>{`
        .tldraw-style-panel,
        .tlui-style-panel {
          top: 35px !important;
        }
      `}</style>
    </div>
  );
}

// SnapshotLoader is rendered inside Tldraw so useEditor() works here.
function SnapshotLoader() {
  const editor = useEditor();

  useEffect(() => {
    if (editor && editor.store && editor.getCurrentPageShapeIds().size === 0) {
      loadSnapshot(editor.store, snapshot);
    }
  }, [editor]);

  return null;
}
