// Import what's actually available
import { DefaultColorStyle, DefaultDashStyle } from '@tldraw/tlschema'

// Define the schema in the simplest way possible that will work with most tldraw versions
export const chatShapeSchema = {
  // Use any existing validators from the tlschema package
  props: {
    w: { type: 'number', validate: (v: any) => typeof v === 'number' },
    h: { type: 'number', validate: (v: any) => typeof v === 'number' },
    prompt: { type: 'string', validate: (v: any) => typeof v === 'string' },
    response: { type: 'string', validate: (v: any) => typeof v === 'string' },
    branchType: { type: 'string', validate: (v: any) => typeof v === 'string' },
    dateCreated: { type: 'number', validate: (v: any) => typeof v === 'number' },
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