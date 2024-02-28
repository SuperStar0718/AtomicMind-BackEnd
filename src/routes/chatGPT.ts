import { Router } from "express";
import User from "../schemas/user.model";
import fs from "fs";
import multer from "multer";
import path from "path";
// Get the pdf loader from langchain
import { PDFLoader } from "langchain/document_loaders/fs/pdf";

import { AIChatMessage, HumanChatMessage } from "langchain/schema";

// import the RecursiveCharacterTextSplitter from langchain
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
// We will use open ai embeddings from langchain and import it
import { OpenAIEmbeddings } from "@langchain/openai";
// Use HNSWLib as our vector db
import { HNSWLib } from "@langchain/community/vectorstores/hnswlib";
import { ChatAnthropic } from "@langchain/anthropic";
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
  MessagesPlaceholder,
  PromptTemplate,
  SystemMessagePromptTemplate,
  AIMessagePromptTemplate,
  HumanMessagePromptTemplate,
} from "@langchain/core/prompts";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import mongoose from "mongoose";
import { initPineconeClient } from "../lib/pinecone-clinet";
import { embedAndStoreDocs } from "../lib/vector-store";
import { nonStreamModel } from "../lib/llm";
import { QA_TEMPLATE } from "../lib/prompt-templates";
import { STANDALONE_QUESTION_TEMPLATE } from "../lib/prompt-templates";
import {
  getSpliteDocument,
  getChatHistory,
  updateChatHistory,
  SYSTEM_TEMPLATE,
  queryTransformPrompt,
  generateChatHisotry,
} from "../services/chatService";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { RunnableBranch } from "@langchain/core/runnables";
import type { BaseMessage } from "@langchain/core/messages";
import {
  RunnablePassthrough,
  RunnableSequence,
} from "@langchain/core/runnables";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { StringOutputParser } from "@langchain/core/output_parsers";

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
    // res.writeHead(200, {
    //   "Content-Type": "text/event-stream",
    //   "Cache-Control": "no-cache",
    //   Connection: "keep-alive",
    // });

    console.log(req.body);
    const prompt = req.body.prompt.content;
    const id = req.body.id;
    const type = req.body.type;
    const name = req.body.name;

    const splittedDocs = await getSpliteDocument(type, id, name);

    const model = new ChatAnthropic({
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
      temperature: 0.8,
      modelName: "claude-2.1",
      // streaming: true,
      // callbacks: [
      //   {
      //     async handleLLMNewToken(token) {
      //       // console.log("Token:", token);
      //       res.write(`data: ${JSON.stringify(token)}\n\n`);
      //       res.flushHeaders();
      //     },
      //     async handleLLMEnd() {
      //       res.end();
      //     },
      //   },
      // ],
    });

    // const embeddings = new OpenAIEmbeddings();

    // Finally store our splitted chunks with open ai embeddings
    // const vectorStore = await HNSWLib.fromDocuments(splittedDocs, embeddings);

    const vectorStore = await MemoryVectorStore.fromDocuments(
      splittedDocs,
      new OpenAIEmbeddings()
    );

    // Load the docs into the vector store
    // const vectorStore = await FaissStore.fromDocuments(
    //   splittedDocs,
    //   new OpenAIEmbeddings({ openAIApiKey: process.env.OPENAI_API_KEY })
    // );

    const vectorStoreRetriever = vectorStore.asRetriever(4);
    // console.log('vectorStoreRetriever:', vectorStoreRetriever)

    const doc = await vectorStoreRetriever.invoke("who is maksym?");


    const questionAnsweringPrompt = ChatPromptTemplate.fromMessages([
      ["system", SYSTEM_TEMPLATE],
      new MessagesPlaceholder("messages"),
    ]);

    const chat_history = await getChatHistory(type, id, name);
    // console.log("chat_history:", chat_history);




    const queryTransformingRetrieverChain = RunnableBranch.from([
      
      queryTransformPrompt
        .pipe(model)
        .pipe(new StringOutputParser())
        .pipe(vectorStoreRetriever),
    ]).withConfig({ runName: "chat_retriever_chain" });

    const documentChain = await createStuffDocumentsChain({
      llm: model,
      prompt: questionAnsweringPrompt,
    });

    const docs = await vectorStoreRetriever.invoke("what is the title of chapter 1?");
    // console.log('docs:',docs);
    const result = await documentChain.invoke({
      messages: [new HumanMessage("what is the title of chapter 1?")],
      context: docs,
    });

    console.log('result:', result)
    return;

    const conversationalRetrievalChain = RunnablePassthrough.assign({
      context: queryTransformingRetrieverChain,
    }).assign({
      answer: documentChain,
    });

    const messages = generateChatHisotry(chat_history, prompt);
    console.log('messages:', messages)
    const stream = await conversationalRetrievalChain.stream({
      messages: [
        new HumanMessage("Can LangSmith help test my LLM applications?"),
        new AIMessage(
          "Yes, LangSmith can help test and evaluate your LLM applications. It allows you to quickly edit examples and add them to datasets to expand the surface area of your evaluation sets or to fine-tune a model for improved quality or reduced costs. Additionally, LangSmith can be used to monitor your application, log all traces, visualize latency and token usage statistics, and troubleshoot specific issues as they arise."
        ),
        new HumanMessage("Tell me more!"),
      ],
    });
    let response = "";
    for await (const chunk of stream) {
      console.log('chunk:', chunk);
      // response += chunk.answer;
      // res.write(`data: ${JSON.stringify(chunk.text)}\n\n`);
      // res.flushHeaders();
    }
    // res.end();
    console.log('response:', response)

    await updateChatHistory(type, name, id, prompt, response, chat_history);
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
