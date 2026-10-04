"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import * as Dialog from "@radix-ui/react-dialog";
import type { Commit, PortfolioData, Project, PullRequest } from "@/lib/github-core";
import type { SceneHandle, Station } from "./Scene";
import Icon from "./PixelIcon";
import EntryLoader from "./EntryLoader";
import ChestArt from "./ChestArt";
import PixelReveal from "./PixelReveal";
import PsyStream, { PsyStreamDetails } from "./PsyStream";
import QuickNavigate from "./QuickNavigate";
import Jukebox from "./Jukebox";
import type { WorkshopCommand } from "@/lib/workshop-commands";
import { PixelButton } from "./ui/PixelButton";
import { RetroBubble } from "./ui/RetroBubble";
import { resumeAudio } from "@/lib/workshop-audio";
import { githubHandle, githubProfileUrl, isDeveloperAuthor } from "@/config/portfolio";

const Scene = dynamic(() => import("./Scene"), { ssr: false });
const NinjaDream = dynamic(() => import("./NinjaDream"), { ssr: false });
const stationInfo: { id: Station; name: string; action: string; art: string }[] = [
  { id: "about", name: "Psymariux", action: "Meet the developer", art: "mascot" },
  { id: "psystream", name: "PsyStream", action: "Explore the live project", art: "psystream-favicon" },
  { id: "projects", name: "Project chest", action: "Open projects", art: "chest" },
  { id: "skills", name: "Crafting table", action: "Explore skills", art: "craft" },
  { id: "furnace", name: "The furnace", action: "See active work", art: "furnace" },
  { id: "activity", name: "Redstone lamp", action: "Flip the lever / activity", art: "terminal" },
  { id: "contact", name: "Message book", action: "Get in touch", art: "book" },
  { id: "sleep", name: "Cozy bed", action: "Take a nap", art: "bed" },
  { id: "jukebox", name: "Jukebox", action: "Sweden / Moog City", art: "jukebox" },
];
function Art({ name, className = "", open = false }: { name: string; className?: string; open?: boolean }) {
  if (name === "chest") return <ChestArt open={open} className={className} />;
  return <img src={`/art/${name === "mascot" ? "psymariux-head" : name}.png`} alt="" width="64" height="64" className={`pixel-art ${className}`} draggable={false} />;
}
function text(value: string) { return value.replace(/[\u2014\u2013]/g, "-"); }
function excerpt(value: string) { const clean = text(value); return clean.length > 140 ? clean.slice(0, 140).replace(/\s+\S*$/, "") + "..." : clean; }
function formatDate(value: string) { return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }); }
function External({ href, children, className = "" }: { href: string; children: React.ReactNode; className?: string }) { return <a href={href} target="_blank" rel="noopener noreferrer" className={className}>{children}<Icon name="external-link" /></a>; }
function FurnaceLoader({ label = "Heating up the workshop" }: { label?: string }) { return <div className="furnace-loader" role="status"><Art name="furnace" /><Art name="mascot" className="loader-mascot" /><div className="furnace-embers" aria-hidden="true"><i /><i /><i /></div><span>{label}</span></div>; }

function ContactBook() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setStatus("sending"); setError("");
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    try {
      const res = await fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.message || "Your message could not be delivered. Try again.");
      setStatus("sent"); form.reset();
    } catch (err) { setStatus("error"); setError(err instanceof Error ? err.message : "Connection lost. Please try again."); }
  }
  if (status === "sent") return <div className="book-success" role="status"><Art name="book" /><h3>Message delivered.</h3><p>Your message has been sent to Psymariux.</p><button className="pixel-button secondary" onClick={() => setStatus("idle")}>Write another message</button></div>;
  return <form className="contact-form" onSubmit={submit}>
    <div className="form-row"><label>Your name<input name="name" autoComplete="name" required maxLength={100} placeholder="Your name" /></label><label>Email<input name="email" type="email" autoComplete="email" required maxLength={254} placeholder="you@example.com" /></label></div>
    <label>Message<textarea name="message" required minLength={10} maxLength={1800} rows={5} placeholder="What would you like to discuss?" aria-describedby="message-help" /></label>
    <span id="message-help" className="form-help">10-1800 characters. Your message is sent privately to Psymariux.</span>
    <label className="honeypot" aria-hidden="true">Leave empty<input name="website" tabIndex={-1} autoComplete="off" /></label>
    {status === "error" && <p className="inline-error" role="alert">{error}</p>}
    <PixelButton disabled={status === "sending"} type="submit"><Icon name="mail" />{status === "sending" ? "Sending message..." : "Send message"}</PixelButton>
    <p className="form-help">You can also find me on <a href={githubProfileUrl} target="_blank" rel="noopener noreferrer">GitHub.</a></p>
  </form>;
}

function ActivityRows({ items, select, limit = 5 }: { items: (Commit | PullRequest)[]; select: (item: Commit | PullRequest) => void; limit?: number }) {
  if (!items.length) return <p className="empty-state">No public events in this view. Try another filter, or <a href={githubProfileUrl}>visit GitHub.</a></p>;
  return <div className="activity-rows">{items.slice(0, limit).map(item => <button className="activity-row" key={item.url} onClick={() => select(item)}>
    <Icon name={item.kind === "commit" ? "git-commit" : "git-branch"} />
    <span className="commit-code">{item.kind === "commit" ? item.sha.slice(0, 7) : `#${item.number}`}</span>
    <span className="activity-message"><span>{item.kind === "commit" ? text(item.message.split("\n")[0]) : text(item.title)}</span><small>{item.repository} <span className="metadata-sep">/</span> {formatDate(item.date)}{item.kind === "pr" ? ` / ${item.state}` : ""}</small></span>
    <Icon name="chevron-right" />
  </button>)}</div>;
}

function ProjectDetails({ project }: { project: Project }) {
  return <div className="project-details">
    <div className="project-detail-intro"><Art name="chest" open /><div><h3>{project.name}</h3><p>{project.description ? text(project.description) : "Public repository on Psymariux’s GitHub."}</p></div></div>
    {project.fork && <p className="source-note"><Icon name="git-branch" />Fork. The commit list includes upstream contributors.</p>}
    <div className="detail-actions"><External className="pixel-button" href={project.url}><Icon name="github" />GitHub repository</External>{project.homepage && <External className="pixel-button secondary" href={project.homepage}>Live project</External>}</div>
    {project.readme && <section className="detail-section"><h4>From the README</h4><p className="readme-summary">{text(project.readme)}</p></section>}
    <dl className="repository-specs"><div><dt>Default branch</dt><dd>{project.branch}</dd></div><div><dt>Created</dt><dd>{formatDate(project.created)}</dd></div><div><dt>Updated</dt><dd>{formatDate(project.updated)}</dd></div><div><dt>Repository size</dt><dd>{project.size.toLocaleString()} KB</dd></div><div><dt>Stars</dt><dd>{project.stars}</dd></div><div><dt>Forks</dt><dd>{project.forks}</dd></div></dl>
    {project.technologies.length > 0 && <section className="detail-section"><h4>Technologies</h4><div className="tech-tags">{project.technologies.map(tech => <span key={tech}>{tech}</span>)}</div><p className="form-help">Signals from GitHub languages, topics and public package manifests.</p></section>}
    {Object.keys(project.languages).length > 0 && <details className="pixel-disclosure"><summary>Language breakdown</summary><dl className="language-details">{Object.entries(project.languages).map(([name, bytes]) => <div key={name}><dt>{name}</dt><dd>{bytes.toLocaleString()} bytes</dd></div>)}</dl></details>}
    {(project.commits.length > 0 || project.latestCommit) && <section className="detail-section"><h4>Latest commits</h4>{(project.commits.length ? project.commits : project.latestCommit ? [project.latestCommit] : []).slice(0, 4).map(c => <External key={c.sha} href={c.url} className="commit-link"><code>{c.sha.slice(0, 7)}</code><span>{text(c.message.split("\n")[0])}<small>{c.author} / {formatDate(c.date)}</small></span></External>)}</section>}
    {project.pullRequests.length > 0 && <details className="pixel-disclosure"><summary>Recent pull requests ({project.pullRequests.length})</summary>{project.pullRequests.slice(0, 8).map(pr => <External className="pr-link" key={pr.number} href={pr.url}><span>#{pr.number} {text(pr.title)}</span><small>{pr.state}</small></External>)}</details>}
    {project.releases.length > 0 && <section className="detail-section"><h4>Latest releases</h4>{project.releases.map(release => <External className="release-link" href={release.url} key={release.url}>{release.name}<small>{formatDate(release.date)}</small></External>)}</section>}
    {project.unavailable.length > 0 && <p className="source-note">GitHub could not load: {project.unavailable.join(", ")}.</p>}
  </div>;
}

export default function Workshop({ data: initialData }: { data: PortfolioData }) {
  const [data, setData] = useState(initialData);
  const [selected, setSelected] = useState<Station | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [activity, setActivity] = useState<Commit | PullRequest | null>(null);
  const [ready, setReady] = useState(false);
  const [sceneFailed, setSceneFailed] = useState(false);
  const [mountScene, setMountScene] = useState(false);
  const sceneController = useRef<SceneHandle | null>(null);
  const room = useRef<HTMLDivElement>(null);
  const [travelling, setTravelling] = useState<Station | null>(null);
  const [lit, setLit] = useState(true);
  const [sleeping, setSleeping] = useState(false);
  const prevLit = useRef(true);
  const sleepState = useRef(false), sleepEntries = useRef(0);
  const [dream, setDream] = useState(false), [dreamIntro, setDreamIntro] = useState(true), [dreamUnlocked, setDreamUnlocked] = useState(false);
  const [sound, setSound] = useState(false);
  const [musicPlaying, setMusicPlaying] = useState(false), [jukeboxOpen, setJukeboxOpen] = useState(false);
  const [insertedRecord, setInsertedRecord] = useState<number | null>(null);
  const [activityFilter, setActivityFilter] = useState("commit");
  const [repositoryFilter, setRepositoryFilter] = useState("all");
  const [forgeName, setForgeName] = useState<string | null>(null);
  const [entered, setEntered] = useState(false);
  const enter = useCallback(() => setEntered(true), []);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState("");
  const [skill, setSkill] = useState<string | null>(null);
  const lastTrigger = useRef<HTMLElement | null>(null);
  const commandTrigger = useRef<HTMLButtonElement>(null), [commandOpen, setCommandOpen] = useState(false);
  const audio = useRef<AudioContext | null>(null);
  const chidoriBuffer = useRef<Promise<AudioBuffer> | null>(null);
  const chidoriSource = useRef<AudioBufferSourceNode | null>(null);
  const sealsBuffer = useRef<Promise<AudioBuffer> | null>(null);
  const sealsSource = useRef<AudioBufferSourceNode | null>(null);
  const audioEnabled = useRef(false), soundGeneration = useRef(0), sealsGeneration = useRef(0);
  const chestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [openingChest, setOpeningChest] = useState<string | null>(null);
  const cancelChest = useCallback(() => { if (chestTimer.current) clearTimeout(chestTimer.current); chestTimer.current = null; setOpeningChest(null); }, []);
  const stopChidori = useCallback(() => { soundGeneration.current++; chidoriSource.current?.stop(); chidoriSource.current = null; }, []);
  const stopSeals = useCallback(() => { sealsGeneration.current++; sealsSource.current?.stop(); sealsSource.current = null; }, []);
  const stopRitual = useCallback(() => { stopChidori(); stopSeals(); }, [stopChidori, stopSeals]);
  const onTravel = useCallback((id: Station | null) => { setTravelling(id); if (id !== null && id !== "about") stopRitual(); }, [stopRitual]);
  const prepareChidori = useCallback(() => {
    const context = resumeAudio(audio);
    chidoriBuffer.current ||= fetch("/audio/chidori.mp3").then(response => { if (!response.ok) throw new Error("Chidori audio unavailable"); return response.arrayBuffer(); }).then(bytes => context.decodeAudioData(bytes)).catch(error => { chidoriBuffer.current = null; throw error; });
    return chidoriBuffer.current;
  }, []);
  const prepareSeals = useCallback(() => {
    const context = resumeAudio(audio);
    sealsBuffer.current ||= fetch("/audio/seals.mp3").then(response => { if (!response.ok) throw new Error("Seals audio unavailable"); return response.arrayBuffer(); }).then(bytes => context.decodeAudioData(bytes)).catch(error => { sealsBuffer.current = null; throw error; });
    return sealsBuffer.current;
  }, []);
  useEffect(() => {
    let unlocked = false;
    const unlock = (event: Event) => {
      if (!event.isTrusted || unlocked || (event instanceof KeyboardEvent && (event.repeat || event.key === "Escape"))) return;
      unlocked = true; audioEnabled.current = true; setSound(true);
      try { resumeAudio(audio); } catch { /* Sound is optional if the browser cannot create a context. */ }
      window.removeEventListener("click", unlock); window.removeEventListener("keydown", unlock);
    };
    window.addEventListener("click", unlock); window.addEventListener("keydown", unlock);
    return () => { window.removeEventListener("click", unlock); window.removeEventListener("keydown", unlock); };
  }, []);
  function toggleSound() {
    audioEnabled.current = !sound; setSound(!sound);
    if (!audioEnabled.current) stopRitual();
    else { try { void prepareChidori().catch(() => {}); void prepareSeals().catch(() => {}); } catch { /* Audio is optional. */ } }
  }
  const onReady = useCallback((success: boolean) => { setReady(success); setSceneFailed(!success); }, []);
  const onSleepChange = useCallback((asleep: boolean) => {
    if (sleepState.current === asleep) return;
    sleepState.current = asleep; setSleeping(asleep);
    if (asleep) {
      prevLit.current = lit; setLit(false); stopRitual();
      if (++sleepEntries.current >= 2) {
        setSelected(null); setDreamIntro(true); setDream(true); setDreamUnlocked(true);
        try { sessionStorage.setItem("psymariux:dream-unlocked", "1"); } catch { /* The dream also works without storage. */ }
      }
    } else setLit(prevLit.current);
  }, [lit, stopRitual]);
  const closeDream = useCallback(() => { setDream(false); sceneController.current?.reset(); if (!ready) onSleepChange(false); }, [onSleepChange, ready]);
  function resumeDream() { closePanels(); setDreamIntro(false); setDream(true); }
  useEffect(() => { try { if (/^#world=[a-f0-9]{24}$/.test(location.hash) || sessionStorage.getItem("psymariux:dream-unlocked") === "1") setDreamUnlocked(true); } catch { /* Storage is optional. */ } }, []);
  function toggleNight() {
    // The moon puts Psymariux to bed (night dims the room). Anything else
    // wakes him: he grabs a torch and walks over to open it.
    if (sleeping) {
      if (sceneController.current && ready) sceneController.current.reset();
      else onSleepChange(false);
    } else {
      if (selected) closePanels();
      if (sceneController.current && ready) sceneController.current.visit("sleep");
      else onSleepChange(true);
    }
  }
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape" && !event.defaultPrevented && !dream && !commandOpen) { cancelChest(); stopRitual(); if (sleeping) { if (ready) sceneController.current?.reset(); else onSleepChange(false); } } };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [cancelChest, stopRitual, sleeping, dream, commandOpen, ready, onSleepChange]);
  useEffect(() => () => {
    if (chestTimer.current) clearTimeout(chestTimer.current);
    audioEnabled.current = false; stopRitual();
    const context = audio.current; audio.current = null;
    chidoriBuffer.current = null; sealsBuffer.current = null;
    if (context && context.state !== "closed") void context.close().catch(() => {});
  }, [stopRitual]);
  // Paint the original room image first. WebGL enhances it only after critical assets load.
  useEffect(() => {
    let idle: number | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = () => {
      if ("requestIdleCallback" in window) idle = window.requestIdleCallback(() => setMountScene(true), { timeout: 1500 });
      else timer = setTimeout(() => setMountScene(true), 0);
    };
    if (document.readyState === "complete") load(); else window.addEventListener("load", load, { once: true });
    return () => { window.removeEventListener("load", load); if (idle !== undefined) window.cancelIdleCallback(idle); if (timer !== undefined) clearTimeout(timer); };
  }, []);
  const play = useCallback((kind: string) => {
    window.dispatchEvent(new CustomEvent("workshop:interaction", { detail: { kind } }));
    if (!sound || kind === "about") return;
    if (kind === "seals") {
      try {
        const generation = ++sealsGeneration.current;
        sealsSource.current?.stop(); sealsSource.current = null;
        void prepareSeals().then(buffer => {
          if (!audioEnabled.current || generation !== sealsGeneration.current || !audio.current || audio.current.state === "closed") return;
          const context = audio.current, source = context.createBufferSource(), gain = context.createGain();
          source.buffer = buffer; gain.gain.setValueAtTime(.25, context.currentTime);
          source.connect(gain); gain.connect(context.destination); sealsSource.current = source;
          source.onended = () => { source.disconnect(); gain.disconnect(); if (sealsSource.current === source) sealsSource.current = null; };
          source.start();
        }).catch(() => {});
      } catch { /* The CC0 swishes are optional; no substitute tone. */ }
      return;
    }
    if (kind === "chidori") {
      try {
        const generation = ++soundGeneration.current;
        chidoriSource.current?.stop(); chidoriSource.current = null;
        void prepareChidori().then(buffer => {
          if (!audioEnabled.current || generation !== soundGeneration.current || !audio.current || audio.current.state === "closed") return;
          const context = audio.current, source = context.createBufferSource(), gain = context.createGain();
          source.buffer = buffer; gain.gain.setValueAtTime(.3, context.currentTime);
          source.connect(gain); gain.connect(context.destination); chidoriSource.current = source;
          source.onended = () => { source.disconnect(); gain.disconnect(); if (chidoriSource.current === source) chidoriSource.current = null; };
          source.start();
        }).catch(() => {});
      } catch { /* The provided clip is optional; no substitute tone. */ }
      return;
    }
    try {
      const context = resumeAudio(audio), osc = context.createOscillator(), gain = context.createGain();
      osc.type = "sine"; osc.frequency.setValueAtTime(kind === "projects" ? 330 : 440, context.currentTime);
      gain.gain.setValueAtTime(.035, context.currentTime); gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + .065);
      osc.connect(gain); gain.connect(context.destination); osc.onended = () => { osc.disconnect(); gain.disconnect(); }; osc.start(); osc.stop(context.currentTime + .07);
    } catch { /* Audio is optional; navigation never depends on it. */ }
  }, [sound, prepareChidori, prepareSeals]);
  const onChidori = useCallback(() => play("chidori"), [play]);
  const onSeals = useCallback(() => play("seals"), [play]);
  function particles(event?: React.MouseEvent) {
    if (!event || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    for (let i = 0; i < 5; i++) {
      const particle = document.createElement("i"); particle.className = "interaction-particle";
      particle.style.cssText = `left:${event.clientX}px;top:${event.clientY}px;--dx:${(i - 2) * 13}px;--dy:${-18 - (i % 3) * 12}px`;
      document.body.append(particle); setTimeout(() => particle.remove(), 500);
    }
  }
  const open = useCallback((id: Station, preserveTrigger = false) => {
    cancelChest();
    if (!ready && sleepState.current) onSleepChange(false);
    if (!preserveTrigger) { lastTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; sceneController.current?.reset(); }
    if (id === "jukebox") {
      setSelected(null); sceneController.current?.reset(); setJukeboxOpen(true);
      return;
    }
    setProject(null); setActivity(null); setSelected(id); play(id);
  }, [play, cancelChest, ready, onSleepChange]);
  const closePanels = useCallback(() => { cancelChest(); stopRitual(); setSelected(null); setProject(null); setActivity(null); setSkill(null); }, [cancelChest, stopRitual]);
  const showCommands = useCallback(() => {
    if (!entered || dream || selected !== null) return;
    cancelChest(); stopRitual(); if (travelling) sceneController.current?.reset(); setCommandOpen(true);
  }, [entered, dream, selected, travelling, cancelChest, stopRitual]);
  useEffect(() => {
    const navigate = (event: KeyboardEvent) => {
      if (event.repeat || event.isComposing || event.altKey || !(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "k" || !entered || dream || selected !== null) return;
      event.preventDefault(); if (commandOpen) setCommandOpen(false); else showCommands();
    };
    window.addEventListener("keydown", navigate); return () => window.removeEventListener("keydown", navigate);
  }, [entered, dream, selected, commandOpen, showCommands]);
  const completeVisit = useCallback((id: Station) => { if (id === "sleep") onSleepChange(true); else open(id, true); }, [open, onSleepChange]);
  function visit(id: Station) {
    cancelChest();
    lastTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!ready || !sceneController.current) { if (id === "sleep") { onSleepChange(true); return; } if (sleepState.current) onSleepChange(false); if (id === "about") onChidori(); open(id, true); return; }
    const rect = room.current?.getBoundingClientRect();
    if (rect && (rect.top < 0 || rect.bottom > window.innerHeight)) room.current?.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    sceneController.current.visit(id);
  }
  function openProject(p: Project, event?: React.MouseEvent) {
    cancelChest(); sceneController.current?.reset();
    if (!ready && sleepState.current) onSleepChange(false);
    if (selected === null) lastTrigger.current = event?.currentTarget as HTMLElement || document.activeElement as HTMLElement;
    setOpeningChest(p.name); particles(event);
    const finish = () => { chestTimer.current = null; setProject(p); setActivity(null); setSelected("projects"); play("projects"); };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) finish();
    else chestTimer.current = setTimeout(finish, 420);
  }
  function openActivity(item: Commit | PullRequest) { sceneController.current?.reset(); if (!ready && sleepState.current) onSleepChange(false); if (selected === null) lastTrigger.current = document.activeElement as HTMLElement; setActivity(item); setSelected("activity"); play("activity"); }
  async function refresh() {
    setRefreshing(true); setRefreshError("");
    try { const response = await fetch("/api/github"); if (!response.ok) throw new Error(); const next = await response.json(); setData(next); } catch { setRefreshError("GitHub could not be reached. Your current workshop data is still here."); }
    finally { setRefreshing(false); }
  }
  const technologies = data.stats.languages.slice(0, 8).map(l => l.name);
  const visibleActivity = data.activity.filter(item => (activityFilter === "all" || item.kind === activityFilter) && (repositoryFilter === "all" || item.repository === repositoryFilter));
  const activeProjects = data.projects.filter(p => data.stats.recentlyActive.includes(p.name));
  const forgeProject = activeProjects.find(p => p.name === forgeName) || activeProjects[0];
  const forgeCommit = forgeProject?.commits.find(c => isDeveloperAuthor(c.author));
  const commands: WorkshopCommand[] = [
    ...stationInfo.map(station => ({ id: station.id, label: station.name, detail: station.action, keywords: `${station.id} ${station.id === "activity" ? "github commits pull requests log lever leva attività" : station.id === "skills" ? "inventory languages tools crafting competenze" : station.id === "contact" ? "email message contatti" : station.id === "sleep" ? "night nap riposo letto" : station.id === "about" ? `profile developer ${githubHandle} chi sono` : station.id === "projects" ? "repositories source progetti" : station.id === "furnace" ? "active work lavoro" : station.id === "jukebox" ? "music musica c418 sweden moog city discs" : "stream cinema anime"}`, art: `/art/${station.art === "mascot" ? "psymariux-head" : station.art}.png`, run: () => visit(station.id) })),
    ...data.projects.map(p => ({ id: `repository:${p.name}`, label: p.name, detail: `${p.fork ? "Featured fork" : "Public repository"}${p.language ? ` / ${p.language}` : ""}`, keywords: `${p.description ?? ""} ${p.technologies.join(" ")}`, art: "/art/chest.png", run: () => openProject(p) })),
    ...(dreamUnlocked ? [{ id: "dream", label: "Resume dream", detail: "Return to your shinobi world", keywords: "ninja game sandbox shinobi gioco", art: "/art/bed.png", run: resumeDream }] : []),
  ];
  const dialogTitle = project?.name || (activity ? (activity.kind === "commit" ? "Commit log" : "Pull request") : stationInfo.find(s => s.id === selected)?.name || "Workshop");
  return <>
    {!entered && <EntryLoader ready={ready || sceneFailed} onDone={enter} />}
    <a className="skip-link" href="#projects" inert={!entered}>Skip to projects</a>
    <div className="site-shell" data-lights={lit ? "warm" : "dim"} inert={!entered || dream}>
      <header className="workshop-header"><a className="brand" href="#home" aria-label="Psymariux workshop home"><span className="italian-signature" aria-label="Italian signature"><i /><i /><i /></span><span>Psymariux<span className="brand-caption">developer workshop</span></span></a>
        <div className="ambient-controls"><button ref={commandTrigger} className="icon-button command-toggle" onClick={showCommands} aria-label="Open quick navigation" aria-haspopup="dialog" aria-keyshortcuts="Control+k Meta+k" title="Quick navigation (Ctrl/Cmd+K)"><Icon name="search" /><kbd>Ctrl K</kbd></button>{dreamUnlocked && <button className="text-button dream-resume" onClick={resumeDream}>{typeof window !== "undefined" && /^#world=[a-f0-9]{24}$/.test(location.hash) ? "Join shared world" : "Resume dream"}</button>}<button className="icon-button" onClick={toggleSound} aria-label={sound ? "Turn sound effects off" : "Turn sound effects on"} aria-pressed={sound} title={sound ? "Sound effects on" : "Sound effects off"}><Icon name={sound ? "volume-2" : "volume-x"} /></button><button className="icon-button" onClick={toggleNight} aria-label={sleeping ? "Wake Psymariux" : "Put Psymariux to sleep"} aria-pressed={sleeping} title={sleeping ? "Wake up" : "Night"}><Icon name={sleeping ? "sun" : "moon"} /></button></div>
      </header>
      <main id="home">
        <section className="hero" aria-labelledby="welcome-heading">
          <div className="hero-copy"><Art name="mascot" className="hero-portrait" /><h1 id="welcome-heading"><span className="hello">Hello, I’m</span><span className="hero-name">PsyMariux<span className="name-dot">.</span></span></h1><p className="workshop-welcome">Welcome to my workshop.</p><p className="hero-description">I build game worlds and backend tools.</p><PixelButton className="hero-cta" onClick={event => { visit("projects"); particles(event); }}><Icon name="archive" />Open projects<Icon name="arrow-right" /></PixelButton><button className="text-button about-link" onClick={() => visit("about")}>Meet the developer</button></div>
          <div className="room-wrap" ref={room}><div className="room-stage" aria-label="Interactive Minecraft developer workshop">
            {!ready && <img className="scene-static" src="/art/workshop.webp" alt="PsyMariux’s blue Minecraft character in a stone-and-wood developer workshop." width={847} height={520} fetchPriority="high" />}
            {!ready && !sceneFailed && <div className="room-loading"><FurnaceLoader label="Lighting the workshop" /></div>}
            {mountScene && <Scene onSelect={completeVisit} selected={selected} lit={lit} suspended={dream} musicPlaying={musicPlaying} insertedRecord={insertedRecord} onReady={onReady} controllerRef={sceneController} onTravel={onTravel} onChidori={onChidori} onSeals={onSeals} onSleepChange={onSleepChange} />}
            <div className="room-ground" aria-hidden="true" />
          </div><div className="room-guide"><RetroBubble role="status">{travelling ? `Heading to ${stationInfo.find(s => s.id === travelling)?.name}…` : "Choose an object. I’ll take you there."}</RetroBubble>{travelling && <button className="text-button travel-cancel" onClick={() => sceneController.current?.reset()}>Cancel / Esc</button>}</div><div className="room-caption"><Icon name="code" /><span>Click to explore. Escape to return.</span></div></div>
        </section>
        <nav className="station-shelf" aria-label="Workshop objects">{stationInfo.filter(station => station.id !== "jukebox").map(station => <button className={`station station-${station.art}`}  key={station.id} onClick={event => { visit(station.id); particles(event); }} aria-haspopup={station.id === "sleep" || station.id === "jukebox" ? undefined : "dialog"}><Art name={station.art} open={station.id === "projects" && (travelling === "projects" || selected === "projects")} /><span><strong>{station.name}</strong><small>{station.action}</small></span><Icon name="chevron-right" /></button>)}</nav>
        <PsyStream onDetails={() => open("psystream")} />
        <PixelReveal variant="chest"><section className="projects-section" id="projects" aria-labelledby="projects-heading"><div className="section-title"><Art name="chest" /><div><h2 id="projects-heading">Projects</h2><p>Source code and recent work from my public repositories.</p></div><External href={githubProfileUrl} className="quiet-link">View GitHub</External></div>
          {data.status === "cached" && <p role="status" className="data-notice">GitHub is unavailable. Showing saved public data from {formatDate(data.fetchedAt)}.</p>}
          <div className="project-grid">{data.projects.map((p, i) => <button key={p.name} className="project-chest" data-opening={openingChest === p.name} onClick={event => openProject(p, event)} aria-haspopup="dialog"><div className="project-chest-art"><Art name="chest" open={openingChest === p.name || project?.name === p.name} /><div className="chest-spark" aria-hidden="true" /><span className="repository-type">{p.fork ? "Featured fork" : "Public repository"}</span></div><div className="project-card-content"><div className="project-name-row"><h3>{p.name}</h3><Icon name="chevron-right" /></div><p>{excerpt(p.description || p.readme || "Explore the source code and repository details.")}</p><div className="project-tags">{p.language && <span><Icon name="code" />{p.language}</span>}<span><Icon name="star" />{p.stars}</span>{data.stats.recentlyActive.includes(p.name) && <span className="active-work"><Icon name="fire" />On the workbench</span>}</div><span className="chest-open-label">Open chest <Icon name="arrow-right" /></span></div><span className="chest-corner" aria-hidden="true" style={{ opacity: i % 2 ? .6 : 1 }} /></button>)}</div>
          {!data.projects.length && <p className="empty-state">No public projects to show. <a href={githubProfileUrl}>Visit GitHub.</a></p>}
        </section></PixelReveal>
        <PixelReveal variant="craft"><section className="workbench-section" id="skills" aria-labelledby="skills-heading"><div className="crafting-intro"><Art name="craft" /><h2 id="skills-heading">Languages</h2><p>Select a language to see the repositories that use it.</p><button className="text-button" onClick={() => open("skills")}>Explore the inventory <Icon name="arrow-right" /></button></div><div className="inventory-board"><div className="inventory-header"><span>Crafting inventory</span><Icon name="code" /></div><div className="inventory-grid">{technologies.map((tech, i) => <button className="inventory-slot" key={tech} onClick={event => { setSkill(tech); open("skills"); particles(event); }} aria-label={`Explore ${tech} in public repositories`}><span className={`item-symbol item-${i % 4}`} aria-hidden="true"><Icon name={i % 3 === 0 ? "code" : i % 3 === 1 ? "terminal" : "git-branch"} /></span><span>{tech}</span></button>)}</div><div className="inventory-note"><Icon name="github" />Language data from GitHub.</div></div></section></PixelReveal>
        <PixelReveal variant="signal"><section className="terminal-section" id="github" aria-labelledby="terminal-heading"><div className="section-title"><Art name="terminal" /><div><h2 id="terminal-heading">GitHub activity</h2><p>My recent commits and pull requests.</p></div></div><div className="terminal" data-powered={refreshing ? "checking" : "ready"}><div className="redstone-bus" aria-hidden="true"><i /><span className="redstone-wire" /><i /><span className="redstone-wire" /><i /></div><div className="terminal-chrome"><span><Icon name="terminal" />Commit log</span><span className="terminal-source"><i className="signal-lamp" aria-hidden="true" />github / {githubHandle}</span></div><div className="terminal-tools"><div className="terminal-tabs" role="group" aria-label="Filter public activity">{[["all", "All activity"], ["commit", "Commits"], ["pr", "Pull requests"]].map(([value, label]) => <button key={value} aria-pressed={activityFilter === value} onClick={() => setActivityFilter(value)}>{label}</button>)}</div><button className="text-button refresh-button" onClick={refresh} disabled={refreshing}>{refreshing ? "Checking..." : "Refresh"}<Icon name="git-branch" /></button></div><div className="repository-filter"><label htmlFor="repository-filter">Repository</label><select id="repository-filter" value={repositoryFilter} onChange={event => setRepositoryFilter(event.target.value)}><option value="all">All repositories</option>{Array.from(new Set(data.activity.map(item => item.repository))).map(name => <option key={name} value={name}>{name}</option>)}</select><span>{visibleActivity.length} recorded events</span></div><ActivityRows items={visibleActivity} select={openActivity} limit={5} />{refreshError && <p className="inline-error" role="alert">{refreshError}</p>}<div className="terminal-footer"><span><Icon name="git-commit" />Last 45 days / public activity only</span><button className="text-button" onClick={() => open("activity")}>Open the log<Icon name="arrow-right" /></button></div></div></section></PixelReveal>
        <PixelReveal variant="book"><section className="contact-section" id="contact" aria-labelledby="contact-heading"><div className="contact-decoration" aria-hidden="true"><Art name="book" /><i /><i /><i /></div><div><h2 id="contact-heading">Get in touch</h2><p>Send me a message about a project or collaboration.</p><PixelButton className="contact-cta" onClick={() => open("contact")}><Icon name="mail" />Get in touch<Icon name="arrow-right" /></PixelButton></div><span className="book-binding" aria-hidden="true" /></section></PixelReveal>
      </main>
      <footer className="workshop-footer"><div className="footer-identity"><Art name="mascot" /><span>Psymariux</span></div><div className="campfire"><Art name="campfire" /><span>Thanks for stopping by.</span></div><External href={githubProfileUrl} className="quiet-link"><Icon name="github" />@{githubHandle}</External><span className="copyright">© {new Date().getFullYear()} Psymariux</span></footer>
    </div>
    <Jukebox suspended={dream} available={entered && !dream && selected === null && !commandOpen} open={jukeboxOpen} onOpenChange={setJukeboxOpen} onPlaying={setMusicPlaying} onRecordChange={setInsertedRecord} />
    <QuickNavigate open={commandOpen} onOpenChange={setCommandOpen} commands={commands} trigger={commandTrigger} />
    {dream && <NinjaDream sound={sound} intro={dreamIntro} onClose={closeDream} />}
    <Dialog.Root open={selected !== null} onOpenChange={value => { if (!value) closePanels(); }}><Dialog.Portal><Dialog.Overlay className="dialog-overlay" /><Dialog.Content className={`workshop-dialog dialog-${selected}`} onCloseAutoFocus={event => { event.preventDefault(); lastTrigger.current?.focus(); }}><div className="dialog-top"><Dialog.Title>{dialogTitle}</Dialog.Title><Dialog.Close className="icon-button" aria-label="Close workshop panel"><Icon name="close" /></Dialog.Close></div><Dialog.Description className="sr-only">{selected === "contact" ? "Write a private message to Psymariux." : "Explore Psymariux’s public development work. Press Escape to return to the workshop."}</Dialog.Description><div className="dialog-body">
      {selected === "about" && <div className="about-panel"><Art name="mascot" /><h3>Hey, I’m Psymariux.</h3><p>I build game worlds and backend tools.</p>{data.profile.bio && <p className="profile-bio">{text(data.profile.bio)}</p>}<External className="pixel-button" href={githubProfileUrl}><Icon name="github" />@{githubHandle} on GitHub</External></div>}
      {selected === "psystream" && <PsyStreamDetails />}
      {selected === "projects" && (project ? <ProjectDetails project={project} /> : <><p className="panel-intro">Pick a repository to open its chest.</p><div className="project-list">{data.projects.map(p => <button key={p.name} onClick={() => openProject(p)}><Art name="chest" open={openingChest === p.name} /><span><strong>{p.name}</strong><small>{p.language || "Public repository"}{p.fork ? " / Featured fork" : ""}</small></span><Icon name="chevron-right" /></button>)}</div></>)}
      {selected === "skills" && <><p className="panel-intro">Select a language to see where I use it.</p><div className="skill-tabs">{technologies.map((tech, i) => <button key={tech} className={`inventory-slot ${skill === tech ? "selected" : ""}`} aria-pressed={skill === tech} onClick={() => { setSkill(tech); play("skills"); }}><span className={`item-symbol item-${i % 4}`}><Icon name="code" /></span>{tech}</button>)}</div>{skill && <div className="skill-results"><h3>{skill} is used in</h3>{data.projects.filter(p => skill in p.languages).map(p => <button className="commit-link" key={p.name} onClick={() => openProject(p)}><Art name="chest" open={openingChest === p.name} /><span>{p.name}</span><Icon name="chevron-right" /></button>)}</div>}<p className="source-note">GitHub counts bytes of code, including code in forks. These totals do not rate proficiency.</p></>}
      {selected === "furnace" && <><p className="panel-intro">Choose a project to inspect its latest commit.</p>{forgeProject ? <><div className="forge-tabs" role="group" aria-label="Choose a project">{activeProjects.map(p => <button key={p.name} aria-pressed={forgeProject.name === p.name} onClick={() => { setForgeName(p.name); play("furnace"); }}>{p.name}</button>)}</div><div className="forge-recipe" key={forgeProject.name}><div className="forge-input"><span className="recipe-label">Commit / code</span><div className="recipe-slot"><Icon name="git-commit" /></div>{forgeCommit ? <button className="forge-commit" onClick={() => openActivity(forgeCommit)}><code>{forgeCommit.sha.slice(0, 7)}</code><span>{text(forgeCommit.message.split("\n")[0])}</span><small>{formatDate(forgeCommit.date)} / View commit</small></button> : <p>Commit details unavailable.</p>}</div><div className="forge-machine"><Art name="furnace" /><span className="forge-flame" aria-hidden="true"><i /><i /><i /></span><Icon name="arrow-right" /></div><div className="forge-output"><span className="recipe-label">Project</span><button className="forge-project" onClick={() => openProject(forgeProject)} aria-label={`Open ${forgeProject.name} project`}><span className="recipe-slot"><Art name="chest" /></span><h3>{forgeProject.name}</h3><small>{forgeProject.branch} branch</small><span className="text-button">Open project <Icon name="arrow-right" /></span></button></div><div className="forge-fuel"><span className="recipe-label"><Icon name="fire" />Tools</span><div className="tech-tags">{forgeProject.technologies.slice(0, 6).map(tech => <span key={tech}>{tech}</span>)}</div>{!forgeProject.technologies.length && <p>GitHub has no tool data for this project.</p>}</div></div></> : <p className="empty-state">No recent public commits to show.</p>}</>}
      {selected === "activity" && (activity ? <div className="commit-details"><Icon name={activity.kind === "commit" ? "git-commit" : "git-branch"} /><code>{activity.kind === "commit" ? activity.sha.slice(0, 7) : `PR #${activity.number}`}</code><h3>{activity.kind === "commit" ? text(activity.message.split("\n")[0]) : text(activity.title)}</h3><dl className="repository-specs"><div><dt>Repository</dt><dd>{activity.repository}</dd></div><div><dt>Author</dt><dd>{activity.author}</dd></div><div><dt>Date (UTC)</dt><dd>{new Date(activity.date).toLocaleString("en-GB", { timeZone: "UTC" })}</dd></div><div><dt>{activity.kind === "commit" ? "Branch context" : "Status"}</dt><dd>{activity.kind === "commit" ? activity.branch : activity.state}</dd></div></dl>{activity.kind === "commit" && activity.message.includes("\n") && <pre className="commit-body">{text(activity.message)}</pre>}<External className="pixel-button" href={activity.url}>View on GitHub</External><button className="text-button back-to-log" onClick={() => setActivity(null)}>Back to activity</button></div> : <><p className="panel-intro">My default-branch commits and recently updated pull requests.</p><ActivityRows items={visibleActivity} select={item => setActivity(item)} limit={40} /></>)}
      {selected === "contact" && <><div className="contact-panel-header"><Art name="book" /><p>Write a message to Psymariux.</p></div><ContactBook /></>}
    </div></Dialog.Content></Dialog.Portal></Dialog.Root>
  </>;
}
