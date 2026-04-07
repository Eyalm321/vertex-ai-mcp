import { z } from "zod";
import { vertexRequest } from "../client.js";

export const featureOnlineStoreTools = [
  // ==================== Feature Online Stores ====================
  {
    name: "vertex_create_feature_online_store",
    description: "Create a new Vertex AI Feature Online Store for low-latency online feature serving.",
    inputSchema: z.object({
      featureOnlineStoreId: z.string().describe("The ID to use for the feature online store"),
      displayName: z.string().optional().describe("Human-readable display name"),
      bigtable: z.object({
        autoScaling: z.object({
          minNodeCount: z.number().describe("Minimum number of Bigtable nodes"),
          maxNodeCount: z.number().describe("Maximum number of Bigtable nodes"),
          cpuUtilizationTarget: z.number().optional().describe("Target CPU utilization percentage"),
        }),
      }).optional().describe("Bigtable configuration for the online store"),
      optimized: z.object({}).optional().describe("Optimized online store configuration (managed by Vertex AI)"),
      labels: z.record(z.string(), z.string()).optional().describe("Labels as key-value pairs"),
    }),
    handler: async (args: { featureOnlineStoreId: string; displayName?: string; bigtable?: Record<string, unknown>; optimized?: Record<string, unknown>; labels?: Record<string, string> }) => {
      return vertexRequest("POST", "/featureOnlineStores", {
        ...(args.displayName && { displayName: args.displayName }),
        ...(args.bigtable && { bigtable: args.bigtable }),
        ...(args.optimized && { optimized: args.optimized }),
        ...(args.labels && { labels: args.labels }),
      }, {
        featureOnlineStoreId: args.featureOnlineStoreId,
      });
    },
  },
  {
    name: "vertex_get_feature_online_store",
    description: "Get details of a specific Vertex AI Feature Online Store by ID.",
    inputSchema: z.object({
      featureOnlineStoreId: z.string().describe("The feature online store ID"),
    }),
    handler: async (args: { featureOnlineStoreId: string }) => {
      return vertexRequest("GET", `/featureOnlineStores/${args.featureOnlineStoreId}`);
    },
  },
  {
    name: "vertex_list_feature_online_stores",
    description: "List all Vertex AI Feature Online Stores in the current project and location.",
    inputSchema: z.object({
      filter: z.string().optional().describe("Filter expression"),
      pageSize: z.number().optional().describe("Maximum number of stores to return"),
      pageToken: z.string().optional().describe("Page token for pagination"),
      orderBy: z.string().optional().describe("Field to order by"),
    }),
    handler: async (args: { filter?: string; pageSize?: number; pageToken?: string; orderBy?: string }) => {
      return vertexRequest("GET", "/featureOnlineStores", undefined, {
        filter: args.filter,
        pageSize: args.pageSize,
        pageToken: args.pageToken,
        orderBy: args.orderBy,
      });
    },
  },
  {
    name: "vertex_delete_feature_online_store",
    description: "Delete a Vertex AI Feature Online Store by ID.",
    inputSchema: z.object({
      featureOnlineStoreId: z.string().describe("The feature online store ID to delete"),
      force: z.boolean().optional().describe("If true, delete even if the store contains feature views"),
    }),
    handler: async (args: { featureOnlineStoreId: string; force?: boolean }) => {
      return vertexRequest("DELETE", `/featureOnlineStores/${args.featureOnlineStoreId}`, undefined, {
        force: args.force,
      });
    },
  },
  {
    name: "vertex_update_feature_online_store",
    description: "Update a Vertex AI Feature Online Store's configuration.",
    inputSchema: z.object({
      featureOnlineStoreId: z.string().describe("The feature online store ID to update"),
      labels: z.record(z.string(), z.string()).optional().describe("Updated labels"),
      updateMask: z.string().describe("Comma-separated list of fields to update"),
    }),
    handler: async (args: { featureOnlineStoreId: string; labels?: Record<string, string>; updateMask: string }) => {
      return vertexRequest("PATCH", `/featureOnlineStores/${args.featureOnlineStoreId}`, {
        ...(args.labels && { labels: args.labels }),
      }, {
        updateMask: args.updateMask,
      });
    },
  },

  // ==================== Feature Views ====================
  {
    name: "vertex_create_feature_view",
    description: "Create a new feature view within a Feature Online Store to define which features to serve.",
    inputSchema: z.object({
      featureOnlineStoreId: z.string().describe("The feature online store ID"),
      featureViewId: z.string().describe("The ID to use for the feature view"),
      featureRegistrySource: z.object({
        featureGroups: z.array(z.object({
          featureGroupId: z.string().describe("Feature group ID"),
          featureIds: z.array(z.string()).describe("Feature IDs to include from this group"),
        })),
      }).optional().describe("Source from Vertex AI Feature Registry"),
      bigQuerySource: z.object({
        uri: z.string().describe("BigQuery source URI (e.g. bq://project.dataset.table)"),
        entityIdColumns: z.array(z.string()).describe("Columns to use as entity IDs"),
      }).optional().describe("Source from BigQuery"),
    }),
    handler: async (args: { featureOnlineStoreId: string; featureViewId: string; featureRegistrySource?: Record<string, unknown>; bigQuerySource?: Record<string, unknown> }) => {
      return vertexRequest("POST", `/featureOnlineStores/${args.featureOnlineStoreId}/featureViews`, {
        ...(args.featureRegistrySource && { featureRegistrySource: args.featureRegistrySource }),
        ...(args.bigQuerySource && { bigQuerySource: args.bigQuerySource }),
      }, {
        featureViewId: args.featureViewId,
      });
    },
  },
  {
    name: "vertex_get_feature_view",
    description: "Get details of a specific feature view within a Feature Online Store.",
    inputSchema: z.object({
      featureOnlineStoreId: z.string().describe("The feature online store ID"),
      featureViewId: z.string().describe("The feature view ID"),
    }),
    handler: async (args: { featureOnlineStoreId: string; featureViewId: string }) => {
      return vertexRequest("GET", `/featureOnlineStores/${args.featureOnlineStoreId}/featureViews/${args.featureViewId}`);
    },
  },
  {
    name: "vertex_list_feature_views",
    description: "List all feature views in a Feature Online Store.",
    inputSchema: z.object({
      featureOnlineStoreId: z.string().describe("The feature online store ID"),
      filter: z.string().optional().describe("Filter expression"),
      pageSize: z.number().optional().describe("Maximum number of feature views to return"),
      pageToken: z.string().optional().describe("Page token for pagination"),
      orderBy: z.string().optional().describe("Field to order by"),
    }),
    handler: async (args: { featureOnlineStoreId: string; filter?: string; pageSize?: number; pageToken?: string; orderBy?: string }) => {
      return vertexRequest("GET", `/featureOnlineStores/${args.featureOnlineStoreId}/featureViews`, undefined, {
        filter: args.filter,
        pageSize: args.pageSize,
        pageToken: args.pageToken,
        orderBy: args.orderBy,
      });
    },
  },
  {
    name: "vertex_delete_feature_view",
    description: "Delete a feature view from a Feature Online Store.",
    inputSchema: z.object({
      featureOnlineStoreId: z.string().describe("The feature online store ID"),
      featureViewId: z.string().describe("The feature view ID to delete"),
    }),
    handler: async (args: { featureOnlineStoreId: string; featureViewId: string }) => {
      return vertexRequest("DELETE", `/featureOnlineStores/${args.featureOnlineStoreId}/featureViews/${args.featureViewId}`);
    },
  },
  {
    name: "vertex_update_feature_view",
    description: "Update a feature view's configuration in a Feature Online Store.",
    inputSchema: z.object({
      featureOnlineStoreId: z.string().describe("The feature online store ID"),
      featureViewId: z.string().describe("The feature view ID to update"),
      updateMask: z.string().describe("Comma-separated list of fields to update"),
    }),
    handler: async (args: { featureOnlineStoreId: string; featureViewId: string; updateMask: string }) => {
      return vertexRequest("PATCH", `/featureOnlineStores/${args.featureOnlineStoreId}/featureViews/${args.featureViewId}`, {}, {
        updateMask: args.updateMask,
      });
    },
  },
  {
    name: "vertex_fetch_feature_values",
    description: "Fetch feature values from a Feature Online Store feature view for a specific entity.",
    inputSchema: z.object({
      featureOnlineStoreId: z.string().describe("The feature online store ID"),
      featureViewId: z.string().describe("The feature view ID"),
      dataKey: z.union([
        z.string().describe("Simple string entity ID"),
        z.object({
          compositeKey: z.object({
            parts: z.array(z.object({
              key: z.string(),
              value: z.string(),
            })),
          }),
        }),
      ]).describe("The data key (simple string ID or composite key) to fetch values for"),
      dataFormat: z.enum(["KEY_VALUE", "PROTO_STRUCT"]).optional().describe("Format of the returned feature values"),
    }),
    handler: async (args: { featureOnlineStoreId: string; featureViewId: string; dataKey: string | Record<string, unknown>; dataFormat?: string }) => {
      const body: Record<string, unknown> = {};
      if (typeof args.dataKey === "string") {
        body.dataKey = { key: args.dataKey };
      } else {
        body.dataKey = args.dataKey;
      }
      if (args.dataFormat) {
        body.dataFormat = args.dataFormat;
      }
      return vertexRequest("POST", `/featureOnlineStores/${args.featureOnlineStoreId}/featureViews/${args.featureViewId}:fetchFeatureValues`, body);
    },
  },
  {
    name: "vertex_search_nearest_entities",
    description: "Search for nearest entities using vector similarity in a Feature Online Store feature view.",
    inputSchema: z.object({
      featureOnlineStoreId: z.string().describe("The feature online store ID"),
      featureViewId: z.string().describe("The feature view ID"),
      query: z.object({
        embedding: z.object({
          value: z.array(z.number()).describe("The embedding vector"),
        }).describe("The query embedding"),
        neighborCount: z.number().describe("Number of nearest neighbors to return"),
        parameters: z.object({
          approximateNeighborCandidates: z.number().optional().describe("Number of approximate neighbor candidates to consider"),
          leafNodesToSearchPercent: z.number().optional().describe("Percentage of leaf nodes to search"),
        }).optional().describe("Search parameters"),
        stringFilter: z.array(z.object({
          name: z.string().describe("Filter field name"),
          allowTokens: z.array(z.string()).optional(),
          denyTokens: z.array(z.string()).optional(),
        })).optional().describe("String filters for the search"),
      }).describe("The search query configuration"),
    }),
    handler: async (args: { featureOnlineStoreId: string; featureViewId: string; query: Record<string, unknown> }) => {
      return vertexRequest("POST", `/featureOnlineStores/${args.featureOnlineStoreId}/featureViews/${args.featureViewId}:searchNearestEntities`, {
        query: args.query,
      });
    },
  },
  {
    name: "vertex_sync_feature_view",
    description: "Trigger a sync for a feature view to update its data from the source.",
    inputSchema: z.object({
      featureOnlineStoreId: z.string().describe("The feature online store ID"),
      featureViewId: z.string().describe("The feature view ID to sync"),
    }),
    handler: async (args: { featureOnlineStoreId: string; featureViewId: string }) => {
      return vertexRequest("POST", `/featureOnlineStores/${args.featureOnlineStoreId}/featureViews/${args.featureViewId}/featureViewSyncs`, {});
    },
  },
];
