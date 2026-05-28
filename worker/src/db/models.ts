import mongoose, { Schema, Document } from 'mongoose';

// Model for KVNamespace mock
export interface IKVStore extends Document {
  key: string;
  value: string; // we'll store everything as string (JSON stringified if needed)
  namespace: string; // in case we want multiple KV namespaces, though here we just need one
  updatedAt: Date;
}

const KVStoreSchema = new Schema<IKVStore>({
  key: { type: String, required: true, index: true },
  value: { type: String, required: true },
  namespace: { type: String, required: true, index: true },
  updatedAt: { type: Date, default: Date.now }
});

// Ensure uniqueness per namespace and key
KVStoreSchema.index({ namespace: 1, key: 1 }, { unique: true });

export const KVStore = mongoose.models.KVStore || mongoose.model<IKVStore>('KVStore', KVStoreSchema);

// Model for R2Bucket mock
export interface IR2Object extends Document {
  key: string;
  bucket: string;
  content: string; // The file content
  size: number;
  uploaded: Date;
}

const R2ObjectSchema = new Schema<IR2Object>({
  key: { type: String, required: true, index: true },
  bucket: { type: String, required: true, index: true },
  content: { type: String, required: true },
  size: { type: Number, required: true },
  uploaded: { type: Date, default: Date.now }
});

R2ObjectSchema.index({ bucket: 1, key: 1 }, { unique: true });

export const R2Object = mongoose.models.R2Object || mongoose.model<IR2Object>('R2Object', R2ObjectSchema);
