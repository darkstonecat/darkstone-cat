// ---------------------------------------------------------------------------
// Ludoya integration — response-shape guards
// ---------------------------------------------------------------------------
// Every field we depend on is read through a guard that fails with a precise
// message ("shape changed at futureEvents.elements[0].startsAt: expected
// string, received undefined") instead of silently producing undefined.

export class LudoyaShapeError extends Error {
  constructor(
    public readonly path: string,
    expected: string,
    received: unknown
  ) {
    super(
      `Ludoya response shape changed at "${path}": expected ${expected}, received ${describe(received)}`
    );
    this.name = "LudoyaShapeError";
  }
}

type JsonObject = Record<string, unknown>;

export function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function describe(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (Array.isArray(value)) return `array(${value.length})`;
  if (isObject(value)) return `object{${Object.keys(value).slice(0, 15).join(", ")}}`;
  return `${typeof value} ${JSON.stringify(value)}`.slice(0, 80);
}

export function getPath(root: unknown, dotPath: string): unknown {
  return dotPath
    .split(".")
    .reduce<unknown>((acc, key) => (isObject(acc) ? acc[key] : undefined), root);
}

export function fail(root: unknown, dotPath: string, expected: string, ctx: string): never {
  const value = getPath(root, dotPath);
  // When the field is missing, show the parent's keys so the log says what
  // Ludoya sends instead.
  const parentPath = dotPath.split(".").slice(0, -1).join(".");
  const received = value === undefined && parentPath ? getPath(root, parentPath) : value === undefined ? root : value;
  throw new LudoyaShapeError(`${ctx}.${dotPath}`, expected, received);
}

export function requireArray(root: unknown, dotPath: string, ctx: string): unknown[] {
  const value = getPath(root, dotPath);
  return Array.isArray(value) ? value : fail(root, dotPath, "array", ctx);
}

export function requireString(root: unknown, dotPath: string, ctx: string): string {
  const value = getPath(root, dotPath);
  return typeof value === "string" && value !== "" ? value : fail(root, dotPath, "non-empty string", ctx);
}

export function requireIsoDate(root: unknown, dotPath: string, ctx: string): string {
  const value = requireString(root, dotPath, ctx);
  return Number.isNaN(Date.parse(value)) ? fail(root, dotPath, "ISO-8601 date", ctx) : value;
}

export function optionalString(root: unknown, dotPath: string, ctx: string): string | null {
  const value = getPath(root, dotPath);
  if (value === undefined || value === null || value === "") return null;
  return typeof value === "string" ? value : fail(root, dotPath, "string or null", ctx);
}

export function optionalNumber(root: unknown, dotPath: string, ctx: string): number | null {
  const value = getPath(root, dotPath);
  if (value === undefined || value === null) return null;
  return typeof value === "number" ? value : fail(root, dotPath, "number or null", ctx);
}

export function optionalBoolean(root: unknown, dotPath: string, ctx: string): boolean | null {
  const value = getPath(root, dotPath);
  if (value === undefined || value === null) return null;
  return typeof value === "boolean" ? value : fail(root, dotPath, "boolean or null", ctx);
}
