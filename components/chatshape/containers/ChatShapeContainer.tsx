import React, { useState, useEffect } from "react";
import { ChatShape } from "../ChatShapeTypes";
import { useChatAPI } from "../hooks/useChatAPI";
import { usePromptResize } from "../hooks/usePromptResize";
import { getBranchOffset } from "../utils/mathHelpers";
import { makeShapeID } from "@/lib/makeShapeID";
import { connectShapes } from "@/lib/connectShapes";
import { ChatShapeView } from "./ChatShapeView";
import { useQuota } from "@/components/hooks/useQuota";

export function ChatShapeContainer({ shape, editor }: { shape: ChatShape; editor: any }) {
  const { getChatResponse } = useChatAPI();
  const { refetch: refetchQuota } = useQuota();

  // State for prompt, AI response, loading
  const [localPrompt, setLocalPrompt] = useState(shape.props.prompt);
  const [localResponse, setLocalResponse] = useState(shape.props.response);
  const [isLoading, setIsLoading] = useState(false);

  // Use the isEditing property from the shape instead of local state
  // We'll still keep a local state for faster UI updates, but sync to shape props
  const [localIsEditing, setLocalIsEditing] = useState(shape.props.isEditing);

  // CRITICAL: Update local state when shape props change from remote updates
  useEffect(() => {
    setLocalPrompt(shape.props.prompt);
  }, [shape.props.prompt]);

  useEffect(() => {
    if (!localIsEditing) {
      setLocalResponse(shape.props.response);
    }
  }, [shape.props.response, localIsEditing]);

  // Sync local editing state with shape props from other users
  useEffect(() => {
    setLocalIsEditing(shape.props.isEditing);
  }, [shape.props.isEditing]);

  const HEADER_HEIGHT = 32;
  const totalHeight = shape.props.h - HEADER_HEIGHT;

  // Use the modular hook to manage prompt area resizing.
  // Pass the promptHeight from shape props and a callback to update it
  const { promptHeight, handleDividerMouseDown } = usePromptResize({
    initialHeight: shape.props.promptHeight || 40, // Use the synced height from props
    totalHeight,
    minHeight: 40,
    onHeightChange: (newHeight) => {
      // Update the shape prop when height changes
      editor.updateShape({
        id: shape.id,
        type: "chat",
        props: { ...shape.props, promptHeight: newHeight },
      });
    }
  });

  // -- Chat logic below

  async function sendPrompt() {
    setIsLoading(true);
    try {
      const childCount = ChatShapeContainer.layoutTree.get(shape.id) || 0;
      ChatShapeContainer.layoutTree.set(shape.id, childCount + 1);

      const { x: offsetX, y: offsetY } = getBranchOffset(childCount, 120, 30);
      const newX = shape.x + shape.props.w + offsetX;
      const newY = shape.y + offsetY;
      const userEditedAIResponse = localResponse !== shape.props.response;
      const context = userEditedAIResponse ? localResponse : undefined;

      const aiResponse = await getChatResponse(localPrompt, context);
      const newShapeId = makeShapeID();
      editor.createShape({
        id: newShapeId,
        type: "chat",
        x: newX,
        y: newY,
        props: {
          prompt: "",
          response: aiResponse,
          branchType: "normal",
          w: shape.props.w,
          h: shape.props.h,
          dateCreated: Date.now(),
          color: shape.props.color,
          dash: shape.props.dash,
          promptHeight: shape.props.promptHeight,
          isEditing: false,
        },
      });
      connectShapes(editor, shape.id, newShapeId);
      refetchQuota();
    } catch (err) {
      console.error("Error generating chat response:", err);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleContextSend(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsLoading(true);
    
    const childCount = ChatShapeContainer.layoutTree.get(shape.id) || 0;
    ChatShapeContainer.layoutTree.set(shape.id, childCount + 1);

    const getFanOffset = (childIndex: number, spacing = 120) => {
      if (childIndex === 0) return 0;
      const n = Math.ceil(childIndex / 2);
      const sign = childIndex % 2 === 1 ? -1 : 1;
      return sign * n * spacing;
    };

    const newX = shape.x + shape.props.w + 200;
    const newY = shape.y + getFanOffset(childCount, 120);
    const context = localResponse;

    try {
      const aiResponse = await getChatResponse(localPrompt, context);
      const newShapeId = makeShapeID();
      editor.createShape({
        id: newShapeId,
        type: "chat",
        x: newX,
        y: newY,
        props: {
          prompt: "",
          response: aiResponse,
          branchType: "context",
          w: shape.props.w,
          h: shape.props.h,
          dateCreated: Date.now(),
          color: shape.props.color,
          dash: shape.props.dash,
          promptHeight: shape.props.promptHeight,
          isEditing: false,
        },
      });
      connectShapes(editor, shape.id, newShapeId);
      refetchQuota();
    } catch (err) {
      console.error("Error re-sending context:", err);
    } finally {
      setIsLoading(false);
    }
  }

  function handleEditMouseDown(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    setLocalIsEditing(true);
    
    // Update the shape prop to sync editing state to other users
    editor.updateShape({
      id: shape.id,
      type: "chat",
      props: { ...shape.props, isEditing: true },
    });
  }

  function handleResponseBlur() {
    setLocalIsEditing(false);
    
    // Update the shape prop to sync editing state and content to other users
    editor.updateShape({
      id: shape.id,
      type: "chat",
      props: { 
        ...shape.props, 
        response: localResponse,
        isEditing: false 
      },
    });
  }

  // Improved to sync immediately on every keystroke
  function handlePromptChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const newPrompt = e.target.value;
    setLocalPrompt(newPrompt);
    
    // Update the store immediately with each change
    editor.batch(() => {
      editor.updateShape({
        id: shape.id,
        type: "chat",
        props: { ...shape.props, prompt: newPrompt },
      });
    });
  }

  // Updated to sync changes in real-time
  function handleResponseUpdate(newText: string) {
    setLocalResponse(newText);
    
    // Update the store immediately with each change
    editor.batch(() => {
      editor.updateShape({
        id: shape.id,
        type: "chat",
        props: { ...shape.props, response: newText },
      });
    });
  }
  
  return (
    <ChatShapeView
      shape={shape}
      isLoading={isLoading}
      isEditingResponse={localIsEditing}
      localPrompt={localPrompt}
      localResponse={localResponse}
      promptHeight={shape.props.promptHeight || promptHeight}
      onDividerMouseDown={handleDividerMouseDown}
      onEdit={handleEditMouseDown}
      onResponseBlur={handleResponseBlur}
      onPromptChange={handlePromptChange}
      onResponseUpdate={handleResponseUpdate}
      onSendPrompt={sendPrompt}
      onContextSend={handleContextSend}
    />
  );
}

// Add static property to the exported function
ChatShapeContainer.layoutTree = new Map();