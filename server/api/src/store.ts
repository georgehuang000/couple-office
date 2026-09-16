import { randomId } from "./core";

export type Document = Record<string, any> & { _id: string };
export type Where = Record<string, unknown>;

export interface Store {
  get(collection: string, id: string): Promise<Document | null>;
  find(collection: string, where?: Where, limit?: number, offset?: number): Promise<Document[]>;
  put(collection: string, id: string, data: Record<string, unknown>): Promise<Document>;
  add(collection: string, data: Record<string, unknown>, id?: string): Promise<Document>;
  update(collection: string, id: string, patch: Record<string, unknown>): Promise<Document>;
  delete(collection: string, id: string): Promise<void>;
  runTransaction<T>(callback: (transaction: Store) => Promise<T>): Promise<T>;
}

function matches(document: Document, where: Where): boolean {
  return Object.entries(where).every(([key, expected]) => {
    const actual = document[key];
    if (Array.isArray(expected)) return expected.includes(actual);
    return actual === expected;
  });
}

export class MemoryStore implements Store {
  private collections: Map<string, Map<string, Document>>;

  constructor(seed: Record<string, Document[]> = {}) {
    this.collections = new Map(Object.entries(seed).map(([name, documents]) => [
      name,
      new Map(documents.map((document) => [document._id, structuredClone(document)])),
    ]));
  }

  private bucket(name: string): Map<string, Document> {
    let bucket = this.collections.get(name);
    if (!bucket) {
      bucket = new Map();
      this.collections.set(name, bucket);
    }
    return bucket;
  }

  async get(collection: string, id: string): Promise<Document | null> {
    const value = this.bucket(collection).get(id);
    return value ? structuredClone(value) : null;
  }

  async find(collection: string, where: Where = {}, limit = 100, offset = 0): Promise<Document[]> {
    return [...this.bucket(collection).values()].filter((document) => matches(document, where)).slice(offset, offset + limit).map((document) => structuredClone(document));
  }

  async put(collection: string, id: string, data: Record<string, unknown>): Promise<Document> {
    const document = { ...structuredClone(data), _id: id } as Document;
    this.bucket(collection).set(id, document);
    return structuredClone(document);
  }

  async add(collection: string, data: Record<string, unknown>, id = randomId("doc")): Promise<Document> {
    return this.put(collection, id, data);
  }

  async update(collection: string, id: string, patch: Record<string, unknown>): Promise<Document> {
    const existing = await this.get(collection, id);
    if (!existing) throw new Error(`Missing document ${collection}/${id}`);
    return this.put(collection, id, { ...existing, ...structuredClone(patch) });
  }

  async delete(collection: string, id: string): Promise<void> {
    this.bucket(collection).delete(id);
  }

  async runTransaction<T>(callback: (transaction: Store) => Promise<T>): Promise<T> {
    const seed: Record<string, Document[]> = {};
    for (const [name, bucket] of this.collections) seed[name] = [...bucket.values()].map((value) => structuredClone(value));
    const transaction = new MemoryStore(seed);
    const result = await callback(transaction);
    this.collections = transaction.collections;
    return result;
  }

  snapshot(): Record<string, Document[]> {
    const result: Record<string, Document[]> = {};
    for (const [name, bucket] of this.collections) result[name] = [...bucket.values()].map((value) => structuredClone(value));
    return result;
  }
}

export class CloudStore implements Store {
  constructor(private readonly database: any, private readonly transaction: any = null) {}

  private collection(name: string): any {
    return (this.transaction || this.database).collection(name);
  }

  async get(collection: string, id: string): Promise<Document | null> {
    try {
      const result = await this.collection(collection).doc(id).get();
      return result.data || null;
    } catch (error: any) {
      if (String(error?.errCode || error?.message || "").includes("DOCUMENT_NOT_FOUND")) return null;
      if (error?.errCode === -1) return null;
      throw error;
    }
  }

  async find(collection: string, where: Where = {}, limit = 100, offset = 0): Promise<Document[]> {
    let query = this.collection(collection);
    if (Object.keys(where).length) query = query.where(where);
    const result = await query.skip(offset).limit(Math.min(limit, 100)).get();
    return result.data || [];
  }

  async put(collection: string, id: string, data: Record<string, unknown>): Promise<Document> {
    const { _id: _ignored, ...clean } = data as Record<string, unknown> & { _id?: unknown };
    await this.collection(collection).doc(id).set({ data: clean });
    return { ...data, _id: id } as Document;
  }

  async add(collection: string, data: Record<string, unknown>, id = randomId("doc")): Promise<Document> {
    return this.put(collection, id, data);
  }

  async update(collection: string, id: string, patch: Record<string, unknown>): Promise<Document> {
    await this.collection(collection).doc(id).update({ data: patch });
    const updated = await this.get(collection, id);
    if (!updated) throw new Error(`Missing document after update ${collection}/${id}`);
    return updated;
  }

  async delete(collection: string, id: string): Promise<void> {
    await this.collection(collection).doc(id).remove();
  }

  async runTransaction<T>(callback: (transaction: Store) => Promise<T>): Promise<T> {
    if (this.transaction) return callback(this);
    return this.database.runTransaction(async (transaction: any) => callback(new CloudStore(this.database, transaction)));
  }
}
