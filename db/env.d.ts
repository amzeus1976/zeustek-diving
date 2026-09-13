declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    FILES: R2Bucket;
    CESIUM_ION_TOKEN?: string;
  }
}
