// chatshape/containers/ChatShapeContainer.tsx
import React, { useState } from "react"
import { ChatShape } from "../ChatShapeTypes"
import { useChatAPI } from "../hooks/useChatAPI"
import { usePromptResize } from "../hooks/usePromptResize"
import { getBranchOffset } from "../utils/mathHelpers"
import { makeShapeID } from "@/lib/makeShapeID"
import { connectShapes } from "@/lib/connectShapes"
import { ChatShapeView } from "./ChatShapeView"

export function ChatShapeContainer({ shape, editor }: { shape: ChatShape; editor: any }) {
  const { getChatResponse } = useChatAPI()

  // State for prompt, AI response, editing, loading
  const [localPrompt, setLocalPrompt] = useState(shape.props.prompt)
  const [localResponse, setLocalResponse] = useState(shape.props.response)
  const [isEditingResponse, setIsEditingResponse] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const HEADER_HEIGHT = 32
  const totalHeight = shape.props.h - HEADER_HEIGHT

  // Use the modular hook to manage prompt area resizing
  // e.g. default to 100px prompt, min of 60
  const { promptHeight, handleDividerMouseDown } = usePromptResize({
    initialHeight: 40,
    totalHeight,
    minHeight: 40,
    // If you want a max: maxHeight: 300,
  })

  // -- Chat logic below

  async function sendPrompt() {
    setIsLoading(true)
    try {
      const childCount = ChatShapeContainer.layoutTree.get(shape.id) || 0
      ChatShapeContainer.layoutTree.set(shape.id, childCount + 1)

      const { x: offsetX, y: offsetY } = getBranchOffset(childCount, 120, 30)
      const newX = shape.x + shape.props.w + offsetX
      const newY = shape.y + offsetY
      const userEditedAIResponse = localResponse !== shape.props.response
      const context = userEditedAIResponse ? localResponse : undefined

      const aiResponse = await getChatResponse(localPrompt, context)
      const newShapeId = makeShapeID()
      editor.createShape({
        id: newShapeId,
        type: "chat",
        x: newX,
        y: newY,
        props: {
          prompt: "",
          response: aiResponse,
          branchType: "normal",
          w: shape.props.w,
          h: shape.props.h,
          dateCreated: Date.now(),
          color: shape.props.color,
          dash: shape.props.dash,
        },
      })
      connectShapes(editor, shape.id, newShapeId)
    } catch (err) {
      console.error("Error generating chat response:", err)
    } finally {
      setIsLoading(false)
    }
  }

  // Updated handleContextSend to send the prompt and AI response combined as context
  async function handleContextSend(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setIsLoading(true)
    console.log('Context Button Clicked!');
    console.log('localPrompt:', localPrompt);
    console.log('localResponse:', localResponse);
    
    const childCount = ChatShapeContainer.layoutTree.get(shape.id) || 0
    ChatShapeContainer.layoutTree.set(shape.id, childCount + 1)

    // Define a helper to mimic fan-out offset (similar to the mega file)
    const getFanOffset = (childIndex: number, spacing = 120) => {
      if (childIndex === 0) return 0
      const n = Math.ceil(childIndex / 2)
      const sign = childIndex % 2 === 1 ? -1 : 1
      return sign * n * spacing
    }

    const newX = shape.x + shape.props.w + 200
    const newY = shape.y + getFanOffset(childCount, 120)
    // Use the current AI response as context
    const context = localResponse

    try {
      const aiResponse = await getChatResponse(localPrompt, context)
      const newShapeId = makeShapeID()
      editor.createShape({
        id: newShapeId,
        type: "chat",
        x: newX,
        y: newY,
        props: {
          prompt: "",
          response: aiResponse,
          branchType: "context",
          w: shape.props.w,
          h: shape.props.h,
          dateCreated: Date.now(),
          color: shape.props.color,
          dash: shape.props.dash,
        },
      })
      connectShapes(editor, shape.id, newShapeId)
    } catch (err) {
      console.error("Error re-sending context:", err)
    } finally {
      setIsLoading(false)
    }
  }

  function handleEditMouseDown(e: React.MouseEvent) {
    e.stopPropagation()
    e.preventDefault()
    setIsEditingResponse(true)
  }

  function handleResponseBlur() {
    setIsEditingResponse(false)
    editor.updateShape({
      id: shape.id,
      type: "chat",
      props: { ...shape.props, response: localResponse },
    })
  }

  function handlePromptChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setLocalPrompt(e.target.value)
    editor.updateShape({
      id: shape.id,
      type: "chat",
      props: { ...shape.props, prompt: e.target.value },
    })
  }

  function handleResponseUpdate(newText: string) {
    setLocalResponse(newText)
  }

  return (
    <ChatShapeView
      shape={shape}
      isLoading={isLoading}
      isEditingResponse={isEditingResponse}
      localPrompt={localPrompt}
      localResponse={localResponse}
      promptHeight={promptHeight}
      onDividerMouseDown={handleDividerMouseDown}
      onEdit={handleEditMouseDown}
      onResponseBlur={handleResponseBlur}
      onPromptChange={handlePromptChange}
      onResponseUpdate={handleResponseUpdate}
      onSendPrompt={sendPrompt}
      onContextSend={handleContextSend}
    />
  )
}

ChatShapeContainer.layoutTree = new Map()
