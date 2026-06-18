// Wrangler generates resource and variable bindings in env.d.ts. Secrets are
// declared separately because their names are intentionally absent from config.
interface Env {
  INGEST_TOKEN?: string;
  PROVIDER_API_TOKEN?: string;
}
