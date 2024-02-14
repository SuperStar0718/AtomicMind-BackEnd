import { Router } from "express";
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


chatGPT.post("/uploadFile", upload.single("file"), (req, res) => {
  console.log("req.file", req.file);
  res.send("File uploaded");
});

chatGPT.post("/generateResponse", async (req, res) => {
  try{

    // Call the ChatGPT API here
    // Initialize it with the path to the pdf file
    const loader = new PDFLoader(`uploads/${req.body.file}`);
  
    // Load into docs variable
    const docs = await loader.load();
  
    // Initialize it with chunksize and chunkOverlap
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 20,
    });
    // created chunks from pdf
    const splittedDocs = await splitter.splitDocuments(docs);
  
    // Init open ai embeddings
    const embeddings = new OpenAIEmbeddings();
  
    // Finally store our splitted chunks with open ai embeddings
    const vectorStore = await HNSWLib.fromDocuments(splittedDocs, embeddings);
  
    // Create vector store retriever
    const vectorStoreRetriever = vectorStore.asRetriever();
  
    // init the LLM model
    const model = new OpenAI({
      modelName: "gpt-3.5-turbo",
      openAIApiKey: process.env.OPENAI_API_KEY,
    });
  
    // Finally create the chain to connect both and answer questions
    const chain = RetrievalQAChain.fromLLM(model, vectorStoreRetriever);
  
    const question =req.body.query
  
    const answer = await chain.call({
      query: req.body.query,
    });
  
    console.log({
      question,
      answer,
    });
  
    res.send({
      question,
      answer,
    });
  } catch(err){
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});

export default chatGPT;
