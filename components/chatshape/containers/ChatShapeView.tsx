// chatshape/containers/ChatShapeView.tsx
import React from "react"
import { HTMLContainer, toDomPrecision, useDefaultColorTheme } from "tldraw"
import { ChatShapeHeader } from "../components/ChatShapeHeader"
import { ChatShapeContent } from "../components/ChatShapeContent"
import { ChatShapeFooter } from "../components/ChatShapeFooter"
import { Loader } from "lucide-react"

type Props = {
  shape: any
  isLoading: boolean
  isEditingResponse: boolean
  localPrompt: string
  localResponse: string
  promptHeight: number
  onDividerMouseDown: (e: React.MouseEvent) => void
  onEdit: (e: React.MouseEvent<HTMLButtonElement>) => void
  onResponseBlur: () => void
  onPromptChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  onResponseUpdate: (value: string) => void
  onSendPrompt: () => void
  onContextSend: (e: React.MouseEvent<HTMLButtonElement>) => void
}

export function ChatShapeView({
  shape,
  isLoading,
  isEditingResponse,
  localPrompt,
  localResponse,
  promptHeight,
  onDividerMouseDown,
  onEdit,
  onResponseBlur,
  onPromptChange,
  onResponseUpdate,
  onSendPrompt,
  onContextSend,
}: Props) {
  // Use Tldraw's theme so that style changes update automatically
  const theme = useDefaultColorTheme()
  const colorKey = shape.props.color as keyof typeof theme
  const themeColor = theme[colorKey] as Exclude<typeof theme[typeof colorKey], string>
  const strokeColor = themeColor.solid
  let borderStyle: "solid" | "dashed" | "dotted" = "solid"
  if (shape.props.dash === "dashed") borderStyle = "dashed"
  if (shape.props.dash === "dotted") borderStyle = "dotted"
  const backgroundColor = "#F9FAFB"

  return (
    <div style={{ position: "relative" }}>
      {isLoading && (
        <div
          style={{
            position: "absolute",
            top: "-50px",
            left: "50%",
            transform: "translateX(-50%)",
            width: "40px",
            height: "40px",
            borderRadius: "50%",
            backgroundColor: "rgba(255, 255, 255, 0.9)",
            boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
            zIndex: 999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Loader className="w-6 h-6 animate-spin" />
        </div>
      )}

      <HTMLContainer
        id={shape.id}
        style={{
          pointerEvents: "auto",
          width: toDomPrecision(shape.props.w),
          height: toDomPrecision(shape.props.h),
          display: "flex",
          flexDirection: "column",
          position: "relative",
          backgroundColor,
          border: `3px ${borderStyle} ${strokeColor}`,
          borderRadius: "8px",
          boxSizing: "border-box",
        }}
        onPointerDown={(e) => {
          // When editing the AI response, block pointer events from selecting the shape
          if (isEditingResponse) e.stopPropagation()
        }}
      >
        {/* Header fixed at top */}
        <ChatShapeHeader strokeColor={strokeColor} onContextClick={onContextSend} />

        {/* AI response region using flex: 1 */}
        <div style={{ flex: 1, overflow: "auto" }}>
          <ChatShapeContent
            response={localResponse}
            isEditing={isEditingResponse}
            height={-1} // Fallback value indicating "fill available height"
            onChange={onResponseUpdate}
            onBlur={onResponseBlur}
            onEdit={onEdit}
          />
        </div>

        {/* Divider with thin 1px black lines and diamond SVG as the handle */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            height: "16px",
            userSelect: "none",
          }}
        >
          <div style={{ flex: 1, height: "0.07px", backgroundColor: "black" }} />
          <img
            src="/Group 32956.svg" // Ensure this path is correct
            alt="Resize handle"
            onMouseDown={onDividerMouseDown}
            style={{
              width: "16px",
              height: "16px",
              margin: "0 8px",
              cursor: "ns-resize",
              userSelect: "none",
            }}
          />
          <div style={{ flex: 1, height: "0.07px", backgroundColor: "black" }} />
        </div>

        {/* Prompt region pinned at bottom */}
        <div style={{ height: promptHeight, overflow: "auto" }}>
          <ChatShapeFooter
            prompt={localPrompt}
            onChange={onPromptChange}
            onSend={onSendPrompt}
          />
        </div>
      </HTMLContainer>
    </div>
  )
}
