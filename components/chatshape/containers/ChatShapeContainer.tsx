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

  useEffect(() => { 
    setLocalPrompt(shape.props.prompt); 
  }, [shape.props.prompt]);
  useEffect(() => { 
    if (!localIsEditing) setLocalResponse(shape.props.response); 
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

  // --- Helper: Update arrows for an accepted suggestion ---
  function updateArrowsForAcceptedSuggestion(acceptedId: TLShapeId) {
    const allShapes = editor.getCurrentPageShapes();
    allShapes.forEach((s: any) => {
      if (s.type === "arrow" && (s.meta as any)?.isSuggestion) {
        const meta = s.meta as any;
        if (meta.connectedFrom === acceptedId || meta.connectedTo === acceptedId) {
          // Mark arrow as accepted by setting its branchType.
          editor.updateShape({
            id: s.id,
            type: s.type,
            meta: { connectedFrom: meta.connectedFrom, connectedTo: meta.connectedTo, branchType: "accepted" },
            opacity: 1,
          });
        }
      }
    });
  }
  // --- End Helper ---

  // --- Cleanup Cycle: Downgrade and Delete Old Suggestions ---
  function cycleSuggestionCleanup() {
    const allShapes = editor.getCurrentPageShapes();
    // Determine if any accepted suggestion is protected (i.e. accepted from generation 1).
    const protectedExists = allShapes.some((s: any) => s.props?.branchType === "accepted" && s.props?.protectedSuggestion);

    // First pass: Downgrade suggestion boxes and arrows (skip accepted/protected ones)
    allShapes.forEach((s: any) => {
      // Skip accepted shapes and arrows (branchType === "accepted").
      if ((s.props?.branchType && s.props.branchType === "accepted") || (s.meta && s.meta.branchType === "accepted")) {
        return;
      }
      
      // For suggestion chatboxes:
      if (s.props?.isSuggestion) {
        if (s.props.suggestionGeneration === 2) {
          // Downgrade from generation 2 to generation 1.
          editor.updateShape({
            id: s.id,
            type: s.type,
            props: { ...s.props, suggestionGeneration: 1 },
            opacity: 0.25,
          });
        } else if (s.props.suggestionGeneration === 1 && !protectedExists) {
          // Only downgrade from generation 1 to 0 if no protected accepted suggestion exists.
          editor.updateShape({
            id: s.id,
            type: s.type,
            props: { ...s.props, suggestionGeneration: 0 },
            opacity: 0.1,
          });
        }
      }
      // For suggestion arrows:
      else if (s.type === "arrow" && (s.meta as any)?.isSuggestion) {
        if ((s.meta as any).suggestionGeneration === 2) {
          editor.updateShape({
            id: s.id,
            type: s.type,
            meta: { ...(s.meta as any), suggestionGeneration: 1 },
            opacity: 0.25,
          });
        } else if ((s.meta as any).suggestionGeneration === 1 && !protectedExists) {
          editor.updateShape({
            id: s.id,
            type: s.type,
            meta: { ...(s.meta as any), suggestionGeneration: 0 },
            opacity: 0.1,
          });
        }
      }
    });

    // Second pass: Delete suggestion boxes or arrows at generation 0 (skip accepted)
    const shapesToDelete = editor.getCurrentPageShapes().filter((s: any) => {
      if ((s.props?.branchType && s.props.branchType === "accepted") || (s.meta?.branchType && s.meta.branchType === "accepted")) return false;
      if (s.props?.isSuggestion && s.props.suggestionGeneration === 0) return true;
      if (s.type === "arrow" && (s.meta as any)?.isSuggestion && (s.meta as any).suggestionGeneration === 0) return true;
      return false;
    });
    if (shapesToDelete.length > 0) {
      editor.deleteShapes(shapesToDelete.map((s: any) => s.id));
    }
  }
  // --- End Cleanup Cycle ---

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

      // Send the prompt as normal without interference.
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

      // If follow-up questions exist, create new suggestions (generation 2).
      if (followUpQuestions && followUpQuestions.length > 0) {
        setTimeout(() => createSuggestionBoxes(newShapeId, followUpQuestions, 2), 1000);
      }
      // Then run the cleanup cycle to downgrade and delete older suggestions.
      cycleSuggestionCleanup();

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
          parentId: parentId,
          isSuggestion: true,
          suggestionGeneration: generation,
          hideResponse: true,
        },
        opacity: generation === 2 ? 0.55 : generation === 1 ? 0.25 : 0.1,
      });
      // Create a connecting arrow.
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
      cycleSuggestionCleanup();

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
      // Determine the current generation of the suggestion.
      const currentGeneration = shape.props.suggestionGeneration;
      // If the accepted suggestion came from generation 1, mark it as protected.
      const protectedFlag = currentGeneration === 1;

      // Mark the suggestion as accepted and protect it if needed.
      editor.updateShape({
        id: shape.id,
        type: "chat",
        props: {
          ...shape.props,
          hideResponse: false,
          isSuggestion: false,
          branchType: "accepted",
          // Instead of adding an unexpected property, use branchType "accepted"
          // and, if protected, keep suggestionGeneration as 1.
          suggestionGeneration: protectedFlag ? 1 : shape.props.suggestionGeneration,
        },
        opacity: 1,
      });
      
      updateArrowsForAcceptedSuggestion(shape.id);
      
      // Send the prompt as-is.
      let result = await getChatResponse(localPrompt);
      let parsedResponse: { response: string; followUpQuestions: string[] };
      if (typeof result === "string") {
        try {
          const temp = JSON.parse(result);
          parsedResponse = {
            response: temp.response,
            followUpQuestions: temp.followUpQuestions || [],
          };
        } catch (e) {
          console.error("Error parsing JSON response:", e);
          parsedResponse = { response: result, followUpQuestions: [] };
        }
      } else {
        parsedResponse = {
          response: result.response,
          followUpQuestions: result.followUpQuestions || [],
        };
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
          suggestionGeneration: protectedFlag ? 1 : shape.props.suggestionGeneration,
        },
      });
      
      if (parsedResponse.followUpQuestions && parsedResponse.followUpQuestions.length > 0) {
        setTimeout(() => createSuggestionBoxes(shape.id, parsedResponse.followUpQuestions, 2), 1000);
      }
      
      // Only run the cleanup cycle if the accepted suggestion was not protected.
      if (!protectedFlag) {
        cycleSuggestionCleanup();
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
