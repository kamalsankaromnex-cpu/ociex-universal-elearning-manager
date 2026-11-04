// Version-specific browser LMS simulation. This is not a SCORM Cloud launch.
export function installMockLms(version: "1.2" | "2004") {
  const w = window as unknown as {
    API?: unknown;
    API_1484_11?: unknown;
    __lmsValues: Record<string, string>;
    __lmsCalls: string[];
    __failWrites: boolean;
  };
  const prefix = version === "1.2" ? "LMS" : "",
    key = `mock-scorm-${version}`;
  let active = false,
    error = "0";
  let committed: Record<string, string> = JSON.parse(
    localStorage.getItem(key) || "{}",
  );
  const values: Record<string, string> = { ...committed };
  values[version === "1.2" ? "cmi.core.entry" : "cmi.entry"] = committed[
    "cmi.suspend_data"
  ]
    ? "resume"
    : "ab-initio";
  const calls: string[] = [];
  w.__lmsValues = values;
  w.__lmsCalls = calls;
  w.__failWrites = false;
  const api: Record<string, (...args: string[]) => string> = {};
  const allowed =
    version === "1.2"
      ? [
          "cmi.suspend_data",
          "cmi.core.entry",
          "cmi.core.lesson_location",
          "cmi.core.score.min",
          "cmi.core.score.max",
          "cmi.core.score.raw",
          "cmi.core.session_time",
          "cmi.core.exit",
          "cmi.core.lesson_status",
        ]
      : [
          "cmi.suspend_data",
          "cmi.entry",
          "cmi.location",
          "cmi.score.min",
          "cmi.score.max",
          "cmi.score.raw",
          "cmi.score.scaled",
          "cmi.progress_measure",
          "cmi.session_time",
          "cmi.exit",
          "cmi.success_status",
          "cmi.completion_status",
        ];
  api[prefix + "Initialize"] = () => {
    calls.push("Initialize");
    if (active) {
      error = "103";
      return "false";
    }
    active = true;
    error = "0";
    return "true";
  };
  api[prefix + "GetLastError"] = () => error;
  api[prefix + "GetValue"] = (name) => {
    if (!active || !allowed.includes(name)) {
      error = "401";
      return "";
    }
    error = "0";
    return values[name] || "";
  };
  api[prefix + "SetValue"] = (name, value) => {
    calls.push(name);
    if (!active || w.__failWrites || !allowed.includes(name)) {
      error = "351";
      return "false";
    }
    if (
      name === "cmi.suspend_data" &&
      value.length > (version === "1.2" ? 4096 : 64000)
    ) {
      error = "407";
      return "false";
    }
    if (
      name.endsWith("session_time") &&
      !(
        version === "1.2" ? /^\d{4}:\d{2}:\d{2}\.\d{2}$/ : /^PT\d+(\.\d+)?S$/
      ).test(value)
    ) {
      error = "406";
      return "false";
    }
    error = "0";
    values[name] = value;
    return "true";
  };
  api[prefix + "Commit"] = () => {
    calls.push("Commit");
    if (!active || w.__failWrites) {
      error = "391";
      return "false";
    }
    error = "0";
    committed = { ...values };
    localStorage.setItem(key, JSON.stringify(committed));
    return "true";
  };
  api[prefix + (version === "1.2" ? "Finish" : "Terminate")] = () => {
    calls.push("Terminate");
    if (!active) {
      error = "112";
      return "false";
    }
    active = false;
    error = "0";
    return "true";
  };
  if (version === "1.2") w.API = api;
  else w.API_1484_11 = api;
}
