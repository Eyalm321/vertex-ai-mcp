# vertex-ai-mcp

MCP server for **Google Vertex AI** with **197 tools** covering Imagen image generation, Gemini text generation, embeddings, datasets, endpoints, models, indexes, featurestores, pipelines, tensorboards, metadata, and more.

## Installation

### Using npx (recommended)

```json
{
  "mcpServers": {
    "vertex-ai": {
      "command": "npx",
      "args": ["-y", "vertex-ai-mcp"],
      "env": {
        "GOOGLE_PROJECT_ID": "your-project-id",
        "GOOGLE_LOCATION": "us-central1"
      }
    }
  }
}
```

### Local installation

```bash
npm install -g vertex-ai-mcp
```

## Authentication

**Recommended: Service account key file** (required for all features including model discovery):

1. Go to **GCP Console → IAM → Service Accounts**
2. Create a service account with the **Vertex AI User** role
3. Download the JSON key file
4. Set the env var:

```bash
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"
```

Or in your MCP config:

```json
{
  "mcpServers": {
    "vertex-ai": {
      "command": "npx",
      "args": ["-y", "vertex-ai-mcp"],
      "env": {
        "GOOGLE_PROJECT_ID": "your-project-id",
        "GOOGLE_APPLICATION_CREDENTIALS": "/path/to/service-account-key.json"
      }
    }
  }
}
```

**Alternative methods** (work for project-scoped endpoints but NOT model discovery):
- `gcloud auth application-default login` — works for most tools but not `vertex_list_publisher_models` / `vertex_get_publisher_model`
- **Automatic** on GCE, Cloud Run, GKE (metadata server)

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GOOGLE_PROJECT_ID` | Yes | - | Your Google Cloud project ID |
| `GOOGLE_LOCATION` | No | `us-central1` | Vertex AI region |
| `VERTEX_AI_MCP_IMAGE_OUTPUT_DIR` | No | cwd / tempdir | Directory to save generated images |
| `VERTEX_AI_MCP_RETURN_BASE64` | No | `false` | If `true`, return raw base64 instead of saving to disk |

## Image Generation: Auto-Save to Disk

By default, `vertex_generate_image`, `vertex_edit_image`, `vertex_upscale_image`, and `vertex_generate_content` (with image-gen models like `gemini-3-pro-image-preview`) **save generated images to disk and return file paths** instead of inline base64. This avoids blowing up the agent's context with multi-megabyte blobs.

### Response shape

**Before** (base64 inline):
```json
{
  "predictions": [
    { "bytesBase64Encoded": "iVBORw0KGgo...(2MB)...", "mimeType": "image/png" }
  ]
}
```

**After** (file path):
```json
{
  "predictions": [
    {
      "filePath": "/path/to/outputs/vertex_generate_image-1777025157775-0.png",
      "mimeType": "image/png",
      "size": 1069885
    }
  ]
}
```

For Gemini image generation, text parts are preserved alongside the file reference:
```json
{
  "candidates": [
    {
      "content": {
        "parts": [
          { "text": "Here is the reference sheet..." },
          {
            "inlineData": {
              "filePath": "/path/to/outputs/vertex_generate_content-1777025436909-0.png",
              "mimeType": "image/png",
              "size": 1149149
            }
          }
        ]
      }
    }
  ]
}
```

### Custom output paths

Pass `saveToPath` to control the exact output location:
- Absolute path → used as-is
- Relative path → resolved against the output dir
- Existing directory → auto-filename is appended

### Opt out

Set `VERTEX_AI_MCP_RETURN_BASE64=true` for legacy behavior (inline base64).

## Async Mode (work around Claude Code's 60s tool timeout)

Claude Code has a hardcoded 60-second timeout for MCP tool calls that can't be configured. Nano Banana Pro at 2K/4K and Imagen Ultra can easily exceed this. Pass `async: true` to any of `vertex_generate_content`, `vertex_generate_image`, `vertex_edit_image`, `vertex_upscale_image` to return a `jobId` immediately — the generation keeps running server-side — then poll with `vertex_get_job`.

### Workflow

```
// 1. Submit
result = vertex_generate_content(
  model: "gemini-3-pro-image-preview",
  prompt: "...",
  imageSize: "4K",
  async: true
)
// → { jobId: "abc123...", status: "pending", submittedAt: "2026-04-24T11:15:00Z", pollWith: "vertex_get_job" }

// 2. Poll loop
loop:
  job = vertex_get_job(jobId: "abc123...")
  if job.status == "completed":
    path = job.result.candidates[0].content.parts[-1].inlineData.filePath
    break
  if job.status == "failed":
    handle(job.error)  // { code: "API_ERROR", message: "..." }
    break
  wait(5s)
```

### Status values
- `pending` — submitted but not yet started (negligible window)
- `running` — API call in flight
- `completed` — `result` populated with same shape as the sync call
- `failed` — `error: { code, message }` populated

### Operational details
- Completed jobs kept for **1 hour**.
- Running jobs auto-fail after **15 min** (hard timeout).
- Store capped at 100 jobs; oldest evicted first.
- Use `vertex_list_jobs` (optional `{ limit, status }`) for observability.

## Image Resolution (`imageSize`)

`vertex_generate_image` and `vertex_generate_content` accept an optional `imageSize` parameter: `"1K"`, `"2K"`, or `"4K"`. Omit for the model's default.

| Model | 1K | 2K | 4K | Parameter sent |
|---|---|---|---|---|
| `gemini-3-pro-image-preview` (Nano Banana Pro) | ✅ | ✅ | ✅ | `generationConfig.imageConfig.imageSize` |
| `gemini-3.1-flash-image-preview` (Nano Banana 2) | ✅ | ✅ | ✅ | `generationConfig.imageConfig.imageSize` |
| `gemini-2.5-flash-image` (original Nano Banana) | ✅ | ❌ | ❌ | (1K native only — field dropped) |
| `imagen-4.0-generate-001` | ✅ | ✅ | ❌ | `parameters.sampleImageSize` |
| `imagen-4.0-fast-generate-001` | ✅ | ✅ | ❌ | `parameters.sampleImageSize` |
| `imagen-4.0-ultra-generate-001` | ✅ | ✅ | ❌ | `parameters.sampleImageSize` |

**Fallback behavior** — unsupported sizes are silently downgraded with a `warnings` field in the response:
- Imagen 4 + `4K` → downgrades to `2K`
- `gemini-2.5-flash-image` + `2K`/`4K` → field dropped, generates at native 1K

**Known upstream bug**: `gemini-3.1-flash-image-preview` sometimes silently ignores `imageSize` and returns 1K regardless ([js-genai#1461](https://github.com/googleapis/js-genai/issues/1461)). This is on Google's side.

## Model-Aware Timeouts

Image generation (especially Nano Banana Pro on `gemini-3-pro-image-preview`) can take 1-3 minutes. The MCP server picks a timeout based on the model name:

| Model pattern | Timeout |
|---------------|---------|
| `veo-*` | 600s |
| `gemini-3-*-image*` (Nano Banana Pro) | 300s |
| `gemini-*-flash-image*` (Nano Banana Flash) | 180s |
| `gemini-*image*` (other Gemini image-gen) | 300s |
| `imagen-*-ultra-*` | 180s |
| `imagen-*` | 120s |
| all other Gemini models | 60s |

Override per-call with the `timeout` parameter (seconds). Higher resolutions extend the timeout: **+60s for 2K, +180s for 4K.**

## Tools (197)

### Generative AI — Imagen, Gemini, Veo, GCS, Embeddings (18)

**Model Discovery** — Call `vertex_list_publisher_models` first if unsure which model to use. Returns all available models (Gemini, Imagen, Veo, embeddings, TTS, Lyria) from the live API.
`vertex_list_publisher_models`, `vertex_get_publisher_model`

**Imagen (Image Generation)**
`vertex_generate_image`, `vertex_edit_image`, `vertex_upscale_image`

**Gemini (Text Generation)**
`vertex_generate_content`, `vertex_stream_generate_content`, `vertex_count_tokens`

**Veo (Video Generation)**
`vertex_generate_video`, `vertex_fetch_predict_operation`

**GCS (Cloud Storage)**
`vertex_fetch_gcs_object`

**Embeddings**
`vertex_embed_text`, `vertex_embed_multimodal`

#### Veo End-to-End Workflow

```
vertex_generate_video → returns operation name
  ↓
vertex_fetch_predict_operation (poll until done=true) → returns gcsUri
  ↓
vertex_fetch_gcs_object (download video) → saves MP4 locally or returns base64
```

**Cached Content**
`vertex_create_cached_content`, `vertex_get_cached_content`, `vertex_list_cached_contents`, `vertex_update_cached_content`, `vertex_delete_cached_content`

#### Local File Support

Generative AI tools accept **local file paths** as an alternative to base64-encoded data:

- `vertex_generate_content` / `vertex_stream_generate_content` / `vertex_count_tokens` — pass a `prompt` string and `filePaths` array instead of building the full `contents` array
- `vertex_edit_image` — pass `imagePath` / `maskPath` instead of base64
- `vertex_upscale_image` — pass `imagePath` instead of base64
- `vertex_embed_multimodal` — pass `imagePath` instead of base64
- `vertex_generate_video` — pass `imagePath` instead of base64

Supported formats: PNG, JPEG, GIF, WebP, BMP, TIFF, PDF, MP4, MOV, AVI, MKV, WebM, MP3, WAV, FLAC, OGG, AAC, TXT, HTML, CSS, JS, JSON, CSV, XML.

### Datasets (8)
`vertex_create_dataset`, `vertex_get_dataset`, `vertex_list_datasets`, `vertex_delete_dataset`, `vertex_update_dataset`, `vertex_import_data`, `vertex_export_data`, `vertex_search_data_items`

### Endpoints (12)
`vertex_create_endpoint`, `vertex_get_endpoint`, `vertex_list_endpoints`, `vertex_delete_endpoint`, `vertex_update_endpoint`, `vertex_deploy_model`, `vertex_undeploy_model`, `vertex_mutate_deployed_model`, `vertex_predict`, `vertex_raw_predict`, `vertex_explain`, `vertex_server_streaming_predict`

### Models (12)
`vertex_upload_model`, `vertex_get_model`, `vertex_list_models`, `vertex_delete_model`, `vertex_update_model`, `vertex_delete_model_version`, `vertex_list_model_versions`, `vertex_merge_version_aliases`, `vertex_export_model`, `vertex_copy_model`, `vertex_get_model_evaluation`, `vertex_list_model_evaluations`

### Jobs (15)
`vertex_create_custom_job`, `vertex_get_custom_job`, `vertex_list_custom_jobs`, `vertex_delete_custom_job`, `vertex_cancel_custom_job`, `vertex_create_batch_prediction_job`, `vertex_get_batch_prediction_job`, `vertex_list_batch_prediction_jobs`, `vertex_delete_batch_prediction_job`, `vertex_cancel_batch_prediction_job`, `vertex_create_hyperparameter_tuning_job`, `vertex_get_hyperparameter_tuning_job`, `vertex_list_hyperparameter_tuning_jobs`, `vertex_delete_hyperparameter_tuning_job`, `vertex_cancel_hyperparameter_tuning_job`

### Pipelines (10)
`vertex_create_training_pipeline`, `vertex_get_training_pipeline`, `vertex_list_training_pipelines`, `vertex_delete_training_pipeline`, `vertex_cancel_training_pipeline`, `vertex_create_pipeline_job`, `vertex_get_pipeline_job`, `vertex_list_pipeline_jobs`, `vertex_delete_pipeline_job`, `vertex_cancel_pipeline_job`

### Indexes (13)
`vertex_create_index`, `vertex_get_index`, `vertex_list_indexes`, `vertex_delete_index`, `vertex_update_index`, `vertex_upsert_datapoints`, `vertex_remove_datapoints`, `vertex_create_index_endpoint`, `vertex_get_index_endpoint`, `vertex_list_index_endpoints`, `vertex_delete_index_endpoint`, `vertex_deploy_index`, `vertex_undeploy_index`

### Featurestores (22)
`vertex_create_featurestore`, `vertex_get_featurestore`, `vertex_list_featurestores`, `vertex_delete_featurestore`, `vertex_update_featurestore`, `vertex_search_features`, `vertex_batch_read_feature_values`, `vertex_create_entity_type`, `vertex_get_entity_type`, `vertex_list_entity_types`, `vertex_delete_entity_type`, `vertex_update_entity_type`, `vertex_read_feature_values`, `vertex_import_feature_values`, `vertex_export_feature_values`, `vertex_delete_feature_values`, `vertex_create_feature`, `vertex_get_feature`, `vertex_list_features`, `vertex_delete_feature`, `vertex_update_feature`, `vertex_batch_create_features`

### Feature Online Stores (13)
`vertex_create_feature_online_store`, `vertex_get_feature_online_store`, `vertex_list_feature_online_stores`, `vertex_delete_feature_online_store`, `vertex_update_feature_online_store`, `vertex_create_feature_view`, `vertex_get_feature_view`, `vertex_list_feature_views`, `vertex_delete_feature_view`, `vertex_update_feature_view`, `vertex_fetch_feature_values`, `vertex_search_nearest_entities`, `vertex_sync_feature_view`

### Tensorboards (23)
`vertex_create_tensorboard`, `vertex_get_tensorboard`, `vertex_list_tensorboards`, `vertex_delete_tensorboard`, `vertex_update_tensorboard`, `vertex_read_tensorboard_size`, `vertex_read_tensorboard_usage`, `vertex_batch_read_tensorboard_time_series_data`, `vertex_create_tensorboard_experiment`, `vertex_get_tensorboard_experiment`, `vertex_list_tensorboard_experiments`, `vertex_delete_tensorboard_experiment`, `vertex_write_tensorboard_experiment_data`, `vertex_create_tensorboard_run`, `vertex_get_tensorboard_run`, `vertex_list_tensorboard_runs`, `vertex_delete_tensorboard_run`, `vertex_write_tensorboard_run_data`, `vertex_create_tensorboard_time_series`, `vertex_get_tensorboard_time_series`, `vertex_list_tensorboard_time_series`, `vertex_delete_tensorboard_time_series`, `vertex_read_tensorboard_time_series_data`

### Metadata (18)
`vertex_create_metadata_store`, `vertex_get_metadata_store`, `vertex_list_metadata_stores`, `vertex_delete_metadata_store`, `vertex_create_artifact`, `vertex_get_artifact`, `vertex_list_artifacts`, `vertex_update_artifact`, `vertex_purge_artifacts`, `vertex_create_context`, `vertex_get_context`, `vertex_list_contexts`, `vertex_update_context`, `vertex_purge_contexts`, `vertex_create_execution`, `vertex_get_execution`, `vertex_list_executions`, `vertex_update_execution`

### Schedules (7)
`vertex_create_schedule`, `vertex_get_schedule`, `vertex_list_schedules`, `vertex_delete_schedule`, `vertex_update_schedule`, `vertex_pause_schedule`, `vertex_resume_schedule`

### Operations (5)
`vertex_get_operation`, `vertex_list_operations`, `vertex_cancel_operation`, `vertex_delete_operation`, `vertex_wait_operation`

### Deployment Resource Pools (6)
`vertex_create_deployment_resource_pool`, `vertex_get_deployment_resource_pool`, `vertex_list_deployment_resource_pools`, `vertex_delete_deployment_resource_pool`, `vertex_update_deployment_resource_pool`, `vertex_query_deployed_models`

### Tuning (5)
`vertex_create_tuning_job`, `vertex_get_tuning_job`, `vertex_list_tuning_jobs`, `vertex_cancel_tuning_job`, `vertex_rebase_tuned_model`

### NAS Jobs (7)
`vertex_create_nas_job`, `vertex_get_nas_job`, `vertex_list_nas_jobs`, `vertex_delete_nas_job`, `vertex_cancel_nas_job`, `vertex_get_nas_trial_detail`, `vertex_list_nas_trial_details`

### Specialist Pools (5)
`vertex_create_specialist_pool`, `vertex_get_specialist_pool`, `vertex_list_specialist_pools`, `vertex_delete_specialist_pool`, `vertex_update_specialist_pool`

## Development

```bash
npm install
npm run build
npm test
```

## License

MIT
