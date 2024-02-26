import { Router } from "express";
import User from "../schemas/user.model";
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
import { nonStreamModel } from "../lib/llm";
import { QA_TEMPLATE } from "../lib/prompt-templates";
import { STANDALONE_QUESTION_TEMPLATE } from "../lib/prompt-templates";

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
  documents: string[];
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
    const fileNames = files.map((file) => file.filename);
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
    const documentName = req.body.documentName;
    const folderName = req.body.folderName;
    const id = req.body.id;

    await User.updateOne(
      { _id: id, "folders.folderName": folderName },
      { $pull: { "folders.$.documents": documentName } }
    );
    res.send("Folder deleted successfully");
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});

chatGPT.post("/generateResponse", async (req, res) => {
  try {
    // Set headers for SSE
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    console.log(req.body);
    const prompt = req.body.prompt.content;
    const id = req.body.id;
    const type = req.body.type;
    const name = req.body.name;

    let splittedDocs = [];
    const processDocuments = async (fileName) => {
      const loader = new PDFLoader(`uploads/${fileName}`);
      const docs = await loader.load();
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200,
      });
      return splitter.splitDocuments(docs);
    };

    // Call the ChatGPT API here
    if (type === "document") {
      const loader = new PDFLoader(`uploads/${name}`);
      const docs = await loader.load();
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 100,
        chunkOverlap: 10,
      });
      splittedDocs = await splitter.splitDocuments(docs);
    } else if (type === "folder") {
      const documents = await User.findById(id, {
        folders: { $elemMatch: { folderName: name } },
      });
      const fileNames = documents.folders[0].documents;

      const docPromises = fileNames.map(processDocuments);
      splittedDocs = await Promise.all(docPromises).then((docs) => docs.flat());
    } else {
      const user = await User.findById(id);
      user.folders.forEach(async (folder) => {
        const fileNames = folder.documents;
        const docPromises = fileNames.map(processDocuments);
        splittedDocs = await Promise.all(docPromises).then((docs) =>
          docs.flat()
        );
      });

      const docPromises = user.documents.map(processDocuments);
      splittedDocs = await Promise.all(docPromises).then((docs) => docs.flat());
    }
    /**
     * The OpenAI instance used for making API calls.
     * @type {OpenAI}
     */
    const streamingModel = new ChatOpenAI({
      modelName: "gpt-4-turbo-preview",
      temperature: 0.1,
      openAIApiKey: process.env.OPENAI_API_KEY,
      streaming: true,
      callbacks: [
        {
          async handleLLMNewToken(token) {
            // console.log("Token:", token);
            res.write(`data: ${JSON.stringify(token)}\n\n`);
            res.flushHeaders();
          },
          async handleLLMEnd() {
            res.end();
          },
        },
      ],
    });

    // Instantiate a new Pinecone client, which will automatically read the
    // env vars: PINECONE_API_KEY and PINECONE_ENVIRONMENT which come from
    // the Pinecone dashboard at https://app.pinecone.io

    // const pinecone = new Pinecone({
    //   apiKey: process.env.PINECONE_API_KEY!
    // });

    // const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX_NAME!);
    // // console.log('pineconeIndex', pineconeIndex);
    const embeddings = new OpenAIEmbeddings();
    // const pineconeStore = new PineconeStore(embeddings, { pineconeIndex });

    // //embed the PDF documents
    // const vectorStore = await PineconeStore.fromDocuments(splittedDocs, embeddings, {
    //   pineconeIndex: pineconeIndex,
    //   namespace: 'atomicask',
    //   textKey: 'text',
    // });

    const pinecone = await initPineconeClient();
    // const vectorStore = await embedAndStoreDocs(pinecone, splittedDocs);

    // Finally store our splitted chunks with open ai embeddings
    const vectorStore = await HNSWLib.fromDocuments(splittedDocs, embeddings);

    // Load the docs into the vector store
    // const vectorStore = await FaissStore.fromDocuments(
    //   splittedDocs,
    //   new OpenAIEmbeddings({ openAIApiKey: process.env.OPENAI_API_KEY })
    // );

    const vectorStoreRetriever = vectorStore.asRetriever();

    /**
     * Represents a conversational retrieval QA chain.
     */
    const chain = ConversationalRetrievalQAChain.fromLLM(
      streamingModel,
      vectorStoreRetriever,
      {
        questionGeneratorChainOptions: {
          llm: nonStreamModel,
        },
        returnSourceDocuments: true,
        memory: new BufferMemory({
          memoryKey: "chat_history",
          inputKey: "question", // The key for the input to the chain
          outputKey: "text", // The key for the final conversational output of the chain
          returnMessages: true, // If using with a chat model
        }),
      }
    );

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

    const messages = [
      {
        role: "system",
        content: `You are ChatGPT, a language model trained to act as chatbot. You are analyzing the data from PDFs. This data should be considered a PDF. You are a general answering assistant that can comply with any request.You always answer the with markdown formatting with paragraph structures.  `,
      },
      chat_history ? { ...chat_history.history } : [],
      {
        role: "user",
        content: prompt,
      },
    ];
    console.log("messages", messages);
    const response = await chain.call({
      question: prompt,
      chat_history: chat_history,
    });
    // console.log("res:", response);
    // await fs.promises.writeFile(
    //   path.join(__dirname, "../chat_history.json"),
    //   JSON.stringify(response)
    // );

    if (chat_history) {
      console.log("exists:", type, name);
      await User.findOneAndUpdate(
        { _id: id, "history.name": name, "history.type": type },
        {
          $push: {
            "history.$[elem].history": [
              { role: "user", content: prompt },
              { role: "assistant", content: response.text },
            ],
          },
        },
        { arrayFilters: [{ "elem.name": name, "elem.type": type }] }
      );
    } else {
      console.log("doesnt exists:", type, name);
      await User.updateOne(
        { _id: id },
        {
          $addToSet: {
            history: {
              type: type,
              name: name,
              history: [
                { role: "user", content: prompt },
                { role: "assistant", content: response.text },
              ],
            },
          },
        }
      );
    }

    // await streams.readable.pipeTo(res.writable);
    // res.send(await streams.readable);
    //send response to the client stream.readable
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
