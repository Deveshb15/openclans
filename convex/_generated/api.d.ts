/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as agents_mutations from "../agents/mutations.js";
import type * as agents_queries from "../agents/queries.js";
import type * as buildings_mutations from "../buildings/mutations.js";
import type * as buildings_queries from "../buildings/queries.js";
import type * as chat_mutations from "../chat/mutations.js";
import type * as chat_queries from "../chat/queries.js";
import type * as clans_mutations from "../clans/mutations.js";
import type * as clans_queries from "../clans/queries.js";
import type * as constants from "../constants.js";
import type * as crons from "../crons.js";
import type * as gameActions_mutations from "../gameActions/mutations.js";
import type * as governance_mutations from "../governance/mutations.js";
import type * as governance_queries from "../governance/queries.js";
import type * as helpers from "../helpers.js";
import type * as http from "../http.js";
import type * as plots_mutations from "../plots/mutations.js";
import type * as plots_queries from "../plots/queries.js";
import type * as resources_mutations from "../resources/mutations.js";
import type * as tick_internal from "../tick/internal.js";
import type * as town_queries from "../town/queries.js";
import type * as trades_mutations from "../trades/mutations.js";
import type * as trades_queries from "../trades/queries.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "agents/mutations": typeof agents_mutations;
  "agents/queries": typeof agents_queries;
  "buildings/mutations": typeof buildings_mutations;
  "buildings/queries": typeof buildings_queries;
  "chat/mutations": typeof chat_mutations;
  "chat/queries": typeof chat_queries;
  "clans/mutations": typeof clans_mutations;
  "clans/queries": typeof clans_queries;
  constants: typeof constants;
  crons: typeof crons;
  "gameActions/mutations": typeof gameActions_mutations;
  "governance/mutations": typeof governance_mutations;
  "governance/queries": typeof governance_queries;
  helpers: typeof helpers;
  http: typeof http;
  "plots/mutations": typeof plots_mutations;
  "plots/queries": typeof plots_queries;
  "resources/mutations": typeof resources_mutations;
  "tick/internal": typeof tick_internal;
  "town/queries": typeof town_queries;
  "trades/mutations": typeof trades_mutations;
  "trades/queries": typeof trades_queries;
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
