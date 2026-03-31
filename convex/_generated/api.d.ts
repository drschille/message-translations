/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as _lib_platform from "../_lib/platform.js";
import type * as _lib_workflowUtils from "../_lib/workflowUtils.js";
import type * as admin from "../admin.js";
import type * as comments from "../comments.js";
import type * as documents from "../documents.js";
import type * as editorial from "../editorial.js";
import type * as history from "../history.js";
import type * as http from "../http.js";
import type * as sermons from "../sermons.js";
import type * as translations from "../translations.js";
import type * as workflow from "../workflow.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "_lib/platform": typeof _lib_platform;
  "_lib/workflowUtils": typeof _lib_workflowUtils;
  admin: typeof admin;
  comments: typeof comments;
  documents: typeof documents;
  editorial: typeof editorial;
  history: typeof history;
  http: typeof http;
  sermons: typeof sermons;
  translations: typeof translations;
  workflow: typeof workflow;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
