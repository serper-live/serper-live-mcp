import { type CallToolResult, McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { describeError, type Device, type SearchResponse, type SerperLiveClient } from './client.js';

const PRICING_URL = 'https://serper.live/pricing';

const country = z.string()
    .regex(/^[A-Za-z]{2}$/)
    .describe('Two-letter code of the market to search in, e.g. "US", "GB", "DE", "FR", "TR". Call list_countries for the markets that are open right now.');
const query = z.string()
    .min(2)
    .max(120)
    .describe('Search keyword, exactly as a person would type it into Google.');
const language = z.string()
    .optional()
    .describe('Google interface language (hl), e.g. "en", "de", "fr", "uk". Defaults to the language of the country.');
const device = z.enum(['desktop', 'mobile'])
    .optional()
    .describe('Browser persona Google sees. Desktop and mobile rankings often differ. Default: desktop.');

/**
 * MCP tools over the public Serper.live API. Searches are live and billed to the user's balance, which the tool
 * descriptions state up front so an agent does not run them speculatively; list_countries is free.
 */
export function createServer(client: SerperLiveClient, version: string): McpServer {
    const server = new McpServer({
        name: 'serper-live',
        title: 'Serper.live',
        version,
        description: 'Live Google search results, domain positions and open markets via the Serper.live SERP API.',
        websiteUrl: 'https://serper.live',
        icons: [
            { src: 'https://serper.live/favicon.svg', mimeType: 'image/svg+xml', sizes: ['any'] },
            { src: 'https://serper.live/images/icon-512.png', mimeType: 'image/png', sizes: ['512x512'] },
        ],
    });

    server.registerTool('google_search', {
        title: 'Live Google search',
        description: 'Run a live Google search for a country, language and device and return the organic results in Google\'s order: position, title, URL, domain and snippet. '
            + 'Ads, sitelinks, video and image blocks are left out, so position is the organic rank. Every call is a real, uncached search that usually takes 2–3 seconds '
            + `and is billed to the Serper.live balance per page of up to 10 results (${PRICING_URL}).`,
        inputSchema: z.object({
            query,
            country,
            language,
            device,
            limit: z.number()
                .int()
                .min(1)
                .max(100)
                .optional()
                .describe('How many organic results to return, 1–100. Default: 10. Each started page of 10 results is billed.'),
        }),
        annotations: {
            readOnlyHint: true,
            idempotentHint: false,
            openWorldHint: true,
        },
    }, async ({ query, country, language, device, limit }) => {
        try {
            const result = await client.search({ query, country: country.toUpperCase(), language, device, limit });
            const lines = [
                `${summary(result)}:`,
                ...result.organic.map(row => `${row.position}. ${row.title ?? row.domain} — ${row.url}${null !== row.snippet ? `\n   ${row.snippet}` : ''}`),
            ];

            if (result.organic.length === 0) {
                lines.push('Google returned no organic results for this query.');
            }

            return success(lines.join('\n'), result);
        } catch (ex) {
            return failure(ex);
        }
    });

    server.registerTool('domain_position', {
        title: 'Domain position in Google',
        description: 'Find where a domain ranks in Google\'s organic results for a keyword, in a country and on a device, right now. '
            + 'Returns the best position and every position if the site appears more than once, or a note that the domain is outside the checked depth. '
            + 'A subdomain counts as the domain: example.com also matches blog.example.com. '
            + `Billed like google_search for the depth checked: one page per started 10 results (${PRICING_URL}).`,
        inputSchema: z.object({
            domain: z.string()
                .min(3)
                .max(253)
                .describe('Domain to look for, e.g. "example.com". Scheme, path and a leading www are ignored.'),
            query,
            country,
            language,
            device,
            depth: z.number()
                .int()
                .min(1)
                .max(100)
                .optional()
                .describe('How many organic results to check, 1–100. Default: 10. Use 30 or more to see positions beyond the first page.'),
        }),
        annotations: {
            readOnlyHint: true,
            idempotentHint: false,
            openWorldHint: true,
        },
    }, async ({ domain, query, country, language, device, depth }) => {
        const target = normaliseDomain(domain);

        if (null === target) {
            return failure(new Error(`"${domain}" is not a domain. Pass a host such as example.com.`));
        }

        try {
            const result = await client.search({ query, country: country.toUpperCase(), language, device, limit: depth });
            const hits = result.organic.filter(row => matchesDomain(row.domain, target));
            const checked = depth ?? 10;
            const best = hits[0] ?? null;
            const text = null !== best
                ? `${target} is at position ${best.position} (${best.url}). ${summary(result)}, top ${checked} checked.`
                    + (hits.length > 1 ? ` It also appears at ${hits.slice(1).map(row => row.position).join(', ')}.` : '')
                : `${target} is not in the top ${checked} organic results. ${summary(result)}.`
            ;

            return success(text, {
                domain: target,
                position: best?.position ?? null,
                positions: hits.map(row => row.position),
                url: best?.url ?? null,
                title: best?.title ?? null,
                depth: checked,
                ...result,
            });
        } catch (ex) {
            return failure(ex);
        }
    });

    server.registerTool('list_countries', {
        title: 'Open Serper.live markets',
        description: 'List the countries Serper.live can search right now, with the default Google interface language of each. '
            + 'Desktop and mobile are available in every market. Free, no token needed.',
        annotations: {
            readOnlyHint: true,
            idempotentHint: true,
            openWorldHint: true,
        },
    }, async () => {
        try {
            const countries = await client.countries();
            const lines = countries.map(item => `${item.code} — default language ${item.defaultLanguage}`);

            return success(`Open markets (${PRICING_URL} lists the price of each):\n${lines.join('\n')}`, { countries });
        } catch (ex) {
            return failure(ex);
        }
    });

    return server;
}

function summary(result: SearchResponse): string {
    const seconds = (result.latencyMs / 1000).toFixed(1);
    const charge = `${result.pages} page${result.pages === 1 ? '' : 's'} billed, ${result.price} ${result.currency}`;

    return `Google ${result.country}, ${result.device as Device}, language ${result.language}, "${result.query}" — fetched ${result.fetchedAt} in ${seconds} s, ${charge}`;
}

function success(text: string, structured: object): CallToolResult {
    return {
        content: [{ type: 'text', text }],
        structuredContent: structured as Record<string, unknown>,
    };
}

function failure(ex: unknown): CallToolResult {
    return {
        content: [{ type: 'text', text: describeError(ex) }],
        isError: true,
    };
}

/**
 * Host without scheme, path, port and a leading www, lower-cased; null when nothing host-like is left.
 */
export function normaliseDomain(value: string): string | null {
    const host = value.trim()
        .toLowerCase()
        .replace(/^[a-z][a-z0-9+.-]*:\/\//, '')
        .split(/[/?#]/)[0]
        .replace(/:\d+$/, '')
        .replace(/^www\./, '')
        .replace(/\.$/, '')
    ;

    return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host)
        ? host
        : null
    ;
}

export function matchesDomain(host: string, domain: string): boolean {
    const normalised = normaliseDomain(host);

    return null !== normalised
        && (normalised === domain || normalised.endsWith(`.${domain}`))
    ;
}