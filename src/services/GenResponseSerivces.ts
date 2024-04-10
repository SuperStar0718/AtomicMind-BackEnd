import { PDFLoader } from "langchain/document_loaders/fs/pdf";
import User from "../schemas/user.model";
import Setting from "../schemas/setting.model";
import { Pinecone } from "@pinecone-database/pinecone";
import { PineconeStore } from "@langchain/pinecone";
import { ChatAnthropic } from "@langchain/anthropic";
import { ConversationalRetrievalQAChain } from "langchain/chains";
import { BufferMemory } from "langchain/memory";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { ChatOpenAI } from "@langchain/openai";
import { OpenAIEmbeddings } from "@langchain/openai";
import fs from "fs";
import multer from "multer";
import path from "path";

export const genResWithAllDocs = async (req: any, res: any) => {
  try {
    // Set headers for SSE
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    //get system settings
    const settings = await Setting.findOne();
    console.log("settings:", settings);

    const prompt = req.body.prompt.content;
    const id = req.body.id;
    const type = req.body.type;
    const name = req.body.name;
    const documentTitle = req.body.documentTitle;
    const folderName = req.body.folderName;

    //update bookTitle with documentTitle that matches with type and name

    try {
      await User.findOneAndUpdate(
        { _id: id, "documents.fileName": name },
        { $set: { "documents.$.bookTitle": documentTitle } }
      );
    } catch (err) {
      console.log("Error updating bookTitle", err);
    }

    try {
      await User.findOneAndUpdate(
        { _id: id, "folders.folderName": folderName },
        {
          $set: {
            "folders.$[elem].documents.$[elem2].bookTitle": documentTitle,
          },
        },
        {
          arrayFilters: [
            { "elem.folderName": folderName },
            { "elem2.fileName": name },
          ],
          new: true,
        }
      );
    } catch (err) {
      console.log("Error updating bookTitle", err);
    }

    let splittedDocs = [],
      docs;
    const processDocuments = async (fileName) => {
      const loader = new PDFLoader(`uploads/${fileName}`);
      docs = await loader.load();
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: settings.chunkSize,
        chunkOverlap: settings.chunkOverlap,
      });
      return splitter.splitDocuments(docs);
    };
    // Call the ChatGPT API here
    if (type === "document") {
      const loader = new PDFLoader(`uploads/${name}`);
      docs = await loader.load();
      //  console.log("docs", docs)
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: settings.chunkSize,
        chunkOverlap: settings.chunkOverlap,
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

    //check if streaming model is claude3 or gpt4 model
    let streamingModel;
    if (settings.streamingModel.includes("claude")) {
      streamingModel = new ChatAnthropic({
        modelName: settings.streamingModel,
        temperature: settings.streamTemperature,
        maxTokens: 4096,
        anthropicApiKey: process.env.ANTHROPIC_API_KEY,
        streaming: true,
        callbacks: [
          {
            async handleLLMNewToken(token) {
              // console.log("Token:", token);
              res.write(`data: ${JSON.stringify(token)}\n\n`);
              res.flushHeaders();
            },
            async handleLLMEnd() {
              // res.end();
            },
          },
        ],
      });
    } else if (settings.streamingModel.includes("gpt")) {
      streamingModel = new ChatOpenAI({
        modelName: settings.streamingModel,
        temperature: settings.streamTemperature,
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
              // res.end();
            },
          },
        ],
      });
    }

    // const streamingModel = new ChatAnthropic({
    //   modelName: "claude-3-haiku-20240307",
    //   temperature: settings.streamTemperature,
    //   maxTokens: 4096,
    //   anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    //   streaming: true,
    //   callbacks: [
    //     {
    //       async handleLLMNewToken(token) {
    //         // console.log("Token:", token);
    //         res.write(`data: ${JSON.stringify(token)}\n\n`);
    //         res.flushHeaders();
    //       },
    //       async handleLLMEnd() {
    //         // res.end();
    //       },
    //     },
    //   ],
    // });

    const user = await User.findById(id);
    let chat_history;
    if (type === "allDocuments") {
      chat_history = user.history.find((item) => item.type === type);
    } else {
      chat_history = user.history.find(
        (item) => item.name === name && item.type === type
      );
    }
    const newChatHistory = chat_history?.history?.map(
      ({ role, content, ...rest }) => ({
        role: role,
        content: content,
      })
    );

    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY!,
    });

    const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX_NAME!);
    try {
      await pineconeIndex.namespace("atomicask").deleteAll();
    } catch (e) {
      console.log("Error deleting all", e);
    }

    // console.log('pineconeIndex', pineconeIndex);
    const embeddings = new OpenAIEmbeddings();
    console.log("splited docs:");
    //embed the PDF documents
    await PineconeStore.fromDocuments(splittedDocs, embeddings, {
      pineconeIndex: pineconeIndex,
      namespace: "atomicask",
      textKey: "text",
    });
    console.log("pineconestore");
    while (true) {
      const status = await pineconeIndex.describeIndexStats();
      console.log("Indexed documents:", status.totalRecordCount);

      if (status.totalRecordCount > 0) {
        console.log("Indexed documents:", status.totalRecordCount);
        break;
      }
    }
    const vectorStore = await PineconeStore.fromExistingIndex(
      new OpenAIEmbeddings(),
      { pineconeIndex: pineconeIndex, namespace: "atomicask", textKey: "text" }
    );

    const vectorStoreRetriever = vectorStore.asRetriever(450);

    const STANDALONE_QUESTION_TEMPLATE_1 = `Given the following conversation and a follow up question, rephrase the follow up question to be a standalone question.
    
          Chat History:
          ${newChatHistory
            ?.map((item) => `{role: ${item.role}, content:${item.content}}`)
            .join("\n")}
    
          Follow Up Input: {question}
          Standalone question:
        `;

    const QA_TEMPLATE = settings.systemPrompt;
    console.log(
      "boot title:",
      name ? QA_TEMPLATE.replace("[title of book]", documentTitle) : QA_TEMPLATE
    );

    //check if nonstreammodel is claude or gpt
    let nonStreamModel;
    if (settings.nonStreamingModel.includes("claude")) {
      nonStreamModel = new ChatAnthropic({
        modelName: settings.nonStreamingModel,
        maxTokens: 4000,
        temperature: settings.nonStreamTemperature,
        anthropicApiKey: process.env.ANTHROPIC_API_KEY,
      });
    } else if (settings.nonStreamingModel.includes("gpt")) {
      nonStreamModel = new ChatOpenAI({
        modelName: settings.nonStreamingModel,
        temperature: settings.nonStreamTemperature,
        openAIApiKey: process.env.OPENAI_API_KEY,
      });
    }

    // const nonStreamModel = new ChatAnthropic({
    //   modelName: "claude-3-opus-20240229",
    //   maxTokens: 4000,
    //   temperature: settings.nonStreamTemperature,
    //   anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    // });

    /**
     * Represents a conversational retrieval QA chain.
     */
    const chain = ConversationalRetrievalQAChain.fromLLM(
      streamingModel,
      vectorStoreRetriever,
      {
        questionGeneratorChainOptions: {
          llm: nonStreamModel,
          template: STANDALONE_QUESTION_TEMPLATE_1,
        },
        qaTemplate: name
          ? QA_TEMPLATE.replace("[title of book]", documentTitle)
          : QA_TEMPLATE,
        returnSourceDocuments: true,
        memory: new BufferMemory({
          memoryKey: "chat_history",
          inputKey: "question", // The key for the input to the chain
          outputKey: "text", // The key for the final conversational output of the chain
          returnMessages: true, // If using with a chat model
        }),
      }
    );
    console.log("before call:");
    const response = await chain.call({
      question: prompt,
      chat_history: JSON.stringify(chat_history?.history || []),
    });
    const sourceDocuments = [];
    response.sourceDocuments.forEach((doc) => {
      sourceDocuments.push(doc);
    });
    const slicedDocuments = sourceDocuments.slice(0, 3);
    res.write(
      `data: ${JSON.stringify({ sourceDocuments: slicedDocuments })}\n\n`
    );
    res.end();
    console.log("response ended:");
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
              {
                role: "assistant",
                content: response.text,
                sourceDocuments: slicedDocuments,
              },
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
                {
                  role: "assistant",
                  content: response.text,
                  sourceDocuments: slicedDocuments,
                },
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
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Internal Server Error" }));
    } else {
      // If headers were already sent, we might not be able to send a proper error response
      // It's important to ensure the connection is properly closed in case of an error.
      res.end(); // End the response to close the connection
    }
  }

  // Additional error handling for the response stream
  res.on("error", (error) => {
    console.error("Response stream error:", error);
    // Handle the error, e.g., by logging it. Note that response might be partially sent at this point.
  });
};

export const genRestWithSimilarity = async (req: any, res: any) => {
  try {
    // Set headers for SSE
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    const settings = await Setting.findOne();
    const prompt = req.body.prompt.content;
    const id = req.body.id;
    const type = req.body.type;
    const name = req.body.name;
    const documentTitle = req.body.documentTitle;
    let splittedDocs = [];
    const processDocuments = async (document) => {
      const loader = new PDFLoader(`uploads/${document.fileName}`);
      const docs = await loader.load();
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: settings.chunkSize,
        chunkOverlap: settings.chunkOverlap,
      });
      return splitter.splitDocuments(docs);
    };
    let user;
    // Call the ChatGPT API here
    if (type === "document") {
      const loader = new PDFLoader(`uploads/${name}`);
      const docs = await loader.load();
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: settings.chunkSize,
        chunkOverlap: settings.chunkOverlap,
      });
      splittedDocs = await splitter.splitDocuments(docs);
    } else if (type === "folder") {
      user = await User.findById(id, {
        folders: { $elemMatch: { folderName: name } },
      });
      const documents = user.folders[0].documents;
      const docPromises = documents.map(processDocuments);
      splittedDocs = await Promise.all(docPromises).then((docs) => docs.flat());
    } else {
       user = await User.findById(id);
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

    //check if streaming model is claude or gpt
    let streamingModel;
    if (settings.streamingModel.includes("claude")) {
      streamingModel = new ChatAnthropic({
        modelName: settings.streamingModel,
        temperature: settings.streamTemperature,
        maxTokens: 4096,
        anthropicApiKey: process.env.ANTHROPIC_API_KEY,
        streaming: true,
        callbacks: [
          {
            async handleLLMNewToken(token) {
              // console.log("Token:", token);
              res.write(`data: ${JSON.stringify(token)}\n\n`);
              res.flushHeaders();
            },
            async handleLLMEnd() {
              // res.end();
            },
          },
        ],
      });
    } else if (settings.streamingModel.includes("gpt")) {
      streamingModel = new ChatOpenAI({
        modelName: settings.streamingModel,
        temperature: settings.streamTemperature,
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
              // res.end();
            },
          },
        ],
      });
    }


   
    // const streamingModel = new ChatOpenAI({
    //   modelName: "gpt-4-turbo-preview",

    //   temperature: settings.streamTemperature,

    //   openAIApiKey: process.env.OPENAI_API_KEY,
    //   streaming: true,
    //   callbacks: [
    //     {
    //       async handleLLMNewToken(token) {
    //         // console.log("Token:", token);
    //         res.write(`data: ${JSON.stringify(token)}\n\n`);
    //         res.flushHeaders();
    //       },
    //       async handleLLMEnd() {
    //         // res.end();
    //       },
    //     },
    //   ],
    // });

    user = await User.findById(id);
    let chat_history;
    if (type === "allDocuments") {
      chat_history = user.history.find((item) => item.type === type);
    } else {
      chat_history = user.history.find(
        (item) => item.name === name && item.type === type
      );
    }
    const newChatHistory = chat_history?.history?.map(
      ({ role, content, ...rest }) => ({
        role: role,
        content: content,
      })
    );
    // console.log("chat_history", chat_history.history);
    // console.log("newChatHistory", newChatHistory);

    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY!,
    });

    const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX_NAME!);
    try {
      await pineconeIndex.namespace("atomicask").deleteAll();
    } catch (e) {
      console.log("Error deleting all", e);
    }

    // console.log('pineconeIndex', pineconeIndex);
    const embeddings = new OpenAIEmbeddings();

    //embed the PDF documents
    await PineconeStore.fromDocuments(splittedDocs, embeddings, {
      pineconeIndex: pineconeIndex,
      namespace: "atomicask",
      textKey: "text",
    });

    while (true) {
      const status = await pineconeIndex.describeIndexStats();
      // console.log("Indexed documents:", status.totalRecordCount);

      if (status.totalRecordCount > 0) {
        console.log("Indexed documents:", status.totalRecordCount);
        break;
      }
    }
    const vectorStore = await PineconeStore.fromExistingIndex(
      new OpenAIEmbeddings(),
      { pineconeIndex: pineconeIndex, namespace: "atomicask", textKey: "text" }
    );
    const vectorStoreRetriever = vectorStore.asRetriever(50);

    const STANDALONE_QUESTION_TEMPLATE_1 = `Given the following conversation and a follow up question, rephrase the follow up question to be a standalone question.
    
          Chat History:
          ${newChatHistory
            ?.map((item) => `{role: ${item.role}, content:${item.content}}`)
            .join("\n")}
    
          Follow Up Input: {question}
          Standalone question:
        `;

    console.log(
      "STANDALONE_QUESTION_TEMPLATE_1",
      STANDALONE_QUESTION_TEMPLATE_1
    );

    //check if nonstreaming model is claude or gpt
    let nonStreamModel;
    if (settings.nonStreamingModel.includes("claude")) {
      nonStreamModel = new ChatAnthropic({
        modelName: settings.nonStreamingModel,
        maxTokens: 4000,
        temperature: settings.nonStreamTemperature,
        anthropicApiKey: process.env.ANTHROPIC_API_KEY,
      });
    } else if (settings.nonStreamingModel.includes("gpt")) {
      nonStreamModel = new ChatOpenAI({
        modelName: settings.nonStreamingModel,
        temperature: settings.nonStreamTemperature,
        openAIApiKey: process.env.OPENAI_API_KEY,
      });
    }

    // const nonStreamModel = new ChatAnthropic({
    //   modelName: "claude-3-opus-20240229",
    //   maxTokens: 4000,
    //   temperature: settings.nonStreamTemperature,
    //   anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    // });

    const QA_TEMPLATE = settings.systemPrompt;

    /**
     * Represents a conversational retrieval QA chain.
     */
    const chain = ConversationalRetrievalQAChain.fromLLM(
      streamingModel,
      vectorStoreRetriever,
      {
        questionGeneratorChainOptions: {
          llm: nonStreamModel,
          template: STANDALONE_QUESTION_TEMPLATE_1,
        },
        qaTemplate: QA_TEMPLATE,
        returnSourceDocuments: true,
        memory: new BufferMemory({
          memoryKey: "chat_history",
          inputKey: "question", // The key for the input to the chain
          outputKey: "text", // The key for the final conversational output of the chain
          returnMessages: true, // If using with a chat model
        }),
      }
    );

    const response = await chain.call({
      question: prompt,
      chat_history: JSON.stringify(chat_history?.history || []),
    });
    const sourceDocuments = [];
    response.sourceDocuments.forEach((doc) => {
      sourceDocuments.push(doc);
    });
    const slicedDocuments = sourceDocuments.slice(0, 3);
    res.write(
      `data: ${JSON.stringify({ sourceDocuments: slicedDocuments })}\n\n`
    );
    res.end();
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
              {
                role: "assistant",
                content: response.text,
                sourceDocuments: slicedDocuments,
              },
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
                {
                  role: "assistant",
                  content: response.text,
                  sourceDocuments: slicedDocuments,
                },
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
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Internal Server Error" }));
    } else {
      // If headers were already sent, we might not be able to send a proper error response
      // It's important to ensure the connection is properly closed in case of an error.
      res.end(); // End the response to close the connection
    }
  }

  // Additional error handling for the response stream
  res.on("error", (error) => {
    console.error("Response stream error:", error);
    // Handle the error, e.g., by logging it. Note that response might be partially sent at this point.
  });
};
