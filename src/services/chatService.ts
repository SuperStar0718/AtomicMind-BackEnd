import User from "../schemas/user.model";
// Get the pdf loader from langchain
import { PDFLoader } from "langchain/document_loaders/fs/pdf";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import {
  HumanMessage,
  AIMessage,
  SystemMessage,
} from "@langchain/core/messages";

import { AIChatMessage, HumanChatMessage } from "langchain/schema";

// import the RecursiveCharacterTextSplitter from langchain
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

export async function getSpliteDocument(type, id, name) {
  let splittedDocs = [];
  const processDocuments = async (fileName) => {
    const loader = new PDFLoader(`uploads/${fileName}`);
    const docs = await loader.load();
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 10000,
      chunkOverlap: 2000,
    });
    return splitter.splitDocuments(docs);
  };

  // Call the ChatGPT API here
  if (type === "document") {
    const loader = new PDFLoader(`uploads/${name}`);
    const docs = await loader.load();
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 10000,
      chunkOverlap: 2000,
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
      splittedDocs = await Promise.all(docPromises).then((docs) => docs.flat());
    });

    const docPromises = user.documents.map(processDocuments);
    splittedDocs = await Promise.all(docPromises).then((docs) => docs.flat());
  }
  return splittedDocs;
}

export async function getChatHistory(type, id, name) {
  const user = await User.findById(id);
  let chat_history;
  if (type === "allDocuments") {
    chat_history = user.history.find((item) => item.type === type);
  } else {
    chat_history = user.history.find(
      (item) => item.name === name && item.type === type
    );
  }
  return chat_history.history;
}

export async function updateChatHistory(
  type,
  name,
  id,
  prompt,
  response,
  chat_history
) {
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
}

export function generateChatHisotry(chat_history, prompt) {
  let messages = [];
  if (chat_history.length > 0) {
    chat_history.forEach((item) => {
      if (item.role === "assistant") {
        messages.push(new AIMessage(item.content));
      } else messages.push(new HumanMessage(item.content));
    });
  }
  messages.push(new HumanMessage(prompt));
  console.log("messages:", messages);
  console.log("prompt:", prompt);
  return messages;
}

export const queryTransformPrompt = ChatPromptTemplate.fromMessages([
  new MessagesPlaceholder("messages"),
  [
    "user",
    "Given the above conversation, generate a response in order to get information relevant to the conversation. Only respond with the query, nothing else.",
  ],
]);

export const SYSTEM_TEMPLATE = `Answer the user's questions based on the below context. 
  If the context doesn't contain any relevant information to the question, don't make something up and just say "I don't know":
  
  <context>
  {context}
  </context>
  `;
