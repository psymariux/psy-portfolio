---
name: "Psymariux Developer Workshop"
description: "A warm vanilla Minecraft workshop for exploring real public development work."
colors:
  ground: "#1c2021"
  surface: "#272c2d"
  raised: "#303536"
  stone: "#49524e"
  edge: "#56605a"
  ink: "#ede8d8"
  muted: "#bdc3b9"
  cyan: "#87d4e8"
  cyan-dark: "#254855"
  gold: "#dfbd7f"
  orange: "#e9ad75"
  wood: "#42392e"
  wood-edge: "#80684b"
  paper: "#e6dab7"
  paper-ink: "#342d21"
  paper-muted: "#5b503b"
  book-cover: "#7c6542"
  charge-spark: "#96e7ff"
  charge-core: "#efffff"
  charge-arc: "#ccf7ff"
  redstone: "#b52315"
typography:
  display:
    fontFamily: "Pixelify Sans, monospace"
    fontSize: "clamp(48px, 4.1vw, 54px)"
    fontWeight: 400
    lineHeight: 1.06
    letterSpacing: "-0.035em"
  body:
    fontFamily: "Departure Mono, monospace"
    fontSize: "16.5px"
    lineHeight: 1.65
  label:
    fontFamily: "Departure Mono, monospace"
    fontSize: "11px"
rounded:
  square: "0"
spacing:
  shell: "44px"
  section: "116px"
  control: "11px 19px"
  dialog: "29px"
components:
  button-primary:
    backgroundColor: "{colors.cyan}"
    textColor: "#173140"
    rounded: "{rounded.square}"
    padding: "{spacing.control}"
    typography: "Pixelify Sans, monospace"
    height: "47px"
  button-secondary:
    backgroundColor: "#303b3d"
    textColor: "#c6d8d9"
    rounded: "{rounded.square}"
    padding: "{spacing.control}"
    typography: "Pixelify Sans, monospace"
    height: "47px"
  station-control:
    backgroundColor: "#262929"
    textColor: "{colors.ink}"
    rounded: "{rounded.square}"
    padding: "15px 5px 19px"
  project-chest:
    backgroundColor: "#292c29"
    textColor: "{colors.ink}"
    rounded: "{rounded.square}"
  inventory-slot:
    backgroundColor: "#252b29"
    textColor: "#d0d6c3"
    rounded: "{rounded.square}"
    padding: "8px 3px"
  text-field:
    backgroundColor: "#1e2825"
    textColor: "#e4ecdc"
    rounded: "{rounded.square}"
    padding: "12px"
    height: "46px"
---

# Design System: Psymariux Developer Workshop

## Overview

**Creative North Star: "The Inhabited Voxel Workshop"**

This is a personal developer workshop, not a conventional pixel-font portfolio or a generic software dashboard. PsyMariux's verified blue Minecraft skin, monitor light, warm timber, charcoal stone, and a furnace make real public development work feel like objects in a small, lived-in base. Pixel edges and block shadows are intentional material language; readable body copy keeps the experience useful.

The system is dense enough to feel furnished but leaves the first viewport legible: a short welcome and a large open-front isometric room. The workshop’s devices are both visual landmarks and navigation: chest, crafting table, furnace, terminal, book, and mascot. The identity is Psymariux; `@psymariux` is the current GitHub identity; `nohint404` is retained only for historical author attribution.

**Key Characteristics:**
- Vanilla Java 1.21.4 block models/textures, authentic hinged entity chest and PsyMariux's verified classic skin with outer layers. Explicit user approval supersedes the initial original-art-only direction; local provenance preserves game-art ownership.
- Cyan identity light balanced by warm furnace, gold, and timber accents on a neutral-warm charcoal ground.
- Tactile square controls with hard borders and deliberate pixel/block shadows.
- Pixelify Sans display labels; Departure Mono readable pixel information/forms, explicitly selected by the user. Existing copy is unchanged.
- Accessible native controls and dialogs remain the functional counterpart to the interactive room.

## Colors

A restrained charcoal-and-stone foundation lets cool cyan identity light and warm furnace/timber accents read as physical workshop illumination rather than SaaS gradients.

### Primary
- **Mascot Cyan:** used for primary calls to action, focus outlines, the monitor, and identity highlights; reserve it for navigational confidence and interactive emphasis.
- **Deep Cyan:** provides the declared dark-cyan palette token for cool equipment surfaces; primary buttons use their observed darker ink color.

### Secondary
- **Furnace Gold:** supplies brass, embers, active-work signals, and the occasional warm sparkle.
- **Furnace Orange:** carries firelight, the warm ambient control, and flame-adjacent details.

### Tertiary
- **Workshop Timber:** furnishes wooden room elements and warm storage surfaces.
- **Timber Edge:** defines the darker wood seams and borders that make timber feel assembled.

### Neutral
- **Charcoal Ground:** the page field and scrollbar track; it is neutral-warm, never blue-black.
- **Workshop Surface:** primary dark panels and chrome.
- **Raised Surface:** lifted inventory and container planes.
- **Stone:** voxel masonry and muted structural material.
- **Hard Edge:** borders, dividers, and restrained control outlines.
- **Warm Ink:** primary text against charcoal.
- **Dusty Muted:** paragraphs and secondary metadata.

**The Furnace-and-Monitor Rule.** Use cyan and warm orange/gold as separate light sources within charcoal, stone, and wood—not as a broad gradient or a competing rainbow palette.

## Typography

**Display Font:** Pixelify Sans (with monospace fallback)

**Body Font:** Departure Mono (self-hosted SIL OFL; monospace fallback)

**Label/Mono Font:** Departure Mono for metadata; native monospace for code identifiers.

**Character:** Pixelify Sans gives titles, station names, and compact workshop chrome a block-world voice. Departure Mono carries descriptions, repository facts and form copy at 13.2–16.5px; compact metadata is 11px. Forms remain at 16.5px on mobile. The portrait and greeting are centred within the hero column.

### Hierarchy
- **Display** (400, `clamp(48px, 4.1vw, 54px)`, 1.06): hero heading; balances text and room in the first viewport.
- **Headline** (400, 38–49px, 1.06–1.12): section and contact headings in Pixelify Sans.
- **Title** (400, 22–29px, 1.2–1.3): dialog, card, inventory, terminal, and station titles; use Pixelify Sans where the object is named.
- **Body** (normal, 16.5px, 1.65): compact paragraphs 13.2–14px with increased line-height, metadata 11px; no synthetic bold.
- **Label** (normal, 11–14px): repository metadata, captions, controls, and source notes; use Departure Mono for facts and Pixelify for object names.

**The Readable-Workshop Rule.** User-approved readable pixel typography replaces the earlier Geist body direction, not the text itself. Keep clear line-height, square undistorted icons and form entry at readable sizes.

## Layout

The desktop shell is centered at a maximum width of 1280px with 44px side padding. The hero uses a 360px copy column beside a flexible room stage, with a minimum height of 680px; the room is the artifact, not a decorative card. Major sections use generous vertical intervals (for example, 116px before projects and 133px before the workbench) while internal panels stay compact and inventory-like.

The eight-object station shelf is a single horizontal grid on wide desktop, four columns on medium screens and two columns on mobile. PsyStream’s screen follows the identity station. At 767px and below, the page becomes a single-column sequence: hero copy above the 330px room, then four equal rows of labeled controls. Canvas hotspots are hidden on mobile so the stacked native buttons—not tiny scene hit areas—remain the primary controls. Project cards become one column, the workbench stacks, contact becomes vertical, and dialogs tighten to the viewport. At 1100px and below, shell padding becomes 30px and the hero columns narrow before the mobile switch.

## Elevation & Depth

Depth is structural, not soft or glassy. The physical room gets isometric 3D depth from vanilla model geometry, stone/timber planes, stepped pixel edges, and cyan/orange light. Interface surfaces remain square and layered with dark tonal steps, 1–2px borders, and hard offset shadows; hover movement is a small tactile lift or press.

### Shadow Vocabulary
- **Tactile control** (`0 4px 0 #387187, 3px 0 0 #387187, -3px 0 0 #387187`): primary cyan buttons use a blocky lower and side edge; active state compresses it to a 1px lower edge.
- **Dark object lift** (`0 5px 0 #131a1e`): station shelf and project chests sit above the ground with a hard dark base.
- **Panel frame** (`6px 6px 0 #101b1f, -3px -3px 0 #383e37`): dialogs use opposing hard offsets to read as a framed workshop panel.

**The Block-Shadow Rule.** Keep shadows crisp, offset, and material. Do not replace them with blur, glow-only depth, glassmorphism, or floating SaaS cards.

## Shapes

The form language is deliberately square: the documented radius token is `0`, with rectangular panels, inventory slots, hard corners, and stepped voxel silhouettes. Borders are usually 1–2px in muted stone, wood, or green-gray; a few controls extend their hard edges with shadow offsets. Pixel-art images use pixelated rendering and remain proportionally contained. The Italian tricolor is a sparse, small signature rather than a broad color field.

## Components

### Buttons
- **Character:** tactile workshop tools, not rounded app controls.
- **Shape:** square corners (0); the narrowly adapted Pixelact Button uses four-sided pixel shadows and a darker inset lower/right edge, without adding the upstream theme or shadcn stack.
- **Primary:** cyan background with deep-cyan text, Pixelify Sans, 11px 19px padding, and a 47px minimum height.
- **Hover / Focus:** hover brightens cyan; `:focus-visible` uses a 3px dashed cyan outline with a 6px offset; active presses down 3px and shortens the shadow.
- **Secondary / Text:** secondary pixel buttons use dark blue-green material; text buttons are unboxed cyan links with icons and underlined hover behavior.

### Cards / Containers
- **Character:** storage bays, boards, terminals, and books—not generic cards.
- **Corner Style:** square (0).
- **Background:** dark charcoal surfaces with material-specific timber, stone, or green-gray companions.
- **Shadow Strategy:** use hard dark 5–6px lifts and borders; project chests lift 3px on hover and press 2px on activation.
- **Border:** 4px stepped SVG border-image frames on major panels; native focus rings remain unclipped.
- **Internal Padding:** project content is 24px 23px 20px; dialogs use 29px; inventory boards use 19px.

### Inputs / Fields
- **Style:** dark green-charcoal field with a 1px green-gray border and 2px lower edge; square corners and 12px padding.
- **Focus:** a 2px cyan outline with a 2px offset; caret is cyan.
- **Error / Disabled:** errors are warm pale text on a brown field with a brown border; disabled controls reduce opacity and show a waiting cursor.

### Navigation
- **Style:** no conventional primary navbar. A small branded header and the eight-object shelf provide workshop navigation.
- **States:** every station is a native button with art, Pixelify title, and explanatory label; hover darkens the shelf cell and lifts its art.
- **Mobile treatment:** station controls use a two-column grid of labeled native buttons; small scene hit areas are replaced by this shelf.
- **Quick navigation:** Ctrl/Cmd+K and the header search control open one focused, charcoal search panel with real object icons and simple result rows. Arrow keys/Enter, touch and Escape are equivalent. Results search already-loaded public metadata and reuse the existing routes/panels; the shortcut is inactive inside another panel or the game.

### Interactive Voxel Room
- **Character:** the signature navigation artifact: an open-front isometric stone-and-timber room built from recognizable vanilla Minecraft blocks, chest entity, lectern and props.
- **Behavior:** WebGL adds selectable room objects after a local room preview first paint; unavailable WebGL leaves the preview usable alongside the persistent shelf. The entry assembles PsyMariux from individual SVG pixels, allows immediate skipping, and dissolves into square tiles. It lasts 1.5 seconds when ready, with a four-second fallback deadline, never fictional percentage progress. An adapted RetroUI Bubble explains object navigation and announces the current approach.
- **Motion:** the entry name is the initial focal sequence. Object clicks then take the character along the shortest obstacle-aware orthogonal route from its current position, with walking-limb clearance and limb swings and a bounded camera focus; the chest opens on arrival before its dialog appears. New clicks interrupt trips, Escape cancels, and dialogs return the actor/camera when closed. No free movement. Four one-shot scroll chapters dissolve a 96-tile overlay as chest rows, crafting checkerboard, redstone signal and book leaves; content is visible without JavaScript and focus bypasses the overlay. Dialogs use bounded stepped pixel reveals. The furnace presents one repository recipe at a time (personal commit/code input → furnace → project output), while the redstone terminal is the chronological log, defaulting to commits to avoid paired commit/PR repetition. A floor-level lamp replaces the command block stack. The character stands alongside its real vanilla lever, grips it with an articulated arm and follows the shaft during the flip, bending knees with planted feet. The free hand carries the torch upright; the activity card opens after release. Ordinary walks add modest upper-body lean and head tracking; the power state persists, hover does not energize it, and interruption restores the handle to its committed state; chest hinge, furnace warmth, steady firelight, and click particles are feedback only. Sound is opt-in and never required for navigation. About selection adds one hand-held Chidori charge before the card, with the exact user-supplied audio excerpt only when enabled. Electric movement stays in the small hand effect, not pulsing across the room. Closed chest sprites open through ten real entity frames before details; reduced motion skips these waits. Shared grid cells prevent wall/beam/shelf intersections, and the first rendered frame is ready before the preview disappears. Reduced motion disables animation, transitions, particles, flicker, hinged motion, scroll fades and camera movement; navigation is immediate.
- **Accessibility:** room hotspots are labeled buttons, but the shelf is the persistent keyboard equivalent; Radix dialogs trap focus, close with Escape, and return focus to their trigger.

### Hidden Shinobi Sandbox
The completed sequence **sleep → wake → sleep** opens a full-viewport pixel transition using PsyMariux’s real skin and a stylized three-blade Mangekyo Sharingan. It is skippable, has no strobe, and reduced motion bypasses the zoom. The overlays replace the verified pupil atlas cells (9,10) and (14,10), preserving the white sclera at every zoom. Optional local source-labeled Itachi/Sharingan excerpts replace the synthesized ritual; third-party sources and unverified reuse rights are recorded, and publishing requires permission. Pending and active audio is canceled on mute, skip or exit. Reduced motion skips the long transition and its voice cue; gameplay interaction tones remain synthesized.

The sandbox uses native Canvas 2D at 320×240. The 40×32 authored village anchors an unbounded procedural frontier: deterministic 24×24 chunks stream as the player advances in any direction, with a 64-chunk terrain LRU and only nine neighboring chunks’ enemies active. Persistent state stores edits and discoveries rather than every generated tile. A GBA-inspired palette gives Jade forest deep greens (#387858, #71b879), village paths warm gold (#e1c58b), the river blue (#487eb0), roofs/ruins dusty violet (#9686b2), and sprites dark outlines (#24364a) with cream highlights (#f6e4b3). All world sprites are original; PsyMariux retains the verified blue skin. The hero's four-directional atlas preserves the classic 8:12:12 proportions and outer skin layers. Role-specific NPC clothing, tools, ninja silhouettes and directional faces distinguish encounters. Render-only interpolation and distance-driven steps smooth real movement without changing grid combat or saves; teleports, pauses and reduced motion snap immediately. Terrain and entities are drawn in depth order. The portfolio ground remains charcoal. The game's inventory, crafting and multiplayer panels use Minecraft's gray beveled window and dark recessed slots, not navy generic menus. Locally bundled vanilla Java 1.21.4 sprites/model renders identify resources, equipment and tools. A classic skin paperdoll, numeric stacks up to 64, ingredient/output crafting and nine-slot icon hotbar establish the Minecraft inventory language. Extra stacks are paginated; phone storage adapts to five or six columns with 44px controls, compact crafting and scrollable panels. Empty, disabled, selected and focused slots remain distinct.

The loop is village → forest quests → three seals → ruins/Warden → village reward → free building. NPC dialogue, five journal objectives, traveling kunai/jutsu, distinct enemy behaviors and eight crafting recipes make progression visible. Wind, Lightning and the eye unlock with seals. Wood/stone, ore, herbs, medicine, bridges, fences, lanterns and permanent upgrades are real inventory items, not decorative UI. Craftable trail camps set a safe respawn, gardens mature in 45 active seconds, and guarded ruin supplies reward continued exploration. Five biomes and a gentle daylight/moonrise cycle extend the village palette. Death preserves progress; safe-ground recall prevents long return walks. The journal has inventory/recipes, quests, color-keyed nearby/village/explored-atlas maps, and an Online lobby. It pauses local play; online menus stop only that player's controls while the shared world keeps running. Keyboard and touch controls, pause, a visible portfolio exit and optional native fullscreen keep the experience interruptible. Validated v3 device-local saves migrate v1/v2 worlds without overwriting their buildings or progress; a tab save remains the fallback. Export/import provides an explicit portable backup, with validation before replacement. Storage quotas, blocked storage, unreadable data and stale cross-tab writes are disclosed rather than hiding lost persistence. Edits/discoveries grow with exploration; only generated terrain and active simulation memory are bounded. Resume dream reopens the saved world without replaying the transition and never takes over the portfolio on reload. A shared-world invitation exposes Join shared world and opens the lobby only after explicit activation. Eight visible player positions and Minecraft head slots make presence legible. The creator chooses survival/creative, friends join by invite, and browser-local credentials reconnect to the same server-saved identity. Remote players retain the existing skin with name labels and stable color markers; no external skin lookup is implied. Online state never replaces the device-local save, and concurrent local-tab changes remain protected.

### PsyStream Screen
A framed screen, rather than a repository chest, marks this live closed-source project. The back-wall cinema poster uses the actual public favicon and wordmark in a simple timber frame, not a miniature homepage. The shelf uses the unmodified favicon and the official Mojang Bedrock red-bed inventory sprite. Bed atlas samples stay inside each face rectangle; the shortened floor courses crop side UVs instead of squashing whole textures. The carried torch is gripped at the cuff and counter-rotates to remain upright as the shoulder moves. Its standalone showcase follows the room/shelf and precedes public repositories: compact introduction on the left, a generous product capture on the right, and a direct live-site link. Mobile stacks copy and screen. Charcoal, timber framing and existing cyan actions keep it part of the workshop; the real violet PsyStream logo is confined to its branding. No fake repository, technology stack or deployment metrics are shown. Captures and branding ship locally with provenance.

### Jukebox
A locally textured vanilla jukebox sits between the crafting table and project chest. It is no longer a ninth shelf item or an inline page row: a fixed lower-right jukebox tab opens a nonmodal timber side panel. Clicking the room object or choosing it in quick navigation opens the same panel and focuses its disc. A large local vanilla block/disc composition is the play/pause button; tapping the record inserts it visually in both the player and room block, tapping again pauses with the disc retained. Explicit eject unloads the recording and lifts the disc out. Two inventory slots select Sweden/Moog City and the recordings alternate on completion. A native vertical slider beside the block changes volume in 5% steps, bounded to 0–100%, with a readable numeric output and keyboard/touch semantics. Closing/Escape returns focus to the side tab without interrupting music. The responsive panel has bounded viewport height, scrolling, safe-area offsets and reduced-motion support; it hides behind workshop dialogs and the dream. Effects unlock on the first trusted click or keyboard gesture. Music remains manual, starts at 20%, and pauses on hidden tabs or the dream without auto-resumption. MP3s load only on disc playback. No iframe or runtime external music service is used; sources and rights caveats remain in per-file provenance.

### Contact Book
Parchment paper, dark ink, a timber spine and bevelled cyan CTA. The thick edges are an actual book spine/control bevel, not a generic one-sided card accent. A dashed pixel inset and 24px envelope/arrow remain legible on mobile. The new paper and Chidori colours are intentional material additions.

## Do's and Don'ts

### Do:
- **Do** use the approved vanilla models/textures rather than approximate props, with crisp pixelated rendering and separate game-art provenance.
- **Do** keep the room open-front and isometric, with the user's blue skin, cyan monitor light and furnace warmth against stone and timber.
- **Do** pair Pixelify headings with readable Departure Mono facts/forms, without rewriting existing copy.
- **Do** provide labeled native controls for every world action, including the stacked mobile shelf, visible focus rings, and reduced-motion behavior.
- **Do** retain hard pixel/block shadows and square material panels when extending the interface.

### Don't:
- **Don't** borrow unrelated game art or add generic arcade styling, glassmorphism, or default SaaS components. The user's skin and requested vanilla Minecraft workshop assets are approved; this does not relicense Mojang/Microsoft artwork.
- **Don't** round controls into pills or replace structural block shadows with soft blurred elevation.
- **Don't** use autoplay sound, scroll hijacking, or motion that prevents immediate static use.
- **Don't** make the GitHub handle a brand replacement for Psymariux, or present upstream fork activity as Psymariux’s own work.
- **Don't** invent repository metrics, technologies, timelines, deployment links, employment claims, or testimonials.
