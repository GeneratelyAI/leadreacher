import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Transition from "../Transition";

const state = vi.hoisted(() => ({
  pathname: "/",
  effects: [] as Array<() => void | (() => void)>,
  prefetch: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => state.pathname,
  useRouter: () => ({ prefetch: state.prefetch, push: state.push }),
}));
vi.mock("react", async (importOriginal) => ({
  ...await importOriginal<typeof import("react")>(),
  useEffect: (effect: () => void | (() => void)) => state.effects.push(effect),
}));

describe("marketing transition ownership", () => {
  beforeEach(() => {
    state.effects = [];
    vi.clearAllMocks();
    vi.stubGlobal("document", { addEventListener: vi.fn(), removeEventListener: vi.fn() });
  });
  afterEach(() => vi.unstubAllGlobals());

  it.each(["/signup", "/login", "/onboarding", "/onboarding-preview", "/dashboard"])(
    "does not prefetch or install a marketing click handler on %s",
    (pathname) => {
      state.pathname = pathname;
      expect(renderToStaticMarkup(<Transition />)).toBe("");
      state.effects.forEach((effect) => effect());
      expect(state.prefetch).not.toHaveBeenCalled();
      expect(document.addEventListener).not.toHaveBeenCalled();
    },
  );

  it.each([["/", "/pricing"], ["/pricing", "/"]])(
    "retains marketing prefetch and handler cleanup from %s to %s",
    (pathname, destination) => {
      state.pathname = pathname;
      renderToStaticMarkup(<Transition />);
      const cleanups = state.effects.map((effect) => effect());
      expect(state.prefetch).toHaveBeenCalledExactlyOnceWith(destination);
      expect(document.addEventListener).toHaveBeenCalledWith("click", expect.any(Function), true);
      cleanups.forEach((cleanup) => cleanup?.());
      expect(document.removeEventListener).toHaveBeenCalledWith("click", expect.any(Function), true);
    },
  );
});
