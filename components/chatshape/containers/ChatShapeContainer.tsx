import React, { useState, useEffect } from "react";
import { ChatShape } from "../ChatShapeTypes";
import { useChatAPI } from "../hooks/useChatAPI";
import { usePromptResize } from "../hooks/usePromptResize";
import { makeShapeID } from "@/lib/makeShapeID";
import { connectShapes } from "@/lib/connectShapes";
import { ChatShapeView } from "./ChatShapeView";
import { TLShapeId } from "@tldraw/tlschema";
import { ChatShapeUtil, CHATSHAPE_DIMENSIONS } from '../ChatShapeUtil';
import { findBestPosition } from "@/lib/findBestPosition";
import { reorganizeBranch, arrangeSuggestionFan } from "@/lib/findBestPosition";
import { rebuildPartialLayout } from "@/lib/dagreLayoutManager";

// Optional registry for suggestions.
const suggestionRegistry = new Map<string, string[]>();

export function ChatShapeContainer({ shape, editor }: { shape: ChatShape; editor: any }) {
  const { getChatResponse } = useChatAPI();

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
            opacity: 0.75,
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
            opacity: 0.75,
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
      console.log("Starting sendPrompt");
      const childCount = ChatShapeContainer.layoutTree.get(shape.id) || 0;
      ChatShapeContainer.layoutTree.set(shape.id, childCount + 1);
  
      console.log("Calculating position");
      // TEMPORARY FIX: Use simple positioning instead of Dagre
      // const position = findBestPosition(editor, shape.id, 'standard');
      const position = {
        x: shape.x + shape.props.w + 50,
        y: shape.y
      };
      console.log("Position calculated:", position);
  
      const userEditedAIResponse = localResponse !== shape.props.response;
      const context = userEditedAIResponse ? localResponse : undefined;
  
      console.log("Getting chat response");
      const { response, followUpQuestions } = await getChatResponse(localPrompt, context);
      newShapeId = makeShapeID();
      
      console.log("Creating new shape");
      editor.createShape({
        id: newShapeId,
        type: "chat",
        x: position.x,
        y: position.y,
        props: {
          prompt: "",
          response: response,
          branchType: "normal",
          w: CHATSHAPE_DIMENSIONS.STANDARD.width,
          h: CHATSHAPE_DIMENSIONS.STANDARD.height,
          dateCreated: Date.now(),
          color: shape.props.color,
          dash: shape.props.dash,
          promptHeight: shape.props.promptHeight,
          isEditing: false,
          parentId: "",
        },
      });
      
      connectShapes(editor, shape.id as TLShapeId, newShapeId as TLShapeId);
      
      console.log("Shape created successfully, ID:", newShapeId);
      // Comment out the follow-up suggestions temporarily
      // if (followUpQuestions && followUpQuestions.length > 0) {
      //   setTimeout(() => {
      //     const suggestionIds = createSuggestionBoxes(newShapeId, followUpQuestions, 2);
      //     
      //     setTimeout(() => {
      //       arrangeSuggestionFan(editor, newShapeId, suggestionIds);
      //     }, 100);
      //   }, 500);
      // } else {
      //   setTimeout(() => {
      //     reorganizeBranch(editor, shape.id, [newShapeId]);
      //   }, 200);
      // }
      
      // Temporarily disable cleanup
      // cycleSuggestionCleanup();
  
    } catch (err) {
      console.error("Error generating chat response:", err);
      alert("Error generating response. Check console for details.");
    } finally {
      setIsLoading(false);
    }
  }    
// Update the createSuggestionBoxes function to return the created IDs:
// Update the createSuggestionBoxes function to return the created IDs:
function createSuggestionBoxes(
  parentId: TLShapeId, 
  questions: string[], 
  generation: number
): TLShapeId[] {
  const parentShape = editor.getShape(parentId);
  if (!parentShape) return [];

  const samplePosition = findBestPosition(editor, parentId, 'standard');
  const bestDirection = determineDirection(parentShape, samplePosition);

  const suggestionIds: TLShapeId[] = [];
  questions.forEach((question, index) => {
    const angleSpread = (2 * Math.PI) / 3; // 120 degrees  
    const startAngle = -angleSpread / 2; 
    const angle = startAngle + (angleSpread * index) / Math.max(1, questions.length - 1);
    const radius = 350;
    
    // Adjust the angle based on the best direction
    const adjustedAngle = adjustAngleForDirection(angle, bestDirection);
    
    // Calculate offsets using the adjusted angle
    const offsetX = radius * Math.cos(adjustedAngle);
    const offsetY = radius * Math.sin(adjustedAngle);
    
    // Position relative to the appropriate edge of parent box
    let posX = parentShape.x;
    let posY = parentShape.y;
    
    // Adjust base position based on direction
    switch(bestDirection) {
      case 'right':
        posX += parentShape.props.w;
        break;
      case 'left':
        posX -= 0; // Base position at left edge
        break;
      case 'bottom':
        posY += parentShape.props.h;
        break;
      case 'top':
        posY -= 0; // Base position at top edge
        break;
    }
    
    // Add the calculated offsets
    posX += offsetX;
    posY += offsetY;
    
    const suggestionId = makeShapeID();
    suggestionIds.push(suggestionId);

    editor.createShape({
      id: suggestionId,
      type: "chat",
      x: posX,
      y: posY,
      props: {
        prompt: question,
        response: "",
        branchType: "suggestion",
        w: CHATSHAPE_DIMENSIONS.SUGGESTION.width,
        h: CHATSHAPE_DIMENSIONS.SUGGESTION.height,
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
      opacity: generation === 2 ? 0.75 : generation === 1 ? 0.75 : 0.1,
    });
    // Create a connecting arrow.
    connectShapes(editor, parentId, suggestionId);
  });
  
  // Store the suggestion IDs for later reference
  suggestionRegistry.set(parentId, suggestionIds.map(id => id as string));
  
  // Return the created suggestion IDs
  return suggestionIds;
}

  function determineDirection(
    parentShape: any, 
    position: {x: number, y: number}
  ): 'right' | 'left' | 'top' | 'bottom' {
    // Calculate the center of the parent
    const parentCenterX = parentShape.x + (parentShape.props.w / 2);
    const parentCenterY = parentShape.y + (parentShape.props.h / 2);
    
    // Calculate position relative to parent center
    const relX = position.x - parentCenterX;
    const relY = position.y - parentCenterY;
    
    // Determine the dominant direction
    if (Math.abs(relX) > Math.abs(relY)) {
      // Horizontal dominance
      return relX > 0 ? 'right' : 'left';
    } else {
      // Vertical dominance
      return relY > 0 ? 'bottom' : 'top';
    }
  }
  
  // Helper function to adjust the fan angle based on the direction
  function adjustAngleForDirection(angle: number, direction: 'right' | 'left' | 'top' | 'bottom'): number {
    switch(direction) {
      case 'right':
        return angle; // Default fan is to the right
      case 'left':
        return Math.PI + angle; // Rotate 180 degrees
      case 'bottom':
        return Math.PI/2 + angle; // Rotate 90 degrees
      case 'top':
        return -Math.PI/2 + angle; // Rotate -90 degrees
      default:
        return angle;
    }
  }
  

  async function handleContextSend(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsLoading(true);
    let newShapeId: TLShapeId;
    const childCount = ChatShapeContainer.layoutTree.get(shape.id) || 0;
    ChatShapeContainer.layoutTree.set(shape.id, childCount + 1);

    const position = findBestPosition(editor, shape.id, 'standard');
    const newX = position.x;
    const newY = position.y;

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
          w: CHATSHAPE_DIMENSIONS.STANDARD.width,
          h: CHATSHAPE_DIMENSIONS.STANDARD.height,
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

    } catch (err) {
      console.error("Error re-sending context:", err);
    } finally {
      setIsLoading(false);
    }
  }

// Update the handleSendFromSuggestion function to reorganize after accepting a suggestion:
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
        w: CHATSHAPE_DIMENSIONS.STANDARD.width,
        h: CHATSHAPE_DIMENSIONS.STANDARD.height,  
        // Instead of adding an unexpected property, use branchType "accepted"
        // and, if protected, keep suggestionGeneration as 1.
        suggestionGeneration: protectedFlag ? 1 : shape.props.suggestionGeneration,
      },
      opacity: 1,
    });
    
    updateArrowsForAcceptedSuggestion(shape.id);
    
    // Send the prompt as-is.
    let result = await getChatResponse(localPrompt);
    let responseData: { response: string; followUpQuestions: string[] };
    
    if (typeof result === "string") {
      try {
        const temp = JSON.parse(result);
        responseData = {
          response: temp.response,
          followUpQuestions: temp.followUpQuestions || [],
        };
      } catch (e) {
        console.error("Error parsing JSON response:", e);
        responseData = { response: result, followUpQuestions: [] };
      }
    } else {
      responseData = {
        response: result.response,
        followUpQuestions: result.followUpQuestions || [],
      };
    }
    
    editor.updateShape({
      id: shape.id,
      type: "chat",
      props: {
        ...shape.props,
        response: responseData.response,
        hideResponse: false,
        isSuggestion: false,
        branchType: "accepted",
        w: CHATSHAPE_DIMENSIONS.STANDARD.width,
        h: CHATSHAPE_DIMENSIONS.STANDARD.height,  
        suggestionGeneration: protectedFlag ? 1 : shape.props.suggestionGeneration,
      },
    });
    
    if (responseData.followUpQuestions && responseData.followUpQuestions.length > 0) {
      setTimeout(() => {
        const newSuggestionIds = createSuggestionBoxes(
          shape.id, 
          responseData.followUpQuestions, 
          2
        );
        
        // Reorganize with the new suggestions
        setTimeout(() => {
          arrangeSuggestionFan(editor, shape.id, newSuggestionIds);
        }, 100);
      }, 500);
    } else {
      // Even without new suggestions, reorganize to reflect the acceptance
      setTimeout(() => {
        reorganizeBranch(editor, shape.id);
      }, 200);
    }
    
    // Only run the cleanup cycle if the accepted suggestion was not protected.
    if (!protectedFlag) {
      cycleSuggestionCleanup();
    }
    
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
