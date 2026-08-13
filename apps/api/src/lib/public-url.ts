import { lookup as dnsLookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import { Agent, fetch as undiciFetch } from "undici";
import { ValidationError } from "./errors.js";

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_BYTES = 1_000_000;
const DEFAULT_MAX_REDIRECTS = 3;
const SAFE_PORTS = new Set(["", "80", "443"]);

const blockedAddresses = new BlockList();

for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  blockedAddresses.addSubnet(network, prefix, "ipv4");
}

for (const [network, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
  ["2001:db8::", 32],
] as const) {
  blockedAddresses.addSubnet(network, prefix, "ipv6");
}

export type ResolvedPublicUrl = {
  url: URL;
  addresses: Array<{ address: string; family: 4 | 6 }>;
};

export type PublicUrlFetchOptions = {
  accept?: string;
  maxBytes?: number;
  maxRedirects?: number;
  timeoutMs?: number;
  allowedContentTypes?: readonly string[];
};

type Lookup = (
  hostname: string,
  options: { all: true; verbatim: true },
) => Promise<Array<{ address: string; family: number }>>;

function assertPublicAddress(address: string, family: number): asserts family is 4 | 6 {
  const mappedIpv4 = address.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  if (mappedIpv4) {
    assertPublicAddress(mappedIpv4, 4);
    return;
  }
  const normalizedFamily = family === 6 ? "ipv6" : "ipv4";
  if (isIP(address) === 0 || blockedAddresses.check(address, normalizedFamily)) {
    throw new ValidationError("Website URL must resolve to a public internet address");
  }
}

export async function resolvePublicUrl(
  input: string,
  lookup: Lookup = (hostname, options) => dnsLookup(hostname, options),
): Promise<ResolvedPublicUrl> {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new ValidationError("Website URL is invalid");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ValidationError("Website URL must use HTTP or HTTPS");
  }
  if (url.username || url.password) {
    throw new ValidationError("Website URL cannot contain credentials");
  }
  if (!SAFE_PORTS.has(url.port)) {
    throw new ValidationError("Website URL uses an unsupported port");
  }

  const literalHostname =
    url.hostname.startsWith("[") && url.hostname.endsWith("]")
      ? url.hostname.slice(1, -1)
      : url.hostname;
  const literalFamily = isIP(literalHostname);
  const resolved = literalFamily
    ? [{ address: literalHostname, family: literalFamily }]
    : await lookup(url.hostname, { all: true, verbatim: true });

  if (resolved.length === 0) {
    throw new ValidationError("Website hostname did not resolve");
  }

  const addresses = resolved.map(({ address, family }) => {
    assertPublicAddress(address, family);
    return { address, family };
  });

  return { url, addresses };
}

async function readBoundedBody(response: Response, maxBytes: number): Promise<string> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new ValidationError("Website response is too large");
  }
  if (!response.body) return "";

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        throw new ValidationError("Website response is too large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

export async function fetchPublicText(
  input: string,
  options: PublicUrlFetchOptions = {},
): Promise<{ body: string; contentType: string; status: number; url: string }> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let current = input;

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    const resolved = await resolvePublicUrl(current);
    const selected = resolved.addresses[0];
    const dispatcher = new Agent({
      connect: {
        lookup: (_hostname, _lookupOptions, callback) => {
          callback(null, selected.address, selected.family);
        },
      },
    });

    try {
      const response = await undiciFetch(resolved.url, {
        dispatcher,
        redirect: "manual",
        headers: {
          "User-Agent": "LeadReacher/1.0 (+https://www.leadreacher.ai)",
          Accept: options.accept ?? "text/html,application/xhtml+xml",
        },
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) throw new ValidationError("Website redirect is missing a destination");
        if (redirectCount === maxRedirects) {
          throw new ValidationError("Website redirected too many times");
        }
        current = new URL(location, resolved.url).toString();
        continue;
      }

      const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
      if (
        options.allowedContentTypes?.length &&
        !options.allowedContentTypes.some((allowed) => contentType.startsWith(allowed))
      ) {
        throw new ValidationError("Website returned an unsupported content type");
      }

      return {
        body: await readBoundedBody(response, maxBytes),
        contentType,
        status: response.status,
        url: response.url || resolved.url.toString(),
      };
    } finally {
      await dispatcher.close();
    }
  }

  throw new ValidationError("Website redirected too many times");
}
