import { KVStore } from '../db/models';

export class MongoKVNamespace {
  private namespace: string;

  constructor(namespace: string) {
    this.namespace = namespace;
  }

  async get(key: string, typeOrOptions?: any): Promise<any> {
    const doc = await KVStore.findOne({ namespace: this.namespace, key });
    if (!doc) return null;

    const valueType = typeof typeOrOptions === 'string' ? typeOrOptions : typeOrOptions?.type || 'text';

    if (valueType === 'json') {
      try {
        return JSON.parse(doc.value);
      } catch (e) {
        return null;
      }
    }
    
    // For our project, we only ever use text or json.
    return doc.value;
  }

  async getWithMetadata<T = unknown>(key: string, type?: any): Promise<any> {
    const val = await this.get(key, type);
    return {
      value: val,
      metadata: null,
    };
  }

  async put(key: string, value: string | ArrayBuffer | ArrayBufferView | ReadableStream, options?: any): Promise<void> {
    // For this project, value is always a string
    const strValue = typeof value === 'string' ? value : String(value);

    await KVStore.findOneAndUpdate(
      { namespace: this.namespace, key },
      { value: strValue, updatedAt: new Date() },
      { upsert: true, returnDocument: 'after' }
    );
  }

  async delete(key: string): Promise<void> {
    await KVStore.deleteOne({ namespace: this.namespace, key });
  }

  async list(options?: any): Promise<any> {
    // Simulate list if needed, though projectRoutes doesn't seem to use METADATA.list()
    const prefix = options?.prefix || '';
    const docs = await KVStore.find({
      namespace: this.namespace,
      key: prefix ? { $regex: `^${prefix}` } : { $exists: true }
    }).select('key').lean();

    return {
      keys: docs.map((d: any) => ({ name: d.key })),
      list_complete: true,
      cursor: ''
    };
  }
}
