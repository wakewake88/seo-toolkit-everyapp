/// <reference types="vite/client" />

// The bindings come from `cf workers types` (.cloudflare/types).
declare namespace Cloudflare {
  interface Env {
    /**
     * Never set in a deploy, where the crawler fetches the public internet.
     * The checks bind a fixed test site here (checks/fakes.mjs).
     */
    CRAWLER?: Fetcher;
  }
}
