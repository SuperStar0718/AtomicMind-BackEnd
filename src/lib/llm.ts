import { ChatOpenAI } from "@langchain/openai";



export const nonStreamModel = new ChatOpenAI({
  modelName: "gpt-4-turbo-preview",
  temperature: 0,
  openAIApiKey: process.env.OPENAI_API_KEY,
  streaming: false,
});
