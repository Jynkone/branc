// chatshape/ChatShapeTypes.ts
import { TLBaseShape, TLDefaultColorStyle, TLDefaultDashStyle } from "tldraw"

/**
 * Defines the ChatShape type with synchronized properties
 */
export type ChatShape = TLBaseShape<
  "chat",
  {
    w: number
    h: number
    prompt: string
    response: string
    branchType: "normal" | "context"
    dateCreated: number
    color: TLDefaultColorStyle
    dash: TLDefaultDashStyle
  }
>