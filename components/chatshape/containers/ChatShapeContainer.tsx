// lib/ChatShapeContainer.tsx
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

// Optional registry for suggestions.
const suggestionRegistry = new Map<string, string[]>();
// Track accepted suggestions so we never delete them.
const acceptedSuggestions = new Set<string>();

export function ChatShapeContainer({ shape, editor }: { shape: ChatShape; editor: any }) {
  const { getChatResponse } = useChatAPI();
  const { refetch: refetchQuota } = useQuota();

  const [localPrompt, setLocalPrompt] = useState(shape.props.prompt);
  const [localResponse, setLocalResponse] = useState(shape.props.response);
  const [isLoading, setIsLoading] = useState(false);
  const [localIsEditing, setLocalIsEditing] = useState(shape.props.isEditing);

  useEffect(() => { setLocalPrompt(shape.props.prompt); }, [shape.props.prompt]);
  useEffect(() => { if (!localIsEditing) setLocalResponse(shape.props.response); }, [shape.props.response, localIsEditing]);
  useEffect(() => { setLocalIsEditing(shape.props.isEditing); }, [shape.props.isEditing]);

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

  // --- Helper: Update arrows for an accepted suggestion ---
  function updateArrowsForAcceptedSuggestion(acceptedId: TLShapeId) {
    const allShapes = editor.getCurrentPageShapes();
    allShapes.forEach((s: any) => {
      if (s.type === "arrow" && (s.meta as any)?.isSuggestion) {
        const meta = s.meta as any;
        if (meta.connectedFrom === acceptedId || meta.connectedTo === acceptedId) {
          // Clear suggestion metadata so this arrow is no longer processed by cleanup.
          editor.updateShape({
            id: s.id,
            type: s.type,
            meta: {} as any,
            opacity: 1,
          });
          acceptedSuggestions.add(s.id);
        }
      }
    });
  }
  // --- End Helper ---

  // --- Helper: Update transparency of existing suggestions ---
  function updateSuggestionTransparency() {
    const allShapes = editor.getCurrentPageShapes();
    allShapes.forEach((s: any) => {
      // Skip accepted suggestions
      if (s.id && acceptedSuggestions.has(s.id)) return;

      // For chatboxes.
      if (s.props?.isSuggestion) {
        if (s.props.suggestionGeneration === 2) {
          editor.updateShape({
            id: s.id,
            type: s.type,
            props: { ...s.props, suggestionGeneration: 1 },
            opacity: 0.25, // Generation 1: 25% opacity
          });
        } else if (s.props.suggestionGeneration === 1) {
          editor.updateShape({
            id: s.id,
            type: s.type,
            props: { ...s.props, suggestionGeneration: 0 },
            opacity: 0.1, // Generation 0: 10% opacity
          });
        }
      }
      // For arrows.
      else if (s.type === "arrow" && (s.meta as any)?.isSuggestion) {
        if ((s.meta as any).suggestionGeneration === 2) {
          editor.updateShape({
            id: s.id,
            type: s.type,
            meta: { ...(s.meta as any), suggestionGeneration: 1 } as any,
            opacity: 0.25,
          });
        } else if ((s.meta as any).suggestionGeneration === 1) {
          editor.updateShape({
            id: s.id,
            type: s.type,
            meta: { ...(s.meta as any), suggestionGeneration: 0 } as any,
            opacity: 0.1,
          });
        }
      }
    });
  }
  // --- End Helper ---

  // --- Helper: Delete oldest generation of suggestions ---
  function deleteOldestSuggestions() {
    const allShapes = editor.getCurrentPageShapes();
    const shapesToDelete = allShapes.filter((s: any) => {
      if (s.id && acceptedSuggestions.has(s.id)) return false;
      if (s.props?.isSuggestion && s.props.suggestionGeneration === 0) return true;
      if (s.type === "arrow" && (s.meta as any)?.isSuggestion && (s.meta as any).suggestionGeneration === 0) return true;
      return false;
    });
    if (shapesToDelete.length > 0) {
      editor.deleteShapes(shapesToDelete.map((s: any) => s.id));
    }
  }
  // --- End Helper ---

  // --- Chat Logic ---
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

      // For non-accepted flows, update transparency and delete oldest suggestions.
      updateSuggestionTransparency();
      deleteOldestSuggestions();

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
          parentId: "",
        },
      });
      connectShapes(editor, shape.id as TLShapeId, newShapeId as TLShapeId);

      // Run cleanup again after creating new content.
      updateSuggestionTransparency();
      deleteOldestSuggestions();

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
    updateSuggestionTransparency();
    deleteOldestSuggestions();
    
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
          parentId: parentId,
          isSuggestion: true,
          suggestionGeneration: generation,
          hideResponse: true,
        },
        opacity: 0.55, // New suggestions start at 55% opacity.
      });

      // Also create a connecting arrow.
      const arrowId = connectShapes(editor, parentId, suggestionId);
      // Set arrow's initial opacity.
      editor.updateShape({
        id: arrowId,
        opacity: 0.55,
      });
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
      updateSuggestionTransparency();
      deleteOldestSuggestions();

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

      updateSuggestionTransparency();
      deleteOldestSuggestions();

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

  async function handleSendFromSuggestion() {
    if (!shape.props.isSuggestion) {
      return sendPrompt();
    }
    setIsLoading(true);
    try {
      // Mark suggestion as accepted.
      acceptedSuggestions.add(shape.id);
      
      // Update the suggestion box to be a normal chat box.
      editor.updateShape({
        id: shape.id,
        type: "chat",
        props: {
          ...shape.props,
          hideResponse: false,
          isSuggestion: false,
          branchType: "accepted",
        },
        opacity: 1,
      });
      
      // Clear suggestion metadata on connected arrows.
      updateArrowsForAcceptedSuggestion(shape.id);
      
      // Delay cleanup until after the API call completes.
      let result = await getChatResponse(localPrompt);
      let parsedResponse;
      if (typeof result === "string") {
        try {
          parsedResponse = JSON.parse(result);
        } catch (e) {
          console.error("Error parsing JSON response:", e);
          parsedResponse = { response: result, followUpQuestions: [] };
        }
      } else {
        parsedResponse = result;
      }
      
      editor.updateShape({
        id: shape.id,
        type: "chat",
        props: {
          ...shape.props,
          response: parsedResponse.response,
          hideResponse: false,
          isSuggestion: false,
          branchType: "accepted",
        },
      });
      
      // Delay cleanup and new suggestion creation slightly to allow state to settle.
      setTimeout(() => {
        updateSuggestionTransparency();
        deleteOldestSuggestions();
      }, 200);
      
      if (parsedResponse.followUpQuestions && parsedResponse.followUpQuestions.length > 0) {
        setTimeout(() => createSuggestionBoxes(shape.id, parsedResponse.followUpQuestions, 2), 1000);
      }
      refetchQuota();
    } catch (err) {
      console.error("Error generating response from suggestion:", err);
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
        isEditing: false,
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

// Static property for layout tree management.
ChatShapeContainer.layoutTree = new Map();
