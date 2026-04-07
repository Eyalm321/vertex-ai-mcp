import { z } from "zod";
import { vertexRequest } from "../client.js";

export const endpointTools = [
  {
    name: "vertex_create_endpoint",
    description: "Create a new Vertex AI endpoint for serving predictions.",
    inputSchema: z.object({
      displayName: z.string().describe("Human-readable display name for the endpoint"),
      description: z.string().optional().describe("Description of the endpoint"),
      labels: z.record(z.string(), z.string()).optional().describe("Labels as key-value pairs"),
      network: z.string().optional().describe("Full name of the Google Compute Engine network for peering"),
      encryptionSpec: z.object({
        kmsKeyName: z.string().describe("Cloud KMS resource identifier of the customer-managed encryption key"),
      }).optional().describe("Customer-managed encryption key spec"),
      dedicatedEndpointEnabled: z.boolean().optional().describe("Whether to enable dedicated endpoint"),
    }),
    handler: async (args: { displayName: string; description?: string; labels?: Record<string, string>; network?: string; encryptionSpec?: { kmsKeyName: string }; dedicatedEndpointEnabled?: boolean }) => {
      return vertexRequest("POST", "/endpoints", {
        displayName: args.displayName,
        ...(args.description && { description: args.description }),
        ...(args.labels && { labels: args.labels }),
        ...(args.network && { network: args.network }),
        ...(args.encryptionSpec && { encryptionSpec: args.encryptionSpec }),
        ...(args.dedicatedEndpointEnabled !== undefined && { dedicatedEndpointEnabled: args.dedicatedEndpointEnabled }),
      });
    },
  },
  {
    name: "vertex_get_endpoint",
    description: "Get details of a specific Vertex AI endpoint by ID.",
    inputSchema: z.object({
      endpointId: z.string().describe("The endpoint ID"),
    }),
    handler: async (args: { endpointId: string }) => {
      return vertexRequest("GET", `/endpoints/${args.endpointId}`);
    },
  },
  {
    name: "vertex_list_endpoints",
    description: "List all Vertex AI endpoints in the current project and location.",
    inputSchema: z.object({
      filter: z.string().optional().describe("Filter expression"),
      pageSize: z.number().optional().describe("Maximum number of endpoints to return"),
      pageToken: z.string().optional().describe("Page token for pagination"),
      orderBy: z.string().optional().describe("Field to order by"),
    }),
    handler: async (args: { filter?: string; pageSize?: number; pageToken?: string; orderBy?: string }) => {
      return vertexRequest("GET", "/endpoints", undefined, {
        filter: args.filter,
        pageSize: args.pageSize,
        pageToken: args.pageToken,
        orderBy: args.orderBy,
      });
    },
  },
  {
    name: "vertex_delete_endpoint",
    description: "Delete a Vertex AI endpoint by ID.",
    inputSchema: z.object({
      endpointId: z.string().describe("The endpoint ID to delete"),
    }),
    handler: async (args: { endpointId: string }) => {
      return vertexRequest("DELETE", `/endpoints/${args.endpointId}`);
    },
  },
  {
    name: "vertex_update_endpoint",
    description: "Update a Vertex AI endpoint's metadata.",
    inputSchema: z.object({
      endpointId: z.string().describe("The endpoint ID to update"),
      displayName: z.string().optional().describe("Updated display name"),
      description: z.string().optional().describe("Updated description"),
      labels: z.record(z.string(), z.string()).optional().describe("Updated labels"),
      trafficSplit: z.record(z.string(), z.number()).optional().describe("Traffic split map from deployed model ID to percentage"),
      updateMask: z.string().describe("Comma-separated list of fields to update"),
    }),
    handler: async (args: { endpointId: string; displayName?: string; description?: string; labels?: Record<string, string>; trafficSplit?: Record<string, number>; updateMask: string }) => {
      return vertexRequest("PATCH", `/endpoints/${args.endpointId}`, {
        ...(args.displayName && { displayName: args.displayName }),
        ...(args.description && { description: args.description }),
        ...(args.labels && { labels: args.labels }),
        ...(args.trafficSplit && { trafficSplit: args.trafficSplit }),
      }, { updateMask: args.updateMask });
    },
  },
  {
    name: "vertex_deploy_model",
    description: "Deploy a model to a Vertex AI endpoint.",
    inputSchema: z.object({
      endpointId: z.string().describe("The endpoint ID to deploy the model to"),
      deployedModel: z.object({
        model: z.string().describe("Resource name of the model to deploy"),
        displayName: z.string().optional().describe("Display name for the deployed model"),
        dedicatedResources: z.object({
          machineSpec: z.object({
            machineType: z.string().describe("Machine type (e.g. n1-standard-4)"),
            acceleratorType: z.string().optional().describe("Accelerator type"),
            acceleratorCount: z.number().optional().describe("Number of accelerators"),
          }),
          minReplicaCount: z.number().describe("Minimum number of replicas"),
          maxReplicaCount: z.number().optional().describe("Maximum number of replicas"),
        }).optional().describe("Dedicated resources configuration"),
        automaticResources: z.object({
          minReplicaCount: z.number().optional().describe("Minimum number of replicas"),
          maxReplicaCount: z.number().optional().describe("Maximum number of replicas"),
        }).optional().describe("Automatic resources configuration"),
      }).describe("The deployed model configuration"),
      trafficSplit: z.record(z.string(), z.number()).optional().describe("Traffic split map from deployed model ID to percentage"),
    }),
    handler: async (args: { endpointId: string; deployedModel: Record<string, unknown>; trafficSplit?: Record<string, number> }) => {
      return vertexRequest("POST", `/endpoints/${args.endpointId}:deployModel`, {
        deployedModel: args.deployedModel,
        ...(args.trafficSplit && { trafficSplit: args.trafficSplit }),
      });
    },
  },
  {
    name: "vertex_undeploy_model",
    description: "Undeploy a model from a Vertex AI endpoint.",
    inputSchema: z.object({
      endpointId: z.string().describe("The endpoint ID"),
      deployedModelId: z.string().describe("The deployed model ID to undeploy"),
      trafficSplit: z.record(z.string(), z.number()).optional().describe("Updated traffic split after undeployment"),
    }),
    handler: async (args: { endpointId: string; deployedModelId: string; trafficSplit?: Record<string, number> }) => {
      return vertexRequest("POST", `/endpoints/${args.endpointId}:undeployModel`, {
        deployedModelId: args.deployedModelId,
        ...(args.trafficSplit && { trafficSplit: args.trafficSplit }),
      });
    },
  },
  {
    name: "vertex_mutate_deployed_model",
    description: "Update a deployed model on a Vertex AI endpoint without redeploying.",
    inputSchema: z.object({
      endpointId: z.string().describe("The endpoint ID"),
      deployedModel: z.record(z.string(), z.unknown()).describe("The deployed model fields to update"),
      updateMask: z.string().describe("Comma-separated list of fields to update"),
    }),
    handler: async (args: { endpointId: string; deployedModel: Record<string, unknown>; updateMask: string }) => {
      return vertexRequest("POST", `/endpoints/${args.endpointId}:mutateDeployedModel`, {
        deployedModel: args.deployedModel,
        updateMask: args.updateMask,
      });
    },
  },
  {
    name: "vertex_predict",
    description: "Make a prediction using a deployed model on a Vertex AI endpoint.",
    inputSchema: z.object({
      endpointId: z.string().describe("The endpoint ID"),
      instances: z.array(z.unknown()).describe("Prediction instances to send to the model"),
      parameters: z.record(z.string(), z.unknown()).optional().describe("Optional prediction parameters"),
    }),
    handler: async (args: { endpointId: string; instances: unknown[]; parameters?: Record<string, unknown> }) => {
      return vertexRequest("POST", `/endpoints/${args.endpointId}:predict`, {
        instances: args.instances,
        ...(args.parameters && { parameters: args.parameters }),
      });
    },
  },
  {
    name: "vertex_raw_predict",
    description: "Make a raw prediction request to a Vertex AI endpoint with an arbitrary HTTP body.",
    inputSchema: z.object({
      endpointId: z.string().describe("The endpoint ID"),
      httpBody: z.record(z.string(), z.unknown()).describe("The raw HTTP body to send"),
    }),
    handler: async (args: { endpointId: string; httpBody: Record<string, unknown> }) => {
      return vertexRequest("POST", `/endpoints/${args.endpointId}:rawPredict`, args.httpBody);
    },
  },
  {
    name: "vertex_explain",
    description: "Get predictions with feature attributions (explanations) from a Vertex AI endpoint.",
    inputSchema: z.object({
      endpointId: z.string().describe("The endpoint ID"),
      instances: z.array(z.unknown()).describe("Instances to explain"),
      parameters: z.record(z.string(), z.unknown()).optional().describe("Optional parameters"),
      deployedModelId: z.string().optional().describe("Specific deployed model ID to target"),
    }),
    handler: async (args: { endpointId: string; instances: unknown[]; parameters?: Record<string, unknown>; deployedModelId?: string }) => {
      return vertexRequest("POST", `/endpoints/${args.endpointId}:explain`, {
        instances: args.instances,
        ...(args.parameters && { parameters: args.parameters }),
        ...(args.deployedModelId && { deployedModelId: args.deployedModelId }),
      });
    },
  },
  {
    name: "vertex_server_streaming_predict",
    description: "Make a server-streaming prediction request to a Vertex AI endpoint.",
    inputSchema: z.object({
      endpointId: z.string().describe("The endpoint ID"),
      inputs: z.array(z.unknown()).describe("Input instances for streaming prediction"),
      parameters: z.record(z.string(), z.unknown()).optional().describe("Optional parameters"),
    }),
    handler: async (args: { endpointId: string; inputs: unknown[]; parameters?: Record<string, unknown> }) => {
      return vertexRequest("POST", `/endpoints/${args.endpointId}:serverStreamingPredict`, {
        inputs: args.inputs,
        ...(args.parameters && { parameters: args.parameters }),
      });
    },
  },
];
