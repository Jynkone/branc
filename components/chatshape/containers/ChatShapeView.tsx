// lib/ChatShapeView.tsx
import React from "react";
import { HTMLContainer, toDomPrecision, useDefaultColorTheme } from "tldraw";
import { ChatShapeHeader } from "../components/ChatShapeHeader";
import { ChatShapeContent } from "../components/ChatShapeContent";
import { ChatShapeFooter } from "../components/ChatShapeFooter";
import { Loader } from "lucide-react";

type Props = {
  shape: any;
  isLoading: boolean;
  isEditingResponse: boolean;
  localPrompt: string;
  localResponse: string;
  promptHeight: number;
  hideResponse?: boolean;
  isInConversation?: boolean; // Add this property
  onDividerMouseDown: (e: React.MouseEvent) => void;
  onEdit: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onResponseBlur: () => void;
  onPromptChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onResponseUpdate: (value: string) => void;
  onSendPrompt: () => void;
  onContextSend: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onPruneHistory: (e: React.MouseEvent<HTMLButtonElement>) => void; // Add prop type
};

export function ChatShapeView({
  shape,
  isLoading,
  isEditingResponse,
  localPrompt,
  localResponse,
  promptHeight,
  hideResponse = false,
  onDividerMouseDown,
  onEdit,
  onResponseBlur,
  onPromptChange,
  onResponseUpdate,
  onSendPrompt,
  onContextSend,
  onPruneHistory, // Destructure prop
}: Props) {
  const theme = useDefaultColorTheme();
  const colorKey = shape.props?.color as keyof typeof theme;
  const themeColor = theme[colorKey] as Exclude<typeof theme[typeof colorKey], string>;
  const strokeColor = themeColor.solid;
  let borderStyle: "solid" | "dashed" | "dotted" = "solid";
  if (shape.props?.dash === "dashed") borderStyle = "dashed";
  if (shape.props?.dash === "dotted") borderStyle = "dotted";
  const backgroundColor = "#F9FAFB";

  // Determine opacity.
  let opacity = 1;
  if (shape.type === "arrow") {
    // For arrows, use meta.
    const suggestionMeta = shape.meta as any;
    if (suggestionMeta?.isSuggestion) {
      if (suggestionMeta.suggestionGeneration === 2) {
        opacity = 0.75;
      } else if (suggestionMeta.suggestionGeneration === 1) {
        opacity = 0.75;
      }
    }
  } else if (shape.props?.isSuggestion) {
    if (shape.props.suggestionGeneration === 2) {
      opacity = 0.75;
    } else if (shape.props.suggestionGeneration === 1) {
      opacity = 0.75;
    }
  }

  // Render arrow differently.
  if (shape.type === "arrow") {
    return (
      <HTMLContainer
        id={shape.id}
        style={{
          pointerEvents: "auto",
          width: toDomPrecision(shape.props?.w || 0),
          height: toDomPrecision(shape.props?.h || 0),
          position: "absolute", // arrows are absolutely positioned
          opacity: opacity,
        }}
      >
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
      </HTMLContainer>
    );
  }

  // Render regular chat shape view.
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
          borderRadius: "5px",
          boxSizing: "border-box",
          opacity: opacity,
        }}
        onPointerDown={(e) => {
          if (isEditingResponse) e.stopPropagation();
        }}
      >
        <ChatShapeHeader strokeColor={strokeColor} onContextClick={onContextSend} onPruneHistory={onPruneHistory} /> {/* Pass prop here */}
        {!hideResponse && (
          <div style={{ flex: 1, overflow: "auto" }}>
            <ChatShapeContent
              response={localResponse}
              isEditing={isEditingResponse}
              height={-1}
              onChange={onResponseUpdate}
              onBlur={onResponseBlur}
              onEdit={onEdit}
              // onPruneHistory removed from here
            />
          </div>
        )}
        {!hideResponse && (
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
              src="/Group 32956.svg"
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
        )}
        <div
          style={{
            height: hideResponse ? "calc(100% - 32px)" : promptHeight,
            overflow: "auto",
            flex: hideResponse ? 1 : undefined,
          }}
        >
          <ChatShapeFooter
            prompt={localPrompt}
            onChange={onPromptChange}
            onSend={onSendPrompt}
          />
        </div>
      </HTMLContainer>
    </div>
  );
}
