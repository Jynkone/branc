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
 * @param editor The editor instance.
 * @param parentBoxId The TLShapeId of the parent box.
 * @param childBoxId The TLShapeId of the child box.
 */
export function connectShapes(
  editor: Editor,
  parentBoxId: TLShapeId,
  childBoxId: TLShapeId
): void {
  // Minimal arrow properties to satisfy the schema.
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
    dash: 'solid', // Allowed values: "solid" | "dashed" | "dotted" | "draw"
    font: 'sans',  // Allowed values: "draw" | "mono" | "sans" | "serif"
    text: '',
    labelPosition: 0,
  }

  // Generate an arrow shape ID with the required "shape:" prefix.
  const arrowShapeId = ('shape:arrow:' + Math.random().toString(36).slice(2, 10)) as TLShapeId

  // Create an arrow shape using minimal required properties.
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
    meta: {},
    typeName: 'shape',
  }

  // Create the arrow shape.
  editor.createShape(arrowShape)

  // Create two bindings: one for the start (connecting to the parent box)
  // and one for the end (connecting to the child box).
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
