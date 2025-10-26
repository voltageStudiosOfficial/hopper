# Hopper Proxy

## Overview
Hopper is a CORS proxy service built with Cloudflare Workers. It allows you to access websites through a proxy that handles CORS restrictions and rewrites content to work through the proxy.

## Purpose
This project acts as a web proxy that:
- Accepts Base64-encoded URLs via the `/assignment/{encoded_url}` path
- Fetches content from the target URL
- Adds permissive CORS headers to allow cross-origin access
- Rewrites HTML and CSS content to route all requests through the proxy
- Serves a clean frontend interface for easy URL input

## Current State
The project is fully functional and running in Replit. The Cloudflare Workers development server is configured to run on port 5000 with proper host configuration for the Replit environment.

## Recent Changes
- **2025-10-26**: Initial setup in Replit environment
  - Fixed `env.ASSETS` handling for local development compatibility
  - Configured workflow to run on port 5000 with 0.0.0.0 binding
  - Set up project documentation

## Project Architecture

### Technology Stack
- **Runtime**: Cloudflare Workers
- **Language**: TypeScript
- **Build Tool**: Wrangler (Cloudflare's CLI)
- **Frontend**: Vanilla HTML/CSS/JavaScript

### Directory Structure
```
/
├── src/
│   └── index.ts          # Main worker code (proxy logic)
├── public/
│   └── index.html        # Frontend interface
├── package.json          # Node.js dependencies
├── wrangler.jsonc        # Cloudflare Workers configuration
└── tsconfig.json         # TypeScript configuration
```

### Key Components

#### Backend (src/index.ts)
- **Proxy Handler**: Intercepts requests to `/assignment/{base64_url}` and forwards them to the decoded target URL
- **CORS Handler**: Adds permissive CORS headers to allow cross-origin requests
- **Content Rewriter**: Rewrites HTML and CSS to ensure all resources load through the proxy
  - HTML: Rewrites `<a>`, `<link>`, `<img>`, `<script>`, and `<form>` elements
  - CSS: Rewrites `url()` properties
- **Static Asset Handler**: Serves static files from the `public/` directory for non-proxy requests

#### Frontend (public/index.html)
- Clean, modern interface for entering URLs
- Base64 encoding of target URLs
- Iframe-based proxy viewer with navigation controls
- Responsive design with Inter font

### How It Works
1. User enters a URL in the frontend
2. URL is Base64-encoded and sent to `/assignment/{encoded_url}`
3. Worker decodes the URL and fetches the target content
4. Worker adds CORS headers and rewrites links/resources
5. Content is displayed in an iframe with proxy controls

## Development

### Running Locally
The project runs automatically via the configured workflow:
```bash
wrangler dev --port 5000 --ip 0.0.0.0
```

### Deployment
To deploy to Cloudflare Workers:
```bash
npm run deploy
```

## Configuration Notes
- The worker is configured in `wrangler.jsonc` with TypeScript support
- Assets are served from the `./public` directory
- Compatibility date is set to 2025-08-13
- Local development now handles cases where `env.ASSETS` is undefined
