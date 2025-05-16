// lib/organicLayoutManager.ts – v16 🌿 collision-fixed organic layout

import {
  forceSimulation,
  forceManyBody,
  forceLink,
  forceCollide,
  forceRadial,
} from 'd3-force';
import { Editor } from 'tldraw';
import { TLShapeId } from '@tldraw/tlschema';
import { ChatShape } from '@/components/chatshape/ChatShapeTypes';

const config = {
  nodeGap: 60,
  bubbleRadius: 700,
  repulsion: -200,
  linkDistance: 180,
  velocityDecay: 0.9,
  alphaDecay: 0.05,
  ticks: 180,
  tweenDuration: 0.35,
  suggestionRadius: 220,
};

type Pos = { x: number; y: number };
interface NodeDef { id: TLShapeId; width: number; height: number; seed: Pos; }
interface Node    extends NodeDef { x: number; y: number; fx?: number; fy?: number; }

// cubic ease-in-out
function easeCubic(t: number) {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// tween only chat-shapes
function tweenChats(editor: Editor, targets: Record<TLShapeId, Pos>) {
  const start = performance.now();
  function frame(now: number) {
    const t = Math.min(1, (now - start) / (config.tweenDuration * 1000));
    const k = easeCubic(t);
    editor.batch(() => {
      for (const [id, { x: tx, y: ty }] of Object.entries(targets)) {
        const s = editor.getShape(id as TLShapeId) as ChatShape | undefined;
        if (!s) continue;
        const nx = s.x + (tx - s.x) * k;
        const ny = s.y + (ty - s.y) * k;
        editor.updateShape({ id, type: 'chat', x: nx, y: ny } as any);
      }
    });
    if (t < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// off-screen physics solve + tween
function solveAndTween(
  editor: Editor,
  parentId: TLShapeId,
  newDefs: NodeDef[],
  suggestionMode = false
): Pos[] {
  // 1) Gather existing chat-shapes
  const shapes = editor
    .getCurrentPageShapes()
    .filter((s): s is ChatShape => (s as any).type === 'chat');
  const parent = shapes.find((s) => s.id === parentId);
  if (!parent) return newDefs.map((nd) => nd.seed);

  const px = parent.x + parent.props.w / 2;
  const py = parent.y + parent.props.h / 2;

  // 2) Build nodes & links
  const nodes: Node[] = [];
  const links: { source: TLShapeId; target: TLShapeId }[] = [];

  for (const s of shapes) {
    const cx = s.x + s.props.w / 2;
    const cy = s.y + s.props.h / 2;
    const n: Node = {
      id: s.id,
      width: s.props.w,
      height: s.props.h,
      seed: { x: 0, y: 0 },
      x: cx,
      y: cy,
    };
    // pin only if outside bubble radius
    if ((cx - px) ** 2 + (cy - py) ** 2 > config.bubbleRadius ** 2) {
      n.fx = cx;
      n.fy = cy;
    }
    nodes.push(n);
    const p = (s.props as any).parentId as TLShapeId | undefined;
    if (p) links.push({ source: p, target: s.id });
  }

  // new nodes
  for (const nd of newDefs) {
    const x = nd.seed.x + nd.width / 2;
    const y = nd.seed.y + nd.height / 2;
    nodes.push({ ...nd, x, y });
    links.push({ source: parentId, target: nd.id });
  }

  // 3) Configure simulation
  const sim = forceSimulation(nodes as any)
    .alpha(1)
    .alphaDecay(config.alphaDecay)
    .velocityDecay(config.velocityDecay)
    .force('charge', forceManyBody().strength(config.repulsion))
    .force(
      'link',
      forceLink(links as any)
        .id((d: any) => d.id)
        .distance(config.linkDistance)
    )
    .force(
      'collide',
      forceCollide((d: any) =>
        Math.hypot(d.width, d.height) / 2 + config.nodeGap
      ).iterations(4)
    )
    .stop();

  if (suggestionMode) {
    sim.force(
      'radial',
      forceRadial(config.suggestionRadius, px, py).strength(0.4)
    );
  }

  // 4) Run off-screen ticks
  for (let i = 0; i < config.ticks; i++) sim.tick();

  // 5) Collect targets
  const targets: Record<TLShapeId, Pos> = {};
  for (const n of nodes) {
    targets[n.id] = {
      x: n.x - n.width / 2,
      y: n.y - n.height / 2,
    };
  }

  // 6) Tween chat-shapes only
  tweenChats(editor, targets);

  // return positions for the new nodes
  return newDefs.map((nd) => targets[nd.id]);
}

// public API – standard placement
export function placeStandard(
  editor: Editor,
  parentId: TLShapeId,
  boxType: 'standard' | 'suggestion' = 'standard'
): Pos {
  const parent = editor.getShape(parentId) as ChatShape;
  const w = boxType === 'suggestion' ? 160 : 200;
  const h = boxType === 'suggestion' ? 60 : 120;
  const seed: Pos = {
    x: parent.x + parent.props.w + config.nodeGap * (0.9 + Math.random() * 0.2),
    y: parent.y + (Math.random() - 0.5) * config.nodeGap,
  };
  return solveAndTween(
    editor,
    parentId,
    [{ id: '__temp__' as TLShapeId, width: w, height: h, seed }],
    false
  )[0];
}

// public API – suggestion fan
export function placeSuggestions(
  editor: Editor,
  parentId: TLShapeId,
  suggestionIds: TLShapeId[]
) {
  const parent = editor.getShape(parentId) as ChatShape;
  const base = -Math.PI / 2;
  const slice = (2 * Math.PI) / suggestionIds.length;
  const w = 160, h = 60;

  const defs: NodeDef[] = suggestionIds.map((id, i) => ({
    id,
    width: w,
    height: h,
    seed: {
      x:
        parent.x +
        parent.props.w / 2 +
        Math.cos(base + slice * i) * config.suggestionRadius -
        w / 2,
      y:
        parent.y +
        parent.props.h / 2 +
        Math.sin(base + slice * i) * config.suggestionRadius -
        h / 2,
    },
  }));

  // batch-init positions just under parent
  editor.batch(() => {
    for (const d of defs) {
      editor.updateShape({ id: d.id, type: 'chat', x: d.seed.x, y: d.seed.y } as any);
    }
  });

  // one unified solve + tween with collisions
  solveAndTween(editor, parentId, defs, true);
}
