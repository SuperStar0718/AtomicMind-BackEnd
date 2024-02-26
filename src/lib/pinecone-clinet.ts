import {Pinecone} from '@pinecone-database/pinecone'

let pineconeClientInstance: Pinecone | null = null

export async function initPineconeClient(){
    try{
        const pineconeClient = new Pinecone({
            apiKey: process.env.PINECONE_API_KEY,
        });
        return pineconeClient;
    }
    catch(err){
        console.error(err);
    }
  
}