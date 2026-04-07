import { z } from "zod";
import { vertexRequest } from "../client.js";

export const featurestoreTools = [
  // ==================== Featurestores ====================
  {
    name: "vertex_create_featurestore",
    description: "Create a new Vertex AI Featurestore for organizing and serving ML features.",
    inputSchema: z.object({
      featurestoreId: z.string().describe("The ID to use for the featurestore"),
      displayName: z.string().optional().describe("Human-readable display name"),
      onlineServingConfig: z.object({
        fixedNodeCount: z.number().optional().describe("Fixed number of nodes for online serving"),
        scaling: z.object({
          minNodeCount: z.number().describe("Minimum number of nodes"),
          maxNodeCount: z.number().describe("Maximum number of nodes"),
          cpuUtilizationTarget: z.number().optional().describe("Target CPU utilization percentage"),
        }).optional().describe("Auto-scaling configuration"),
      }).optional().describe("Online serving configuration"),
      labels: z.record(z.string(), z.string()).optional().describe("Labels as key-value pairs"),
      encryptionSpec: z.object({
        kmsKeyName: z.string().describe("Cloud KMS resource identifier"),
      }).optional().describe("Customer-managed encryption key spec"),
    }),
    handler: async (args: { featurestoreId: string; displayName?: string; onlineServingConfig?: Record<string, unknown>; labels?: Record<string, string>; encryptionSpec?: { kmsKeyName: string } }) => {
      return vertexRequest("POST", "/featurestores", {
        ...(args.displayName && { displayName: args.displayName }),
        ...(args.onlineServingConfig && { onlineServingConfig: args.onlineServingConfig }),
        ...(args.labels && { labels: args.labels }),
        ...(args.encryptionSpec && { encryptionSpec: args.encryptionSpec }),
      }, {
        featurestoreId: args.featurestoreId,
      });
    },
  },
  {
    name: "vertex_get_featurestore",
    description: "Get details of a specific Vertex AI Featurestore by ID.",
    inputSchema: z.object({
      featurestoreId: z.string().describe("The featurestore ID"),
    }),
    handler: async (args: { featurestoreId: string }) => {
      return vertexRequest("GET", `/featurestores/${args.featurestoreId}`);
    },
  },
  {
    name: "vertex_list_featurestores",
    description: "List all Vertex AI Featurestores in the current project and location.",
    inputSchema: z.object({
      filter: z.string().optional().describe("Filter expression"),
      pageSize: z.number().optional().describe("Maximum number of featurestores to return"),
      pageToken: z.string().optional().describe("Page token for pagination"),
      orderBy: z.string().optional().describe("Field to order by"),
    }),
    handler: async (args: { filter?: string; pageSize?: number; pageToken?: string; orderBy?: string }) => {
      return vertexRequest("GET", "/featurestores", undefined, {
        filter: args.filter,
        pageSize: args.pageSize,
        pageToken: args.pageToken,
        orderBy: args.orderBy,
      });
    },
  },
  {
    name: "vertex_delete_featurestore",
    description: "Delete a Vertex AI Featurestore by ID. Use force=true to delete even if it contains entity types.",
    inputSchema: z.object({
      featurestoreId: z.string().describe("The featurestore ID to delete"),
      force: z.boolean().optional().describe("If true, delete even if the featurestore contains entity types"),
    }),
    handler: async (args: { featurestoreId: string; force?: boolean }) => {
      return vertexRequest("DELETE", `/featurestores/${args.featurestoreId}`, undefined, {
        force: args.force,
      });
    },
  },
  {
    name: "vertex_update_featurestore",
    description: "Update a Vertex AI Featurestore's configuration.",
    inputSchema: z.object({
      featurestoreId: z.string().describe("The featurestore ID to update"),
      onlineServingConfig: z.object({
        fixedNodeCount: z.number().optional().describe("Fixed number of nodes for online serving"),
        scaling: z.object({
          minNodeCount: z.number().describe("Minimum number of nodes"),
          maxNodeCount: z.number().describe("Maximum number of nodes"),
          cpuUtilizationTarget: z.number().optional().describe("Target CPU utilization percentage"),
        }).optional().describe("Auto-scaling configuration"),
      }).optional().describe("Updated online serving configuration"),
      labels: z.record(z.string(), z.string()).optional().describe("Updated labels"),
      updateMask: z.string().describe("Comma-separated list of fields to update"),
    }),
    handler: async (args: { featurestoreId: string; onlineServingConfig?: Record<string, unknown>; labels?: Record<string, string>; updateMask: string }) => {
      return vertexRequest("PATCH", `/featurestores/${args.featurestoreId}`, {
        ...(args.onlineServingConfig && { onlineServingConfig: args.onlineServingConfig }),
        ...(args.labels && { labels: args.labels }),
      }, {
        updateMask: args.updateMask,
      });
    },
  },
  {
    name: "vertex_search_features",
    description: "Search for features across all featurestores in the project by query string.",
    inputSchema: z.object({
      query: z.string().optional().describe("Query string to search features (e.g. feature_id, description, entity_type_id)"),
      pageSize: z.number().optional().describe("Maximum number of features to return"),
      pageToken: z.string().optional().describe("Page token for pagination"),
    }),
    handler: async (args: { query?: string; pageSize?: number; pageToken?: string }) => {
      return vertexRequest("GET", "/featurestores:searchFeatures", undefined, {
        query: args.query,
        pageSize: args.pageSize,
        pageToken: args.pageToken,
      });
    },
  },
  {
    name: "vertex_batch_read_feature_values",
    description: "Batch read feature values from a featurestore for offline serving or analysis.",
    inputSchema: z.object({
      featurestoreId: z.string().describe("The featurestore ID"),
      csvReadInstances: z.object({
        gcsSource: z.object({ uris: z.array(z.string()) }).describe("GCS source URIs"),
      }).optional().describe("CSV read instances configuration"),
      bigqueryReadInstances: z.object({
        bigQuerySource: z.object({ inputUri: z.string() }).describe("BigQuery source URI"),
      }).optional().describe("BigQuery read instances configuration"),
      entityTypeSpecs: z.array(z.object({
        entityTypeId: z.string().describe("Entity type ID"),
        featureSelector: z.object({
          idMatcher: z.object({ ids: z.array(z.string()) }).describe("Feature IDs to select"),
        }).describe("Feature selector"),
      })).describe("Entity type specs with feature selectors"),
      destination: z.object({
        bigqueryDestination: z.object({
          outputUri: z.string().describe("BigQuery output URI"),
        }).optional(),
        csvDestination: z.object({
          gcsDestination: z.object({ outputUriPrefix: z.string() }).describe("GCS destination prefix"),
        }).optional(),
        tfrecordDestination: z.object({
          gcsDestination: z.object({ outputUriPrefix: z.string() }).describe("GCS destination prefix"),
        }).optional(),
      }).describe("Output destination configuration"),
    }),
    handler: async (args: { featurestoreId: string; csvReadInstances?: Record<string, unknown>; bigqueryReadInstances?: Record<string, unknown>; entityTypeSpecs: Record<string, unknown>[]; destination: Record<string, unknown> }) => {
      return vertexRequest("POST", `/featurestores/${args.featurestoreId}:batchReadFeatureValues`, {
        ...(args.csvReadInstances && { csvReadInstances: args.csvReadInstances }),
        ...(args.bigqueryReadInstances && { bigqueryReadInstances: args.bigqueryReadInstances }),
        entityTypeSpecs: args.entityTypeSpecs,
        destination: args.destination,
      });
    },
  },

  // ==================== Entity Types ====================
  {
    name: "vertex_create_entity_type",
    description: "Create a new entity type within a Vertex AI Featurestore.",
    inputSchema: z.object({
      featurestoreId: z.string().describe("The featurestore ID"),
      entityTypeId: z.string().describe("The ID to use for the entity type"),
      description: z.string().optional().describe("Description of the entity type"),
      labels: z.record(z.string(), z.string()).optional().describe("Labels as key-value pairs"),
    }),
    handler: async (args: { featurestoreId: string; entityTypeId: string; description?: string; labels?: Record<string, string> }) => {
      return vertexRequest("POST", `/featurestores/${args.featurestoreId}/entityTypes`, {
        ...(args.description && { description: args.description }),
        ...(args.labels && { labels: args.labels }),
      }, {
        entityTypeId: args.entityTypeId,
      });
    },
  },
  {
    name: "vertex_get_entity_type",
    description: "Get details of a specific entity type within a featurestore.",
    inputSchema: z.object({
      featurestoreId: z.string().describe("The featurestore ID"),
      entityTypeId: z.string().describe("The entity type ID"),
    }),
    handler: async (args: { featurestoreId: string; entityTypeId: string }) => {
      return vertexRequest("GET", `/featurestores/${args.featurestoreId}/entityTypes/${args.entityTypeId}`);
    },
  },
  {
    name: "vertex_list_entity_types",
    description: "List all entity types in a Vertex AI Featurestore.",
    inputSchema: z.object({
      featurestoreId: z.string().describe("The featurestore ID"),
      filter: z.string().optional().describe("Filter expression"),
      pageSize: z.number().optional().describe("Maximum number of entity types to return"),
      pageToken: z.string().optional().describe("Page token for pagination"),
      orderBy: z.string().optional().describe("Field to order by"),
    }),
    handler: async (args: { featurestoreId: string; filter?: string; pageSize?: number; pageToken?: string; orderBy?: string }) => {
      return vertexRequest("GET", `/featurestores/${args.featurestoreId}/entityTypes`, undefined, {
        filter: args.filter,
        pageSize: args.pageSize,
        pageToken: args.pageToken,
        orderBy: args.orderBy,
      });
    },
  },
  {
    name: "vertex_delete_entity_type",
    description: "Delete an entity type from a featurestore. Use force=true to delete even if it contains features.",
    inputSchema: z.object({
      featurestoreId: z.string().describe("The featurestore ID"),
      entityTypeId: z.string().describe("The entity type ID to delete"),
      force: z.boolean().optional().describe("If true, delete even if the entity type contains features"),
    }),
    handler: async (args: { featurestoreId: string; entityTypeId: string; force?: boolean }) => {
      return vertexRequest("DELETE", `/featurestores/${args.featurestoreId}/entityTypes/${args.entityTypeId}`, undefined, {
        force: args.force,
      });
    },
  },
  {
    name: "vertex_update_entity_type",
    description: "Update an entity type's metadata in a featurestore.",
    inputSchema: z.object({
      featurestoreId: z.string().describe("The featurestore ID"),
      entityTypeId: z.string().describe("The entity type ID to update"),
      description: z.string().optional().describe("Updated description"),
      labels: z.record(z.string(), z.string()).optional().describe("Updated labels"),
      updateMask: z.string().describe("Comma-separated list of fields to update"),
    }),
    handler: async (args: { featurestoreId: string; entityTypeId: string; description?: string; labels?: Record<string, string>; updateMask: string }) => {
      return vertexRequest("PATCH", `/featurestores/${args.featurestoreId}/entityTypes/${args.entityTypeId}`, {
        ...(args.description && { description: args.description }),
        ...(args.labels && { labels: args.labels }),
      }, {
        updateMask: args.updateMask,
      });
    },
  },
  {
    name: "vertex_read_feature_values",
    description: "Read feature values for a specific entity from a featurestore entity type.",
    inputSchema: z.object({
      featurestoreId: z.string().describe("The featurestore ID"),
      entityTypeId: z.string().describe("The entity type ID"),
      entityId: z.string().describe("The entity ID to read feature values for"),
      featureSelector: z.object({
        idMatcher: z.object({
          ids: z.array(z.string()).describe("List of feature IDs to select, use ['*'] for all"),
        }),
      }).describe("Feature selector specifying which features to read"),
    }),
    handler: async (args: { featurestoreId: string; entityTypeId: string; entityId: string; featureSelector: Record<string, unknown> }) => {
      return vertexRequest("GET", `/featurestores/${args.featurestoreId}/entityTypes/${args.entityTypeId}:readFeatureValues`, undefined, {
        entityId: args.entityId,
        "featureSelector.idMatcher.ids": (args.featureSelector as { idMatcher: { ids: string[] } }).idMatcher.ids.join(","),
      });
    },
  },
  {
    name: "vertex_import_feature_values",
    description: "Import feature values into a featurestore entity type from CSV, BigQuery, or Avro sources.",
    inputSchema: z.object({
      featurestoreId: z.string().describe("The featurestore ID"),
      entityTypeId: z.string().describe("The entity type ID"),
      csvSource: z.object({
        gcsSource: z.object({ uris: z.array(z.string()) }),
      }).optional().describe("CSV source from GCS"),
      bigquerySource: z.object({
        inputUri: z.string().describe("BigQuery input URI"),
      }).optional().describe("BigQuery source"),
      avroSource: z.object({
        gcsSource: z.object({ uris: z.array(z.string()) }),
      }).optional().describe("Avro source from GCS"),
      featureSpecs: z.array(z.object({
        id: z.string().describe("Feature ID"),
        sourceField: z.string().optional().describe("Source field name if different from feature ID"),
      })).describe("Feature specs mapping source fields to features"),
      entityIdField: z.string().describe("Name of the entity ID field in the source"),
      featureTimeField: z.string().optional().describe("Name of the feature timestamp field"),
      workerCount: z.number().optional().describe("Number of workers for import"),
    }),
    handler: async (args: { featurestoreId: string; entityTypeId: string; csvSource?: Record<string, unknown>; bigquerySource?: Record<string, unknown>; avroSource?: Record<string, unknown>; featureSpecs: Record<string, unknown>[]; entityIdField: string; featureTimeField?: string; workerCount?: number }) => {
      return vertexRequest("POST", `/featurestores/${args.featurestoreId}/entityTypes/${args.entityTypeId}:importFeatureValues`, {
        ...(args.csvSource && { csvSource: args.csvSource }),
        ...(args.bigquerySource && { bigquerySource: args.bigquerySource }),
        ...(args.avroSource && { avroSource: args.avroSource }),
        featureSpecs: args.featureSpecs,
        entityIdField: args.entityIdField,
        ...(args.featureTimeField && { featureTimeField: args.featureTimeField }),
        ...(args.workerCount !== undefined && { workerCount: args.workerCount }),
      });
    },
  },
  {
    name: "vertex_export_feature_values",
    description: "Export feature values from a featurestore entity type to a destination.",
    inputSchema: z.object({
      featurestoreId: z.string().describe("The featurestore ID"),
      entityTypeId: z.string().describe("The entity type ID"),
      destination: z.object({
        bigqueryDestination: z.object({
          outputUri: z.string(),
        }).optional(),
        csvDestination: z.object({
          gcsDestination: z.object({ outputUriPrefix: z.string() }),
        }).optional(),
        tfrecordDestination: z.object({
          gcsDestination: z.object({ outputUriPrefix: z.string() }),
        }).optional(),
      }).describe("Export destination"),
      featureSelector: z.object({
        idMatcher: z.object({
          ids: z.array(z.string()),
        }),
      }).describe("Feature selector specifying which features to export"),
      snapshotExport: z.object({
        snapshotTime: z.string().optional().describe("Timestamp for snapshot export"),
        startTime: z.string().optional().describe("Start time for incremental export"),
      }).optional().describe("Snapshot-based export configuration"),
      fullExport: z.object({
        startTime: z.string().optional().describe("Start time filter"),
        endTime: z.string().optional().describe("End time filter"),
      }).optional().describe("Full export configuration"),
    }),
    handler: async (args: { featurestoreId: string; entityTypeId: string; destination: Record<string, unknown>; featureSelector: Record<string, unknown>; snapshotExport?: Record<string, unknown>; fullExport?: Record<string, unknown> }) => {
      return vertexRequest("POST", `/featurestores/${args.featurestoreId}/entityTypes/${args.entityTypeId}:exportFeatureValues`, {
        destination: args.destination,
        featureSelector: args.featureSelector,
        ...(args.snapshotExport && { snapshotExport: args.snapshotExport }),
        ...(args.fullExport && { fullExport: args.fullExport }),
      });
    },
  },
  {
    name: "vertex_delete_feature_values",
    description: "Delete feature values from a featurestore entity type by entity or time range.",
    inputSchema: z.object({
      featurestoreId: z.string().describe("The featurestore ID"),
      entityTypeId: z.string().describe("The entity type ID"),
      selectEntity: z.object({
        entityIdSelector: z.object({
          entityIds: z.array(z.string()).describe("Entity IDs to delete"),
        }),
      }).optional().describe("Select entities to delete by ID"),
      selectTimeRangeAndFeature: z.object({
        timeRange: z.object({
          startTime: z.string().describe("Start time (RFC 3339)"),
          endTime: z.string().describe("End time (RFC 3339)"),
        }),
        featureSelector: z.object({
          idMatcher: z.object({ ids: z.array(z.string()) }),
        }),
        skipOnlineStorageDelete: z.boolean().optional(),
      }).optional().describe("Select by time range and feature"),
    }),
    handler: async (args: { featurestoreId: string; entityTypeId: string; selectEntity?: Record<string, unknown>; selectTimeRangeAndFeature?: Record<string, unknown> }) => {
      return vertexRequest("POST", `/featurestores/${args.featurestoreId}/entityTypes/${args.entityTypeId}:deleteFeatureValues`, {
        ...(args.selectEntity && { selectEntity: args.selectEntity }),
        ...(args.selectTimeRangeAndFeature && { selectTimeRangeAndFeature: args.selectTimeRangeAndFeature }),
      });
    },
  },

  // ==================== Features ====================
  {
    name: "vertex_create_feature",
    description: "Create a new feature within a featurestore entity type.",
    inputSchema: z.object({
      featurestoreId: z.string().describe("The featurestore ID"),
      entityTypeId: z.string().describe("The entity type ID"),
      featureId: z.string().describe("The ID to use for the feature"),
      description: z.string().optional().describe("Description of the feature"),
      valueType: z.enum(["BOOL", "BOOL_ARRAY", "DOUBLE", "DOUBLE_ARRAY", "INT64", "INT64_ARRAY", "STRING", "STRING_ARRAY", "BYTES"]).describe("The type of feature value"),
      labels: z.record(z.string(), z.string()).optional().describe("Labels as key-value pairs"),
    }),
    handler: async (args: { featurestoreId: string; entityTypeId: string; featureId: string; description?: string; valueType: string; labels?: Record<string, string> }) => {
      return vertexRequest("POST", `/featurestores/${args.featurestoreId}/entityTypes/${args.entityTypeId}/features`, {
        valueType: args.valueType,
        ...(args.description && { description: args.description }),
        ...(args.labels && { labels: args.labels }),
      }, {
        featureId: args.featureId,
      });
    },
  },
  {
    name: "vertex_get_feature",
    description: "Get details of a specific feature within a featurestore entity type.",
    inputSchema: z.object({
      featurestoreId: z.string().describe("The featurestore ID"),
      entityTypeId: z.string().describe("The entity type ID"),
      featureId: z.string().describe("The feature ID"),
    }),
    handler: async (args: { featurestoreId: string; entityTypeId: string; featureId: string }) => {
      return vertexRequest("GET", `/featurestores/${args.featurestoreId}/entityTypes/${args.entityTypeId}/features/${args.featureId}`);
    },
  },
  {
    name: "vertex_list_features",
    description: "List all features in a featurestore entity type.",
    inputSchema: z.object({
      featurestoreId: z.string().describe("The featurestore ID"),
      entityTypeId: z.string().describe("The entity type ID"),
      filter: z.string().optional().describe("Filter expression"),
      pageSize: z.number().optional().describe("Maximum number of features to return"),
      pageToken: z.string().optional().describe("Page token for pagination"),
      orderBy: z.string().optional().describe("Field to order by"),
    }),
    handler: async (args: { featurestoreId: string; entityTypeId: string; filter?: string; pageSize?: number; pageToken?: string; orderBy?: string }) => {
      return vertexRequest("GET", `/featurestores/${args.featurestoreId}/entityTypes/${args.entityTypeId}/features`, undefined, {
        filter: args.filter,
        pageSize: args.pageSize,
        pageToken: args.pageToken,
        orderBy: args.orderBy,
      });
    },
  },
  {
    name: "vertex_delete_feature",
    description: "Delete a feature from a featurestore entity type.",
    inputSchema: z.object({
      featurestoreId: z.string().describe("The featurestore ID"),
      entityTypeId: z.string().describe("The entity type ID"),
      featureId: z.string().describe("The feature ID to delete"),
    }),
    handler: async (args: { featurestoreId: string; entityTypeId: string; featureId: string }) => {
      return vertexRequest("DELETE", `/featurestores/${args.featurestoreId}/entityTypes/${args.entityTypeId}/features/${args.featureId}`);
    },
  },
  {
    name: "vertex_update_feature",
    description: "Update a feature's metadata in a featurestore entity type.",
    inputSchema: z.object({
      featurestoreId: z.string().describe("The featurestore ID"),
      entityTypeId: z.string().describe("The entity type ID"),
      featureId: z.string().describe("The feature ID to update"),
      description: z.string().optional().describe("Updated description"),
      labels: z.record(z.string(), z.string()).optional().describe("Updated labels"),
      updateMask: z.string().describe("Comma-separated list of fields to update"),
    }),
    handler: async (args: { featurestoreId: string; entityTypeId: string; featureId: string; description?: string; labels?: Record<string, string>; updateMask: string }) => {
      return vertexRequest("PATCH", `/featurestores/${args.featurestoreId}/entityTypes/${args.entityTypeId}/features/${args.featureId}`, {
        ...(args.description && { description: args.description }),
        ...(args.labels && { labels: args.labels }),
      }, {
        updateMask: args.updateMask,
      });
    },
  },
  {
    name: "vertex_batch_create_features",
    description: "Batch create multiple features within a featurestore entity type in a single request.",
    inputSchema: z.object({
      featurestoreId: z.string().describe("The featurestore ID"),
      entityTypeId: z.string().describe("The entity type ID"),
      requests: z.array(z.object({
        featureId: z.string().describe("The feature ID"),
        feature: z.object({
          valueType: z.string().describe("The type of feature value"),
          description: z.string().optional().describe("Description of the feature"),
          labels: z.record(z.string(), z.string()).optional().describe("Labels"),
        }),
      })).describe("Array of feature creation requests"),
    }),
    handler: async (args: { featurestoreId: string; entityTypeId: string; requests: Record<string, unknown>[] }) => {
      return vertexRequest("POST", `/featurestores/${args.featurestoreId}/entityTypes/${args.entityTypeId}/features:batchCreate`, {
        requests: args.requests,
      });
    },
  },
];
