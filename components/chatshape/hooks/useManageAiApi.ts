import { Dispatch, SetStateAction } from 'react';
import { TLShapeId } from '@tldraw/tlschema';
import { ChatShape } from '../ChatShapeTypes';
import { useChatAPI } from './useChatAPI'; // Assuming this path is correct
import { buildConversationContext } from '@/lib/buildConversationContext';
import { makeShapeID } from '@/lib/makeShapeID';
import { connectShapes } from '@/lib/connectShapes';
import { findBestPosition } from '@/lib/findBestPosition';
import { CHATSHAPE_DIMENSIONS } from '../ChatShapeUtil';

// Define the expected shape of the functions passed from useManageChatSuggestions
interface SuggestionManagementActions {
  createSuggestionBoxes: (parentId: TLShapeId, questions: string[], generation: number) => TLShapeId[];
  cycleSuggestionCleanup: () => void;
  updateArrowsForAcceptedSuggestion: (acceptedId: TLShapeId) => void;
  arrangeSuggestions: (parentId: TLShapeId, suggestionIds: TLShapeId[]) => void;
  reorganizeParentBranch: (parentId: TLShapeId, newChildIds?: TLShapeId[]) => void;
}

interface UseManageAiApiProps extends SuggestionManagementActions {
  editor: any; // Define a more specific type if possible
  shape: ChatShape;
  localPrompt: string;
  localResponse: string; // Needed for context and checking edits
  setIsLoading: Dispatch<SetStateAction<boolean>>;
}

interface UseManageAiApiReturn {
  sendPrompt: () => Promise<void>;
  handleContextSend: (e: React.MouseEvent) => Promise<void>;
  handleSendFromSuggestion: () => Promise<void>;
}

export function useManageAiApi({
  editor,
  shape,
  localPrompt,
  localResponse,
  setIsLoading,
  createSuggestionBoxes,
  cycleSuggestionCleanup,
  updateArrowsForAcceptedSuggestion,
  arrangeSuggestions,
  reorganizeParentBranch,
}: UseManageAiApiProps): UseManageAiApiReturn {
  const { getChatResponse } = useChatAPI();

  // --- Send Normal Prompt ---
  async function sendPrompt() {
    setIsLoading(true);
    let newShapeId: TLShapeId | null = null; // Initialize to null
    try {
      const conversationHistory = buildConversationContext(editor, shape.id);
      const userEditedAIResponse = localResponse !== shape.props.response;
      const additionalContext = userEditedAIResponse ? localResponse : undefined;

      // Use findBestPosition for initial placement guess
      const position = findBestPosition(editor, shape.id, 'standard');

      const { response, followUpQuestions } = await getChatResponse(
        localPrompt,
        conversationHistory,
        additionalContext
      );

      newShapeId = makeShapeID();
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
          parentId: shape.id,
        },
      });

      connectShapes(editor, shape.id as TLShapeId, newShapeId as TLShapeId);

      if (followUpQuestions && followUpQuestions.length > 0) {
        // Delay suggestion creation slightly
        setTimeout(() => {
          const suggestionIds = createSuggestionBoxes(newShapeId!, followUpQuestions, 2); // Use non-null assertion
          // Delay layout arrangement after suggestions are created
          setTimeout(() => {
            arrangeSuggestions(newShapeId!, suggestionIds); // Use non-null assertion
          }, 100);
        }, 500);
      } else {
        // Reorganize even without suggestions, slightly delayed
        setTimeout(() => {
          reorganizeParentBranch(shape.id, newShapeId ? [newShapeId] : undefined);
        }, 200);
      }

      cycleSuggestionCleanup();

    } catch (err) {
      console.error("Error generating chat response:", err);
      // Consider user-facing error feedback
    } finally {
      setIsLoading(false);
    }
  }

  // --- Send with Context ---
  async function handleContextSend(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsLoading(true);
    let newShapeId: TLShapeId | null = null;
    try {
      const conversationHistory = buildConversationContext(editor, shape.id);
      const context = localResponse; // Always use current local response as context
      const position = findBestPosition(editor, shape.id, 'standard');

      const { response, followUpQuestions } = await getChatResponse(
        localPrompt, // Send original prompt again
        conversationHistory,
        context // Provide current response as context
      );

      newShapeId = makeShapeID();
      editor.createShape({
        id: newShapeId,
        type: "chat",
        x: position.x,
        y: position.y,
        props: {
          prompt: "", // New shape starts with empty prompt
          response: response,
          branchType: "context", // Mark as context-based branch
          w: CHATSHAPE_DIMENSIONS.STANDARD.width,
          h: CHATSHAPE_DIMENSIONS.STANDARD.height,
          dateCreated: Date.now(),
          color: shape.props.color,
          dash: shape.props.dash,
          promptHeight: shape.props.promptHeight,
          isEditing: false,
          parentId: shape.id,
        },
      });

      connectShapes(editor, shape.id as TLShapeId, newShapeId as TLShapeId);

      if (followUpQuestions && followUpQuestions.length > 0) {
         // Delay suggestion creation slightly
         setTimeout(() => {
          const suggestionIds = createSuggestionBoxes(newShapeId!, followUpQuestions, 2); // Use non-null assertion
          // Delay layout arrangement after suggestions are created
          setTimeout(() => {
            arrangeSuggestions(newShapeId!, suggestionIds); // Use non-null assertion
          }, 100);
        }, 500); // Increased delay slightly
      } else {
         // Reorganize even without suggestions, slightly delayed
         setTimeout(() => {
          reorganizeParentBranch(shape.id, newShapeId ? [newShapeId] : undefined);
        }, 200);
      }

      cycleSuggestionCleanup();

    } catch (err) {
      console.error("Error re-sending context:", err);
       // Consider user-facing error feedback
    } finally {
      setIsLoading(false);
    }
  }

  // --- Send from Suggestion ---
  async function handleSendFromSuggestion() {
    // This function should only be callable if shape.props.isSuggestion is true,
    // but the check might live in the component calling this hook.
    setIsLoading(true);
    try {
      const parentId = shape.props.parentId as TLShapeId;
      const conversationHistory = parentId ? buildConversationContext(editor, parentId) : [];

      const currentGeneration = shape.props.suggestionGeneration;
      const protectedFlag = currentGeneration === 1; // Protect gen 1 suggestions upon acceptance

      // Mark suggestion as accepted visually (updates handled by this hook now)
      editor.updateShape({
        id: shape.id,
        type: "chat",
        props: {
          ...shape.props,
          hideResponse: false,
          isSuggestion: false, // No longer a suggestion
          branchType: "accepted",
          w: CHATSHAPE_DIMENSIONS.STANDARD.width, // Grow to standard size
          h: CHATSHAPE_DIMENSIONS.STANDARD.height,
          suggestionGeneration: protectedFlag ? 1 : shape.props.suggestionGeneration, // Keep gen 1 if protected
          protectedSuggestion: protectedFlag, // Explicitly mark if protected
        },
        opacity: 1,
      });

      updateArrowsForAcceptedSuggestion(shape.id); // Update connected arrows

      // Get response using the suggestion's prompt
      const { response, followUpQuestions } = await getChatResponse(localPrompt, conversationHistory);

      // Update the accepted shape with the response
      editor.updateShape({
        id: shape.id,
        type: "chat",
        props: {
          ...shape.props, // Keep existing props
          response: response, // Add the fetched response
          hideResponse: false,
          isSuggestion: false,
          branchType: "accepted",
          w: CHATSHAPE_DIMENSIONS.STANDARD.width,
          h: CHATSHAPE_DIMENSIONS.STANDARD.height,
          suggestionGeneration: protectedFlag ? 1 : shape.props.suggestionGeneration,
          protectedSuggestion: protectedFlag,
        },
      });

      if (followUpQuestions && followUpQuestions.length > 0) {
        setTimeout(() => {
          const newSuggestionIds = createSuggestionBoxes(shape.id, followUpQuestions, 2); // Generate new suggestions from accepted shape
          setTimeout(() => {
            arrangeSuggestions(shape.id, newSuggestionIds);
          }, 100);
        }, 500);
      } else {
         // Reorganize branch even without new suggestions
         setTimeout(() => {
          reorganizeParentBranch(shape.id); // Reorganize from the accepted shape
        }, 200);
      }

      // Only run cleanup if the accepted suggestion wasn't protected
      if (!protectedFlag) {
        cycleSuggestionCleanup();
      }

    } catch (err) {
      console.error("Error generating response from suggestion:", err);
       // Consider user-facing error feedback
    } finally {
      setIsLoading(false);
    }
  }


  return {
    sendPrompt,
    handleContextSend,
    handleSendFromSuggestion,
  };
}
