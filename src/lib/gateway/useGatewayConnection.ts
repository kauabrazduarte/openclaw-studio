"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  GatewayClient,
  GatewayResponseError,
  GatewayStatus,
} from "./GatewayClient";
import { env } from "@/lib/env";
import type { StudioSettings } from "@/lib/studio/settings";

const DEFAULT_GATEWAY_URL = env.NEXT_PUBLIC_GATEWAY_URL ?? "ws://127.0.0.1:18789";
const formatGatewayError = (error: unknown) => {
  if (error instanceof GatewayResponseError) {
    return `Gateway error (${error.code}): ${error.message}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Unknown gateway error.";
};

export type GatewayConnectionState = {
  client: GatewayClient;
  status: GatewayStatus;
  gatewayUrl: string;
  token: string;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  setGatewayUrl: (value: string) => void;
  setToken: (value: string) => void;
  clearError: () => void;
};

export const useGatewayConnection = (): GatewayConnectionState => {
  const [client] = useState(() => new GatewayClient());
  const didAutoConnect = useRef(false);

  const [gatewayUrl, setGatewayUrl] = useState(DEFAULT_GATEWAY_URL);
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<GatewayStatus>("disconnected");
  const [error, setError] = useState<string | null>(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const saveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadSettings = async () => {
      try {
        const res = await fetch("/api/studio", { cache: "no-store" });
        if (!res.ok) {
          setSettingsLoaded(true);
          return;
        }
        const data = (await res.json()) as { settings?: StudioSettings };
        const gateway = data.settings?.gateway ?? null;
        if (cancelled) return;
        if (gateway?.url) {
          setGatewayUrl(gateway.url);
        }
        if (typeof gateway?.token === "string") {
          setToken(gateway.token);
        }
      } catch {
        if (!cancelled) {
          setError("Failed to load gateway settings.");
        }
      } finally {
        if (!cancelled) {
          setSettingsLoaded(true);
        }
      }
    };
    void loadSettings();
    return () => {
      cancelled = true;
    };
  }, []);

  const saveSettings = useCallback(
    async (nextUrl: string, nextToken: string) => {
      try {
        await fetch("/api/studio", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            gateway: {
              url: nextUrl.trim(),
              token: nextToken,
            },
          }),
        });
      } catch {
        setError("Failed to save gateway settings.");
      }
    },
    []
  );

  useEffect(() => {
    return client.onStatus((nextStatus) => {
      setStatus(nextStatus);
      if (nextStatus !== "connecting") {
        setError(null);
      }
    });
  }, [client]);

  useEffect(() => {
    return () => {
      client.disconnect();
    };
  }, [client]);

  const connect = useCallback(async () => {
    setError(null);
    try {
      await client.connect({ gatewayUrl, token });
    } catch (err) {
      setError(formatGatewayError(err));
    }
  }, [client, gatewayUrl, token]);

  useEffect(() => {
    if (didAutoConnect.current) return;
    if (!settingsLoaded) return;
    if (!gatewayUrl.trim()) return;
    didAutoConnect.current = true;
    void connect();
  }, [connect, gatewayUrl, settingsLoaded]);

  useEffect(() => {
    if (!settingsLoaded) return;
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      void saveSettings(gatewayUrl, token);
    }, 400);
    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [gatewayUrl, saveSettings, settingsLoaded, token]);

  const disconnect = useCallback(() => {
    setError(null);
    client.disconnect();
  }, [client]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    client,
    status,
    gatewayUrl,
    token,
    error,
    connect,
    disconnect,
    setGatewayUrl,
    setToken,
    clearError,
  };
};
