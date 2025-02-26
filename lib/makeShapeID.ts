// makeShapeID.ts
import { TLShapeId } from "tldraw";

export const makeShapeID = (): TLShapeId => `shape:${crypto.randomUUID()}` as TLShapeId;
