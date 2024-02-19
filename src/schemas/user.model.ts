import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcrypt';

interface IUser extends Document {
  email: string;
  password: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema: Schema = new Schema(
  {
    
    email: {
      type: String,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    folders: [
      {
        folderName: {
          type: String,
          required: true,
        },
        documents: [
          {
            type: String,
            required:true,
          },
        ],
      },
    ],
    documents: [
      {
        type: String,
        required: true,
      },
    ]
  },
  { timestamps: true },
);

export default mongoose.model<IUser>('User', UserSchema);
