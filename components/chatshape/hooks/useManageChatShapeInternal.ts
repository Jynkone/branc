import { useState, useEffect, Dispatch, SetStateAction } from 'react';
import { ChatShape } from '../ChatShapeTypes';
import { TLShape } from '@tldraw/tlschema';

interface UseManageChatShapeInternalProps {
  shape: ChatShape;
  editor: any; // You can tighten this up later with your exact editor type
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

export function useManageChatShapeInternal({
  shape,
  editor,
}: UseManageChatShapeInternalProps): UseManageChatShapeInternalReturn {
  const [localPrompt, setLocalPrompt] = useState(shape.props.prompt);
  const [localResponse, setLocalResponse] = useState(shape.props.response);
  const [isLoading, setIsLoading] = useState(false);
  // purely local edit-mode flag
  const [localIsEditing, setLocalIsEditing] = useState(false);
  const [isInConversation, setIsInConversation] = useState(false);

  // 1️⃣ Keep prompt in sync when updated remotely
  useEffect(() => {
    setLocalPrompt(shape.props.prompt);
  }, [shape.props.prompt]);

  // 2️⃣ Update response unless the user is currently editing locally
  useEffect(() => {
    if (!localIsEditing) {
      setLocalResponse(shape.props.response);
    }
  }, [shape.props.response, localIsEditing]);

  // 3️⃣ Figure out if this shape is in a conversation thread
  useEffect(() => {
    const hasParent = !!shape.props.parentId;
    const hasChildren = editor
      .getCurrentPageShapes()
      .some((s: TLShape) => s.type === 'chat' && (s as ChatShape).props.parentId === shape.id);
    setIsInConversation(hasParent || hasChildren);
  }, [shape.id, shape.props.parentId, editor]);

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
