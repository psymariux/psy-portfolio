# Product

<!-- impeccable:product-schema 1 -->

## Platform
web

## Stack
User approved migration from Vite/React to Next.js, TypeScript and Tailwind. Server-side GitHub caching; accessible native or Radix primitives.

## Users
Visitors exploring Psymariux's development work, potential collaborators and recruiters (audience inferred from portfolio purpose).

## Product Purpose
An interactive personal developer portfolio that lets visitors explore real projects and current public development activity.

## Capabilities and Constraints
Projects are chests, skills are inventory/crafting items, active work is a furnace, GitHub activity is a redstone terminal, and contact is a book. Desktop objects navigate the environment; mobile objects remain individually usable. Commits are first-class, aggregated across relevant repositories. GitHub data refreshes server-side. Only public repositories and public activity may ship. Never fabricate metrics, timelines, technologies or deployment links. Optional GITHUB_TOKEN stays exclusively server-side. Repository feature selection is configurable.

## Brand Commitments
Personal identity is Psymariux. GitHub handle and canonical data source is psymariux. The former nohint404 login is recognized only for historical authorship, never repository ownership. Use PsyMariux's actual current blue/cyan Minecraft skin, verified through the public Mojang profile matching the supplied NameMC page. The skin is stored locally and mapped onto classic Minecraft proportions, including outer layers. Cozy stone/wood workshop, cyan identity, warm furnace light and sparse Italian tricolor. The original-art-only direction was superseded by the user's explicit request for authentic vanilla Minecraft objects and textures, alongside the personal skin. Use locally stored Java 1.21.4 assets with provenance and Mojang/Microsoft ownership notices, not approximate voxel stand-ins. No unrelated game art, glassmorphism, autoplay sound or generic SaaS components. Object clicks trigger automatic character/camera approach and chest opening before the project dialog; no WASD movement. The skippable entry lasts 1.5 seconds when the room is ready; scroll chapters use bounded pixel fades. Narrow RetroUI Bubble and Pixelact Button adaptations retain their upstream licenses. Pixelify titles and user-selected readable pixel body typography (Departure Mono), preserving all existing text. The portrait belongs centred above the greeting, not in the top-left header. The Get in touch surface is a stepped paper book with a pixel CTA; SVGs must preserve square aspect ratios. The room must not flicker at rest or have intersecting structural blocks. Walking uses Minecraft-style rigid limb phases; all card/list chest sprites stay closed until clicked and open before their details. Meet the developer adds a Chidori charge held in the character's hand before its card; audio uses the user-supplied https://www.youtube.com/watch?v=gDry8teIoJE clip only with sound enabled, running to its natural end even after the card opens. Hand seals play a CC0 swish triplet with provenance. Reduced motion and failed WebGL skip visual waits. Custom desktop pixel cursor requested. A vanilla room jukebox and collapsible lower-right pixel side panel offer the user-selected C418 tracks Sweden and Moog City as local MP3s (no iframe), alternating after completion with manual disc selection. The jukebox is not in the shelf row. Tapping the displayed disc inserts it and plays, or pauses with the disc still inserted. Eject stops and unloads the recording with upward disc motion; a native lateral slider sets volume in 5% steps. Both the side player and physical room block reflect the inserted record. Effects enable on the first trusted click/keyboard gesture; music remains manual, starts at 20%, and pauses on hidden tabs or the dream without automatic resumption. Music copyrights remain separate from the project code license; provenance does not establish redistribution permission.

## Evidence on Hand
Public GitHub: https://github.com/psymariux. Existing source describes game/backend development. Existing contact backend at api/contact.js must be inspected before reuse. Personal skin reference: https://namemc.com/profile/PsyMariux.1; verify current texture against Mojang, then store locally with provenance. No verified employment history or testimonials; do not invent them.

## Sandbox Controls
The separate 2D sandbox uses WASD/arrows, Shift sprint, Space jump, E/I inventory and Escape pause. A nine-tool hotbar supports number keys, wheel and touch selection; primary pointer uses the selected tool and secondary pointer interacts or places. Touch controls include directional movement and held sprint. Inventory contains material/jutsu selection, recipes, maps and missions. Pause offers resume, controls, sound and save/return. Local menus freeze simulation and visual time; blur/hidden tabs pause without automatic resumption. In online worlds, menus stop only that player's controls; friends keep playing. Trail pavers and kiln bricks are craftable and recoverable. Three one-time frontier missions supplement village quests. Validated existing saves retain progress and default the new fields.

## Minecraft Inventory and Online Worlds
The sandbox remains 2D. Its interface uses recognizable gray Minecraft bevels, recessed slots, locally bundled vanilla Java 1.21.4 item sprites/model renders, visible stack quantities, recipe ingredients/output and an icon hotbar, rather than generic menu cards. Individual inventories and validated local saves remain intact.

Private invitation worlds support eight concurrent players, including the creator, with survival/creative chosen at creation. Shared building/terrain and individual progression persist in server-only Redis; the local world stays separate. Vercel's beta native WebSockets and Fluid Compute carry realtime state. Actions are authoritative, validated and serialized with Redis compare-and-swap; reconnection restores the same player without automatically restarting held controls. Redis credentials must never be public. No service or paid plan may be activated without approval; deployment activation requires connecting an appropriate persistent Redis database. Local exports are backups of shared terrain and the exporting player's inventory, not full online room identity backups. Player credentials are browser-local, not Mojang account authentication; provider durability and usage quotas remain explicit constraints.

## Accessibility & Inclusion
World objects must be labeled keyboard-focusable controls. Reduced motion, readable contrast, usable mobile layouts and accessible dialogs are required.
