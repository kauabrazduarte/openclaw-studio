import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Eye, EyeOff, Loader2, Plug, Server, Monitor, Cloud } from "lucide-react";
import type { GatewayStatus } from "@/lib/gateway/gateway-status";
import {
  isStudioLikelyRemote,
  resolveDefaultSetupScenario,
  resolveGatewayConnectionWarnings,
  type StudioConnectionWarning,
  type StudioInstallContext,
  type StudioSetupScenario,
} from "@/lib/studio/install-context";
import type { StudioGatewaySettings } from "@/lib/studio/settings";
import { resolveGatewayStatusBadgeClass, resolveGatewayStatusLabel } from "./colorSemantics";

type GatewayConnectScreenProps = {
  savedGatewayUrl: string;
  draftGatewayUrl: string;
  token: string;
  localGatewayDefaults: StudioGatewaySettings | null;
  localGatewayDefaultsHasToken: boolean;
  hasStoredToken: boolean;
  hasUnsavedChanges: boolean;
  installContext: StudioInstallContext;
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
  onUseLocalDefaults: () => void;
  onSaveSettings: () => void;
  onTestConnection: () => void;
  onDisconnect: () => void;
};

const resolveLocalGatewayPort = (gatewayUrl: string): number => {
  try {
    const parsed = new URL(gatewayUrl);
    const port = Number(parsed.port);
    if (Number.isFinite(port) && port > 0) return port;
  } catch {}
  return 18789;
};

const SCENARIO_ITEMS: Array<{
  value: StudioSetupScenario;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}> = [
  {
    value: "same-computer",
    icon: Monitor,
    title: "Mesma máquina",
    description: "Studio e OpenClaw rodam localmente.",
  },
  {
    value: "remote-gateway",
    icon: Cloud,
    title: "Gateway remoto",
    description: "Studio no seu computador, OpenClaw na nuvem.",
  },
  {
    value: "same-cloud-host",
    icon: Server,
    title: "Host remoto compartilhado",
    description: "Ambos rodam na mesma máquina remota.",
  },
];

export const GatewayConnectScreen = ({
  savedGatewayUrl,
  draftGatewayUrl,
  token,
  localGatewayDefaults,
  localGatewayDefaultsHasToken,
  hasStoredToken,
  hasUnsavedChanges,
  installContext,
  status,
  statusReason,
  error,
  testResult,
  saving,
  testing,
  disconnecting,
  onGatewayUrlChange,
  onTokenChange,
  onUseLocalDefaults,
  onSaveSettings,
  onTestConnection,
  onDisconnect,
}: GatewayConnectScreenProps) => {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const [showToken, setShowToken] = useState(false);
  const inferredScenario = useMemo(
    () =>
      resolveDefaultSetupScenario({
        installContext,
        gatewayUrl: draftGatewayUrl || savedGatewayUrl,
      }),
    [draftGatewayUrl, installContext, savedGatewayUrl]
  );
  const [selectedScenario, setSelectedScenario] = useState<StudioSetupScenario>(inferredScenario);
  const [scenarioTouched, setScenarioTouched] = useState(false);
  useEffect(() => {
    if (scenarioTouched) return;
    setSelectedScenario(inferredScenario);
  }, [inferredScenario, scenarioTouched]);
  const localPort = useMemo(
    () => resolveLocalGatewayPort(draftGatewayUrl || savedGatewayUrl),
    [draftGatewayUrl, savedGatewayUrl]
  );
  const localGatewayCommand = useMemo(() => `openclaw gateway --port ${localPort}`, [localPort]);
  const gatewayServeCommand = useMemo(
    () => `tailscale serve --yes --bg --https 443 http://127.0.0.1:${localPort}`,
    [localPort]
  );
  const studioServeCommand = "tailscale serve --yes --bg --https 443 http://127.0.0.1:3000";
  const studioOpenUrl =
    installContext.tailscale.loggedIn && installContext.tailscale.dnsName
      ? `https://${installContext.tailscale.dnsName}`
      : "https://<studio-host>.ts.net";
  const studioSshTarget =
    installContext.tailscale.dnsName ||
    installContext.studioHost.publicHosts[0] ||
    "<studio-host>";
  const studioTunnelCommand = `ssh -L 3000:127.0.0.1:3000 ${studioSshTarget}`;
  const gatewayTunnelCommand = `ssh -L ${localPort}:127.0.0.1:${localPort} user@<gateway-host>`;
  const warnings = useMemo<StudioConnectionWarning[]>(
    () =>
      resolveGatewayConnectionWarnings({
        gatewayUrl: draftGatewayUrl,
        installContext,
        scenario: selectedScenario,
        hasStoredToken,
        hasLocalGatewayToken: localGatewayDefaultsHasToken,
      }),
    [draftGatewayUrl, hasStoredToken, installContext, localGatewayDefaultsHasToken, selectedScenario]
  );
  const studioCliUpdateWarning = useMemo(() => {
    const studioCli = installContext.studioCli;
    if (!studioCli.installed || !studioCli.updateAvailable) return null;
    const current = studioCli.currentVersion?.trim() || "current";
    const latest = studioCli.latestVersion?.trim() || "latest";
    return `openclaw-studio CLI ${current} is installed, but ${latest} is available. Run npx -y openclaw-studio@latest to update.`;
  }, [installContext]);

  const statusCopy = useMemo(() => {
    if (status === "connected") return "Conectado ao gateway OpenClaw.";
    if (status === "connecting") return "Conectando ao OpenClaw…";
    if (status === "reconnecting") return "Reconectando ao gateway…";
    if (status === "error") return "Não foi possível conectar com as configurações salvas.";
    return "Configure o Studio para alcançar o seu gateway OpenClaw.";
  }, [status]);

  const actionBusy = saving || testing || disconnecting;
  const saveLabel = saving ? "Salvando…" : "Salvar";
  const testLabel = testing ? "Testando…" : "Testar";
  const disconnectLabel = disconnecting ? "Desconectando…" : "Desconectar";
  const tokenHelper = hasStoredToken
    ? "Token armazenado disponível neste host. Deixe em branco para manter."
    : localGatewayDefaultsHasToken
      ? "Token local do OpenClaw detectado. Deixe em branco para usá-lo."
      : "Insira o token do gateway que o Studio deve usar.";
  const remoteStudio = isStudioLikelyRemote(installContext);

  const setScenario = (value: StudioSetupScenario) => {
    setScenarioTouched(true);
    setSelectedScenario(value);
  };

  const applyLoopbackUrl = () => {
    onGatewayUrlChange(`ws://localhost:${localPort}`);
  };

  const copyCommand = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopyStatus("copied");
      window.setTimeout(() => setCopyStatus("idle"), 1200);
    } catch {
      setCopyStatus("failed");
      window.setTimeout(() => setCopyStatus("idle"), 1800);
    }
  };

  const commandField = (params: { value: string; label: string; helper?: string }) => (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] font-semibold tracking-[0.07em] text-white/30 uppercase">
          {params.label}
        </span>
        <button
          type="button"
          className="font-mono text-[10px] text-white/30 hover:text-white/60 transition-colors"
          onClick={() => void copyCommand(params.value)}
        >
          {copyStatus === "copied" ? "Copiado!" : copyStatus === "failed" ? "Falhou" : "Copiar"}
        </button>
      </div>
      <div className="ui-command-surface flex items-center gap-2 rounded px-3 py-2">
        <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap font-mono text-[12px]">
          {params.value}
        </code>
        <button
          type="button"
          className="ui-command-copy flex h-6 w-6 shrink-0 items-center justify-center rounded"
          onClick={() => void copyCommand(params.value)}
          aria-label={`Copy ${params.label}`}
        >
          {copyStatus === "copied" ? (
            <Check className="h-3 w-3" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </button>
      </div>
      {params.helper ? (
        <p className="text-[11px] leading-snug text-white/30">{params.helper}</p>
      ) : null}
    </div>
  );

  return (
    <div className="mx-auto flex w-full max-w-[800px] flex-1 flex-col gap-4 px-2 pb-4">
      {/* status banner */}
      <div
        className="flex items-center gap-3 rounded-lg border px-4 py-3"
        style={{ borderColor: "#1e1e1e", background: "#0a0a0a" }}
      >
        {status === "connecting" || status === "reconnecting" ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-amber-400" />
        ) : (
          <Plug
            className={`h-4 w-4 shrink-0 ${
              status === "connected" ? "text-emerald-400" : "text-white/25"
            }`}
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-white/80">{statusCopy}</p>
          {statusReason && (
            <p className="mt-0.5 text-xs text-white/35">
              {statusReason === "gateway_closed"
                ? "O socket do gateway foi fechado. O Studio continuará tentando reconectar."
                : statusReason}
            </p>
          )}
        </div>
        <span
          className={`ui-chip shrink-0 px-2.5 py-0.5 font-mono text-[10px] font-semibold tracking-[0.07em] ${resolveGatewayStatusBadgeClass(status)}`}
          data-status={status}
        >
          {resolveGatewayStatusLabel(status)}
        </span>
      </div>

      {/* scenario picker */}
      <div className="grid gap-2 sm:grid-cols-3">
        {SCENARIO_ITEMS.map(({ value, icon: Icon, title, description }) => {
          const active = selectedScenario === value;
          return (
            <button
              key={value}
              type="button"
              className={`rounded-lg border px-3 py-3 text-left transition-all duration-150 ${
                active
                  ? "border-white/20 bg-white/6"
                  : "border-white/6 bg-white/2 hover:border-white/12 hover:bg-white/4"
              }`}
              style={active ? { background: "rgba(255,255,255,0.05)" } : { background: "rgba(255,255,255,0.015)" }}
              onClick={() => setScenario(value)}
            >
              <div className="mb-2 flex items-center gap-2">
                <Icon
                  className={`h-4 w-4 ${active ? "text-white/70" : "text-white/30"}`}
                />
                <span
                  className={`text-xs font-semibold tracking-wide ${
                    active ? "text-white/80" : "text-white/40"
                  }`}
                >
                  {title}
                </span>
              </div>
              <p className="text-[11px] leading-relaxed text-white/30">{description}</p>
            </button>
          );
        })}
      </div>

      {/* setup guides */}
      <div className="grid gap-3 xl:grid-cols-2">
        <div
          className="rounded-lg border p-4 space-y-3"
          style={{ borderColor: "#1a1a1a", background: "#0c0c0c" }}
        >
          <p className="font-mono text-[10px] font-semibold tracking-[0.08em] text-white/30 uppercase">
            Como abrir o Studio
          </p>
          {selectedScenario === "same-computer" || selectedScenario === "remote-gateway" ? (
            <div className="space-y-2">
              <p className="text-xs text-white/50">
                Abra{" "}
                <code className="font-mono text-white/70">http://localhost:3000</code> nesta
                máquina.
              </p>
              <p className="text-[11px] text-white/25">
                Apenas o upstream do OpenClaw muda nesta configuração.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-white/50">
                Studio está em um host remoto.{" "}
                <code className="font-mono text-white/70">localhost:3000</code> só funciona lá.
              </p>
              {commandField({
                value: studioServeCommand,
                label: "Tailscale Serve (recomendado)",
                helper: `Então abra ${studioOpenUrl} no navegador.`,
              })}
              {commandField({
                value: studioTunnelCommand,
                label: "Túnel SSH (alternativo)",
              })}
              {remoteStudio && installContext.tailscale.loggedIn === false ? (
                <p className="text-[11px] text-white/30">
                  Tailscale não detectado. Tailscale Serve costuma ser mais fácil que bind público.
                </p>
              ) : null}
              {installContext.studioHost.publicHosts.length > 0 ? (
                <p className="text-[11px] text-white/30">
                  Studio vinculado além do loopback.{" "}
                  <code className="font-mono">STUDIO_ACCESS_TOKEN</code> é obrigatório.
                </p>
              ) : null}
            </div>
          )}
        </div>

        <div
          className="rounded-lg border p-4 space-y-3"
          style={{ borderColor: "#1a1a1a", background: "#0c0c0c" }}
        >
          <p className="font-mono text-[10px] font-semibold tracking-[0.08em] text-white/30 uppercase">
            Como o Studio acessa o OpenClaw
          </p>
          {selectedScenario === "remote-gateway" ? (
            <div className="space-y-3">
              <p className="text-xs text-white/50">
                Mantenha o gateway remoto no loopback e exponha com Tailscale Serve.
              </p>
              {commandField({
                value: gatewayServeCommand,
                label: "No host do gateway",
                helper: `No Studio, use wss://<gateway>.ts.net + seu token.`,
              })}
              {commandField({
                value: gatewayTunnelCommand,
                label: "Túnel SSH (alternativo)",
                helper: `Aponte o Studio para ws://localhost:${localPort}.`,
              })}
              <button
                type="button"
                className="ui-btn-secondary h-8 px-3 text-xs"
                onClick={applyLoopbackUrl}
              >
                Usar URL do túnel SSH
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-white/50">
                Mantenha upstream local:{" "}
                <code className="font-mono text-white/70">{`ws://localhost:${localPort}`}</code>
              </p>
              {commandField({
                value: localGatewayCommand,
                label: "Iniciar OpenClaw neste host",
              })}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="ui-btn-secondary h-8 px-3 text-xs"
                  onClick={applyLoopbackUrl}
                >
                  Usar localhost
                </button>
                {localGatewayDefaults ? (
                  <button
                    type="button"
                    className="ui-btn-secondary h-8 px-3 text-xs"
                    onClick={onUseLocalDefaults}
                  >
                    Usar padrões locais
                  </button>
                ) : null}
              </div>
              {localGatewayDefaults ? (
                <p className="text-[11px] text-white/30">
                  Configurações locais do OpenClaw detectadas em{" "}
                  <code className="font-mono">~/.openclaw/openclaw.json</code>.
                </p>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* warnings */}
      {studioCliUpdateWarning ? (
        <div className="ui-alert-danger px-4 py-2.5 text-xs">{studioCliUpdateWarning}</div>
      ) : null}
      {warnings.length > 0 ? (
        <div className="space-y-2">
          {warnings.map((warning) => (
            <div
              key={warning.id}
              className={
                warning.tone === "warn"
                  ? "ui-alert-danger px-4 py-2.5 text-xs"
                  : "rounded-lg border border-white/6 px-4 py-2.5 text-xs text-white/40"
              }
            >
              {warning.message}
            </div>
          ))}
        </div>
      ) : null}

      {/* connection form */}
      <div
        className="rounded-lg border p-4"
        style={{ borderColor: "#1a1a1a", background: "#0c0c0c" }}
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] font-semibold tracking-[0.08em] text-white/30 uppercase">
              Configurações de conexão
            </p>
            <p className="mt-0.5 text-xs text-white/45">URL do gateway e token de acesso.</p>
          </div>
          {hasUnsavedChanges && (
            <span className="font-mono text-[10px] text-amber-400/70">Alterações não salvas</span>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr]">
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] font-semibold tracking-[0.06em] text-white/35 uppercase">
              URL do gateway
            </span>
            <input
              className="ui-input h-9 rounded px-3 font-mono text-[13px] outline-none"
              type="text"
              value={draftGatewayUrl}
              onChange={(event) => onGatewayUrlChange(event.target.value)}
              placeholder={
                selectedScenario === "remote-gateway"
                  ? "wss://your-gateway.ts.net"
                  : `ws://localhost:${localPort}`
              }
              spellCheck={false}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] font-semibold tracking-[0.06em] text-white/35 uppercase">
              Token
            </span>
            <div className="relative">
              <input
                className="ui-input h-9 w-full rounded px-3 pr-9 font-mono text-[13px] outline-none"
                type={showToken ? "text" : "password"}
                value={token}
                onChange={(event) => onTokenChange(event.target.value)}
                placeholder={
                  hasStoredToken || localGatewayDefaultsHasToken
                    ? "manter existente"
                    : "token do gateway"
                }
                spellCheck={false}
              />
              <button
                type="button"
                className="absolute inset-y-0 right-1 my-auto flex h-7 w-7 items-center justify-center rounded text-white/30 hover:text-white/60"
                aria-label={showToken ? "Ocultar token" : "Mostrar token"}
                onClick={() => setShowToken((prev) => !prev)}
              >
                {showToken ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </label>
        </div>

        <p className="mt-2 text-[11px] text-white/30">{tokenHelper}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="ui-btn-primary h-9 px-4 text-xs font-semibold tracking-wide disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => void onSaveSettings()}
            disabled={actionBusy || !draftGatewayUrl.trim()}
          >
            {saveLabel}
          </button>
          <button
            type="button"
            className="ui-btn-secondary h-9 px-4 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => void onTestConnection()}
            disabled={actionBusy || !draftGatewayUrl.trim()}
          >
            {testLabel}
          </button>
          {status === "connected" ? (
            <button
              type="button"
              className="ui-btn-ghost h-9 px-4 text-xs"
              onClick={() => void onDisconnect()}
              disabled={actionBusy}
            >
              {disconnectLabel}
            </button>
          ) : null}
        </div>
      </div>

      {/* test result */}
      {testResult ? (
        <div
          className={
            testResult.kind === "error"
              ? "ui-alert-danger px-4 py-2.5 text-xs"
              : "rounded-lg border border-white/6 px-4 py-2.5 text-xs text-white/50"
          }
        >
          {testResult.message}
        </div>
      ) : null}

      {error ? <p className="ui-text-danger text-xs">{error}</p> : null}
    </div>
  );
};
