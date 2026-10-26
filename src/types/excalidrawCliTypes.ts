/** Versioned JSON protocol shared by native CLI and Excalidraw Automate. */
export type CLIJSON = null | boolean | number | string | CLIJSON[] | { [key: string]: CLIJSON };
export type CLICommand = "help" | "status" | "schema" | "api" | "list" | "read" | "open" | "create" | "apply" | "export" | "script" | "skill" | "result";

/** Command-specific fields are validated against the runtime `schema` action. */
export interface ExcalidrawCLIRequest {
  apiVersion: 1;
  command: CLICommand;
  requestId?: string;
  [key: string]: unknown;
}

/** A completed script is not itself proof that a drawing was durably saved. */
export interface ExcalidrawCLIResult {
  apiVersion: 1;
  session: string;
  requestId?: string;
  command: string;
  status: "completed" | "failed" | "pending";
  ok: boolean | null;
  persistence: "not-applicable" | "saved" | "unsaved" | "unknown";
  mutation: "not-applied" | "applied" | "partial" | "unknown";
  target?: { vault: string; path: string; viewId?: string };
  revision?: string;
  data?: CLIJSON;
  warnings: string[];
  error?: { code: string; message: string; field?: string; recovery: string };
}
