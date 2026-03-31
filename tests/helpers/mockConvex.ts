type Row = Record<string, any>;
type Tables = Record<string, Row[]>;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function matches(row: Row, conditions: Array<{ field: string; value: unknown }>) {
  return conditions.every((condition) => row[condition.field] === condition.value);
}

function sortRows(rows: Row[], direction: "asc" | "desc") {
  if (direction === "asc") return rows;
  return [...rows].reverse();
}

export function createMockCtx(seed?: {
  tables?: Tables;
  identity?: {
    tokenIdentifier?: string;
    email?: string;
    name?: string;
  } | null;
}) {
  const tables: Tables = clone(seed?.tables ?? {});
  const counters = new Map<string, number>();
  let identity = seed?.identity ?? null;

  const ensureTable = (table: string) => {
    if (!tables[table]) tables[table] = [];
    return tables[table];
  };

  const queryBuilder = (table: string, baseRows: Row[]) => {
    let rows = [...baseRows];
    let direction: "asc" | "desc" = "asc";

    const builder: any = {
      withIndex: (_index: string, callback: (q: any) => void) => {
        const conditions: Array<{ field: string; value: unknown }> = [];
        const q: any = {
          eq: (field: string, value: unknown) => {
            conditions.push({ field, value });
            return q;
          },
        };
        callback(q);
        rows = rows.filter((row) => matches(row, conditions));
        return builder;
      },
      order: (nextDirection: "asc" | "desc") => {
        direction = nextDirection;
        return builder;
      },
      collect: async () => sortRows(rows, direction),
      take: async (n: number) => sortRows(rows, direction).slice(0, n),
      paginate: async (opts: { numItems: number }) => {
        const page = sortRows(rows, direction).slice(0, opts.numItems);
        return {
          page,
          isDone: rows.length <= opts.numItems,
          continueCursor: rows.length <= opts.numItems ? "" : "mock_cursor",
        };
      },
      unique: async () => {
        const ordered = sortRows(rows, direction);
        if (ordered.length > 1) throw new Error("Expected unique result");
        return ordered[0] ?? null;
      },
    };

    return builder;
  };

  const db = {
    query: (table: string) => queryBuilder(table, ensureTable(table)),
    get: async (id: string) => {
      for (const rows of Object.values(tables)) {
        const row = rows.find((entry) => entry._id === id);
        if (row) return row;
      }
      return null;
    },
    insert: async (table: string, data: Row) => {
      const rows = ensureTable(table);
      const next = (counters.get(table) ?? rows.length) + 1;
      counters.set(table, next);
      const _id = `${table}:${next}`;
      const row = { _id, _creationTime: Date.now(), ...clone(data) };
      rows.push(row);
      return _id;
    },
    patch: async (id: string, partial: Row) => {
      for (const rows of Object.values(tables)) {
        const index = rows.findIndex((entry) => entry._id === id);
        if (index !== -1) {
          rows[index] = { ...rows[index], ...clone(partial) };
          return;
        }
      }
      throw new Error(`Document not found: ${id}`);
    },
  };

  const ctx: any = {
    db,
    auth: {
      getUserIdentity: async () => identity,
    },
  };

  return {
    ctx,
    tables,
    setIdentity(nextIdentity: typeof identity) {
      identity = nextIdentity;
    },
  };
}

