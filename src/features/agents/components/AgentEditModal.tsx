"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

const AGENT_EMOJIS = [
  "🤖","🦾","🧠","⚡","🔮","🛡️","💡","🎯","📊","🚀",
  "⚙️","🔧","🎨","📝","🌐","💻","🔬","🌟","🔑","🏃",
  "🦊","🐉","🦁","🦅","🎪","🎭","🔭","🧬","🌊","🔥",
];

type AgentEditModalProps = {
  open: boolean;
  agentId: string;
  currentName: string;
  currentAvatarSeed: string;
  onClose: () => void;
  onSave: (payload: { name: string; avatarSeed: string; description: string }) => void;
};

function resolveInitialEmoji(seed: string): string {
  const found = AGENT_EMOJIS.find((e) => e === seed);
  if (found) return found;
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) >>> 0;
  }
  return AGENT_EMOJIS[h % AGENT_EMOJIS.length];
}

export const AgentEditModal = ({
  open,
  agentId,
  currentName,
  currentAvatarSeed,
  onClose,
  onSave,
}: AgentEditModalProps) => {
  const [name, setName] = useState(currentName);
  const [selectedEmoji, setSelectedEmoji] = useState(() =>
    resolveInitialEmoji(currentAvatarSeed)
  );
  const [description, setDescription] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`ocs_agent_desc_${agentId}`);
      setDescription(saved ?? "");
    } catch {
      setDescription("");
    }
  }, [agentId]);

  useEffect(() => {
    setName(currentName);
    setSelectedEmoji(resolveInitialEmoji(currentAvatarSeed));
  }, [currentName, currentAvatarSeed]);

  if (!open) return null;

  const handleSave = () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    try {
      localStorage.setItem(`ocs_agent_desc_${agentId}`, description);
    } catch {
      // ignore
    }
    onSave({ name: trimmedName, avatarSeed: selectedEmoji, description });
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,0.70)" }}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="ui-panel w-full max-w-lg overflow-hidden rounded-2xl">
        {/* cabeçalho */}
        <div
          className="flex items-center justify-between border-b px-5 py-3"
          style={{ borderColor: "#27272a" }}
        >
          <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-white/50">
            Editar agente
          </span>
          <button
            type="button"
            className="ui-btn-icon ui-btn-icon-xs"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="px-5 py-5">
          {/* pré-visualização do emoji */}
          <div className="mb-4 flex justify-center">
            <div
              className="agent-emoji-avatar"
              style={{ width: 56, height: 56, fontSize: 30 }}
            >
              {selectedEmoji}
            </div>
          </div>

          {/* grade de emojis */}
          <div className="mb-4 grid grid-cols-6 gap-1 sm:grid-cols-6" style={{ gridTemplateColumns: "repeat(6, 1fr)" }}>
            {AGENT_EMOJIS.map((emoji) => {
              const isSelected = emoji === selectedEmoji;
              return (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setSelectedEmoji(emoji)}
                  className={`flex h-10 w-full items-center justify-center rounded-lg text-xl transition-colors ${
                    isSelected
                      ? "bg-white/15 ring-1 ring-white/30"
                      : "hover:bg-white/8"
                  }`}
                  aria-label={emoji}
                  aria-pressed={isSelected}
                >
                  {emoji}
                </button>
              );
            })}
          </div>

          {/* campo nome */}
          <div className="mb-3">
            <label className="mb-1.5 block font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-white/40">
              Nome
            </label>
            <input
              type="text"
              className="ui-input w-full rounded-lg px-3 py-2 text-[14px] text-foreground"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome do agente"
              maxLength={80}
            />
          </div>

          {/* campo descrição */}
          <div className="mb-5">
            <label className="mb-1.5 block font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-white/40">
              Descrição
            </label>
            <textarea
              className="ui-input w-full rounded-lg px-3 py-2 text-[14px] text-foreground resize-none"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva o que esse agente faz..."
              maxLength={500}
            />
          </div>

          {/* ações */}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              className="ui-btn-secondary px-4 py-2 font-mono text-[12px] font-medium tracking-[0.04em]"
              onClick={onClose}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="ui-btn-primary px-4 py-2 font-mono text-[12px] font-medium tracking-[0.04em] disabled:cursor-not-allowed disabled:opacity-50"
              onClick={handleSave}
              disabled={!name.trim()}
            >
              Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
