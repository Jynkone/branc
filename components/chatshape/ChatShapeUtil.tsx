// chatshape/ChatShapeUtil.tsx
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

  // IMPORTANT: Use the proper validator objects instead of literal defaults!
  static override props = {
    w: T.number,
    h: T.number,
    prompt: T.string,
    response: T.string,
    branchType: T.string,
    dateCreated: T.number,
    color: DefaultColorStyle,
    dash: DefaultDashStyle,
  };

  static override migrations = {
    firstVersion: 0,
    currentVersion: 1,
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
      color: "black",
      dash: "draw",
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