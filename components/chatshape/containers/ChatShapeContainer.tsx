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
          // Preserve connection info but mark as no longer a suggestion
          const newMeta = {
            connectedFrom: meta.connectedFrom,
            connectedTo: meta.connectedTo,
            wasAcceptedSuggestion: true  // Add this flag to preserve this arrow
          };
          
          editor.updateShape({
            id: s.id,
            type: s.type,
            meta: newMeta as any,
            opacity: 1  // Full visibility
          });
        }
      }
    });
  }
  // --- End Helper ---

  // --- Global Cleanup Helper ---
  function updateAndCleanupSuggestionBoxes() {
    console.log("Starting suggestion cleanup");
    const allShapes = editor.getCurrentPageShapes();
    
    const suggestionBoxes = allShapes.filter((s: any) => s.props?.isSuggestion).length;
    const suggestionArrows = allShapes.filter((s: any) => s.type === 'arrow' && (s.meta as any)?.isSuggestion).length;
    console.log(`Found ${suggestionBoxes} suggestion boxes and ${suggestionArrows} suggestion arrows`);
  
    // FIRST PASS: Update generation counters for ALL suggestion objects
    allShapes.forEach((s: any) => {
      // Skip anything marked as an accepted suggestion
      if (s.props?.wasAcceptedSuggestion || (s.meta as any)?.wasAcceptedSuggestion) {
        return;
      }
      
      // Update suggestion boxes
      if (s.props?.isSuggestion) {
        if (s.props.suggestionGeneration === 2) {
          editor.updateShape({
            id: s.id,
            type: s.type,
            props: { ...s.props, suggestionGeneration: 1 },
          });
        } else if (s.props.suggestionGeneration === 1) {
          editor.updateShape({
            id: s.id,
            type: s.type,
            props: { ...s.props, suggestionGeneration: 0 },
          });
        }
      }
      // Update suggestion arrows
      else if (s.type === "arrow" && (s.meta as any)?.isSuggestion) {
        if ((s.meta as any).suggestionGeneration === 2) {
          editor.updateShape({
            id: s.id,
            type: s.type,
            meta: { ...(s.meta as any), suggestionGeneration: 1 },
            opacity: 0.25,
          });
        } else if ((s.meta as any).suggestionGeneration === 1) {
          editor.updateShape({
            id: s.id, 
            type: s.type,
            meta: { ...(s.meta as any), suggestionGeneration: 0 },
            opacity: 0.1,
          });
        }
      }
    });
  
    // SECOND PASS: Collect all objects at generation 0 for deletion
    const shapesToDelete = editor.getCurrentPageShapes().filter((s: any) => {
      // Never delete accepted suggestions or their arrows
      if (s.props?.wasAcceptedSuggestion || (s.meta as any)?.wasAcceptedSuggestion) {
        return false;
      }
      
      // Delete chat boxes at generation 0
      if (s.props?.isSuggestion && s.props.suggestionGeneration === 0) {
        return true;
      }
      
      // Delete arrows at generation 0, unless they connect to preserved shapes
      if (s.type === "arrow" && (s.meta as any)?.isSuggestion && (s.meta as any).suggestionGeneration === 0) {
        const fromId = (s.meta as any).connectedFrom;
        const toId = (s.meta as any).connectedTo;
        
        if (fromId || toId) {
          const fromShape = fromId ? editor.getShape(fromId) : null;
          const toShape = toId ? editor.getShape(toId) : null;
          
          // Don't delete if connected to a non-suggestion or an accepted suggestion
          if (fromShape && (!fromShape.props?.isSuggestion || fromShape.props?.wasAcceptedSuggestion)) {
            return false;
          }
          if (toShape && (!toShape.props?.isSuggestion || toShape.props?.wasAcceptedSuggestion)) {
            return false;
          }
        }
        return true;
      }
      
      return false;
    });
  
    // Log deletion info
    /*console.log("Shapes to delete:", shapesToDelete.map(s => ({
      id: s.id,
      type: s.type,
      generation: s.props?.suggestionGeneration || (s.meta as any)?.suggestionGeneration
    })));*/
  
    // Actually perform the deletion
    if (shapesToDelete.length > 0) {
      console.log(`Deleting ${shapesToDelete.length} obsolete suggestion objects`);
      editor.deleteShapes(shapesToDelete.map((s: any) => s.id));
    }
  }
  // --- End Global Cleanup Helper ---

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

      // Global cleanup for suggestions before creating new content
      updateAndCleanupSuggestionBoxes();

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

      // Run cleanup again after creating new content
      updateAndCleanupSuggestionBoxes();

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
    // Run cleanup before creating new suggestions
    updateAndCleanupSuggestionBoxes();
    
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
      });

      // Also create a connecting arrow.
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
      // Global cleanup before creating new content
      updateAndCleanupSuggestionBoxes();

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

      // Run cleanup again after creating
      updateAndCleanupSuggestionBoxes();

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
      // First, mark this suggestion as accepted with a special flag
      editor.updateShape({
        id: shape.id,
        type: "chat",
        props: {
          ...shape.props,
          hideResponse: false,
          isSuggestion: false,
          wasAcceptedSuggestion: true  // Add this flag to track accepted suggestions
        },
      });
      
      // Update arrows BEFORE running cleanup
      updateArrowsForAcceptedSuggestion(shape.id);
      
      // Run global cleanup which will now respect the accepted suggestion
      updateAndCleanupSuggestionBoxes();

      const { response, followUpQuestions } = await getChatResponse(localPrompt);
      editor.updateShape({
        id: shape.id,
        type: "chat",
        props: {
          ...shape.props,
          response: response,
          hideResponse: false,
          isSuggestion: false,
          wasAcceptedSuggestion: true
        },
      });
      
      if (followUpQuestions && followUpQuestions.length > 0) {
        setTimeout(() => createSuggestionBoxes(shape.id, followUpQuestions, 2), 1000);
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