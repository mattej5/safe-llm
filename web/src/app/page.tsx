'use client';

import { useChat } from 'ai/react';
import { useEffect, useRef, useState } from 'react';
import {
  Send,
  Terminal,
  PanelLeftClose,
  PanelLeft,
  Plus,
  MessageSquare,
  Sparkles,
  Code,
  Mail,
  Search,
  MoreHorizontal,
} from 'lucide-react';
import clsx from 'clsx';

/* ─── Suggestion Cards ─── */
const SUGGESTIONS = [
  { icon: Sparkles, label: 'Generate a creative story', sub: 'about a time-traveling detective', color: 'from-purple-500/20 to-purple-600/10 border-purple-500/20 hover:border-purple-400/40' },
  { icon: Search, label: 'Explain complex concepts', sub: 'in simple, everyday terms', color: 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/20 hover:border-cyan-400/40' },
  { icon: Mail, label: 'Draft a professional email', sub: 'for a job application', color: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/20 hover:border-emerald-400/40' },
  { icon: Code, label: 'Write Python code', sub: 'for a data analysis script', color: 'from-amber-500/20 to-amber-600/10 border-amber-500/20 hover:border-amber-400/40' },
];

/* ─── Fake History ─── */
const HISTORY = [
  { title: 'Project Alpha Brainstorm', time: '3 hours ago' },
  { title: 'Code Review – Python', time: '5 hours ago' },
  { title: 'Marketing Copy Ideas', time: 'Yesterday' },
  { title: 'Quantum Physics Explain', time: 'Yesterday' },
  { title: 'Travel Itinerary – Japan', time: '2 days ago' },
];

export default function Chat() {
  const { messages, input, handleInputChange, handleSubmit, isLoading, append } = useChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  /* auto-scroll */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /* auto-resize textarea */
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
    }
  }, [input]);

  const onSuggestionClick = (text: string) => {
    append({ role: 'user', content: text });
  };

  /* ─── render message content (simple markdown-ish) ─── */
  const renderContent = (text: string) => {
    // Split into code blocks and normal text
    const parts = text.split(/(```[\s\S]*?```)/g);
    return parts.map((part, i) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const lines = part.split('\n');
        const lang = lines[0].replace('```', '').trim();
        const code = lines.slice(1, -1).join('\n');
        return (
          <div key={i} className="my-3 rounded-xl overflow-hidden border border-white/5">
            {lang && (
              <div className="bg-white/5 px-4 py-1.5 text-[11px] font-mono text-slate-400 border-b border-white/5">
                {lang}
              </div>
            )}
            <pre className="bg-[#0d1117] p-4 overflow-x-auto text-[13px] leading-relaxed">
              <code className="text-slate-300 font-mono">{code}</code>
            </pre>
          </div>
        );
      }
      // Inline code
      const inlined = part.split(/(`[^`]+`)/g);
      return (
        <span key={i}>
          {inlined.map((seg, j) =>
            seg.startsWith('`') && seg.endsWith('`') ? (
              <code key={j} className="bg-white/10 text-cyan-300 px-1.5 py-0.5 rounded-md text-[13px] font-mono">
                {seg.slice(1, -1)}
              </code>
            ) : (
              <span key={j}>{seg}</span>
            )
          )}
        </span>
      );
    });
  };

  return (
    <div className="flex h-screen bg-[#0a0f1e] text-slate-200 font-[Inter,system-ui,sans-serif] overflow-hidden">

      {/* ════════════ Sidebar ════════════ */}
      <aside
        className={clsx(
          'flex flex-col border-r border-white/5 bg-[#0c1222] transition-all duration-300 ease-in-out',
          sidebarOpen ? 'w-72' : 'w-0 overflow-hidden border-r-0'
        )}
      >
        {/* New Chat */}
        <div className="p-4">
          <button className="w-full flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition px-4 py-3 text-sm font-medium">
            <Plus className="w-4 h-4 text-slate-400" />
            New Chat
          </button>
        </div>

        {/* History */}
        <div className="flex-1 overflow-y-auto px-3 space-y-1">
          <div className="px-2 py-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Recent</div>
          {HISTORY.map((h, i) => (
            <button
              key={i}
              className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-400 hover:bg-white/5 hover:text-slate-200 transition group"
            >
              <MessageSquare className="w-4 h-4 shrink-0 opacity-50 group-hover:opacity-100" />
              <span className="flex-1 truncate text-left">{h.title}</span>
              <MoreHorizontal className="w-4 h-4 opacity-0 group-hover:opacity-50 shrink-0" />
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white">
              V
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">Vin Jones</div>
              <div className="text-[11px] text-slate-500">Free Plan</div>
            </div>
          </div>
        </div>
      </aside>

      {/* ════════════ Main ════════════ */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-14 flex items-center justify-between px-4 border-b border-white/5 bg-[#0a0f1e]/80 backdrop-blur-xl sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(o => !o)}
              className="p-2 rounded-lg hover:bg-white/5 transition text-slate-400"
            >
              {sidebarOpen ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeft className="w-5 h-5" />}
            </button>
            <span className="text-sm font-semibold text-slate-200">SafeLLM</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 text-xs text-slate-400">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Online
            </div>
          </div>
        </header>

        {/* Chat area */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 py-8">

            {/* — Empty state — */}
            {messages.length === 0 && (
              <div className="flex flex-col items-center pt-[12vh]">
                {/* Logo */}
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-purple-600/20 border border-white/10 flex items-center justify-center mb-6">
                  <Terminal className="w-10 h-10 text-cyan-400" />
                </div>
                <h2 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-500 bg-clip-text text-transparent mb-2">
                  SafeLLM
                </h2>
                <p className="text-slate-500 text-sm mb-12">Your Secure &amp; Advanced AI Assistant</p>

                {/* Suggestion grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-xl">
                  {SUGGESTIONS.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => onSuggestionClick(`${s.label} ${s.sub}`)}
                      className={clsx(
                        'flex items-start gap-3 rounded-xl border bg-gradient-to-br p-4 text-left transition-all duration-200',
                        s.color
                      )}
                    >
                      <s.icon className="w-5 h-5 mt-0.5 text-slate-300 shrink-0" />
                      <div>
                        <div className="text-sm font-medium text-slate-200">{s.label}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{s.sub}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* — Messages — */}
            {messages.map(m => (
              <div
                key={m.id}
                className={clsx(
                  'mb-6',
                  m.role === 'user' ? 'flex justify-end' : ''
                )}
              >
                <div
                  className={clsx(
                    'max-w-[85%] rounded-2xl px-5 py-3.5 text-[15px] leading-relaxed',
                    m.role === 'user'
                      ? 'bg-gradient-to-br from-cyan-600/30 to-blue-700/30 border border-cyan-500/20 text-slate-100'
                      : 'text-slate-300'
                  )}
                >
                  {m.role === 'assistant' && (
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center">
                        <Terminal className="w-3.5 h-3.5 text-white" />
                      </div>
                      <span className="text-xs font-semibold text-slate-400">SafeLLM</span>
                    </div>
                  )}
                  <div className="whitespace-pre-wrap">{renderContent(m.content || '')}</div>
                </div>
              </div>
            ))}

            {/* Loading */}
            {isLoading && (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center">
                    <Terminal className="w-3.5 h-3.5 text-white animate-pulse" />
                  </div>
                  <span className="text-xs font-semibold text-slate-400">SafeLLM</span>
                </div>
                <div className="flex items-center gap-1.5 pl-8">
                  <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* ─── Input bar ─── */}
        <div className="border-t border-white/5 bg-[#0a0f1e]">
          <div className="max-w-3xl mx-auto px-4 py-4">
            <form onSubmit={handleSubmit} className="relative">
              <div className="relative rounded-2xl border border-white/10 bg-[#111827] shadow-xl shadow-black/20 focus-within:border-cyan-500/40 transition-colors">
                <textarea
                  ref={textareaRef}
                  className="w-full bg-transparent pl-5 pr-14 py-4 text-[15px] resize-none focus:outline-none placeholder:text-slate-500 min-h-[56px] max-h-[200px]"
                  value={input || ''}
                  placeholder="Message SafeLLM..."
                  onChange={handleInputChange}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit(e as any);
                    }
                  }}
                  rows={1}
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={isLoading || !(input || '').trim()}
                  className={clsx(
                    'absolute right-3 bottom-3 w-9 h-9 rounded-xl flex items-center justify-center transition-all',
                    (input || '').trim()
                      ? 'bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40'
                      : 'bg-white/5 text-slate-500 cursor-not-allowed'
                  )}
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </form>
            <p className="text-center text-[11px] text-slate-600 mt-3">
              Press <kbd className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-slate-400 font-mono text-[10px]">↵</kbd> to send · <kbd className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-slate-400 font-mono text-[10px]">⇧ ↵</kbd> for new line
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
