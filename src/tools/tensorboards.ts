import { z } from "zod";
import { vertexRequest } from "../client.js";

export const tensorboardTools = [
  // ==================== Tensorboards ====================
  {
    name: "vertex_create_tensorboard",
    description: "Create a new Vertex AI Tensorboard instance for experiment tracking and visualization.",
    inputSchema: z.object({
      displayName: z.string().describe("Human-readable display name for the tensorboard"),
      description: z.string().optional().describe("Description of the tensorboard"),
      labels: z.record(z.string(), z.string()).optional().describe("Labels as key-value pairs"),
      encryptionSpec: z.object({
        kmsKeyName: z.string().describe("Cloud KMS resource identifier"),
      }).optional().describe("Customer-managed encryption key spec"),
    }),
    handler: async (args: { displayName: string; description?: string; labels?: Record<string, string>; encryptionSpec?: { kmsKeyName: string } }) => {
      return vertexRequest("POST", "/tensorboards", {
        displayName: args.displayName,
        ...(args.description && { description: args.description }),
        ...(args.labels && { labels: args.labels }),
        ...(args.encryptionSpec && { encryptionSpec: args.encryptionSpec }),
      });
    },
  },
  {
    name: "vertex_get_tensorboard",
    description: "Get details of a specific Vertex AI Tensorboard by ID.",
    inputSchema: z.object({
      tensorboardId: z.string().describe("The tensorboard ID"),
    }),
    handler: async (args: { tensorboardId: string }) => {
      return vertexRequest("GET", `/tensorboards/${args.tensorboardId}`);
    },
  },
  {
    name: "vertex_list_tensorboards",
    description: "List all Vertex AI Tensorboards in the current project and location.",
    inputSchema: z.object({
      filter: z.string().optional().describe("Filter expression"),
      pageSize: z.number().optional().describe("Maximum number of tensorboards to return"),
      pageToken: z.string().optional().describe("Page token for pagination"),
      orderBy: z.string().optional().describe("Field to order by"),
    }),
    handler: async (args: { filter?: string; pageSize?: number; pageToken?: string; orderBy?: string }) => {
      return vertexRequest("GET", "/tensorboards", undefined, {
        filter: args.filter,
        pageSize: args.pageSize,
        pageToken: args.pageToken,
        orderBy: args.orderBy,
      });
    },
  },
  {
    name: "vertex_delete_tensorboard",
    description: "Delete a Vertex AI Tensorboard by ID.",
    inputSchema: z.object({
      tensorboardId: z.string().describe("The tensorboard ID to delete"),
    }),
    handler: async (args: { tensorboardId: string }) => {
      return vertexRequest("DELETE", `/tensorboards/${args.tensorboardId}`);
    },
  },
  {
    name: "vertex_update_tensorboard",
    description: "Update a Vertex AI Tensorboard's metadata.",
    inputSchema: z.object({
      tensorboardId: z.string().describe("The tensorboard ID to update"),
      displayName: z.string().optional().describe("Updated display name"),
      description: z.string().optional().describe("Updated description"),
      labels: z.record(z.string(), z.string()).optional().describe("Updated labels"),
      updateMask: z.string().describe("Comma-separated list of fields to update"),
    }),
    handler: async (args: { tensorboardId: string; displayName?: string; description?: string; labels?: Record<string, string>; updateMask: string }) => {
      return vertexRequest("PATCH", `/tensorboards/${args.tensorboardId}`, {
        ...(args.displayName && { displayName: args.displayName }),
        ...(args.description && { description: args.description }),
        ...(args.labels && { labels: args.labels }),
      }, {
        updateMask: args.updateMask,
      });
    },
  },
  {
    name: "vertex_read_tensorboard_size",
    description: "Read the storage size of a Vertex AI Tensorboard.",
    inputSchema: z.object({
      tensorboardId: z.string().describe("The tensorboard ID"),
    }),
    handler: async (args: { tensorboardId: string }) => {
      return vertexRequest("GET", `/tensorboards/${args.tensorboardId}:readSize`);
    },
  },
  {
    name: "vertex_read_tensorboard_usage",
    description: "Read the usage statistics of a Vertex AI Tensorboard.",
    inputSchema: z.object({
      tensorboardId: z.string().describe("The tensorboard ID"),
    }),
    handler: async (args: { tensorboardId: string }) => {
      return vertexRequest("GET", `/tensorboards/${args.tensorboardId}:readUsage`);
    },
  },
  {
    name: "vertex_batch_read_tensorboard_time_series_data",
    description: "Batch read data from multiple tensorboard time series at once.",
    inputSchema: z.object({
      tensorboardId: z.string().describe("The tensorboard ID"),
      timeSeries: z.array(z.string()).describe("Full resource names of time series to read"),
    }),
    handler: async (args: { tensorboardId: string; timeSeries: string[] }) => {
      return vertexRequest("GET", `/tensorboards/${args.tensorboardId}:batchRead`, undefined, {
        timeSeries: args.timeSeries.join(","),
      });
    },
  },

  // ==================== Tensorboard Experiments ====================
  {
    name: "vertex_create_tensorboard_experiment",
    description: "Create a new experiment within a Vertex AI Tensorboard.",
    inputSchema: z.object({
      tensorboardId: z.string().describe("The tensorboard ID"),
      experimentId: z.string().describe("The ID to use for the experiment"),
      displayName: z.string().optional().describe("Human-readable display name"),
      description: z.string().optional().describe("Description of the experiment"),
      labels: z.record(z.string(), z.string()).optional().describe("Labels as key-value pairs"),
    }),
    handler: async (args: { tensorboardId: string; experimentId: string; displayName?: string; description?: string; labels?: Record<string, string> }) => {
      return vertexRequest("POST", `/tensorboards/${args.tensorboardId}/experiments`, {
        ...(args.displayName && { displayName: args.displayName }),
        ...(args.description && { description: args.description }),
        ...(args.labels && { labels: args.labels }),
      }, {
        tensorboardExperimentId: args.experimentId,
      });
    },
  },
  {
    name: "vertex_get_tensorboard_experiment",
    description: "Get details of a specific tensorboard experiment.",
    inputSchema: z.object({
      tensorboardId: z.string().describe("The tensorboard ID"),
      experimentId: z.string().describe("The experiment ID"),
    }),
    handler: async (args: { tensorboardId: string; experimentId: string }) => {
      return vertexRequest("GET", `/tensorboards/${args.tensorboardId}/experiments/${args.experimentId}`);
    },
  },
  {
    name: "vertex_list_tensorboard_experiments",
    description: "List all experiments in a Vertex AI Tensorboard.",
    inputSchema: z.object({
      tensorboardId: z.string().describe("The tensorboard ID"),
      filter: z.string().optional().describe("Filter expression"),
      pageSize: z.number().optional().describe("Maximum number of experiments to return"),
      pageToken: z.string().optional().describe("Page token for pagination"),
      orderBy: z.string().optional().describe("Field to order by"),
    }),
    handler: async (args: { tensorboardId: string; filter?: string; pageSize?: number; pageToken?: string; orderBy?: string }) => {
      return vertexRequest("GET", `/tensorboards/${args.tensorboardId}/experiments`, undefined, {
        filter: args.filter,
        pageSize: args.pageSize,
        pageToken: args.pageToken,
        orderBy: args.orderBy,
      });
    },
  },
  {
    name: "vertex_delete_tensorboard_experiment",
    description: "Delete a tensorboard experiment.",
    inputSchema: z.object({
      tensorboardId: z.string().describe("The tensorboard ID"),
      experimentId: z.string().describe("The experiment ID to delete"),
    }),
    handler: async (args: { tensorboardId: string; experimentId: string }) => {
      return vertexRequest("DELETE", `/tensorboards/${args.tensorboardId}/experiments/${args.experimentId}`);
    },
  },
  {
    name: "vertex_write_tensorboard_experiment_data",
    description: "Write data to multiple runs within a tensorboard experiment in a single call.",
    inputSchema: z.object({
      tensorboardId: z.string().describe("The tensorboard ID"),
      experimentId: z.string().describe("The experiment ID"),
      writeRunDataRequests: z.array(z.object({
        tensorboardRun: z.string().describe("Full resource name of the tensorboard run"),
        timeSeriesData: z.array(z.object({
          tensorboardTimeSeriesId: z.string().describe("Time series ID"),
          valueType: z.string().describe("Value type: SCALAR, TENSOR, or BLOB_SEQUENCE"),
          values: z.array(z.object({
            step: z.number().describe("Step value"),
            wallTime: z.string().describe("Wall clock timestamp (RFC 3339)"),
            scalar: z.object({ value: z.number() }).optional(),
            tensor: z.object({ value: z.string() }).optional(),
            blobs: z.object({ values: z.array(z.object({ id: z.string().optional(), data: z.string().optional() })) }).optional(),
          })).describe("Data points to write"),
        })).describe("Time series data to write"),
      })).describe("Array of write requests for different runs"),
    }),
    handler: async (args: { tensorboardId: string; experimentId: string; writeRunDataRequests: Record<string, unknown>[] }) => {
      return vertexRequest("POST", `/tensorboards/${args.tensorboardId}/experiments/${args.experimentId}:write`, {
        writeRunDataRequests: args.writeRunDataRequests,
      });
    },
  },

  // ==================== Tensorboard Runs ====================
  {
    name: "vertex_create_tensorboard_run",
    description: "Create a new run within a tensorboard experiment.",
    inputSchema: z.object({
      tensorboardId: z.string().describe("The tensorboard ID"),
      experimentId: z.string().describe("The experiment ID"),
      runId: z.string().describe("The ID to use for the run"),
      displayName: z.string().optional().describe("Human-readable display name"),
      description: z.string().optional().describe("Description of the run"),
      labels: z.record(z.string(), z.string()).optional().describe("Labels as key-value pairs"),
    }),
    handler: async (args: { tensorboardId: string; experimentId: string; runId: string; displayName?: string; description?: string; labels?: Record<string, string> }) => {
      return vertexRequest("POST", `/tensorboards/${args.tensorboardId}/experiments/${args.experimentId}/runs`, {
        ...(args.displayName && { displayName: args.displayName }),
        ...(args.description && { description: args.description }),
        ...(args.labels && { labels: args.labels }),
      }, {
        tensorboardRunId: args.runId,
      });
    },
  },
  {
    name: "vertex_get_tensorboard_run",
    description: "Get details of a specific tensorboard run.",
    inputSchema: z.object({
      tensorboardId: z.string().describe("The tensorboard ID"),
      experimentId: z.string().describe("The experiment ID"),
      runId: z.string().describe("The run ID"),
    }),
    handler: async (args: { tensorboardId: string; experimentId: string; runId: string }) => {
      return vertexRequest("GET", `/tensorboards/${args.tensorboardId}/experiments/${args.experimentId}/runs/${args.runId}`);
    },
  },
  {
    name: "vertex_list_tensorboard_runs",
    description: "List all runs in a tensorboard experiment.",
    inputSchema: z.object({
      tensorboardId: z.string().describe("The tensorboard ID"),
      experimentId: z.string().describe("The experiment ID"),
      filter: z.string().optional().describe("Filter expression"),
      pageSize: z.number().optional().describe("Maximum number of runs to return"),
      pageToken: z.string().optional().describe("Page token for pagination"),
      orderBy: z.string().optional().describe("Field to order by"),
    }),
    handler: async (args: { tensorboardId: string; experimentId: string; filter?: string; pageSize?: number; pageToken?: string; orderBy?: string }) => {
      return vertexRequest("GET", `/tensorboards/${args.tensorboardId}/experiments/${args.experimentId}/runs`, undefined, {
        filter: args.filter,
        pageSize: args.pageSize,
        pageToken: args.pageToken,
        orderBy: args.orderBy,
      });
    },
  },
  {
    name: "vertex_delete_tensorboard_run",
    description: "Delete a tensorboard run.",
    inputSchema: z.object({
      tensorboardId: z.string().describe("The tensorboard ID"),
      experimentId: z.string().describe("The experiment ID"),
      runId: z.string().describe("The run ID to delete"),
    }),
    handler: async (args: { tensorboardId: string; experimentId: string; runId: string }) => {
      return vertexRequest("DELETE", `/tensorboards/${args.tensorboardId}/experiments/${args.experimentId}/runs/${args.runId}`);
    },
  },
  {
    name: "vertex_write_tensorboard_run_data",
    description: "Write time series data to a specific tensorboard run.",
    inputSchema: z.object({
      tensorboardId: z.string().describe("The tensorboard ID"),
      experimentId: z.string().describe("The experiment ID"),
      runId: z.string().describe("The run ID"),
      timeSeriesData: z.array(z.object({
        tensorboardTimeSeriesId: z.string().describe("Time series ID"),
        valueType: z.string().describe("Value type: SCALAR, TENSOR, or BLOB_SEQUENCE"),
        values: z.array(z.object({
          step: z.number().describe("Step value"),
          wallTime: z.string().describe("Wall clock timestamp (RFC 3339)"),
          scalar: z.object({ value: z.number() }).optional(),
          tensor: z.object({ value: z.string() }).optional(),
          blobs: z.object({ values: z.array(z.object({ id: z.string().optional(), data: z.string().optional() })) }).optional(),
        })).describe("Data points to write"),
      })).describe("Time series data to write to the run"),
    }),
    handler: async (args: { tensorboardId: string; experimentId: string; runId: string; timeSeriesData: Record<string, unknown>[] }) => {
      return vertexRequest("POST", `/tensorboards/${args.tensorboardId}/experiments/${args.experimentId}/runs/${args.runId}:write`, {
        timeSeriesData: args.timeSeriesData,
      });
    },
  },

  // ==================== Tensorboard Time Series ====================
  {
    name: "vertex_create_tensorboard_time_series",
    description: "Create a new time series within a tensorboard run for tracking a specific metric.",
    inputSchema: z.object({
      tensorboardId: z.string().describe("The tensorboard ID"),
      experimentId: z.string().describe("The experiment ID"),
      runId: z.string().describe("The run ID"),
      displayName: z.string().describe("Human-readable display name for the time series"),
      description: z.string().optional().describe("Description of the time series"),
      valueType: z.enum(["SCALAR", "TENSOR", "BLOB_SEQUENCE"]).describe("The type of values in this time series"),
      pluginName: z.string().optional().describe("Plugin name (e.g. 'scalars', 'images', 'histograms')"),
    }),
    handler: async (args: { tensorboardId: string; experimentId: string; runId: string; displayName: string; description?: string; valueType: string; pluginName?: string }) => {
      return vertexRequest("POST", `/tensorboards/${args.tensorboardId}/experiments/${args.experimentId}/runs/${args.runId}/timeSeries`, {
        displayName: args.displayName,
        valueType: args.valueType,
        ...(args.description && { description: args.description }),
        ...(args.pluginName && { pluginName: args.pluginName, pluginData: {} }),
      });
    },
  },
  {
    name: "vertex_get_tensorboard_time_series",
    description: "Get details of a specific tensorboard time series.",
    inputSchema: z.object({
      tensorboardId: z.string().describe("The tensorboard ID"),
      experimentId: z.string().describe("The experiment ID"),
      runId: z.string().describe("The run ID"),
      timeSeriesId: z.string().describe("The time series ID"),
    }),
    handler: async (args: { tensorboardId: string; experimentId: string; runId: string; timeSeriesId: string }) => {
      return vertexRequest("GET", `/tensorboards/${args.tensorboardId}/experiments/${args.experimentId}/runs/${args.runId}/timeSeries/${args.timeSeriesId}`);
    },
  },
  {
    name: "vertex_list_tensorboard_time_series",
    description: "List all time series in a tensorboard run.",
    inputSchema: z.object({
      tensorboardId: z.string().describe("The tensorboard ID"),
      experimentId: z.string().describe("The experiment ID"),
      runId: z.string().describe("The run ID"),
      filter: z.string().optional().describe("Filter expression"),
      pageSize: z.number().optional().describe("Maximum number of time series to return"),
      pageToken: z.string().optional().describe("Page token for pagination"),
      orderBy: z.string().optional().describe("Field to order by"),
    }),
    handler: async (args: { tensorboardId: string; experimentId: string; runId: string; filter?: string; pageSize?: number; pageToken?: string; orderBy?: string }) => {
      return vertexRequest("GET", `/tensorboards/${args.tensorboardId}/experiments/${args.experimentId}/runs/${args.runId}/timeSeries`, undefined, {
        filter: args.filter,
        pageSize: args.pageSize,
        pageToken: args.pageToken,
        orderBy: args.orderBy,
      });
    },
  },
  {
    name: "vertex_delete_tensorboard_time_series",
    description: "Delete a tensorboard time series.",
    inputSchema: z.object({
      tensorboardId: z.string().describe("The tensorboard ID"),
      experimentId: z.string().describe("The experiment ID"),
      runId: z.string().describe("The run ID"),
      timeSeriesId: z.string().describe("The time series ID to delete"),
    }),
    handler: async (args: { tensorboardId: string; experimentId: string; runId: string; timeSeriesId: string }) => {
      return vertexRequest("DELETE", `/tensorboards/${args.tensorboardId}/experiments/${args.experimentId}/runs/${args.runId}/timeSeries/${args.timeSeriesId}`);
    },
  },
  {
    name: "vertex_read_tensorboard_time_series_data",
    description: "Read data points from a specific tensorboard time series.",
    inputSchema: z.object({
      tensorboardId: z.string().describe("The tensorboard ID"),
      experimentId: z.string().describe("The experiment ID"),
      runId: z.string().describe("The run ID"),
      timeSeriesId: z.string().describe("The time series ID"),
      filter: z.string().optional().describe("Filter expression for data points"),
      maxDataPoints: z.number().optional().describe("Maximum number of data points to return"),
    }),
    handler: async (args: { tensorboardId: string; experimentId: string; runId: string; timeSeriesId: string; filter?: string; maxDataPoints?: number }) => {
      return vertexRequest("GET", `/tensorboards/${args.tensorboardId}/experiments/${args.experimentId}/runs/${args.runId}/timeSeries/${args.timeSeriesId}:read`, undefined, {
        filter: args.filter,
        maxDataPoints: args.maxDataPoints,
      });
    },
  },
];
