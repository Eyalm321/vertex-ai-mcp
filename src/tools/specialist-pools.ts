import { z } from "zod";
import { vertexRequest } from "../client.js";

export const specialistPoolTools = [
  {
    name: "vertex_create_specialist_pool",
    description: "Create a new specialist pool for data labeling.",
    inputSchema: z.object({
      displayName: z.string().describe("Human-readable display name for the specialist pool"),
      specialistManagerEmails: z.array(z.string()).describe("Email addresses of the specialist pool managers"),
      specialistWorkerEmails: z.array(z.string()).optional().describe("Email addresses of the specialist workers"),
      description: z.string().optional().describe("Description of the specialist pool"),
    }),
    handler: async (args: { displayName: string; specialistManagerEmails: string[]; specialistWorkerEmails?: string[]; description?: string }) => {
      return vertexRequest("POST", "/specialistPools", {
        displayName: args.displayName,
        specialistManagerEmails: args.specialistManagerEmails,
        ...(args.specialistWorkerEmails && { specialistWorkerEmails: args.specialistWorkerEmails }),
        ...(args.description && { description: args.description }),
      });
    },
  },
  {
    name: "vertex_get_specialist_pool",
    description: "Get details of a specific specialist pool by ID.",
    inputSchema: z.object({
      specialistPoolId: z.string().describe("The specialist pool ID"),
    }),
    handler: async (args: { specialistPoolId: string }) => {
      return vertexRequest("GET", `/specialistPools/${args.specialistPoolId}`);
    },
  },
  {
    name: "vertex_list_specialist_pools",
    description: "List all specialist pools in the current project and location.",
    inputSchema: z.object({
      pageSize: z.number().optional().describe("Maximum number of specialist pools to return"),
      pageToken: z.string().optional().describe("Page token for pagination"),
    }),
    handler: async (args: { pageSize?: number; pageToken?: string }) => {
      return vertexRequest("GET", "/specialistPools", undefined, {
        pageSize: args.pageSize,
        pageToken: args.pageToken,
      });
    },
  },
  {
    name: "vertex_delete_specialist_pool",
    description: "Delete a specialist pool by ID.",
    inputSchema: z.object({
      specialistPoolId: z.string().describe("The specialist pool ID to delete"),
      force: z.boolean().optional().describe("If true, force delete even if the pool has data labeling jobs"),
    }),
    handler: async (args: { specialistPoolId: string; force?: boolean }) => {
      return vertexRequest("DELETE", `/specialistPools/${args.specialistPoolId}`, undefined, {
        ...(args.force !== undefined && { force: args.force }),
      });
    },
  },
  {
    name: "vertex_update_specialist_pool",
    description: "Update a specialist pool's metadata.",
    inputSchema: z.object({
      specialistPoolId: z.string().describe("The specialist pool ID to update"),
      displayName: z.string().optional().describe("Updated display name"),
      specialistManagerEmails: z.array(z.string()).optional().describe("Updated specialist manager email addresses"),
      description: z.string().optional().describe("Updated description"),
      updateMask: z.string().describe("Comma-separated list of fields to update"),
    }),
    handler: async (args: { specialistPoolId: string; displayName?: string; specialistManagerEmails?: string[]; description?: string; updateMask: string }) => {
      return vertexRequest("PATCH", `/specialistPools/${args.specialistPoolId}`, {
        ...(args.displayName && { displayName: args.displayName }),
        ...(args.specialistManagerEmails && { specialistManagerEmails: args.specialistManagerEmails }),
        ...(args.description && { description: args.description }),
      }, { updateMask: args.updateMask });
    },
  },
];
