import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../config/env.js";
import { ExternalServiceError } from "../lib/errors.js";

interface R2UploadResult {
  url: string;
  r2Key: string;
}

export class R2Adapter {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicUrl: string;

  constructor() {
    this.bucket = env.R2_BUCKET_NAME;
    this.publicUrl = env.R2_PUBLIC_URL.replace(/\/$/, "");

    this.client = new S3Client({
      region: "auto",
      endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      },
    });
  }

  async uploadBuffer(
    key: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<R2UploadResult> {
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: buffer,
          ContentType: contentType,
        }),
      );

      return { url: `${this.publicUrl}/${key}`, r2Key: key };
    } catch (error) {
      throw new ExternalServiceError(
        "R2",
        `uploadBuffer failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async uploadFromUrl(key: string, sourceUrl: string): Promise<R2UploadResult> {
    try {
      const response = await fetch(sourceUrl, {
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) {
        throw new Error(`Fetch failed: ${response.status}`);
      }

      const contentLength = Number(response.headers.get("content-length") ?? 0);
      if (contentLength > 100 * 1024 * 1024) {
        throw new Error("Source media exceeds the 100 MB download limit");
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.byteLength > 100 * 1024 * 1024) {
        throw new Error("Source media exceeds the 100 MB download limit");
      }
      const contentType =
        response.headers.get("content-type") ?? "application/octet-stream";
      return this.uploadBuffer(key, buffer, contentType);
    } catch (error) {
      throw new ExternalServiceError(
        "R2",
        `uploadFromUrl failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async createSignedDownloadUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    try {
      return await getSignedUrl(
        this.client,
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
        { expiresIn: expiresInSeconds },
      );
    } catch (error) {
      throw new ExternalServiceError(
        "R2",
        `createSignedDownloadUrl failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async deleteObject(key: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      );
    } catch (error) {
      throw new ExternalServiceError(
        "R2",
        `deleteObject failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
