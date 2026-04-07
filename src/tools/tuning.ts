import { z } from "zod";
import { vertexRequest } from "../client.js";

export const tuningTools = [
  {
    name: "vertex_create_tuning_job",
    description: "Create a new model tuning job (supervised fine-tuning or distillation).",
    inputSchema: z.object({
      baseModel: z.string().describe("Base model resource name to tune"),
      supervisedTuningSpec: z.object({
        trainingDatasetUri: z.string().describe("Cloud Storage URI of the training dataset"),
        validationDatasetUri: z.string().optional().describe("Cloud Storage URI of the validation dataset"),
        hyperParameters: z.object({
          epochCount: z.number().optional().describe("Number of training epochs"),
          learningRateMultiplier: z.number().optional().describe("Learning rate multiplier"),
          adapterSize: z.string().optional().describe("Adapter size for LoRA tuning"),
        }).optional().describe("Hyperparameters for supervised tuning"),
      }).optional().describe("Supervised tuning specification"),
      distillationSpec: z.object({
        trainingDatasetUri: z.string().describe("Cloud Storage URI of the training dataset"),
        validationDatasetUri: z.string().optional().describe("Cloud Storage URI of the validation dataset"),
        hyperParameters: z.object({
          epochCount: z.number().optional().describe("Number of training epochs"),
          learningRateMultiplier: z.number().optional().describe("Learning rate multiplier"),
        }).optional().describe("Hyperparameters for distillation"),
      }).optional().describe("Distillation specification"),
      tunedModelDisplayName: z.string().optional().describe("Display name for the tuned model"),
      description: z.string().optional().describe("Description of the tuning job"),
      labels: z.record(z.string(), z.string()).optional().describe("Labels as key-value pairs"),
    }),
    handler: async (args: { baseModel: string; supervisedTuningSpec?: Record<string, unknown>; distillationSpec?: Record<string, unknown>; tunedModelDisplayName?: string; description?: string; labels?: Record<string, string> }) => {
      return vertexRequest("POST", "/tuningJobs", {
        baseModel: args.baseModel,
        ...(args.supervisedTuningSpec && { supervisedTuningSpec: args.supervisedTuningSpec }),
        ...(args.distillationSpec && { distillationSpec: args.distillationSpec }),
        ...(args.tunedModelDisplayName && { tunedModelDisplayName: args.tunedModelDisplayName }),
        ...(args.description && { description: args.description }),
        ...(args.labels && { labels: args.labels }),
      });
    },
  },
  {
    name: "vertex_get_tuning_job",
    description: "Get details of a specific tuning job by ID.",
    inputSchema: z.object({
      tuningJobId: z.string().describe("The tuning job ID"),
    }),
    handler: async (args: { tuningJobId: string }) => {
      return vertexRequest("GET", `/tuningJobs/${args.tuningJobId}`);
    },
  },
  {
    name: "vertex_list_tuning_jobs",
    description: "List all tuning jobs in the current project and location.",
    inputSchema: z.object({
      filter: z.string().optional().describe("Filter expression"),
      pageSize: z.number().optional().describe("Maximum number of tuning jobs to return"),
      pageToken: z.string().optional().describe("Page token for pagination"),
    }),
    handler: async (args: { filter?: string; pageSize?: number; pageToken?: string }) => {
      return vertexRequest("GET", "/tuningJobs", undefined, {
        filter: args.filter,
        pageSize: args.pageSize,
        pageToken: args.pageToken,
      });
    },
  },
  {
    name: "vertex_cancel_tuning_job",
    description: "Cancel a running tuning job.",
    inputSchema: z.object({
      tuningJobId: z.string().describe("The tuning job ID to cancel"),
    }),
    handler: async (args: { tuningJobId: string }) => {
      return vertexRequest("POST", `/tuningJobs/${args.tuningJobId}:cancel`);
    },
  },
  {
    name: "vertex_rebase_tuned_model",
    description: "Rebase a tuned model onto a new base model version.",
    inputSchema: z.object({
      tuningJobId: z.string().describe("The tuning job ID of the tuned model to rebase"),
      tunedModelRef: z.string().optional().describe("Resource name of the tuned model to rebase"),
      tuningJobRef: z.string().optional().describe("Resource name of the tuning job that produced the model"),
      artifactDestination: z.string().optional().describe("Cloud Storage URI for the rebased model artifacts"),
    }),
    handler: async (args: { tuningJobId: string; tunedModelRef?: string; tuningJobRef?: string; artifactDestination?: string }) => {
      return vertexRequest("POST", `/tuningJobs/${args.tuningJobId}:rebaseTunedModel`, {
        ...(args.tunedModelRef && { tunedModelRef: args.tunedModelRef }),
        ...(args.tuningJobRef && { tuningJobRef: args.tuningJobRef }),
        ...(args.artifactDestination && { artifactDestination: args.artifactDestination }),
      });
    },
  },
];
