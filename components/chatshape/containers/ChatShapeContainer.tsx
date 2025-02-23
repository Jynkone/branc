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
    initialHeight: 100,
    totalHeight,
    minHeight: 60,
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

  function handleContextSend(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    // ...
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
