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

export class ChatShapeUtil extends BaseBoxShapeUtil<ChatShape> {
  static override type = "chat" as const;
  static isFillable = false;
  static styles = ["color", "dash"];

  // IMPORTANT: Fix the prop validators to match expected types
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
    // Use a different way to define optional properties
    parentId: T.string,
    isSuggestion: T.boolean,
    suggestionGeneration: T.number,
    hideResponse: T.boolean,
  };

  static override migrations = {
    firstVersion: 0,
    currentVersion: 3,
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
          if (shape.props.parentId === undefined) shape.props.parentId = undefined;
          if (shape.props.isSuggestion === undefined) shape.props.isSuggestion = false;
          if (shape.props.suggestionGeneration === undefined) shape.props.suggestionGeneration = undefined;
          if (shape.props.hideResponse === undefined) shape.props.hideResponse = false;
          return shape;
        },
        down: (shape: any): any => {
          const { parentId, isSuggestion, suggestionGeneration, hideResponse, ...props } = shape.props;
          return { ...shape, props };
        },
      },
    },
  };

  getDefaultProps(): ChatShape["props"] {
    return {
      w: 300,
      h: 250,
      prompt: "",
      response: "",
      branchType: "normal",
      dateCreated: Date.now(),
      promptHeight: 40,
      isEditing: false,
      color: "black",
      dash: "draw",
      // Default values for optional props
      parentId: undefined,
      isSuggestion: false,
      suggestionGeneration: 0,
      hideResponse: false,
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