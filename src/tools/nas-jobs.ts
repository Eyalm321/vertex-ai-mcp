import { z } from "zod";
import { vertexRequest } from "../client.js";

export const nasJobTools = [
  {
    name: "vertex_create_nas_job",
    description: "Create a new Neural Architecture Search (NAS) job.",
    inputSchema: z.object({
      displayName: z.string().describe("Human-readable display name for the NAS job"),
      nasJobSpec: z.object({
        multiTrialAlgorithm: z.string().optional().describe("Multi-trial algorithm (e.g. GRID_SEARCH, RANDOM_SEARCH, REINFORCEMENT_LEARNING)"),
        searchSpace: z.record(z.string(), z.unknown()).optional().describe("Search space definition for NAS trials"),
        searchConfig: z.record(z.string(), z.unknown()).optional().describe("Configuration for the search algorithm"),
        trainConfig: z.record(z.string(), z.unknown()).optional().describe("Configuration for training trials"),
      }).describe("NAS job specification"),
      labels: z.record(z.string(), z.string()).optional().describe("Labels as key-value pairs"),
    }),
    handler: async (args: { displayName: string; nasJobSpec: Record<string, unknown>; labels?: Record<string, string> }) => {
      return vertexRequest("POST", "/nasJobs", {
        displayName: args.displayName,
        nasJobSpec: args.nasJobSpec,
        ...(args.labels && { labels: args.labels }),
      });
    },
  },
  {
    name: "vertex_get_nas_job",
    description: "Get details of a specific NAS job by ID.",
    inputSchema: z.object({
      nasJobId: z.string().describe("The NAS job ID"),
    }),
    handler: async (args: { nasJobId: string }) => {
      return vertexRequest("GET", `/nasJobs/${args.nasJobId}`);
    },
  },
  {
    name: "vertex_list_nas_jobs",
    description: "List all NAS jobs in the current project and location.",
    inputSchema: z.object({
      filter: z.string().optional().describe("Filter expression"),
      pageSize: z.number().optional().describe("Maximum number of NAS jobs to return"),
      pageToken: z.string().optional().describe("Page token for pagination"),
    }),
    handler: async (args: { filter?: string; pageSize?: number; pageToken?: string }) => {
      return vertexRequest("GET", "/nasJobs", undefined, {
        filter: args.filter,
        pageSize: args.pageSize,
        pageToken: args.pageToken,
      });
    },
  },
  {
    name: "vertex_delete_nas_job",
    description: "Delete a NAS job by ID.",
    inputSchema: z.object({
      nasJobId: z.string().describe("The NAS job ID to delete"),
    }),
    handler: async (args: { nasJobId: string }) => {
      return vertexRequest("DELETE", `/nasJobs/${args.nasJobId}`);
    },
  },
  {
    name: "vertex_cancel_nas_job",
    description: "Cancel a running NAS job.",
    inputSchema: z.object({
      nasJobId: z.string().describe("The NAS job ID to cancel"),
    }),
    handler: async (args: { nasJobId: string }) => {
      return vertexRequest("POST", `/nasJobs/${args.nasJobId}:cancel`);
    },
  },
  {
    name: "vertex_get_nas_trial_detail",
    description: "Get details of a specific trial within a NAS job.",
    inputSchema: z.object({
      nasJobId: z.string().describe("The NAS job ID"),
      nasTrialDetailId: z.string().describe("The NAS trial detail ID"),
    }),
    handler: async (args: { nasJobId: string; nasTrialDetailId: string }) => {
      return vertexRequest("GET", `/nasJobs/${args.nasJobId}/nasTrialDetails/${args.nasTrialDetailId}`);
    },
  },
  {
    name: "vertex_list_nas_trial_details",
    description: "List all trial details for a specific NAS job.",
    inputSchema: z.object({
      nasJobId: z.string().describe("The NAS job ID"),
      pageSize: z.number().optional().describe("Maximum number of trial details to return"),
      pageToken: z.string().optional().describe("Page token for pagination"),
    }),
    handler: async (args: { nasJobId: string; pageSize?: number; pageToken?: string }) => {
      return vertexRequest("GET", `/nasJobs/${args.nasJobId}/nasTrialDetails`, undefined, {
        pageSize: args.pageSize,
        pageToken: args.pageToken,
      });
    },
  },
];
