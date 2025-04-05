import { useState, useEffect, Dispatch, SetStateAction } from 'react';
import { ChatShape } from '../ChatShapeTypes';
import { TLShape } from '@tldraw/tlschema';

interface UseManageChatShapeInternalProps {
  shape: ChatShape;
  editor: any; // Consider defining a more specific type for editor if possible
}

interface UseManageChatShapeInternalReturn {
  localPrompt: string;
  setLocalPrompt: Dispatch<SetStateAction<string>>;
  localResponse: string;
  setLocalResponse: Dispatch<SetStateAction<string>>;
  isLoading: boolean;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
  localIsEditing: boolean;
  setLocalIsEditing: Dispatch<SetStateAction<boolean>>;
  isInConversation: boolean;
}

export function useManageChatShapeInternal({ shape, editor }: UseManageChatShapeInternalProps): UseManageChatShapeInternalReturn {
  const [localPrompt, setLocalPrompt] = useState(shape.props.prompt);
  const [localResponse, setLocalResponse] = useState(shape.props.response);
  const [isLoading, setIsLoading] = useState(false);
  const [localIsEditing, setLocalIsEditing] = useState(shape.props.isEditing);
  const [isInConversation, setIsInConversation] = useState(false);

  // Sync local state with shape props
  useEffect(() => {
    setLocalPrompt(shape.props.prompt);
  }, [shape.props.prompt]);

  useEffect(() => {
    // Only update localResponse from props if not currently editing
    if (!localIsEditing) {
      setLocalResponse(shape.props.response);
    }
  }, [shape.props.response, localIsEditing]);

  useEffect(() => {
    setLocalIsEditing(shape.props.isEditing);
  }, [shape.props.isEditing]);

  // Determine if the shape is part of a conversation thread
  useEffect(() => {
    const hasParent = shape.props.parentId && shape.props.parentId !== "";
    // Check if any shape on the current page has this shape's ID as its parentId
    const hasChildren = editor.getCurrentPageShapes().some((s: TLShape) =>
      s.type === "chat" && (s as ChatShape).props.parentId === shape.id
    );
    setIsInConversation(hasParent || hasChildren);
  }, [shape.id, shape.props.parentId, editor]); // Re-run if shape ID, parentId, or editor instance changes

  return {
    localPrompt,
    setLocalPrompt,
    localResponse,
    setLocalResponse,
    isLoading,
    setIsLoading,
    localIsEditing,
    setLocalIsEditing,
    isInConversation,
  };
}
