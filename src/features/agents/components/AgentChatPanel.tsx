import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ChangeEvent,
  type KeyboardEvent,
  type MutableRefObject,
  type ReactNode,
} from "react";
import type { AgentState as AgentRecord } from "@/features/agents/state/store";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowUp, Check, ChevronRight, Clock, Cog, FileText, FolderOpen, Maximize2, Paperclip, Pencil, Square, Trash2, X } from "lucide-react";
import type { GatewayModelChoice } from "@/lib/gateway/models";
import { rewriteMediaLinesToMarkdown } from "@/lib/text/media-markdown";
import { normalizeAssistantDisplayText } from "@/lib/text/assistantText";
import { isNearBottom } from "@/lib/dom";
import { AgentAvatar } from "./AgentAvatar";
import { ModelSelectorModal } from "./ModelSelectorModal";
import { ReasoningModal } from "./ReasoningModal";
import type {
  ExecApprovalDecision,
  PendingExecApproval,
} from "@/features/agents/approvals/types";
import {
  buildAgentChatRenderBlocks,
  buildFinalAgentChatItems,
  DEFAULT_SEMANTIC_RENDER_TURN_LIMIT,
  summarizeToolLabel,
  type AssistantTraceEvent,
  type AgentChatRenderBlock,
} from "./chatItems";
import {
  boundTranscriptEntriesBySemanticTurns,
  buildOutputLinesFromTranscriptEntries,
  buildTranscriptEntriesFromLines,
  logTranscriptDebugMetric,
} from "@/features/agents/state/transcript";
import {
  buildChatFirstPaintCycleKey,
  resolveChatFirstPaint,
} from "@/features/agents/operations/chatFirstPaintWorkflow";

const formatChatTimestamp = (timestampMs: number): string => {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(timestampMs));
};

const formatDurationLabel = (durationMs: number): string => {
  const seconds = durationMs / 1000;
  if (!Number.isFinite(seconds) || seconds <= 0) return "0.0s";
  if (seconds < 10) return `${seconds.toFixed(1)}s`;
  return `${Math.round(seconds)}s`;
};

const SPINE_LEFT = "left-[15px]";
const ASSISTANT_GUTTER_CLASS = "pl-[44px]";
const ASSISTANT_MAX_WIDTH_DEFAULT_CLASS = "max-w-[68ch]";
const ASSISTANT_MAX_WIDTH_EXPANDED_CLASS = "max-w-[1120px]";
const CHAT_TOP_THRESHOLD_PX = 8;
const MESSAGE_CONTENT_VISIBILITY_STYLE: CSSProperties = {
  contentVisibility: "auto",
  containIntrinsicSize: "220px",
};
const EMPTY_CHAT_INTRO_MESSAGES = [
  "Como posso ajudar você hoje?",
  "O que vamos conquistar hoje?",
  "Pronto quando você estiver. O que quer resolver?",
  "No que estamos trabalhando hoje?",
  "Estou aqui e pronto. Qual é o plano?",
];

const stableStringHash = (value: string): number => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
};

const resolveEmptyChatIntroMessage = (agentId: string, sessionEpoch: number | undefined): string => {
  if (EMPTY_CHAT_INTRO_MESSAGES.length === 0) return "Como posso ajudar você hoje?";
  const normalizedEpoch =
    typeof sessionEpoch === "number" && Number.isFinite(sessionEpoch)
      ? Math.max(0, Math.trunc(sessionEpoch))
      : 0;
  const offset = stableStringHash(agentId) % EMPTY_CHAT_INTRO_MESSAGES.length;
  const index = (offset + normalizedEpoch) % EMPTY_CHAT_INTRO_MESSAGES.length;
  return EMPTY_CHAT_INTRO_MESSAGES[index];
};

const looksLikePath = (value: string): boolean => {
  if (!value) return false;
  if (/(^|[\s(])(?:[A-Za-z]:\\|~\/|\/)/.test(value)) return true;
  if (/(^|[\s(])(src|app|packages|components)\//.test(value)) return true;
  if (/(^|[\s(])[\w.-]+\.(ts|tsx|js|jsx|json|md|py|go|rs|java|kt|rb|sh|yaml|yml)\b/.test(value)) {
    return true;
  }
  return false;
};

const isStructuredMarkdown = (text: string): boolean => {
  if (!text) return false;
  if (/```/.test(text)) return true;
  if (/^\s*#{1,6}\s+/m.test(text)) return true;
  if (/^\s*[-*+]\s+/m.test(text)) return true;
  if (/^\s*\d+\.\s+/m.test(text)) return true;
  if (/^\s*\|.+\|\s*$/m.test(text)) return true;
  if (looksLikePath(text) && text.split("\n").filter(Boolean).length >= 3) return true;
  return false;
};

const resolveAssistantMaxWidthClass = (text: string | null | undefined): string => {
  const value = (text ?? "").trim();
  if (!value) return ASSISTANT_MAX_WIDTH_DEFAULT_CLASS;
  if (isStructuredMarkdown(value)) return ASSISTANT_MAX_WIDTH_EXPANDED_CLASS;
  const nonEmptyLines = value.split("\n").filter((line) => line.trim().length > 0);
  const shortLineCount = nonEmptyLines.filter((line) => line.trim().length <= 44).length;
  if (nonEmptyLines.length >= 10 && shortLineCount / Math.max(1, nonEmptyLines.length) >= 0.65) {
    return ASSISTANT_MAX_WIDTH_EXPANDED_CLASS;
  }
  return ASSISTANT_MAX_WIDTH_DEFAULT_CLASS;
};

type AgentChatPanelProps = {
  agent: AgentRecord;
  isSelected: boolean;
  canSend: boolean;
  models: GatewayModelChoice[];
  stopBusy: boolean;
  stopDisabledReason?: string | null;
  onLoadMoreHistory: () => void;
  onOpenSettings: () => void;
  onEditAgent?: () => void;
  onRename?: (name: string) => Promise<boolean>;
  onNewSession?: () => Promise<void> | void;
  onModelChange: (value: string | null) => void;
  onThinkingChange: (value: string | null) => void;
  onToolCallingToggle?: (enabled: boolean) => void;
  onThinkingTracesToggle?: (enabled: boolean) => void;
  onDraftChange: (value: string) => void;
  onSend: (message: string) => void;
  onRemoveQueuedMessage?: (index: number) => void;
  onStopRun: () => void;
  onAvatarShuffle: () => void;
  pendingExecApprovals?: PendingExecApproval[];
  onResolveExecApproval?: (id: string, decision: ExecApprovalDecision) => void;
  onOpenFilesPanel?: () => void;
};

const formatApprovalExpiry = (timestampMs: number): string => {
  if (!Number.isFinite(timestampMs) || timestampMs <= 0) return "Desconhecido";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestampMs));
};

const ExecApprovalCard = memo(function ExecApprovalCard({
  approval,
  onResolve,
}: {
  approval: PendingExecApproval;
  onResolve?: (id: string, decision: ExecApprovalDecision) => void;
}) {
  const disabled = approval.resolving || !onResolve;
  return (
    <div
      className={`w-full ${ASSISTANT_MAX_WIDTH_EXPANDED_CLASS} ${ASSISTANT_GUTTER_CLASS} ui-badge-approval self-start rounded-md px-3 py-2 shadow-2xs`}
      data-testid={`exec-approval-card-${approval.id}`}
    >
      <div className="type-meta">
        Aprovação necessária
      </div>
      <div className="mt-2 rounded-md bg-surface-3 px-2 py-1.5 shadow-2xs">
        <div className="font-mono text-[10px] font-semibold text-foreground">{approval.command}</div>
      </div>
      <div className="mt-2 grid gap-1 text-[11px] text-muted-foreground sm:grid-cols-2">
        <div>Host: {approval.host ?? "desconhecido"}</div>
        <div>Expira: {formatApprovalExpiry(approval.expiresAtMs)}</div>
        {approval.cwd ? <div className="sm:col-span-2">Dir: {approval.cwd}</div> : null}
      </div>
      {approval.error ? (
        <div className="ui-alert-danger mt-2 rounded-md px-2 py-1 text-[11px] shadow-2xs">
          {approval.error}
        </div>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-md border border-border/70 bg-surface-3 px-2.5 py-1 font-mono text-[12px] font-medium tracking-[0.02em] text-foreground transition hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={() => onResolve?.(approval.id, "allow-once")}
          disabled={disabled}
          aria-label={`Permitir uma vez para aprovação ${approval.id}`}
        >
          Permitir uma vez
        </button>
        <button
          type="button"
          className="rounded-md border border-border/70 bg-surface-3 px-2.5 py-1 font-mono text-[12px] font-medium tracking-[0.02em] text-foreground transition hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={() => onResolve?.(approval.id, "allow-always")}
          disabled={disabled}
          aria-label={`Sempre permitir para aprovação ${approval.id}`}
        >
          Sempre permitir
        </button>
        <button
          type="button"
          className="ui-btn-danger rounded-md px-2.5 py-1 font-mono text-[12px] font-medium tracking-[0.02em] transition disabled:cursor-not-allowed disabled:opacity-60"
          onClick={() => onResolve?.(approval.id, "deny")}
          disabled={disabled}
          aria-label={`Negar aprovação ${approval.id}`}
        >
          Negar
        </button>
      </div>
    </div>
  );
});

const ToolCallDetails = memo(function ToolCallDetails({
  line,
  className,
}: {
  line: string;
  className?: string;
}) {
  const { summaryText, body, inlineOnly } = summarizeToolLabel(line);
  const [open, setOpen] = useState(false);
  const resolvedClassName =
    className ??
    `w-full ${ASSISTANT_MAX_WIDTH_EXPANDED_CLASS} ${ASSISTANT_GUTTER_CLASS} self-start rounded-md bg-surface-3 px-2 py-1 text-[10px] text-muted-foreground shadow-2xs`;
  if (inlineOnly) {
    return (
      <div className={resolvedClassName}>
        <div className="font-mono text-[10px] font-semibold tracking-[0.11em]">{summaryText}</div>
      </div>
    );
  }
  return (
    <details open={open} className={resolvedClassName}>
      <summary
        className="cursor-pointer select-none font-mono text-[10px] font-semibold tracking-[0.11em]"
        onClick={(event) => {
          event.preventDefault();
          setOpen((current) => !current);
        }}
      >
        {summaryText}
      </summary>
      {open && body ? (
        <div className="agent-markdown agent-tool-markdown mt-1 text-foreground">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {rewriteMediaLinesToMarkdown(body)}
          </ReactMarkdown>
        </div>
      ) : null}
    </details>
  );
});

const ThinkingDetailsRow = memo(function ThinkingDetailsRow({
  events,
  thinkingText,
  toolLines = [],
  durationMs,
  showTyping,
}: {
  events?: AssistantTraceEvent[];
  thinkingText?: string | null;
  toolLines?: string[];
  durationMs?: number;
  showTyping?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const traceEvents = (() => {
    if (events && events.length > 0) return events;
    const normalizedThinkingText = thinkingText?.trim() ?? "";
    const next: AssistantTraceEvent[] = [];
    if (normalizedThinkingText) {
      next.push({ kind: "thinking", text: normalizedThinkingText });
    }
    for (const line of toolLines) {
      next.push({ kind: "tool", text: line });
    }
    return next;
  })();
  if (traceEvents.length === 0) return null;
  return (
    <details
      open={open}
      className="ui-chat-thinking group rounded-md px-2 py-1.5 text-[10px] shadow-2xs"
    >
      <summary
        className="flex cursor-pointer list-none items-center gap-2 opacity-65 [&::-webkit-details-marker]:hidden"
        onClick={(event) => {
          event.preventDefault();
          setOpen((current) => !current);
        }}
      >
        <ChevronRight className="h-3 w-3 shrink-0 transition group-open:rotate-90" />
        <span className="flex min-w-0 items-center gap-2">
          <span className="font-mono text-[10px] font-medium tracking-[0.02em]">
            Raciocínio (interno)
          </span>
          {typeof durationMs === "number" ? (
            <span className="inline-flex items-center gap-1 font-mono text-[10px] font-medium tracking-[0.02em] text-muted-foreground/80">
              <Clock className="h-3 w-3" />
              {formatDurationLabel(durationMs)}
            </span>
          ) : null}
          {showTyping ? (
            <span className="typing-dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          ) : null}
        </span>
      </summary>
      {open ? (
        <div className="mt-2 space-y-2 pl-5">
          {traceEvents.map((event, index) =>
            event.kind === "thinking" ? (
              <div
                key={`thinking-event-${index}-${event.text.slice(0, 48)}`}
                className="agent-markdown min-w-0 text-foreground/85"
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{event.text}</ReactMarkdown>
              </div>
            ) : (
              <ToolCallDetails
                key={`thinking-tool-${index}-${event.text.slice(0, 48)}`}
                line={event.text}
                className="rounded-md border border-border/45 bg-surface-2/65 px-2 py-1 text-[10px] text-muted-foreground/90 shadow-2xs"
              />
            )
          )}
        </div>
      ) : null}
    </details>
  );
});

const UserMessageCard = memo(function UserMessageCard({
  text,
  timestampMs,
  testId,
}: {
  text: string;
  timestampMs?: number;
  testId?: string;
}) {
  return (
    <div
      className="ui-chat-user-card w-full max-w-[70ch] self-end overflow-hidden rounded-[var(--radius-small)] bg-[color:var(--chat-user-bg)]"
      style={MESSAGE_CONTENT_VISIBILITY_STYLE}
      {...(testId ? { "data-testid": testId } : {})}
    >
      <div className="flex items-center justify-between gap-3 bg-[color:var(--chat-user-header-bg)] px-3 py-2 dark:px-3.5 dark:py-2.5">
        <div className="type-meta min-w-0 truncate font-mono text-foreground/90">
          Você
        </div>
        {typeof timestampMs === "number" ? (
          <time className="type-meta shrink-0 rounded-md bg-surface-3 px-2 py-0.5 font-mono text-muted-foreground/70">
            {formatChatTimestamp(timestampMs)}
          </time>
        ) : null}
      </div>
      <div className="agent-markdown type-body px-3 py-3 text-foreground dark:px-3.5 dark:py-3.5">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
      </div>
    </div>
  );
});

const AssistantMessageCard = memo(function AssistantMessageCard({
  avatarSeed,
  avatarUrl,
  name,
  timestampMs,
  thinkingEvents,
  thinkingText,
  thinkingToolLines,
  thinkingDurationMs,
  contentText,
  streaming,
  testId,
}: {
  avatarSeed: string;
  avatarUrl: string | null;
  name: string;
  timestampMs?: number;
  thinkingEvents?: AssistantTraceEvent[];
  thinkingText?: string | null;
  thinkingToolLines?: string[];
  thinkingDurationMs?: number;
  contentText?: string | null;
  streaming?: boolean;
  testId?: string;
}) {
  const resolvedTimestamp = typeof timestampMs === "number" ? timestampMs : null;
  const hasThinking = Boolean(
    (thinkingEvents?.length ?? 0) > 0 ||
      thinkingText?.trim() ||
      (thinkingToolLines?.length ?? 0) > 0
  );
  const widthClass = hasThinking
    ? ASSISTANT_MAX_WIDTH_EXPANDED_CLASS
    : resolveAssistantMaxWidthClass(contentText);
  const hasContent = Boolean(contentText?.trim());
  const compactStreamingIndicator = Boolean(streaming && !hasThinking && !hasContent);

  return (
    <div
      className="w-full self-start"
      style={MESSAGE_CONTENT_VISIBILITY_STYLE}
      {...(testId ? { "data-testid": testId } : {})}
    >
      <div className={`relative w-full ${widthClass} ${ASSISTANT_GUTTER_CLASS}`}>
        <div className="absolute left-[4px] top-[2px]">
          <AgentAvatar seed={avatarSeed} name={name} avatarUrl={avatarUrl} size={22} />
        </div>
        <div className="flex items-center justify-between gap-3 py-0.5">
          <div className="type-meta min-w-0 truncate font-mono text-foreground/90">
            {name}
          </div>
          {resolvedTimestamp !== null ? (
            <time className="type-meta shrink-0 rounded-md bg-surface-3 px-2 py-0.5 font-mono text-muted-foreground/90">
              {formatChatTimestamp(resolvedTimestamp)}
            </time>
          ) : null}
        </div>

        {compactStreamingIndicator ? (
          <div
            className="mt-2 inline-flex items-center gap-2 rounded-md bg-surface-3 px-3 py-2 text-[10px] text-muted-foreground/80 shadow-2xs"
            role="status"
            aria-live="polite"
            data-testid="agent-typing-indicator"
          >
            <span className="font-mono text-[10px] font-medium tracking-[0.02em]">
              Pensando
            </span>
            <span className="typing-dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </div>
        ) : (
          <div className="mt-2 space-y-3 dark:space-y-5">
            {streaming && !hasThinking ? (
              <div
                className="flex items-center gap-2 text-[10px] text-muted-foreground/80"
                role="status"
                aria-live="polite"
                data-testid="agent-typing-indicator"
              >
                <span className="font-mono text-[10px] font-medium tracking-[0.02em]">
                  Thinking
                </span>
                <span className="typing-dots" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </span>
              </div>
            ) : null}

            {hasThinking ? (
              <ThinkingDetailsRow
                events={thinkingEvents}
                thinkingText={thinkingText}
                toolLines={thinkingToolLines ?? []}
                durationMs={thinkingDurationMs}
                showTyping={streaming}
              />
            ) : null}

            {contentText ? (
              <div className="ui-chat-assistant-card">
                {streaming ? (
                  (() => {
                    if (!contentText.includes("MEDIA:")) {
                      return (
                        <div className="whitespace-pre-wrap break-words text-foreground">
                          {contentText}
                        </div>
                      );
                    }
                    const rewritten = rewriteMediaLinesToMarkdown(contentText);
                    if (!rewritten.includes("![](")) {
                      return (
                        <div className="whitespace-pre-wrap break-words text-foreground">
                          {contentText}
                        </div>
                      );
                    }
                    return (
                      <div className="agent-markdown text-foreground">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{rewritten}</ReactMarkdown>
                      </div>
                    );
                  })()
                ) : (
                  <div className="agent-markdown text-foreground">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {rewriteMediaLinesToMarkdown(contentText)}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
});

const AssistantIntroCard = memo(function AssistantIntroCard({
  avatarSeed,
  avatarUrl,
  name,
  title,
}: {
  avatarSeed: string;
  avatarUrl: string | null;
  name: string;
  title: string;
}) {
  return (
    <div className="w-full self-start">
      <div className={`relative w-full ${ASSISTANT_MAX_WIDTH_DEFAULT_CLASS} ${ASSISTANT_GUTTER_CLASS}`}>
        <div className="absolute left-[4px] top-[2px]">
          <AgentAvatar seed={avatarSeed} name={name} avatarUrl={avatarUrl} size={22} />
        </div>
        <div className="flex items-center justify-between gap-3 py-0.5">
          <div className="type-meta min-w-0 truncate font-mono text-foreground/90">
            {name}
          </div>
        </div>
        <div className="ui-chat-assistant-card mt-2">
          <div className="text-[14px] leading-[1.65] text-foreground">{title}</div>
          <div className="mt-2 font-mono text-[10px] tracking-[0.03em] text-muted-foreground/80">
            Descreva uma tarefa, bug ou pergunta para começar.
          </div>
        </div>
      </div>
    </div>
  );
});

const AgentChatFinalItems = memo(function AgentChatFinalItems({
  agentId,
  name,
  avatarSeed,
  avatarUrl,
  renderBlocks,
  running,
  runStartedAt,
}: {
  agentId: string;
  name: string;
  avatarSeed: string;
  avatarUrl: string | null;
  renderBlocks: AgentChatRenderBlock[];
  running: boolean;
  runStartedAt: number | null;
}) {
  return (
    <>
      {renderBlocks.map((block, index) => {
        if (block.kind === "user") {
          return (
            <UserMessageCard
              key={`chat-${agentId}-user-${index}`}
              text={block.text}
              timestampMs={block.timestampMs}
            />
          );
        }
        const streaming = running && index === renderBlocks.length - 1 && !block.text;
        return (
          <AssistantMessageCard
            key={`chat-${agentId}-assistant-${index}`}
            avatarSeed={avatarSeed}
            avatarUrl={avatarUrl}
            name={name}
            timestampMs={block.timestampMs ?? (streaming ? runStartedAt ?? undefined : undefined)}
            thinkingEvents={block.traceEvents}
            thinkingDurationMs={block.thinkingDurationMs}
            contentText={block.text}
            streaming={streaming}
          />
        );
      })}
    </>
  );
});

const AgentChatTranscript = memo(function AgentChatTranscript({
  agentId,
  name,
  avatarSeed,
  avatarUrl,
  status,
  historyMaybeTruncated,
  historyGatewayCapReached,
  historyFetchedCount,
  historyVisibleTurnLimit,
  onLoadMoreHistory,
  renderBlocks,
  liveThinkingText,
  liveAssistantText,
  showTypingIndicator,
  outputLineCount,
  liveAssistantCharCount,
  liveThinkingCharCount,
  runStartedAt,
  scrollToBottomOnOpenKey,
  scrollToBottomNextOutputRef,
  pendingExecApprovals,
  onResolveExecApproval,
  emptyStateTitle,
  lastUserMessage,
  latestPreview,
  previewItems,
}: {
  agentId: string;
  name: string;
  avatarSeed: string;
  avatarUrl: string | null;
  status: AgentRecord["status"];
  historyMaybeTruncated: boolean;
  historyGatewayCapReached: boolean;
  historyFetchedCount: number | null;
  historyVisibleTurnLimit: number | null;
  onLoadMoreHistory: () => void;
  renderBlocks: AgentChatRenderBlock[];
  liveThinkingText: string;
  liveAssistantText: string;
  showTypingIndicator: boolean;
  outputLineCount: number;
  liveAssistantCharCount: number;
  liveThinkingCharCount: number;
  runStartedAt: number | null;
  scrollToBottomOnOpenKey: string;
  scrollToBottomNextOutputRef: MutableRefObject<boolean>;
  pendingExecApprovals: PendingExecApproval[];
  onResolveExecApproval?: (id: string, decision: ExecApprovalDecision) => void;
  emptyStateTitle: string;
  lastUserMessage: string | null;
  latestPreview: string | null;
  previewItems?: Array<{
    role: "user" | "assistant";
    text: string;
    timestamp?: number | string;
  }>;
}) {
  const chatRef = useRef<HTMLDivElement | null>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const pinnedRef = useRef(true);
  const [isPinned, setIsPinned] = useState(true);
  const [isAtTop, setIsAtTop] = useState(false);
  const [nowMs, setNowMs] = useState<number | null>(null);

  const scrollChatToBottom = useCallback(() => {
    const el = chatRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  const setPinned = useCallback((nextPinned: boolean) => {
    if (pinnedRef.current === nextPinned) return;
    pinnedRef.current = nextPinned;
    setIsPinned(nextPinned);
  }, []);

  const updatePinnedFromScroll = useCallback(() => {
    const el = chatRef.current;
    if (!el) return;
    const nextAtTop = el.scrollTop <= CHAT_TOP_THRESHOLD_PX;
    setIsAtTop((current) => (current === nextAtTop ? current : nextAtTop));
    setPinned(
      isNearBottom(
        {
          scrollTop: el.scrollTop,
          scrollHeight: el.scrollHeight,
          clientHeight: el.clientHeight,
        },
        48
      )
    );
  }, [setPinned]);

  const scheduleScrollToBottom = useCallback(() => {
    if (scrollFrameRef.current !== null) return;
    scrollFrameRef.current = requestAnimationFrame(() => {
      scrollFrameRef.current = null;
      scrollChatToBottom();
    });
  }, [scrollChatToBottom]);

  useEffect(() => {
    setPinned(true);
    scheduleScrollToBottom();
  }, [scheduleScrollToBottom, scrollToBottomOnOpenKey, setPinned]);

  useEffect(() => {
    updatePinnedFromScroll();
  }, [updatePinnedFromScroll]);

  const showJumpToLatest =
    !isPinned && (outputLineCount > 0 || liveAssistantCharCount > 0 || liveThinkingCharCount > 0);

  useEffect(() => {
    const shouldForceScroll = scrollToBottomNextOutputRef.current;
    if (shouldForceScroll) {
      scrollToBottomNextOutputRef.current = false;
      scheduleScrollToBottom();
      return;
    }

    if (pinnedRef.current) {
      scheduleScrollToBottom();
      return;
    }
  }, [
    liveAssistantCharCount,
    liveThinkingCharCount,
    outputLineCount,
    pendingExecApprovals.length,
    scheduleScrollToBottom,
    scrollToBottomNextOutputRef,
  ]);

  useEffect(() => {
    return () => {
      if (scrollFrameRef.current !== null) {
        cancelAnimationFrame(scrollFrameRef.current);
        scrollFrameRef.current = null;
      }
    };
  }, []);

  const showLiveAssistantCard =
    status === "running" && Boolean(liveThinkingText || liveAssistantText || showTypingIndicator);
  const hasApprovals = pendingExecApprovals.length > 0;
  const hasTranscriptItems = renderBlocks.length > 0;
  const visibleTurnCount =
    typeof historyVisibleTurnLimit === "number" && Number.isFinite(historyVisibleTurnLimit)
      ? historyVisibleTurnLimit
      : historyFetchedCount;
  const hasHiddenFetchedHistory =
    typeof historyFetchedCount === "number" &&
    Number.isFinite(historyFetchedCount) &&
    typeof visibleTurnCount === "number" &&
    Number.isFinite(visibleTurnCount) &&
    historyFetchedCount > visibleTurnCount;
  const showLoadMoreBanner = (historyMaybeTruncated || hasHiddenFetchedHistory) && isAtTop;
  const provisionalConversationItems = (() => {
    const normalizedPreviewItems = (previewItems ?? [])
      .map((item) => ({
        role: item.role,
        text: item.text.trim(),
        timestampMs:
          typeof item.timestamp === "number"
            ? item.timestamp
            : typeof item.timestamp === "string"
              ? Date.parse(item.timestamp)
              : Number.NaN,
      }))
      .filter((item) => item.text.length > 0)
      .map((item) => ({
        role: item.role,
        text: item.text,
        ...(Number.isFinite(item.timestampMs) ? { timestampMs: item.timestampMs } : {}),
      }));
    if (normalizedPreviewItems.length > 0) {
      return normalizedPreviewItems;
    }
    const fallbackItems: Array<{ role: "user" | "assistant"; text: string; timestampMs?: number }> = [];
    const provisionalUserMessage = lastUserMessage?.trim() ?? "";
    const provisionalAssistantPreview = latestPreview?.trim() ?? "";
    if (provisionalUserMessage.length > 0) {
      fallbackItems.push({ role: "user", text: provisionalUserMessage });
    }
    if (provisionalAssistantPreview.length > 0) {
      fallbackItems.push({ role: "assistant", text: provisionalAssistantPreview });
    }
    return fallbackItems;
  })();
  const hasProvisionalContent = provisionalConversationItems.length > 0;
  const hasRenderableContent = hasTranscriptItems || hasProvisionalContent || hasApprovals;
  const firstProvisionalUserIndex = provisionalConversationItems.findIndex(
    (item) => item.role === "user"
  );
  const firstProvisionalAssistantIndex = provisionalConversationItems.findIndex(
    (item) => item.role === "assistant"
  );

  useEffect(() => {
    if (status !== "running" || typeof runStartedAt !== "number" || !showLiveAssistantCard) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setNowMs(Date.now());
    }, 0);
    const intervalId = window.setInterval(() => setNowMs(Date.now()), 250);

    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, [runStartedAt, showLiveAssistantCard, status]);

  return (
    <div className="relative h-full min-h-0 overflow-hidden">
      <div
        ref={chatRef}
        data-testid="agent-chat-scroll"
        className={`ui-chat-scroll ui-chat-scroll-borderless h-full overflow-x-hidden overflow-y-auto p-3 sm:p-5 dark:sm:p-7 ${showJumpToLatest ? "pb-20" : ""}`}
        onScroll={() => updatePinnedFromScroll()}
        onWheel={(event) => {
          event.stopPropagation();
        }}
        onWheelCapture={(event) => {
          event.stopPropagation();
        }}
      >
        <div className="relative flex min-w-0 flex-col gap-6 text-[14px] leading-[1.65] text-foreground dark:gap-8">
          <div aria-hidden className={`pointer-events-none absolute ${SPINE_LEFT} top-0 bottom-0 w-px bg-border/20`} />
          {showLoadMoreBanner ? (
            <div className="flex flex-col items-start gap-2 rounded-md bg-surface-2 px-3 py-2 shadow-2xs sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <div className="type-meta w-full min-w-0 break-words font-mono text-muted-foreground sm:truncate">
                {hasHiddenFetchedHistory && typeof historyFetchedCount === "number" && typeof visibleTurnCount === "number"
                  ? `Exibindo ${visibleTurnCount} de ${historyFetchedCount} turnos carregados`
                  : `Exibindo últimos ${typeof visibleTurnCount === "number" ? visibleTurnCount : "?"} turnos`}
              </div>
              {historyGatewayCapReached && !hasHiddenFetchedHistory ? (
                <div className="type-meta w-full min-w-0 break-words font-mono text-muted-foreground sm:w-auto sm:shrink-0">
                  Exibindo histórico mais recente disponível
                </div>
              ) : (
                <button
                  type="button"
                  className="inline-flex w-fit self-start rounded-md border border-border/70 bg-surface-3 px-3 py-1.5 font-mono text-[12px] font-medium tracking-[0.02em] text-foreground transition hover:bg-surface-2 sm:self-auto"
                  onClick={onLoadMoreHistory}
                >
                  {hasHiddenFetchedHistory ? "Mostrar anteriores" : "Carregar mais"}
                </button>
              )}
            </div>
          ) : null}
          {!hasRenderableContent ? (
            <AssistantIntroCard
              avatarSeed={avatarSeed}
              avatarUrl={avatarUrl}
              name={name}
              title={emptyStateTitle}
            />
          ) : (
            <>
              {hasTranscriptItems ? (
                <AgentChatFinalItems
                  agentId={agentId}
                  name={name}
                  avatarSeed={avatarSeed}
                  avatarUrl={avatarUrl}
                  renderBlocks={renderBlocks}
                  running={status === "running"}
                  runStartedAt={runStartedAt}
                />
              ) : (
                <>
                  {provisionalConversationItems.map((item, index) =>
                    item.role === "user" ? (
                      <UserMessageCard
                        key={`provisional-user-${index}`}
                        text={item.text}
                        timestampMs={item.timestampMs}
                        testId={index === firstProvisionalUserIndex ? "agent-provisional-user" : undefined}
                      />
                    ) : (
                      <AssistantMessageCard
                        key={`provisional-assistant-${index}`}
                        avatarSeed={avatarSeed}
                        avatarUrl={avatarUrl}
                        name={name}
                        contentText={item.text}
                        timestampMs={item.timestampMs}
                        testId={
                          index === firstProvisionalAssistantIndex
                            ? "agent-provisional-assistant"
                            : undefined
                        }
                      />
                    )
                  )}
                </>
              )}
              {showLiveAssistantCard ? (
                <AssistantMessageCard
                  avatarSeed={avatarSeed}
                  avatarUrl={avatarUrl}
                  name={name}
                  timestampMs={runStartedAt ?? undefined}
                  thinkingText={liveThinkingText || null}
                  thinkingDurationMs={
                    typeof runStartedAt === "number" && typeof nowMs === "number"
                      ? Math.max(0, nowMs - runStartedAt)
                      : undefined
                  }
                  contentText={liveAssistantText || null}
                  streaming={status === "running"}
                />
              ) : null}
              {pendingExecApprovals.map((approval) => (
                <ExecApprovalCard
                  key={approval.id}
                  approval={approval}
                  onResolve={onResolveExecApproval}
                />
              ))}
            </>
          )}
        </div>
      </div>

      {showJumpToLatest ? (
        <button
          type="button"
          className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-md border border-border/70 bg-card px-3 py-1.5 font-mono text-[12px] font-medium tracking-[0.02em] text-foreground shadow-xs transition hover:bg-surface-2"
          onClick={() => {
            setPinned(true);
            scrollChatToBottom();
          }}
          aria-label="Ir para o mais recente"
        >
          Ir para o mais recente
        </button>
      ) : null}
    </div>
  );
});

const noopToggle = () => {};
const InlineHoverTooltip = ({
  text,
  children,
}: {
  text: string;
  children: ReactNode;
}) => {
  return (
    <div className="group/tooltip relative inline-flex">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute -top-7 left-1/2 z-20 w-max max-w-none -translate-x-1/2 whitespace-nowrap rounded-md border border-border/70 bg-card px-2 py-1 font-mono text-[10px] text-foreground opacity-0 shadow-sm transition-opacity duration-150 group-hover/tooltip:opacity-100 group-focus-within/tooltip:opacity-100"
      >
        {text}
      </span>
    </div>
  );
};

type AttachedFile = { name: string; content: string; mimeType: string };

// ── Slash commands ──────────────────────────────────────────────────────────
const SLASH_COMMANDS = [
  { command: "/compact", description: "Compacta o histórico removendo detalhes de ferramentas" },
  { command: "/clear", description: "Limpa o histórico da sessão atual" },
  { command: "/help", description: "Exibe comandos disponíveis" },
  { command: "/model", description: "Exibe o modelo atual" },
  { command: "/reset", description: "Reinicia as configurações da sessão" },
  { command: "/status", description: "Exibe o status atual do agente" },
  { command: "/memory", description: "Exibe e gerencia a memória do agente" },
  { command: "/init", description: "Inicializa o CLAUDE.md no projeto" },
  { command: "/review", description: "Solicita uma revisão de código" },
  { command: "/bug", description: "Reporta um bug para o agente" },
  { command: "/doctor", description: "Verifica a saúde do ambiente do agente" },
  { command: "/logout", description: "Encerra a sessão autenticada" },
] as const;

type SlashCommand = (typeof SLASH_COMMANDS)[number];

const SlashCommandPicker = memo(function SlashCommandPicker({
  commands,
  activeIndex,
  onSelect,
}: {
  commands: readonly SlashCommand[];
  activeIndex: number;
  onSelect: (command: string) => void;
}) {
  if (commands.length === 0) return null;
  return (
    <div className="absolute bottom-full left-0 right-0 z-50 mb-1.5 overflow-hidden rounded-xl border border-border/60 bg-card shadow-lg">
      {commands.map((cmd, i) => (
        <button
          key={cmd.command}
          type="button"
          className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors ${
            i === activeIndex
              ? "bg-white/10 text-foreground"
              : "text-muted-foreground hover:bg-white/6"
          }`}
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(cmd.command);
          }}
        >
          <span className="shrink-0 font-mono text-[12px] font-bold text-primary">
            {cmd.command}
          </span>
          <span className="min-w-0 truncate text-[11px]">{cmd.description}</span>
        </button>
      ))}
    </div>
  );
});
// ────────────────────────────────────────────────────────────────────────────

const AgentChatComposer = memo(function AgentChatComposer({
  value,
  onChange,
  onKeyDown,
  onSend,
  onStop,
  canSend,
  stopBusy,
  stopDisabledReason,
  running,
  sendDisabled,
  queuedMessages,
  onRemoveQueuedMessage,
  inputRef,
  modelOptions,
  modelValue,
  allowThinking,
  thinkingValue,
  onModelChange,
  onThinkingChange,
  toolCallingEnabled,
  showThinkingTraces,
  onToolCallingToggle,
  onThinkingTracesToggle,
  attachedFiles = [],
  onAttachFile,
  onRemoveAttachment,
  mdPreview = false,
  onMdPreviewToggle,
  onOpenFilesPanel,
  allModels = [],
}: {
  value: string;
  onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onSend: () => void;
  onStop: () => void;
  canSend: boolean;
  stopBusy: boolean;
  stopDisabledReason?: string | null;
  running: boolean;
  sendDisabled: boolean;
  queuedMessages: string[];
  onRemoveQueuedMessage?: (index: number) => void;
  inputRef: (el: HTMLTextAreaElement | HTMLInputElement | null) => void;
  modelOptions: { value: string; label: string }[];
  modelValue: string;
  allowThinking: boolean;
  thinkingValue: string;
  onModelChange: (value: string | null) => void;
  onThinkingChange: (value: string | null) => void;
  toolCallingEnabled: boolean;
  showThinkingTraces: boolean;
  onToolCallingToggle: (enabled: boolean) => void;
  onThinkingTracesToggle: (enabled: boolean) => void;
  attachedFiles?: AttachedFile[];
  onAttachFile?: (files: AttachedFile[]) => void;
  onRemoveAttachment?: (index: number) => void;
  mdPreview?: boolean;
  onMdPreviewToggle?: () => void;
  onOpenFilesPanel?: () => void;
  allModels?: GatewayModelChoice[];
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [modelModalOpen, setModelModalOpen] = useState(false);
  const [reasoningModalOpen, setReasoningModalOpen] = useState(false);

  const handleFileInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const selected = Array.from(e.target.files ?? []);
      if (selected.length === 0) return;
      const readers = selected.map(
        (f) =>
          new Promise<AttachedFile>((resolve) => {
            const isText = f.type.startsWith("text/") || f.type.includes("json") || f.type === "";
            const reader = new FileReader();
            reader.onload = () => {
              const raw = typeof reader.result === "string" ? reader.result : "";
              resolve({
                name: f.name,
                content: isText ? raw : raw.split(",")[1] ?? raw,
                mimeType: f.type || "application/octet-stream",
              });
            };
            if (isText) reader.readAsText(f);
            else reader.readAsDataURL(f);
          })
      );
      Promise.all(readers).then((newFiles) => {
        onAttachFile?.(newFiles);
      });
      e.target.value = "";
    },
    [onAttachFile]
  );
  const stopReason = stopDisabledReason?.trim() ?? "";
  const stopDisabled = !canSend || stopBusy || Boolean(stopReason);
  const stopAriaLabel = stopReason ? `Parar indisponível: ${stopReason}` : "Parar";
  const modelSelectedLabel = useMemo(() => {
    if (modelOptions.length === 0) return "Nenhum modelo";
    return modelOptions.find((option) => option.value === modelValue)?.label ?? modelValue;
  }, [modelOptions, modelValue]);
  const modelSelectWidthCh = Math.max(11, Math.min(30, modelSelectedLabel.length + 6));
  const thinkingSelectedLabel = useMemo(() => {
    switch (thinkingValue) {
      case "off":
        return "Desligado";
      case "minimal":
        return "Mínimo";
      case "low":
        return "Baixo";
      case "medium":
        return "Médio";
      case "high":
        return "Alto";
      case "xhigh":
        return "Máximo";
      default:
        return "Padrão";
    }
  }, [thinkingValue]);
  const thinkingSelectWidthCh = Math.max(9, Math.min(16, thinkingSelectedLabel.length + 6));
  return (
    <div className="w-full max-w-full overflow-hidden rounded-xl border border-border/65 bg-surface-2/45 px-2 py-1.5 sm:rounded-2xl sm:px-3 sm:py-2">
      {queuedMessages.length > 0 ? (
        <div
          className={`mb-2 grid items-start gap-2 ${
            running ? "grid-cols-[minmax(0,1fr)_auto_auto]" : "grid-cols-[minmax(0,1fr)_auto]"
          }`}
        >
          <div
            className="min-w-0 max-w-full space-y-1 overflow-hidden"
            data-testid="queued-messages-bar"
            aria-label="Mensagens na fila"
          >
            {queuedMessages.map((queuedMessage, index) => (
              <div
                key={`${index}-${queuedMessage}`}
                className="flex w-full min-w-0 max-w-full items-center gap-1 overflow-hidden rounded-md border border-border/70 bg-card/80 px-2 py-1 text-[11px] text-foreground"
              >
                <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
                  Na fila
                </span>
                <span
                  className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap"
                  title={queuedMessage}
                >
                  {queuedMessage}
                </span>
                <button
                  type="button"
                  className="inline-flex h-4 w-4 flex-none items-center justify-center rounded-sm text-muted-foreground transition hover:bg-surface-2 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label={`Remover mensagem na fila ${index + 1}`}
                  onClick={() => onRemoveQueuedMessage?.(index)}
                  disabled={!onRemoveQueuedMessage}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            disabled
            className="ui-btn-primary invisible h-9 w-9 shrink-0 rounded-full p-0"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>
      ) : null}
      {/* hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="*/*"
        className="sr-only"
        onChange={handleFileInputChange}
      />
      {/* md preview */}
      {mdPreview && value ? (
        <div className="composer-md-preview agent-markdown mb-2">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
        </div>
      ) : null}
      {/* attached file chips */}
      {attachedFiles.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {attachedFiles.map((f, index) => (
            <span key={`${f.name}-${index}`} className="attachment-chip">
              <Paperclip className="h-3 w-3" />
              <span className="max-w-[120px] truncate">{f.name}</span>
              <button
                type="button"
                className="ml-0.5 text-white/40 hover:text-white/80"
                onClick={() => onRemoveAttachment?.(index)}
                aria-label={`Remover ${f.name}`}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
      <div className="relative flex min-w-0 items-end gap-2">
        <textarea
          ref={inputRef}
          rows={1}
          value={value}
          className="chat-composer-input min-h-[28px] max-h-[30vh] min-w-0 flex-1 resize-none border-0 bg-transparent px-0 py-1 text-[14px] leading-6 text-foreground outline-none shadow-none transition placeholder:text-muted-foreground/65 focus:outline-none focus-visible:outline-none focus-visible:ring-0"
          onChange={onChange}
          onKeyDown={onKeyDown}
          placeholder="escreva uma mensagem"
        />
        {running ? (
          <button
            className="shrink-0 rounded-full border border-border/70 bg-surface-3 p-2 text-foreground transition hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            onClick={onStop}
            disabled={stopDisabled}
            aria-label={stopAriaLabel}
            title={stopReason || "Parar agente"}
          >
            <Square className="h-4 w-4" />
          </button>
        ) : (
          <button
            className="ui-btn-primary shrink-0 rounded-full p-2 disabled:cursor-not-allowed disabled:border-border disabled:bg-muted disabled:text-muted-foreground"
            type="button"
            onClick={onSend}
            disabled={sendDisabled}
            aria-label="Enviar mensagem"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="mt-1 flex flex-row flex-wrap items-center justify-between gap-1 sm:mt-1 sm:gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1 sm:gap-1.5">
          <InlineHoverTooltip text="Escolher modelo — clique para ver todos">
            <button
              type="button"
              className="ui-input ui-control-important inline-flex h-6 min-w-0 items-center gap-1 rounded-md px-1.5 text-[10px] font-semibold text-foreground hover:bg-white/8 transition-colors"
              style={{ maxWidth: "clamp(12ch, 58vw, 30ch)" }}
              aria-label="Selecionar modelo"
              onClick={() => setModelModalOpen(true)}
            >
              <span className="truncate">{modelSelectedLabel}</span>
            </button>
          </InlineHoverTooltip>
          {allowThinking ? (
            <InlineHoverTooltip text="Nível de raciocínio — clique para saber mais">
              <button
                type="button"
                className="ui-input ui-control-important inline-flex h-6 min-w-0 items-center gap-1 rounded-md px-1.5 text-[10px] font-semibold text-foreground hover:bg-white/8 transition-colors"
                style={{ maxWidth: "min(40vw, 16ch)" }}
                aria-label="Selecionar nível de raciocínio"
                onClick={() => setReasoningModalOpen(true)}
              >
                <span className="truncate">{thinkingSelectedLabel}</span>
              </button>
            </InlineHoverTooltip>
          ) : null}
        </div>
        <div className="composer-toolbar flex flex-wrap items-center justify-end gap-1 text-[10px] text-muted-foreground sm:gap-1.5">
          {/* attach file button */}
          <InlineHoverTooltip text={attachedFiles.length > 0 ? `${attachedFiles.length} arquivo(s) anexado(s)` : "Anexar arquivos à mensagem"}>
            <button
              type="button"
              className={`ui-btn-icon ui-btn-icon-xs ${attachedFiles.length > 0 ? "btn-active-indicator" : ""}`}
              aria-label="Anexar arquivo"
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip className="h-3.5 w-3.5" />
            </button>
          </InlineHoverTooltip>
          {/* md preview toggle */}
          <InlineHoverTooltip text={mdPreview ? "Ocultar prévia do markdown" : "Visualizar markdown renderizado"}>
            <button
              type="button"
              className={`ui-btn-icon ui-btn-icon-xs ${mdPreview ? "btn-active-indicator" : ""}`}
              role="switch"
              aria-checked={mdPreview}
              aria-label="Alternar prévia de markdown"
              onClick={onMdPreviewToggle}
            >
              <FileText className="h-3.5 w-3.5" />
            </button>
          </InlineHoverTooltip>
          {/* open files panel */}
          {onOpenFilesPanel ? (
            <InlineHoverTooltip text="Abrir cofre de arquivos">
              <button
                type="button"
                className="ui-btn-icon ui-btn-icon-xs"
                aria-label="Abrir cofre de arquivos"
                onClick={onOpenFilesPanel}
              >
                <FolderOpen className="h-3.5 w-3.5" />
              </button>
            </InlineHoverTooltip>
          ) : null}
          <InlineHoverTooltip text={toolCallingEnabled ? "Chamadas de ferramentas no histórico (clique para ocultar)" : "Exibir chamadas de ferramentas"}>
            <button
              type="button"
              role="switch"
              aria-label="Exibir chamadas de ferramentas"
              aria-checked={toolCallingEnabled}
              className={`inline-flex h-5 shrink-0 items-center rounded-sm border px-1.5 font-mono text-[10px] tracking-[0.01em] transition ${
                toolCallingEnabled
                  ? "border-primary/45 bg-primary/14 text-foreground"
                  : "border-border/70 bg-surface-2/40 text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => onToolCallingToggle(!toolCallingEnabled)}
            >
              Ferramentas
            </button>
          </InlineHoverTooltip>
          <InlineHoverTooltip text={showThinkingTraces ? "Raciocínio visível (clique para ocultar)" : "Exibir raciocínio do agente"}>
            <button
              type="button"
              role="switch"
              aria-label="Exibir raciocínio"
              aria-checked={showThinkingTraces}
              className={`inline-flex h-5 shrink-0 items-center rounded-sm border px-1.5 font-mono text-[10px] tracking-[0.01em] transition ${
                showThinkingTraces
                  ? "border-primary/45 bg-primary/14 text-foreground"
                  : "border-border/70 bg-surface-2/40 text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => onThinkingTracesToggle(!showThinkingTraces)}
            >
              Raciocínio
            </button>
          </InlineHoverTooltip>
        </div>
      </div>
      <ModelSelectorModal
        open={modelModalOpen}
        modelOptions={modelOptions}
        currentValue={modelValue}
        models={allModels}
        onSelect={(value) => onModelChange(value || null)}
        onClose={() => setModelModalOpen(false)}
      />
      <ReasoningModal
        open={reasoningModalOpen}
        currentValue={thinkingValue}
        onSelect={(value) => onThinkingChange(value)}
        onClose={() => setReasoningModalOpen(false)}
      />
    </div>
  );
});

export const AgentChatPanel = ({
  agent,
  isSelected,
  canSend,
  models,
  stopBusy,
  stopDisabledReason = null,
  onLoadMoreHistory,
  onOpenSettings,
  onEditAgent,
  onRename,
  onNewSession,
  onModelChange,
  onThinkingChange,
  onToolCallingToggle = noopToggle,
  onThinkingTracesToggle = noopToggle,
  onDraftChange,
  onSend,
  onRemoveQueuedMessage,
  onStopRun,
  onAvatarShuffle: _onAvatarShuffle,
  pendingExecApprovals = [],
  onResolveExecApproval,
  onOpenFilesPanel,
}: AgentChatPanelProps) => {
  const [draftValue, setDraftValue] = useState(agent.draft);
  const [newSessionBusy, setNewSessionBusy] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [mdPreview, setMdPreview] = useState(false);
  const [renameEditing, setRenameEditing] = useState(false);
  const [renameSaving, setRenameSaving] = useState(false);
  const [renameDraft, setRenameDraft] = useState(agent.name);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [transcriptModalOpen, setTranscriptModalOpen] = useState(false);
  const draftRef = useRef<HTMLTextAreaElement | null>(null);
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const renameEditorRef = useRef<HTMLDivElement | null>(null);
  const scrollToBottomNextOutputRef = useRef(false);
  const plainDraftRef = useRef(agent.draft);
  const draftIdentityRef = useRef<{ agentId: string; sessionKey: string }>({
    agentId: agent.agentId,
    sessionKey: agent.sessionKey,
  });
  const firstPaintCycleRef = useRef<{
    cycleKey: string;
    startedAtMs: number;
  }>({
    cycleKey: buildChatFirstPaintCycleKey({
      agentId: agent.agentId,
      sessionKey: agent.sessionKey,
      sessionEpoch: agent.sessionEpoch,
    }),
    startedAtMs: Date.now(),
  });
  const firstPaintLoggedCycleKeyRef = useRef<string | null>(null);
  const pendingResizeFrameRef = useRef<number | null>(null);

  const resizeDraft = useCallback(() => {
    const el = draftRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
    el.style.overflowY = el.scrollHeight > el.clientHeight ? "auto" : "hidden";
  }, []);

  const handleDraftRef = useCallback((el: HTMLTextAreaElement | HTMLInputElement | null) => {
    draftRef.current = el instanceof HTMLTextAreaElement ? el : null;
  }, []);

  useEffect(() => {
    const previousIdentity = draftIdentityRef.current;
    const identityChanged =
      previousIdentity.agentId !== agent.agentId ||
      previousIdentity.sessionKey !== agent.sessionKey;
    if (identityChanged) {
      draftIdentityRef.current = {
        agentId: agent.agentId,
        sessionKey: agent.sessionKey,
      };
      plainDraftRef.current = agent.draft;
      setDraftValue(agent.draft);
      return;
    }
    if (agent.draft === plainDraftRef.current) return;
    if (agent.draft.length !== 0) return;
    plainDraftRef.current = "";
    setDraftValue("");
  }, [agent.agentId, agent.draft, agent.sessionKey]);

  useEffect(() => {
    firstPaintCycleRef.current = {
      cycleKey: buildChatFirstPaintCycleKey({
        agentId: agent.agentId,
        sessionKey: agent.sessionKey,
        sessionEpoch: agent.sessionEpoch,
      }),
      startedAtMs: Date.now(),
    };
    firstPaintLoggedCycleKeyRef.current = null;
  }, [agent.agentId, agent.sessionEpoch, agent.sessionKey]);

  useEffect(() => {
    setRenameEditing(false);
    setRenameSaving(false);
    setRenameError(null);
    setRenameDraft(agent.name);
  }, [agent.agentId, agent.name]);

  useEffect(() => {
    setTranscriptModalOpen(false);
  }, [agent.agentId, agent.sessionKey]);

  useEffect(() => {
    if (!renameEditing) return;
    const frameId = requestAnimationFrame(() => {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    });
    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [renameEditing]);

  useEffect(() => {
    if (pendingResizeFrameRef.current !== null) {
      cancelAnimationFrame(pendingResizeFrameRef.current);
    }
    pendingResizeFrameRef.current = requestAnimationFrame(() => {
      pendingResizeFrameRef.current = null;
      resizeDraft();
    });
    return () => {
      if (pendingResizeFrameRef.current !== null) {
        cancelAnimationFrame(pendingResizeFrameRef.current);
        pendingResizeFrameRef.current = null;
      }
    };
  }, [resizeDraft, draftValue]);

  const handleSend = useCallback(
    (message: string) => {
      if (!canSend) return;
      const trimmed = message.trim();
      if (!trimmed && attachedFiles.length === 0) return;
      let finalMessage = trimmed;
      if (attachedFiles.length > 0) {
        const attachmentBlock = `[Attached files]\n${attachedFiles
          .map((f) => `**${f.name}**:\n\`\`\`\n${f.content}\n\`\`\``)
          .join("\n\n")}\n\n`;
        finalMessage = attachmentBlock + (trimmed || "");
        setAttachedFiles([]);
      }
      if (!finalMessage.trim()) return;
      plainDraftRef.current = "";
      setDraftValue("");
      onDraftChange("");
      scrollToBottomNextOutputRef.current = true;
      onSend(finalMessage);
    },
    [attachedFiles, canSend, onDraftChange, onSend]
  );

  const visibleTranscriptEntries = useMemo(
    () => {
      const transcriptEntries =
        agent.transcriptEntries ??
        buildTranscriptEntriesFromLines({
          lines: agent.outputLines,
          sessionKey: agent.sessionKey,
          source: "legacy",
          startSequence: 0,
          confirmed: true,
        });
      return boundTranscriptEntriesBySemanticTurns({
        entries: transcriptEntries,
        turnLimit: agent.historyVisibleTurnLimit ?? DEFAULT_SEMANTIC_RENDER_TURN_LIMIT,
      });
    },
    [agent.historyVisibleTurnLimit, agent.outputLines, agent.sessionKey, agent.transcriptEntries]
  );
  const visibleOutputLines = useMemo(
    () => buildOutputLinesFromTranscriptEntries(visibleTranscriptEntries),
    [visibleTranscriptEntries]
  );
  const chatItems = useMemo(
    () =>
      buildFinalAgentChatItems({
        outputLines: visibleOutputLines,
        showThinkingTraces: agent.showThinkingTraces,
        toolCallingEnabled: agent.toolCallingEnabled,
      }),
    [agent.showThinkingTraces, agent.toolCallingEnabled, visibleOutputLines]
  );
  useEffect(() => {
    const cycle = firstPaintCycleRef.current;
    const resolution = resolveChatFirstPaint({
      transcriptItemCount: chatItems.length,
      lastUserMessage: agent.lastUserMessage,
      latestPreview: agent.latestPreview,
      agentId: agent.agentId,
      sessionKey: agent.sessionKey,
      sessionEpoch: agent.sessionEpoch,
      focusStartedAtMs: cycle.startedAtMs,
    });
    if (resolution.source === "none") return;
    if (resolution.cycleKey !== cycle.cycleKey) return;
    if (firstPaintLoggedCycleKeyRef.current === resolution.cycleKey) return;

    firstPaintLoggedCycleKeyRef.current = resolution.cycleKey;
    logTranscriptDebugMetric("chat_first_content", {
      agentId: agent.agentId,
      sessionKey: agent.sessionKey,
      sessionEpoch: agent.sessionEpoch ?? 0,
      source: resolution.source,
      elapsedMs: resolution.elapsedMs,
      transcriptItemCount: chatItems.length,
      hasLastUserMessage: resolution.hasLastUserMessage,
      hasLatestPreview: resolution.hasLatestPreview,
    });
  }, [
    agent.agentId,
    agent.lastUserMessage,
    agent.latestPreview,
    agent.sessionEpoch,
    agent.sessionKey,
    chatItems.length,
  ]);
  const running = agent.status === "running";
  const renderBlocks = useMemo(
    () => buildAgentChatRenderBlocks(chatItems),
    [chatItems]
  );
  const hasActiveStreamingTailInTranscript =
    running && renderBlocks.length > 0 && !renderBlocks[renderBlocks.length - 1].text;
  const liveAssistantText =
    running && agent.streamText ? normalizeAssistantDisplayText(agent.streamText) : "";
  const liveThinkingText =
    running && agent.showThinkingTraces && agent.thinkingTrace ? agent.thinkingTrace.trim() : "";
  const hasVisibleLiveThinking = Boolean(liveThinkingText.trim());
  const showTypingIndicator =
    running &&
    !hasVisibleLiveThinking &&
    !liveAssistantText &&
    !hasActiveStreamingTailInTranscript;

  const modelOptions = useMemo(
    () =>
      models.map((entry) => {
        const key = `${entry.provider}/${entry.id}`;
        const alias = typeof entry.name === "string" ? entry.name.trim() : "";
        return {
          value: key,
          label: !alias || alias === key ? key : alias,
          reasoning: entry.reasoning,
        };
      }),
    [models]
  );
  const modelValue = agent.model ?? "";
  const modelOptionsWithFallback =
    modelValue && !modelOptions.some((option) => option.value === modelValue)
      ? [{ value: modelValue, label: modelValue, reasoning: undefined }, ...modelOptions]
      : modelOptions;
  const selectedModel = modelOptionsWithFallback.find((option) => option.value === modelValue);
  const allowThinking = selectedModel?.reasoning !== false;

  const avatarSeed = agent.avatarSeed ?? agent.agentId;
  const scrollToBottomOnOpenKey = `${agent.agentId}:${agent.sessionKey}:${agent.sessionEpoch ?? 0}`;
  const emptyStateTitle = useMemo(
    () => resolveEmptyChatIntroMessage(agent.agentId, agent.sessionEpoch),
    [agent.agentId, agent.sessionEpoch]
  );
  const sendDisabled = !canSend || (!draftValue.trim() && attachedFiles.length === 0);

  const handleComposerChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      const value = event.target.value;
      plainDraftRef.current = value;
      setDraftValue(value);
      onDraftChange(value);
    },
    [onDraftChange]
  );

  const handleComposerKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
      if (event.key !== "Enter" || event.shiftKey) return;
      if (event.defaultPrevented) return;
      event.preventDefault();
      handleSend(draftValue);
    },
    [draftValue, handleSend]
  );

  const handleComposerSend = useCallback(() => {
    handleSend(draftValue);
  }, [draftValue, handleSend]);

  const handleComposerValueSet = useCallback(
    (newValue: string) => {
      plainDraftRef.current = newValue;
      setDraftValue(newValue);
      onDraftChange(newValue);
    },
    [onDraftChange]
  );

  // ── Slash command state (lives in AgentChatPanel to avoid overflow-hidden clipping) ──
  const [slashCmdIdx, setSlashCmdIdx] = useState(0);
  const slashMatches = useMemo<readonly SlashCommand[]>(() => {
    if (!draftValue.startsWith("/")) return [];
    const q = draftValue.slice(1).toLowerCase().trimEnd();
    return SLASH_COMMANDS.filter((c) => c.command.slice(1).startsWith(q));
  }, [draftValue]);
  const slashCmdOpen = slashMatches.length > 0;

  const selectSlashCommand = useCallback(
    (cmd: string) => {
      handleComposerValueSet(cmd + " ");
      setSlashCmdIdx(0);
    },
    [handleComposerValueSet]
  );

  const handleComposerKeyDownWithSlash = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (slashCmdOpen) {
        if (event.key === "ArrowDown") {
          event.preventDefault();
          setSlashCmdIdx((i) => Math.min(i + 1, slashMatches.length - 1));
          return;
        }
        if (event.key === "ArrowUp") {
          event.preventDefault();
          setSlashCmdIdx((i) => Math.max(i - 1, 0));
          return;
        }
        if (event.key === "Tab") {
          event.preventDefault();
          if (slashMatches[slashCmdIdx]) selectSlashCommand(slashMatches[slashCmdIdx].command);
          return;
        }
        if (event.key === "Escape") {
          event.preventDefault();
          handleComposerValueSet("");
          setSlashCmdIdx(0);
          return;
        }
        if (event.key === "Enter") {
          event.preventDefault();
          if (slashMatches[slashCmdIdx]) selectSlashCommand(slashMatches[slashCmdIdx].command);
          return;
        }
      }
      handleComposerKeyDown(event);
    },
    [slashCmdOpen, slashMatches, slashCmdIdx, handleComposerKeyDown, handleComposerValueSet, selectSlashCommand]
  );

  useEffect(() => {
    setSlashCmdIdx(0);
  }, [slashMatches.length]);
  // ──────────────────────────────────────────────────────────────────────────────────────

  const beginRename = useCallback(() => {
    if (!onRename) return;
    setRenameEditing(true);
    setRenameDraft(agent.name);
    setRenameError(null);
  }, [agent.name, onRename]);

  const cancelRename = useCallback(() => {
    if (renameSaving) return;
    setRenameEditing(false);
    setRenameDraft(agent.name);
    setRenameError(null);
  }, [agent.name, renameSaving]);

  useEffect(() => {
    if (!renameEditing) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (renameEditorRef.current?.contains(target)) return;
      cancelRename();
    };
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [cancelRename, renameEditing]);

  const submitRename = useCallback(async () => {
    if (!onRename || renameSaving) return;
    const nextName = renameDraft.trim();
    const currentName = agent.name.trim();
    if (!nextName) {
      setRenameError("Nome do agente é obrigatório.");
      return;
    }
    if (nextName === currentName) {
      setRenameEditing(false);
      setRenameError(null);
      setRenameDraft(agent.name);
      return;
    }
    setRenameSaving(true);
    setRenameError(null);
    try {
      const ok = await onRename(nextName);
      if (!ok) {
        setRenameError("Falha ao renomear agente.");
        return;
      }
      setRenameEditing(false);
      setRenameDraft(nextName);
    } finally {
      setRenameSaving(false);
    }
  }, [agent.name, onRename, renameDraft, renameSaving]);

  const handleRenameInputKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        void submitRename();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        cancelRename();
      }
    },
    [cancelRename, submitRename]
  );

  const handleNewSession = useCallback(async () => {
    if (!onNewSession || newSessionBusy || !canSend) return;
    setNewSessionBusy(true);
    try {
      await onNewSession();
    } finally {
      setNewSessionBusy(false);
    }
  }, [canSend, newSessionBusy, onNewSession]);

  const newSessionDisabled = newSessionBusy || !canSend || !onNewSession;

  return (
    <div data-agent-panel className="group fade-up relative flex h-full w-full min-w-0 flex-col overflow-hidden">
      <div className="px-2 pt-1.5 sm:px-4 sm:pt-3">
        <div className="flex items-center justify-between gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-center gap-2 sm:items-start sm:gap-3">
            <AgentAvatar
              seed={avatarSeed}
              name={agent.name}
              avatarUrl={agent.avatarUrl ?? null}
              size={36}
              isSelected={isSelected}
            />

            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-1.5">
                <div className="min-w-0 w-[clamp(7rem,38vw,16rem)] sm:w-[clamp(11rem,34vw,16rem)]">
                  {renameEditing ? (
                    <div ref={renameEditorRef} className="flex h-8 items-center gap-1.5">
                      <input
                        ref={renameInputRef}
                        className="ui-input agent-rename-input h-8 min-w-0 flex-1 rounded-md px-2 text-[12px] font-semibold text-foreground"
                        aria-label="Editar nome do agente"
                        data-testid="agent-rename-input"
                        value={renameDraft}
                        disabled={renameSaving}
                        onChange={(event) => {
                          setRenameDraft(event.target.value);
                          if (renameError) setRenameError(null);
                        }}
                        onKeyDown={handleRenameInputKeyDown}
                      />
                      <button
                        className="ui-btn-icon ui-btn-icon-sm agent-rename-control"
                        type="button"
                        aria-label="Salvar nome do agente"
                        data-testid="agent-rename-save"
                        onClick={() => {
                          void submitRename();
                        }}
                        disabled={renameSaving}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        className="ui-btn-icon ui-btn-icon-sm agent-rename-control"
                        type="button"
                        aria-label="Cancelar renomeação do agente"
                        data-testid="agent-rename-cancel"
                        onClick={cancelRename}
                        disabled={renameSaving}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex h-8 min-w-0 items-center gap-1.5">
                      <div className="type-agent-name min-w-0 truncate text-foreground">
                        {agent.name}
                      </div>
                      {(onRename || onEditAgent) ? (
                        <button
                          className="ui-btn-icon ui-btn-icon-xs agent-rename-control shrink-0"
                          type="button"
                          aria-label="Editar agente"
                          data-testid="agent-rename-toggle"
                          onClick={() => { if (onEditAgent) { onEditAgent(); } else { beginRename(); } }}
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
              {renameError ? (
                <div className="ui-text-danger mt-1 text-[11px]">{renameError}</div>
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <button
              className="nodrag ui-btn-icon !inline-flex md:!hidden"
              type="button"
              aria-label="Expandir histórico"
              title="Expandir histórico"
              onClick={() => setTranscriptModalOpen(true)}
            >
              <Maximize2 className="h-4 w-4" />
            </button>
            <button
              className="nodrag ui-btn-primary hidden px-2 py-1 font-mono text-[10px] font-medium tracking-[0.02em] disabled:cursor-not-allowed disabled:border-border disabled:bg-muted disabled:text-muted-foreground sm:block sm:px-2.5 sm:py-1.5 sm:text-[11px]"
              type="button"
              data-testid="agent-new-session-toggle"
              aria-label="Iniciar nova sessão"
              title="Nova sessão"
              onClick={() => {
                void handleNewSession();
              }}
              disabled={newSessionDisabled}
            >
              {newSessionBusy ? "Iniciando..." : "Nova sessão"}
            </button>
            {/* mobile compact new session button */}
            <button
              className="nodrag ui-btn-icon ui-btn-icon-xs sm:hidden"
              type="button"
              aria-label="Iniciar nova sessão"
              title="Nova sessão"
              onClick={() => {
                void handleNewSession();
              }}
              disabled={newSessionDisabled}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="10" x2="14" y1="10" y2="10"/>
              </svg>
            </button>
            <button
              className="nodrag ui-btn-icon"
              type="button"
              data-testid="agent-settings-toggle"
              aria-label="Configurar comportamento"
              title="Comportamento"
              onClick={onOpenSettings}
            >
              <Cog className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="mt-1.5 flex min-h-0 flex-1 flex-col px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] sm:mt-3 sm:px-4 sm:pb-4">
        <div className="relative h-0 min-h-0 flex-1 overflow-hidden">
          <AgentChatTranscript
            agentId={agent.agentId}
            name={agent.name}
            avatarSeed={avatarSeed}
            avatarUrl={agent.avatarUrl ?? null}
            status={agent.status}
            historyMaybeTruncated={agent.historyMaybeTruncated}
            historyGatewayCapReached={agent.historyGatewayCapReached ?? false}
            historyFetchedCount={agent.historyFetchedCount}
            historyVisibleTurnLimit={agent.historyVisibleTurnLimit ?? null}
            onLoadMoreHistory={onLoadMoreHistory}
            renderBlocks={renderBlocks}
            liveThinkingText={liveThinkingText}
            liveAssistantText={liveAssistantText}
            showTypingIndicator={showTypingIndicator}
            outputLineCount={visibleOutputLines.length}
            liveAssistantCharCount={liveAssistantText.length}
            liveThinkingCharCount={liveThinkingText.length}
            runStartedAt={agent.runStartedAt}
            scrollToBottomOnOpenKey={scrollToBottomOnOpenKey}
            scrollToBottomNextOutputRef={scrollToBottomNextOutputRef}
            pendingExecApprovals={pendingExecApprovals}
            onResolveExecApproval={onResolveExecApproval}
            emptyStateTitle={emptyStateTitle}
            lastUserMessage={agent.lastUserMessage}
            latestPreview={agent.latestPreview}
            previewItems={agent.previewItems}
          />
        </div>

        <div className="relative z-20 mt-1.5 sm:mt-2">
          {slashCmdOpen ? (
            <SlashCommandPicker
              commands={slashMatches}
              activeIndex={slashCmdIdx}
              onSelect={selectSlashCommand}
            />
          ) : null}
          <AgentChatComposer
            value={draftValue}
            inputRef={handleDraftRef}
            onChange={handleComposerChange}
            onKeyDown={handleComposerKeyDownWithSlash}
            onSend={handleComposerSend}
            onStop={onStopRun}
            canSend={canSend}
            stopBusy={stopBusy}
            stopDisabledReason={stopDisabledReason}
            running={running}
            sendDisabled={sendDisabled}
            queuedMessages={agent.queuedMessages ?? []}
            onRemoveQueuedMessage={onRemoveQueuedMessage}
            modelOptions={modelOptionsWithFallback.map((option) => ({
              value: option.value,
              label: option.label,
              reasoning: option.reasoning,
            }))}
            allModels={models}
            modelValue={modelValue}
            allowThinking={allowThinking}
            thinkingValue={agent.thinkingLevel ?? ""}
            onModelChange={onModelChange}
            onThinkingChange={onThinkingChange}
            toolCallingEnabled={agent.toolCallingEnabled}
            showThinkingTraces={agent.showThinkingTraces}
            onToolCallingToggle={onToolCallingToggle}
            onThinkingTracesToggle={onThinkingTracesToggle}
            attachedFiles={attachedFiles}
            onAttachFile={(files) => setAttachedFiles((prev) => [...prev, ...files])}
            onRemoveAttachment={(index) =>
              setAttachedFiles((prev) => prev.filter((_, i) => i !== index))
            }
            mdPreview={mdPreview}
            onMdPreviewToggle={() => setMdPreview((v) => !v)}
            onOpenFilesPanel={onOpenFilesPanel}
          />
        </div>
      </div>

      {transcriptModalOpen ? (
        <div className="fixed inset-0 z-[130] flex min-h-0 flex-col bg-background md:hidden">
          <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
            <div className="truncate text-sm font-medium text-foreground">{agent.name} · Histórico</div>
            <button
              type="button"
              className="ui-btn-secondary px-3 py-1.5 text-xs"
              onClick={() => setTranscriptModalOpen(false)}
            >
              Fechar
            </button>
          </div>
          <div className="h-0 min-h-0 flex-1 overflow-hidden px-2 pb-2">
            <AgentChatTranscript
              agentId={agent.agentId}
              name={agent.name}
              avatarSeed={avatarSeed}
              avatarUrl={agent.avatarUrl ?? null}
              status={agent.status}
              historyMaybeTruncated={false}
              historyGatewayCapReached={false}
              historyFetchedCount={null}
              historyVisibleTurnLimit={null}
              onLoadMoreHistory={() => {}}
              renderBlocks={renderBlocks}
              liveThinkingText={liveThinkingText}
              liveAssistantText={liveAssistantText}
              showTypingIndicator={showTypingIndicator}
              outputLineCount={visibleOutputLines.length}
              liveAssistantCharCount={liveAssistantText.length}
              liveThinkingCharCount={liveThinkingText.length}
              runStartedAt={agent.runStartedAt}
              scrollToBottomOnOpenKey={`${scrollToBottomOnOpenKey}:modal`}
              scrollToBottomNextOutputRef={scrollToBottomNextOutputRef}
              pendingExecApprovals={[]}
              emptyStateTitle={emptyStateTitle}
              lastUserMessage={agent.lastUserMessage}
              latestPreview={agent.latestPreview}
              previewItems={agent.previewItems}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
};
