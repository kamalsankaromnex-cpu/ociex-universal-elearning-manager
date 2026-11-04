import type { ScormAdapter, ScormApi, ScormVersion } from "./types";
export function discoverApi(
  version: ScormVersion,
  start: Window = window,
): ScormApi | null {
  const key = version === "1.2" ? "API" : "API_1484_11",
    seen = new Set<Window>();
  function search(w: Window | null): ScormApi | null {
    for (let i = 0; w && i < 20; i++) {
      if (seen.has(w)) break;
      seen.add(w);
      try {
        const api = (w as unknown as Record<string, unknown>)[key];
        if (api && typeof api === "object") return api as ScormApi;
        if (w.parent === w) break;
        w = w.parent;
      } catch {
        break;
      }
    }
    return null;
  }
  const found = search(start);
  if (found) return found;
  try {
    return search(start.opener);
  } catch {
    return null;
  }
}
abstract class BaseAdapter implements ScormAdapter {
  abstract readonly version: ScormVersion;
  abstract readonly methods: {
    init: string;
    get: string;
    set: string;
    commit: string;
    end: string;
    error: string;
  };
  constructor(protected api: ScormApi) {}
  private call(method: string, ...args: string[]) {
    const fn = this.api[method];
    if (typeof fn !== "function")
      throw new Error(`LMS method ${method} is unavailable`);
    return String(fn.apply(this.api, args));
  }
  private check(method: string, result: string) {
    const code = this.call(this.methods.error);
    if (code !== "0" || result.toLowerCase() !== "true")
      throw new Error(`LMS ${method} failed (code ${code})`);
  }
  initialize() {
    this.check(this.methods.init, this.call(this.methods.init, ""));
  }
  get(element: string) {
    const value = this.call(this.methods.get, element),
      code = this.call(this.methods.error);
    if (code !== "0")
      throw new Error(`LMS read ${element} failed (code ${code})`);
    return value;
  }
  set(element: string, value: string) {
    this.check(`write ${element}`, this.call(this.methods.set, element, value));
  }
  commit() {
    this.check(this.methods.commit, this.call(this.methods.commit, ""));
  }
  terminate() {
    this.check(this.methods.end, this.call(this.methods.end, ""));
  }
}
export class Scorm12Adapter extends BaseAdapter {
  readonly version = "1.2" as const;
  readonly methods = {
    init: "LMSInitialize",
    get: "LMSGetValue",
    set: "LMSSetValue",
    commit: "LMSCommit",
    end: "LMSFinish",
    error: "LMSGetLastError",
  };
}
export class Scorm2004Adapter extends BaseAdapter {
  readonly version = "2004" as const;
  readonly methods = {
    init: "Initialize",
    get: "GetValue",
    set: "SetValue",
    commit: "Commit",
    end: "Terminate",
    error: "GetLastError",
  };
}
