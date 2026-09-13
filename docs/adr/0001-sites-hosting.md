# ADR 0001: Sites hosts the PWA and relay edge surface

Status: accepted for the current private deployment.

The build specification names Cloudflare Pages and a separate Cloudflare Worker. The existing Zeustek production identity is an OpenAI Sites project, whose deployment target is also a Cloudflare Worker-compatible runtime with D1 and R2 bindings.

For the current build, Sites remains the HTTPS PWA host and exposes relay routes from the same origin. This reduces CORS and credential exposure without changing the ZTO1 object format, immutable event model, Google Drive durability rule or home-agent protocol. D1 remains control metadata only. R2 is reserved for user-import originals and is not treated as the canonical encrypted event store.

The relay-to-Google-Drive adapter remains portable and must use only `drive.file`. If Sites cannot support a required OAuth or streaming behavior, the relay package can be deployed as a separate Worker without changing clients or encrypted objects.
