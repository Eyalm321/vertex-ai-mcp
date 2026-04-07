#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { datasetTools } from "./tools/datasets.js";
import { endpointTools } from "./tools/endpoints.js";
import { modelTools } from "./tools/models.js";
import { jobTools } from "./tools/jobs.js";
import { pipelineTools } from "./tools/pipelines.js";
import { indexTools } from "./tools/indexes.js";
import { featurestoreTools } from "./tools/featurestores.js";
import { featureOnlineStoreTools } from "./tools/feature-online-stores.js";
import { tensorboardTools } from "./tools/tensorboards.js";
import { metadataTools } from "./tools/metadata.js";
import { scheduleTools } from "./tools/schedules.js";
import { operationTools } from "./tools/operations.js";
import { deploymentResourcePoolTools } from "./tools/deployment-resource-pools.js";
import { tuningTools } from "./tools/tuning.js";
import { nasJobTools } from "./tools/nas-jobs.js";
import { specialistPoolTools } from "./tools/specialist-pools.js";
import { generativeAiTools } from "./tools/generative-ai.js";

const server = new McpServer({
  name: "vertex-ai-mcp",
  version: "1.1.0",
});

const allTools = [
  ...datasetTools,
  ...endpointTools,
  ...modelTools,
  ...jobTools,
  ...pipelineTools,
  ...indexTools,
  ...featurestoreTools,
  ...featureOnlineStoreTools,
  ...tensorboardTools,
  ...metadataTools,
  ...scheduleTools,
  ...operationTools,
  ...deploymentResourcePoolTools,
  ...tuningTools,
  ...nasJobTools,
  ...specialistPoolTools,
  ...generativeAiTools,
];

for (const tool of allTools) {
  server.tool(
    tool.name,
    tool.description,
    tool.inputSchema.shape as any,
    async (args: any) => {
      try {
        const result = await tool.handler(args as any);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text" as const, text: `Error: ${message}` }],
          isError: true,
        };
      }
    }
  );
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Vertex AI MCP server running");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
