// Event program: what happens inside one event. Pure (no React, no server-only),
// fed by a minimal node shape so it never depends on the Ludoya adapter.
export { classifyProgram } from "./classify";
export { countItems, layoutProgram, programItems, PROGRAM_SLOT_THRESHOLD, seatedItems } from "./layout";
export type * from "./types";
