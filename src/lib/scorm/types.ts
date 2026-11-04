export type ScormVersion = "1.2" | "2004";
export interface ScormAdapter {
  readonly version: ScormVersion;
  initialize(): void;
  get(element: string): string;
  set(element: string, value: string): void;
  commit(): void;
  terminate(): void;
}
export type ScormApi = Record<string, (...args: string[]) => string>;
