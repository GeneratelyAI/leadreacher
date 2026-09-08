export type ApiErrorResponse = {
  status: number;
  code: string;
  message: string;
  requestId: string;
  details?: Record<string, unknown>;
};

/** Older upstream errors may lack the normalized API envelope. */
export type CompatibleApiErrorPayload = Partial<ApiErrorResponse> & {
  error?: string;
};
