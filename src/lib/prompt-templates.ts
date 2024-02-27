import { PromptTemplate } from "@langchain/core/prompts";


//Creates a standlone question from the chat-shitory and the current question
export const STANDALONE_QUESTION_TEMPLATE = `Given the following conversation and a follow up question, rephrase the follow up question to be a standalone question.

Chat History:
{chat_history}
Follow Up Input: {question}
Standalone question:
`;

//Actual question you ask the chat and send the response to clinet
export const QA_TEMPLATE =`You are an enthusiastic AI assistant. use the following pieces of context to answer the quesiton at the end.
If you don't know the answer, just say you don't know. DO NOT try to make up an answer.
If the question is not related to the context, politely reponse that you are tuned to only answer questions that are related to the context.

{context}

Question: {question}
Helpful answer in markdown:
`;