// lib/connectShapes.ts
import type {
  TLArrowShape,
  TLArrowShapeProps,
  TLShapeId,
  TLBindingCreate,
} from '@tldraw/tlschema'
import type { Editor } from 'tldraw'

/**
 * Creates a new arrow shape that connects a parent box (start) to a child box (end).
 *
 * If either the parent or child shape is marked as a suggestion (via custom property on props),
 * the arrow's meta field is set to include:
 *   - isSuggestion: true
 *   - suggestionGeneration: 2
 *   - connectedFrom: parentBoxId
 *   - connectedTo: childBoxId
 *
 * @param editor The editor instance.
 * @param parentBoxId The TLShapeId of the parent box.
 * @param childBoxId The TLShapeId of the child box.
 */
export function connectShapes(
  editor: Editor,
  parentBoxId: TLShapeId,
  childBoxId: TLShapeId
): void {
  // Minimal arrow properties.
  const arrowProps: TLArrowShapeProps = {
    bend: 0,
    arrowheadEnd: 'arrow',
    arrowheadStart: 'none',
    fill: 'solid',
    scale: 1,
    size: 'm',
    start: { x: 0, y: 0 },
    end: { x: 0, y: 0 },
    labelColor: 'black',
    color: 'black',
    dash: 'solid',
    font: 'sans',
    text: '',
    labelPosition: 0,
  }

  // Generate an arrow shape ID.
  const arrowShapeId = ('shape:arrow:' + Math.random().toString(36).slice(2, 10)) as TLShapeId

  // Retrieve parent and child shapes.
  const parentShape = editor.getShape(parentBoxId)
  const childShape = editor.getShape(childBoxId)

  // Check if either endpoint is a suggestion (casting props as any to bypass type restrictions).
  const isSuggestion =
    (parentShape && ((parentShape.props as any)?.isSuggestion)) ||
    (childShape && ((childShape.props as any)?.isSuggestion))

  // Create the arrow shape with custom suggestion metadata if needed.
  const arrowShape: TLArrowShape = {
    id: arrowShapeId,
    type: 'arrow',
    props: arrowProps,
    x: 0,
    y: 0,
    rotation: 0,
    index: ('a1V' as unknown) as TLArrowShape['index'],
    parentId: ('page' as unknown) as TLArrowShape['parentId'],
    isLocked: false,
    opacity: 1,
    meta: isSuggestion
      ? ({
          isSuggestion: true,
          suggestionGeneration: 2,
          connectedFrom: parentBoxId,
          connectedTo: childBoxId,
        } as any)
      : {},
    typeName: 'shape',
  }

  editor.createShape(arrowShape)

  // Create bindings for start and end.
  const bindings: TLBindingCreate[] = [
    {
      id: ('binding:' + arrowShapeId + '-start') as any,
      fromId: arrowShapeId,
      toId: parentBoxId,
      type: 'arrow',
      props: { terminal: 'start' },
    },
    {
      id: ('binding:' + arrowShapeId + '-end') as any,
      fromId: arrowShapeId,
      toId: childBoxId,
      type: 'arrow',
      props: { terminal: 'end' },
    },
  ]

  editor.createBindings(bindings)
}
