// SPDX-License-Identifier: AGPL-3.0-only
// Copyright 2026 100monkeys.ai

import axios from "axios";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { AegisClient } from "../client";
import { attachmentRefFromUploadResponse, inferMimeType } from "../uploads";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

const bearerOptions = {
  baseUrl: "http://localhost:8080",
  bearerToken: "tok",
};

function makeClient(): { client: AegisClient; mockAxiosInstance: any } {
  const mockAxiosInstance: any = {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
    defaults: { headers: { common: {} } },
    interceptors: {
      request: { use: jest.fn() },
    },
  };
  mockedAxios.create.mockReturnValue(mockAxiosInstance as any);
  const client = new AegisClient(bearerOptions);
  return { client, mockAxiosInstance };
}

// ---------------------------------------------------------------------------
// inferMimeType
// ---------------------------------------------------------------------------

describe("inferMimeType", () => {
  it("returns the known type for a recognized extension", () => {
    expect(inferMimeType("report.pdf")).toBe("application/pdf");
  });

  it("returns application/octet-stream for unknown extensions", () => {
    expect(inferMimeType("blob.zzunknownzz")).toBe("application/octet-stream");
  });

  it("is case-insensitive on extension", () => {
    expect(inferMimeType("Report.PDF")).toBe("application/pdf");
  });
});

// ---------------------------------------------------------------------------
// attachmentRefFromUploadResponse
// ---------------------------------------------------------------------------

describe("attachmentRefFromUploadResponse", () => {
  it("uses the orchestrator's authoritative fields when present", () => {
    const ref = attachmentRefFromUploadResponse(
      "chat-attachments",
      "report.pdf",
      "application/pdf",
      {
        name: "report.pdf",
        path: "/uploads/2026-04-26/abc.pdf",
        size_bytes: 1234,
        uploaded_at: "2026-04-26T00:00:00Z",
        mime_type: "application/pdf",
        sha256: "deadbeef",
      },
    );
    expect(ref).toEqual({
      volume_id: "chat-attachments",
      path: "/uploads/2026-04-26/abc.pdf",
      name: "report.pdf",
      mime_type: "application/pdf",
      size: 1234,
      sha256: "deadbeef",
    });
  });

  it("falls back to client-side values when orchestrator omits optionals", () => {
    const ref = attachmentRefFromUploadResponse(
      "chat-attachments",
      "report.pdf",
      "application/pdf",
      { name: "report.pdf", size_bytes: 10, uploaded_at: "x" },
    );
    expect(ref.path).toBe("report.pdf");
    expect(ref.mime_type).toBe("application/pdf");
    expect(ref.sha256).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// attachToVolume — wire-level
// ---------------------------------------------------------------------------

describe("AegisClient.attachToVolume", () => {
  let tmpFile: string;

  beforeAll(() => {
    tmpFile = path.join(os.tmpdir(), `aegis-sdk-attach-${Date.now()}.pdf`);
    fs.writeFileSync(tmpFile, Buffer.from("%PDF-1.4 fake"));
  });

  afterAll(() => {
    try {
      fs.unlinkSync(tmpFile);
    } catch {
      // ignore
    }
  });

  it("POSTs to /v1/volumes/{id}/files/upload as multipart and returns AttachmentRef", async () => {
    const { client, mockAxiosInstance } = makeClient();
    mockAxiosInstance.post.mockResolvedValue({
      data: {
        name: "report.pdf",
        path: "/uploads/2026-04-26/report.pdf",
        size_bytes: 13,
        uploaded_at: "2026-04-26T00:00:00Z",
        mime_type: "application/pdf",
        sha256: "abc123",
      },
    });

    const ref = await client.attachToVolume("chat-attachments", tmpFile);

    expect(ref).toEqual({
      volume_id: "chat-attachments",
      path: "/uploads/2026-04-26/report.pdf",
      name: "report.pdf",
      mime_type: "application/pdf",
      size: 13,
      sha256: "abc123",
    });

    expect(mockAxiosInstance.post).toHaveBeenCalledTimes(1);
    const [url, body, config] = mockAxiosInstance.post.mock.calls[0];
    expect(url).toBe("/v1/volumes/chat-attachments/files/upload");
    expect(body).toBeInstanceOf(FormData);
    // Default: no path param.
    expect(config.params).toEqual({});
  });

  it("URL-encodes the volume id and forwards the path option", async () => {
    const { client, mockAxiosInstance } = makeClient();
    mockAxiosInstance.post.mockResolvedValue({
      data: { name: "doc.bin", size_bytes: 1, uploaded_at: "x" },
    });

    await client.attachToVolume("weird volume/id", Buffer.from("hello"), {
      path: "custom/dest.bin",
      name: "doc.bin",
      mimeType: "application/x-custom",
    });

    const [url, , config] = mockAxiosInstance.post.mock.calls[0];
    expect(url).toBe("/v1/volumes/weird%20volume%2Fid/files/upload");
    expect(config.params).toEqual({ path: "custom/dest.bin" });
  });

  it("accepts a Blob directly", async () => {
    const { client, mockAxiosInstance } = makeClient();
    mockAxiosInstance.post.mockResolvedValue({
      data: { name: "blob.txt", size_bytes: 5, uploaded_at: "x" },
    });

    const blob = new Blob(["hello"], { type: "text/plain" });
    const ref = await client.attachToVolume("my-volume", blob, {
      name: "blob.txt",
    });

    expect(ref.volume_id).toBe("my-volume");
    expect(ref.name).toBe("blob.txt");
  });
});

// ---------------------------------------------------------------------------
// executeAgent / startExecution / executeWorkflow — attachments parameter
// ---------------------------------------------------------------------------

const REF = {
  volume_id: "chat-attachments",
  path: "/uploads/2026-04-26/report.pdf",
  name: "report.pdf",
  mime_type: "application/pdf",
  size: 13,
  sha256: "abc",
};

describe("execution-dispatch attachments parameter", () => {
  it("executeAgent wires attachments into the request body", async () => {
    const { client, mockAxiosInstance } = makeClient();
    mockAxiosInstance.post.mockResolvedValue({
      data: { execution_id: "exec-1", status: "running" },
    });

    await client.executeAgent("agent-1", "summarize", undefined, undefined, [
      REF,
    ]);

    const [url, body] = mockAxiosInstance.post.mock.calls[0];
    expect(url).toBe("/v1/agents/agent-1/execute");
    expect(body.attachments).toEqual([REF]);
  });

  it("executeAgent omits attachments when undefined", async () => {
    const { client, mockAxiosInstance } = makeClient();
    mockAxiosInstance.post.mockResolvedValue({
      data: { execution_id: "exec-1", status: "running" },
    });

    await client.executeAgent("agent-1", "summarize");

    const [, body] = mockAxiosInstance.post.mock.calls[0];
    expect(body.attachments).toBeUndefined();
  });

  it("executeAgent omits attachments when empty array", async () => {
    const { client, mockAxiosInstance } = makeClient();
    mockAxiosInstance.post.mockResolvedValue({
      data: { execution_id: "exec-1", status: "running" },
    });

    await client.executeAgent("agent-1", "summarize", undefined, undefined, []);

    const [, body] = mockAxiosInstance.post.mock.calls[0];
    expect(body.attachments).toBeUndefined();
  });

  it("startExecution wires attachments", async () => {
    const { client, mockAxiosInstance } = makeClient();
    mockAxiosInstance.post.mockResolvedValue({
      data: { execution_id: "exec-2" },
    });

    await client.startExecution("agent-1", "do", undefined, undefined, [REF]);

    const [url, body] = mockAxiosInstance.post.mock.calls[0];
    expect(url).toBe("/v1/executions");
    expect(body.attachments).toEqual([REF]);
  });

  it("executeWorkflow wires attachments", async () => {
    const { client, mockAxiosInstance } = makeClient();
    mockAxiosInstance.post.mockResolvedValue({
      data: { execution_id: "wfx-1", status: "running" },
    });

    await client.executeWorkflow(
      "wf-summarize",
      { intent: "x" },
      undefined,
      undefined,
      [REF],
    );

    const [url, body] = mockAxiosInstance.post.mock.calls[0];
    expect(url).toBe("/v1/workflows/temporal/execute");
    expect(body.attachments).toEqual([REF]);
  });
});
