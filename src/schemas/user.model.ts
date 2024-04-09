import mongoose, { Document, Schema } from "mongoose";
import bcrypt from "bcrypt";

interface IChatHitory {
  role: string;
  content: string;
  sourceDocuments: any[];
}

interface IHistory {
  type: string;
  name: string;
  history: IChatHitory[];
}

export interface IDocument {
  fileName: string;
  bookTitle: string;
}

enum Role{
  ADMIN = 'ADMIN',
  USER = 'USER',
}

interface IUser extends Document {
  email: string;
  password: string;
  role: Role;
  folders: [
    {
      folderName: string;
      documents: IDocument[];
    }
  ];
  documents: IDocument[];
  history: IHistory[];
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
    role: {
      type: String,
      enum: Object.values(Role),
      default: Role.USER,
    },
    folders: [
      {
        folderName: {
          type: String,
          required: true,
        },
        documents: [
          {
            fileName: {
              type: String,
              required: true,
            },
            bookTitle: {
              type: String,
            },
          },
        ],
      },
    ],
    documents: [
      {
        fileName: {
          type: String,
          required: true,
        },
        bookTitle: {
          type: String,
        },
      },
    ],
    history: [
      {
        type: {
          type: String,
          required: true,
        },
        name: {
          type: String,
        },
        history: [
          {
            role: {
              type: String,
              required: true,
            },
            content: {
              type: String,
              required: true,
            },
            sourceDocuments: [
              {
                type: Object,
              },
            ],
          },
        ],
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model<IUser>("User", UserSchema);
