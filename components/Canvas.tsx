"use client";

import dynamic from "next/dynamic";
import {
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
} from "tldraw";
import "tldraw/tldraw.css";
import { chatTool } from "@/tools/ChatTool";
import { ChatShapeUtil } from "@/components/chatshape/ChatShapeUtil";
import { useEffect } from "react";
import { snapshot } from "@/lib/snapshot";
import { loadSnapshot } from "tldraw";
import { ChatShape } from "@/components/chatshape/ChatShapeTypes";

// [1] UI overrides: add the custom chat tool using a string key for the icon.
const uiOverrides: TLUiOverrides = {
  tools(editor, tools) {
    tools.chat = {
      id: "chat",
      icon: "chat-icon", // Use a string key for your asset
      label: "Chat",
      kbd: "c",
      onSelect: () => {
        editor.setCurrentTool("chat");
      },
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
};

// [3] Custom asset URLs: point the chat-icon key to /BranchBox.svg
const customAssetUrls: TLUiAssetUrlOverrides = {
  icons: {
    "chat-icon": "/BranchBox.svg",
  },
};

// [4] Register your custom tool.
const customTools = [chatTool];

// Dynamically import Tldraw to disable SSR.
const TldrawDynamic = dynamic(async () => (await import("tldraw")).Tldraw, {
  ssr: false,
});

export function Canvas() {
  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <TldrawDynamic
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
              // Cast next to ChatShape, and then its props to an object with w and h.
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
        <SnapshotLoader />
      </TldrawDynamic>
    </div>
  );
}

// ✅ Ensure the snapshot loads
function SnapshotLoader() {
  const editor = useEditor();

  useEffect(() => {
    if (editor && editor.store && editor.getCurrentPageShapeIds().size === 0) {
      loadSnapshot(editor.store, snapshot);
    }
  }, [editor]);

  return null; // No UI elements needed
}
