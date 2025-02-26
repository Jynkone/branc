// components/chatshape/ChatShapeTypes.ts
import { TLBaseShape, TLDefaultColorStyle, TLDefaultDashStyle } from "tldraw"

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
    
    // Synchronized state properties
    promptHeight: number
    isEditingResponse: boolean
    editedResponseText: string
    
    // Additional synchronization properties
    editedResponseMarkdown?: string  // For Toast UI Editor
    lastEditTimestamp: number        // To track last edit
  }
>
