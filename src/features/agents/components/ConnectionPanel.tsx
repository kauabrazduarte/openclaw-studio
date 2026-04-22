import type { GatewayStatus } from "@/lib/gateway/gateway-status";
import { X } from "lucide-react";
import { resolveGatewayStatusBadgeClass, resolveGatewayStatusLabel } from "./colorSemantics";

type ConnectionPanelProps = {
  savedGatewayUrl: string;
  draftGatewayUrl: string;
  token: string;
  hasStoredToken: boolean;
  localGatewayDefaultsHasToken: boolean;
  hasUnsavedChanges: boolean;
  status: GatewayStatus;
  statusReason: string | null;
  error: string | null;
  testResult:
    | {
        kind: "success" | "error";
        message: string;
      }
    | null;
  saving: boolean;
  testing: boolean;
  disconnecting: boolean;
  onGatewayUrlChange: (value: string) => void;
  onTokenChange: (value: string) => void;
  onSaveSettings: () => void;
  onTestConnection: () => void;
  onDisconnect: () => void;
  onClose?: () => void;
};

export const ConnectionPanel = ({
  savedGatewayUrl,
  draftGatewayUrl,
  token,
  hasStoredToken,
  localGatewayDefaultsHasToken,
  hasUnsavedChanges,
  status,
  statusReason,
  error,
  testResult,
  saving,
  testing,
  disconnecting,
  onGatewayUrlChange,
  onTokenChange,
  onSaveSettings,
  onTestConnection,
  onDisconnect,
  onClose,
}: ConnectionPanelProps) => {
  const actionBusy = saving || testing || disconnecting;
  const tokenHelper = hasStoredToken
    ? "Token armazenado disponível neste host. Deixe em branco para manter."
    : localGatewayDefaultsHasToken
      ? "Um token local do OpenClaw está disponível neste host. Deixe em branco para usá-lo."
      : "Insira o token que o Studio deve usar para este gateway.";

  return (
    <div className="fade-up-delay flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`ui-chip inline-flex items-center px-3 py-1 font-mono text-[10px] font-semibold tracking-[0.08em] ${resolveGatewayStatusBadgeClass(status)}`}
            data-status={status}
          >
            {resolveGatewayStatusLabel(status)}
          </span>
          <button
            className="ui-btn-secondary px-4 py-2 text-xs font-semibold tracking-[0.05em] text-foreground disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            onClick={onSaveSettings}
            disabled={actionBusy || !draftGatewayUrl.trim()}
          >
            {saving ? "Salvando…" : "Salvar configurações"}
          </button>
          <button
            className="ui-btn-ghost px-4 py-2 text-xs font-semibold tracking-[0.05em] text-foreground disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            onClick={onTestConnection}
            disabled={actionBusy || !draftGatewayUrl.trim()}
          >
            {testing ? "Testando…" : "Testar conexão"}
          </button>
          {status === "connected" ? (
            <button
              className="ui-btn-ghost px-4 py-2 text-xs font-semibold tracking-[0.05em] text-foreground disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              onClick={onDisconnect}
              disabled={actionBusy}
            >
              {disconnecting ? "Desconectando…" : "Desconectar"}
            </button>
          ) : null}
        </div>
        {onClose ? (
          <button
            className="ui-btn-ghost inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold tracking-[0.05em] text-foreground"
            type="button"
            onClick={onClose}
            data-testid="gateway-connection-close"
            aria-label="Fechar painel de conexão do gateway"
          >
            <X className="h-3.5 w-3.5" />
            Fechar
          </button>
        ) : null}
      </div>
      <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
        <label className="flex flex-col gap-1 font-mono text-[10px] font-semibold tracking-[0.06em] text-muted-foreground">
          URL do gateway
          <input
            className="ui-input h-10 rounded-md px-4 font-sans text-sm text-foreground outline-none"
            type="text"
            value={draftGatewayUrl}
            onChange={(event) => onGatewayUrlChange(event.target.value)}
            placeholder="ws://localhost:18789 ou wss://seu-gateway.ts.net"
            spellCheck={false}
          />
        </label>
        <label className="flex flex-col gap-1 font-mono text-[10px] font-semibold tracking-[0.06em] text-muted-foreground">
          Token de acesso
          <input
            className="ui-input h-10 rounded-md px-4 font-sans text-sm text-foreground outline-none"
            type="password"
            value={token}
            onChange={(event) => onTokenChange(event.target.value)}
            placeholder="token do gateway"
            spellCheck={false}
          />
        </label>
      </div>
      <p className="text-xs text-muted-foreground">{tokenHelper}</p>
      {hasUnsavedChanges ? (
        <p className="font-mono text-[10px] font-semibold tracking-[0.06em] text-muted-foreground">
          Alterações não salvas
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Gateway salvo: <span className="font-mono">{savedGatewayUrl || "não configurado"}</span>
        </p>
      )}
      {statusReason ? <p className="text-xs text-muted-foreground">{statusReason}</p> : null}
      {testResult ? (
        <p
          className={
            testResult.kind === "error"
              ? "ui-alert-danger rounded-md px-4 py-2 text-sm"
              : "ui-card rounded-md px-4 py-2 text-sm text-muted-foreground"
          }
        >
          {testResult.message}
        </p>
      ) : null}
      {error ? (
        <p className="ui-alert-danger rounded-md px-4 py-2 text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
};
