import "@testing-library/jest-dom";

const IntersectionObserverMock = class implements IntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin: string = "";
  readonly thresholds: ReadonlyArray<number> = [];

  // The callback is accepted to match the constructor signature, but we don't need to use it.
  constructor(_callback: IntersectionObserverCallback, _options?: IntersectionObserverInit) {}

  observe: IntersectionObserver["observe"] = () => {};
  unobserve: IntersectionObserver["unobserve"] = () => {};
  disconnect: IntersectionObserver["disconnect"] = () => {};
  takeRecords: IntersectionObserver["takeRecords"] = () => [];
};

// Cast to keep TypeScript satisfied that this is a valid constructor for IntersectionObserver.
window.IntersectionObserver = IntersectionObserverMock as unknown as typeof IntersectionObserver;

const ResizeObserverMock = class implements ResizeObserver {
  // The callback is accepted to match the constructor signature, but we don't need to use it.
  constructor(_callback: ResizeObserverCallback) {}

  observe: ResizeObserver["observe"] = () => {};
  unobserve: ResizeObserver["unobserve"] = () => {};
  disconnect: ResizeObserver["disconnect"] = () => {};
};

// Cast to keep TypeScript satisfied that this is a valid constructor for ResizeObserver.
window.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});
