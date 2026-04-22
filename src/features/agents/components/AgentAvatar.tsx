import { useMemo } from "react";

const AGENT_EMOJIS = [
  "🤖","🦾","🧠","⚡","🔮","🛡️","💡","🎯","📊","🚀",
  "⚙️","🔧","🎨","📝","🌐","💻","🔬","🌟","🔑","🏃",
  "🦊","🐉","🦁","🦅","🎪","🎭","🔭","🧬","🌊","🔥",
];

function emojiFromSeed(seed: string): string {
  if (AGENT_EMOJIS.includes(seed)) return seed;
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) >>> 0;
  }
  return AGENT_EMOJIS[h % AGENT_EMOJIS.length];
}

type AgentAvatarProps = {
  seed: string;
  name: string;
  avatarUrl?: string | null;
  size?: number;
  isSelected?: boolean;
};

export const AgentAvatar = ({
  seed,
  size = 112,
  isSelected = false,
}: AgentAvatarProps) => {
  const emoji = useMemo(() => emojiFromSeed(seed), [seed]);

  const fontSize = Math.round(size * 0.52);

  return (
    <div
      className={`agent-emoji-avatar${isSelected ? " agent-emoji-avatar--selected" : ""}`}
      style={{ width: size, height: size, fontSize }}
    >
      {emoji}
    </div>
  );
};
