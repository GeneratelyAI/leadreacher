import { GoneError, ValidationError } from "./errors.js";

type ExportDownloadState = {
  status: string;
  objectKey: string | null;
  expiresAt: Date | null;
};

export function assertExportDownloadReady(
  job: ExportDownloadState,
  now: Date = new Date(),
): asserts job is ExportDownloadState & {
  status: "ready";
  objectKey: string;
  expiresAt: Date;
} {
  if (job.expiresAt && job.expiresAt <= now) {
    throw new GoneError("This export has expired");
  }
  if (job.status !== "ready" || !job.objectKey || !job.expiresAt) {
    throw new ValidationError("This export is not ready");
  }
}
