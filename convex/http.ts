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

http.route({
  path: "/sermons/paragraphs/import",
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

    const imports = Array.isArray(payload)
      ? payload
      : payload &&
          typeof payload === "object" &&
          "imports" in payload &&
          Array.isArray((payload as { imports?: unknown }).imports)
        ? (payload as { imports: unknown[] }).imports
        : payload && typeof payload === "object" && "sermonTag" in payload
          ? [payload]
          : null;

    if (!imports) {
      return new Response(
        JSON.stringify({
          error:
            "Expected one import object, an array payload, or { imports: [...] }",
        }),
        {
          status: 400,
          headers: { "content-type": "application/json" },
        },
      );
    }

    for (let i = 0; i < imports.length; i += 1) {
      const item = imports[i];
      if (!item || typeof item !== "object") {
        return new Response(
          JSON.stringify({ error: `Import item at index ${i} must be an object` }),
          {
            status: 400,
            headers: { "content-type": "application/json" },
          },
        );
      }

      const sermonTag = (item as { sermonTag?: unknown }).sermonTag;
      if (typeof sermonTag !== "string" || sermonTag.trim().length === 0) {
        return new Response(
          JSON.stringify({
            error: `Import item at index ${i} requires non-empty sermonTag`,
          }),
          {
            status: 400,
            headers: { "content-type": "application/json" },
          },
        );
      }

      const paragraphs = (item as { paragraphs?: unknown }).paragraphs;
      if (!Array.isArray(paragraphs)) {
        return new Response(
          JSON.stringify({
            error: `Import item at index ${i} requires paragraphs array`,
          }),
          {
            status: 400,
            headers: { "content-type": "application/json" },
          },
        );
      }

      for (let rowIndex = 0; rowIndex < paragraphs.length; rowIndex += 1) {
        const row = paragraphs[rowIndex];
        if (!row || typeof row !== "object") {
          return new Response(
            JSON.stringify({
              error: `Import item at index ${i} has invalid paragraph row at index ${rowIndex}: row must be an object`,
            }),
            {
              status: 400,
              headers: { "content-type": "application/json" },
            },
          );
        }

        const paragraphID = (row as { paragraphID?: unknown }).paragraphID;
        if (typeof paragraphID !== "number" || !Number.isFinite(paragraphID)) {
          return new Response(
            JSON.stringify({
              error: `Import item at index ${i} has invalid paragraph row at index ${rowIndex}: paragraphID must be a number`,
            }),
            {
              status: 400,
              headers: { "content-type": "application/json" },
            },
          );
        }

        const text = (row as { text?: unknown }).text;
        if (typeof text !== "string") {
          return new Response(
            JSON.stringify({
              error: `Import item at index ${i} has invalid paragraph row at index ${rowIndex}: text must be a string`,
            }),
            {
              status: 400,
              headers: { "content-type": "application/json" },
            },
          );
        }

        const textNo = (row as { text_no?: unknown }).text_no;
        if (typeof textNo !== "string") {
          return new Response(
            JSON.stringify({
              error: `Import item at index ${i} has invalid paragraph row at index ${rowIndex}: text_no must be a string`,
            }),
            {
              status: 400,
              headers: { "content-type": "application/json" },
            },
          );
        }
      }

      const cleanExisting = (item as { cleanExisting?: unknown }).cleanExisting;
      const overwriteExisting = (item as { overwriteExisting?: unknown }).overwriteExisting;
      if (cleanExisting === true && overwriteExisting === true) {
        return new Response(
          JSON.stringify({
            error: `Import item at index ${i} cannot set both cleanExisting and overwriteExisting`,
          }),
          {
            status: 400,
            headers: { "content-type": "application/json" },
          },
        );
      }
    }

    try {
      const result = await ctx.runAction(api.paragraphImports.importSermonParagraphs, {
        imports,
      });
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: "Paragraph import failed",
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
