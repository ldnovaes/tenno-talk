import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Search,
  Plus,
  Paperclip,
  Mic,
  SendHorizontal,
  MoreVertical,
  Check,
  X,
  Brain,
  Smile,
} from "lucide-react";

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
  { name: "Travel Group", pair: "PT ↔ EN", time: "08:15", preview: "Flight lands at 6pm!", init: "T", unread: 0 },
  { name: "Work", pair: "PT ↔ EN", time: "Yesterday", preview: "Let's sync on the roadmap.", init: "W", unread: 0 },
  { name: "Lucas", pair: "PT ↔ ES", time: "Yesterday", preview: "¿Jugamos esta noche?", init: "L", unread: 0 },
  { name: "Família", pair: "PT ↔ JA", time: "Mon", preview: "おやすみなさい 🌙", init: "F", unread: 0 },
  { name: "Game Friends", pair: "PT ↔ EN", time: "Sun", preview: "GG, that was close", init: "G", unread: 0 },
];

const messages = [
  { me: true, original: "Você dormiu bem, amor?", translation: "Em ngủ ngon không, tình yêu?", time: "09:38" },
  { me: false, original: "Ngủ rất ngon ạ ♡", translation: "Dormi muito bem ♡", time: "09:40" },
  { me: true, original: "Que bom 😊", translation: "Thật tốt quá 😊", time: "09:41" },
  { me: true, original: "Hoje foi um dia cansativo, mas você falando comigo já me deixa melhor.", translation: "Hôm nay là một ngày mệt mỏi, nhưng chỉ cần nói chuyện với anh là em đã thấy tốt hơn rồi.", time: "09:42" },
];

function Bubble({ m }: { m: (typeof messages)[number] }) {
  const [showOriginal, setShowOriginal] = useState(true);
  return (
    <div className={`group flex max-w-[70%] flex-col ${m.me ? "self-end" : "self-start"}`}>
      {m.me ? (
        <div className="rounded-2xl rounded-tr-none bg-primary p-3 text-primary-foreground shadow-sm">
          {showOriginal && <p className="mb-1 leading-relaxed">{m.original}</p>}
          <div className="rounded-lg bg-white/10 p-2">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-tighter text-primary-foreground/70">Translated (VI)</span>
            <p className="text-sm text-primary-foreground/90">{m.translation}</p>
          </div>
          <div className="mt-1 flex items-center justify-end gap-1">
            <span className="text-[10px] text-primary-foreground/70">{m.time}</span>
            <Check className="h-3 w-3 text-primary-foreground/70" />
          </div>
        </div>
      ) : (
        <div className="rounded-2xl rounded-tl-none bg-card p-3 shadow-sm">
          {showOriginal && <p className="mb-1 leading-relaxed text-foreground">{m.original}</p>}
          <div className="mt-2 border-t border-border pt-2">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-tighter text-muted-foreground">Translated (PT)</span>
            <p className="text-sm italic text-muted-foreground">{m.translation}</p>
          </div>
          <div className="mt-1 flex justify-end">
            <span className="text-[10px] text-muted-foreground">{m.time}</span>
          </div>
        </div>
      )}
      <button
        onClick={() => setShowOriginal(!showOriginal)}
        className={`mt-1 self-start text-[10px] font-semibold text-primary transition-opacity hover:underline ${m.me ? "opacity-0 group-hover:opacity-100" : ""}`}
      >
        {showOriginal ? "Hide original" : "Show original"}
      </button>
    </div>
  );
}

function Index() {
  const [active, setActive] = useState(0);
  const [panelOpen, setPanelOpen] = useState(false);
  const [style, setStyle] = useState("Romantic");

  return (
    <div className="app-bg flex h-screen overflow-hidden text-foreground">
      {/* Contacts */}
      <aside className="flex w-80 shrink-0 flex-col border-r border-border bg-sidebar">
        <div className="flex items-center justify-between p-4">
          <h1 className="font-display text-xl font-semibold text-foreground">TENNO TALK</h1>
          <button className="rounded-full p-2 text-primary transition-colors hover:bg-primary/10">
            <Plus className="h-5 w-5" />
          </button>
        </div>

        <div className="px-4 pb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              placeholder="Search"
              className="w-full rounded-lg bg-muted py-2 pl-10 pr-4 text-sm outline-none ring-primary/40 focus:ring-2 placeholder:text-muted-foreground"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {chats.map((c, i) => (
            <button
              key={c.name}
              onClick={() => setActive(i)}
              className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${active === i ? "bg-primary text-primary-foreground" : "hover:bg-secondary/50"}`}
            >
              <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-full font-display text-lg font-bold ${active === i ? "bg-white/25 text-white" : "bg-primary/15 text-primary"}`}>{c.init}</div>
              <div className="min-w-0 flex-1">
                <div className="flex justify-between gap-2">
                  <span className="truncate font-semibold">{c.name}</span>
                  <span className={`text-xs ${active === i ? "opacity-80" : "text-muted-foreground"}`}>{c.time}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold tracking-wider ${active === i ? "opacity-90" : "text-primary"}`}>{c.pair}</span>
                  <span className={`truncate text-sm ${active === i ? "opacity-90" : "text-muted-foreground"}`}>{c.preview}</span>
                  {c.unread > 0 && (
                    <span className={`ml-auto grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] font-bold ${active === i ? "bg-white text-primary" : "bg-primary text-primary-foreground"}`}>{c.unread}</span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* Chat */}
      <main className="relative flex min-w-0 flex-1 flex-col bg-background">
        <header className="z-10 flex h-16 items-center justify-between border-b border-border bg-card px-6">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/15 font-display font-semibold text-primary">{chats[active].init}</div>
            <div>
              <h2 className="font-display font-semibold leading-tight text-foreground">{chats[active].name}</h2>
              <span className="text-xs text-primary">Online</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Translation</span>
              <span className="text-xs font-bold text-foreground">{chats[active].pair}</span>
            </div>
            <button onClick={() => setPanelOpen(!panelOpen)} className="rounded-full p-2 text-muted-foreground transition-colors hover:text-foreground">
              <MoreVertical className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
          <div className="self-center rounded-full bg-card px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Today</div>
          {messages.map((m, i) => <Bubble key={i} m={m} />)}
          <div className="flex self-start">
            <div className="flex items-center gap-3 rounded-2xl rounded-tl-none bg-card px-4 py-3 shadow-sm">
              <div className="flex gap-1">
                {[0, 1, 2].map((d) => <span key={d} className="typing-dot h-1.5 w-1.5 rounded-full bg-primary" style={{ animationDelay: `${d * 0.15}s` }} />)}
              </div>
              <span className="text-xs text-muted-foreground">Decoding translation...</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 border-t border-border bg-card p-4">
          <button className="text-muted-foreground transition-colors hover:text-primary"><Paperclip className="h-5 w-5" /></button>
          <div className="relative flex-1">
            <input
              placeholder="Type a message..."
              className="w-full rounded-xl bg-muted px-4 py-3 text-sm outline-none ring-primary/40 focus:ring-2 placeholder:text-muted-foreground"
            />
            <button className="absolute right-3 top-2.5 text-muted-foreground hover:text-primary"><Smile className="h-5 w-5" /></button>
          </div>
          <button className="text-muted-foreground transition-colors hover:text-primary"><Mic className="h-5 w-5" /></button>
          <button className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-glow transition hover:brightness-110">
            <SendHorizontal className="h-5 w-5" />
          </button>
        </div>

        {/* Settings slide-over */}
        <div className={`absolute inset-y-0 right-0 z-20 flex w-80 flex-col border-l border-border bg-card shadow-xl transition-transform duration-300 ${panelOpen ? "translate-x-0" : "translate-x-full"}`}>
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h3 className="font-display text-xs font-semibold tracking-[0.2em] text-muted-foreground">SETTINGS</h3>
            <button onClick={() => setPanelOpen(false)} className="rounded-full p-1.5 text-muted-foreground transition-colors hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-5 overflow-y-auto p-5">
            <div className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Translation Style</div>
              <div className="grid grid-cols-2 gap-2">
                {["Natural", "Casual", "Romantic", "Formal"].map((s) => (
                  <button
                    key={s}
                    onClick={() => setStyle(s)}
                    className={`rounded-xl border py-2.5 text-sm transition ${style === s ? "border-primary bg-primary/10 font-semibold text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-2xl border border-border bg-muted p-3">
              <Brain className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <p className="text-sm leading-relaxed text-muted-foreground">
                Context is automatic: Tenno Talk learns your style and relationship as you chat — no setup needed.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
