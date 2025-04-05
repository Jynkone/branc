import { TLShapeId, TLShape } from '@tldraw/tlschema';
import { ChatShape } from '../ChatShapeTypes';
import { CHATSHAPE_DIMENSIONS } from '../ChatShapeUtil';
import { makeShapeID } from '@/lib/makeShapeID';
import { connectShapes } from '@/lib/connectShapes';
import { findBestPosition, arrangeSuggestionFan, reorganizeBranch } from '@/lib/findBestPosition'; // Assuming these are correctly exported

// Optional registry for suggestions - consider if this state needs to be managed differently
const suggestionRegistry = new Map<string, string[]>();

interface UseManageChatSuggestionsProps {
  editor: any; // Define a more specific type if possible
}

interface UseManageChatSuggestionsReturn {
  createSuggestionBoxes: (parentId: TLShapeId, questions: string[], generation: number) => TLShapeId[];
  cycleSuggestionCleanup: () => void;
  updateArrowsForAcceptedSuggestion: (acceptedId: TLShapeId) => void;
  arrangeSuggestions: (parentId: TLShapeId, suggestionIds: TLShapeId[]) => void;
  reorganizeParentBranch: (parentId: TLShapeId, newChildIds?: TLShapeId[]) => void;
}

export function useManageChatSuggestions({ editor }: UseManageChatSuggestionsProps): UseManageChatSuggestionsReturn {

  // --- Helper: Determine best direction for suggestions ---
  function determineDirection(
    parentShape: any,
    position: { x: number, y: number }
  ): 'right' | 'left' | 'top' | 'bottom' {
    const parentCenterX = parentShape.x + (parentShape.props.w / 2);
    const parentCenterY = parentShape.y + (parentShape.props.h / 2);
    const relX = position.x - parentCenterX;
    const relY = position.y - parentCenterY;

    if (Math.abs(relX) > Math.abs(relY)) {
      return relX > 0 ? 'right' : 'left';
    } else {
      return relY > 0 ? 'bottom' : 'top';
    }
  }

  // --- Helper: Adjust fan angle based on direction ---
  function adjustAngleForDirection(angle: number, direction: 'right' | 'left' | 'top' | 'bottom'): number {
    switch (direction) {
      case 'right': return angle;
      case 'left': return Math.PI + angle;
      case 'bottom': return Math.PI / 2 + angle;
      case 'top': return -Math.PI / 2 + angle;
      default: return angle;
    }
  }

  // --- Create Suggestion Boxes ---
  function createSuggestionBoxes(
    parentId: TLShapeId,
    questions: string[],
    generation: number
  ): TLShapeId[] {
    const parentShape = editor.getShape(parentId) as ChatShape | undefined;
    if (!parentShape) return [];

    // Use findBestPosition to determine the general area/direction
    const samplePosition = findBestPosition(editor, parentId, 'standard'); // Assuming 'standard' is appropriate
    const bestDirection = determineDirection(parentShape, samplePosition);

    const suggestionIds: TLShapeId[] = [];
    const angleSpread = (2 * Math.PI) / 3; // 120 degrees
    const startAngle = -angleSpread / 2;
    const radius = 350; // Consider making this configurable or dynamic

    questions.forEach((question, index) => {
      const angle = startAngle + (angleSpread * index) / Math.max(1, questions.length - 1);
      const adjustedAngle = adjustAngleForDirection(angle, bestDirection);
      const offsetX = radius * Math.cos(adjustedAngle);
      const offsetY = radius * Math.sin(adjustedAngle);

      let posX = parentShape.x;
      let posY = parentShape.y;

      // Adjust base position based on direction
      switch (bestDirection) {
        case 'right': posX += parentShape.props.w; break;
        case 'left': posX -= CHATSHAPE_DIMENSIONS.SUGGESTION.width; break; // Position relative to suggestion width
        case 'bottom': posY += parentShape.props.h; break;
        case 'top': posY -= CHATSHAPE_DIMENSIONS.SUGGESTION.height; break; // Position relative to suggestion height
      }

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
      connectShapes(editor, parentId, suggestionId);
    });

    suggestionRegistry.set(parentId as string, suggestionIds.map(id => id as string));
    return suggestionIds;
  }

  // --- Update Arrows for Accepted Suggestion ---
  function updateArrowsForAcceptedSuggestion(acceptedId: TLShapeId) {
    const allShapes = editor.getCurrentPageShapes();
    allShapes.forEach((s: any) => {
      if (s.type === "arrow" && (s.meta as any)?.isSuggestion) {
        const meta = s.meta as any;
        if (meta.connectedFrom === acceptedId || meta.connectedTo === acceptedId) {
          editor.updateShape({
            id: s.id,
            type: s.type,
            meta: { ...meta, branchType: "accepted", isSuggestion: false }, // Mark as accepted, remove suggestion flag
            opacity: 1,
          });
        }
      }
    });
  }

  // --- Cleanup Cycle: Downgrade and Delete Old Suggestions ---
  function cycleSuggestionCleanup() {
    const allShapes = editor.getCurrentPageShapes();
    const protectedExists = allShapes.some((s: any) => s.props?.branchType === "accepted" && s.props?.protectedSuggestion);

    // First pass: Downgrade suggestions
    allShapes.forEach((s: any) => {
      if ((s.props?.branchType === "accepted") || (s.meta?.branchType === "accepted")) return;

      if (s.props?.isSuggestion) { // Chat shape suggestion
        if (s.props.suggestionGeneration === 2) {
          editor.updateShape({ id: s.id, type: s.type, props: { ...s.props, suggestionGeneration: 1 }, opacity: 0.75 });
        } else if (s.props.suggestionGeneration === 1 && !protectedExists) {
          editor.updateShape({ id: s.id, type: s.type, props: { ...s.props, suggestionGeneration: 0 }, opacity: 0.1 });
        }
      } else if (s.type === "arrow" && s.meta?.isSuggestion) { // Arrow suggestion
        if (s.meta.suggestionGeneration === 2) {
          editor.updateShape({ id: s.id, type: s.type, meta: { ...s.meta, suggestionGeneration: 1 }, opacity: 0.75 });
        } else if (s.meta.suggestionGeneration === 1 && !protectedExists) {
          editor.updateShape({ id: s.id, type: s.type, meta: { ...s.meta, suggestionGeneration: 0 }, opacity: 0.1 });
        }
      }
    });

    // Second pass: Delete generation 0 suggestions
    const shapesToDelete = editor.getCurrentPageShapes().filter((s: any) => {
      if (s.props?.branchType === "accepted" || s.meta?.branchType === "accepted") return false;
      if (s.props?.isSuggestion && s.props.suggestionGeneration === 0) return true;
      if (s.type === "arrow" && s.meta?.isSuggestion && s.meta.suggestionGeneration === 0) return true;
      return false;
    });

    if (shapesToDelete.length > 0) {
      editor.deleteShapes(shapesToDelete.map((s: any) => s.id));
    }
  }

  // --- Layout Functions ---
  function arrangeSuggestions(parentId: TLShapeId, suggestionIds: TLShapeId[]) {
     // Use Dagre or similar to organize this branch including the new suggestions
     arrangeSuggestionFan(editor, parentId, suggestionIds);
  }

  function reorganizeParentBranch(parentId: TLShapeId, newChildIds?: TLShapeId[]) {
    reorganizeBranch(editor, parentId, newChildIds);
  }


  return {
    createSuggestionBoxes,
    cycleSuggestionCleanup,
    updateArrowsForAcceptedSuggestion,
    arrangeSuggestions,
    reorganizeParentBranch,
  };
}
