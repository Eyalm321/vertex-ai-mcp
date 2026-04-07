import { z } from "zod";
import { vertexRequest } from "../client.js";

export const pipelineTools = [
  // ── Training Pipelines ───────────────────────────────────────────────
  {
    name: "vertex_create_training_pipeline",
    description: "Create a new Vertex AI training pipeline.",
    inputSchema: z.object({
      displayName: z.string().describe("Human-readable display name for the pipeline"),
      trainingTaskDefinition: z.string().describe("URI of the training task definition schema"),
      trainingTaskInputs: z.record(z.string(), z.unknown()).describe("Training task inputs matching the task definition schema"),
      inputDataConfig: z.record(z.string(), z.unknown()).optional().describe("Input data configuration with datasetId, annotationsFilter, and split options"),
      modelToUpload: z.object({
        displayName: z.string().describe("Display name for the output model"),
        description: z.string().optional().describe("Description of the output model"),
        labels: z.record(z.string(), z.string()).optional().describe("Labels for the output model"),
      }).optional().describe("Configuration for the model to upload after training"),
      labels: z.record(z.string(), z.string()).optional().describe("Labels as key-value pairs"),
    }),
    handler: async (args: { displayName: string; trainingTaskDefinition: string; trainingTaskInputs: Record<string, unknown>; inputDataConfig?: Record<string, unknown>; modelToUpload?: Record<string, unknown>; labels?: Record<string, string> }) => {
      return vertexRequest("POST", "/trainingPipelines", {
        displayName: args.displayName,
        trainingTaskDefinition: args.trainingTaskDefinition,
        trainingTaskInputs: args.trainingTaskInputs,
        ...(args.inputDataConfig && { inputDataConfig: args.inputDataConfig }),
        ...(args.modelToUpload && { modelToUpload: args.modelToUpload }),
        ...(args.labels && { labels: args.labels }),
      });
    },
  },
  {
    name: "vertex_get_training_pipeline",
    description: "Get details of a specific Vertex AI training pipeline by ID.",
    inputSchema: z.object({
      trainingPipelineId: z.string().describe("The training pipeline ID"),
    }),
    handler: async (args: { trainingPipelineId: string }) => {
      return vertexRequest("GET", `/trainingPipelines/${args.trainingPipelineId}`);
    },
  },
  {
    name: "vertex_list_training_pipelines",
    description: "List all Vertex AI training pipelines in the current project and location.",
    inputSchema: z.object({
      filter: z.string().optional().describe("Filter expression"),
      pageSize: z.number().optional().describe("Maximum number of pipelines to return"),
      pageToken: z.string().optional().describe("Page token for pagination"),
    }),
    handler: async (args: { filter?: string; pageSize?: number; pageToken?: string }) => {
      return vertexRequest("GET", "/trainingPipelines", undefined, {
        filter: args.filter,
        pageSize: args.pageSize,
        pageToken: args.pageToken,
      });
    },
  },
  {
    name: "vertex_delete_training_pipeline",
    description: "Delete a Vertex AI training pipeline by ID.",
    inputSchema: z.object({
      trainingPipelineId: z.string().describe("The training pipeline ID to delete"),
    }),
    handler: async (args: { trainingPipelineId: string }) => {
      return vertexRequest("DELETE", `/trainingPipelines/${args.trainingPipelineId}`);
    },
  },
  {
    name: "vertex_cancel_training_pipeline",
    description: "Cancel a running Vertex AI training pipeline.",
    inputSchema: z.object({
      trainingPipelineId: z.string().describe("The training pipeline ID to cancel"),
    }),
    handler: async (args: { trainingPipelineId: string }) => {
      return vertexRequest("POST", `/trainingPipelines/${args.trainingPipelineId}:cancel`);
    },
  },

  // ── Pipeline Jobs ────────────────────────────────────────────────────
  {
    name: "vertex_create_pipeline_job",
    description: "Create a new Vertex AI pipeline job (Kubeflow or TFX pipeline).",
    inputSchema: z.object({
      displayName: z.string().describe("Human-readable display name for the pipeline job"),
      runtimeConfig: z.record(z.string(), z.unknown()).optional().describe("Runtime configuration with parameter values and GCS output directory"),
      pipelineSpec: z.record(z.string(), z.unknown()).optional().describe("The pipeline specification (inline pipeline definition)"),
      labels: z.record(z.string(), z.string()).optional().describe("Labels as key-value pairs"),
      serviceAccount: z.string().optional().describe("Service account to run the pipeline as"),
      network: z.string().optional().describe("Full network name for peering"),
    }),
    handler: async (args: { displayName: string; runtimeConfig?: Record<string, unknown>; pipelineSpec?: Record<string, unknown>; labels?: Record<string, string>; serviceAccount?: string; network?: string }) => {
      return vertexRequest("POST", "/pipelineJobs", {
        displayName: args.displayName,
        ...(args.runtimeConfig && { runtimeConfig: args.runtimeConfig }),
        ...(args.pipelineSpec && { pipelineSpec: args.pipelineSpec }),
        ...(args.labels && { labels: args.labels }),
        ...(args.serviceAccount && { serviceAccount: args.serviceAccount }),
        ...(args.network && { network: args.network }),
      });
    },
  },
  {
    name: "vertex_get_pipeline_job",
    description: "Get details of a specific Vertex AI pipeline job by ID.",
    inputSchema: z.object({
      pipelineJobId: z.string().describe("The pipeline job ID"),
    }),
    handler: async (args: { pipelineJobId: string }) => {
      return vertexRequest("GET", `/pipelineJobs/${args.pipelineJobId}`);
    },
  },
  {
    name: "vertex_list_pipeline_jobs",
    description: "List all Vertex AI pipeline jobs in the current project and location.",
    inputSchema: z.object({
      filter: z.string().optional().describe("Filter expression"),
      pageSize: z.number().optional().describe("Maximum number of pipeline jobs to return"),
      pageToken: z.string().optional().describe("Page token for pagination"),
      orderBy: z.string().optional().describe("Field to order by"),
    }),
    handler: async (args: { filter?: string; pageSize?: number; pageToken?: string; orderBy?: string }) => {
      return vertexRequest("GET", "/pipelineJobs", undefined, {
        filter: args.filter,
        pageSize: args.pageSize,
        pageToken: args.pageToken,
        orderBy: args.orderBy,
      });
    },
  },
  {
    name: "vertex_delete_pipeline_job",
    description: "Delete a Vertex AI pipeline job by ID.",
    inputSchema: z.object({
      pipelineJobId: z.string().describe("The pipeline job ID to delete"),
    }),
    handler: async (args: { pipelineJobId: string }) => {
      return vertexRequest("DELETE", `/pipelineJobs/${args.pipelineJobId}`);
    },
  },
  {
    name: "vertex_cancel_pipeline_job",
    description: "Cancel a running Vertex AI pipeline job.",
    inputSchema: z.object({
      pipelineJobId: z.string().describe("The pipeline job ID to cancel"),
    }),
    handler: async (args: { pipelineJobId: string }) => {
      return vertexRequest("POST", `/pipelineJobs/${args.pipelineJobId}:cancel`);
    },
  },
];
