import jwt, { JwtPayload } from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import consola from 'consola';
import { config } from 'dotenv';

config();


const JWT: string = process.env.JWT_SECRET || '';

export interface IRequest extends Request {
  email?: string;
}

const auth = (req: IRequest, res: Response, next: NextFunction) => {
  // Get token from header
  const token = req.header('x-auth-token');

  // Check if not token
  if (!token) {
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }

  // Verify token
  try {
    jwt.verify(token, JWT, (error, decoded) => {
      if (error) {
        return res.status(401).json({ msg: 'Token is not valid' });
      } else {
        req.email = (decoded as JwtPayload).payload;
        // if ((decoded as JwtPayload).user.role !== 'business') return res.status(HttpStatusCodes.BAD_REQUEST).json({ msg: 'Token is not valid' });
        next();
      }
    });
  } catch (err) {
    consola.error('something wrong with auth middleware');
    res.status(500).json({ msg: 'Server Error' });
  }
};

export default auth;
