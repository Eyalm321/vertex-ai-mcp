import { z } from "zod";
import { vertexRequest } from "../client.js";

export const jobTools = [
  // ── Custom Jobs ──────────────────────────────────────────────────────
  {
    name: "vertex_create_custom_job",
    description: "Create a new Vertex AI custom training job.",
    inputSchema: z.object({
      displayName: z.string().describe("Human-readable display name for the job"),
      jobSpec: z.object({
        workerPoolSpecs: z.array(z.record(z.string(), z.unknown())).describe("Worker pool specifications"),
        scheduling: z.record(z.string(), z.unknown()).optional().describe("Scheduling configuration (timeout, restartJobOnWorkerRestart)"),
        serviceAccount: z.string().optional().describe("Service account to run the job as"),
        network: z.string().optional().describe("Full network name for peering"),
        baseOutputDirectory: z.object({
          outputUriPrefix: z.string().describe("GCS URI prefix for job output"),
        }).optional().describe("Base output directory for job artifacts"),
      }).describe("The custom job specification"),
      labels: z.record(z.string(), z.string()).optional().describe("Labels as key-value pairs"),
    }),
    handler: async (args: { displayName: string; jobSpec: Record<string, unknown>; labels?: Record<string, string> }) => {
      return vertexRequest("POST", "/customJobs", {
        displayName: args.displayName,
        jobSpec: args.jobSpec,
        ...(args.labels && { labels: args.labels }),
      });
    },
  },
  {
    name: "vertex_get_custom_job",
    description: "Get details of a specific Vertex AI custom job by ID.",
    inputSchema: z.object({
      customJobId: z.string().describe("The custom job ID"),
    }),
    handler: async (args: { customJobId: string }) => {
      return vertexRequest("GET", `/customJobs/${args.customJobId}`);
    },
  },
  {
    name: "vertex_list_custom_jobs",
    description: "List all Vertex AI custom jobs in the current project and location.",
    inputSchema: z.object({
      filter: z.string().optional().describe("Filter expression"),
      pageSize: z.number().optional().describe("Maximum number of jobs to return"),
      pageToken: z.string().optional().describe("Page token for pagination"),
    }),
    handler: async (args: { filter?: string; pageSize?: number; pageToken?: string }) => {
      return vertexRequest("GET", "/customJobs", undefined, {
        filter: args.filter,
        pageSize: args.pageSize,
        pageToken: args.pageToken,
      });
    },
  },
  {
    name: "vertex_delete_custom_job",
    description: "Delete a Vertex AI custom job by ID.",
    inputSchema: z.object({
      customJobId: z.string().describe("The custom job ID to delete"),
    }),
    handler: async (args: { customJobId: string }) => {
      return vertexRequest("DELETE", `/customJobs/${args.customJobId}`);
    },
  },
  {
    name: "vertex_cancel_custom_job",
    description: "Cancel a running Vertex AI custom job.",
    inputSchema: z.object({
      customJobId: z.string().describe("The custom job ID to cancel"),
    }),
    handler: async (args: { customJobId: string }) => {
      return vertexRequest("POST", `/customJobs/${args.customJobId}:cancel`);
    },
  },

  // ── Batch Prediction Jobs ────────────────────────────────────────────
  {
    name: "vertex_create_batch_prediction_job",
    description: "Create a new Vertex AI batch prediction job.",
    inputSchema: z.object({
      displayName: z.string().describe("Human-readable display name for the job"),
      model: z.string().describe("Resource name of the model to use for predictions"),
      inputConfig: z.record(z.string(), z.unknown()).describe("Input configuration with instancesFormat and gcsSource or bigquerySource"),
      outputConfig: z.record(z.string(), z.unknown()).describe("Output configuration with predictionsFormat and gcsDestination or bigqueryDestination"),
      dedicatedResources: z.object({
        machineSpec: z.object({
          machineType: z.string().describe("Machine type (e.g. n1-standard-4)"),
          acceleratorType: z.string().optional().describe("Accelerator type"),
          acceleratorCount: z.number().optional().describe("Number of accelerators"),
        }),
        startingReplicaCount: z.number().describe("Number of replicas to start with"),
        maxReplicaCount: z.number().optional().describe("Maximum number of replicas"),
      }).optional().describe("Dedicated resources for the batch job"),
      labels: z.record(z.string(), z.string()).optional().describe("Labels as key-value pairs"),
    }),
    handler: async (args: { displayName: string; model: string; inputConfig: Record<string, unknown>; outputConfig: Record<string, unknown>; dedicatedResources?: Record<string, unknown>; labels?: Record<string, string> }) => {
      return vertexRequest("POST", "/batchPredictionJobs", {
        displayName: args.displayName,
        model: args.model,
        inputConfig: args.inputConfig,
        outputConfig: args.outputConfig,
        ...(args.dedicatedResources && { dedicatedResources: args.dedicatedResources }),
        ...(args.labels && { labels: args.labels }),
      });
    },
  },
  {
    name: "vertex_get_batch_prediction_job",
    description: "Get details of a specific Vertex AI batch prediction job by ID.",
    inputSchema: z.object({
      batchPredictionJobId: z.string().describe("The batch prediction job ID"),
    }),
    handler: async (args: { batchPredictionJobId: string }) => {
      return vertexRequest("GET", `/batchPredictionJobs/${args.batchPredictionJobId}`);
    },
  },
  {
    name: "vertex_list_batch_prediction_jobs",
    description: "List all Vertex AI batch prediction jobs in the current project and location.",
    inputSchema: z.object({
      filter: z.string().optional().describe("Filter expression"),
      pageSize: z.number().optional().describe("Maximum number of jobs to return"),
      pageToken: z.string().optional().describe("Page token for pagination"),
    }),
    handler: async (args: { filter?: string; pageSize?: number; pageToken?: string }) => {
      return vertexRequest("GET", "/batchPredictionJobs", undefined, {
        filter: args.filter,
        pageSize: args.pageSize,
        pageToken: args.pageToken,
      });
    },
  },
  {
    name: "vertex_delete_batch_prediction_job",
    description: "Delete a Vertex AI batch prediction job by ID.",
    inputSchema: z.object({
      batchPredictionJobId: z.string().describe("The batch prediction job ID to delete"),
    }),
    handler: async (args: { batchPredictionJobId: string }) => {
      return vertexRequest("DELETE", `/batchPredictionJobs/${args.batchPredictionJobId}`);
    },
  },
  {
    name: "vertex_cancel_batch_prediction_job",
    description: "Cancel a running Vertex AI batch prediction job.",
    inputSchema: z.object({
      batchPredictionJobId: z.string().describe("The batch prediction job ID to cancel"),
    }),
    handler: async (args: { batchPredictionJobId: string }) => {
      return vertexRequest("POST", `/batchPredictionJobs/${args.batchPredictionJobId}:cancel`);
    },
  },

  // ── Hyperparameter Tuning Jobs ───────────────────────────────────────
  {
    name: "vertex_create_hyperparameter_tuning_job",
    description: "Create a new Vertex AI hyperparameter tuning job.",
    inputSchema: z.object({
      displayName: z.string().describe("Human-readable display name for the job"),
      studySpec: z.record(z.string(), z.unknown()).describe("Study specification with metrics, parameters, and search algorithm"),
      maxTrialCount: z.number().describe("Maximum number of trials to run"),
      parallelTrialCount: z.number().describe("Number of trials to run in parallel"),
      trialJobSpec: z.record(z.string(), z.unknown()).describe("Job specification for each trial (workerPoolSpecs, scheduling, etc.)"),
      labels: z.record(z.string(), z.string()).optional().describe("Labels as key-value pairs"),
    }),
    handler: async (args: { displayName: string; studySpec: Record<string, unknown>; maxTrialCount: number; parallelTrialCount: number; trialJobSpec: Record<string, unknown>; labels?: Record<string, string> }) => {
      return vertexRequest("POST", "/hyperparameterTuningJobs", {
        displayName: args.displayName,
        studySpec: args.studySpec,
        maxTrialCount: args.maxTrialCount,
        parallelTrialCount: args.parallelTrialCount,
        trialJobSpec: args.trialJobSpec,
        ...(args.labels && { labels: args.labels }),
      });
    },
  },
  {
    name: "vertex_get_hyperparameter_tuning_job",
    description: "Get details of a specific Vertex AI hyperparameter tuning job by ID.",
    inputSchema: z.object({
      hyperparameterTuningJobId: z.string().describe("The hyperparameter tuning job ID"),
    }),
    handler: async (args: { hyperparameterTuningJobId: string }) => {
      return vertexRequest("GET", `/hyperparameterTuningJobs/${args.hyperparameterTuningJobId}`);
    },
  },
  {
    name: "vertex_list_hyperparameter_tuning_jobs",
    description: "List all Vertex AI hyperparameter tuning jobs in the current project and location.",
    inputSchema: z.object({
      filter: z.string().optional().describe("Filter expression"),
      pageSize: z.number().optional().describe("Maximum number of jobs to return"),
      pageToken: z.string().optional().describe("Page token for pagination"),
    }),
    handler: async (args: { filter?: string; pageSize?: number; pageToken?: string }) => {
      return vertexRequest("GET", "/hyperparameterTuningJobs", undefined, {
        filter: args.filter,
        pageSize: args.pageSize,
        pageToken: args.pageToken,
      });
    },
  },
  {
    name: "vertex_delete_hyperparameter_tuning_job",
    description: "Delete a Vertex AI hyperparameter tuning job by ID.",
    inputSchema: z.object({
      hyperparameterTuningJobId: z.string().describe("The hyperparameter tuning job ID to delete"),
    }),
    handler: async (args: { hyperparameterTuningJobId: string }) => {
      return vertexRequest("DELETE", `/hyperparameterTuningJobs/${args.hyperparameterTuningJobId}`);
    },
  },
  {
    name: "vertex_cancel_hyperparameter_tuning_job",
    description: "Cancel a running Vertex AI hyperparameter tuning job.",
    inputSchema: z.object({
      hyperparameterTuningJobId: z.string().describe("The hyperparameter tuning job ID to cancel"),
    }),
    handler: async (args: { hyperparameterTuningJobId: string }) => {
      return vertexRequest("POST", `/hyperparameterTuningJobs/${args.hyperparameterTuningJobId}:cancel`);
    },
  },
];
