import React, { Dispatch, SetStateAction, useCallback } from 'react'; // Import useCallback
import { TLShapeId } from '@tldraw/tlschema'; // Import TLShapeId
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
  handlePruneHistory: (e: React.MouseEvent) => void; // Add prune history handler type
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

  // --- Handle Prune History Click ---
  const handlePruneHistory = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    const currentShapeId = shape.id;
    const parentId = shape.props.parentId as TLShapeId | undefined;

    if (!parentId) {
      console.warn("Cannot prune history for a root shape.");
      return;
    }

    // Find direct children of the current shape
    // Note: tldraw doesn't have a direct getShapeIdsInParent, we need to filter all shapes.
    const allShapes = editor.getCurrentPageShapes();
    const childIds = allShapes
      .filter((s: any) => s.parentId === currentShapeId)
      .map((s: any) => s.id as TLShapeId);


    editor.batch(() => {
      // Reparent children to the current shape's parent (grandparent)
      childIds.forEach((childId: TLShapeId) => {
        // Check if shape still exists before updating (might have been deleted)
        if (editor.getShape(childId)) {
          editor.updateShape({
            id: childId,
            // type: 'chat', // Type might not be needed if just updating props
            props: { parentId: parentId },
          });
        }
      });

      // Delete the current shape
      editor.deleteShape(currentShapeId);

      // Optional: Trigger layout recalculation if needed
      // editor.dispatch(...) or call relevant layout function
      // Example: May need to call reorganizeParentBranch from useManageAiApi context if available
    });

  }, [editor, shape.id, shape.props.parentId]);


  return {
    handleEditMouseDown,
    handleResponseBlur,
    handlePromptChange,
    handleResponseUpdate,
    handlePruneHistory, // Add prune history handler to return object
  };
}
