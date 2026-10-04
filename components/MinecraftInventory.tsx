"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { recipes, materials, type GameState, type Material, type RecipeId } from "@/lib/ninja-game";
import { drawInventoryCharacter } from "@/lib/ninja-render";
import Icon from "./PixelIcon";

export function GameItem({ item }: { item: string }) { return <img className="mc-item pixel-art" src={`/art/game-items/${item}.png`} width={32} height={32} alt="" />; }
const labels: Record<string, string> = { wood: "Oak planks", stone: "Cobblestone", herb: "Herbs", ore: "Iron ore", medicine: "Field medicine", trail: "Trail pavers", brick: "Kiln bricks", bridge: "Bridges", fence: "Fences", lantern: "Lanterns", campfire: "Campfires", garden: "Herb seeds" };
export default function MinecraftInventory({ world, creative, material, selectMaterial, make, children }: { children: ReactNode; world: GameState; creative: boolean; material: Material; selectMaterial: (material: Material) => void; make: (id: RecipeId) => void }) {
  const portrait = useRef<HTMLCanvasElement>(null), [recipeIndex, setRecipeIndex] = useState(0), [page, setPage] = useState(0);
  useEffect(() => {
    const image = new Image(); image.onload = () => { const ctx = portrait.current?.getContext("2d"); if (ctx) drawInventoryCharacter(ctx, image); }; image.src = "/art/psymariux-skin.png";
    return () => { image.onload = null; };
  }, []);
  const stock = (item: string) => item === "wood" ? world.wood : item === "stone" ? world.stone : world.inventory[item as keyof typeof world.inventory];
  const stacks: { item: string; count: number }[] = [];
  for (const item of Object.keys(labels)) {
    if (creative && materials.includes(item as Material)) stacks.push({ item, count: Infinity });
    else for (let n = stock(item); n > 0; n -= 64) stacks.push({ item, count: Math.min(64, n) });
  }
  const pages = Math.max(1, Math.ceil(stacks.length / 27)), pageIndex = Math.min(page, pages - 1), shown = stacks.slice(pageIndex * 27, (pageIndex + 1) * 27);
  const recipe = recipes[recipeIndex], owned = (recipe.id === "armor" || recipe.id === "kunai") && world.upgrades.includes(recipe.id), enough = Object.entries(recipe.cost).every(([item, count]) => stock(item) >= count);
  return <div className="mc-inventory-window">
    <div className="mc-inventory-top"><div className="mc-paperdoll"><div className="mc-armor-column"><span className="mc-slot mc-armor-slot" data-equipped={world.upgrades.includes("armor")} role="img" aria-label={world.upgrades.includes("armor") ? "Shinobi armor equipped" : "No armor upgrade"} title={world.upgrades.includes("armor") ? "Shinobi armor equipped" : "No armor upgrade"}><GameItem item="armor" /></span><span className="mc-slot" role="img" aria-label={world.upgrades.includes("kunai") ? "Tempered kunai equipped" : "Starter kunai equipped"}><GameItem item="kunai" /></span></div><canvas ref={portrait} width={96} height={120} role="img" aria-label="Your Minecraft character" /></div>
      <section className="mc-crafting" aria-labelledby="craft-heading"><h4 id="craft-heading">Crafting</h4><div className="mc-crafting-row"><div className="mc-crafting-grid" role="group" aria-label="Recipe ingredients">{Array.from({ length: 9 }, (_, i) => { const ingredient = Object.entries(recipe.cost)[i]; return <span key={i} className="mc-slot" role="img" aria-label={ingredient ? `${ingredient[1]} ${labels[ingredient[0]]} required` : "Empty ingredient slot"} title={ingredient ? `${ingredient[1]} ${labels[ingredient[0]]}` : "Empty ingredient slot"}>{ingredient && <><GameItem item={ingredient[0]} /><b className="mc-count">{ingredient[1]}</b></>}</span>; })}</div><span className="mc-craft-arrow" aria-hidden="true"><Icon name="arrow-right" /></span><button className="mc-slot mc-craft-output" disabled={owned || !enough} onClick={() => make(recipe.id)} aria-label={`Craft ${recipe.name}`} title={owned ? "Already equipped" : enough ? `Craft ${recipe.name}` : "Gather the required ingredients"}><GameItem item={recipe.id} /><b className="mc-count">{recipe.amount}</b></button></div><p className="mc-recipe-name">{recipe.name}{owned ? " · equipped" : ""}</p></section></div>
    <div className="mc-recipe-book" role="group" aria-label="Choose a crafting recipe">{recipes.map((r, i) => <button key={r.id} className="mc-slot" aria-label={r.name} aria-pressed={recipeIndex === i} title={r.name} onClick={() => setRecipeIndex(i)}><GameItem item={r.id} /></button>)}</div>
    <p className="mc-recipe-note">{recipe.note} Select the output slot to craft.</p>
    <div className="mc-inventory-heading"><h4>{creative ? "Creative inventory" : "Inventory"}</h4>{pages > 1 && <div className="mc-pages"><button className="dream-button" disabled={pageIndex === 0} onClick={() => setPage(pageIndex - 1)} aria-label="Previous inventory page"><Icon name="arrow-right" className="mc-arrow-back" /></button><span>{pageIndex + 1} / {pages}</span><button className="dream-button" disabled={pageIndex >= pages - 1} onClick={() => setPage(pageIndex + 1)} aria-label="Next inventory page"><Icon name="arrow-right" /></button></div>}</div>
    <div className="mc-storage-grid" role="group" aria-label="Inventory item slots">{Array.from({ length: 27 }, (_, i) => { const stack = shown[i], canBuild = stack && materials.includes(stack.item as Material); return <button className="mc-slot" key={i} disabled={!canBuild} aria-pressed={canBuild ? stack.item === material : undefined} aria-label={stack ? `${labels[stack.item]}: ${Number.isFinite(stack.count) ? stack.count : "unlimited"}${canBuild ? ". Select for building" : ""}` : `Empty inventory slot ${i + 1}`} title={stack ? labels[stack.item] : "Empty slot"} onClick={() => { if (canBuild) selectMaterial(stack.item as Material); }}>{stack && <><GameItem item={stack.item} /><b className="mc-count">{Number.isFinite(stack.count) ? stack.count : "∞"}</b></>}</button>; })}</div>
    {children}
    <div className="mc-block-palette" role="group" aria-label="Building blocks">{materials.map(item => <button key={item} className="mc-slot" aria-pressed={material === item} onClick={() => selectMaterial(item)} aria-label={`Build with ${labels[item]}`} title={`${labels[item]} · ${creative ? "unlimited" : stock(item)}`}><GameItem item={item} /><b className="mc-count">{creative ? "∞" : stock(item)}</b></button>)}</div>
    <p className="mc-recipe-note">Choose a block, close the inventory, then right-click or press Q to place. X recovers blocks.</p>
  </div>;
}
