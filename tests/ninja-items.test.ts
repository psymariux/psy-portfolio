import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { materials, recipes } from "../lib/ninja-game.ts";

test("Minecraft inventory sprites are local PNGs with verified provenance, including real non-cube models", () => {
  const root = new URL("../public/art/game-items/", import.meta.url);
  const provenance = JSON.parse(readFileSync(new URL("provenance.json", root), "utf8"));
  assert.match(provenance.rights, /Mojang\/Microsoft/);
  for (const item of new Set([...materials, ...recipes.map(r => r.id), "recover", "dash", "eye", "chakra", "recall", "herb", "ore"])) {
    const data = readFileSync(new URL(`${item}.png`, root)), entry = provenance.assets[item];
    assert.equal(data.toString("hex", 0, 8), "89504e470d0a1a0a"); assert.ok([16, 64].includes(data.readUInt32BE(16))); assert.ok([16, 64].includes(data.readUInt32BE(20)));
    assert.equal(createHash("sha256").update(data).digest("hex"), entry.sha256);
  }
  assert.equal(provenance.assets.fence.model, "oak_fence_inventory"); assert.equal(provenance.assets.bridge.model, "oak_trapdoor_bottom");
});
