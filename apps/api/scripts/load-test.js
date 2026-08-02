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
  scenarios: {
    dashboard_reads: {
      executor: "constant-vus",
      vus: 5,
      duration: "30s",
    },
  },
  thresholds: {
    checks: ["rate>0.99"],
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<750"],
  },
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

  const headers = { Authorization: `Bearer ${authToken ?? ""}` };

  const dashboardChrome = http.get(`${baseUrl}/dashboard/chrome`, { headers });
  check(dashboardChrome, {
    "dashboard chrome returns 200": (response) => response.status === 200,
    "dashboard chrome stays below 250 ms": (response) => response.timings.duration < 250,
  });

  const campaigns = http.get(`${baseUrl}/dashboard/campaigns`, { headers });
  check(campaigns, {
    "campaign list returns 200": (response) => response.status === 200,
    "campaign list stays below 750 ms": (response) => response.timings.duration < 750,
  });

  const prospects = http.get(`${baseUrl}/dashboard/prospects?limit=10`, { headers });
  check(prospects, {
    "prospect list returns 200": (response) => response.status === 200,
    "prospect list stays below 750 ms": (response) => response.timings.duration < 750,
  });

  const activity = http.get(`${baseUrl}/dashboard/activity?limit=10`, { headers });
  check(activity, {
    "activity list returns 200": (response) => response.status === 200,
    "activity list stays below 750 ms": (response) => response.timings.duration < 750,
  });

  const analytics = http.get(`${baseUrl}/dashboard/analytics`, { headers });
  check(analytics, {
    "analytics returns 200": (response) => response.status === 200,
    "analytics stays below 750 ms": (response) => response.timings.duration < 750,
  });

  const socialAccounts = http.get(`${baseUrl}/social-accounts`, {
    headers,
  });
  check(socialAccounts, {
    "social accounts returns 200": (response) => response.status === 200,
  });

  sleep(1);
}
