import { describe, it, expect } from "vitest";
import { datasetTools } from "../tools/datasets.js";
import { endpointTools } from "../tools/endpoints.js";
import { modelTools } from "../tools/models.js";
import { jobTools } from "../tools/jobs.js";
import { pipelineTools } from "../tools/pipelines.js";
import { indexTools } from "../tools/indexes.js";
import { featurestoreTools } from "../tools/featurestores.js";
import { featureOnlineStoreTools } from "../tools/feature-online-stores.js";
import { tensorboardTools } from "../tools/tensorboards.js";
import { metadataTools } from "../tools/metadata.js";
import { scheduleTools } from "../tools/schedules.js";
import { operationTools } from "../tools/operations.js";
import { deploymentResourcePoolTools } from "../tools/deployment-resource-pools.js";
import { tuningTools } from "../tools/tuning.js";
import { nasJobTools } from "../tools/nas-jobs.js";
import { specialistPoolTools } from "../tools/specialist-pools.js";

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
];

describe("Tool Registration", () => {
  it("has no duplicate tool names across all modules", () => {
    const names = allTools.map((t) => t.name);
    const duplicates = names.filter((name, i) => names.indexOf(name) !== i);
    expect(duplicates).toEqual([]);
  });

  it("all tools have required properties", () => {
    for (const tool of allTools) {
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.inputSchema).toBeDefined();
      expect(typeof tool.handler).toBe("function");
    }
  });

  it("all tool names follow vertex_ naming convention", () => {
    for (const tool of allTools) {
      expect(tool.name).toMatch(/^vertex_/);
    }
  });

  it("registers the expected total number of tools", () => {
    expect(allTools.length).toBeGreaterThanOrEqual(150);
  });

  it("each module exports a non-empty array", () => {
    const modules = [
      datasetTools,
      endpointTools,
      modelTools,
      jobTools,
      pipelineTools,
      indexTools,
      featurestoreTools,
      featureOnlineStoreTools,
      tensorboardTools,
      metadataTools,
      scheduleTools,
      operationTools,
      deploymentResourcePoolTools,
      tuningTools,
      nasJobTools,
      specialistPoolTools,
    ];
    for (const mod of modules) {
      expect(Array.isArray(mod)).toBe(true);
      expect(mod.length).toBeGreaterThan(0);
    }
  });

  it("all tool descriptions are meaningful (>10 chars)", () => {
    for (const tool of allTools) {
      expect(tool.description.length).toBeGreaterThan(10);
    }
  });

  it("all tool names are unique and use snake_case", () => {
    for (const tool of allTools) {
      expect(tool.name).toMatch(/^vertex_[a-z][a-z0-9_]*$/);
    }
  });
});
