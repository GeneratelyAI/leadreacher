export type AuthenticationAssuranceLevel = "aal1" | "aal2";

type JwtClaims = { aal?: unknown };

/**
 * Reads the assurance claim only after the token has been validated remotely
 * with Supabase. This is not JWT signature verification.
 */
export function authenticationAssuranceLevel(token: string): AuthenticationAssuranceLevel {
  try {
    const [, encodedPayload] = token.split(".");
    if (!encodedPayload) return "aal1";
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as JwtClaims;
    return payload.aal === "aal2" ? "aal2" : "aal1";
  } catch {
    return "aal1";
  }
}
