import { describe, expect, it } from "vitest";

import { normalizeStudioSettings } from "@/lib/studio/settings";
import { toGatewayHttpUrl } from "@/lib/gateway/url";

describe("studio settings normalization", () => {
  it("returns defaults for empty input", () => {
    const normalized = normalizeStudioSettings(null);
    expect(normalized.version).toBe(1);
    expect(normalized.gateway).toBeNull();
    expect(normalized.layouts).toEqual({});
  });

  it("normalizes gateway and layout entries", () => {
    const normalized = normalizeStudioSettings({
      gateway: { url: " ws://localhost:18789 ", token: " token " },
      layouts: {
        " ws://localhost:18789 ": {
          agents: {
            main: {
              position: { x: 12, y: 24 },
              size: { width: 480, height: 360 },
              avatarSeed: "seed",
            },
            bad: {
              position: { x: "nope", y: 0 },
              size: { width: 1, height: 1 },
            },
          },
        },
        "": {
          agents: {
            main: {
              position: { x: 1, y: 1 },
              size: { width: 1, height: 1 },
            },
          },
        },
      },
    });

    expect(normalized.gateway?.url).toBe("ws://localhost:18789");
    expect(normalized.gateway?.token).toBe("token");
    expect(Object.keys(normalized.layouts)).toEqual(["ws://localhost:18789"]);
    expect(normalized.layouts["ws://localhost:18789"].agents.main.position.x).toBe(12);
    expect(normalized.layouts["ws://localhost:18789"].agents.bad).toBeUndefined();
  });
});

describe("gateway url conversion", () => {
  it("converts ws urls to http", () => {
    expect(toGatewayHttpUrl("ws://localhost:18789")).toBe("http://localhost:18789");
    expect(toGatewayHttpUrl("wss://gw.example")).toBe("https://gw.example");
  });

  it("leaves http urls unchanged", () => {
    expect(toGatewayHttpUrl("http://localhost:18789")).toBe("http://localhost:18789");
    expect(toGatewayHttpUrl("https://gw.example"))
      .toBe("https://gw.example");
  });
});
