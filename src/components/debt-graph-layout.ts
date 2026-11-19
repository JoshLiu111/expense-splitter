import type { DebtEdge } from "@/domain";

/** The graph's viewBox is SIZE × SIZE; everything below is in its units. */
export const SIZE = 400;
const CENTER = { x: SIZE / 2, y: SIZE / 2 };
const RING = 120;
export const NODE = 22;
/** How far an arrow bows to the payer's right, as a share of its length. */
const BEND = 0.12;
/** Where along its arrow a label may sit, most preferred first. */
const LABEL_SPOTS = [0.5, 0.42, 0.58, 0.34, 0.66, 0.26, 0.74, 0.2, 0.8];

export interface Point {
  x: number;
  y: number;
}

/** An axis-aligned box by its centre. */
export interface Box {
  cx: number;
  cy: number;
  w: number;
  h: number;
}

export interface NodeLayout extends Point {
  id: string;
  /** First name, shown beside the avatar. */
  name: string;
  nameAt: Point;
  nameAnchor: "start" | "middle" | "end";
  nameBox: Box;
}

export interface EdgeLayout {
  edge: DebtEdge;
  /** An SVG path from just outside the payer to just outside the recipient. */
  path: string;
  length: number;
  labelAt: Point;
  labelBox: Box;
}

export interface GraphLayout {
  /** Rendered font sizes in viewBox units, so text is never under its px size on screen. */
  fontSize: { label: number; name: number; initials: number };
  nodes: NodeLayout[];
  before: EdgeLayout[];
  after: EdgeLayout[];
}

/**
 * Lays out the "Why these payments?" graph. Members sit on a ring by
 * Balance: those owed the most from just left of the top down the left
 * side, those who owe the most coming back up the right, so the
 * Suggested Settlements mostly run right to left. Arrows bow slightly to
 * the payer's right, and each label slides along its arrow to the first
 * spot clear of avatars, names and earlier labels, and as far as it can
 * get from other arrows, so it reads as its own arrow's.
 *
 * `scale` is the graph's rendered width over SIZE; below 1, text grows in
 * viewBox units so it keeps its size on screen.
 */
export function layoutDebtGraph({
  members,
  balanceOf,
  before,
  after,
  label,
  scale,
}: {
  /** Members to show, in Group order. */
  members: { id: string; name: string }[];
  balanceOf: (memberId: string) => number;
  before: DebtEdge[];
  after: DebtEdge[];
  label: (edge: DebtEdge) => string;
  scale: number;
}): GraphLayout {
  const grow = 1 / Math.min(scale > 0 ? scale : 1, 1);
  const fontSize = { label: 11 * grow, name: 13 * grow, initials: 13 * grow };

  const ordered = members
    .map((member, i) => ({ member, i }))
    .sort((a, b) => balanceOf(b.member.id) - balanceOf(a.member.id) || a.i - b.i)
    .map(({ member }) => member);
  const nodes = ordered.map((member, i): NodeLayout => {
    const angle = -Math.PI / 2 - Math.PI / ordered.length - (2 * Math.PI * i) / ordered.length;
    const outward = { x: Math.cos(angle), y: Math.sin(angle) };
    const at = { x: CENTER.x + RING * outward.x, y: CENTER.y + RING * outward.y };
    const name = member.name.split(/\s+/)[0];
    const nameAt = { x: at.x + outward.x * (NODE + 10), y: at.y + outward.y * (NODE + 10) };
    const nameAnchor = Math.abs(outward.x) < 0.3 ? "middle" : outward.x > 0 ? "start" : "end";
    const w = textWidth(name, fontSize.name, 0.6);
    const left = nameAnchor === "start" ? nameAt.x : nameAnchor === "end" ? nameAt.x - w : nameAt.x - w / 2;
    return {
      id: member.id,
      name,
      x: at.x,
      y: at.y,
      nameAt,
      nameAnchor,
      nameBox: { cx: left + w / 2, cy: nameAt.y, w, h: fontSize.name * 1.25 },
    };
  });

  const position = new Map(nodes.map((n) => [n.id, n]));
  const obstacles: Box[] = nodes.flatMap((n) => [
    { cx: n.x, cy: n.y, w: (NODE + 2) * 2, h: (NODE + 2) * 2 },
    n.nameBox,
  ]);
  const edges = (list: DebtEdge[]) => {
    // Labels are placed independently for Before and After: only one set shows at a time.
    const placed: Box[] = [];
    const curves = list.map((edge) => curveBetween(position.get(edge.fromId)!, position.get(edge.toId)!));
    const tracks = curves.map((curve) => Array.from({ length: 41 }, (_, i) => pointOn(curve, i / 40)));
    return list.map((edge, index): EdgeLayout => {
      const curve = curves[index];
      const otherTracks = tracks.filter((_, i) => i !== index).flat();
      const w = textWidth(label(edge), fontSize.label, 0.6) + 4;
      const h = fontSize.label * 1.25;
      let best: Box | undefined;
      let bestCost = Infinity;
      for (const t of LABEL_SPOTS) {
        const p = pointOn(curve, t);
        const box = { cx: p.x, cy: p.y, w, h };
        // Collisions rule a spot out; crossing other arrows only makes it worse.
        const collisions = [...obstacles, ...placed].reduce((sum, o) => sum + overlap(box, o), 0);
        const crossings = otherTracks.filter((p) => overlap(box, { cx: p.x, cy: p.y, w: 0.01, h: 0.01 }) > 0).length;
        const cost = collisions * 1000 + crossings;
        if (cost < bestCost) {
          best = box;
          bestCost = cost;
        }
        if (cost === 0) break;
      }
      placed.push(best!);
      return {
        edge,
        path: `M ${curve.start.x} ${curve.start.y} Q ${curve.control.x} ${curve.control.y} ${curve.end.x} ${curve.end.y}`,
        length: curveLength(curve),
        labelAt: { x: best!.cx, y: best!.cy },
        labelBox: best!,
      };
    });
  };

  return { fontSize, nodes, before: edges(before), after: edges(after) };
}

/** Area two boxes share; 0 when they don't touch. */
export function overlap(a: Box, b: Box): number {
  const x = Math.min(a.cx + a.w / 2, b.cx + b.w / 2) - Math.max(a.cx - a.w / 2, b.cx - b.w / 2);
  const y = Math.min(a.cy + a.h / 2, b.cy + b.h / 2) - Math.max(a.cy - a.h / 2, b.cy - b.h / 2);
  return x > 0 && y > 0 ? x * y : 0;
}

/** A generous width: `em` is the average advance per character, in ems. */
function textWidth(text: string, fontSize: number, em: number): number {
  return text.length * fontSize * em;
}

interface Curve {
  start: Point;
  control: Point;
  end: Point;
}

function curveBetween(from: Point, to: Point): Curve {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  // On screen (y down), (-dy, dx) points to the right of travel.
  const control = {
    x: (from.x + to.x) / 2 - (dy / distance) * BEND * distance,
    y: (from.y + to.y) / 2 + (dx / distance) * BEND * distance,
  };
  const towards = (a: Point, b: Point, by: number) => {
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    return { x: a.x + ((b.x - a.x) / d) * by, y: a.y + ((b.y - a.y) / d) * by };
  };
  // Clear of the payer's avatar, and of the recipient's with room for the arrowhead.
  return { start: towards(from, control, NODE + 3), control, end: towards(to, control, NODE + 6) };
}

function pointOn({ start, control, end }: Curve, t: number): Point {
  const a = (1 - t) ** 2;
  const b = 2 * (1 - t) * t;
  const c = t ** 2;
  return { x: a * start.x + b * control.x + c * end.x, y: a * start.y + b * control.y + c * end.y };
}

function curveLength(curve: Curve): number {
  let length = 0;
  let previous = curve.start;
  for (let i = 1; i <= 24; i++) {
    const p = pointOn(curve, i / 24);
    length += Math.hypot(p.x - previous.x, p.y - previous.y);
    previous = p;
  }
  return length;
}
