import express, { Express, Request, Response, Application } from "express";
import dotenv from "dotenv";
import Auth from "./routes/api";
import Admin from "./routes/admin";
import bodyParser from "body-parser";
import path from "path";
import cors from "cors";
import { parse } from "path";
import { mongooseConnection } from "./config/db";
import chatGPT from "./routes/chatGPT";
import findRoot from "find-root";

//For env File
dotenv.config();

const app: Application = express();

// Connect Database
mongooseConnection();

const port = process.env.BACK_PORT || 5000;
console.log("port", process.env.BACK_PORT);

app.use(cors());
// Serve files from the 'uploads' directory
app.use("/uploads", express.static(path.join(findRoot(__dirname), "uploads")));

app.get("/", (req: Request, res: Response) => {
  res.send("Welcome to Express & TypeScript Server");
});

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PATCH, DELETE, OPTIONS"
  );
  next();
});
app.use(bodyParser.json());

app.use("/api/users", Auth);
app.use("/api/chat", chatGPT);
app.use("/api/admin", Admin);

// app.use('/api/users', (req, res)=>{
//   console.log("req", req.body);

// });
app.listen(port, () => {
  console.log(`Server is Fire at http://localhost:${port}`);
});
