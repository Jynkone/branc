// components/chatshape/containers/ChatShapeContainer.tsx
import React, { useState, useEffect } from "react";
import { ChatShape } from "../ChatShapeTypes";
import { useChatAPI } from "../hooks/useChatAPI";
import { usePromptResize } from "../hooks/usePromptResize";
import { getBranchOffset } from "../utils/mathHelpers";
import { makeShapeID } from "@/lib/makeShapeID";
import { connectShapes } from "@/lib/connectShapes";
import { ChatShapeView } from "./ChatShapeView";
import { useQuota } from "@/components/hooks/useQuota";
import { TLShapeId } from "@tldraw/tlschema";

// Map to track suggestion boxes by parent ID (if needed for other logic)
const suggestionRegistry = new Map<string, string[]>();

export function ChatShapeContainer({ shape, editor }: { shape: ChatShape; editor: any }) {
  const { getChatResponse } = useChatAPI();
  const { refetch: refetchQuota } = useQuota();

  // Local state for prompt, response and loading flag
  const [localPrompt, setLocalPrompt] = useState(shape.props.prompt);
  const [localResponse, setLocalResponse] = useState(shape.props.response);
  const [isLoading, setIsLoading] = useState(false);
  const [localIsEditing, setLocalIsEditing] = useState(shape.props.isEditing);

  useEffect(() => {
    setLocalPrompt(shape.props.prompt);
  }, [shape.props.prompt]);

  useEffect(() => {
    if (!localIsEditing) {
      setLocalResponse(shape.props.response);
    }
  }, [shape.props.response, localIsEditing]);

  useEffect(() => {
    setLocalIsEditing(shape.props.isEditing);
  }, [shape.props.isEditing]);

  const HEADER_HEIGHT = 32;
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

  // --- New Helper: Update generations and clean up old suggestions ---
  function updateAndCleanupSuggestionBoxes(parentId: string) {
    const allShapes = editor.getCurrentPageShapes();
    // Shift generations for suggestions belonging to this parent:
    allShapes.forEach((s: any) => {
      if (s.props.isSuggestion && s.props.parentId === parentId) {
        if (s.props.suggestionGeneration === 2) {
          // Active suggestions become "last"
          editor.updateShape({
            id: s.id,
            type: "chat",
            props: { ...s.props, suggestionGeneration: 1 }
          });
        } else if (s.props.suggestionGeneration === 1) {
          // Last suggestions become "old" (0)
          editor.updateShape({
            id: s.id,
            type: "chat",
            props: { ...s.props, suggestionGeneration: 0 }
          });
        }
      }
    });

    // Delete all suggestion boxes now marked as generation 0
    const shapesToDelete = editor.getCurrentPageShapes().filter((s: any) =>
      s.props.isSuggestion &&
      s.props.parentId === parentId &&
      s.props.suggestionGeneration === 0
    );

    if (shapesToDelete.length > 0) {
      editor.deleteShapes(shapesToDelete.map((s: any) => s.id));
    }
  }
  // --- End of helper ---

  // --- Chat logic below ---

  async function sendPrompt() {
    setIsLoading(true);
    let newShapeId: TLShapeId;
    try {
      const childCount = ChatShapeContainer.layoutTree.get(shape.id) || 0;
      ChatShapeContainer.layoutTree.set(shape.id, childCount + 1);

      const { x: offsetX, y: offsetY } = getBranchOffset(childCount, 120, 30);
      const newX = shape.x + shape.props.w + offsetX;
      const newY = shape.y + offsetY;
      const userEditedAIResponse = localResponse !== shape.props.response;
      const context = userEditedAIResponse ? localResponse : undefined;

      // Update generations and clean up old suggestions for this parent
      updateAndCleanupSuggestionBoxes(shape.id);

      const { response, followUpQuestions } = await getChatResponse(localPrompt, context);
      newShapeId = makeShapeID();

      editor.createShape({
        id: newShapeId,
        type: "chat",
        x: newX,
        y: newY,
        props: {
          prompt: "",
          response: response,
          branchType: "normal",
          w: shape.props.w,
          h: shape.props.h,
          dateCreated: Date.now(),
          color: shape.props.color,
          dash: shape.props.dash,
          promptHeight: shape.props.promptHeight,
          isEditing: false,
          parentId: "", // default for non-suggestions
        },
      });
      connectShapes(editor, shape.id as TLShapeId, newShapeId as TLShapeId);

      // Create new suggestion boxes as generation 2 (active)
      if (followUpQuestions && followUpQuestions.length > 0) {
        setTimeout(() => createSuggestionBoxes(newShapeId, followUpQuestions, 2), 1000);
      }

      refetchQuota();
    } catch (err) {
      console.error("Error generating chat response:", err);
    } finally {
      setIsLoading(false);
    }
  }

  function createSuggestionBoxes(parentId: TLShapeId, questions: string[], generation: number) {
    const parentShape = editor.getShape(parentId);
    if (!parentShape) return;

    const suggestionIds: TLShapeId[] = [];

    questions.forEach((question, index) => {
      const radius = 300;
      const angle = -Math.PI / 2 + (Math.PI * index) / (questions.length - 1);
      const offsetX = radius * Math.cos(angle);
      const offsetY = radius * Math.sin(angle);

      const newX = parentShape.x + offsetX;
      const newY = parentShape.y + offsetY;

      const suggestionId = makeShapeID();
      suggestionIds.push(suggestionId);

      editor.createShape({
        id: suggestionId,
        type: "chat",
        x: newX,
        y: newY,
        props: {
          prompt: question,
          response: "",
          branchType: "suggestion",
          w: parentShape.props.w,
          h: parentShape.props.h,
          dateCreated: Date.now(),
          color: parentShape.props.color,
          dash: parentShape.props.dash,
          promptHeight: parentShape.props.promptHeight,
          isEditing: false,
          parentId: parentId, // parent's ID for suggestions
          isSuggestion: true,
          suggestionGeneration: generation,
          hideResponse: true,
        },
      });

      connectShapes(editor, parentId, suggestionId);
    });

    suggestionRegistry.set(parentId, suggestionIds.map(id => id as string));
  }

  async function handleContextSend(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsLoading(true);
    let newShapeId: TLShapeId;
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
      const { response, followUpQuestions } = await getChatResponse(localPrompt, context);
      newShapeId = makeShapeID();
      editor.createShape({
        id: newShapeId,
        type: "chat",
        x: newX,
        y: newY,
        props: {
          prompt: "",
          response: response,
          branchType: "context",
          w: shape.props.w,
          h: shape.props.h,
          dateCreated: Date.now(),
          color: shape.props.color,
          dash: shape.props.dash,
          promptHeight: shape.props.promptHeight,
          isEditing: false,
          parentId: "",
        },
      });
      connectShapes(editor, shape.id as TLShapeId, newShapeId as TLShapeId);

      if (followUpQuestions && followUpQuestions.length > 0) {
        setTimeout(() => createSuggestionBoxes(newShapeId, followUpQuestions, 2), 1000);
      }

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

    editor.updateShape({
      id: shape.id,
      type: "chat",
      props: { ...shape.props, isEditing: true },
    });
  }

  function handleResponseBlur() {
    setLocalIsEditing(false);
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

  function handlePromptChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const newPrompt = e.target.value;
    setLocalPrompt(newPrompt);
    editor.batch(() => {
      editor.updateShape({
        id: shape.id,
        type: "chat",
        props: { ...shape.props, prompt: newPrompt },
      });
    });
  }

  function handleResponseUpdate(newText: string) {
    setLocalResponse(newText);
    editor.batch(() => {
      editor.updateShape({
        id: shape.id,
        type: "chat",
        props: { ...shape.props, response: newText },
      });
    });
  }

  async function handleSendFromSuggestion() {
    if (!shape.props.isSuggestion) {
      return sendPrompt();
    }

    setIsLoading(true);

    try {
      // Unhide the AI response area for this suggestion box
      editor.updateShape({
        id: shape.id,
        type: "chat",
        props: {
          ...shape.props,
          hideResponse: false,
          isSuggestion: false
        },
      });

      if (shape.props.parentId) {
        updateAndCleanupSuggestionBoxes(shape.props.parentId);
      }

      const { response, followUpQuestions } = await getChatResponse(localPrompt);

      editor.updateShape({
        id: shape.id,
        type: "chat",
        props: {
          ...shape.props,
          response: response,
          hideResponse: false,
          isSuggestion: false
        },
      });

      if (followUpQuestions && followUpQuestions.length > 0) {
        setTimeout(() => createSuggestionBoxes(shape.id as TLShapeId, followUpQuestions, 2), 1000);
      }

      refetchQuota();
    } catch (err) {
      console.error("Error generating response from suggestion:", err);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <ChatShapeView
      shape={shape}
      isLoading={isLoading}
      isEditingResponse={localIsEditing}
      localPrompt={localPrompt}
      localResponse={localResponse}
      promptHeight={shape.props.promptHeight || promptHeight}
      hideResponse={shape.props.hideResponse}
      onDividerMouseDown={handleDividerMouseDown}
      onEdit={handleEditMouseDown}
      onResponseBlur={handleResponseBlur}
      onPromptChange={handlePromptChange}
      onResponseUpdate={handleResponseUpdate}
      onSendPrompt={shape.props.isSuggestion ? handleSendFromSuggestion : sendPrompt}
      onContextSend={handleContextSend}
    />
  );
}

// Static property for layout tree management
ChatShapeContainer.layoutTree = new Map();
