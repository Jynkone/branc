import { T, DefaultColorStyle, DefaultDashStyle } from '@tldraw/tlschema'

// Define the schema for the ChatShape
export const chatShapeSchema = {
  props: {
    w: T.number,
    h: T.number,
    prompt: T.string,
    response: T.string,
    branchType: T.string,
    dateCreated: T.number,
    color: DefaultColorStyle,
    dash: DefaultDashStyle,
  },
  migrations: {
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
    }
  }
}