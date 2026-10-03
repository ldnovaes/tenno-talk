import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Search, Paperclip, Mic, Sparkles, SendHorizontal, Languages, Brain, Users, Heart, MoreHorizontal, Phone } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TENNO TALK — Translate the meaning" },
      { name: "description", content: "Multilingual AI chat that translates the meaning, not just the words." },
      { property: "og:title", content: "TENNO TALK — Translate the meaning" },
      { property: "og:description", content: "Multilingual AI chat that translates the meaning, not just the words." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const chats = [
  { name: "Cam ❤️", pair: "PT ↔ VI", time: "09:42", preview: "Ngủ rất ngon ạ ♡", init: "C", unread: 2 },
  { name: "Travel Group", pair: "PT ↔ EN", time: "08:15", preview: "Flight lands at 6pm!", init: "T" },
  { name: "Work", pair: "PT ↔ EN", time: "Yesterday", preview: "Let's sync on the roadmap.", init: "W" },
  { name: "Lucas", pair: "PT ↔ ES", time: "Yesterday", preview: "¿Jugamos esta noche?", init: "L" },
  { name: "Família", pair: "PT ↔ JA", time: "Mon", preview: "おやすみなさい 🌙", init: "F" },
  { name: "Game Friends", pair: "PT ↔ EN", time: "Sun", preview: "GG, that was close", init: "G" },
];

const messages = [
  { me: true, original: "Você dormiu bem, amor?", translation: "Em ngủ ngon không, tình yêu?", time: "09:38" },
  { me: false, original: "Ngủ rất ngon ạ ♡", translation: "Dormi muito bem ♡", time: "09:40" },
  { me: true, original: "Que bom 😊", translation: "Thật tốt quá 😊", time: "09:41" },
  { me: true, original: "Hoje foi um dia cansativo, mas você falando comigo já me deixa melhor.", translation: "Hôm nay là một ngày mệt mỏi, nhưng chỉ cần nói chuyện với anh là em đã thấy tốt hơn rồi.", time: "09:42" },
];

function Logo() {
  return (
    <div className="relative grid h-9 w-9 place-items-center rounded-xl border border-primary/40 bg-primary/10 shadow-glow">
      <div className="h-3.5 w-3.5 rotate-45 rounded-[3px] border-2 border-primary" />
    </div>
  );
}

function Bubble({ m }: { m: (typeof messages)[number] }) {
  const [orig, setOrig] = useState(false);
  return (
    <div className={`flex ${m.me ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[68%] rounded-2xl px-5 py-4 backdrop-blur-xl border ${m.me ? "rounded-br-md border-primary/25 bg-primary/12" : "rounded-bl-md border-border bg-secondary"}`}>
        <p className="text-xs text-muted-foreground">{m.original}</p>
        <p className="mt-1.5 text-[15px] font-medium leading-relaxed text-foreground">{m.translation}</p>
        {orig && <p className="mt-2 border-t border-border pt-2 text-xs italic text-muted-foreground">Original · {m.original}</p>}
        <div className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1 text-primary/80"><Languages className="h-3 w-3" />Translated by Tenno Talk</span>
          <button onClick={() => setOrig(!orig)} className="hover:text-foreground transition-colors">{orig ? "Hide original" : "Show original"}</button>
          <span className="ml-auto tabular-nums">{m.time}</span>
        </div>
      </div>
    </div>
  );
}

function Index() {
  const [active, setActive] = useState(0);
  const [ctx, setCtx] = useState(true);
  const [style, setStyle] = useState("Romantic");

  return (
    <div className="app-bg flex h-screen gap-4 overflow-hidden p-4 text-foreground">
      {/* Left */}
      <aside className="glass flex w-80 shrink-0 flex-col rounded-3xl bg-sidebar p-5">
        <div className="flex items-center gap-3">
          <Logo />
          <div>
            <h1 className="font-display text-lg font-semibold tracking-[0.18em]">TENNO TALK</h1>
            <p className="text-[11px] text-muted-foreground">Translate the meaning. Not just the words.</p>
          </div>
        </div>
        <button className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-send py-2.5 text-sm font-semibold text-primary-foreground shadow-glow transition hover:brightness-110">
          <Plus className="h-4 w-4" /> New Relay
        </button>
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-input bg-muted px-3 py-2.5">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input placeholder="Search conversations..." className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
        </div>
        <div className="mt-4 -mx-2 flex-1 space-y-1 overflow-y-auto">
          {chats.map((c, i) => (
            <button key={c.name} onClick={() => setActive(i)} className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${active === i ? "border border-primary/25 bg-sidebar-accent" : "border border-transparent hover:bg-sidebar-accent/50"}`}>
              <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full font-display text-sm font-semibold ${i === 0 ? "bg-send text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>{c.init}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold">{c.name}</span>
                  <span className="text-[10px] text-muted-foreground">{c.time}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold tracking-wider text-primary">{c.pair}</span>
                  <span className="truncate text-xs text-muted-foreground">{c.preview}</span>
                  {c.unread && <span className="ml-auto grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">{c.unread}</span>}
                </div>
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* Center */}
      <main className="glass relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-3xl">
        <div className="pointer-events-none absolute -left-20 top-1/3 h-80 w-80 rounded-full bg-primary/15 blur-3xl" />
        <div className="pointer-events-none absolute -right-10 bottom-10 h-72 w-72 rounded-full bg-accent/15 blur-3xl" />
        <header className="relative flex items-center gap-4 border-b border-border px-6 py-4">
          <div className="grid h-11 w-11 place-items-center rounded-full bg-send font-display font-semibold text-primary-foreground">C</div>
          <div>
            <h2 className="font-display text-base font-semibold">Cam ❤️</h2>
            <p className="text-xs text-muted-foreground">Portuguese ↔ Vietnamese</p>
          </div>
          <span className="ml-3 flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-3 py-1 text-[11px] font-medium text-success">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" /> Translation Relay Online
          </span>
          <div className="ml-auto flex gap-2 text-muted-foreground">
            <button className="rounded-lg p-2 hover:bg-muted"><Phone className="h-4 w-4" /></button>
            <button className="rounded-lg p-2 hover:bg-muted"><MoreHorizontal className="h-4 w-4" /></button>
          </div>
        </header>

        <div className="relative flex-1 space-y-5 overflow-y-auto px-8 py-6">
          <div className="text-center text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Today</div>
          {messages.map((m, i) => <Bubble key={i} m={m} />)}
          <div className="flex">
            <div className="flex items-center gap-3 rounded-2xl rounded-bl-md border border-border bg-secondary px-4 py-3 backdrop-blur-xl">
              <div className="flex gap-1">
                {[0, 1, 2].map((d) => <span key={d} className="typing-dot h-1.5 w-1.5 rounded-full bg-primary" style={{ animationDelay: `${d * 0.15}s` }} />)}
              </div>
              <span className="text-xs text-muted-foreground">Decoding translation...</span>
            </div>
          </div>
        </div>

        <div className="relative p-5">
          <div className="flex items-center gap-2 rounded-2xl border border-input bg-muted px-3 py-2 backdrop-blur-xl focus-within:border-primary/40">
            <button className="rounded-lg p-2 text-muted-foreground hover:text-foreground"><Paperclip className="h-4 w-4" /></button>
            <input placeholder="Type a message..." className="flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground" />
            <button className="rounded-lg p-2 text-muted-foreground hover:text-foreground"><Mic className="h-4 w-4" /></button>
            <button className="rounded-lg p-2 text-primary hover:brightness-125"><Sparkles className="h-4 w-4" /></button>
            <button className="grid h-10 w-10 place-items-center rounded-xl bg-send text-primary-foreground shadow-glow transition hover:brightness-110"><SendHorizontal className="h-4 w-4" /></button>
          </div>
        </div>
      </main>

      {/* Right */}
      <aside className="glass flex w-80 shrink-0 flex-col gap-5 overflow-y-auto rounded-3xl bg-sidebar p-5">
        <h3 className="font-display text-xs font-semibold tracking-[0.22em] text-muted-foreground">CONVERSATION CONTEXT</h3>

        <div className="flex items-center gap-3 rounded-2xl border border-primary/25 bg-primary/10 p-3">
          <Brain className="h-5 w-5 text-primary" />
          <div className="text-sm">Context Memory: <span className="font-semibold text-primary">Active</span></div>
        </div>

        <Section icon={<Users className="h-3.5 w-3.5" />} title="Speakers">
          {[["You", "Portuguese"], ["Cam ❤️", "Vietnamese"]].map(([n, l]) => (
            <div key={n} className="flex justify-between rounded-xl bg-muted px-3 py-2 text-sm"><span>{n}</span><span className="text-muted-foreground">{l}</span></div>
          ))}
        </Section>

        <Section icon={<Heart className="h-3.5 w-3.5" />} title="Relationship">
          <span className="inline-block rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">Couple</span>
        </Section>

        <Section title="Conversation Context">
          <p className="rounded-xl border border-border bg-muted p-3 text-sm leading-relaxed text-secondary-foreground">
            We are a couple. I am Brazilian and she is Vietnamese. We speak affectionately and joke with each other frequently.
          </p>
        </Section>

        <div className="flex items-center justify-between rounded-2xl border border-border bg-muted p-3">
          <span className="text-sm font-medium">Context Translation</span>
          <button onClick={() => setCtx(!ctx)} className={`relative h-6 w-11 rounded-full transition ${ctx ? "bg-send shadow-glow" : "bg-secondary"}`}>
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-foreground transition-all ${ctx ? "left-[22px]" : "left-0.5"}`} />
          </button>
        </div>

        <Section title="Translation Style">
          <div className="grid grid-cols-2 gap-2">
            {["Natural", "Casual", "Romantic", "Formal"].map((s) => (
              <button key={s} onClick={() => setStyle(s)} className={`rounded-xl border py-2.5 text-sm transition ${style === s ? "border-primary/50 bg-primary/15 font-semibold text-primary shadow-glow" : "border-border bg-muted text-muted-foreground hover:text-foreground"}`}>{s}</button>
            ))}
          </div>
        </Section>
      </aside>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">{icon}{title}</div>
      {children}
    </div>
  );
}
