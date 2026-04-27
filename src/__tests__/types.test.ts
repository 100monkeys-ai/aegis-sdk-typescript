// SPDX-License-Identifier: AGPL-3.0-only
// Copyright 2026 100monkeys.ai

import { ExecutionSummary, WorkflowExecutionSummary } from "../types";

describe("ExecutionSummary summary field", () => {
  test("ExecutionSummary accepts summary field", () => {
    const e: ExecutionSummary = {
      id: "x",
      status: "completed",
      started_at: "2026-01-01T00:00:00Z",
      summary: "hi",
    };
    expect(e.summary).toBe("hi");
  });

  test("ExecutionSummary accepts null summary", () => {
    const e: ExecutionSummary = {
      id: "x",
      status: "completed",
      started_at: "2026-01-01T00:00:00Z",
      summary: null,
    };
    expect(e.summary).toBeNull();
  });

  test("ExecutionSummary accepts omitted summary", () => {
    const e: ExecutionSummary = {
      id: "x",
      status: "completed",
      started_at: "2026-01-01T00:00:00Z",
    };
    expect(e.summary).toBeUndefined();
  });
});

describe("WorkflowExecutionSummary summary field", () => {
  test("WorkflowExecutionSummary accepts summary field", () => {
    const w: WorkflowExecutionSummary = {
      id: "x",
      workflow_name: "wf",
      status: "completed",
      started_at: "2026-01-01T00:00:00Z",
      summary: "hi",
    };
    expect(w.summary).toBe("hi");
  });

  test("WorkflowExecutionSummary accepts null summary", () => {
    const w: WorkflowExecutionSummary = {
      id: "x",
      workflow_name: "wf",
      status: "completed",
      started_at: "2026-01-01T00:00:00Z",
      summary: null,
    };
    expect(w.summary).toBeNull();
  });

  test("WorkflowExecutionSummary accepts omitted summary", () => {
    const w: WorkflowExecutionSummary = {
      id: "x",
      workflow_name: "wf",
      status: "completed",
      started_at: "2026-01-01T00:00:00Z",
    };
    expect(w.summary).toBeUndefined();
  });
});
