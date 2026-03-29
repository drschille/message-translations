import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

const http = httpRouter();

http.route({
  path: "/sermons/import",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    let payload: unknown;
    try {
      payload = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        {
          status: 400,
          headers: { "content-type": "application/json" },
        },
      );
    }

    const sermons = Array.isArray(payload)
      ? payload
      : payload &&
          typeof payload === "object" &&
          "sermons" in payload &&
          Array.isArray((payload as { sermons?: unknown }).sermons)
        ? (payload as { sermons: unknown[] }).sermons
        : null;

    if (!sermons) {
      return new Response(
        JSON.stringify({
          error: "Expected an array payload or { sermons: [...] }",
        }),
        {
          status: 400,
          headers: { "content-type": "application/json" },
        },
      );
    }

    try {
      const result = await ctx.runAction(api.sermons.importFromBranham, {
        sermons,
      });
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: "Import failed",
          message: error instanceof Error ? error.message : "Unknown error",
        }),
        {
          status: 400,
          headers: { "content-type": "application/json" },
        },
      );
    }
  }),
});

export default http;
