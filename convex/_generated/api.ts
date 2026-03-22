import { anyApi, ApiFromModules } from "convex/server";
import type * as sermons from "../sermons";

/**
 * A utility for referencing Convex functions in your app's queries and mutations.
 */
export const api: ApiFromModules<{
  sermons: typeof sermons;
}> = anyApi as any;
