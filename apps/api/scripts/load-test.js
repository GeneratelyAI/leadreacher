/**
 * Run against local API:
 *   AUTH_TOKEN="<Supabase access token>" k6 run apps/api/scripts/load-test.js
 *
 * Override BASE_URL to point at a non-production environment. Do not load test
 * production without an approved capacity plan.
 */
import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  vus: 5,
  duration: "30s",
};

const baseUrl = __ENV.BASE_URL ?? "http://localhost:3001";
const authToken = __ENV.AUTH_TOKEN;

export default function () {
  const health = http.get(`${baseUrl}/health`);
  check(health, {
    "health returns 200": (response) => response.status === 200,
  });

  const ready = http.get(`${baseUrl}/ready`);
  check(ready, {
    "ready returns 200": (response) => response.status === 200,
  });

  const socialAccounts = http.get(`${baseUrl}/social-accounts`, {
    headers: {
      Authorization: `Bearer ${authToken ?? ""}`,
    },
  });
  check(socialAccounts, {
    "social accounts returns 200": (response) => response.status === 200,
  });

  sleep(1);
}
