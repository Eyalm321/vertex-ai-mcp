import { z } from "zod";
import { vertexRequest } from "../client.js";

export const indexTools = [
  // ── Indexes ──────────────────────────────────────────────────────────
  {
    name: "vertex_create_index",
    description: "Create a new Vertex AI vector search index.",
    inputSchema: z.object({
      displayName: z.string().describe("Human-readable display name for the index"),
      description: z.string().optional().describe("Description of the index"),
      metadata: z.object({
        config: z.record(z.string(), z.unknown()).describe("Index configuration with dimensions, approximateNeighborsCount, shardSize, distanceMeasureType, algorithmConfig, etc."),
        contentsDeltaUri: z.string().optional().describe("GCS URI to the input index data"),
        isCompleteOverwrite: z.boolean().optional().describe("Whether this is a complete overwrite of the index"),
      }).describe("Index metadata with config and optional data source"),
      indexUpdateMethod: z.enum(["BATCH_UPDATE", "STREAM_UPDATE"]).optional().describe("How the index is updated: BATCH_UPDATE or STREAM_UPDATE"),
      labels: z.record(z.string(), z.string()).optional().describe("Labels as key-value pairs"),
    }),
    handler: async (args: { displayName: string; description?: string; metadata: Record<string, unknown>; indexUpdateMethod?: string; labels?: Record<string, string> }) => {
      return vertexRequest("POST", "/indexes", {
        displayName: args.displayName,
        ...(args.description && { description: args.description }),
        metadata: args.metadata,
        ...(args.indexUpdateMethod && { indexUpdateMethod: args.indexUpdateMethod }),
        ...(args.labels && { labels: args.labels }),
      });
    },
  },
  {
    name: "vertex_get_index",
    description: "Get details of a specific Vertex AI index by ID.",
    inputSchema: z.object({
      indexId: z.string().describe("The index ID"),
    }),
    handler: async (args: { indexId: string }) => {
      return vertexRequest("GET", `/indexes/${args.indexId}`);
    },
  },
  {
    name: "vertex_list_indexes",
    description: "List all Vertex AI indexes in the current project and location.",
    inputSchema: z.object({
      filter: z.string().optional().describe("Filter expression"),
      pageSize: z.number().optional().describe("Maximum number of indexes to return"),
      pageToken: z.string().optional().describe("Page token for pagination"),
    }),
    handler: async (args: { filter?: string; pageSize?: number; pageToken?: string }) => {
      return vertexRequest("GET", "/indexes", undefined, {
        filter: args.filter,
        pageSize: args.pageSize,
        pageToken: args.pageToken,
      });
    },
  },
  {
    name: "vertex_delete_index",
    description: "Delete a Vertex AI index by ID.",
    inputSchema: z.object({
      indexId: z.string().describe("The index ID to delete"),
    }),
    handler: async (args: { indexId: string }) => {
      return vertexRequest("DELETE", `/indexes/${args.indexId}`);
    },
  },
  {
    name: "vertex_update_index",
    description: "Update a Vertex AI index's metadata.",
    inputSchema: z.object({
      indexId: z.string().describe("The index ID to update"),
      displayName: z.string().optional().describe("Updated display name"),
      description: z.string().optional().describe("Updated description"),
      metadata: z.record(z.string(), z.unknown()).optional().describe("Updated metadata"),
      updateMask: z.string().describe("Comma-separated list of fields to update"),
    }),
    handler: async (args: { indexId: string; displayName?: string; description?: string; metadata?: Record<string, unknown>; updateMask: string }) => {
      return vertexRequest("PATCH", `/indexes/${args.indexId}`, {
        ...(args.displayName && { displayName: args.displayName }),
        ...(args.description && { description: args.description }),
        ...(args.metadata && { metadata: args.metadata }),
      }, { updateMask: args.updateMask });
    },
  },
  {
    name: "vertex_upsert_datapoints",
    description: "Upsert datapoints into a Vertex AI vector search index.",
    inputSchema: z.object({
      indexId: z.string().describe("The index ID"),
      datapoints: z.array(z.object({
        datapointId: z.string().describe("Unique ID for the datapoint"),
        featureVector: z.array(z.number()).describe("The feature vector values"),
        restricts: z.array(z.object({
          namespace: z.string().describe("Restrict namespace"),
          allowList: z.array(z.string()).optional().describe("Allowed values"),
          denyList: z.array(z.string()).optional().describe("Denied values"),
        })).optional().describe("Token restrictions for filtering"),
      })).describe("Datapoints to upsert"),
    }),
    handler: async (args: { indexId: string; datapoints: Record<string, unknown>[] }) => {
      return vertexRequest("POST", `/indexes/${args.indexId}:upsertDatapoints`, {
        datapoints: args.datapoints,
      });
    },
  },
  {
    name: "vertex_remove_datapoints",
    description: "Remove datapoints from a Vertex AI vector search index.",
    inputSchema: z.object({
      indexId: z.string().describe("The index ID"),
      datapointIds: z.array(z.string()).describe("IDs of the datapoints to remove"),
    }),
    handler: async (args: { indexId: string; datapointIds: string[] }) => {
      return vertexRequest("POST", `/indexes/${args.indexId}:removeDatapoints`, {
        datapointIds: args.datapointIds,
      });
    },
  },

  // ── Index Endpoints ──────────────────────────────────────────────────
  {
    name: "vertex_create_index_endpoint",
    description: "Create a new Vertex AI index endpoint for serving vector search queries.",
    inputSchema: z.object({
      displayName: z.string().describe("Human-readable display name for the index endpoint"),
      description: z.string().optional().describe("Description of the index endpoint"),
      network: z.string().optional().describe("Full name of the Google Compute Engine network for peering"),
      labels: z.record(z.string(), z.string()).optional().describe("Labels as key-value pairs"),
    }),
    handler: async (args: { displayName: string; description?: string; network?: string; labels?: Record<string, string> }) => {
      return vertexRequest("POST", "/indexEndpoints", {
        displayName: args.displayName,
        ...(args.description && { description: args.description }),
        ...(args.network && { network: args.network }),
        ...(args.labels && { labels: args.labels }),
      });
    },
  },
  {
    name: "vertex_get_index_endpoint",
    description: "Get details of a specific Vertex AI index endpoint by ID.",
    inputSchema: z.object({
      indexEndpointId: z.string().describe("The index endpoint ID"),
    }),
    handler: async (args: { indexEndpointId: string }) => {
      return vertexRequest("GET", `/indexEndpoints/${args.indexEndpointId}`);
    },
  },
  {
    name: "vertex_list_index_endpoints",
    description: "List all Vertex AI index endpoints in the current project and location.",
    inputSchema: z.object({
      filter: z.string().optional().describe("Filter expression"),
      pageSize: z.number().optional().describe("Maximum number of index endpoints to return"),
      pageToken: z.string().optional().describe("Page token for pagination"),
    }),
    handler: async (args: { filter?: string; pageSize?: number; pageToken?: string }) => {
      return vertexRequest("GET", "/indexEndpoints", undefined, {
        filter: args.filter,
        pageSize: args.pageSize,
        pageToken: args.pageToken,
      });
    },
  },
  {
    name: "vertex_delete_index_endpoint",
    description: "Delete a Vertex AI index endpoint by ID.",
    inputSchema: z.object({
      indexEndpointId: z.string().describe("The index endpoint ID to delete"),
    }),
    handler: async (args: { indexEndpointId: string }) => {
      return vertexRequest("DELETE", `/indexEndpoints/${args.indexEndpointId}`);
    },
  },
  {
    name: "vertex_deploy_index",
    description: "Deploy an index to a Vertex AI index endpoint for serving.",
    inputSchema: z.object({
      indexEndpointId: z.string().describe("The index endpoint ID to deploy to"),
      deployedIndex: z.object({
        id: z.string().describe("Unique ID for the deployed index within the endpoint"),
        index: z.string().describe("Full resource name of the index to deploy"),
        displayName: z.string().optional().describe("Display name for the deployed index"),
        dedicatedResources: z.object({
          machineSpec: z.object({
            machineType: z.string().describe("Machine type (e.g. e2-standard-16)"),
          }),
          minReplicaCount: z.number().describe("Minimum number of replicas"),
          maxReplicaCount: z.number().optional().describe("Maximum number of replicas"),
        }).optional().describe("Dedicated resources configuration"),
        automaticResources: z.object({
          minReplicaCount: z.number().optional().describe("Minimum number of replicas"),
          maxReplicaCount: z.number().optional().describe("Maximum number of replicas"),
        }).optional().describe("Automatic resources configuration"),
      }).describe("The deployed index configuration"),
    }),
    handler: async (args: { indexEndpointId: string; deployedIndex: Record<string, unknown> }) => {
      return vertexRequest("POST", `/indexEndpoints/${args.indexEndpointId}:deployIndex`, {
        deployedIndex: args.deployedIndex,
      });
    },
  },
  {
    name: "vertex_undeploy_index",
    description: "Undeploy an index from a Vertex AI index endpoint.",
    inputSchema: z.object({
      indexEndpointId: z.string().describe("The index endpoint ID"),
      deployedIndexId: z.string().describe("The deployed index ID to undeploy"),
    }),
    handler: async (args: { indexEndpointId: string; deployedIndexId: string }) => {
      return vertexRequest("POST", `/indexEndpoints/${args.indexEndpointId}:undeployIndex`, {
        deployedIndexId: args.deployedIndexId,
      });
    },
  },
];
