import { z } from "zod";
import { vertexRequest } from "../client.js";

export const modelTools = [
  {
    name: "vertex_upload_model",
    description: "Upload a model to the Vertex AI Model Registry.",
    inputSchema: z.object({
      model: z.object({
        displayName: z.string().describe("Display name for the model"),
        artifactUri: z.string().optional().describe("GCS path to the model artifacts"),
        containerSpec: z.object({
          imageUri: z.string().describe("URI of the container image for serving"),
          command: z.array(z.string()).optional().describe("Entrypoint command"),
          args: z.array(z.string()).optional().describe("Arguments to the command"),
          ports: z.array(z.object({ containerPort: z.number() })).optional().describe("Ports to expose"),
          predictRoute: z.string().optional().describe("HTTP path for predict requests"),
          healthRoute: z.string().optional().describe("HTTP path for health checks"),
        }).optional().describe("Container specification for the model"),
        description: z.string().optional().describe("Description of the model"),
        labels: z.record(z.string(), z.string()).optional().describe("Labels as key-value pairs"),
      }).describe("The model to upload"),
      parentModel: z.string().optional().describe("Resource name of the parent model to create a new version under"),
    }),
    handler: async (args: { model: Record<string, unknown>; parentModel?: string }) => {
      return vertexRequest("POST", "/models:upload", {
        model: args.model,
        ...(args.parentModel && { parentModel: args.parentModel }),
      });
    },
  },
  {
    name: "vertex_get_model",
    description: "Get details of a specific Vertex AI model by ID.",
    inputSchema: z.object({
      modelId: z.string().describe("The model ID"),
    }),
    handler: async (args: { modelId: string }) => {
      return vertexRequest("GET", `/models/${args.modelId}`);
    },
  },
  {
    name: "vertex_list_models",
    description: "List all Vertex AI models in the current project and location.",
    inputSchema: z.object({
      filter: z.string().optional().describe("Filter expression"),
      pageSize: z.number().optional().describe("Maximum number of models to return"),
      pageToken: z.string().optional().describe("Page token for pagination"),
      orderBy: z.string().optional().describe("Field to order by"),
    }),
    handler: async (args: { filter?: string; pageSize?: number; pageToken?: string; orderBy?: string }) => {
      return vertexRequest("GET", "/models", undefined, {
        filter: args.filter,
        pageSize: args.pageSize,
        pageToken: args.pageToken,
        orderBy: args.orderBy,
      });
    },
  },
  {
    name: "vertex_delete_model",
    description: "Delete a Vertex AI model by ID.",
    inputSchema: z.object({
      modelId: z.string().describe("The model ID to delete"),
    }),
    handler: async (args: { modelId: string }) => {
      return vertexRequest("DELETE", `/models/${args.modelId}`);
    },
  },
  {
    name: "vertex_update_model",
    description: "Update a Vertex AI model's metadata.",
    inputSchema: z.object({
      modelId: z.string().describe("The model ID to update"),
      displayName: z.string().optional().describe("Updated display name"),
      description: z.string().optional().describe("Updated description"),
      labels: z.record(z.string(), z.string()).optional().describe("Updated labels"),
      updateMask: z.string().describe("Comma-separated list of fields to update"),
    }),
    handler: async (args: { modelId: string; displayName?: string; description?: string; labels?: Record<string, string>; updateMask: string }) => {
      return vertexRequest("PATCH", `/models/${args.modelId}`, {
        ...(args.displayName && { displayName: args.displayName }),
        ...(args.description && { description: args.description }),
        ...(args.labels && { labels: args.labels }),
      }, { updateMask: args.updateMask });
    },
  },
  {
    name: "vertex_delete_model_version",
    description: "Delete a specific version of a Vertex AI model.",
    inputSchema: z.object({
      modelId: z.string().describe("The model ID"),
      versionId: z.string().describe("The version ID to delete"),
    }),
    handler: async (args: { modelId: string; versionId: string }) => {
      return vertexRequest("DELETE", `/models/${args.modelId}/versions/${args.versionId}`);
    },
  },
  {
    name: "vertex_list_model_versions",
    description: "List all versions of a specific Vertex AI model.",
    inputSchema: z.object({
      modelId: z.string().describe("The model ID"),
      filter: z.string().optional().describe("Filter expression"),
      pageSize: z.number().optional().describe("Maximum number of versions to return"),
      pageToken: z.string().optional().describe("Page token for pagination"),
      orderBy: z.string().optional().describe("Field to order by"),
    }),
    handler: async (args: { modelId: string; filter?: string; pageSize?: number; pageToken?: string; orderBy?: string }) => {
      return vertexRequest("GET", `/models/${args.modelId}/versions`, undefined, {
        filter: args.filter,
        pageSize: args.pageSize,
        pageToken: args.pageToken,
        orderBy: args.orderBy,
      });
    },
  },
  {
    name: "vertex_merge_version_aliases",
    description: "Merge version aliases into a Vertex AI model version.",
    inputSchema: z.object({
      modelId: z.string().describe("The model ID"),
      versionAliases: z.array(z.string()).describe("Version aliases to merge (prefix with - to remove)"),
    }),
    handler: async (args: { modelId: string; versionAliases: string[] }) => {
      return vertexRequest("POST", `/models/${args.modelId}:mergeVersionAliases`, {
        versionAliases: args.versionAliases,
      });
    },
  },
  {
    name: "vertex_export_model",
    description: "Export a Vertex AI model to a GCS destination or container image.",
    inputSchema: z.object({
      modelId: z.string().describe("The model ID to export"),
      outputConfig: z.object({
        exportFormatId: z.string().optional().describe("Export format ID"),
        artifactDestination: z.object({
          outputUriPrefix: z.string().describe("GCS URI prefix for artifact output"),
        }).optional().describe("GCS destination for model artifacts"),
        imageDestination: z.object({
          outputUri: z.string().describe("Container Registry URI for the exported image"),
        }).optional().describe("Container Registry destination for model image"),
      }).describe("Output configuration for the export"),
    }),
    handler: async (args: { modelId: string; outputConfig: Record<string, unknown> }) => {
      return vertexRequest("POST", `/models/${args.modelId}:export`, {
        outputConfig: args.outputConfig,
      });
    },
  },
  {
    name: "vertex_copy_model",
    description: "Copy a Vertex AI model from another project or location.",
    inputSchema: z.object({
      sourceModel: z.string().describe("Full resource name of the source model to copy"),
      encryptionSpec: z.object({
        kmsKeyName: z.string().describe("Cloud KMS resource identifier"),
      }).optional().describe("Customer-managed encryption key spec"),
    }),
    handler: async (args: { sourceModel: string; encryptionSpec?: { kmsKeyName: string } }) => {
      return vertexRequest("POST", "/models:copy", {
        sourceModel: args.sourceModel,
        ...(args.encryptionSpec && { encryptionSpec: args.encryptionSpec }),
      });
    },
  },
  {
    name: "vertex_get_model_evaluation",
    description: "Get a specific model evaluation for a Vertex AI model.",
    inputSchema: z.object({
      modelId: z.string().describe("The model ID"),
      evaluationId: z.string().describe("The evaluation ID"),
    }),
    handler: async (args: { modelId: string; evaluationId: string }) => {
      return vertexRequest("GET", `/models/${args.modelId}/evaluations/${args.evaluationId}`);
    },
  },
  {
    name: "vertex_list_model_evaluations",
    description: "List all evaluations for a specific Vertex AI model.",
    inputSchema: z.object({
      modelId: z.string().describe("The model ID"),
      filter: z.string().optional().describe("Filter expression"),
      pageSize: z.number().optional().describe("Maximum number of evaluations to return"),
      pageToken: z.string().optional().describe("Page token for pagination"),
    }),
    handler: async (args: { modelId: string; filter?: string; pageSize?: number; pageToken?: string }) => {
      return vertexRequest("GET", `/models/${args.modelId}/evaluations`, undefined, {
        filter: args.filter,
        pageSize: args.pageSize,
        pageToken: args.pageToken,
      });
    },
  },
];
