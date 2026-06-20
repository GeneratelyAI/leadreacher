/**
 * Whether a fetched LinkedIn profile indicates the account is now connected
 * (first-degree). Used by the relation-reconciliation worker as a fallback for
 * the `new_relation` webhook, which can lag or never fire.
 */
export function isConnectedProfile(profile: {
  network_distance?: string;
  is_relationship?: boolean;
}): boolean {
  return (
    profile.network_distance === "FIRST_DEGREE" ||
    profile.is_relationship === true
  );
}
