import React from "react";
import { ChatShape } from "../ChatShapeTypes";
import { usePromptResize } from "../hooks/usePromptResize";
import { ChatShapeView } from "./ChatShapeView";
import { TLShapeId } from "@tldraw/tlschema"; // Keep TLShapeId if needed by other hooks indirectly

// Import the new hooks
import { useManageChatShapeInternal } from "../hooks/useManageChatShapeInternal";
import { useManageChatSuggestions } from "../hooks/useManageChatSuggestions";
import { useManageAiApi } from "../hooks/useManageAiApi";
import { useHandleUserInteractions } from "../hooks/useHandleUserInteractions";

// Removed unused imports: useState, useEffect, useChatAPI, makeShapeID, connectShapes, TLShape, ChatShapeUtil, CHATSHAPE_DIMENSIONS, findBestPosition, reorganizeBranch, arrangeSuggestionFan, rebuildPartialLayout, buildConversationContext

// Suggestion registry might need to be managed within useManageChatSuggestions or passed around if needed globally
// const suggestionRegistry = new Map<string, string[]>();

export function ChatShapeContainer({ shape, editor }: { shape: ChatShape; editor: any }) {

  // --- Hook Calls ---

  // 1. Manage Internal State
  const {
    localPrompt,
    setLocalPrompt,
    localResponse,
    setLocalResponse,
    isLoading,
    setIsLoading,
    localIsEditing,
    setLocalIsEditing,
    isInConversation,
  } = useManageChatShapeInternal({ shape, editor });

  // 2. Manage Suggestions
  const suggestionManager = useManageChatSuggestions({ editor });

  // 3. Manage AI API Interactions (pass suggestion manager functions)
  const {
    sendPrompt: sendPromptAction, // Rename to avoid conflict if needed
    handleContextSend,
    handleSendFromSuggestion,
  } = useManageAiApi({
    editor,
    shape,
    localPrompt,
    localResponse,
    setIsLoading,
    ...suggestionManager, // Spread suggestion management functions
  });

  // 4. Handle User Interactions
  const {
    handleEditMouseDown,
    handleResponseBlur,
    handlePromptChange,
    handleResponseUpdate,
  } = useHandleUserInteractions({
    editor,
    shape,
    setLocalIsEditing,
    setLocalPrompt,
    setLocalResponse,
    localResponse, // Pass localResponse for blur handler
  });

  // 5. Prompt Resizing (Existing Hook)
  const HEADER_HEIGHT = 32; // Keep constants if needed by hooks or view
  const totalHeight = shape.props.h - HEADER_HEIGHT;

  const { promptHeight, handleDividerMouseDown } = usePromptResize({
    initialHeight: shape.props.promptHeight || 40,
    totalHeight,
    minHeight: 40,
    onHeightChange: (newHeight) => {
      editor.updateShape({
        id: shape.id,
        type: "chat",
        props: { ...shape.props, promptHeight: newHeight },
      });
    }
  });

  // --- All helper functions, API call logic, and interaction handlers are moved to hooks ---
  // --- The container now primarily calls hooks and passes props to the view ---

  return (
    <ChatShapeView
      shape={shape}
      isLoading={isLoading}
      isEditingResponse={localIsEditing}
      localPrompt={localPrompt}
      localResponse={localResponse}
      promptHeight={shape.props.promptHeight || promptHeight} // Keep promptHeight from usePromptResize
      hideResponse={shape.props.hideResponse} // Pass hideResponse prop directly
      onDividerMouseDown={handleDividerMouseDown} // From usePromptResize
      onEdit={handleEditMouseDown} // From useHandleUserInteractions
      isInConversation={isInConversation} // From useManageChatShapeInternal
      onResponseBlur={handleResponseBlur} // From useHandleUserInteractions
      onPromptChange={handlePromptChange} // From useHandleUserInteractions
      onResponseUpdate={handleResponseUpdate} // From useHandleUserInteractions
      // Determine which send action to use based on whether it's a suggestion
      onSendPrompt={shape.props.isSuggestion ? handleSendFromSuggestion : sendPromptAction} // From useManageAiApi
      onContextSend={handleContextSend} // From useManageAiApi
    />
  );
}

// Static property - consider if this is still needed or should be managed elsewhere
// ChatShapeContainer.layoutTree = new Map();
