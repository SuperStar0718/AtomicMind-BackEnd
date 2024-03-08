import { OpenAIEmbeddings } from "@langchain/openai";
import { PineconeStore } from "@langchain/pinecone";
import { initPineconeClient } from "../lib/pinecone-clinet";
import { Pinecone } from "@pinecone-database/pinecone";

export const initializePineconeStore = async (splittedDocs: any) => {
  try {
    const embeddings = new OpenAIEmbeddings();
    const pineconeClient = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY,
    });
    const pineconeIndex = pineconeClient.Index(process.env.PINECONE_INDEX_NAME!);
    await pineconeIndex.namespace('atomicask').deleteAll();
    // const upsertChunkSize = 50;
    // for(let i = 0; i < splittedDocs.length; i += upsertChunkSize){
    //     const chunk = splittedDocs.slice(i, i + upsertChunkSize);
    //     await PineconeStore.fromDocuments(
    //         chunk,
    //         embeddings,
    //         {
    //           pineconeIndex: pineconeIndex,
    //           namespace: "atomicask",
    //           textKey: "text",
    //         }
    //       );
    // }
    // const vectorStore = await PineconeStore.fromExistingIndex(
    //     new OpenAIEmbeddings(),
    //     { pineconeIndex }
    //   );

    const vectorStore = await PineconeStore.fromDocuments(splittedDocs, embeddings, {
        pineconeIndex: pineconeIndex,
        namespace: 'atomicask',
        textKey: 'text',
      });
    return vectorStore;
  } catch (err) {
    console.error(err);
  }
};
