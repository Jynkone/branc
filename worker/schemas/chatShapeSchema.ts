// worker/schemas/chatShapeSchema.ts
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
    promptHeight: { type: 'number', validate: (v: any) => typeof v === 'number' },
    isEditing: { type: 'boolean', validate: (v: any) => typeof v === 'boolean' },
    parentId: { type: 'string', validate: (v: any) => v === undefined || typeof v === 'string' },
    isSuggestion: { type: 'boolean', validate: (v: any) => v === undefined || typeof v === 'boolean' },
    suggestionGeneration: { type: 'number', validate: (v: any) => v === undefined || typeof v === 'number' },
    hideResponse: { type: 'boolean', validate: (v: any) => v === undefined || typeof v === 'boolean' },
    color: DefaultColorStyle,
    dash: DefaultDashStyle,
  },
  migrations: {
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
        down: (shape: any): any => {
          const { promptHeight, isEditing, ...props } = shape.props;
          return { ...shape, props };
        }
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
        }
      }
    }
  }
}