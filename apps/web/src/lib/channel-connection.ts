const CONNECTION_POLL_INTERVAL_MS = 2_000;
const CONNECTION_POLL_ATTEMPTS = 15;
const POPUP_FEATURES = "popup=yes,width=560,height=720,noopener=no";

export function openChannelConnection(url: string): Window | null {
  return window.open(url, "leadreacher-channel-connection", POPUP_FEATURES);
}

export async function waitForChannelConnection(
  isConnected: () => Promise<boolean>,
  onConnected: () => void,
): Promise<boolean> {
  for (let attempt = 0; attempt < CONNECTION_POLL_ATTEMPTS; attempt += 1) {
    if (await isConnected()) {
      onConnected();
      return true;
    }

    await new Promise((resolve) => window.setTimeout(resolve, CONNECTION_POLL_INTERVAL_MS));
  }

  return false;
}
