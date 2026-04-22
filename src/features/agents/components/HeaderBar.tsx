import { useEffect, useRef, useState } from "react";
import type { GatewayStatus } from "@/lib/gateway/gateway-status";
import { BarChart2, FolderOpen, Home, Plug, Zap } from "lucide-react";
import { resolveGatewayStatusBadgeClass, resolveGatewayStatusLabel } from "./colorSemantics";
import { Tooltip } from "@/components/Tooltip";

type HeaderBarProps = {
  status: GatewayStatus;
  onConnectionSettings: () => void;
  showConnectionSettings?: boolean;
  onGoHome?: () => void;
  onOpenAnalytics?: () => void;
  onOpenFilesPanel?: () => void;
};

export const HeaderBar = ({
  status,
  onConnectionSettings,
  showConnectionSettings = true,
  onGoHome,
  onOpenAnalytics,
  onOpenFilesPanel,
}: HeaderBarProps) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current) return;
      if (menuRef.current.contains(event.target as Node)) return;
      setMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const isConnected = status === "connected";
  const isConnecting = status === "connecting" || status === "reconnecting";

  return (
    <div
      className="ui-topbar relative z-[180] flex h-11 items-center justify-between px-4"
      style={{ borderBottom: "1px solid #151515" }}
    >
      {/* left: logo */}
      <div className="flex items-center gap-2">
        <span className="text-base leading-none">🐉</span>
        <span className="font-mono text-[13px] font-semibold tracking-[0.06em] text-white/80 uppercase">
          OpenClaw
        </span>
        <span
          className="hidden sm:inline font-mono text-[10px] font-medium tracking-[0.1em] text-white/25 uppercase"
        >
          Draak
        </span>
      </div>

      {/* right: status + actions */}
      <div className="flex items-center gap-1.5">
        {/* nav buttons */}
        {onGoHome ? (
          <Tooltip text="Go to home / agent list" side="bottom">
            <button
              type="button"
              className="ui-btn-icon ui-btn-icon-xs"
              onClick={onGoHome}
              aria-label="Go home"
            >
              <Home className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
        ) : null}
        {onOpenFilesPanel ? (
          <Tooltip text="File vault — uploads & favorites" side="bottom">
            <button
              type="button"
              className="ui-btn-icon ui-btn-icon-xs"
              onClick={onOpenFilesPanel}
              aria-label="Open file vault"
            >
              <FolderOpen className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
        ) : null}
        {onOpenAnalytics ? (
          <Tooltip text="System monitor & analytics" side="bottom">
            <button
              type="button"
              className="ui-btn-icon ui-btn-icon-xs"
              onClick={onOpenAnalytics}
              aria-label="Open analytics"
            >
              <BarChart2 className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
        ) : null}
        {/* gateway status pill */}
        <span
          className={`ui-chip px-2.5 py-0.5 font-mono text-[10px] font-semibold tracking-[0.08em] ${resolveGatewayStatusBadgeClass(status)}`}
          data-testid="gateway-status-indicator"
          data-status={status}
        >
          {isConnecting ? (
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block h-1.5 w-1.5 rounded-full bg-current animate-pulse"
                aria-hidden="true"
              />
              {resolveGatewayStatusLabel(status)}
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              {isConnected && (
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full bg-current"
                  aria-hidden="true"
                />
              )}
              {resolveGatewayStatusLabel(status)}
            </span>
          )}
        </span>

        {showConnectionSettings ? (
          <div className="relative z-[210]" ref={menuRef}>
            <button
              type="button"
              className="ui-btn-icon ui-btn-icon-xs"
              data-testid="studio-menu-toggle"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((prev) => !prev)}
              title="Gateway settings"
            >
              <Plug className="h-3.5 w-3.5" />
              <span className="sr-only">Open studio menu</span>
            </button>
            {menuOpen ? (
              <div
                className="ui-menu-popover absolute right-0 top-8 z-[260] min-w-48 rounded-lg p-1"
                role="menu"
              >
                <button
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs font-medium text-white/60 transition-colors hover:bg-white/5 hover:text-white/90"
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onConnectionSettings();
                    setMenuOpen(false);
                  }}
                  data-testid="gateway-settings-toggle"
                >
                  <Plug className="h-3.5 w-3.5" />
                  Gateway connection
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
};
