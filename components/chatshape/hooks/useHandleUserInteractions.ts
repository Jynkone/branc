import React, { Dispatch, SetStateAction } from 'react';
import { ChatShape } from '../ChatShapeTypes';

interface UseHandleUserInteractionsProps {
  editor: any; // Define a more specific type if possible
  shape: ChatShape;
  setLocalIsEditing: Dispatch<SetStateAction<boolean>>;
  setLocalPrompt: Dispatch<SetStateAction<string>>;
  setLocalResponse: Dispatch<SetStateAction<string>>;
  localResponse: string; // Need current local response for blur update
}

interface UseHandleUserInteractionsReturn {
  handleEditMouseDown: (e: React.MouseEvent) => void;
  handleResponseBlur: () => void;
  handlePromptChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleResponseUpdate: (newText: string) => void; // Assuming this comes from an editor component like ToastUIEditor
}

export function useHandleUserInteractions({
  editor,
  shape,
  setLocalIsEditing,
  setLocalPrompt,
  setLocalResponse,
  localResponse, // Pass localResponse for use in handleResponseBlur
}: UseHandleUserInteractionsProps): UseHandleUserInteractionsReturn {

  // --- Handle Edit Click ---
  function handleEditMouseDown(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    setLocalIsEditing(true);
    // Update the shape prop immediately to reflect editing state
    editor.updateShape({
      id: shape.id,
      type: "chat",
      props: { ...shape.props, isEditing: true },
    });
  }

  // --- Handle Response Editor Blur ---
  function handleResponseBlur() {
    setLocalIsEditing(false);
    // Update the shape prop with the final edited response and set editing to false
    editor.updateShape({
      id: shape.id,
      type: "chat",
      props: {
        ...shape.props,
        response: localResponse, // Use the latest localResponse state
        isEditing: false,
      },
    });
  }

  // --- Handle Prompt Text Area Change ---
  function handlePromptChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const newPrompt = e.target.value;
    setLocalPrompt(newPrompt);
    // Update the shape prop in real-time as the user types in the prompt
    // Use batch to potentially group updates if needed, though maybe not necessary here
    editor.batch(() => {
      editor.updateShape({
        id: shape.id,
        type: "chat",
        props: { ...shape.props, prompt: newPrompt },
      });
    });
  }

  // --- Handle Response Editor Update (e.g., from ToastUIEditor's onChange) ---
  function handleResponseUpdate(newText: string) {
    setLocalResponse(newText);
    // Update the shape prop in real-time as the user types in the response editor
    // Note: This updates the *shape* prop, handleResponseBlur saves the final state
    editor.batch(() => {
      editor.updateShape({
        id: shape.id,
        type: "chat",
        props: { ...shape.props, response: newText },
      });
    });
  }

  return {
    handleEditMouseDown,
    handleResponseBlur,
    handlePromptChange,
    handleResponseUpdate,
  };
}
