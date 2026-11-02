import type { SupabaseClient } from "@supabase/supabase-js";
import { MEMORY_NOTES_MAX, type MemoryNote, type MemoryRemote } from "../../creature/memory/memoryStore";

type Row = { id: string; text: string; created_at: string };

function isRow(value: unknown): value is Row {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<Row>;
  return typeof row.id === "string" && typeof row.text === "string" && typeof row.created_at === "string" && Number.isFinite(Date.parse(row.created_at));
}

function check({ error }: { error: { message: string } | null }) {
  if (error) throw new Error(error.message);
}

/** The `memories` table through the visitor's session: RLS only ever shows and changes their own notes. */
export function createMemoryRemote(client: SupabaseClient, userId: string): MemoryRemote {
  const table = () => client.from("memories");
  return {
    async list() {
      const { data, error } = await table().select("id, text, created_at").order("created_at", { ascending: false }).limit(MEMORY_NOTES_MAX);
      check({ error });
      const rows: unknown[] = data ?? [];
      return rows.filter(isRow).map(row => ({ id: row.id, text: row.text, createdAt: Date.parse(row.created_at) })).reverse();
    },
    async insert(notes: MemoryNote[]) {
      check(await table().insert(notes.map(note => ({ id: note.id, text: note.text, created_at: new Date(note.createdAt).toISOString() }))));
    },
    async remove(id) {
      check(await table().delete().eq("id", id));
    },
    // PostgREST needs a filter to delete; RLS would stop any other user's rows anyway.
    async clear() {
      check(await table().delete().eq("user_id", userId));
    },
  };
}
