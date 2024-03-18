import { ChatAnthropic } from "@langchain/anthropic";
import { ChatOpenAI } from "@langchain/openai";



// export const nonStreamModel = new ChatOpenAI({
//   modelName: "gpt-4-turbo-preview",
//   temperature: 0.5,
//   openAIApiKey: process.env.OPENAI_API_KEY,
//   streaming: false,
// });


export const nonStreamModel = new ChatAnthropic({
  modelName: "claude-3-opus-20240229",
  maxTokens: 4000,
  temperature: 1,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
 
});