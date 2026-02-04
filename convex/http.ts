import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { SKILL_MD } from "./skillContent";

const http = httpRouter();

// ============================================================
// CORS Headers
// ============================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status = 400) {
  return jsonResponse({ ok: false, error: message }, status);
}

// Handle CORS preflight
http.route({
  path: "/*",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, { status: 204, headers: corsHeaders });
  }),
});

// ============================================================
// Documentation Endpoints
// ============================================================

http.route({
  path: "/skill.md",
  method: "GET",
  handler: httpAction(async () => {
    return new Response(SKILL_MD, {
      headers: { ...corsHeaders, "Content-Type": "text/markdown" },
    });
  }),
});

// ============================================================
// Agent Endpoints
// ============================================================

http.route({
  path: "/agents/register",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const result = await ctx.runMutation(api.agents.mutations.register, {
        name: body.name || "",
      });
      return jsonResponse(result);
    } catch (e: any) {
      return errorResponse(e.message);
    }
  }),
});

http.route({
  path: "/agents/join",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const apiKey = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!apiKey) return errorResponse("Missing API key", 401);

    const result = await ctx.runMutation(api.agents.mutations.join, { apiKey });
    return jsonResponse(result);
  }),
});

http.route({
  path: "/agents/me",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const apiKey = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!apiKey) return errorResponse("Missing API key", 401);

    const result = await ctx.runQuery(api.agents.queries.getMe, { apiKey });
    if (!result) return errorResponse("Invalid API key", 401);
    return jsonResponse({ ok: true, data: result });
  }),
});

http.route({
  path: "/agents/me/notifications",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const apiKey = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!apiKey) return errorResponse("Missing API key", 401);

    const notifications = await ctx.runQuery(api.agents.queries.getNotifications, { apiKey });

    // Mark as read
    await ctx.runMutation(api.agents.mutations.markNotificationsRead, { apiKey });

    return jsonResponse({ ok: true, data: notifications });
  }),
});

// ============================================================
// Action Endpoints
// ============================================================

http.route({
  path: "/actions/move",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const apiKey = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!apiKey) return errorResponse("Missing API key", 401);

    const body = await request.json();
    const result = await ctx.runMutation(api.gameActions.mutations.move, {
      apiKey,
      direction: body.direction || "",
    });
    return jsonResponse(result);
  }),
});

http.route({
  path: "/actions/gather",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const apiKey = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!apiKey) return errorResponse("Missing API key", 401);

    const body = await request.json();
    const result = await ctx.runMutation(api.gameActions.mutations.gather, {
      apiKey,
      type: body.type || "",
    });
    return jsonResponse(result);
  }),
});

http.route({
  path: "/actions/refine",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const apiKey = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!apiKey) return errorResponse("Missing API key", 401);

    const body = await request.json();
    const result = await ctx.runMutation(api.gameActions.mutations.refine, {
      apiKey,
      recipe: body.recipe || "",
    });
    return jsonResponse(result);
  }),
});

http.route({
  path: "/actions/clear",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const apiKey = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!apiKey) return errorResponse("Missing API key", 401);

    const result = await ctx.runMutation(api.gameActions.mutations.clearForest, { apiKey });
    return jsonResponse(result);
  }),
});

http.route({
  path: "/actions/claim",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const apiKey = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!apiKey) return errorResponse("Missing API key", 401);

    const body = await request.json();
    const result = await ctx.runMutation(api.gameActions.mutations.claimTile, {
      apiKey,
      x: body.x ?? 0,
      y: body.y ?? 0,
    });
    return jsonResponse(result);
  }),
});

http.route({
  path: "/actions/nearby",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const apiKey = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!apiKey) return errorResponse("Missing API key", 401);

    const result = await ctx.runMutation(api.gameActions.mutations.getNearby, { apiKey });
    return jsonResponse(result);
  }),
});

http.route({
  path: "/actions/batch",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const apiKey = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!apiKey) return errorResponse("Missing API key", 401);

    const body = await request.json();
    const result = await ctx.runMutation(api.gameActions.mutations.batch, {
      apiKey,
      actions: body.actions || [],
    });
    return jsonResponse(result);
  }),
});

// ============================================================
// Resource Endpoints
// ============================================================

http.route({
  path: "/resources",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const apiKey = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!apiKey) return errorResponse("Missing API key", 401);

    const result = await ctx.runMutation(api.resources.mutations.getResources, { apiKey });
    return jsonResponse(result);
  }),
});

http.route({
  path: "/resources/collect",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const apiKey = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!apiKey) return errorResponse("Missing API key", 401);

    const result = await ctx.runMutation(api.resources.mutations.collect, { apiKey });
    return jsonResponse(result);
  }),
});

// ============================================================
// Plot Endpoints
// ============================================================

http.route({
  path: "/plots",
  method: "GET",
  handler: httpAction(async (ctx) => {
    const plots = await ctx.runQuery(api.plots.queries.getAll, {});
    return jsonResponse({ ok: true, data: plots });
  }),
});

http.route({
  path: "/plots",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const apiKey = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!apiKey) return errorResponse("Missing API key", 401);

    const body = await request.json();
    const result = await ctx.runMutation(api.plots.mutations.claim, {
      apiKey,
      x: body.x ?? 0,
      y: body.y ?? 0,
      width: body.width ?? 1,
      height: body.height ?? 1,
    });
    return jsonResponse(result);
  }),
});

// ============================================================
// Building Endpoints
// ============================================================

http.route({
  path: "/buildings",
  method: "GET",
  handler: httpAction(async (ctx) => {
    const buildings = await ctx.runQuery(api.buildings.queries.getAll, {});
    return jsonResponse({ ok: true, data: buildings });
  }),
});

http.route({
  path: "/buildings",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const apiKey = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!apiKey) return errorResponse("Missing API key", 401);

    const body = await request.json();
    const result = await ctx.runMutation(api.buildings.mutations.place, {
      apiKey,
      type: body.type || "",
      plotId: body.plotId as Id<"plots">,
      x: body.x ?? 0,
      y: body.y ?? 0,
      inscription: body.inscription,
    });
    return jsonResponse(result);
  }),
});

http.route({
  path: "/buildings/types",
  method: "GET",
  handler: httpAction(async (ctx) => {
    const types = await ctx.runQuery(api.buildings.queries.getTypes, {});
    return jsonResponse({ ok: true, data: types });
  }),
});

// ============================================================
// Trade Endpoints
// ============================================================

http.route({
  path: "/trades",
  method: "GET",
  handler: httpAction(async (ctx) => {
    const trades = await ctx.runQuery(api.trades.queries.getOpen, {});
    return jsonResponse({ ok: true, data: trades });
  }),
});

http.route({
  path: "/trades",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const apiKey = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!apiKey) return errorResponse("Missing API key", 401);

    const body = await request.json();
    const result = await ctx.runMutation(api.trades.mutations.create, {
      apiKey,
      offering: body.offering || {},
      requesting: body.requesting || {},
    });
    return jsonResponse(result);
  }),
});

// ============================================================
// Chat Endpoints
// ============================================================

http.route({
  path: "/chat/town",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") || "50");

    const messages = await ctx.runQuery(api.chat.queries.getTownChat, { limit });
    return jsonResponse({ ok: true, data: messages });
  }),
});

http.route({
  path: "/chat/town",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const apiKey = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!apiKey) return errorResponse("Missing API key", 401);

    const body = await request.json();
    const result = await ctx.runMutation(api.chat.mutations.sendTown, {
      apiKey,
      content: body.content || "",
    });
    return jsonResponse(result);
  }),
});

http.route({
  path: "/chat/clan",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const apiKey = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!apiKey) return errorResponse("Missing API key", 401);

    const body = await request.json();
    const result = await ctx.runMutation(api.chat.mutations.sendClan, {
      apiKey,
      content: body.content || "",
    });
    return jsonResponse(result);
  }),
});

// ============================================================
// Clan Endpoints
// ============================================================

http.route({
  path: "/clans",
  method: "GET",
  handler: httpAction(async (ctx) => {
    const clans = await ctx.runQuery(api.clans.queries.getAll, {});
    return jsonResponse({ ok: true, data: clans });
  }),
});

http.route({
  path: "/clans",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const apiKey = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!apiKey) return errorResponse("Missing API key", 401);

    const body = await request.json();
    const result = await ctx.runMutation(api.clans.mutations.create, {
      apiKey,
      name: body.name || "",
      tag: body.tag || "",
      description: body.description,
    });
    return jsonResponse(result);
  }),
});

// ============================================================
// Governance Endpoints
// ============================================================

http.route({
  path: "/governance/proposals",
  method: "GET",
  handler: httpAction(async (ctx) => {
    const proposals = await ctx.runQuery(api.governance.queries.getAll, {});
    return jsonResponse({ ok: true, data: proposals });
  }),
});

http.route({
  path: "/governance/proposals",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const apiKey = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!apiKey) return errorResponse("Missing API key", 401);

    const body = await request.json();
    const result = await ctx.runMutation(api.governance.mutations.createProposal, {
      apiKey,
      type: body.type || "",
      title: body.title || "",
      description: body.description || "",
    });
    return jsonResponse(result);
  }),
});

// ============================================================
// Town Info Endpoints
// ============================================================

http.route({
  path: "/town",
  method: "GET",
  handler: httpAction(async (ctx) => {
    const stats = await ctx.runQuery(api.town.queries.getStats, {});
    return jsonResponse({ ok: true, data: stats });
  }),
});

http.route({
  path: "/town/map",
  method: "GET",
  handler: httpAction(async (ctx) => {
    const map = await ctx.runQuery(api.town.queries.getMap, {});
    return jsonResponse({ ok: true, data: map });
  }),
});

http.route({
  path: "/town/activity",
  method: "GET",
  handler: httpAction(async (ctx) => {
    const activity = await ctx.runQuery(api.town.queries.getActivity, {});
    return jsonResponse({ ok: true, data: activity });
  }),
});

http.route({
  path: "/town/available-plots",
  method: "GET",
  handler: httpAction(async (ctx) => {
    const plots = await ctx.runQuery(api.plots.queries.getAvailable, {});
    return jsonResponse({ ok: true, data: plots });
  }),
});

http.route({
  path: "/leaderboard",
  method: "GET",
  handler: httpAction(async (ctx) => {
    const leaderboard = await ctx.runQuery(api.agents.queries.getLeaderboard, {});
    return jsonResponse({ ok: true, data: leaderboard });
  }),
});

http.route({
  path: "/leaderboard/clans",
  method: "GET",
  handler: httpAction(async (ctx) => {
    const leaderboard = await ctx.runQuery(api.clans.queries.getLeaderboard, {});
    return jsonResponse({ ok: true, data: leaderboard });
  }),
});

http.route({
  path: "/events",
  method: "GET",
  handler: httpAction(async (ctx) => {
    const events = await ctx.runQuery(api.town.queries.getEvents, {});
    return jsonResponse({ ok: true, data: events });
  }),
});

http.route({
  path: "/milestones",
  method: "GET",
  handler: httpAction(async (ctx) => {
    const milestones = await ctx.runQuery(api.town.queries.getMilestones, {});
    return jsonResponse({ ok: true, data: milestones });
  }),
});

http.route({
  path: "/treasury",
  method: "GET",
  handler: httpAction(async (ctx) => {
    const treasury = await ctx.runQuery(api.town.queries.getTreasury, {});
    return jsonResponse({ ok: true, data: treasury });
  }),
});

export default http;
