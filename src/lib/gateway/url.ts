export const toGatewayHttpUrl = (wsUrl: string): string => {
  const trimmed = wsUrl.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("wss://")) {
    return `https://${trimmed.slice("wss://".length)}`;
  }
  if (trimmed.startsWith("ws://")) {
    return `http://${trimmed.slice("ws://".length)}`;
  }
  return trimmed;
};
