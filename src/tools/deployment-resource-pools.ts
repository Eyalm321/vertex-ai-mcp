import { z } from "zod";
import { vertexRequest } from "../client.js";

export const deploymentResourcePoolTools = [
  {
    name: "vertex_create_deployment_resource_pool",
    description: "Create a new deployment resource pool for sharing resources across deployed models.",
    inputSchema: z.object({
      deploymentResourcePoolId: z.string().describe("The ID to use for the deployment resource pool"),
      displayName: z.string().describe("Human-readable display name for the pool"),
      dedicatedResources: z.object({
        machineSpec: z.object({
          machineType: z.string().describe("Machine type (e.g. n1-standard-4)"),
          acceleratorType: z.string().optional().describe("Accelerator type"),
          acceleratorCount: z.number().optional().describe("Number of accelerators"),
        }).describe("Machine specification"),
        minReplicaCount: z.number().describe("Minimum number of replicas"),
        maxReplicaCount: z.number().optional().describe("Maximum number of replicas"),
      }).optional().describe("Dedicated resources configuration for the pool"),
    }),
    handler: async (args: { deploymentResourcePoolId: string; displayName: string; dedicatedResources?: { machineSpec: { machineType: string; acceleratorType?: string; acceleratorCount?: number }; minReplicaCount: number; maxReplicaCount?: number } }) => {
      return vertexRequest("POST", "/deploymentResourcePools", {
        deploymentResourcePool: {
          displayName: args.displayName,
          ...(args.dedicatedResources && { dedicatedResources: args.dedicatedResources }),
        },
      }, { deploymentResourcePoolId: args.deploymentResourcePoolId });
    },
  },
  {
    name: "vertex_get_deployment_resource_pool",
    description: "Get details of a specific deployment resource pool by ID.",
    inputSchema: z.object({
      deploymentResourcePoolId: z.string().describe("The deployment resource pool ID"),
    }),
    handler: async (args: { deploymentResourcePoolId: string }) => {
      return vertexRequest("GET", `/deploymentResourcePools/${args.deploymentResourcePoolId}`);
    },
  },
  {
    name: "vertex_list_deployment_resource_pools",
    description: "List all deployment resource pools in the current project and location.",
    inputSchema: z.object({
      pageSize: z.number().optional().describe("Maximum number of pools to return"),
      pageToken: z.string().optional().describe("Page token for pagination"),
    }),
    handler: async (args: { pageSize?: number; pageToken?: string }) => {
      return vertexRequest("GET", "/deploymentResourcePools", undefined, {
        pageSize: args.pageSize,
        pageToken: args.pageToken,
      });
    },
  },
  {
    name: "vertex_delete_deployment_resource_pool",
    description: "Delete a deployment resource pool by ID.",
    inputSchema: z.object({
      deploymentResourcePoolId: z.string().describe("The deployment resource pool ID to delete"),
    }),
    handler: async (args: { deploymentResourcePoolId: string }) => {
      return vertexRequest("DELETE", `/deploymentResourcePools/${args.deploymentResourcePoolId}`);
    },
  },
  {
    name: "vertex_update_deployment_resource_pool",
    description: "Update a deployment resource pool's configuration.",
    inputSchema: z.object({
      deploymentResourcePoolId: z.string().describe("The deployment resource pool ID to update"),
      dedicatedResources: z.object({
        machineSpec: z.object({
          machineType: z.string().describe("Machine type (e.g. n1-standard-4)"),
          acceleratorType: z.string().optional().describe("Accelerator type"),
          acceleratorCount: z.number().optional().describe("Number of accelerators"),
        }).optional().describe("Machine specification"),
        minReplicaCount: z.number().optional().describe("Minimum number of replicas"),
        maxReplicaCount: z.number().optional().describe("Maximum number of replicas"),
      }).optional().describe("Updated dedicated resources configuration"),
      updateMask: z.string().describe("Comma-separated list of fields to update"),
    }),
    handler: async (args: { deploymentResourcePoolId: string; dedicatedResources?: Record<string, unknown>; updateMask: string }) => {
      return vertexRequest("PATCH", `/deploymentResourcePools/${args.deploymentResourcePoolId}`, {
        ...(args.dedicatedResources && { dedicatedResources: args.dedicatedResources }),
      }, { updateMask: args.updateMask });
    },
  },
  {
    name: "vertex_query_deployed_models",
    description: "Query the deployed models sharing a given deployment resource pool.",
    inputSchema: z.object({
      deploymentResourcePoolId: z.string().describe("The deployment resource pool ID to query"),
      pageSize: z.number().optional().describe("Maximum number of deployed models to return"),
      pageToken: z.string().optional().describe("Page token for pagination"),
    }),
    handler: async (args: { deploymentResourcePoolId: string; pageSize?: number; pageToken?: string }) => {
      return vertexRequest("GET", `/deploymentResourcePools/${args.deploymentResourcePoolId}:queryDeployedModels`, undefined, {
        pageSize: args.pageSize,
        pageToken: args.pageToken,
      });
    },
  },
];
