// chatshape/components/ChatShapeContent.tsx
import React from "react";
import { Button } from "../../ui/button";
import { Pencil } from "lucide-react"; // Remove Scissors import
import { EditableMarkdown } from "./EditableMarkdown";
import dynamic from 'next/dynamic';

const ToastUIEditorNoSSR = dynamic(
  () => import('./ToastUIEditor').then(mod => mod.ToastUIEditor),
  { ssr: false }
);

export type ChatShapeContentProps = {
  response: string;
  isEditing: boolean;
  height: number; // Provided by the parent; use -1 to mean "fill available space"
  onChange: (value: string) => void;
  onBlur: () => void;
  onEdit: (e: React.MouseEvent<HTMLButtonElement>) => void;
  // Remove onPruneHistory prop type
};

export const ChatShapeContent: React.FC<ChatShapeContentProps> = ({
  response,
  isEditing,
  height,
  onChange,
  onBlur,
  onEdit,
  // Remove onPruneHistory from destructuring
}) => {
  const contentStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    boxSizing: "border-box",
    overflow: "auto",
    paddingLeft: isEditing ? "0px" : "20px",
    paddingTop: isEditing ? "0px" : "10px",
    paddingRight: isEditing ? "0px" : "20px",
    paddingBottom: isEditing ? "0px" : "10px",
  };

  return (
    <div style={{ position: "relative", width: "100%", height: height === -1 ? "100%" : height }}>
      <div style={contentStyle}>
        {isEditing ? (
          <div style={{ height: "100%", overflow: "auto" }}>
            <ToastUIEditorNoSSR
              initialValue={response}
              onChange={onChange}
              onBlur={onBlur}
            />
          </div>
        ) : (
          <EditableMarkdown content={response} />
        )}
      </div>
      {/* Only show the edit button if not editing and if there is a non-empty response */}
      {!isEditing && response.trim().length > 0 && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onMouseDown={onEdit}
          style={{
            position: "absolute",
            bottom: "15px",
            right: "18px",
            cursor: "pointer",
            opacity: 0.7,
            display: "flex",
            alignItems: "center",
          }}
        >
          <Pencil className="w-4 h-4" />
        </Button>
      )}
      {/* Prune history button removed from here */}
    </div>
  );
};
