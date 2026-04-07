import { z } from "zod";
import { vertexRequest } from "../client.js";

export const scheduleTools = [
  {
    name: "vertex_create_schedule",
    description: "Create a new Vertex AI Schedule for recurring pipeline or monitoring jobs.",
    inputSchema: z.object({
      displayName: z.string().describe("Human-readable display name for the schedule"),
      cron: z.string().describe("Cron expression for the schedule (e.g. '0 0 * * *' for daily at midnight)"),
      maxConcurrentRunCount: z.number().optional().describe("Maximum number of concurrent runs allowed"),
      startTime: z.string().optional().describe("Start time for the schedule (RFC 3339 format)"),
      endTime: z.string().optional().describe("End time for the schedule (RFC 3339 format)"),
      createPipelineJobRequest: z.object({
        pipelineJob: z.record(z.string(), z.unknown()).describe("PipelineJob configuration to create on each run"),
      }).optional().describe("Pipeline job request to execute on schedule"),
      createModelMonitoringJobRequest: z.object({
        modelMonitoringJob: z.record(z.string(), z.unknown()).describe("ModelMonitoringJob configuration to create on each run"),
      }).optional().describe("Model monitoring job request to execute on schedule"),
      labels: z.record(z.string(), z.string()).optional().describe("Labels as key-value pairs"),
    }),
    handler: async (args: { displayName: string; cron: string; maxConcurrentRunCount?: number; startTime?: string; endTime?: string; createPipelineJobRequest?: Record<string, unknown>; createModelMonitoringJobRequest?: Record<string, unknown>; labels?: Record<string, string> }) => {
      return vertexRequest("POST", "/schedules", {
        displayName: args.displayName,
        cron: args.cron,
        ...(args.maxConcurrentRunCount !== undefined && { maxConcurrentRunCount: args.maxConcurrentRunCount }),
        ...(args.startTime && { startTime: args.startTime }),
        ...(args.endTime && { endTime: args.endTime }),
        ...(args.createPipelineJobRequest && { createPipelineJobRequest: args.createPipelineJobRequest }),
        ...(args.createModelMonitoringJobRequest && { createModelMonitoringJobRequest: args.createModelMonitoringJobRequest }),
        ...(args.labels && { labels: args.labels }),
      });
    },
  },
  {
    name: "vertex_get_schedule",
    description: "Get details of a specific Vertex AI Schedule by ID.",
    inputSchema: z.object({
      scheduleId: z.string().describe("The schedule ID"),
    }),
    handler: async (args: { scheduleId: string }) => {
      return vertexRequest("GET", `/schedules/${args.scheduleId}`);
    },
  },
  {
    name: "vertex_list_schedules",
    description: "List all Vertex AI Schedules in the current project and location.",
    inputSchema: z.object({
      filter: z.string().optional().describe("Filter expression"),
      pageSize: z.number().optional().describe("Maximum number of schedules to return"),
      pageToken: z.string().optional().describe("Page token for pagination"),
      orderBy: z.string().optional().describe("Field to order by"),
    }),
    handler: async (args: { filter?: string; pageSize?: number; pageToken?: string; orderBy?: string }) => {
      return vertexRequest("GET", "/schedules", undefined, {
        filter: args.filter,
        pageSize: args.pageSize,
        pageToken: args.pageToken,
        orderBy: args.orderBy,
      });
    },
  },
  {
    name: "vertex_delete_schedule",
    description: "Delete a Vertex AI Schedule by ID.",
    inputSchema: z.object({
      scheduleId: z.string().describe("The schedule ID to delete"),
    }),
    handler: async (args: { scheduleId: string }) => {
      return vertexRequest("DELETE", `/schedules/${args.scheduleId}`);
    },
  },
  {
    name: "vertex_update_schedule",
    description: "Update a Vertex AI Schedule's configuration.",
    inputSchema: z.object({
      scheduleId: z.string().describe("The schedule ID to update"),
      cron: z.string().optional().describe("Updated cron expression"),
      maxConcurrentRunCount: z.number().optional().describe("Updated maximum concurrent run count"),
      endTime: z.string().optional().describe("Updated end time (RFC 3339 format)"),
      updateMask: z.string().describe("Comma-separated list of fields to update"),
    }),
    handler: async (args: { scheduleId: string; cron?: string; maxConcurrentRunCount?: number; endTime?: string; updateMask: string }) => {
      return vertexRequest("PATCH", `/schedules/${args.scheduleId}`, {
        ...(args.cron && { cron: args.cron }),
        ...(args.maxConcurrentRunCount !== undefined && { maxConcurrentRunCount: args.maxConcurrentRunCount }),
        ...(args.endTime && { endTime: args.endTime }),
      }, {
        updateMask: args.updateMask,
      });
    },
  },
  {
    name: "vertex_pause_schedule",
    description: "Pause a Vertex AI Schedule to temporarily stop scheduled runs.",
    inputSchema: z.object({
      scheduleId: z.string().describe("The schedule ID to pause"),
    }),
    handler: async (args: { scheduleId: string }) => {
      return vertexRequest("POST", `/schedules/${args.scheduleId}:pause`, {});
    },
  },
  {
    name: "vertex_resume_schedule",
    description: "Resume a paused Vertex AI Schedule.",
    inputSchema: z.object({
      scheduleId: z.string().describe("The schedule ID to resume"),
      catchUp: z.boolean().optional().describe("If true, catch up on missed scheduled runs while the schedule was paused"),
    }),
    handler: async (args: { scheduleId: string; catchUp?: boolean }) => {
      return vertexRequest("POST", `/schedules/${args.scheduleId}:resume`, {
        ...(args.catchUp !== undefined && { catchUp: args.catchUp }),
      });
    },
  },
];
