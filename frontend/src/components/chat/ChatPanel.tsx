'use client';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useEnergyStore, House } from '../../store/useEnergyStore';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

const T = {
  bgElevated: '#0b1120',
  panel: 'rgba(15,23,42,0.66)',
  panelSolid: '#0e1626',
  border: 'rgba(56,189,248,0.16)',
  borderStrong: 'rgba(56,189,248,0.40)',
  text: '#e7f1ff',
  textDim: '#8091ab',
  cyan: '#22d3ee',
  green: '#34d399',
  red: '#fb7185',
  violet: '#a78bfa',
};

type Language = 'english' | 'hindi' | 'telugu' | 'urdu';

const LANGUAGE_OPTIONS: { value: Language; label: string }[] = [
  { value: 'english', label: 'English' },
  { value: 'hindi',   label: 'हिन्दी' },
  { value: 'telugu',  label: 'తెలుగు' },
  { value: 'urdu',    label: 'اردو' },
];

const SUGGESTIONS = [
  'Why is grid risk changing?',
  'How much did P2P trading save us?',
  'Best time to charge my EV?',
  'Explain the last agent decision',
];

interface Message {
  id: string;
  role: 'user' | 'aria';
  content: string;
  timestamp: string;
}

interface PerHouseContribution {
  solar: number;
  battery: number;
  grid: number;
  unmet: number;
  total: number;
}

interface ChatPanelProps {
  selectedHouse: House | null;
  perHouseContribution: PerHouseContribution | null;
}

// Lightweight local fallback when backend is offline
function mockAgentReply(userMessage: string): string {
  const lower = userMessage.toLowerCase();
  if (lower.match(/trade|trading|p2p|save|saving/))
    return 'Peer-to-peer trading has redirected surplus solar to deficit homes, avoiding grid imports at peak tariff. Net community savings are trending up this cycle.';
  if (lower.match(/risk|grid|outage|failure|predict/))
    return 'Grid risk shifts with demand spikes, solar dips, and battery reserves. When risk climbs, the prediction agent pre-positions battery discharge and stages P2P trades to shed grid dependence.';
  if (lower.match(/bill|cost|₹|rupee|inr|price/))
    return 'Your current estimated bill is ₹2,850, down ~10% from last month. Shift EV charging to 10 PM–6 AM for maximum savings.';
  if (lower.match(/ev|charging|vehicle|car/))
    return 'Best EV charging window: 10 PM – 6 AM (off-peak) or 11 AM – 3 PM (solar surplus). Estimated saving: ₹180/month.';
  if (lower.match(/solar|panel|sun|generation/))
    return 'Solar is generating at current capacity. Use surplus energy to charge your battery or EV rather than exporting.';
  if (lower.match(/battery|storage|soc/))
    return 'Battery stores surplus solar for evening use. Keeping SoC between 20–90% maximizes lifespan.';
  return 'I can help you track grid risk, P2P trading savings, EV charging, and solar performance. What would you like to know?';
}

export default function ChatPanel({ selectedHouse, perHouseContribution }: ChatPanelProps) {
  const community      = useEnergyStore((s) => s.community);
  const activeScenario = useEnergyStore((s) => s.activeScenario);
  const backendConnected = useEnergyStore((s) => s.backendConnected);

  const [messages, setMessages] = useState<Message[]>([{
    id: '0',
    role: 'aria',
    content: 'Hi, I am the PowerWorker Agent — your autonomous micro-grid advisor. Ask me about grid risk, P2P energy trades, or a selected home.',
    timestamp: '',
  }]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [language, setLanguage] = useState<Language>('english');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const buildHouseContext = () => {
    if (!selectedHouse || !perHouseContribution) return undefined;
    return {
      house_id: selectedHouse.id,
      consumption: selectedHouse.consumption,
      solar_contribution_pct: selectedHouse.solarContribution,
      energy_source: selectedHouse.energySource,
      solar_supply_kwh: Math.round(perHouseContribution.solar * 100) / 100,
      battery_supply_kwh: Math.round(perHouseContribution.battery * 100) / 100,
      grid_supply_kwh: Math.round(perHouseContribution.grid * 100) / 100,
    };
  };

  const buildContext = () => ({
    solarGeneration: community.solarGeneration,
    batteryLevel:    community.batteryLevel,
    gridImport:      community.gridImport,
    evCount:         community.evCount,
    renewableUsage:  community.renewableUsage,
    activeScenario,
    selectedHouse: buildHouseContext(),
  });

  const appendMessage = (msg: Omit<Message, 'id' | 'timestamp'>) => {
    const now = new Date();
    const ts = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
    setMessages((prev) => [...prev, { ...msg, id: Date.now().toString(), timestamp: ts }]);
  };

  const callChat = async (userText: string): Promise<string> => {
    if (!backendConnected) return mockAgentReply(userText);

    const history = messages
      .filter((m) => m.id !== '0')
      .slice(-10)
      .map((m) => ({ role: m.role === 'aria' ? 'assistant' : 'user', content: m.content }));

    const res = await fetch(`${BACKEND_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message:  userText,
        language,
        history,
        context: buildContext(),
      }),
    });

    if (!res.ok) return mockAgentReply(userText);

    const data = await res.json();
    // Prefer structured.message if present, otherwise raw reply
    if (data.structured?.message) return data.structured.message;
    if (data.reply) {
      // Strip JSON wrapping if raw reply is a JSON string
      try {
        const parsed = JSON.parse(data.reply);
        return parsed.message || data.reply;
      } catch {
        return data.reply;
      }
    }
    return mockAgentReply(userText);
  };

  const sendText = async (raw: string) => {
    const text = raw.trim();
    if (!text || isLoading) return;

    appendMessage({ role: 'user', content: text });
    setInputText('');
    setIsLoading(true);

    try {
      const reply = await callChat(text);
      appendMessage({ role: 'aria', content: reply });
    } catch {
      appendMessage({ role: 'aria', content: 'Sorry, I encountered an error. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendText(inputText);
    }
  };

  const canSend = inputText.trim().length > 0 && !isLoading;

  return (
    <div
      style={{
        margin: 16,
        borderRadius: 16,
        border: `1px solid ${T.border}`,
        background: T.panel,
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        boxShadow: '0 8px 30px rgba(0,0,0,0.35), 0 0 22px rgba(167,139,250,0.16)',
        display: 'flex',
        flexDirection: 'column',
        height: 420,
        overflow: 'hidden',
      }}
    >
      <style>{`
        @keyframes pw-typing {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>

      {/* Top highlight line */}
      <div
        style={{
          height: 1,
          background: `linear-gradient(90deg, transparent, ${T.violet}, transparent)`,
          opacity: 0.7,
          flexShrink: 0,
        }}
      />

      {/* Header */}
      <div
        style={{
          padding: '11px 14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
          borderBottom: `1px solid ${T.border}`,
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
          <span
            style={{
              width: 26,
              height: 26,
              borderRadius: 8,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(167,139,250,0.14)',
              border: '1px solid rgba(167,139,250,0.4)',
              color: T.violet,
              fontSize: 13,
              flexShrink: 0,
            }}
          >
            ◆
          </span>
          <span style={{ minWidth: 0 }}>
            <span
              style={{
                display: 'block',
                fontFamily: 'var(--font-geist-sans)',
                fontSize: 13,
                fontWeight: 600,
                color: T.text,
                lineHeight: 1.2,
              }}
            >
              PowerWorker Agent
            </span>
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                fontFamily: 'var(--font-geist-mono)',
                fontSize: 8.5,
                color: T.textDim,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginTop: 1,
              }}
            >
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  background: backendConnected ? T.green : T.textDim,
                  boxShadow: backendConnected ? `0 0 6px ${T.green}` : 'none',
                }}
              />
              {backendConnected ? 'Live' : 'Offline'}
            </span>
          </span>
        </span>

        {/* Language selector */}
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value as Language)}
          style={{
            fontFamily: 'var(--font-geist-mono)',
            fontSize: 9.5,
            fontWeight: 600,
            border: `1px solid ${T.border}`,
            borderRadius: 8,
            background: T.panelSolid,
            color: T.text,
            padding: '4px 6px',
            cursor: 'pointer',
            outline: 'none',
            flexShrink: 0,
          }}
        >
          {LANGUAGE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value} style={{ background: T.panelSolid }}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Messages area */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 14,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}
            >
              <div
                style={{
                  maxWidth: '82%',
                  background: isUser ? 'rgba(34,211,238,0.14)' : 'rgba(167,139,250,0.12)',
                  color: T.text,
                  border: `1px solid ${isUser ? 'rgba(34,211,238,0.4)' : 'rgba(167,139,250,0.4)'}`,
                  borderRadius: isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                  padding: '9px 12px',
                  fontFamily: 'var(--font-geist-sans)',
                  fontSize: 12.5,
                  lineHeight: 1.5,
                  boxShadow: `0 0 14px ${isUser ? 'rgba(34,211,238,0.1)' : 'rgba(167,139,250,0.12)'}`,
                }}
              >
                {msg.content}
                {msg.timestamp && (
                  <div
                    style={{
                      fontFamily: 'var(--font-geist-mono)',
                      fontSize: 8,
                      color: T.textDim,
                      marginTop: 4,
                      textAlign: isUser ? 'right' : 'left',
                      letterSpacing: '0.06em',
                    }}
                  >
                    {msg.timestamp}
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}

        {/* Typing indicator */}
        <AnimatePresence>
          {isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              style={{ display: 'flex', justifyContent: 'flex-start' }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  background: 'rgba(167,139,250,0.12)',
                  border: '1px solid rgba(167,139,250,0.4)',
                  borderRadius: '14px 14px 14px 4px',
                  padding: '11px 14px',
                }}
              >
                {[0, 1, 2].map((d) => (
                  <span
                    key={d}
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: T.violet,
                      display: 'inline-block',
                      animation: `pw-typing 1.2s ease-in-out ${d * 0.18}s infinite`,
                    }}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={messagesEndRef} />
      </div>

      {/* Suggestion chips */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
          padding: '0 14px 10px',
          flexShrink: 0,
        }}
      >
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => sendText(s)}
            disabled={isLoading}
            style={{
              fontFamily: 'var(--font-geist-mono)',
              fontSize: 9.5,
              color: T.textDim,
              background: T.panelSolid,
              border: `1px solid ${T.border}`,
              borderRadius: 999,
              padding: '4px 10px',
              cursor: isLoading ? 'default' : 'pointer',
              opacity: isLoading ? 0.5 : 1,
              transition: 'color 0.15s ease, border 0.15s ease',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => {
              if (isLoading) return;
              e.currentTarget.style.color = T.cyan;
              e.currentTarget.style.borderColor = T.borderStrong;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = T.textDim;
              e.currentTarget.style.borderColor = T.border;
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Input area */}
      <div
        style={{
          borderTop: `1px solid ${T.border}`,
          padding: '10px 12px',
          display: 'flex',
          gap: 8,
          flexShrink: 0,
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          placeholder="Ask the PowerWorker Agent…"
          style={{
            flex: 1,
            borderRadius: 10,
            border: `1px solid ${T.border}`,
            padding: '9px 12px',
            fontFamily: 'var(--font-geist-sans)',
            fontSize: 12.5,
            color: T.text,
            background: T.panelSolid,
            outline: 'none',
          }}
        />

        <button
          onClick={() => sendText(inputText)}
          disabled={!canSend}
          style={{
            background: canSend
              ? `linear-gradient(160deg, rgba(34,211,238,0.28), rgba(167,139,250,0.24))`
              : T.panelSolid,
            color: canSend ? T.text : T.textDim,
            border: `1px solid ${canSend ? T.borderStrong : T.border}`,
            borderRadius: 10,
            padding: '9px 16px',
            fontFamily: 'var(--font-geist-mono)',
            fontSize: 10.5,
            fontWeight: 600,
            letterSpacing: '0.08em',
            cursor: canSend ? 'pointer' : 'default',
            boxShadow: canSend ? '0 0 16px rgba(34,211,238,0.22)' : 'none',
            transition: 'all 0.15s ease',
          }}
        >
          SEND
        </button>
      </div>
    </div>
  );
}
