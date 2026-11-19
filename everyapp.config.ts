import { defineEveryApp } from "@every-app/sdk";

export default defineEveryApp({
  id: "seo-toolkit",
  name: "SEO Toolkit",
  description:
    "Research keywords, size up competitors and backlinks, track rankings and audit your sites.",
  icon: "/icon.svg",
  access: "everyone",
  resources: {
    d1: ["DB"],
    workflows: [
      // One run checks every tracked keyword of one project.
      { name: "RANK_CHECK", className: "RankCheckWorkflow" },
      // One run crawls one project's site.
      { name: "SITE_AUDIT", className: "SiteAuditWorkflow" },
    ],
  },
  public: [],
  capabilities: {
    dataforseo: {
      access: "read",
      why: "Keyword ideas, search results, domain rankings and backlinks, including the daily rank checks. Billed by DataForSEO per request.",
      docs: "https://app.dataforseo.com/api-access",
    },
  },
  features: {
    searchdata: {
      name: "Search data",
      why: "Keyword research, domain and backlink analysis and rank tracking. Projects and site audits work without it.",
      steps: [
        "Create a DataForSEO account and copy the API login and password: https://app.dataforseo.com/api-access",
      ],
      capabilities: ["dataforseo"],
    },
  },
});
