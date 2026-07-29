import { model, Schema } from 'mongoose';

/**
 * Atomic sequence source, one document per named sequence.
 *
 * Order numbers and invoice numbers both come from here rather than from a
 * timestamp or a `countDocuments()` call. Two customers checking out in the
 * same millisecond would collide on a timestamp, and counting existing rows is
 * a read-then-write race. GST rules additionally require invoice numbers to be
 * gapless and sequential within a financial year, which only an atomic
 * `$inc` can promise.
 */
export interface CounterDoc {
  _id: string;
  seq: number;
}

const counterSchema = new Schema<CounterDoc>(
  {
    _id: { type: String, required: true },
    seq: { type: Number, required: true, default: 0 },
  },
  { versionKey: false },
);

export const Counter = model<CounterDoc>('Counter', counterSchema);
