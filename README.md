# SEO Toolkit

Research keywords, size up competitors and their backlinks, track where your sites rank every day and audit them for technical problems, privately for your team.

Inspired by https://semrush.com

Built with [oss.new](https://oss.new) for [EveryApp](https://github.com/every-app/every-app).

## Features

- Keep a project per website and see its rankings and site health at a glance.
- Find keyword ideas with volume, difficulty, CPC, intent and trend, check the top 10, and save picks to lists you can export as CSV.
- Size up any domain's ranking keywords, traffic and competitors, and find the keywords competitors rank for and you don't.
- Track up to 500 keywords per project against up to 20 competitors, checked daily or on demand.
- Crawl a site against a fixed rule set, with a health score, issues by severity and past audits.
- See a domain's backlinks, referring domains and the domains that link to competitors but not to you.

Left out: accounts and sign-in, which your Gateway handles; AI-answer tracking; traffic, content, local, ads and social toolkits; scheduled PDF reports and alerts; shared projects; plans and billing; integrations and native apps.

## Setup

- Install: `pnpm everyapp install <this repository>` onto your Gateway, or `pnpm install` then `pnpm run deploy` from a checkout.
- Run locally: `pnpm dev`. Test: `pnpm test`; the packaged checks are in `checks/`.
- Search data (optional feature): a DataForSEO API login and password, held by the Gateway's `dataforseo` capability. Keyword research, domains, backlinks and rank tracking need it; projects and site audits work without it. `pnpm everyapp configure seo-toolkit` asks for it.
- No other secrets or settings.

## Limitations

- Every search-data request is billed to your DataForSEO account; daily checks of many keywords add up.
- The crawler reads the HTML the server sends; pages built by JavaScript in the browser are seen as empty.
- Audits crawl up to 500 pages.
- The live DataForSEO calls and a real deploy were not exercised by the local checks, which use fixed test data.
