import mongoose, { Document, Schema } from "mongoose";
import bcrypt from "bcrypt";

interface ISetting extends Document {
  streamTemperature: number;
  nonStreamTemperature: number;
  chunkSize: number;
  chunkOverlap: number;
  systemPrompt: string;
  streamingModel: string;
  nonStreamingModel: string;
  createdAt: Date;
  updatedAt: Date;
}

const SettingSchema: Schema = new Schema(
  {
    streamTemperature: {
      type: Number,
      required: true,
    },
    nonStreamTemperature: {
      type: Number,
      required: true,
    },
    chunkSize: {
      type: Number,
      required: true,
    },
    chunkOverlap: {
      type: Number,
      required: true,
    },
    systemPrompt: {
      type: String,
      required: true,
    },
    streamingModel: {
      type: String,
      required: true,
    },
    nonStreamingModel: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model<ISetting>("Setting", SettingSchema);
