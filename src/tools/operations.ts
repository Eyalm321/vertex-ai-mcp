import { z } from "zod";
import { vertexRequest } from "../client.js";

export const operationTools = [
  {
    name: "vertex_get_operation",
    description: "Get the status and details of a long-running operation by ID.",
    inputSchema: z.object({
      operationId: z.string().describe("The operation ID"),
    }),
    handler: async (args: { operationId: string }) => {
      return vertexRequest("GET", `/operations/${args.operationId}`);
    },
  },
  {
    name: "vertex_list_operations",
    description: "List long-running operations in the current project and location.",
    inputSchema: z.object({
      filter: z.string().optional().describe("Filter expression"),
      pageSize: z.number().optional().describe("Maximum number of operations to return"),
      pageToken: z.string().optional().describe("Page token for pagination"),
    }),
    handler: async (args: { filter?: string; pageSize?: number; pageToken?: string }) => {
      return vertexRequest("GET", "/operations", undefined, {
        filter: args.filter,
        pageSize: args.pageSize,
        pageToken: args.pageToken,
      });
    },
  },
  {
    name: "vertex_cancel_operation",
    description: "Cancel a long-running operation.",
    inputSchema: z.object({
      operationId: z.string().describe("The operation ID to cancel"),
    }),
    handler: async (args: { operationId: string }) => {
      return vertexRequest("POST", `/operations/${args.operationId}:cancel`);
    },
  },
  {
    name: "vertex_delete_operation",
    description: "Delete a long-running operation. This does not cancel the operation; it only deletes the record.",
    inputSchema: z.object({
      operationId: z.string().describe("The operation ID to delete"),
    }),
    handler: async (args: { operationId: string }) => {
      return vertexRequest("DELETE", `/operations/${args.operationId}`);
    },
  },
  {
    name: "vertex_wait_operation",
    description: "Wait for a long-running operation to complete or reach a specified timeout.",
    inputSchema: z.object({
      operationId: z.string().describe("The operation ID to wait for"),
      timeout: z.string().optional().describe("Maximum time to wait (e.g. '30s')"),
    }),
    handler: async (args: { operationId: string; timeout?: string }) => {
      return vertexRequest("POST", `/operations/${args.operationId}:wait`, {
        ...(args.timeout && { timeout: args.timeout }),
      });
    },
  },
];
