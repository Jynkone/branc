import { StateNode } from "tldraw";

// chatTool remains named as such for testing.
// It creates a new "chat" shape at the current page point.
// (Our updated ChatShape component now functions as a chat node.)
export class chatTool extends StateNode {
  static override id = "chat";

  // When the tool is activated, set the cursor to a crosshair.
  override onEnter = () => {
    this.editor.setCursor({ type: "cross", rotation: 0 });
  };

  // On pointer down, create a new "chat" shape.
  // The new shape will use our updated ChatShape component logic.
  override onPointerDown = () => {
    const { currentPagePoint } = this.editor.inputs;
    this.editor.createShape({
      type: "chat",
      x: currentPagePoint.x,
      y: currentPagePoint.y,
    });
    // After creating the shape, switch back to the select tool.
    this.editor.setCurrentTool("select");
  };

  // If the tool is canceled, revert to the select tool.
  override onCancel = () => {
    this.editor.setCurrentTool("select");
  };
}
