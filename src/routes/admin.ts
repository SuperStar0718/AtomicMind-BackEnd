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

Admin.post("/setSettings", async (req: any, res: Response) => {
  const {
    environment,
    streamTemperature,
    nonStreamTemperature,
    chunkSize,
    chunkOverlap,
    systemPrompt,
    userPrompt,
    streamingModel,
    nonStreamingModel,
  } = req.body;
  console.log("systemPrompt:", systemPrompt);

  Setting.findOneAndUpdate(
    { environment: environment },
    {
      environment,
      streamTemperature,
      nonStreamTemperature,
      chunkSize,
      chunkOverlap,
      systemPrompt,
      userPrompt,
      streamingModel,
      nonStreamingModel,
    },
    { new: true, upsert: true }
  )
    .then(async (setting) => {
      const settings = await Setting.find().select(
        "environment streamTemperature nonStreamTemperature chunkSize chunkOverlap systemPrompt userPrompt streamingModel nonStreamingModel -_id"
      );
      res.send({setting,settings});
    })
    .catch((err) => {
      console.log(err);
      res.status(500).send("Internal Server Error");
    });
});

Admin.get("/settings", (req, res) => {
  Setting.find()
    .select(
      "environment streamTemperature nonStreamTemperature chunkSize chunkOverlap systemPrompt userPrompt streamingModel nonStreamingModel -_id"
    )
    .then((settings) => {
      res.send(settings);
    })
    .catch((err) => {
      console.log(err);
      res.status(500).send("Internal Server Error");
    });
});

Admin.post("/saveAsEnvironment", async (req, res) => {
  const {
    newEnv,
    streamTemperature,
    nonStreamTemperature,
    chunkSize,
    chunkOverlap,
    systemPrompt,
    userPrompt,
    streamingModel,
    nonStreamingModel,
  } = req.body;

  const newSettings = new Setting({
    environment: newEnv,
    streamTemperature: streamTemperature,
    nonStreamTemperature: nonStreamTemperature,
    chunkSize: chunkSize,
    chunkOverlap: chunkOverlap,
    systemPrompt: systemPrompt,
    userPrompt: userPrompt,
    streamingModel: streamingModel,
    nonStreamingModel: nonStreamingModel,
  });
  newSettings.save().then((settings) => {
    res.send(settings);
  });
});

Admin.post("/deleteEnvironment", async (req, res) => {
  const { environment } = req.body;
  Setting.deleteOne({ environment: environment })
    .then((settings) => {
      res.send(settings);
    })
    .catch((err) => {
      console.log(err);
      res.status(500).send("Internal Server Error");
    });
});

export default Admin;
