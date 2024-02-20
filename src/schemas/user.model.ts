import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcrypt';


interface IChatHitory{
  role:string;
  content:string;
}
interface IHistory{
  type: string;
  name:string;
  history: IChatHitory[];
}
interface IUser extends Document {
  email: string;
  password: string;
  folders: [
    {
      folderName: string;
      documents: string[];
    },
  ];
  documents: string[];
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
    ,
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
          },
        ],
      },
    ],
  },
  { timestamps: true },
);

export default mongoose.model<IUser>('User', UserSchema);
