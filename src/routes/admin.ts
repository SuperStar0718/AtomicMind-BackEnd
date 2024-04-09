import { Router, Request, Response } from "express";
import User from "../schemas/user.model";
import Setting from "../schemas/setting.model";
import jetValidator from "jet-validator";
import { register } from "./auth";
import jwt from "jsonwebtoken";
import auth, { IRequest } from "../middleware/auth";
import { Document } from "mongoose";
import bcrypt from "bcrypt";

const Admin = Router();
const validate = jetValidator();

Admin.post("/setSettings",  async (req: any, res: Response) => {
  const {
    streamTemperature,
    nonStreamTemperature,
    chunkSize,
    chunkOverlap,
    systemPrompt,
    streamingModel,
    nonStreamingModel,
  } = req.body;
  console.log('systemPrompt:', systemPrompt);
  
  Setting.findOneAndUpdate(
    {},
    {
      streamTemperature,
      nonStreamTemperature,
      chunkSize,
      chunkOverlap,
      systemPrompt,
      streamingModel,
      nonStreamingModel,
    },
    { new: true, upsert: true }
  )
    .then((settings) => {
      res.send(settings);
    })
    .catch((err) => {
      console.log(err);
      res.status(500).send("Internal Server Error");
    });
});

Admin.get("/settings", (req, res) => {
  Setting.find()
    .select(
      "streamTemperature nonStreamTemperature chunkSize chunkOverlap systemPrompt streamingModel nonStreamingModel -_id"
    )
    .then((settings) => {
      res.send(settings);
    })
    .catch((err) => {
      console.log(err);
      res.status(500).send("Internal Server Error");
    });
});

export default Admin;