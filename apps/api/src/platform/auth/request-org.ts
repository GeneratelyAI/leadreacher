export function requireOrgId(request: { orgId?: string }): string {
  if (!request.orgId) {
    throw new Error("orgId missing after auth middleware");
  }

  return request.orgId;
}
