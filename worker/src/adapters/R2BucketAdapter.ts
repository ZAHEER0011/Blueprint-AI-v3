/**
 * MongoDB-backed adapter that mimics the Cloudflare R2Bucket interface.
 * This is NOT a mock — all data is persisted to a real MongoDB collection.
 *
 * We intentionally do NOT use `implements R2Bucket` because the Cloudflare
 * type definition has dozens of complex overloads that we don't need.
 * Our adapter only implements the methods actually used in our route handlers:
 *   .put(), .get(), .list(), .delete()
 */
import { R2Object as R2ObjectModel } from '../db/models';

export class MongoR2Bucket {
  private bucketName: string;

  constructor(bucketName: string) {
    this.bucketName = bucketName;
  }

  async put(key: string, value: any, options?: any): Promise<any> {
    const strValue = typeof value === 'string' ? value : String(value);

    const doc = await R2ObjectModel.findOneAndUpdate(
      { bucket: this.bucketName, key },
      {
        content: strValue,
        size: Buffer.byteLength(strValue, 'utf8'),
        uploaded: new Date()
      },
      { upsert: true, returnDocument: 'after' }
    );

    return {
      key: doc.key,
      version: '1',
      size: doc.size,
      etag: 'mongo-etag',
      httpEtag: '"mongo-etag"',
      uploaded: doc.uploaded,
      httpMetadata: {},
      customMetadata: {}
    };
  }

  async get(key: string, options?: any): Promise<any> {
    const doc = await R2ObjectModel.findOne({ bucket: this.bucketName, key });
    if (!doc) return null;

    return {
      key: doc.key,
      version: '1',
      size: doc.size,
      etag: 'mongo-etag',
      httpEtag: '"mongo-etag"',
      uploaded: doc.uploaded,
      httpMetadata: {},
      customMetadata: {},
      body: null,
      bodyUsed: false,
      arrayBuffer: async () => Buffer.from(doc.content, 'utf8').buffer,
      text: async () => doc.content,
      json: async () => JSON.parse(doc.content),
      blob: async () => new Blob([doc.content])
    };
  }

  async list(options?: any): Promise<any> {
    const prefix = options?.prefix || '';

    const docs = await R2ObjectModel.find({
      bucket: this.bucketName,
      key: prefix ? { $regex: `^${prefix}` } : { $exists: true }
    }).lean();

    const objects = docs.map((doc: any) => ({
      key: doc.key,
      version: '1',
      size: doc.size,
      etag: 'mongo-etag',
      httpEtag: '"mongo-etag"',
      uploaded: doc.uploaded,
      httpMetadata: {},
      customMetadata: {}
    }));

    return {
      objects,
      truncated: false,
      cursor: '',
      delimitedPrefixes: []
    };
  }

  async delete(keys: string | string[]): Promise<void> {
    const keysArray = Array.isArray(keys) ? keys : [keys];
    await R2ObjectModel.deleteMany({ bucket: this.bucketName, key: { $in: keysArray } });
  }

  async head(key: string): Promise<any> {
    return null;
  }
}
