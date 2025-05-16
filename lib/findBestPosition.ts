import { TLShapeId } from '@tldraw/tlschema';
import { placeStandard } from './organicLayoutManager';
import { ChatShape } from '@/components/chatshape/ChatShapeTypes';

export function findBestPosition(
  editor: any,
  parentId: TLShapeId,
  boxType: 'standard' | 'suggestion' = 'standard',
) {
  const { x, y } = placeStandard(editor, parentId, boxType);

  // direction meta
  const parent = editor.getShape(parentId) as ChatShape | undefined;
  let dir: 'right' | 'left' | 'bottom' | 'top' = 'right';
  if (parent) {
    const cx = parent.x + parent.props.w/2;
    const cy = parent.y + parent.props.h/2;
    dir =
      Math.abs(x - cx) > Math.abs(y - cy)
        ? x > cx ? 'right' : 'left'
        : y > cy ? 'bottom' : 'top';
  }
  return { x, y, direction: dir };
}

/* pass-through helpers if you already call them elsewhere */
export { placeSuggestions as arrangeSuggestionFan } from './organicLayoutManager';
export const reorganizeBranch = () => {};
