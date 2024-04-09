import { Router } from "express";
import User, { IDocument } from "../schemas/user.model";
import fs from "fs";
import multer from "multer";
import path from "path";
// Get the pdf loader from langchain
import { PDFLoader } from "langchain/document_loaders/fs/pdf";
// import the RecursiveCharacterTextSplitter from langchain
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
// We will use open ai embeddings from langchain and import it
import { OpenAIEmbeddings } from "@langchain/openai";
// Use HNSWLib as our vector db
import { HNSWLib } from "@langchain/community/vectorstores/hnswlib";
// import the chain for connecting llm with vectore store
import { RetrievalQAChain } from "langchain/chains";
// import the open ai function to load our LLM model
import { OpenAI } from "@langchain/openai";

import { Pinecone } from "@pinecone-database/pinecone";
import { PineconeStore } from "@langchain/pinecone";
import { ChatAnthropic } from "@langchain/anthropic";
import { v4 as uuid } from "uuid";

import { FaissStore } from "@langchain/community/vectorstores/faiss";
import { ConversationalRetrievalQAChain } from "langchain/chains";
import { BufferMemory } from "langchain/memory";
import {
  ChatPromptTemplate,
  PromptTemplate,
  SystemMessagePromptTemplate,
  AIMessagePromptTemplate,
  HumanMessagePromptTemplate,
} from "langchain/prompts";
import { AIMessage, HumanMessage, SystemMessage } from "langchain/schema";
import { ChatOpenAI } from "@langchain/openai";
import mongoose from "mongoose";
import { initPineconeClient } from "../lib/pinecone-clinet";
import { embedAndStoreDocs } from "../lib/vector-store";
import { QA_TEMPLATE } from "../lib/prompt-templates";
import { STANDALONE_QUESTION_TEMPLATE } from "../lib/prompt-templates";
import { initializePineconeStore } from "../services/PineconeService";
import {
  genResWithAllDocs,
  genRestWithSimilarity,
} from "../services/GenResponseSerivces";
import { Request, Response } from "express-serve-static-core";
import { ParsedQs } from "qs";

const chatGPT = Router();

// Multer configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/"); // File uploads will be stored in the 'uploads' directory
  },
  filename: function (req, file, cb) {
    console.log("file", file);
    // You can customize the filename here if needed
    cb(null, file.originalname);
  },
});
const upload = multer({ storage: storage });
export interface IFolder {
  folderName: string;
  documents: IDocument[];
}
chatGPT.post("/uploadFiles", upload.any(), async (req, res) => {
  try {
    const { id } = req.body;

    // Find the user
    const user = await User.findById(id);

    if (!user) {
      throw new Error("User not found");
    }
    // Access the uploaded files via req.files array
    const files = Array.isArray(req.files)
      ? req.files
      : Object.values(req.files);
    const fileNames: IDocument[] = files.map((file) => ({
      fileName: file.filename,
      bookTitle: "",
    }));
    const folderName = req.body.folderName;
    console.log("folderName", folderName);
    if (
      folderName == "undefined" ||
      folderName == "" ||
      folderName == undefined
    ) {
      await User.updateOne({ _id: id }, { $push: { documents: fileNames } });
    } else {
      const data: IFolder = {
        folderName: folderName,
        documents: fileNames,
      };
      // Check if the folder already exists
      const folder = user.folders.find(
        (folder) => folder.folderName === data.folderName
      );

      if (folder) {
        // If the folder exists, add to its documents array
        await User.updateOne(
          { _id: id, "folders.folderName": data.folderName },
          { $addToSet: { "folders.$.documents": { $each: data.documents } } }
        );
      } else {
        // If the folder doesn't exist, add a new folder
        await User.findByIdAndUpdate(
          id,
          { $push: { folders: data } },
          { new: true, useFindAndModify: false }
        );
      }
    }

    res.send("Files uploaded successfully");
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});

chatGPT.post("/moveToFolder", async (req, res) => {
  try {
    const { id, folderName, fileName } = req.body;
    await User.updateOne(
      { _id: id },
      { $pull: { documents: { fileName: fileName } } }
    );
    await User.updateOne(
      { _id: id, "folders.folderName": folderName },
      { $addToSet: { "folders.$.documents": { fileName: fileName } } }
    );
    res.send("Document moved successfully");
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});

chatGPT.post("/deleteFolder", async (req, res) => {
  try {
    console.log(req.body);
    const folderName = req.body.folderName;
    const id = req.body.id;
    await User.findByIdAndUpdate(
      id,
      { $pull: { folders: { folderName: folderName } } },
      { new: true, useFindAndModify: false }
    );
    res.send("Folder deleted successfully");
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});

chatGPT.post("/deleteDocument", async (req, res) => {
  try {
    console.log(req.body);
    const fileName = req.body.fileName;
    const folderName = req.body.folderName;
    const id = req.body.id;
    if (!folderName) {
      await User.updateOne(
        { _id: id },
        { $pull: { documents: { fileName: fileName } } }
      );
    } else {
      await User.updateOne(
        { _id: id, "folders.folderName": folderName },
        { $pull: { "folders.$.documents": { fileName: fileName } } }
      );
    }
    res.send("Folder deleted successfully");
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});

chatGPT.post("/generateResponse", async (req, res) => {
  try {
    const type = req.body.type;
    if (type === "document") {
      genResWithAllDocs(req, res);
    } else {
      genRestWithSimilarity(req, res);
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});
chatGPT.post("/loadChatHistory", async (req, res) => {
  try {
    console.log(req.body);
    const id = req.body.id;
    const type = req.body.type;
    const name = req.body.name;
    const user = await User.findById(id);
    let chat_history;
    if (type === "allDocuments") {
      chat_history = user.history.find((item) => item.type === type);
    } else {
      chat_history = user.history.find(
        (item) => item.name === name && item.type === type
      );
    }
    console.log("chat_history", chat_history);
    res.send(chat_history ? chat_history.history : []);
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});

chatGPT.post("/clearHistory", async (req, res) => {
  try {
    const id = req.body.id;
    const type = req.body.type;
    const name = req.body.name;
    await User.updateOne(
      { _id: id, "history.name": name, "history.type": type },
      { $set: { "history.$[elem].history": [] } },
      { arrayFilters: [{ "elem.name": name, "elem.type": type }] }
    );
    res.send("Chat history cleared successfully");
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});

export default chatGPT;
