// components/chatshape/ChatShapeTypes.ts
import { TLBaseShape, TLDefaultColorStyle, TLDefaultDashStyle } from "tldraw"

/**
 * Defines the ChatShape type.
 */
export type ChatShape = TLBaseShape <
  "chat",
  {
    w: number
    h: number
    prompt: string
    response: string
    branchType: "normal" | "context" | "suggestion"
    dateCreated: number
    color: TLDefaultColorStyle
    dash: TLDefaultDashStyle
    promptHeight: number
    isEditing: boolean
    parentId?: string // Add this to track the parent of suggestion boxes
    isSuggestion?: boolean // Indicates if this is a suggestion box
    suggestionGeneration?: number // Tracks which generation this suggestion belongs to
    hideResponse?: boolean // Whether to hide the response area initially
  }
>
