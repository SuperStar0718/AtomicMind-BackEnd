
import express, { Express, Request, Response , Application } from 'express';
import dotenv from 'dotenv';
import Auth from './routes/api';
import bodyParser from 'body-parser';
import cors from 'cors';
import { parse } from 'path';
import { mongooseConnection } from './config/db';
import chatGPT from './routes/chatGPT';

//For env File 
dotenv.config();

const app: Application = express();

// Connect Database
mongooseConnection();

const port = process.env.BACK_PORT || 5000;
console.log("port", process.env.BACK_PORT);
app.use(cors());

app.get('/', (req: Request, res: Response) => {
  res.send('Welcome to Express & TypeScript Server');
});
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers','Origin, X-Requested-With, Content-Type, Accept');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  next();
})
app.use(bodyParser.json());

app.use('/api/users', Auth);
app.use('/api/chat', chatGPT)

// app.use('/api/users', (req, res)=>{
//   console.log("req", req.body);
  
// });
app.listen(port, () => {
  console.log(`Server is Fire at http://localhost:${port}`);
});