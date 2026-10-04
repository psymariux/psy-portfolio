"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { resumeAudio } from "@/lib/workshop-audio";
import { SAVE_KEY, readSave, movePlayer, jump, interact, mine, build, cast, collectScroll, stepEnemies, stepProjectiles, craft, heal, dash, objectives, claimMission, maxHp, materials, recall, streamWorld, advanceWorld, daylight, type GameState, type Material, type Jutsu, type RecipeId, type Mission } from "@/lib/ninja-game";
import { drawWorld, drawIntro, drawMap } from "@/lib/ninja-render";
import type { SpriteMotion } from "@/lib/ninja-motion";
import Icon from "./PixelIcon";
import MinecraftInventory, { GameItem } from "./MinecraftInventory";
import NinjaOnlinePanel from "./NinjaOnlinePanel";
import { connectOnline, type JoinRequest, type OnlineConnection, type OnlineStatus } from "@/lib/ninja-online-client";
import type { Intent, RoomView } from "@/lib/ninja-online";
import "./NinjaDream.css";
import "./MinecraftGame.css";

type Action = "kunai" | "chakra" | "mine" | "build" | "eye" | "scroll" | "heal" | "dash" | "recall" | "recover";
const directions: Record<string, [number, number]> = { ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1], ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0] };
const movementCode = (event: KeyboardEvent) => directions[event.code] ? event.code : directions[event.key] ? event.key : "";
const actionKeys: Record<string, Action> = { j: "kunai", k: "chakra", f: "mine", q: "build", g: "eye", Enter: "scroll", h: "heal", l: "dash", r: "recall", x: "recover" };
const hotbar = [
  ["kunai", "Kunai", "J"], ["chakra", "Jutsu", "K"], ["mine", "Interact", "F"], ["build", "Build", "Q"], ["heal", "Heal", "H"], ["dash", "Dash", "L"], ["recover", "Recover", "X"], ["recall", "Recall", "R"], ["eye", "Eye", "G"],
] as const;

export default function NinjaDream({ sound, intro = true, onClose }: { sound: boolean; intro?: boolean; onClose: () => void }) {
  const [phase, setPhase] = useState<"intro" | "game">(intro ? "intro" : "game");
  const [message, setMessage] = useState("E: inventory · F: interact · Space: jump. Controls are in the pause menu.");
  const [stats, setStats] = useState({ hp: 6, maxLife: 6, chakra: 100, wood: 8, stone: 4, herb: 0, ore: 0, medicine: 1, scrolls: 0 });
  const [material, setMaterial] = useState<Material>("wood"), materialRef = useRef<Material>("wood");
  const [jutsu, setJutsu] = useState<Jutsu>("fire"), jutsuRef = useRef<Jutsu>("fire");
  const [journal, setJournal] = useState(false), journalRef = useRef(false), journalPause = useRef(false);
  const [journalPage, setJournalPage] = useState<"bag" | "quests" | "map" | "online">("bag");
  const [mapMode, setMapMode] = useState<"local" | "village" | "atlas">("local");
  const [pendingImport, setPendingImport] = useState<GameState | null>(null);
  const importFile = useRef<HTMLInputElement>(null), importGeneration = useRef(0), externalWrite = useRef(false);
  const journalClose = useRef<HTMLButtonElement>(null);
  const [muted, setMuted] = useState(!sound);
  const [paused, setPaused] = useState(false), pausedRef = useRef(false);
  const [pausePage, setPausePage] = useState<"menu" | "controls">("menu");
  const resumeButton = useRef<HTMLButtonElement>(null), pausePanel = useRef<HTMLElement>(null), pausePageRef = useRef(pausePage);
  const [selectedTool, setSelectedTool] = useState(0), selectedToolRef = useRef(0);
  const [saveStatus, setSaveStatus] = useState("Loading your world…");
  const screen = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null);
  const [canvasElement, setCanvasElement] = useState<HTMLCanvasElement | null>(null);
  const attachCanvas = useCallback((node: HTMLCanvasElement | null) => { canvas.current = node; setCanvasElement(node); }, []);
  const state = useRef<GameState | null>(null), skin = useRef<HTMLImageElement | null>(null);
  const online = useRef<OnlineConnection | null>(null), onlineView = useRef<RoomView | null>(null), onlineReady = useRef(false), offlineBackup = useRef<GameState | null>(null);
  const [onlineInfo, setOnlineInfo] = useState<RoomView | null>(null), [onlineStatus, setOnlineStatus] = useState<OnlineStatus | null>(null);
  const audio = useRef<AudioContext | null>(null), notes = useRef<OscillatorNode[]>([]);
  const clips = useRef(new Map<string, Promise<AudioBuffer>>()), samples = useRef<AudioBufferSourceNode[]>([]), soundGeneration = useRef(0);
  const held = useRef(new Set<string>()), pointers = useRef(new Map<number, string>()), visualTime = useRef(0), freezeLeft = useRef(0), jumpStarted = useRef(-Infinity);
  const clearInput = useCallback(() => { held.current.clear(); pointers.current.clear(); }, []);
  const motions = useRef(new Map<string, SpriteMotion>()), gesture = useRef<{ kind: string; started: number } | undefined>(undefined);
  const lastAction = useRef(0), lastMove = useRef(0), dirty = useRef(false), soundOn = useRef(sound);
  const stopSound = useCallback(() => {
    soundGeneration.current++;
    [...notes.current, ...samples.current].forEach(node => { try { node.stop(); } catch { /* Already ended. */ } });
    notes.current = []; samples.current = [];
  }, []);
  const playClip = useCallback((name: "itachi-mangekyo" | "sharingan", delay = 0) => {
    if (!soundOn.current) return;
    try {
      const context = resumeAudio(audio), generation = soundGeneration.current, start = context.currentTime + delay;
      if (!clips.current.has(name)) clips.current.set(name, fetch(`/audio/${name}.mp3`).then(response => {
        if (!response.ok) throw new Error("Dream audio unavailable"); return response.arrayBuffer();
      }).then(bytes => context.decodeAudioData(bytes)).catch(error => { clips.current.delete(name); throw error; }));
      void clips.current.get(name)!.then(buffer => {
        if (!soundOn.current || generation !== soundGeneration.current || context.state === "closed") return;
        const source = context.createBufferSource(), gain = context.createGain(); source.buffer = buffer;
        gain.gain.value = name === "itachi-mangekyo" ? .45 : .2; source.connect(gain); gain.connect(context.destination); samples.current.push(source);
        source.onended = () => { source.disconnect(); gain.disconnect(); samples.current = samples.current.filter(node => node !== source); };
        source.start(Math.max(start, context.currentTime));
      }).catch(() => { /* Optional audio never gates the transition or game. */ });
    } catch { /* Muted, unavailable or closed audio never blocks play. */ }
  }, []);
  const tone = useCallback((ritual = false) => {
    if (!soundOn.current) return;
    if (ritual) { playClip("sharingan"); return; }
    try {
      const context = resumeAudio(audio);
      const frequencies = [330, 440];
      frequencies.forEach((frequency, i) => {
        const node = context.createOscillator(), gain = context.createGain(), start = context.currentTime + i * .045, length = .1;
        node.type = "square"; node.frequency.setValueAtTime(frequency, start);
        gain.gain.setValueAtTime(.0001, start); gain.gain.linearRampToValueAtTime(.018, start + .02); gain.gain.exponentialRampToValueAtTime(.0001, start + length);
        node.connect(gain); gain.connect(context.destination); notes.current.push(node);
        node.onended = () => { node.disconnect(); gain.disconnect(); notes.current = notes.current.filter(n => n !== node); };
        node.start(start); node.stop(start + length);
      });
    } catch { /* Audio never gates the game. */ }
  }, [playClip]);
  const save = useCallback(() => {
    if (!state.current || externalWrite.current) return;
    if (online.current) { setSaveStatus(onlineView.current ? "Online world · changes save on the server" : "Connecting · local save kept separate"); return; }
    state.current.savedAt = Math.min(Number.MAX_SAFE_INTEGER - 1, Math.max(Date.now(), state.current.savedAt + 1));
    const value = JSON.stringify(state.current); let persistent = false, tab = false;
    try { localStorage.setItem(SAVE_KEY, value); persistent = true; } catch { /* Try the existing tab save next. */ }
    try { sessionStorage.setItem(SAVE_KEY, value); tab = true; } catch { /* A downloadable backup remains available. */ }
    if (persistent || tab) dirty.current = false;
    setSaveStatus(persistent ? "Saved on this device" : tab ? "Tab-only save · export a permanent copy" : "Storage full / blocked · export your world in Inventory");
  }, []);
  const syncStats = useCallback(() => {
    const s = state.current;
    if (s) setStats({ hp: s.hp, maxLife: maxHp(s), chakra: Math.floor(s.chakra), wood: s.wood, stone: s.stone, herb: s.inventory.herb, ore: s.inventory.ore, medicine: s.inventory.medicine, scrolls: s.scrolls.length });
  }, []);
  const relay = useCallback((intent: Intent) => {
    if (!onlineReady.current || !online.current?.send(intent)) { clearInput(); setMessage("Wait for the online connection before playing. Your last server save is kept."); return false; }
    return true;
  }, [clearInput]);
  const move = useCallback((direction: [number, number]) => {
    if (!state.current) return;
    if (online.current) { relay({ kind: "move", facing: direction, sprint: held.current.has("ShiftLeft") || held.current.has("ShiftRight") || [...pointers.current.values()].includes("sprint") }); return; }
    movePlayer(state.current, ...direction); dirty.current = true;
  }, [relay]);
  function startOnline(request: JoinRequest) {
    if (!state.current) return;
    if (!online.current) { save(); offlineBackup.current = structuredClone(state.current); }
    online.current?.stop(); onlineView.current = null; setOnlineInfo(null); clearInput();
    online.current = connectOnline(request, {
      status: status => { onlineReady.current = status === "online"; setOnlineStatus(status); if (!onlineReady.current) clearInput(); },
      message: text => setMessage(text),
      view: view => { onlineView.current = view; freezeLeft.current = view.freeze; state.current = view.game; setOnlineInfo(view); syncStats(); setSaveStatus("Online world · saved on the server"); },
    });
  }
  function returnOffline() {
    online.current?.stop(); online.current = null; onlineView.current = null; onlineReady.current = false; setOnlineInfo(null); setOnlineStatus(null);
    if (offlineBackup.current) state.current = offlineBackup.current;
    offlineBackup.current = null; motions.current.clear(); gesture.current = undefined; jumpStarted.current = -Infinity; clearInput(); syncStats(); save();
    if (externalWrite.current) { setSaveStatus("Local save preserved · export this copy"); setMessage("Your stored local save is preserved. Reload or export this copy before replacing it."); }
    else setMessage("Back in your local world. Shared builds stay saved online.");
  }
  const finishIntro = useCallback(() => { stopSound(); setPhase("game"); }, [stopSound]);
  const leave = useCallback(() => { save(); online.current?.stop(); stopSound(); if (document.fullscreenElement === screen.current) void document.exitFullscreen().catch(() => {}); onClose(); }, [save, stopSound, onClose]);
  const setGamePaused = useCallback((value: boolean) => {
    pausedRef.current = value; setPaused(value); clearInput(); stopSound(); save();
    if (value) { setPausePage("menu"); window.setTimeout(() => resumeButton.current?.focus(), 0); }
    else window.setTimeout(() => canvas.current?.focus(), 0);
  }, [save, stopSound, clearInput]);
  const togglePause = useCallback(() => { if (!journalRef.current) setGamePaused(!pausedRef.current); }, [setGamePaused]);
  const toggleJournal = useCallback(() => {
    const open = !journalRef.current;
    journalRef.current = open; setJournal(open); clearInput();
    if (open) { journalPause.current = pausedRef.current; pausedRef.current = true; stopSound(); }
    else { pausedRef.current = journalPause.current; canvas.current?.focus(); }
    setPaused(pausedRef.current); syncStats(); save();
  }, [save, syncStats, stopSound, clearInput]);
  const performJump = useCallback(() => {
    const s = state.current, now = visualTime.current;
    if (!s || pausedRef.current || now - jumpStarted.current < 380) return;
    if (online.current) { if (relay({ kind: "jump", facing: s.facing })) { jumpStarted.current = now; gesture.current = { kind: "jump", started: now }; tone(); } return; }
    const beforeX = s.x, beforeY = s.y, text = jump(s);
    if (s.x !== beforeX || s.y !== beforeY) { jumpStarted.current = now; gesture.current = { kind: "jump", started: now }; dirty.current = true; tone(); }
    setMessage(text); syncStats(); save(); canvas.current?.focus();
  }, [save, syncStats, tone, relay]);
  const act = useCallback((action: Action) => {
    const s = state.current, now = performance.now();
    if (!s || pausedRef.current || now - lastAction.current < 220) return;
    lastAction.current = now; gesture.current = { kind: action, started: visualTime.current };
    if (online.current) {
      const intent: Intent = action === "mine" ? { kind: "interact", facing: s.facing } : action === "build" ? { kind: "build", facing: s.facing, material: materialRef.current } : action === "kunai" || action === "chakra" ? { kind: "cast", facing: s.facing, jutsu: action === "kunai" ? "kunai" : jutsuRef.current } : { kind: action, facing: s.facing };
      if (relay(intent)) tone(); canvas.current?.focus(); return;
    }
    let text = "";
    if (action === "mine") text = interact(s);
    else if (action === "recover") text = mine(s);
    else if (action === "build") text = build(s, materialRef.current);
    else if (action === "scroll") text = collectScroll(s);
    else if (action === "heal") text = heal(s);
    else if (action === "dash") text = dash(s);
    else if (action === "recall") text = recall(s);
    else if (action === "eye") {
      if (s.scrolls.length < 3) text = "Find all three scrolls to awaken Mangekyo. Your journal map marks the shrines.";
      else if (s.chakra < 50) text = "The eye needs 50 chakra.";
      else { s.chakra -= 50; freezeLeft.current = 5; text = "Tsukuyomi! Enemies and their projectiles frozen for 5 seconds."; tone(true); }
    } else text = cast(s, action === "chakra" ? jutsuRef.current : "kunai");
    setMessage(text); dirty.current = true; syncStats(); save(); canvas.current?.focus();
    if (action !== "eye") tone();
  }, [save, syncStats, tone, relay]);
  function make(id: RecipeId) {
    if (!state.current) return;
    if (online.current) { relay({ kind: "craft", recipe: id }); return; }
    setMessage(craft(state.current, id)); dirty.current = true; syncStats(); save(); tone();
  }
  function claim(id: Mission) {
    if (!state.current) return;
    if (online.current) { relay({ kind: "claim", mission: id }); return; }
    setMessage(claimMission(state.current, id)); dirty.current = true; syncStats(); save(); tone();
  }
  function selectTool(index: number) { const next = (index + hotbar.length) % hotbar.length; selectedToolRef.current = next; setSelectedTool(next); if (!journalRef.current && !pausedRef.current) canvas.current?.focus(); }
  function changeSound() { const enabled = muted; soundOn.current = enabled; setMuted(!enabled); if (!enabled) stopSound(); else if (phase === "intro") playClip("itachi-mangekyo"); else tone(); }
  function fullscreen() { if (screen.current?.requestFullscreen) void screen.current.requestFullscreen().catch(() => setMessage("Fullscreen is unavailable here. The game already fills the page.")); }
  function touchMove(key: string, event: React.PointerEvent<HTMLButtonElement>) {
    event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); canvas.current?.focus();
    if (pausedRef.current || !state.current) return;
    pointers.current.set(event.pointerId, key);
    move(directions[key]); lastMove.current = performance.now();
  }

  function canvasAction(event: React.PointerEvent<HTMLCanvasElement>) {
    const s = state.current; if (!s || pausedRef.current || phase !== "game") return;
    const rect = event.currentTarget.getBoundingClientRect(), dx = (event.clientX - rect.left - 4) / (rect.width - 8) * 320 - 168, dy = (event.clientY - rect.top - 4) / (rect.height - 8) * 240 - 120;
    s.facing = Math.abs(dx) >= Math.abs(dy) ? [dx < 0 ? -1 : 1, 0] : [0, dy < 0 ? -1 : 1]; dirty.current = true; event.preventDefault(); event.currentTarget.focus();
    const selected = hotbar[selectedToolRef.current][0];
    act(event.button === 2 ? selected === "build" ? "build" : "mine" : selected);
  }
  function exportWorld() {
    if (!state.current) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(state.current)], { type: "application/json" })), link = document.createElement("a");
    link.href = url; link.download = `shinobi-world-${state.current.world.seed}.json`; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage(online.current ? "Shared terrain and your inventory exported as a local-world backup. Other players’ inventories and online sessions are not included." : "World exported. Keep this file to restore builds, crops, missions and discoveries on another device.");
  }
  async function previewImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0], generation = ++importGeneration.current; event.currentTarget.value = ""; if (!file) return;
    try {
      if (file.size > 32 * 1024 * 1024) throw new Error("This file exceeds the 32 MB import limit. Your current world was not changed.");
      const value = await file.text(), imported = readSave(value, true);
      if (generation !== importGeneration.current) return;
      setPendingImport(imported); setMessage("Import checked. Export your current world first if you want to keep both, then choose Replace world or Cancel.");
    } catch (error) { if (generation === importGeneration.current) { setPendingImport(null); setMessage(error instanceof Error ? error.message : "Could not read this file. Your current world was not changed."); } }
  }
  function acceptImport() {
    if (!pendingImport || online.current) return;
    externalWrite.current = false; motions.current.clear(); gesture.current = undefined; state.current = pendingImport; streamWorld(pendingImport); setPendingImport(null); freezeLeft.current = 0; jumpStarted.current = -Infinity; clearInput(); stopSound(); dirty.current = true; syncStats(); save(); setMessage("World imported. Close your journal to continue exploring.");
  }
  function villageRecall() { if (!state.current) return; if (online.current) { relay({ kind: "village", facing: state.current.facing }); return; } setMessage(recall(state.current, true)); dirty.current = true; syncStats(); save(); }
  function campRecall() { if (!state.current) return; if (online.current) { relay({ kind: "recall", facing: state.current.facing }); return; } setMessage(recall(state.current)); dirty.current = true; syncStats(); save(); }

  useEffect(() => {
    const pendingRequests = importGeneration;
    let restored: GameState | null = null, invalid = false;
    for (const get of [() => localStorage.getItem(SAVE_KEY), () => sessionStorage.getItem(SAVE_KEY)]) {
      try { const value = get(); if (value) { try { const candidate = readSave(value, true); if (!restored || candidate.savedAt > restored.savedAt) restored = candidate; } catch { invalid = true; } } } catch { /* Storage may be unavailable; try the tab backup. */ }
    }
    state.current = restored ?? readSave(null); streamWorld(state.current);
    if (restored || !invalid) save();
    else { externalWrite.current = true; setSaveStatus("Unreadable save · original kept"); setMessage("The stored world could not be read and was not overwritten. You can explore a fresh world, export it in Inventory, then import that file to replace the unreadable save."); }
    const otherTab = (event: StorageEvent) => { if (event.key !== SAVE_KEY && event.key !== null) return; externalWrite.current = true; if (online.current) return; pausedRef.current = true; journalPause.current = true; setPaused(true); clearInput(); stopSound(); setSaveStatus("Updated in another tab · export this copy"); setMessage("Another tab changed this world. Export your copy in Bag, then reload to use the newer save. This tab will not overwrite it."); };
    window.addEventListener("storage", otherTab);
    const image = new Image(); image.src = "/art/psymariux-skin.png"; skin.current = image;
    const pagehide = () => save(); window.addEventListener("pagehide", pagehide);
    const loseFocus = () => { pausedRef.current = true; journalPause.current = true; setPaused(true); setPausePage("menu"); clearInput(); stopSound(); save(); }; window.addEventListener("blur", loseFocus); document.addEventListener("visibilitychange", loseFocus);
    return () => {
      save(); online.current?.stop(); stopSound(); const context = audio.current; audio.current = null;
      if (context && context.state !== "closed") void context.close().catch(() => {});
      pendingRequests.current++; window.removeEventListener("storage", otherTab); window.removeEventListener("pagehide", pagehide); window.removeEventListener("blur", loseFocus); document.removeEventListener("visibilitychange", loseFocus);
    };
  }, [save, stopSound, clearInput]);

  useEffect(() => {
    pausePageRef.current = pausePage;
    if (paused && !journal) pausePanel.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, [pausePage, paused, journal]);

  useEffect(() => {
    const target = canvasElement, ctx = target?.getContext("2d"); if (!target || !ctx) return;
    ctx.imageSmoothingEnabled = false;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const started = performance.now();
    let raf = 0, last = started, painted = false, enemyTime = 0, projectileTime = 0, hudTime = 0, saveTime = 0, tick = 0;
    if (phase === "intro") { if (!reduced) { playClip("itachi-mangekyo"); playClip("sharingan", 1.9); } }
    else { target.focus(); syncStats(); }
    const keydown = (event: KeyboardEvent) => {
      if (phase !== "game" || event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
      const control = event.target as HTMLElement, editable = ["SELECT", "INPUT", "TEXTAREA"].includes(control.tagName) || control.isContentEditable;
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      if (key === "Escape" && !event.repeat) {
        event.preventDefault(); clearInput();
        if (journalRef.current) toggleJournal();
        else if (pausedRef.current && pausePageRef.current === "controls") setPausePage("menu");
        else setGamePaused(!pausedRef.current);
        return;
      }
      if (editable) return;
      if ((key === "e" || key === "i") && !event.repeat) { event.preventDefault(); toggleJournal(); return; }
      if (event.target !== target || journalRef.current) return;
      if ((event.code === "ShiftLeft" || event.code === "ShiftRight") && !pausedRef.current) { held.current.add(event.code); return; }
      if (key === "p" && !event.repeat) { event.preventDefault(); togglePause(); return; }
      if (key === " " && !event.repeat) { event.preventDefault(); performJump(); return; }
      if (/^[1-9]$/.test(key) && !event.repeat) { event.preventDefault(); selectedToolRef.current = Number(key) - 1; setSelectedTool(Number(key) - 1); return; }
      const movement = movementCode(event);
      if (movement) {
        event.preventDefault();
        if (!pausedRef.current && !event.repeat && state.current) { move(directions[movement]); lastMove.current = performance.now(); }
        if (!pausedRef.current) held.current.add(movement);
      } else if (actionKeys[key]) { event.preventDefault(); if (!event.repeat) act(actionKeys[key]); }
    };
    const keyup = (event: KeyboardEvent) => { held.current.delete(event.code); held.current.delete(event.key); };
    window.addEventListener("keydown", keydown); window.addEventListener("keyup", keyup);
    function draw(now: number) {
      if (!ctx || !target || !skin.current || !state.current) return;
      raf = requestAnimationFrame(draw);
      const dt = Math.min((now - last) / 1000, .05); last = now;
      if (document.hidden) return;
      if (phase === "intro") {
        const t = (now - started) / 1000; drawIntro(ctx, skin.current, state.current, t, reduced);
        if (t > (reduced ? .2 : 4.25)) finishIntro();
        return;
      }
      const s = state.current;
      if (!pausedRef.current) {
        visualTime.current += dt * 1000;
        if (!online.current) { advanceWorld(s, dt); streamWorld(s); }
        const sprinting = held.current.has("ShiftLeft") || held.current.has("ShiftRight") || [...pointers.current.values()].includes("sprint"), moveDelay = sprinting ? 65 : 115;
        if (now - lastMove.current > moveDelay) {
          const key = [...held.current, ...pointers.current.values()].reverse().find(value => directions[value]), direction = key && directions[key];
          if (direction) { move(direction); lastMove.current = now; }
        }
        freezeLeft.current = Math.max(0, freezeLeft.current - dt);
        if (!online.current) s.chakra = Math.min(100, s.chakra + dt * 5);
        enemyTime += dt; projectileTime += dt; hudTime += dt; saveTime += dt;
        if (!online.current && projectileTime > .11) { projectileTime = 0; if (s.projectiles.length) { const msg = stepProjectiles(s, freezeLeft.current > 0); if (msg) setMessage(msg); dirty.current = true; } }
        if (!online.current && enemyTime > .75) { enemyTime = 0; if (freezeLeft.current <= 0) { const msg = stepEnemies(s, tick++); if (msg) setMessage(msg); dirty.current = true; } }
        if (hudTime > .25) { hudTime = 0; syncStats(); }
        if (saveTime > 2) { saveTime = 0; if (dirty.current) save(); }
      }
      if (pausedRef.current && painted && !online.current) return;
      if (pausedRef.current && online.current) visualTime.current += dt * 1000;
      drawWorld(ctx, s, skin.current, visualTime.current, held.current.size + pointers.current.size > 0, reduced, freezeLeft.current, motions.current, gesture.current, jumpStarted.current, onlineView.current?.players.filter(p => p.id !== onlineView.current?.playerId) ?? []);
      painted = true;
    }
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); clearInput(); window.removeEventListener("keydown", keydown); window.removeEventListener("keyup", keyup); stopSound(); };
  }, [canvasElement, phase, act, finishIntro, performJump, save, setGamePaused, syncStats, playClip, stopSound, togglePause, toggleJournal, clearInput, move]);

  useEffect(() => { if (journal) journalClose.current?.focus(); }, [journal]);
  useEffect(() => {
    if (!/^#world=[a-f0-9]{24}$/.test(location.hash)) return;
    journalRef.current = true; setJournal(true); journalPause.current = false; pausedRef.current = true; setPaused(true); setJournalPage("online");
  }, []);

  const world = state.current;
  const toolSlots = hotbar.map(([action, label, key], index) => <button key={action} className="mc-slot" aria-label={`${index + 1}. ${label} (${key})`} title={`${label} · ${key}`} aria-pressed={selectedTool === index} onClick={() => selectTool(index)}><kbd>{index + 1}</kbd><GameItem item={action === "build" ? material : action === "mine" ? "recover" : action === "heal" ? "medicine" : action} />{action === "build" && <b className="mc-count">{onlineInfo?.mode === "creative" ? "∞" : material === "wood" ? stats.wood : material === "stone" ? stats.stone : world?.inventory[material] ?? 0}</b>}{action === "heal" && <b className="mc-count">{stats.medicine}</b>}</button>);
  const loadout = <><label className="dream-material">Jutsu<select value={jutsu} onChange={event => { const value = event.target.value as Jutsu; jutsuRef.current = value; setJutsu(value); }}><option value="fire">Fire · 20</option><option value="wind" disabled={stats.scrolls < 1}>Wind · 25{stats.scrolls < 1 ? " (1 scroll)" : ""}</option><option value="lightning" disabled={stats.scrolls < 2}>Lightning · 35{stats.scrolls < 2 ? " (2 scrolls)" : ""}</option></select></label><label className="dream-material">Build<select value={material} onChange={event => { const value = event.target.value as Material; materialRef.current = value; setMaterial(value); }}>{materials.map(m => <option key={m} value={m}>{m === "garden" ? "Herb seeds" : m[0].toUpperCase() + m.slice(1)} ({m === "wood" ? stats.wood : m === "stone" ? stats.stone : world?.inventory[m] ?? 0})</option>)}</select></label></>;
  return <Dialog.Root open onOpenChange={open => { if (!open) leave(); }}><Dialog.Portal><Dialog.Overlay className="dream-overlay" /><Dialog.Content className="ninja-dream" ref={screen} aria-describedby="dream-description" onOpenAutoFocus={event => { event.preventDefault(); canvas.current?.focus(); }} onEscapeKeyDown={event => event.preventDefault()}>
    <header className="dream-header"><div><Dialog.Title>{phase === "intro" ? "The hidden dream" : <><span className="dream-title-prefix">Psy · </span>Shinobi sandbox</>}</Dialog.Title><span title={phase === "game" ? saveStatus : undefined}>{phase === "intro" ? "Psymariux / Mangekyo Sharingan" : saveStatus}</span></div><div className="dream-header-actions"><button className="icon-button" onClick={changeSound} aria-label={muted ? "Enable game sound" : "Mute game sound"} aria-pressed={!muted}><Icon name={muted ? "volume-x" : "volume-2"} /></button><button className="dream-button fullscreen-button" onClick={fullscreen}>Fullscreen</button><button className="dream-button dream-exit" onClick={leave}>Portfolio <Icon name="close" /></button></div></header>
    <Dialog.Description id="dream-description" className="sr-only">Explore a procedural pixel ninja world. WASD or arrows move, Shift sprints, Space jumps, E or I opens inventory, F interacts, Q builds, J throws kunai, K casts jutsu, G uses Mangekyo, L dashes, H heals, R recalls and X recovers. Number keys, wheel or the touch hotbar select a tool. Primary pointer uses it; secondary pointer interacts or places. Escape opens the pause menu.</Dialog.Description>
    {phase === "game" && <div className="dream-hud"><span aria-label={`Health ${stats.hp} of ${stats.maxLife}`}>Life <b className="mc-hearts" aria-hidden="true">{Array.from({ length: stats.maxLife }, (_, i) => <i key={i} className="mc-heart" data-full={i < stats.hp} />)}</b></span><span>Chakra <meter min={0} max={100} value={stats.chakra} aria-label="Chakra" /><b>{stats.chakra}</b></span><span>Wood <b>{stats.wood}</b> / Stone <b>{stats.stone}</b> / Ore <b>{stats.ore}</b></span><span>{onlineInfo && <strong className="mc-online-badge">{onlineStatus === "online" ? `${onlineInfo.players.length}/8 online` : onlineStatus === "error" ? "Connection failed" : "Reconnecting"} · {onlineInfo.mode}</strong>}Scrolls <b>{stats.scrolls}/3</b> · Day <b>{world ? Math.floor(world.elapsed / 240) + 1 : 1}</b> · {world && !daylight(world) ? "Moonrise" : "Daylight"}</span></div>}
    <div className={`dream-viewport ${phase === "intro" ? "dream-intro" : ""}`}><canvas ref={attachCanvas} width={320} height={240} onPointerDown={canvasAction} onContextMenu={event => event.preventDefault()} onWheel={event => { if (phase !== "game" || pausedRef.current) return; event.preventDefault(); selectTool(selectedToolRef.current + (event.deltaY > 0 ? 1 : -1)); }} tabIndex={journal || paused ? -1 : 0} aria-label={phase === "intro" ? "Psymariux awakens Itachi’s Mangekyo Sharingan" : `Procedural ninja world. Selected tool: ${hotbar[selectedTool][1]}. WASD or arrows move, Shift sprints, Space jumps, E opens inventory and Escape pauses.`} />{phase === "intro" && <button className="dream-button intro-skip" onClick={finishIntro}>Skip / Play</button>}
      {phase === "game" && paused && !journal && <section ref={pausePanel} className="dream-pause" aria-labelledby="pause-heading"><h3 id="pause-heading">{pausePage === "controls" ? "Controls" : online.current ? "Your controls are paused" : "Game paused"}</h3>{pausePage === "menu" ? <div className="pause-actions"><button className="dream-button" ref={resumeButton} onClick={() => setGamePaused(false)}>Resume</button><button className="dream-button" onClick={() => setPausePage("controls")}>Controls</button><button className="dream-button" onClick={() => { setJournalPage("online"); toggleJournal(); }}>Play with friends</button><button className="dream-button" onClick={changeSound}>{muted ? "Sound off · turn on" : "Sound on · mute"}</button><button className="dream-button pause-save" onClick={leave}>Save &amp; return to portfolio</button></div> : <><dl className="control-list"><div><dt>Move</dt><dd>WASD / arrows · hold Shift to sprint</dd></div><div><dt>Jump</dt><dd>Space · two clear cardinal tiles</dd></div><div><dt>Inventory</dt><dd>E or I · recipes, missions and map</dd></div><div><dt>Combat</dt><dd>J kunai · K jutsu · G Mangekyo · L dash</dd></div><div><dt>World</dt><dd>F interact · Q build · X recover · H heal · R recall</dd></div><div><dt>Hotbar</dt><dd>1–9 or wheel · primary uses selected · secondary interacts / places</dd></div><div><dt>Menus</dt><dd>P or Esc pauses · Esc backs out one layer</dd></div></dl><button className="dream-button" onClick={() => setPausePage("menu")}>Back <kbd>Esc</kbd></button></>}</section>}
      {journal && world && <section className="dream-journal" aria-labelledby="journal-heading"><div className="journal-heading"><h3 id="journal-heading">{journalPage === "bag" ? "Inventory" : journalPage === "online" ? "Multiplayer" : "Field journal"}</h3><button className="dream-button" ref={journalClose} onClick={toggleJournal}>Close <kbd>E / Esc</kbd></button></div><div className="journal-tabs" role="group" aria-label="Journal pages">{[["bag", "Inventory"], ["quests", "Missions"], ["map", "World map"], ["online", "Online"]].map(([id, label]) => <button key={id} className="dream-button" aria-pressed={journalPage === id} onClick={() => setJournalPage(id as typeof journalPage)}>{label}</button>)}</div>
        {(journalPage !== "bag" || !message.startsWith("E: inventory")) && <p className="journal-message" role="status">{message}</p>}
        {journalPage === "bag" && <><MinecraftInventory world={world} creative={onlineInfo?.mode === "creative"} material={material} selectMaterial={value => { materialRef.current = value; setMaterial(value); selectedToolRef.current = 3; setSelectedTool(3); }} make={make}><div className="dream-hotbar mc-inventory-hotbar" role="group" aria-label="Inventory hotbar">{toolSlots}</div></MinecraftInventory><div className="dream-loadout journal-loadout">{loadout}</div></>}
        {journalPage === "online" && <NinjaOnlinePanel view={onlineInfo} status={onlineStatus} connected={!!online.current} start={startOnline} offline={returnOffline} />}
        {journalPage === "bag" && <section className="dream-world-save" aria-labelledby="world-save-heading"><h4 id="world-save-heading">Keep your world</h4><p>{online.current ? "Export shared terrain and your inventory as a local-world backup. Online player sessions stay on the server; shared worlds cannot be overwritten by importing a client save." : `${saveStatus}. Export a file before clearing browser data or moving to another device.`}</p><div className="journal-tabs"><button className="dream-button" onClick={exportWorld}>Export world</button>{!online.current && <button className="dream-button" onClick={() => importFile.current?.click()}>Import world</button>}<input type="file" accept=".json,application/json" ref={importFile} hidden onChange={previewImport} aria-label="Import world save file" /></div>{pendingImport && <div className="world-import-review"><p>Seed {pendingImport.world.seed} · {Object.keys(pendingImport.world.explored).length} explored chunks · position {pendingImport.x},{pendingImport.y}. Replacing discards your current in-game world; export it first to keep both.</p><div className="journal-tabs"><button className="dream-button" onClick={acceptImport}>Replace world</button><button className="dream-button" onClick={() => { setPendingImport(null); setMessage("Import canceled. Your current world is unchanged."); }}>Cancel import</button></div></div>}</section>}
        {journalPage === "quests" && <><ol className="dream-quests">{objectives(world).map(q => <li key={q.title} data-complete={q.done}><div><strong><span>{q.done ? "✓" : "○"}</span>{q.title}</strong><p>{q.detail}</p></div>{"id" in q && <button className="dream-button" disabled={q.done || !q.ready} onClick={() => claim(q.id)}>{q.done ? "Claimed" : q.ready ? "Claim reward" : "In progress"}</button>}</li>)}</ol><h4>Beyond the village</h4><p className="journal-note">{Object.keys(world.world.explored).length} chunks explored · {world.totals.built} blocks placed · {world.totals.harvested} harvests · {world.totals.defeated} enemies defeated.</p><p className="journal-note">Follow trails through fields, forests, marshes, dunes and highlands. Clear ruin guards for supplies. Place a campfire with Q and rest with F to set a new respawn. X recovers builds. Plant herb seeds, let them grow for 45 active seconds, then harvest with F. Village quests unlock jutsu; the frontier missions stay repeat-proof.</p></>}
        {journalPage === "map" && <div className="dream-map"><div className="journal-tabs" role="group" aria-label="Map views">{[["local", "Nearby"], ["village", "Village"], ["atlas", "Explored atlas"]].map(([id, label]) => <button key={id} className="dream-button" aria-pressed={mapMode === id} onClick={() => setMapMode(id as typeof mapMode)}>{label}</button>)}</div><canvas width={240} height={192} ref={node => { if (node) { const ctx = node.getContext("2d"); if (ctx) drawMap(ctx, world, mapMode); } }} role="img" aria-label={`${mapMode} map. You are at ${world.x},${world.y}; your camp is ${world.spawn.x},${world.spawn.y}. ${Object.keys(world.world.explored).length} chunks explored. Village shrines at 7,7; 32,8; 30,25.`} /><p>You: {world.x},{world.y} · Camp: {world.spawn.x},{world.spawn.y}<br />{Object.keys(world.world.explored).length} chunks explored · Seed {world.world.seed}</p><p>Cyan: you · Amber: camp · Gold: seals · Rose: villagers · Red: Warden. Nearby follows you; Village shows the starting quests. Each atlas square is a 24×24 chunk; dark squares are unexplored, amber dots are camps, pale dots are ruins.</p><div className="journal-tabs"><button className="dream-button" onClick={() => { campRecall(); }}>Recall to camp · 25 chakra</button><button className="dream-button" onClick={villageRecall}>Return to village · 25 chakra</button></div><p>Recall needs safe ground. Walk away from enemies first. The world never resets when you return.</p></div>}
        <p className="journal-note">{online.current ? "Your controls are paused. Friends and the shared world keep playing." : "The world is paused while your inventory is open."}</p></section>}
    </div>
    {phase === "game" && <><div className="dream-status" role={journal ? undefined : "status"}>{journal ? message : paused ? online.current ? "Your controls are paused; the shared world keeps running." : "Paused. Your world is saved; resume when ready." : message}</div><div className="dream-controls" inert={journal || paused}><div className="dream-dpad" aria-label="Movement controls">{[["ArrowUp", "↑", "Move up"], ["ArrowLeft", "←", "Move left"], ["ArrowDown", "↓", "Move down"], ["ArrowRight", "→", "Move right"]].map(([key, label, name]) => <button key={key} className={`dream-button dpad-${key}`} aria-label={name} onPointerDown={event => touchMove(key, event)} onPointerUp={event => pointers.current.delete(event.pointerId)} onPointerCancel={event => pointers.current.delete(event.pointerId)} onLostPointerCapture={event => pointers.current.delete(event.pointerId)} onClick={event => { if (event.detail === 0 && !pausedRef.current && state.current) { move(directions[key]); syncStats(); save(); } }}>{label}</button>)}</div><div className="dream-touch-actions"><button className="dream-button" onClick={performJump}>Jump</button><button className="dream-button" style={{ touchAction: "none" }} onPointerDown={event => { event.preventDefault(); if (pausedRef.current) return; event.currentTarget.setPointerCapture(event.pointerId); pointers.current.set(event.pointerId, "sprint"); }} onPointerUp={event => pointers.current.delete(event.pointerId)} onPointerCancel={event => pointers.current.delete(event.pointerId)} onLostPointerCapture={event => pointers.current.delete(event.pointerId)}>Hold sprint</button><button className="dream-button touch-primary" onClick={() => act(hotbar[selectedTool][0])}>Use {hotbar[selectedTool][1]}</button><button className="dream-button" onClick={() => act(hotbar[selectedTool][0] === "build" ? "build" : "mine")}>Interact / place</button><button className="dream-button" onClick={toggleJournal}>Inventory</button><button className="dream-button" onClick={togglePause}>Pause</button></div><div className="dream-loadout">{loadout}</div></div><div className="dream-hotbar" inert={journal || paused} role="group" aria-label="Tool hotbar">{toolSlots}</div><footer className="dream-help"><span>WASD / arrows · Shift sprint · Space jump · E inventory · F interact · Q build · J/K combat · G eye · Esc pause</span><span>Primary uses the hotbar · Secondary interacts or places.</span></footer></>}
  </Dialog.Content></Dialog.Portal></Dialog.Root>;
}
