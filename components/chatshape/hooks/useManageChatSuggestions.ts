// lib/useManageChatSuggestions.ts

import { TLShapeId } from '@tldraw/tlschema';
import { ChatShape } from '@/components/chatshape/ChatShapeTypes';
import { CHATSHAPE_DIMENSIONS } from '@/components/chatshape/ChatShapeUtil';
import { makeShapeID } from '@/lib/makeShapeID';
import { connectShapes } from '@/lib/connectShapes';
import {
  placeSuggestions,
  placeStandard,
} from '@/lib/organicLayoutManager';  // our unified solver

// Keep a registry if you need to reference old suggestions for cleanup
const suggestionRegistry = new Map<TLShapeId, TLShapeId[]>();

export function useManageChatSuggestions({ editor }: { editor: any }) {
  /**
   * Create N suggestion chat‐boxes under parentId,
   * then let the organic solver fan them out.
   */
  function createSuggestionBoxes(
    parentId: TLShapeId,
    questions: string[],
    generation: number
  ): TLShapeId[] {
    const parent = editor.getShape(parentId) as ChatShape | undefined;
    if (!parent || questions.length === 0) return [];

    // 1) Batch‐create all suggestion shapes at parent’s bottom‐center
    const ids: TLShapeId[] = questions.map(() => makeShapeID());
    editor.batch(() => {
      ids.forEach((id, i) => {
        editor.createShape({
          id,
          type: 'chat',
          x:
            parent.x +
            parent.props.w / 2 -
            CHATSHAPE_DIMENSIONS.SUGGESTION.width / 2,
          y: parent.y + parent.props.h, // start right below
          props: {
            prompt: questions[i],
            response: '',
            branchType: 'suggestion',
            w: CHATSHAPE_DIMENSIONS.SUGGESTION.width,
            h: CHATSHAPE_DIMENSIONS.SUGGESTION.height,
            dateCreated: Date.now(),
            color: parent.props.color,
            dash: parent.props.dash,
            promptHeight: parent.props.promptHeight,
            isEditing: false,
            parentId,
            isSuggestion: true,
            suggestionGeneration: generation,
            hideResponse: true,
          },
          opacity:
            generation === 2
              ? 0.75
              : generation === 1
              ? 0.75
              : 0.1,
        });
        connectShapes(editor, parentId, id);
      });
    });

    // 2) Store for cleanup and then fan them out
    suggestionRegistry.set(parentId, ids);
    placeSuggestions(editor, parentId, ids);

    return ids;
  }

  /** Mark arrows as “accepted” when a suggestion is chosen */
  function updateArrowsForAcceptedSuggestion(acceptedId: TLShapeId) {
    editor.getCurrentPageShapes().forEach((s: any) => {
      if (
        s.type === 'arrow' &&
        s.meta?.isSuggestion &&
        (s.meta.connectedFrom === acceptedId ||
          s.meta.connectedTo === acceptedId)
      ) {
        editor.updateShape({
          id: s.id,
          type: 'arrow',
          meta: { ...s.meta, branchType: 'accepted', isSuggestion: false },
          opacity: 1,
        });
      }
    });
  }

  /** Downgrade then prune old suggestions over time */
  function cycleSuggestionCleanup() {
    const all = editor.getCurrentPageShapes();
    const hasProtected = all.some(
      (s: any) =>
        (s.props?.branchType === 'accepted' && s.props?.protectedSuggestion) ||
        s.meta?.branchType === 'accepted'
    );

    // 1) Downgrade
    all.forEach((s: any) => {
      if (s.type === 'chat' && s.props?.isSuggestion) {
        const gen = s.props.suggestionGeneration ?? 0;
        if (gen === 2) {
          editor.updateShape({
            id: s.id,
            type: 'chat',
            props: { ...s.props, suggestionGeneration: 1 },
            opacity: 0.75,
          });
        } else if (gen === 1 && !hasProtected) {
          editor.updateShape({
            id: s.id,
            type: 'chat',
            props: { ...s.props, suggestionGeneration: 0 },
            opacity: 0.1,
          });
        }
      }
    });

    // 2) Delete generation‐0 suggestions
    const toDelete = all.filter((s: any) =>
      s.props?.isSuggestion && s.props.suggestionGeneration === 0
    );
    if (toDelete.length) {
      editor.deleteShapes(toDelete.map((s: any) => s.id));
    }
  }

  /** If you need an API entry to re‐fan suggestions on demand */
  function arrangeSuggestions(parentId: TLShapeId, suggestionIds: TLShapeId[]) {
    placeSuggestions(editor, parentId, suggestionIds);
  }

  /** Re‐layout an existing branch (e.g. after pruning) */
  function reorganizeParentBranch(parentId: TLShapeId, newChildIds?: TLShapeId[]) {
    // If you have a reorganizeBranch helper, call it here
    // reorganizeBranch(editor, parentId, newChildIds);
    // Otherwise, simply re‐fan suggestions:
    const ids = newChildIds ?? suggestionRegistry.get(parentId) ?? [];
    if (ids.length) placeSuggestions(editor, parentId, ids);
  }

  return {
    createSuggestionBoxes,
    cycleSuggestionCleanup,
    updateArrowsForAcceptedSuggestion,
    arrangeSuggestions,
    reorganizeParentBranch,
  };
}
