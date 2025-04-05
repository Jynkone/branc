import { Editor } from "tldraw";
import { TLShapeId } from "@tldraw/tlschema";
import { ChatShape } from "@/components/chatshape/ChatShapeTypes";

/**
 * Traces backward through connected chat shapes to build a conversation history
 * in the format expected by the Gemini API
 */
export function buildConversationContext(
  editor: Editor,
  currentShapeId: TLShapeId,
  maxDepth = 5
): Array<{role: string, parts: Array<{text: string}>}> {
  const conversation: Array<{role: string, parts: Array<{text: string}>}> = [];
  let currentId: TLShapeId | undefined = currentShapeId;
  let depth = 0;
  
  // Cache visited shapes to avoid loops
  const visited = new Set<string>();
  
  // Follow parent links until we reach a root or max depth
  while (currentId && depth < maxDepth && !visited.has(currentId)) {
    visited.add(currentId);
    const shape = editor.getShape(currentId) as ChatShape | undefined;
    
    if (!shape || shape.type !== "chat") break;
    
    // Only add non-empty messages to the conversation
    if (shape.props.prompt && shape.props.prompt.trim()) {
      // Add user message
      conversation.unshift({
        role: "user",
        parts: [{ text: shape.props.prompt }]
      });
      
      // If this shape has a response, add it too
      if (shape.props.response && shape.props.response.trim()) {
        conversation.unshift({
          role: "model",
          parts: [{ text: shape.props.response }]
        });
      }
    }
    
    // Move to parent shape
    currentId = shape.props.parentId as TLShapeId | undefined;
    depth++;
  }
  
  return conversation;
}