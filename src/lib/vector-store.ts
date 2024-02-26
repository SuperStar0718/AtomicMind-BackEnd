import { Pinecone } from "@pinecone-database/pinecone";
import { OpenAIEmbeddings } from "@langchain/openai";
import { PineconeStore } from "@langchain/pinecone";

export async function embedAndStoreDocs(pinecone: Pinecone, splittedDocs: any) {
  try {
    const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX_NAME!);
    // console.log('pineconeIndex', pineconeIndex);
    const embeddings = new OpenAIEmbeddings();
    const pineconeStore = new PineconeStore(embeddings, { pineconeIndex });

    //embed the PDF documents
    // const vectorStore = await PineconeStore.fromDocuments(
    //   splittedDocs,
    //   embeddings,
    //   {
    //     pineconeIndex: pineconeIndex,
    //     namespace: "atomicask",
    //     textKey: "text",
    //   }
    // );
    // const pinecone = new Pinecone();

// const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX!);

    const vectorStore = await PineconeStore.fromExistingIndex(
            new OpenAIEmbeddings(),
            { pineconeIndex }
        );
    return vectorStore;
  } catch (err: unknown) {
    console.error(err);
  }
}
