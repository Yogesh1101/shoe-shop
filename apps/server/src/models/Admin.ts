import { type HydratedDocument, model, Schema } from 'mongoose';

export interface AdminDoc {
  email: string;
  passwordHash: string;
  /**
   * Bumped on password change. Any access token issued before this timestamp is
   * rejected, so changing the password immediately invalidates sessions
   * elsewhere rather than leaving them alive until they expire.
   */
  tokensValidFrom: Date;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const adminSchema = new Schema<AdminDoc>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // Only ever the bcrypt hash. `select: false` keeps it out of query results
    // unless explicitly asked for, so it cannot be serialised into a response
    // by an accidental `res.json(admin)`.
    passwordHash: { type: String, required: true, select: false },
    tokensValidFrom: { type: Date, required: true, default: Date.now },
    lastLoginAt: { type: Date },
  },
  { timestamps: true },
);

export type AdminDocument = HydratedDocument<AdminDoc>;

export const Admin = model<AdminDoc>('Admin', adminSchema);
