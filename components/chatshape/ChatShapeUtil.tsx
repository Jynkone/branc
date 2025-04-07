// components/chatshape/ChatShapeUtil.tsx
import React from "react";
import {
  BaseBoxShapeUtil,
  T,
  DefaultColorStyle,
  DefaultDashStyle,
} from "tldraw";
import { ChatShape } from "./ChatShapeTypes";
import { ChatShapeContainer } from "./containers/ChatShapeContainer";
import { TLShapeId } from "@tldraw/tlschema";

export const CHATSHAPE_DIMENSIONS = {
  STANDARD: { width: 300, height: 250 },
  SUGGESTION: { width: 250, height: 120 }
};

export class ChatShapeUtil extends BaseBoxShapeUtil<ChatShape> {
  static override type = "chat" as const;
  static isFillable = false;
  static styles = ["color", "dash"];

  // Define the properties using tldraw validators.
  static override props = {
    w: T.number,
    h: T.number,
    prompt: T.string,
    response: T.string,
    branchType: T.string,
    dateCreated: T.number,
    promptHeight: T.number,
    isEditing: T.boolean,
    color: DefaultColorStyle,
    dash: DefaultDashStyle,
    parentId: T.string, // now required as a string
    isSuggestion: T.boolean,
    suggestionGeneration: T.number,
    hideResponse: T.boolean,
    protectedSuggestion: T.optional(T.boolean), // Add protectedSuggestion here
  };

  static override migrations = {
    firstVersion: 0,
    currentVersion: 4, // Increment version
    migrators: {
      1: {
        up: (shape: any): any => {
          if ("fill" in shape.props) {
            delete shape.props.fill;
          }
          if (shape.props.prompt === undefined) shape.props.prompt = "";
          if (shape.props.response === undefined) shape.props.response = "";
          if (shape.props.branchType === undefined) shape.props.branchType = "normal";
          if (shape.props.color === undefined) shape.props.color = "black";
          if (shape.props.dash === undefined) shape.props.dash = "draw";
          return shape;
        },
        down: (shape: any): any => shape,
      },
      2: {
        up: (shape: any): any => {
          if (shape.props.promptHeight === undefined) shape.props.promptHeight = 40;
          if (shape.props.isEditing === undefined) shape.props.isEditing = false;
          return shape;
        },
        down: (shape: any): any => shape,
      },
      3: {
        up: (shape: any): any => {
          if (shape.props.parentId === undefined) shape.props.parentId = "" as TLShapeId;
          if (shape.props.isSuggestion === undefined) shape.props.isSuggestion = false;
          if (shape.props.suggestionGeneration === undefined) shape.props.suggestionGeneration = 0;
          if (shape.props.hideResponse === undefined) shape.props.hideResponse = false;
          return shape;
        },
        down: (shape: any): any => {
          const { parentId, isSuggestion, suggestionGeneration, hideResponse, ...props } = shape.props;
          return { ...shape, props };
        },
      },
      4: { // Add migration for version 4
        up: (shape: any): any => {
          // Default protectedSuggestion to false if it doesn't exist
          if (shape.props.protectedSuggestion === undefined) {
            shape.props.protectedSuggestion = false;
          }
          return shape;
        },
        down: (shape: any): any => {
          // Remove protectedSuggestion when downgrading
          const { protectedSuggestion, ...props } = shape.props;
          return { ...shape, props };
        },
      },
    },
  };

  getDefaultProps(): ChatShape["props"] {
    return {
      w: CHATSHAPE_DIMENSIONS.STANDARD.width,
      h: CHATSHAPE_DIMENSIONS.STANDARD.height,
      prompt: "",
      response: "",
      branchType: "normal",
      dateCreated: Date.now(),
      promptHeight: 40,
      isEditing: false,
      color: "black",
      dash: "draw",
      parentId: "" as TLShapeId,
      isSuggestion: false,
      suggestionGeneration: 0,
      hideResponse: false,
      protectedSuggestion: false, // Add default value here too
    };
  }

  override canEdit = () => true;
  override isAspectRatioLocked = () => false;
  override canResize = () => true;
  override canBind = () => true;

  override component(shape: ChatShape) {
    const editor = this.editor;
    return <ChatShapeContainer shape={shape} editor={editor} />;
  }

  override indicator(shape: ChatShape) {
    return <rect width={shape.props.w} height={shape.props.h} />;
  }
}
