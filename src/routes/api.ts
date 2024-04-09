import { Router, Request, Response } from "express";
import User from "../schemas/user.model";
import Setting from "../schemas/setting.model";
import jetValidator from "jet-validator";
import { register } from "./auth";
import jwt from "jsonwebtoken";
import auth, { IRequest } from "../middleware/auth";
import { Document } from "mongoose";
import bcrypt from "bcrypt";

const Auth = Router();
const validate = jetValidator();

Auth.post("/register", async (req: Request, res: Response) => {
  // console.log("req", req.body);
  if (req.body.email && req.body.password) {
    const payload = await register(req.body);
    if (payload !== null) {
      console.log("payload", payload);
      jwt.sign(
        { payload },
        process.env.JWT_SECRET as string,
        { expiresIn: "5 days" },
        (err, token) => {
          if (err) throw new Error(err.message);
          return res.status(201).json({ token });
        }
      );
    } else {
      res.status(400).send("User Already Exists");
    }
  } else {
    res.status(400).send("Please enter email and password");
  }
});

Auth.post("/login", async (req: Request, res: Response) => {
  const user = await User.findOne({
    email: req.body.email,
  });
  if (user) {
    const isMatch = await bcrypt.compare(req.body.password, user.password);
    if (isMatch) {
      jwt.sign(
        { payload: user },
        process.env.JWT_SECRET as string,
        { expiresIn: "5 days" },
        (err, token) => {
          if (err) throw new Error(err.message);
          return res.status(200).json({ token });
        }
      );
    } else {
      res.status(400).send("Invalid Credentials");
    }
  } else {
    res.status(400).send("Invalid Credentials");
  }
});

Auth.get("/auth", auth, async (req: IRequest, res: Response) => {
  const user = await User.findOne({ email: req.email.email });
  res.status(200).send(user);
});

export default Auth;
