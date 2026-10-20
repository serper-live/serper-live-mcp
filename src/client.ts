import { randomUUID } from 'node:crypto';

export const DEFAULT_API_URL = 'https://api.serper.live';
export const TOKENS_URL = 'https://serper.live/account/tokens';
export const BALANCE_URL = 'https://serper.live/account/balance';

/** A live search usually answers in 2–3 seconds; the first request to a market after a pause takes longer. */
const TIMEOUT_MS = 100_000;

export type Device = 'desktop' | 'mobile';

export interface OrganicResult {
    position: number;
    title: string | null;
    url: string;
    domain: string;
    snippet: string | null;
}

export interface SearchResponse {
    requestId: string;
    query: string;
    country: string;
    language: string;
    device: Device;
    fetchedAt: string;
    latencyMs: number;
    pages: number;
    price: number;
    currency: string;
    organic: OrganicResult[];
}

export interface Country {
    code: string;
    defaultLanguage: string;
}

export interface SearchParams {
    query: string;
    country: string;
    language?: string;
    device?: Device;
    limit?: number;
}

/**
 * An error response of the API (`{error, message}`) or a request that never got one. `code` is the API error code,
 * or `missing_token` / `network_error` for failures on this side.
 */
export class ApiError extends Error {
    constructor(
        readonly status: number,
        readonly code: string,
        message: string,
    ) {
        super(message);

        this.name = 'ApiError';
    }
}

/**
 * Thin client for the public Serper.live API. Every search carries an `Idempotency-Key`; a request that failed on the
 * network is retried once with the same key, so a search that finished meanwhile is replayed instead of billed twice.
 */
export class SerperLiveClient {
    constructor(
        private readonly token: string | null,
        private readonly baseUrl: string = DEFAULT_API_URL,
        private readonly userAgent: string = 'serper-live-mcp',
    ) {}

    async countries(): Promise<Country[]> {
        const body = await this.request<{ countries: Country[] }>('GET', '/v1/countries');

        return body.countries;
    }

    async search(params: SearchParams): Promise<SearchResponse> {
        if (null === this.token) {
            throw new ApiError(401, 'missing_token', `SERPER_LIVE_TOKEN is not set. Create an API token at ${TOKENS_URL} and add it to the environment of this MCP server.`);
        }

        const key = randomUUID();

        try {
            return await this.request<SearchResponse>('POST', '/v1/search', params, key);
        } catch (ex) {
            if (
                ex instanceof ApiError
                && 'network_error' === ex.code
            ) {
                return await this.request<SearchResponse>('POST', '/v1/search', params, key);
            }

            throw ex;
        }
    }

    private async request<T>(
        method: 'GET' | 'POST',
        path: string,
        body?: unknown,
        idempotencyKey?: string,
    ): Promise<T> {
        const headers: Record<string, string> = {
            'Accept': 'application/json',
            'User-Agent': this.userAgent,
        };

        if (undefined !== body) {
            headers['Content-Type'] = 'application/json';
        }
        if (
            null !== this.token
            && '/v1/search' === path
        ) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }
        if (undefined !== idempotencyKey) {
            headers['Idempotency-Key'] = idempotencyKey;
        }

        let response: Response;

        try {
            response = await fetch(`${this.baseUrl.replace(/\/+$/, '')}${path}`, {
                method,
                headers,
                body: undefined !== body
                    ? JSON.stringify(body)
                    : undefined
                ,
                signal: AbortSignal.timeout(TIMEOUT_MS),
            });
        } catch (ex) {
            throw new ApiError(0, 'network_error', `Serper.live did not answer: ${ex instanceof Error ? ex.message : String(ex)}`);
        }

        const text = await response.text();
        let parsed: unknown = null;

        try {
            parsed = JSON.parse(text);
        } catch {
            // Not JSON: a proxy error page or an empty body; the status code below still tells what happened
        }

        if (!response.ok) {
            const error = parsed as { error?: string, message?: string } | null;

            throw new ApiError(response.status, error?.error ?? `http_${response.status}`, error?.message ?? `Serper.live answered with HTTP ${response.status}.`);
        }

        return parsed as T;
    }
}

/**
 * Text an agent can act on: what went wrong and what the user should do about it.
 */
export function describeError(ex: unknown): string {
    if (!(ex instanceof ApiError)) {
        return ex instanceof Error
            ? ex.message
            : String(ex)
        ;
    }

    switch (ex.code) {
        case 'missing_token':
            return ex.message;
        case 'unauthorized':
        case 'invalid_token':
            return `The API token was rejected (${ex.code}). Check SERPER_LIVE_TOKEN or create a new token at ${TOKENS_URL}.`;
        case 'insufficient_balance':
            return `The Serper.live balance does not cover this search. Top up from $5 in USDT or USDC at ${BALANCE_URL}.`;
        case 'country_unavailable':
            return `${ex.message} Call list_countries for the markets that are open right now.`;
        case 'busy':
            return 'Serper.live is at capacity right now. Retry in a few seconds.';
        default:
            // 408 and 424 are a search that ran out of time or failed on the service side, never charged like any 5xx
            return ex.status >= 500 || ex.status === 408 || ex.status === 424
                ? `${ex.message} (${ex.code}). Nothing was charged for this request; retry in a few seconds.`
                : `${ex.message} (${ex.code}).`
            ;
    }
}