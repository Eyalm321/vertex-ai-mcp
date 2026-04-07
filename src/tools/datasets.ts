import { z } from "zod";
import { vertexRequest } from "../client.js";

export const datasetTools = [
  {
    name: "vertex_create_dataset",
    description: "Create a new Vertex AI dataset for training or batch prediction.",
    inputSchema: z.object({
      displayName: z.string().describe("Human-readable display name for the dataset"),
      metadataSchemaUri: z.string().describe("URI of the metadata schema (e.g. gs://google-cloud-aiplatform/schema/dataset/metadata/image_1.0.0.yaml)"),
      description: z.string().optional().describe("Description of the dataset"),
      labels: z.record(z.string(), z.string()).optional().describe("Labels as key-value pairs"),
    }),
    handler: async (args: { displayName: string; metadataSchemaUri: string; description?: string; labels?: Record<string, string> }) => {
      return vertexRequest("POST", "/datasets", {
        displayName: args.displayName,
        metadataSchemaUri: args.metadataSchemaUri,
        ...(args.description && { description: args.description }),
        ...(args.labels && { labels: args.labels }),
      });
    },
  },
  {
    name: "vertex_get_dataset",
    description: "Get details of a specific Vertex AI dataset by ID.",
    inputSchema: z.object({
      datasetId: z.string().describe("The dataset ID"),
    }),
    handler: async (args: { datasetId: string }) => {
      return vertexRequest("GET", `/datasets/${args.datasetId}`);
    },
  },
  {
    name: "vertex_list_datasets",
    description: "List all Vertex AI datasets in the current project and location.",
    inputSchema: z.object({
      filter: z.string().optional().describe("Filter expression (e.g. display_name=\"my-dataset\")"),
      pageSize: z.number().optional().describe("Maximum number of datasets to return"),
      pageToken: z.string().optional().describe("Page token for pagination"),
      orderBy: z.string().optional().describe("Field to order by (e.g. create_time desc)"),
    }),
    handler: async (args: { filter?: string; pageSize?: number; pageToken?: string; orderBy?: string }) => {
      return vertexRequest("GET", "/datasets", undefined, {
        filter: args.filter,
        pageSize: args.pageSize,
        pageToken: args.pageToken,
        orderBy: args.orderBy,
      });
    },
  },
  {
    name: "vertex_delete_dataset",
    description: "Delete a Vertex AI dataset by ID.",
    inputSchema: z.object({
      datasetId: z.string().describe("The dataset ID to delete"),
    }),
    handler: async (args: { datasetId: string }) => {
      return vertexRequest("DELETE", `/datasets/${args.datasetId}`);
    },
  },
  {
    name: "vertex_update_dataset",
    description: "Update a Vertex AI dataset's metadata.",
    inputSchema: z.object({
      datasetId: z.string().describe("The dataset ID to update"),
      displayName: z.string().optional().describe("Updated display name"),
      description: z.string().optional().describe("Updated description"),
      labels: z.record(z.string(), z.string()).optional().describe("Updated labels"),
      updateMask: z.string().describe("Comma-separated list of fields to update (e.g. displayName,description)"),
    }),
    handler: async (args: { datasetId: string; displayName?: string; description?: string; labels?: Record<string, string>; updateMask: string }) => {
      return vertexRequest("PATCH", `/datasets/${args.datasetId}`, {
        ...(args.displayName && { displayName: args.displayName }),
        ...(args.description && { description: args.description }),
        ...(args.labels && { labels: args.labels }),
      }, { updateMask: args.updateMask });
    },
  },
  {
    name: "vertex_import_data",
    description: "Import data into a Vertex AI dataset from a GCS source.",
    inputSchema: z.object({
      datasetId: z.string().describe("The dataset ID to import into"),
      importConfigs: z.array(z.record(z.string(), z.unknown())).describe("Import configuration with dataItemLabels, importSchemaUri, and gcsSource"),
    }),
    handler: async (args: { datasetId: string; importConfigs: Record<string, unknown>[] }) => {
      return vertexRequest("POST", `/datasets/${args.datasetId}:import`, {
        importConfigs: args.importConfigs,
      });
    },
  },
  {
    name: "vertex_export_data",
    description: "Export data from a Vertex AI dataset to a GCS destination.",
    inputSchema: z.object({
      datasetId: z.string().describe("The dataset ID to export from"),
      exportConfig: z.record(z.string(), z.unknown()).describe("Export configuration with gcsDestination and optional annotationsFilter"),
    }),
    handler: async (args: { datasetId: string; exportConfig: Record<string, unknown> }) => {
      return vertexRequest("POST", `/datasets/${args.datasetId}:export`, {
        exportConfig: args.exportConfig,
      });
    },
  },
  {
    name: "vertex_search_data_items",
    description: "Search for data items within a Vertex AI dataset.",
    inputSchema: z.object({
      datasetId: z.string().describe("The dataset ID to search within"),
      dataLabelingJob: z.string().optional().describe("Resource name of the data labeling job"),
      dataItemFilter: z.string().optional().describe("Expression to filter data items"),
      annotationsFilter: z.string().optional().describe("Expression to filter annotations"),
      pageSize: z.number().optional().describe("Maximum number of items to return"),
      pageToken: z.string().optional().describe("Page token for pagination"),
      orderBy: z.string().optional().describe("Field to order by"),
    }),
    handler: async (args: { datasetId: string; dataLabelingJob?: string; dataItemFilter?: string; annotationsFilter?: string; pageSize?: number; pageToken?: string; orderBy?: string }) => {
      return vertexRequest("POST", `/datasets/${args.datasetId}/dataItems:search`, {
        ...(args.dataLabelingJob && { dataLabelingJob: args.dataLabelingJob }),
        ...(args.dataItemFilter && { dataItemFilter: args.dataItemFilter }),
        ...(args.annotationsFilter && { annotationsFilter: args.annotationsFilter }),
        ...(args.pageSize && { pageSize: args.pageSize }),
        ...(args.pageToken && { pageToken: args.pageToken }),
        ...(args.orderBy && { orderBy: args.orderBy }),
      });
    },
  },
];
