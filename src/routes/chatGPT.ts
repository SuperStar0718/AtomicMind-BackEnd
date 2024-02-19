import { Router } from "express";
import User from "../schemas/user.model";

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
export interface IFolder{
  folderName: string;
  documents: string[];
}
chatGPT.post("/uploadFiles", upload.any(), async (req, res) => {
  // Access the uploaded files via req.files array
  console.log("fiels:",req.files);
  console.log("id:",req.body.id);
  console.log(req.body.folderName);
  const files = Array.isArray(req.files) ? req.files : Object.values(req.files);
  const fileNames = files.map((file) => file.filename);
  const folderName = req.body.folderName;
  const data : IFolder[] = [{
    folderName: folderName,
    documents: fileNames
  }];

  //find user and update user data
  await User.findByIdAndUpdate(
     req.body.id ,
     { folders: data } ,
     { new: true ,useFindAndModify: false },
  );

  res.send("Files uploaded successfully");
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
    const prompt = req.body.prompt;
    // Call the ChatGPT API here
    // Initialize it with the path to the pdf file
    const loader = new PDFLoader(`uploads/${req.body.file}`);

    // Create encoding to convert token (string) to Uint8Array
    const encoder = new TextEncoder();
    // Load into docs variable
    const docs = await loader.load();

    // Initialize it with chunksize and chunkOverlap
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 10000,
      chunkOverlap: 20,
    });
    // created chunks from pdf
    const splittedDocs = await splitter.splitDocuments(docs);
    /**
     * The OpenAI instance used for making API calls.
     * @type {OpenAI}
     */
    const streamingModel = new ChatOpenAI({
      modelName: "gpt-4-turbo-preview",
      temperature: 0.7,
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

    // Init open ai embeddings
    const embeddings = new OpenAIEmbeddings();

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
        returnSourceDocuments: true,
        memory: new BufferMemory({
          memoryKey: "chat_history",
          inputKey: "question", // The key for the input to the chain
          outputKey: "text", // The key for the final conversational output of the chain
          returnMessages: true, // If using with a chat model
        }),
      }
    );

    const messages = [
      {
        role: "system",
        content: `You are ChatGPT, a language model trained to act as chatbot. You are analyzing the data from PDFs. This data should be considered a PDF. You are a general answering assistant that can comply with any request.You always answer the with markdown formatting with paragraph structures.  `,
      },
      {
        role: "user",
        content: prompt,
      },
    ];
    console.log("propmt", prompt);
    const response = await chain.call({
      question: JSON.stringify(messages),
    });
    console.log("res", response);
    // await streams.readable.pipeTo(res.writable);
    // res.send(await streams.readable);
    //send response to the client stream.readable
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});

export default chatGPT;
