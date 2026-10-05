export interface Recipient {
  userId: string;
  displayName: string;
  status: "pending" | "approved";
  addedAt: string;
}

export interface RecipientStore {
  list(): Promise<Recipient[]>;
  get(userId: string): Promise<Recipient | null>;
  put(r: Recipient): Promise<void>;
  delete(userId: string): Promise<void>;
}

export interface KVLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
  list(opts: { prefix: string; cursor?: string }): Promise<{ keys: { name: string }[]; list_complete: boolean; cursor?: string }>;
}

const PREFIX = "recipient:";

export function kvRecipientStore(kv: KVLike): RecipientStore {
  const get = async (userId: string) => {
    const raw = await kv.get(PREFIX + userId);
    return raw ? (JSON.parse(raw) as Recipient) : null;
  };
  return {
    get,
    async put(r) {
      await kv.put(PREFIX + r.userId, JSON.stringify(r));
    },
    async delete(userId) {
      await kv.delete(PREFIX + userId);
    },
    async list() {
      const names: string[] = [];
      let cursor: string | undefined;
      do {
        const page = await kv.list({ prefix: PREFIX, cursor });
        names.push(...page.keys.map((k) => k.name));
        cursor = page.list_complete ? undefined : page.cursor;
      } while (cursor);
      const all = await Promise.all(names.map((n) => get(n.slice(PREFIX.length))));
      return all.filter((r): r is Recipient => r !== null);
    },
  };
}
