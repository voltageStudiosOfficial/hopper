/**
 * src/index.ts
 * * This Cloudflare Pages function acts as a CORS proxy.
 * It specifically handles requests to the /assignment/ path,
 * where the path segment after /assignment/ is a Base64 encoded URL.
 * * All other requests will be passed through to the Cloudflare Pages
 * to be handled as static assets (e.g., your index.html).
 */

// Function to decode a Base64 string into a regular string.
// This is necessary to get the target URL from the request path.
function decodeBase64(str: string): string | null {
    try {
        return atob(str);
    } catch (e) {
        console.error("Base64 decoding error:", e);
        return null;
    }
}

// Main fetch handler for the Cloudflare Pages function.
// This function is the entry point for all requests that hit the Worker.
export default {
    async fetch(request: Request, env: any, ctx: any): Promise<Response> {
        const url = new URL(request.url);

        // Define the path prefix for our proxy logic.
        const pathPrefix = '/assignment/';

        // Check if the request path starts with our designated proxy prefix.
        if (url.pathname.startsWith(pathPrefix)) {
            // If it's an OPTIONS request, handle it as a CORS preflight.
            if (request.method === 'OPTIONS') {
                return handleOptions(request);
            }

            // Extract the Base64 encoded URL from the path.
            const encodedTargetUrl = url.pathname.substring(pathPrefix.length);

            if (!encodedTargetUrl) {
                return new Response('Please provide a Base64 encoded URL after /assignment/', { status: 400 });
            }

            // Decode the Base64 string to get the original URL.
            const decodedTargetUrl = decodeBase64(encodedTargetUrl);

            if (!decodedTargetUrl) {
                return new Response('Invalid Base64 encoded URL.', { status: 400 });
            }

            let targetUrl: URL;
            try {
                targetUrl = new URL(decodedTargetUrl);
            } catch (e) {
                return new Response('Decoded URL is not a valid URL.', { status: 400 });
            }

            // --- Prepare the request to the target origin ---
            const newRequest = new Request(targetUrl, {
                method: request.method,
                headers: request.headers,
                body: request.body, // Include body for POST, PUT, etc.
                redirect: 'follow', // Follow redirects from the target
                duplex: 'half',     // Required for streaming request bodies
            });

            // Strip potentially problematic request headers that might leak information
            // or cause issues with the target server.
            newRequest.headers.delete('cookie');
            newRequest.headers.delete('host');
            newRequest.headers.delete('origin');
            newRequest.headers.delete('referer');

            // --- Fetch the response from the target origin ---
            const response = await fetch(newRequest);

            // --- Prepare the response for the client, adding CORS headers ---
            const newHeaders = new Headers(response.headers);

            // Add permissive CORS headers to allow access from any origin.
            newHeaders.set('Access-Control-Allow-Origin', '*');
            newHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            newHeaders.set('Access-Control-Allow-Headers', request.headers.get('Access-Control-Request-Headers') || '*');
            newHeaders.set('Access-Control-Max-Age', '86400'); // Cache preflight requests

            // Strip security headers that might block content or cause issues.
            newHeaders.delete('Content-Security-Policy');
            newHeaders.delete('X-Frame-Options');
            newHeaders.delete('X-Content-Type-Options');
            newHeaders.delete('Strict-Transport-Security');
            newHeaders.delete('Set-Cookie');

            // --- Determine if content rewriting is needed (for unblocking websites) ---
            const contentType = newHeaders.get('Content-Type') || '';

            if (contentType.includes('text/html')) {
                // Rewriting logic for HTML links and resources.
                class AttributeRewriter {
                    private attributeName: string;

                    constructor(attributeName: string) {
                        this.attributeName = attributeName;
                    }

                    element(element: any) {
                        const attribute = element.getAttribute(this.attributeName);
                        if (attribute) {
                            try {
                                // Resolve relative URLs against the *original* target URL.
                                const resolvedUrl = new URL(attribute, targetUrl);
                                // Re-encode the resolved URL in Base64 and prepend with our proxy's path.
                                element.setAttribute(
                                    this.attributeName,
                                    `${pathPrefix}${btoa(resolvedUrl.toString())}`
                                );
                            } catch (e) {
                                console.error(`Error rewriting ${this.attributeName}:`, attribute, e);
                            }
                        }
                    }
                }

                const rewriter = new HTMLRewriter()
                    .on('a', new AttributeRewriter('href'))
                    .on('link', new AttributeRewriter('href'))
                    .on('img', new AttributeRewriter('src'))
                    .on('script', new AttributeRewriter('src'))
                    .on('form', new AttributeRewriter('action'));

                return rewriter.transform(
                    new Response(response.body, {
                        status: response.status,
                        statusText: response.statusText,
                        headers: newHeaders,
                    })
                );

            } else if (contentType.includes('text/css')) {
                // Rewriting logic for CSS url() properties.
                const cssText = await response.text();
                const rewrittenCss = cssText.replace(/url\(['"]?(.*?)\s*['"]?\)/g, (match, p1) => {
                    try {
                        const resolvedUrl = new URL(p1, targetUrl);
                        return `url('${pathPrefix}${btoa(resolvedUrl.toString())}')`;
                    } catch (e) {
                        return match;
                    }
                });
                return new Response(rewrittenCss, {
                    status: response.status,
                    statusText: response.statusText,
                    headers: newHeaders,
                });

            } else {
                // For all other content types (images, JSON, etc.), just pass them through.
                return new Response(response.body, {
                    status: response.status,
                    statusText: response.statusText,
                    headers: newHeaders,
                });
            }

        } else {
            // If the path does not start with '/assignment/', let Cloudflare Pages handle it.
            // This is the key difference from the Worker-only version.
            // The return value here is a special signal that Pages should continue.
            return env.ASSETS.fetch(request);
        }
    }
};

// Function to handle OPTIONS preflight requests for CORS.
function handleOptions(request: Request): Response {
    const headers = request.headers;
    if (
        headers.get('Origin') !== null &&
        headers.get('Access-Control-Request-Method') !== null &&
        headers.get('Access-Control-Request-Headers') !== null
    ) {
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET,HEAD,POST,PUT,DELETE,OPTIONS',
            'Access-Control-Max-Age': '86400',
            'Access-Control-Allow-Headers': headers.get('Access-Control-Request-Headers') || '*',
        };
        return new Response(null, {
            headers: corsHeaders,
            status: 204, // No Content
        });
    } else {
        return new Response(null, {
            headers: {
                Allow: 'GET, HEAD, POST, PUT, DELETE, OPTIONS',
            },
            status: 204,
        });
    }
}