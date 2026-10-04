import { camp, npcs, shrines, houses, tileAt, bossAwake, region, allEnemies, nearbyCamp, daylight, type GameState } from "./ninja-game.ts";
import { skinFaces } from "./skin-uv.ts";
import { spriteMotion, type SpriteMotion } from "./ninja-motion.ts";
import { CHUNK_SIZE, biomeAt, villageTile, worldChunk, pointKey, type Biome } from "./ninja-world.ts";

const biomeColors: Record<Biome, string> = { meadow: "#71b879", forest: "#63a879", marsh: "#7aaf98", dunes: "#d8b978", frost: "#cad9d5" };
const mapColors = ["#71b879", "#e1c58b", "#487eb0", "#387858", "#8292a6", "#b88557", "#8292a6", "#b88557", "#e7a5b8", "#d8b978", "#9f7d97", "#9686b2", "#aec779", "#b88557", "#f5cb86", "#b88557", "#f5a665", "#9bcb76", "#ebc570", "#cad9d5", "#94cbd5", "#80664c", "#86ae6d", "#c6ad79", "#a96358"];

const palette = { ink: "#24364a", grass: "#71b879", deep: "#387858", light: "#b5d982", path: "#e1c58b", water: "#487eb0", wave: "#8bbdd0", stone: "#8292a6", violet: "#9686b2", wood: "#b88557", cream: "#f6e4b3" };
let eyes: HTMLCanvasElement[] | undefined;
// A 48px, hard-edged sprite atlas: no antialiased vector eye stretched over the face.
export function sharingan(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, angle = 0) {
  eyes ??= Array.from({ length: 24 }, (_, frame) => {
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 48;
    const target = canvas.getContext("2d")!;
    for (let py = 0; py < 48; py++) for (let px = 0; px < 48; px++) {
      const dx = (px - 23.5) / 23, dy = (py - 23.5) / 23, r = Math.hypot(dx, dy);
      if (r > 1) continue;
      const theta = Math.atan2(dy, dx) - frame * Math.PI * 2 / 24;
      const blade = r < .93 && Math.cos(3 * (theta + r * 1.8)) > .45;
      target.fillStyle = r > .91 || (r > .73 && r < .78) || r < .15 || blade ? "#241d2e" : r < .7 ? "#e24f57" : "#a72f48";
      target.fillRect(px, py, 1, 1);
    }
    return canvas;
  });
  const frame = ((Math.floor(angle / (Math.PI * 2) * 24) % 24) + 24) % 24;
  ctx.drawImage(eyes[frame], Math.round(x - radius), Math.round(y - radius), Math.round(radius * 2), Math.round(radius * 2));
}
// Verified front-face pupils: atlas (9,10) and (14,10), relative to (8,8).
// Keep the neighboring white sclera untouched at every zoom.
export const skinEyes = [{ x: 1.5, y: 2.5 }, { x: 6.5, y: 2.5 }] as const;
export function awakenEyes(ctx: CanvasRenderingContext2D, left: number, top: number, pixel: number, angle = 0) {
  skinEyes.forEach(eye => sharingan(ctx, left + eye.x * pixel, top + eye.y * pixel, pixel / 2, angle));
}
export function player(ctx: CanvasRenderingContext2D, skin: HTMLImageElement, x: number, y: number, scale = 1, stride = 0) {
  ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.scale(scale, scale);
  if (skin.complete && skin.naturalWidth) {
    ctx.drawImage(skin, 8, 8, 8, 8, -4, -16, 8, 8);
    ctx.drawImage(skin, 20, 20, 8, 12, -4, -8, 8, 8);
    ctx.drawImage(skin, 44, 20, 4, 12, -7, -7 + stride, 3, 7);
    ctx.drawImage(skin, 36, 52, 4, 12, 4, -7 - stride, 3, 7);
    ctx.drawImage(skin, 4, 20, 4, 12, -4, stride, 4, 5);
    ctx.drawImage(skin, 20, 52, 4, 12, 0, -stride, 4, 5);
  } else { ctx.fillStyle = "#79cde8"; ctx.fillRect(-4, -16, 8, 20); }
  ctx.restore();
}
function box(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, w: number, h: number) { ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), w, h); }
function text(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, color = palette.cream, size = 8) {
  ctx.fillStyle = color; ctx.font = `${size}px monospace`; ctx.textAlign = "left"; ctx.fillText(value, x, y);
}
function gamePlayer(ctx: CanvasRenderingContext2D, skin: HTMLImageElement, x: number, y: number, facing: number[], stride: number, reach: number) {
  if (!skin.complete || !skin.naturalWidth) { player(ctx, skin, x, y - 4); return; }
  const face = facing[1] < 0 ? 5 : facing[0] > 0 ? 1 : facing[0] < 0 ? 0 : 4, side = face < 2, reverse = face === 5 ? -1 : 1;
  function slice(cx: number, top: number, w: number, h: number, d: number, u: number, v: number, ou: number, ov: number) {
    const width = side ? d : w, left = Math.round(x + cx - width / 2), ty = Math.round(y + top);
    box(ctx, palette.ink, left - 1, ty - 1, width + 2, h + 2);
    for (const [su, sv] of [[u, v], [ou, ov]]) { const [sx, sy, sw, sh] = skinFaces(su, sv, w, h, d)[face]; ctx.drawImage(skin, sx, sy, sw, sh, left, ty, width, h); }
  }
  // Full classic 8:12:12 proportions; no stretched torso, face or cuff pixels.
  slice(-2 * reverse, -12 + stride, 4, 12, 4, 0, 16, 0, 32); slice(2 * reverse, -12 - stride, 4, 12, 4, 16, 48, 0, 48);
  if (side) slice(-facing[0], -24 - stride, 4, 12, 4, facing[0] > 0 ? 32 : 40, facing[0] > 0 ? 48 : 16, facing[0] > 0 ? 48 : 40, facing[0] > 0 ? 48 : 32);
  slice(0, -24, 8, 12, 4, 16, 16, 16, 32);
  if (side) slice(facing[0] * (1 + reach), -24 + stride - reach, 4, 12, 4, facing[0] > 0 ? 40 : 32, facing[0] > 0 ? 16 : 48, facing[0] > 0 ? 40 : 48, facing[0] > 0 ? 32 : 48);
  else { slice(-6 * reverse, -24 - stride - reach, 4, 12, 4, 40, 16, 40, 32); slice(6 * reverse, -24 + stride, 4, 12, 4, 32, 48, 48, 48); }
  slice(0, -32, 8, 8, 8, 0, 0, 32, 0);
}
export function drawInventoryCharacter(ctx: CanvasRenderingContext2D, skin: HTMLImageElement) {
  ctx.clearRect(0, 0, 96, 120); ctx.save(); ctx.imageSmoothingEnabled = false; ctx.scale(3, 3); gamePlayer(ctx, skin, 16, 36, [0, 1], 0, 0); ctx.restore();
}
function person(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, style = "supplies", stride = 0, facing: number[] = [0, 1]) {
  const back = facing[1] < 0, side = facing[0] !== 0, skin = style === "builder" ? "#d7a178" : "#eac29a";
  box(ctx, "#35605b", x + 2, y + 12, 12, 3);
  box(ctx, palette.ink, x + 3, y + 3 + stride, 5, 12); box(ctx, palette.ink, x + 8, y + 3 - stride, 5, 12);
  box(ctx, "#42516c", x + 4, y + 4 + stride, 3, 9); box(ctx, "#56657b", x + 9, y + 4 - stride, 3, 9);
  box(ctx, "#27384a", x + 3, y + 13 + stride, 5, 2); box(ctx, "#27384a", x + 8, y + 13 - stride, 5, 2);
  box(ctx, palette.ink, x + 3, y - 10, 10, 16); box(ctx, color, x + 4, y - 9, 8, 13);
  box(ctx, "#f0d5a0", x + 4, y + 1, 8, 2); box(ctx, "#4b4257", x + 4, y + 3, 8, 2);
  box(ctx, palette.ink, x, y - 8 - stride, 4, 12); box(ctx, color, x + 1, y - 7 - stride, 2, 7); box(ctx, skin, x + 1, y - stride, 2, 3);
  box(ctx, palette.ink, x + 12, y - 8 + stride, 4, 12); box(ctx, color, x + 13, y - 7 + stride, 2, 7); box(ctx, skin, x + 13, y + stride, 2, 3);
  box(ctx, palette.ink, x + 3, y - 19, 10, 10); box(ctx, back ? "#55434a" : skin, x + 4, y - 18, 8, 8);
  box(ctx, "#57454c", x + 4, y - 18, 8, 3);
  if (!back) { if (side) box(ctx, palette.ink, x + (facing[0] > 0 ? 10 : 5), y - 14, 1, 1); else { box(ctx, palette.ink, x + 5, y - 14, 1, 1); box(ctx, palette.ink, x + 10, y - 14, 1, 1); } box(ctx, "#b88377", x + 7, y - 11, 2, 1); }
  if (style === "supplies") { box(ctx, "#78556f", x + 2, y - 20, 12, 3); box(ctx, "#efd49f", x + 4, y - 21, 8, 2); box(ctx, "#ecc98e", x + 10, y - 3, 3, 5); }
  else if (style === "builder") { box(ctx, "#8c694b", x + 4, y - 8, 8, 11); box(ctx, "#e2bc78", x + 5, y - 7, 6, 1); box(ctx, "#8293a5", x + 12, y - 1, 3, 2); box(ctx, "#b88557", x + 13, y + 1, 1, 4); }
  else if (style === "herbalist") { box(ctx, "#387b62", x + 3, y - 19, 10, 4); box(ctx, "#2b5b50", x + (facing[0] > 0 ? 2 : 11), y - 16, 3, 8); box(ctx, "#98c980", x + 11, y - 1, 3, 4); box(ctx, "#c1df91", x + 12, y - 3, 2, 3); }
  else { box(ctx, palette.stone, x + 3, y - 17, 10, 2); if (!back) box(ctx, palette.ink, x + 5, y - 11, 6, 2); box(ctx, "#e8bb94", x + 4, y - 8, 8, 2); }
  if (style === "rogue") { box(ctx, "#ac697b", x + 12, y - 8, 4, 2); box(ctx, "#ac697b", x + 14, y - 6, 3, 3); }
  if (style === "archer") { box(ctx, "#664e42", x + 11, y - 12, 4, 11); box(ctx, "#ddd2a8", x + 12, y - 14, 1, 4); box(ctx, palette.wood, x + 15, y - 6, 2, 13); box(ctx, palette.cream, x + 17, y - 4, 1, 9); }
  if (style === "guard") { box(ctx, "#a5b4bd", x + 2, y - 10, 5, 4); box(ctx, "#a5b4bd", x + 10, y - 10, 5, 4); box(ctx, "#62728e", x + 5, y - 6, 6, 6); box(ctx, "#c4cfca", x + 5, y - 17, 6, 2); }
}
function decoration(ctx: CanvasRenderingContext2D, tile: number, x: number, y: number, biome: Biome = "meadow") {
  if (tile === 3) {
    box(ctx, "#3d6952", x, y + 11, 16, 4); box(ctx, "#70513e", x + 6, y + 2, 4, 13); box(ctx, "#c79a59", x + 7, y + 3, 1, 9);
    box(ctx, "#285248", x - 1, y - 10, 18, 17); box(ctx, "#285248", x + 3, y - 15, 10, 5);
    box(ctx, "#3e8158", x, y - 10, 16, 13); box(ctx, "#3e8158", x + 3, y - 14, 10, 4);
    box(ctx, "#67a569", x + 2, y - 10, 11, 5); box(ctx, "#a0ca7b", x + 4, y - 12, 6, 2);
    box(ctx, "#4b9560", x + 9, y - 3, 5, 3); box(ctx, "#284d43", x + 2, y + 3, 4, 3);
    if (biome === "frost") { box(ctx, "#e9ede0", x + 3, y - 14, 10, 3); box(ctx, "#e9ede0", x, y - 10, 12, 3); }
  } else if (tile === 4 || tile === 6 || tile === 11 || tile === 20) {
    const ruin = tile === 11;
    box(ctx, "#49566a", x + 1, y + 3, 14, 12); box(ctx, "#49566a", x + 3, y + 1, 10, 2);
    box(ctx, ruin ? palette.violet : palette.stone, x + 2, y + 3, 11, 9); box(ctx, "#c1cbd0", x + 3, y + 3, 7, 2);
    box(ctx, "#687c92", x + 10, y + 6, 3, 6); box(ctx, "#566a7c", x + 3, y + 10, 5, 2);
    if (ruin) { box(ctx, "#6e5d8b", x + 1, y + 7, 14, 1); box(ctx, "#6e5d8b", x + 7, y + 2, 1, 5); }
    else { box(ctx, "#abc781", x + 2, y + 11, 3, 2); box(ctx, "#dfc87e", x + 10, y + 3, 2, 2); }
    if (tile === 20) { box(ctx, "#92d4dc", x + 4, y + 5, 3, 3); box(ctx, "#92d4dc", x + 9, y + 9, 3, 2); }
  } else if (tile === 5) {
    box(ctx, "#654936", x, y, 16, 16); box(ctx, "#c29261", x + 1, y + 1, 13, 12);
    for (let plank = 0; plank < 3; plank++) box(ctx, "#896342", x + 1, y + 4 + plank * 4, 13, 1);
    box(ctx, "#edc485", x + 2, y + 1, 10, 1); box(ctx, "#6f503c", x + 7, y + 1, 1, 4);
  } else if (tile === 13) {
    box(ctx, "#6e4c39", x + 2, y + 2, 3, 14); box(ctx, "#6e4c39", x + 11, y + 2, 3, 14);
    box(ctx, "#c79865", x + 1, y + 5, 14, 3); box(ctx, "#c79865", x + 1, y + 10, 14, 3);
    box(ctx, "#edc485", x + 2, y + 3, 1, 11);
  } else if (tile === 14) {
    box(ctx, "#657383", x + 3, y + 11, 10, 4); box(ctx, "#8792a3", x + 6, y + 4, 4, 7);
    box(ctx, "#3c4158", x + 2, y - 2, 12, 7); box(ctx, "#e5aa68", x + 4, y, 8, 4); box(ctx, "#ffe9ad", x + 6, y, 4, 3);
    box(ctx, "#9b87ad", x + 1, y - 4, 14, 2);
  } else if (tile === 16) {
    box(ctx, "#49566a", x + 1, y + 10, 14, 5); box(ctx, "#b88557", x + 3, y + 9, 10, 3);
    box(ctx, "#e28e53", x + 4, y + 4, 8, 7); box(ctx, "#f9cb7c", x + 6, y + 2, 4, 8); box(ctx, "#ffe6a4", x + 7, y + 5, 2, 4);
  } else if (tile === 18) {
    box(ctx, "#604b40", x + 1, y + 2, 14, 13); box(ctx, "#d3a56a", x + 2, y + 3, 12, 10);
    box(ctx, "#866043", x + 2, y + 6, 12, 2); box(ctx, "#e4c378", x + 7, y + 6, 2, 4); box(ctx, "#f7dc9b", x + 3, y + 3, 10, 1);
  } else if (tile === 15) {
    box(ctx, "#70523e", x, y + 4, 16, 10); box(ctx, "#d4ae75", x, y + 2, 16, 5);
    box(ctx, "#f6d798", x + 1, y + 3, 14, 1); box(ctx, "#6d728c", x + 3, y, 7, 2); box(ctx, "#e0e5d4", x + 7, y - 1, 3, 1);
  } else if (tile === 24) {
    box(ctx, "#563f45", x, y + 1, 16, 15); box(ctx, "#a96358", x + 1, y + 2, 14, 13);
    for (let row = 0; row < 3; row++) { box(ctx, "#e0ad82", x + 1, y + 2 + row * 5, 14, 1); box(ctx, "#704b4b", x + (row % 2 ? 5 : 9), y + 3 + row * 5, 1, 4); }
    box(ctx, "#cf7d67", x + 2, y + 3, 5, 2); box(ctx, "#7d514e", x + 10, y + 9, 4, 2);
  }
}
export function drawWorld(ctx: CanvasRenderingContext2D, s: GameState, skin: HTMLImageElement, now: number, moving = false, reduced = false, freeze = 0, motions?: Map<string, SpriteMotion>, action?: { kind: string; started: number }, jumpStarted = -Infinity, peers: readonly { id: string; name: string; x: number; y: number; facing: number[] }[] = []) {
  const hero = spriteMotion(motions, "player", s.x, s.y, now, reduced);
  const alive = allEnemies(s).filter(e => e.hp), ids = new Set(["player", ...alive.map(e => e.id ?? `village:${s.enemies.indexOf(e)}`)]);
  if (motions) for (const id of motions.keys()) if (!ids.has(id)) motions.delete(id);
  const camX = hero.x - 10, camY = hero.y - 7;
  const visible = (x: number, y: number) => x >= camX - 4 && x <= camX + 22 && y >= camY - 4 && y <= camY + 16;
  const xy = (x: number, y: number) => [(x - camX) * 16, (y - camY) * 16];
  const drawables: { y: number; draw: () => void }[] = [];
  for (let row = -1; row <= 15; row++) for (let col = -1; col <= 20; col++) {
    const wx = Math.floor(camX) + col, wy = Math.floor(camY) + row, x = (wx - camX) * 16, y = (wy - camY) * 16, tile = tileAt(s, wx, wy);
    const biome = villageTile(wx, wy) ? wx < 17 && wy < 12 ? "forest" : "meadow" : biomeAt(s.world.seed, wx, wy);
    box(ctx, tile === 1 || tile === 23 ? palette.path : tile === 2 || tile === 7 ? palette.water : tile === 9 ? "#d8b978" : tile === 11 ? "#b3a19b" : tile === 19 ? biomeColors.frost : biomeColors[biome], x, y, 16, 16);
    if (tile === 19) { box(ctx, "#e8edde", x + 3, y + 7, 4, 1); box(ctx, "#a7c3c8", x + 10, y + 12, 2, 1); }
    if ((wx * 7 + wy * 11) % 3 === 0 && tile < 2) { box(ctx, tile === 1 ? "#c3a373" : "#478761", x + 3, y + 8, 1, 2); box(ctx, tile === 1 ? "#f4dca1" : palette.light, x + 4, y + 9, 2, 1); }
    if (tile === 23) { box(ctx, "#846b54", x, y, 16, 1); box(ctx, "#846b54", x, y + 15, 16, 1); box(ctx, "#efd9a2", x + 2, y + 3, 5, 2); box(ctx, "#ad8d67", x + 9, y + 9, 5, 2); box(ctx, "#725b4c", x + 7, y + 5, 2, 1); }
    if (tile === 2 || tile === 7) {
      const drift = reduced ? 0 : Math.floor(now / 500) % 3;
      box(ctx, palette.wave, x + 2 + drift, y + 5, 7, 1); box(ctx, "#6499bd", x + 7 - drift, y + 12, 6, 1);
      if (tile === 7) { box(ctx, "#705746", x, y + 1, 16, 14); for (let p = 0; p < 4; p++) { box(ctx, "#cda779", x, y + 2 + p * 3, 16, 2); box(ctx, "#e9c993", x + 1, y + 2 + p * 3, 14, 1); } }
    }
    if (tile === 8) {
      for (const [fx, fy, color] of [[3, 4, "#e9a1b5"], [10, 9, "#eed785"], [5, 12, "#beb4df"]] as const) { box(ctx, palette.deep, x + fx, y + fy + 2, 1, 3); box(ctx, color, x + fx - 1, y + fy, 3, 3); box(ctx, palette.cream, x + fx, y + fy + 1, 1, 1); }
    }
    if ([12, 17, 21, 22].includes(tile)) { box(ctx, "#886846", x + 1, y + 1, 14, 14); for (let r = 0; r < 3; r++) { box(ctx, "#574b39", x + 2, y + 3 + r * 4, 12, 1); if (tile !== 21) { box(ctx, tile === 22 ? "#afd588" : "#9ecb75", x + 4, y + (tile === 22 ? 3 : 1) + r * 4, tile === 22 ? 1 : 3, tile === 22 ? 1 : 3); box(ctx, "#579262", x + 9, y + 2 + r * 4, tile === 22 ? 1 : 3, tile === 22 ? 1 : 3); } } }
    if (tile === 9 && (wx + wy) % 3 === 0) { box(ctx, "#8e8493", x + 4, y + 8, 3, 1); box(ctx, "#d2c2ad", x + 9, y + 4, 2, 1); }
    if ([3, 4, 5, 6, 11, 13, 14, 15, 16, 18, 20, 24].includes(tile)) drawables.push({ y: wy, draw: () => decoration(ctx, tile, x, y, biome) });
    if (tile === 10) { box(ctx, "#cdb890", x, y, 16, 16); box(ctx, "#826b62", x, y + 13, 16, 3); }
  }
  for (const h of houses) {
    if (!visible(h.x, h.y)) continue;
    if (!Array.from({ length: h.w * h.h }, (_, i) => tileAt(s, h.x + i % h.w, h.y + Math.floor(i / h.w))).every(t => t === 10)) continue;
    const [x, y] = xy(h.x, h.y), w = h.w * 16;
    drawables.push({ y: h.y + h.h - 1, draw: () => {
      box(ctx, "#635366", x - 2, y - 10, w + 4, 28); box(ctx, "#916f8c", x, y - 8, w, 23);
      for (let r = 0; r < 5; r++) { box(ctx, "#bb91a0", x, y - 7 + r * 5, w, 1); for (let c = 0; c < 5; c++) box(ctx, "#6f5b79", x + c * 13 + (r % 2 ? 5 : 0), y - 6 + r * 5, 1, 4); }
      box(ctx, "#524657", x - 3, y + 14, w + 6, 4); box(ctx, "#decaa1", x + 3, y + 18, w - 6, 23);
      for (const wx of [x + 7, x + w - 18]) { box(ctx, "#765b46", wx, y + 23, 11, 11); box(ctx, "#7db8c6", wx + 2, y + 25, 7, 7); box(ctx, "#eed4a1", wx + 5, y + 25, 1, 7); box(ctx, "#eed4a1", wx + 2, y + 28, 7, 1); }
      box(ctx, "#79533e", x + w / 2 - 6, y + 26, 12, 20); box(ctx, "#c19562", x + w / 2 - 4, y + 28, 8, 18); box(ctx, "#f0dba5", x + w / 2 + 1, y + 37, 2, 2);
      box(ctx, "#796652", x, y + 43, w, 4); box(ctx, "#bca282", x + w / 2 - 9, y + 46, 18, 2);
    } });
  }
  shrines.forEach((p, i) => {
    if (!visible(p.x, p.y)) return;
    const [x, y] = xy(p.x, p.y);
    drawables.push({ y: p.y, draw: () => {
      box(ctx, "#566777", x + 1, y + 11, 14, 5); box(ctx, "#aaafb6", x + 3, y + 3, 10, 9); box(ctx, "#efe0bd", x + 2, y + 1, 12, 3);
      box(ctx, s.scrolls.includes(i) ? "#627c82" : "#f2d98d", x + 6, y + 5, 4, 7); box(ctx, "#b7795c", x + 7, y + 8, 2, 1);
      if (!s.scrolls.includes(i)) { box(ctx, "#f5e8b6", x + 7, y - 6, 2, 3); box(ctx, "#f5e8b6", x + 6, y - 5, 4, 1); }
    } });
  });
  const [cx, cy] = xy(camp.x, camp.y);
  box(ctx, "#be9b70", cx + 2, cy + 7, 12, 7); box(ctx, "#795345", cx + 3, cy + 11, 10, 2);
  box(ctx, "#e7ae62", cx + 5, cy + 5, 6, 6); box(ctx, "#fae29d", cx + 7, cy + 4 + (reduced ? 0 : Math.floor(now / 320) % 2), 2, 6);
  npcs.forEach(n => { if (!visible(n.x, n.y)) return; const [x, y] = xy(n.x, n.y); drawables.push({ y: n.y, draw: () => { person(ctx, x, y, n.color, n.id, 0, Math.abs(n.x - s.x) + Math.abs(n.y - s.y) <= 4 ? Math.abs(n.x - s.x) > Math.abs(n.y - s.y) ? [Math.sign(s.x - n.x), 0] : [0, Math.sign(s.y - n.y) || 1] : [0, 1]); if (n.id !== "builder" && !s.quests.includes(n.id)) { box(ctx, "#f8e5a3", x + 7, y - 11, 2, 4); box(ctx, "#f8e5a3", x + 7, y - 5, 2, 1); } } }); });
  alive.forEach(e => {
    const pose = spriteMotion(motions, e.id ?? `village:${s.enemies.indexOf(e)}`, e.x, e.y, now, reduced || freeze > 0, 180);
    if (!visible(e.x, e.y)) return; const [x, y] = xy(pose.x, pose.y);
    drawables.push({ y: pose.y, draw: () => {
      if (e.kind === "warden") {
        const awake = bossAwake(s, e);
        box(ctx, awake ? "#574360" : "#788291", x - 2, y - 23, 20, 38); box(ctx, awake ? "#a75e84" : "#939caa", x, y - 21, 16, 33);
        box(ctx, "#d5c3b7", x + 2, y - 19, 12, 9); box(ctx, awake ? "#ef9a91" : "#c9c9b8", x + 3, y - 16, 3, 2); box(ctx, awake ? "#ef9a91" : "#c9c9b8", x + 10, y - 16, 3, 2);
        box(ctx, "#3f384f", x + 6, y - 10, 4, 3); box(ctx, "#eed6a2", x + 1, y + 5, 14, 2); box(ctx, "#483d54", x + 1, y + 14, 5, 3); box(ctx, "#483d54", x + 10, y + 14, 5, 3);
        box(ctx, "#362e46", x - 2, y - 28, 20, 3); box(ctx, "#e9948d", x - 1, y - 27, Math.max(1, Math.round(e.hp / 18 * 18)), 1);
      } else { person(ctx, x, y, freeze > 0 ? "#80cbd1" : e.kind === "archer" ? "#a57c9f" : e.kind === "guard" ? "#778ba8" : "#af6978", e.kind, pose.walking ? Math.round(Math.sin(pose.travel * Math.PI) * 2) : 0, pose.facing); box(ctx, "#342e47", x + 3, y - 23, 10, 2); box(ctx, "#e59989", x + 3, y - 23, e.hp * (e.kind === "guard" ? 1.5 : 3), 1); }
    } });
  });
  peers.forEach(p => {
    const pose = spriteMotion(motions, `online:${p.id}`, p.x, p.y, now, reduced, 110);
    if (!visible(p.x, p.y)) return;
    const [x, y] = xy(pose.x, pose.y), color = ["#b0dcf1", "#efb58c", "#d4b5ef", "#a6dfaa", "#eedba5", "#eda6b9", "#9ce2d8", "#c8cbd8"][parseInt(p.id.slice(0, 2), 16) % 8];
    drawables.push({ y: pose.y, draw: () => { box(ctx, color, x + 2, y + 13, 12, 2); gamePlayer(ctx, skin, x + 8, y + 15, pose.facing, !reduced && pose.walking ? Math.round(Math.sin(pose.travel * Math.PI) * 2) : 0, 0); ctx.textAlign = "center"; ctx.font = "7px monospace"; ctx.fillStyle = "#171b1c"; ctx.fillRect(x + 8 - p.name.length * 2.15, y - 29, p.name.length * 4.3, 10); ctx.fillStyle = color; ctx.fillText(p.name, x + 8, y - 22); ctx.textAlign = "left"; } });
  });
  const [px, py] = xy(hero.x, hero.y), stride = !reduced && (hero.walking || !motions && moving) ? Math.round(Math.sin(motions ? hero.travel * Math.PI : now / 115) * 2) : 0;
  const jumpAge = now - jumpStarted, jumping = jumpAge >= 0 && jumpAge < 360, lift = jumping && !reduced ? Math.round(Math.sin(jumpAge / 360 * Math.PI) * 11) : 0;
  const reach = !reduced && action && now - action.started < 220 && !["heal", "recall", "scroll", "jump"].includes(action.kind) ? 3 : 0;
  drawables.push({ y: hero.y, draw: () => { const inset = jumping && !reduced ? Math.min(4, Math.round(lift / 3)) : 0; box(ctx, jumping ? "#294f47" : "#3d765e", px + 2 + inset, py + 12, 12 - inset * 2, 3); gamePlayer(ctx, skin, px + 8, py + 15 - lift, s.facing, stride, reach); if (jumping && reduced) { box(ctx, palette.cream, px + 3, py - 20, 10, 2); text(ctx, "JUMP", px - 1, py - 23, palette.cream, 6); } } });
  const [aimX, aimY] = xy(s.x + s.facing[0], s.y + s.facing[1]);
  // The ground cursor must not paint across a tall character's face.
  ctx.strokeStyle = "#f9e6b8"; ctx.lineWidth = 1; ctx.strokeRect(Math.round(aimX) + 1.5, Math.round(aimY) + 1.5, 13, 13);
  drawables.sort((a, b) => a.y - b.y).forEach(d => d.draw());
  s.projectiles.forEach(p => {
    const [x, y] = xy(p.x, p.y), color = p.kind === "fire" ? "#f9b96b" : p.kind === "lightning" ? "#b4e9ec" : p.kind === "wind" ? "#c4e4aa" : "#e4e6cc";
    box(ctx, p.hostile ? "#bd606f" : "#536976", x + 3, y + 5, 10, 6); box(ctx, color, x + 4, y + 6, 8, 4); box(ctx, palette.cream, x + 7, y + 4, 2, 8);
  });
  if (!daylight(s)) { ctx.save(); ctx.globalAlpha = .2; box(ctx, "#24364a", 0, 0, 320, 240); ctx.restore(); }
  box(ctx, "#24364a", 3, 3, 236, 14); text(ctx, `${region(s.x, s.y, s.world.seed)} ${s.x},${s.y}`, 7, 13);
  box(ctx, "#24364a", 246, 3, 71, 14); text(ctx, daylight(s) ? "Daylight" : "Moonrise", 250, 13);
  const nearby = npcs.find(n => Math.abs(n.x - s.x) + Math.abs(n.y - s.y) <= 1);
  if (nearby) { box(ctx, "#24364a", 3, 222, 190, 14); text(ctx, `F: talk to ${nearby.name}, ${nearby.role}`, 7, 232); }
  else { const target = tileAt(s, s.x + s.facing[0], s.y + s.facing[1]), own = tileAt(s, s.x, s.y); const hint = own === 17 || target === 17 ? "F: harvest herbs + seed" : target === 18 ? "F: open ruin supplies" : target === 22 || own === 22 ? "Herbs growing · F: check" : nearbyCamp(s) ? "F: rest / set camp" : [3, 4, 8, 11, 20, 24].includes(target) ? "F: gather · Q: build" : "Follow trails · Q: build"; box(ctx, "#24364a", 3, 222, 212, 14); text(ctx, hint, 7, 232); }
  if (freeze > 0) { ctx.strokeStyle = "#97dbe5"; ctx.lineWidth = 3; ctx.strokeRect(1.5, 1.5, 317, 237); sharingan(ctx, 302, 20, 12); }
}
export function drawIntro(ctx: CanvasRenderingContext2D, skin: HTMLImageElement, s: GameState, t: number, reduced: boolean) {
  box(ctx, "#1b1e20", 0, 0, 320, 240);
  if (reduced) { player(ctx, skin, 160, 153, 4); awakenEyes(ctx, 144, 89, 4); }
  else if (t < 1.15) {
    const zoom = 3 + Math.floor(t * 5) / 2;
    box(ctx, "#322f37", 116, 60, 88, 116); box(ctx, "#1b1e20", 120, 64, 80, 108);
    player(ctx, skin, 160, 155, zoom);
    if (t > .5) awakenEyes(ctx, 160 - zoom * 4, 155 - zoom * 16, zoom, t * .7);
  } else if (t < 1.9) {
    if (skin.complete && skin.naturalWidth) ctx.drawImage(skin, 8, 8, 8, 8, 64, 18, 192, 192);
    awakenEyes(ctx, 64, 18, 24, t * .7);
    box(ctx, "#1b1e20", 0, 0, 320, 18); box(ctx, "#1b1e20", 0, 177, 320, 63);
  } else if (t < 3.4) {
    const eyeY = 92;
    for (let row = -9; row <= 9; row++) {
      const width = Math.round(Math.sqrt(1 - (row / 10) ** 2) * 112 / 4) * 4;
      box(ctx, "#463040", 160 - width - 4, eyeY + row * 6 - 4, width * 2 + 8, 12);
    }
    for (let row = -9; row <= 9; row++) {
      const width = Math.round(Math.sqrt(1 - (row / 10) ** 2) * 112 / 4) * 4;
      box(ctx, "#e9d5cd", 160 - width, eyeY + row * 6, width * 2, 6);
    }
    sharingan(ctx, 160, eyeY, Math.min(54, 30 + Math.floor((t - 1.9) * 24)), (t - 1.9) * 1.6);
    box(ctx, "#f5dbd4", 143, 64, 5, 5); box(ctx, "#f5dbd4", 149, 59, 3, 3);
    box(ctx, "#5d3346", 82, 153, 6, 3); box(ctx, "#5d3346", 88, 156, 3, 9);
  } else {
    drawWorld(ctx, s, skin, t * 1000, false, false);
    const revealed = Math.min(1, (t - 3.4) / .8);
    for (let row = 0; row < 15; row++) for (let col = 0; col < 20; col++) {
      const threshold = ((col * 17 + row * 31) % 97) / 97;
      if (threshold > revealed) box(ctx, "#241f2d", col * 16, row * 16, 16, 16);
    }
    return;
  }
  ctx.textAlign = "center"; ctx.font = "22px 'Pixelify Sans', monospace"; ctx.fillStyle = "#eee1cc"; ctx.fillText("Mangekyo Sharingan", 160, 207);
  ctx.font = "9px monospace"; ctx.fillStyle = "#d89b9e"; ctx.fillText(t < 1.15 ? "THE SECOND SLEEP" : t < 1.9 ? "THE EYES AWAKEN" : "STEP THROUGH THE SEAL", 160, 227);
}
export function drawMap(ctx: CanvasRenderingContext2D, s: GameState, mode: "local" | "village" | "atlas" = "local") {
  ctx.clearRect(0, 0, 240, 192);
  const atlas = mode === "atlas", unit = atlas ? CHUNK_SIZE : 1;
  const ox = mode === "village" ? 0 : Math.floor(s.x / unit) - 20, oy = mode === "village" ? 0 : Math.floor(s.y / unit) - 16;
  for (let row = 0; row < 32; row++) for (let col = 0; col < 40; col++) {
    const x = ox + col, y = oy + row;
    if (!atlas) { box(ctx, mapColors[tileAt(s, x, y)], col * 6, row * 6, 6, 6); continue; }
    const known = s.world.explored[pointKey(x, y)];
    box(ctx, known ? biomeColors[biomeAt(s.world.seed, x * CHUNK_SIZE + 12, y * CHUNK_SIZE + 12)] : "#1c2939", col * 6, row * 6, 6, 6);
    if (known) { const feature = worldChunk(s.world.seed, x, y).feature; if (feature === "camp" || feature === "ruins") box(ctx, feature === "camp" ? "#ffb968" : "#c6b0d5", col * 6 + 2, row * 6 + 2, 2, 2); }
  }
  const marker = (x: number, y: number, color: string, size = 6) => { const mx = Math.floor(x / unit) - ox, my = Math.floor(y / unit) - oy; if (mx >= 0 && mx < 40 && my >= 0 && my < 32) box(ctx, color, mx * 6 - (size - 6) / 2, my * 6 - (size - 6) / 2, size, size); };
  if (!atlas) { shrines.forEach((p, i) => marker(p.x, p.y, s.scrolls.includes(i) ? "#657b8b" : "#fff0a5", 8)); npcs.forEach(n => marker(n.x, n.y, "#f1b5d5")); const boss = s.enemies.find(e => e.kind === "warden" && e.hp > 0); if (boss) marker(boss.x, boss.y, "#a73559", 8); }
  marker(camp.x, camp.y, "#ffb968"); marker(s.spawn.x, s.spawn.y, "#ffb968"); marker(s.x, s.y, "#253746", 8); marker(s.x, s.y, "#a7f0ff");
}
