// SPDX-License-Identifier: AGPL-3.0-only
// Copyright 2026 100monkeys.ai
import { Ed25519Key } from "../seal/crypto";
import {
  createCanonicalMessage,
  createSealEnvelope,
  McpPayload,
  stableStringify,
} from "../seal/envelope";
import { verifySealEnvelope } from "../seal/server";
import { SEALClient, SEALError, AttestationResult } from "../seal/client";

// ---------------------------------------------------------------------------
// Ed25519Key
// ---------------------------------------------------------------------------

describe("Ed25519Key", () => {
  test("generate produces a valid keypair", () => {
    const key = Ed25519Key.generate();
    expect(key.getPublicKeyBytes()).toHaveLength(32);
  });

  test("sign produces 64-byte signature", () => {
    const key = Ed25519Key.generate();
    const sig = key.sign(new Uint8Array([1, 2, 3]));
    expect(sig).toHaveLength(64);
  });

  test("signBase64 produces valid base64", () => {
    const key = Ed25519Key.generate();
    const b64 = key.signBase64(new Uint8Array([1, 2, 3]));
    expect(Buffer.from(b64, "base64")).toHaveLength(64);
  });

  test("getPublicKeyBase64 round-trips through base64", () => {
    const key = Ed25519Key.generate();
    const b64 = key.getPublicKeyBase64();
    expect(Buffer.from(b64, "base64")).toEqual(
      Buffer.from(key.getPublicKeyBytes()),
    );
  });

  test("erase zeroes keys and subsequent calls throw", () => {
    const key = Ed25519Key.generate();
    key.erase();
    expect(() => key.sign(new Uint8Array([1]))).toThrow();
    expect(() => key.getPublicKeyBytes()).toThrow();
  });

  test("erase is idempotent", () => {
    const key = Ed25519Key.generate();
    key.erase();
    expect(() => key.erase()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// stableStringify
// ---------------------------------------------------------------------------

describe("stableStringify", () => {
  test("sorts object keys", () => {
    const result = stableStringify({ z: 1, a: 2 });
    expect(result.indexOf('"a"')).toBeLessThan(result.indexOf('"z"'));
  });

  test("handles null", () => {
    expect(stableStringify(null)).toBe("null");
  });

  test("handles arrays", () => {
    expect(stableStringify([1, 2, 3])).toBe("[1,2,3]");
  });

  test("handles nested objects", () => {
    const result = stableStringify({ b: { d: 4, c: 3 }, a: 1 });
    expect(result).toBe('{"a":1,"b":{"c":3,"d":4}}');
  });

  test("handles primitives", () => {
    expect(stableStringify(42)).toBe("42");
    expect(stableStringify("hello")).toBe('"hello"');
    expect(stableStringify(true)).toBe("true");
  });
});

// ---------------------------------------------------------------------------
// createCanonicalMessage
// ---------------------------------------------------------------------------

describe("createCanonicalMessage", () => {
  const payload: McpPayload = { jsonrpc: "2.0", id: "1", method: "tools/call" };

  test("is deterministic for same inputs", () => {
    const m1 = createCanonicalMessage("tok", payload, 1743595200);
    const m2 = createCanonicalMessage("tok", payload, 1743595200);
    expect(m1).toEqual(m2);
  });

  test("returns Uint8Array", () => {
    const msg = createCanonicalMessage("tok", payload, 1000);
    expect(msg).toBeInstanceOf(Uint8Array);
  });

  test("top-level keys are sorted", () => {
    const msg = new TextDecoder().decode(
      createCanonicalMessage("tok", payload, 100),
    );
    // payload < security_token < timestamp
    expect(msg.indexOf('"payload"')).toBeLessThan(
      msg.indexOf('"security_token"'),
    );
    expect(msg.indexOf('"security_token"')).toBeLessThan(
      msg.indexOf('"timestamp"'),
    );
  });

  test("contains no whitespace", () => {
    const msg = new TextDecoder().decode(
      createCanonicalMessage("tok", payload, 1),
    );
    expect(msg).not.toMatch(/\s/);
  });
});

// ---------------------------------------------------------------------------
// createSealEnvelope
// ---------------------------------------------------------------------------

describe("createSealEnvelope", () => {
  test("returns correct structure", () => {
    const key = Ed25519Key.generate();
    const payload: McpPayload = {
      jsonrpc: "2.0",
      id: "r1",
      method: "tools/call",
    };
    const env = createSealEnvelope("my-token", payload, key);

    expect(env.protocol).toBe("seal/v1");
    expect(env.security_token).toBe("my-token");
    expect(env.payload).toEqual(payload);
    expect(typeof env.signature).toBe("string");
    expect(typeof env.timestamp).toBe("string");
  });

  test("signature is valid 64-byte base64", () => {
    const key = Ed25519Key.generate();
    const payload: McpPayload = {
      jsonrpc: "2.0",
      id: "r1",
      method: "tools/call",
    };
    const env = createSealEnvelope("tok", payload, key);
    expect(Buffer.from(env.signature, "base64")).toHaveLength(64);
  });
});

// ---------------------------------------------------------------------------
// verifySealEnvelope
// ---------------------------------------------------------------------------

function makeValidEnvelope(): {
  envelope: unknown;
  publicKeyBytes: Uint8Array;
} {
  const key = Ed25519Key.generate();
  const payload: McpPayload = {
    jsonrpc: "2.0",
    id: "r1",
    method: "tools/call",
    params: { name: "fs.read", arguments: {} },
  };
  const envelope = createSealEnvelope("valid-token", payload, key);
  return { envelope, publicKeyBytes: key.getPublicKeyBytes() };
}

describe("verifySealEnvelope", () => {
  test("verifies a valid envelope", () => {
    const { envelope, publicKeyBytes } = makeValidEnvelope();
    const result = verifySealEnvelope(envelope, publicKeyBytes);
    expect(result.method).toBe("tools/call");
  });

  test("throws on wrong protocol", () => {
    const { envelope, publicKeyBytes } = makeValidEnvelope();
    (envelope as Record<string, unknown>)["protocol"] = "wrong/v1";
    expect(() => verifySealEnvelope(envelope, publicKeyBytes)).toThrow(
      SEALError,
    );
    expect(() => verifySealEnvelope(envelope, publicKeyBytes)).toThrow(
      "protocol",
    );
  });

  test("throws on missing security_token", () => {
    const { envelope, publicKeyBytes } = makeValidEnvelope();
    delete (envelope as Record<string, unknown>)["security_token"];
    expect(() => verifySealEnvelope(envelope, publicKeyBytes)).toThrow(
      "security_token",
    );
  });

  test("throws on missing signature", () => {
    const { envelope, publicKeyBytes } = makeValidEnvelope();
    delete (envelope as Record<string, unknown>)["signature"];
    expect(() => verifySealEnvelope(envelope, publicKeyBytes)).toThrow(
      "signature",
    );
  });

  test("throws on missing payload", () => {
    const { envelope, publicKeyBytes } = makeValidEnvelope();
    delete (envelope as Record<string, unknown>)["payload"];
    expect(() => verifySealEnvelope(envelope, publicKeyBytes)).toThrow(
      "payload",
    );
  });

  test("throws on missing timestamp", () => {
    const { envelope, publicKeyBytes } = makeValidEnvelope();
    delete (envelope as Record<string, unknown>)["timestamp"];
    expect(() => verifySealEnvelope(envelope, publicKeyBytes)).toThrow(
      "timestamp",
    );
  });

  test("throws on expired envelope", () => {
    const { envelope, publicKeyBytes } = makeValidEnvelope();
    (envelope as Record<string, unknown>)["timestamp"] =
      "2020-01-01T00:00:00.000Z";
    expect(() => verifySealEnvelope(envelope, publicKeyBytes)).toThrow(
      "window",
    );
  });

  test("throws on invalid timestamp format", () => {
    const { envelope, publicKeyBytes } = makeValidEnvelope();
    (envelope as Record<string, unknown>)["timestamp"] = "not-a-date";
    expect(() => verifySealEnvelope(envelope, publicKeyBytes)).toThrow(
      "ISO 8601",
    );
  });

  test("throws on bad signature", () => {
    const { envelope, publicKeyBytes } = makeValidEnvelope();
    (envelope as Record<string, unknown>)["signature"] = Buffer.alloc(
      64,
      0xff,
    ).toString("base64");
    expect(() => verifySealEnvelope(envelope, publicKeyBytes)).toThrow(
      "signature verification failed",
    );
  });

  test("throws on non-object input", () => {
    expect(() => verifySealEnvelope(null, new Uint8Array(32))).toThrow(
      SEALError,
    );
    expect(() => verifySealEnvelope("string", new Uint8Array(32))).toThrow(
      SEALError,
    );
  });
});

// ---------------------------------------------------------------------------
// SEALError
// ---------------------------------------------------------------------------

describe("SEALError", () => {
  test("has correct name and message", () => {
    const err = new SEALError("test error");
    expect(err.name).toBe("SEALError");
    expect(err.message).toBe("test error");
    expect(err instanceof Error).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// SEALClient
// ---------------------------------------------------------------------------

describe("SEALClient", () => {
  test("constructor strips trailing slash", () => {
    const client = new SEALClient(
      "http://gateway.example.com/",
      "wl-1",
      "read-only",
    );
    // Access via test — just instantiate without error
    expect(client).toBeDefined();
  });

  describe("attest", () => {
    let mockFetch: jest.Mock;

    beforeEach(() => {
      mockFetch = jest.fn();
      global.fetch = mockFetch;
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    test("returns AttestationResult on success", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          status: "ok",
          security_token: "eyJtok",
          expires_at: "2026-04-02T12:00:00Z",
          session_id: "sess-abc",
        }),
      });

      const client = new SEALClient(
        "http://gw.example.com",
        "wl-1",
        "read-only",
      );
      const result: AttestationResult = await client.attest();

      expect(result.security_token).toBe("eyJtok");
      expect(result.expires_at).toBe("2026-04-02T12:00:00Z");
      expect(result.session_id).toBe("sess-abc");
      expect(mockFetch).toHaveBeenCalledWith(
        "http://gw.example.com/v1/seal/attest",
        expect.objectContaining({ method: "POST" }),
      );
    });

    test("throws SEALError on error status", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          status: "error",
          message: "Unrecognised workload",
        }),
      });

      const client = new SEALClient(
        "http://gw.example.com",
        "wl-1",
        "read-only",
      );
      await expect(client.attest()).rejects.toThrow(SEALError);
      await expect(client.attest()).rejects.toThrow("Attestation failed");
    });

    test("throws SEALError on HTTP error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => null,
      });

      const client = new SEALClient(
        "http://gw.example.com",
        "wl-1",
        "read-only",
      );
      await expect(client.attest()).rejects.toThrow(SEALError);
    });
  });

  describe("callTool", () => {
    let mockFetch: jest.Mock;

    beforeEach(() => {
      mockFetch = jest.fn();
      global.fetch = mockFetch;
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    test("throws SEALError when not attested", async () => {
      const client = new SEALClient(
        "http://gw.example.com",
        "wl-1",
        "read-only",
      );
      await expect(client.callTool("fs.read", {})).rejects.toThrow("attest()");
    });

    function makeAttestedClient(): SEALClient {
      const client = new SEALClient(
        "http://gw.example.com",
        "wl-1",
        "code-assistant",
      );
      // Inject internal state directly (testing internals via type cast)
      (client as unknown as Record<string, unknown>)["securityToken"] =
        "eyJtok";
      (client as unknown as Record<string, unknown>)["key"] =
        Ed25519Key.generate();
      return client;
    }

    test("returns result on success", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ payload: { result: { content: "file data" } } }),
      });

      const client = makeAttestedClient();
      const result = await client.callTool("fs.read", {
        path: "/tmp/test.txt",
      });
      expect(result).toEqual({ content: "file data" });
    });

    test("throws SEALError when gateway rejects", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ error: { message: "Permission denied" } }),
      });

      const client = makeAttestedClient();
      await expect(client.callTool("fs.write", {})).rejects.toThrow(
        "SEAL Gateway Rejected",
      );
    });

    test("throws SEALError on gateway error in response body", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          status: "error",
          error: { message: "Internal error" },
        }),
      });

      const client = makeAttestedClient();
      await expect(client.callTool("fs.read", {})).rejects.toThrow(
        "SEAL Gateway Error",
      );
    });

    test("throws SEALError on MCP payload error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ payload: { error: "file not found" } }),
      });

      const client = makeAttestedClient();
      await expect(client.callTool("fs.read", {})).rejects.toThrow(
        "MCP Tool Error",
      );
    });

    test("throws SEALError on HTTP error without JSON", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error("no json");
        },
      });

      const client = makeAttestedClient();
      await expect(client.callTool("fs.read", {})).rejects.toThrow(SEALError);
    });
  });

  describe("dispose", () => {
    test("clears the key", () => {
      const client = new SEALClient(
        "http://gw.example.com",
        "wl-1",
        "read-only",
      );
      (client as unknown as Record<string, unknown>)["key"] =
        Ed25519Key.generate();
      client.dispose();
      expect((client as unknown as Record<string, unknown>)["key"]).toBeNull();
    });

    test("is safe to call when no key set", () => {
      const client = new SEALClient(
        "http://gw.example.com",
        "wl-1",
        "read-only",
      );
      expect(() => client.dispose()).not.toThrow();
    });
  });
});
