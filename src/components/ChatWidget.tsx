"use client";

import { useState, useEffect, useRef } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { chatWithAIAction } from "@/actions/chat";

const CHAT_STORAGE_KEY = "lifemetric_chat_conversations_v1";
const MAX_SAVED_CONVERSATIONS = 8;

type ChatRole = "assistant" | "user" | "ai";
type ChatMessage = { role: ChatRole; content: string };
type StoredConversation = {
  id: string;
  createdAt: string;
  messages: ChatMessage[];
};

function renderInlineMarkdown(text: string) {
  const segments = text.split(/(\*\*[^*]+\*\*)/g);

  return segments.map((segment, index) => {
    const isBold = segment.startsWith("**") && segment.endsWith("**") && segment.length > 4;

    if (!isBold) {
      return <span key={`text-${index}`}>{segment}</span>;
    }

    return <strong key={`bold-${index}`}>{segment.slice(2, -2)}</strong>;
  });
}

function renderAssistantMarkdown(content: string) {
  const lines = content.split("\n");

  return lines.map((line, index) => {
    const trimmed = line.trim();

    if (!trimmed) {
      return <div key={`space-${index}`} className="h-2" aria-hidden="true" />;
    }

    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      const headingText = headingMatch[2];
      return (
        <p key={`heading-${index}`} className="font-bold text-slate-900 dark:text-white mt-1 mb-2">
          {renderInlineMarkdown(headingText)}
        </p>
      );
    }

    const listMatch = trimmed.match(/^[-*]\s+(.+)$/);
    if (listMatch) {
      return (
        <p key={`list-${index}`} className="pl-4 relative">
          <span className="absolute left-0">•</span>
          {renderInlineMarkdown(listMatch[1])}
        </p>
      );
    }

    return <p key={`p-${index}`}>{renderInlineMarkdown(trimmed)}</p>;
  });
}

export default function ChatWidget() {
  const { messages } = useLocale();
  const [isOpen, setIsOpen] = useState(false);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [input, setInput] = useState("");
  // Chat history state initialized with translated greeting.
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>(() => [
    {
      role: "assistant", // Using assistant for internal UI, will map to 'ai' for action
      content: messages.chat.welcome,
    },
  ]);
  const [savedConversations, setSavedConversations] = useState<StoredConversation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const createWelcomeMessage = () => [{ role: "assistant" as const, content: messages.chat.welcome }];

  useEffect(() => {
    setChatHistory(createWelcomeMessage());
    setSavedConversations([]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.chat.welcome]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(CHAT_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as StoredConversation[];
      if (Array.isArray(parsed)) {
        setSavedConversations(parsed.filter((item) => item.messages?.length));
      }
    } catch {
      setSavedConversations([]);
    }
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatHistory, isOpen]);

  const persistConversations = (conversations: StoredConversation[]) => {
    setSavedConversations(conversations);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(conversations));
    }
  };

  const saveCurrentConversationToHistory = () => {
    const meaningfulMessages = chatHistory.filter((item) => item.content.trim() && item.content !== messages.chat.welcome);
    if (!meaningfulMessages.length) return;

    const nextConversation: StoredConversation = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      messages: chatHistory,
    };

    const updated = [nextConversation, ...savedConversations].slice(0, MAX_SAVED_CONVERSATIONS);
    persistConversations(updated);
  };

  const handleStartNewConversation = () => {
    if (isLoading) return;
    saveCurrentConversationToHistory();
    setChatHistory(createWelcomeMessage());
    setInput("");
    setShowHistoryPanel(false);
  };

  const handleRecoverConversation = (id: string) => {
    const selected = savedConversations.find((item) => item.id === id);
    if (!selected) return;
    setChatHistory(selected.messages);
    setShowHistoryPanel(false);
    setIsOpen(true);
  };

  const handleSendMessage = async (e?: React.FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    
    const newUserMsg = { role: "user" as const, content: userMessage };
    setChatHistory((prev) => [...prev, newUserMsg]);
    setIsLoading(true);

    try {
      // Map history for the action, excluding the initial welcome assistant message if we want, 
      // but better to include it for full context. 
      // Mapping 'assistant' to 'ai' as expected by the action.
      const historyForAction = chatHistory
        .filter(m => m.content !== messages.chat.welcome)
        .map(m => ({
          role: m.role === 'assistant' ? 'ai' : m.role,
          content: m.content
        }));

      const response = await chatWithAIAction(userMessage, historyForAction);
      
      if (response.success) {
        setChatHistory((prev) => [...prev, { role: "assistant", content: response.text }]);
      } else {
        setChatHistory((prev) => [
          ...prev,
          { role: "assistant", content: response.text || messages.chat.error },
        ]);
      }
    } catch (error) {
      console.error(error);
      setChatHistory((prev) => [
        ...prev,
        { role: "assistant", content: messages.chat.error },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed left-0 top-1/2 -translate-y-1/2 z-[100] group flex items-center transition-all duration-300 pointer-events-auto"
        aria-label="Toggle AI Assistant"
      >
        <div className={`
          flex items-center gap-2 pl-2 pr-4 py-3 rounded-r-3xl 
          shadow-[4px_0_20px_rgba(37,99,235,0.2)] 
          transition-all duration-500 transform
          ${isOpen ? '-translate-x-full opacity-0' : 'translate-x-0 opacity-100'}
          bg-gradient-to-r from-blue-700 to-blue-600 dark:from-blue-600 dark:to-blue-500
          hover:pr-6 cursor-pointer border-y border-r border-white/20
        `}>
          <span className="material-symbols-outlined text-white animate-pulse">
            smart_toy
          </span>
          <span className="text-white text-xs font-bold uppercase tracking-widest hidden group-hover:block transition-all duration-300">
            {messages.chat.title}
          </span>
        </div>
      </button>

      {/* Chat Window Container */}
      <div
        aria-hidden={!isOpen}
        className={`
          fixed inset-y-0 left-0 z-[110] w-full max-w-[420px] 
          bg-slate-50/70 dark:bg-slate-950/70 backdrop-blur-2xl
          border-r border-slate-200/50 dark:border-white/10
          shadow-[10px_0_50px_rgba(0,0,0,0.15)]
          transition-transform duration-500 ease-[cubic-bezier(0.19, 1, 0.22, 1)]
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          flex flex-col
        `}
      >
        {/* Header */}
        <div className="p-5 flex items-center justify-between border-b border-slate-200 dark:border-white/5 bg-white/40 dark:bg-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-400 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <span className="material-symbols-outlined text-white text-xl">
                smart_toy
              </span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                {messages.chat.title}
              </h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                  Online
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShowHistoryPanel((prev) => !prev)}
              className="w-10 h-10 rounded-2xl flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-all active:scale-95"
              aria-label={messages.chat.history}
            >
              <span className="material-symbols-outlined">history</span>
            </button>
            <button
              type="button"
              onClick={handleStartNewConversation}
              className="w-10 h-10 rounded-2xl flex items-center justify-center text-slate-400 hover:text-rose-600 dark:hover:text-rose-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-all active:scale-95"
              aria-label={messages.chat.newConversation}
            >
              <span className="material-symbols-outlined">delete_sweep</span>
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="w-10 h-10 rounded-2xl flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-all active:scale-95"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>

        {showHistoryPanel && (
          <div className="px-4 py-3 border-b border-slate-200/80 dark:border-white/10 bg-white/60 dark:bg-slate-900/40 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{messages.chat.history}</p>
            {savedConversations.length ? (
              <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                {savedConversations.map((conversation) => {
                  const preview = conversation.messages.find((item) => item.role === "user")?.content ?? messages.chat.welcome;
                  return (
                    <button
                      key={conversation.id}
                      type="button"
                      onClick={() => handleRecoverConversation(conversation.id)}
                      className="w-full text-left px-3 py-2 rounded-xl bg-slate-100/70 dark:bg-slate-800/60 hover:bg-blue-100 dark:hover:bg-slate-700 transition-colors"
                    >
                      <p className="text-[11px] text-slate-500 dark:text-slate-300">
                        {new Date(conversation.createdAt).toLocaleString()}
                      </p>
                      <p className="text-xs text-slate-700 dark:text-slate-100 truncate">{preview}</p>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-500">{messages.chat.emptyHistory}</p>
            )}
          </div>
        )}

        {/* Messages */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800"
        >
          {chatHistory.map((msg, idx) => (
            <div
              key={`${msg.role}-${idx}`}
              className={`flex ${
                msg.role === "user" ? "justify-end" : "justify-start"
              } animate-in fade-in slide-in-from-bottom-2 duration-300`}
            >
              <div
                className={`
                  max-w-[85%] px-4 py-3 rounded-[24px] text-sm leading-relaxed
                  ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white rounded-br-none shadow-md"
                      : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 rounded-bl-none shadow-sm border border-slate-100 dark:border-white/5"
                  }
                `}
              >
                {msg.role === "assistant" ? renderAssistantMarkdown(msg.content) : msg.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white dark:bg-slate-900 rounded-[24px] rounded-bl-none px-4 py-3 shadow-sm border border-slate-100 dark:border-white/5">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="p-5 bg-white/20 dark:bg-white/5">
          <form
            onSubmit={handleSendMessage}
            className="relative flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={messages.chat.placeholder}
              className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 dark:text-white transition-all shadow-inner"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className={`
                w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg
                transition-all active:scale-95 disabled:opacity-50
                ${
                  input.trim() && !isLoading
                    ? "bg-blue-600 hover:bg-blue-700 shadow-blue-500/20"
                    : "bg-slate-400"
                }
              `}
            >
              <span className="material-symbols-outlined font-bold">
                send
              </span>
            </button>
          </form>
          <p className="text-[10px] text-center text-slate-400 mt-4 px-4 font-medium uppercase tracking-wide opacity-60">
            {messages.chat.disclaimer}
          </p>
        </div>
      </div>

      {/* Backdrop */}
      {isOpen && (
        <button
          onClick={() => setIsOpen(false)}
          aria-label={messages.chat.close}
          className="fixed inset-0 bg-slate-900/10 backdrop-blur-[2px] z-[105] md:hidden w-full h-full cursor-default"
        />
      )}
    </>
  );
}
