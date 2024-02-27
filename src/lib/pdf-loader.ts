import { PDFLoader } from "langchain/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

export async function getChunkedDocsFromPDF(){
    try{
        const loader = new PDFLoader('uploads/')
        const docs = await loader.load()
        const textSplitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap:200,
        })
        const chunkedDocs = await textSplitter.splitDocuments(docs);
        return chunkedDocs;
    } catch(err: unknown){
        console.error(err);
    }
}