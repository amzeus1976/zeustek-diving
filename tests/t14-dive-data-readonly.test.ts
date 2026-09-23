import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({ db: null as unknown as D1Database }));
vi.mock('cloudflare:workers', () => ({ env: { get DB() { return fixture.db; } } }));
vi.mock('../app/chatgpt-auth', () => ({ getChatGPTUser: async () => ({ userId: 'fixture-owner', email: 'amzeusddo@googlemail.com' }) }));
import { GET } from '../app/api/dive-data/route';

let sqlite: DatabaseSync;
let writes: string[];
function database() {
  const prepare = (sql: string, args: unknown[] = []) => ({
    bind: (...values: unknown[]) => prepare(sql, values),
    first: async () => sqlite.prepare(sql).get(...args as never[]) ?? null,
    all: async () => ({ results: sqlite.prepare(sql).all(...args as never[]) }),
    run: async () => { writes.push(sql); return { meta: sqlite.prepare(sql).run(...args as never[]) }; },
  });
  return { prepare, batch: async (statements: Array<{ run: () => Promise<unknown> }>) => Promise.all(statements.map(item => item.run())) } as unknown as D1Database;
}
beforeEach(() => { sqlite = new DatabaseSync(':memory:'); writes = []; fixture.db = database(); });
afterEach(() => sqlite.close());

describe('T14 owner-data read-only smoke', () => {
  it('returns empty records on a fresh database without creating schema', async () => {
    const response = await GET(new Request('https://fixture/api/dive-data?kind=dive'));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ items: [] });
    expect(writes).toEqual([]);
    expect(sqlite.prepare("SELECT name FROM sqlite_master WHERE name='dive_records'").get()).toBeUndefined();
  });
  it('reads existing records without writing household membership or changing content', async () => {
    sqlite.exec('CREATE TABLE dive_records (id TEXT PRIMARY KEY,user_id TEXT NOT NULL,kind TEXT NOT NULL,data_json TEXT NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,deleted_at INTEGER)');
    sqlite.prepare('INSERT INTO dive_records VALUES (?,?,?,?,?,?,NULL)').run('fixture-dive', 'fixture-owner', 'dive', '{"site":"Fixture Bay"}', 100, 100);
    const before = sqlite.prepare('SELECT * FROM dive_records').all();
    const response = await GET(new Request('https://fixture/api/dive-data?kind=dive'));
    expect(response.status).toBe(200);
    expect((await response.json() as { items: Array<{ id: string }> }).items[0]?.id).toBe('fixture-dive');
    expect(writes).toEqual([]);
    expect(sqlite.prepare('SELECT * FROM dive_records').all()).toEqual(before);
  });
});
