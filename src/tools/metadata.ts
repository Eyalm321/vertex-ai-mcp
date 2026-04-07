import { z } from "zod";
import { vertexRequest } from "../client.js";

export const metadataTools = [
  // ==================== Metadata Stores ====================
  {
    name: "vertex_create_metadata_store",
    description: "Create a new Vertex AI Metadata Store for tracking ML metadata, artifacts, and lineage.",
    inputSchema: z.object({
      metadataStoreId: z.string().describe("The ID to use for the metadata store"),
      description: z.string().optional().describe("Description of the metadata store"),
      encryptionSpec: z.object({
        kmsKeyName: z.string().describe("Cloud KMS resource identifier"),
      }).optional().describe("Customer-managed encryption key spec"),
    }),
    handler: async (args: { metadataStoreId: string; description?: string; encryptionSpec?: { kmsKeyName: string } }) => {
      return vertexRequest("POST", "/metadataStores", {
        ...(args.description && { description: args.description }),
        ...(args.encryptionSpec && { encryptionSpec: args.encryptionSpec }),
      }, {
        metadataStoreId: args.metadataStoreId,
      });
    },
  },
  {
    name: "vertex_get_metadata_store",
    description: "Get details of a specific Vertex AI Metadata Store by ID.",
    inputSchema: z.object({
      metadataStoreId: z.string().describe("The metadata store ID"),
    }),
    handler: async (args: { metadataStoreId: string }) => {
      return vertexRequest("GET", `/metadataStores/${args.metadataStoreId}`);
    },
  },
  {
    name: "vertex_list_metadata_stores",
    description: "List all Vertex AI Metadata Stores in the current project and location.",
    inputSchema: z.object({
      pageSize: z.number().optional().describe("Maximum number of metadata stores to return"),
      pageToken: z.string().optional().describe("Page token for pagination"),
    }),
    handler: async (args: { pageSize?: number; pageToken?: string }) => {
      return vertexRequest("GET", "/metadataStores", undefined, {
        pageSize: args.pageSize,
        pageToken: args.pageToken,
      });
    },
  },
  {
    name: "vertex_delete_metadata_store",
    description: "Delete a Vertex AI Metadata Store by ID. Use force=true to delete even if it contains metadata.",
    inputSchema: z.object({
      metadataStoreId: z.string().describe("The metadata store ID to delete"),
      force: z.boolean().optional().describe("If true, delete even if the store contains metadata"),
    }),
    handler: async (args: { metadataStoreId: string; force?: boolean }) => {
      return vertexRequest("DELETE", `/metadataStores/${args.metadataStoreId}`, undefined, {
        force: args.force,
      });
    },
  },

  // ==================== Artifacts ====================
  {
    name: "vertex_create_artifact",
    description: "Create a new artifact in a Vertex AI Metadata Store to track ML artifacts like datasets and models.",
    inputSchema: z.object({
      metadataStoreId: z.string().describe("The metadata store ID"),
      artifactId: z.string().optional().describe("The ID to use for the artifact"),
      displayName: z.string().optional().describe("Human-readable display name"),
      uri: z.string().optional().describe("The URI of the artifact (e.g. GCS path)"),
      etag: z.string().optional().describe("ETag for concurrency control"),
      labels: z.record(z.string(), z.string()).optional().describe("Labels as key-value pairs"),
      description: z.string().optional().describe("Description of the artifact"),
      metadata: z.record(z.string(), z.unknown()).optional().describe("Properties of the artifact as a struct"),
      schemaTitle: z.string().optional().describe("Schema title (e.g. system.Dataset, system.Model)"),
      schemaVersion: z.string().optional().describe("Schema version"),
      state: z.enum(["PENDING", "LIVE"]).optional().describe("State of the artifact"),
    }),
    handler: async (args: { metadataStoreId: string; artifactId?: string; displayName?: string; uri?: string; etag?: string; labels?: Record<string, string>; description?: string; metadata?: Record<string, unknown>; schemaTitle?: string; schemaVersion?: string; state?: string }) => {
      return vertexRequest("POST", `/metadataStores/${args.metadataStoreId}/artifacts`, {
        ...(args.displayName && { displayName: args.displayName }),
        ...(args.uri && { uri: args.uri }),
        ...(args.etag && { etag: args.etag }),
        ...(args.labels && { labels: args.labels }),
        ...(args.description && { description: args.description }),
        ...(args.metadata && { metadata: args.metadata }),
        ...(args.schemaTitle && { schemaTitle: args.schemaTitle }),
        ...(args.schemaVersion && { schemaVersion: args.schemaVersion }),
        ...(args.state && { state: args.state }),
      }, {
        artifactId: args.artifactId,
      });
    },
  },
  {
    name: "vertex_get_artifact",
    description: "Get details of a specific artifact in a metadata store.",
    inputSchema: z.object({
      metadataStoreId: z.string().describe("The metadata store ID"),
      artifactId: z.string().describe("The artifact ID"),
    }),
    handler: async (args: { metadataStoreId: string; artifactId: string }) => {
      return vertexRequest("GET", `/metadataStores/${args.metadataStoreId}/artifacts/${args.artifactId}`);
    },
  },
  {
    name: "vertex_list_artifacts",
    description: "List all artifacts in a Vertex AI Metadata Store.",
    inputSchema: z.object({
      metadataStoreId: z.string().describe("The metadata store ID"),
      filter: z.string().optional().describe("Filter expression (e.g. schema_title, state, uri)"),
      pageSize: z.number().optional().describe("Maximum number of artifacts to return"),
      pageToken: z.string().optional().describe("Page token for pagination"),
      orderBy: z.string().optional().describe("Field to order by"),
    }),
    handler: async (args: { metadataStoreId: string; filter?: string; pageSize?: number; pageToken?: string; orderBy?: string }) => {
      return vertexRequest("GET", `/metadataStores/${args.metadataStoreId}/artifacts`, undefined, {
        filter: args.filter,
        pageSize: args.pageSize,
        pageToken: args.pageToken,
        orderBy: args.orderBy,
      });
    },
  },
  {
    name: "vertex_update_artifact",
    description: "Update an artifact's metadata in a metadata store.",
    inputSchema: z.object({
      metadataStoreId: z.string().describe("The metadata store ID"),
      artifactId: z.string().describe("The artifact ID to update"),
      displayName: z.string().optional().describe("Updated display name"),
      uri: z.string().optional().describe("Updated URI"),
      labels: z.record(z.string(), z.string()).optional().describe("Updated labels"),
      description: z.string().optional().describe("Updated description"),
      metadata: z.record(z.string(), z.unknown()).optional().describe("Updated metadata properties"),
      updateMask: z.string().describe("Comma-separated list of fields to update"),
    }),
    handler: async (args: { metadataStoreId: string; artifactId: string; displayName?: string; uri?: string; labels?: Record<string, string>; description?: string; metadata?: Record<string, unknown>; updateMask: string }) => {
      return vertexRequest("PATCH", `/metadataStores/${args.metadataStoreId}/artifacts/${args.artifactId}`, {
        ...(args.displayName && { displayName: args.displayName }),
        ...(args.uri && { uri: args.uri }),
        ...(args.labels && { labels: args.labels }),
        ...(args.description && { description: args.description }),
        ...(args.metadata && { metadata: args.metadata }),
      }, {
        updateMask: args.updateMask,
      });
    },
  },
  {
    name: "vertex_purge_artifacts",
    description: "Purge (bulk delete) artifacts from a metadata store matching a filter.",
    inputSchema: z.object({
      metadataStoreId: z.string().describe("The metadata store ID"),
      filter: z.string().describe("Filter expression for artifacts to purge"),
      force: z.boolean().optional().describe("If true, perform the purge immediately; otherwise do a dry run"),
    }),
    handler: async (args: { metadataStoreId: string; filter: string; force?: boolean }) => {
      return vertexRequest("POST", `/metadataStores/${args.metadataStoreId}/artifacts:purge`, {
        filter: args.filter,
        ...(args.force !== undefined && { force: args.force }),
      });
    },
  },

  // ==================== Contexts ====================
  {
    name: "vertex_create_context",
    description: "Create a new context in a Vertex AI Metadata Store for grouping artifacts and executions.",
    inputSchema: z.object({
      metadataStoreId: z.string().describe("The metadata store ID"),
      contextId: z.string().optional().describe("The ID to use for the context"),
      displayName: z.string().optional().describe("Human-readable display name"),
      etag: z.string().optional().describe("ETag for concurrency control"),
      labels: z.record(z.string(), z.string()).optional().describe("Labels as key-value pairs"),
      description: z.string().optional().describe("Description of the context"),
      metadata: z.record(z.string(), z.unknown()).optional().describe("Properties of the context as a struct"),
      schemaTitle: z.string().optional().describe("Schema title (e.g. system.Experiment, system.Pipeline)"),
      schemaVersion: z.string().optional().describe("Schema version"),
      parentContexts: z.array(z.string()).optional().describe("Full resource names of parent contexts"),
    }),
    handler: async (args: { metadataStoreId: string; contextId?: string; displayName?: string; etag?: string; labels?: Record<string, string>; description?: string; metadata?: Record<string, unknown>; schemaTitle?: string; schemaVersion?: string; parentContexts?: string[] }) => {
      return vertexRequest("POST", `/metadataStores/${args.metadataStoreId}/contexts`, {
        ...(args.displayName && { displayName: args.displayName }),
        ...(args.etag && { etag: args.etag }),
        ...(args.labels && { labels: args.labels }),
        ...(args.description && { description: args.description }),
        ...(args.metadata && { metadata: args.metadata }),
        ...(args.schemaTitle && { schemaTitle: args.schemaTitle }),
        ...(args.schemaVersion && { schemaVersion: args.schemaVersion }),
        ...(args.parentContexts && { parentContexts: args.parentContexts }),
      }, {
        contextId: args.contextId,
      });
    },
  },
  {
    name: "vertex_get_context",
    description: "Get details of a specific context in a metadata store.",
    inputSchema: z.object({
      metadataStoreId: z.string().describe("The metadata store ID"),
      contextId: z.string().describe("The context ID"),
    }),
    handler: async (args: { metadataStoreId: string; contextId: string }) => {
      return vertexRequest("GET", `/metadataStores/${args.metadataStoreId}/contexts/${args.contextId}`);
    },
  },
  {
    name: "vertex_list_contexts",
    description: "List all contexts in a Vertex AI Metadata Store.",
    inputSchema: z.object({
      metadataStoreId: z.string().describe("The metadata store ID"),
      filter: z.string().optional().describe("Filter expression"),
      pageSize: z.number().optional().describe("Maximum number of contexts to return"),
      pageToken: z.string().optional().describe("Page token for pagination"),
      orderBy: z.string().optional().describe("Field to order by"),
    }),
    handler: async (args: { metadataStoreId: string; filter?: string; pageSize?: number; pageToken?: string; orderBy?: string }) => {
      return vertexRequest("GET", `/metadataStores/${args.metadataStoreId}/contexts`, undefined, {
        filter: args.filter,
        pageSize: args.pageSize,
        pageToken: args.pageToken,
        orderBy: args.orderBy,
      });
    },
  },
  {
    name: "vertex_update_context",
    description: "Update a context's metadata in a metadata store.",
    inputSchema: z.object({
      metadataStoreId: z.string().describe("The metadata store ID"),
      contextId: z.string().describe("The context ID to update"),
      displayName: z.string().optional().describe("Updated display name"),
      labels: z.record(z.string(), z.string()).optional().describe("Updated labels"),
      description: z.string().optional().describe("Updated description"),
      metadata: z.record(z.string(), z.unknown()).optional().describe("Updated metadata properties"),
      updateMask: z.string().describe("Comma-separated list of fields to update"),
    }),
    handler: async (args: { metadataStoreId: string; contextId: string; displayName?: string; labels?: Record<string, string>; description?: string; metadata?: Record<string, unknown>; updateMask: string }) => {
      return vertexRequest("PATCH", `/metadataStores/${args.metadataStoreId}/contexts/${args.contextId}`, {
        ...(args.displayName && { displayName: args.displayName }),
        ...(args.labels && { labels: args.labels }),
        ...(args.description && { description: args.description }),
        ...(args.metadata && { metadata: args.metadata }),
      }, {
        updateMask: args.updateMask,
      });
    },
  },
  {
    name: "vertex_purge_contexts",
    description: "Purge (bulk delete) contexts from a metadata store matching a filter.",
    inputSchema: z.object({
      metadataStoreId: z.string().describe("The metadata store ID"),
      filter: z.string().describe("Filter expression for contexts to purge"),
      force: z.boolean().optional().describe("If true, perform the purge immediately; otherwise do a dry run"),
    }),
    handler: async (args: { metadataStoreId: string; filter: string; force?: boolean }) => {
      return vertexRequest("POST", `/metadataStores/${args.metadataStoreId}/contexts:purge`, {
        filter: args.filter,
        ...(args.force !== undefined && { force: args.force }),
      });
    },
  },

  // ==================== Executions ====================
  {
    name: "vertex_create_execution",
    description: "Create a new execution in a Vertex AI Metadata Store to track a step in an ML workflow.",
    inputSchema: z.object({
      metadataStoreId: z.string().describe("The metadata store ID"),
      executionId: z.string().optional().describe("The ID to use for the execution"),
      displayName: z.string().optional().describe("Human-readable display name"),
      state: z.enum(["NEW", "RUNNING", "COMPLETE", "FAILED", "CACHED", "CANCELLED"]).optional().describe("State of the execution"),
      etag: z.string().optional().describe("ETag for concurrency control"),
      labels: z.record(z.string(), z.string()).optional().describe("Labels as key-value pairs"),
      description: z.string().optional().describe("Description of the execution"),
      metadata: z.record(z.string(), z.unknown()).optional().describe("Properties of the execution as a struct"),
      schemaTitle: z.string().optional().describe("Schema title (e.g. system.Run, system.ContainerExecution)"),
      schemaVersion: z.string().optional().describe("Schema version"),
    }),
    handler: async (args: { metadataStoreId: string; executionId?: string; displayName?: string; state?: string; etag?: string; labels?: Record<string, string>; description?: string; metadata?: Record<string, unknown>; schemaTitle?: string; schemaVersion?: string }) => {
      return vertexRequest("POST", `/metadataStores/${args.metadataStoreId}/executions`, {
        ...(args.displayName && { displayName: args.displayName }),
        ...(args.state && { state: args.state }),
        ...(args.etag && { etag: args.etag }),
        ...(args.labels && { labels: args.labels }),
        ...(args.description && { description: args.description }),
        ...(args.metadata && { metadata: args.metadata }),
        ...(args.schemaTitle && { schemaTitle: args.schemaTitle }),
        ...(args.schemaVersion && { schemaVersion: args.schemaVersion }),
      }, {
        executionId: args.executionId,
      });
    },
  },
  {
    name: "vertex_get_execution",
    description: "Get details of a specific execution in a metadata store.",
    inputSchema: z.object({
      metadataStoreId: z.string().describe("The metadata store ID"),
      executionId: z.string().describe("The execution ID"),
    }),
    handler: async (args: { metadataStoreId: string; executionId: string }) => {
      return vertexRequest("GET", `/metadataStores/${args.metadataStoreId}/executions/${args.executionId}`);
    },
  },
  {
    name: "vertex_list_executions",
    description: "List all executions in a Vertex AI Metadata Store.",
    inputSchema: z.object({
      metadataStoreId: z.string().describe("The metadata store ID"),
      filter: z.string().optional().describe("Filter expression"),
      pageSize: z.number().optional().describe("Maximum number of executions to return"),
      pageToken: z.string().optional().describe("Page token for pagination"),
      orderBy: z.string().optional().describe("Field to order by"),
    }),
    handler: async (args: { metadataStoreId: string; filter?: string; pageSize?: number; pageToken?: string; orderBy?: string }) => {
      return vertexRequest("GET", `/metadataStores/${args.metadataStoreId}/executions`, undefined, {
        filter: args.filter,
        pageSize: args.pageSize,
        pageToken: args.pageToken,
        orderBy: args.orderBy,
      });
    },
  },
  {
    name: "vertex_update_execution",
    description: "Update an execution's metadata in a metadata store.",
    inputSchema: z.object({
      metadataStoreId: z.string().describe("The metadata store ID"),
      executionId: z.string().describe("The execution ID to update"),
      displayName: z.string().optional().describe("Updated display name"),
      state: z.enum(["NEW", "RUNNING", "COMPLETE", "FAILED", "CACHED", "CANCELLED"]).optional().describe("Updated state"),
      labels: z.record(z.string(), z.string()).optional().describe("Updated labels"),
      description: z.string().optional().describe("Updated description"),
      metadata: z.record(z.string(), z.unknown()).optional().describe("Updated metadata properties"),
      updateMask: z.string().describe("Comma-separated list of fields to update"),
    }),
    handler: async (args: { metadataStoreId: string; executionId: string; displayName?: string; state?: string; labels?: Record<string, string>; description?: string; metadata?: Record<string, unknown>; updateMask: string }) => {
      return vertexRequest("PATCH", `/metadataStores/${args.metadataStoreId}/executions/${args.executionId}`, {
        ...(args.displayName && { displayName: args.displayName }),
        ...(args.state && { state: args.state }),
        ...(args.labels && { labels: args.labels }),
        ...(args.description && { description: args.description }),
        ...(args.metadata && { metadata: args.metadata }),
      }, {
        updateMask: args.updateMask,
      });
    },
  },
];
