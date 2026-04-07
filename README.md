# vertex-ai-mcp

MCP server for **Google Vertex AI** with **194 tools** covering Imagen image generation, Gemini text generation, embeddings, datasets, endpoints, models, indexes, featurestores, pipelines, tensorboards, metadata, and more.

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

This server uses **Google Application Default Credentials (ADC)**. Set up authentication using one of:

1. **gcloud CLI** (recommended for local development):
   ```bash
   gcloud auth application-default login
   ```

2. **Service account key file**:
   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"
   ```

3. **Automatic** on GCE, Cloud Run, GKE (metadata server).

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GOOGLE_PROJECT_ID` | Yes | - | Your Google Cloud project ID |
| `GOOGLE_LOCATION` | No | `us-central1` | Vertex AI region |

## Tools (194)

### Generative AI — Imagen, Gemini, Embeddings (13)

**Imagen (Image Generation)**
`vertex_generate_image`, `vertex_edit_image`, `vertex_upscale_image`

**Gemini (Text Generation)**
`vertex_generate_content`, `vertex_stream_generate_content`, `vertex_count_tokens`

**Embeddings**
`vertex_embed_text`, `vertex_embed_multimodal`

**Cached Content**
`vertex_create_cached_content`, `vertex_get_cached_content`, `vertex_list_cached_contents`, `vertex_update_cached_content`, `vertex_delete_cached_content`

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
