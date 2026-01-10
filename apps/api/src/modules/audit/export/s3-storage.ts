import crypto from "node:crypto";

export type S3ClientConfig = {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint?: string;
  pathStyle?: boolean;
};

export type S3PutObjectParams = {
  key: string;
  body: string | Buffer;
  contentType: string;
};

export type S3Client = {
  putObject: (params: S3PutObjectParams) => Promise<void>;
};

function hmac(key: Buffer | string, value: string): Buffer {
  return crypto.createHmac("sha256", key).update(value, "utf8").digest();
}

function sha256Hex(value: Buffer | string | Uint8Array): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function toAmzDate(date: Date): { amzDate: string; dateStamp: string } {
  const iso = date.toISOString().replace(/[:-]|\.\d{3}/g, "");
  return { amzDate: iso, dateStamp: iso.slice(0, 8) };
}

function getHost(endpoint: string): string {
  const url = new URL(endpoint);
  return url.host;
}

function buildUrl(config: S3ClientConfig, key: string): string {
  const endpoint = config.endpoint ?? `https://${config.bucket}.s3.${config.region}.amazonaws.com`;
  const base = endpoint.replace(/\/+$/, "");
  if (config.pathStyle ?? true) {
    return `${base}/${config.bucket}/${encodeURI(key)}`;
  }
  return `${base}/${encodeURI(key)}`;
}

function buildCanonicalUri(config: S3ClientConfig, key: string): string {
  const encodedKey = encodeURI(key);
  if (config.pathStyle ?? true) {
    return `/${config.bucket}/${encodedKey}`;
  }
  return `/${encodedKey}`;
}

function getSigningKey(secret: string, dateStamp: string, region: string, service: string): Buffer {
  const kDate = hmac(`AWS4${secret}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, "aws4_request");
}

export function createS3Client(config: S3ClientConfig): S3Client {
  return {
    async putObject(params: S3PutObjectParams): Promise<void> {
      const now = new Date();
      const { amzDate, dateStamp } = toAmzDate(now);
      const payload = typeof params.body === "string" ? Buffer.from(params.body, "utf8") : params.body;
      const payloadBytes: Uint8Array = payload instanceof Uint8Array ? payload : new Uint8Array(payload);
      const body = new ArrayBuffer(payloadBytes.byteLength);
      new Uint8Array(body).set(payloadBytes);
      const payloadHash = sha256Hex(payloadBytes);
      const service = "s3";
      const endpoint = config.endpoint ?? `https://${config.bucket}.s3.${config.region}.amazonaws.com`;
      const host = getHost(endpoint);
      const canonicalUri = buildCanonicalUri(config, params.key);

      const headers: Record<string, string> = {
        host,
        "x-amz-content-sha256": payloadHash,
        "x-amz-date": amzDate,
        "content-type": params.contentType,
      };
      const signedHeaders = Object.keys(headers)
        .map((key) => key.toLowerCase())
        .sort()
        .join(";");
      const canonicalHeaders = Object.keys(headers)
        .map((key) => `${key.toLowerCase()}:${headers[key].trim()}`)
        .sort()
        .join("\n");

      const canonicalRequest = [
        "PUT",
        canonicalUri,
        "",
        `${canonicalHeaders}\n`,
        signedHeaders,
        payloadHash,
      ].join("\n");

      const credentialScope = `${dateStamp}/${config.region}/${service}/aws4_request`;
      const stringToSign = [
        "AWS4-HMAC-SHA256",
        amzDate,
        credentialScope,
        sha256Hex(canonicalRequest),
      ].join("\n");

      const signingKey = getSigningKey(config.secretAccessKey, dateStamp, config.region, service);
      const signature = crypto.createHmac("sha256", signingKey).update(stringToSign, "utf8").digest("hex");

      const authorizationHeader = `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

      const response = await fetch(buildUrl(config, params.key), {
        method: "PUT",
        headers: {
          "Content-Type": params.contentType,
          "X-Amz-Content-Sha256": payloadHash,
          "X-Amz-Date": amzDate,
          Authorization: authorizationHeader,
        },
        body,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`S3 upload failed: ${response.status} ${response.statusText} ${text}`);
      }
    },
  };
}
