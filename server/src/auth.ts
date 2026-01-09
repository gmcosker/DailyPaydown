import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from './db';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

// Type assertion after null check
const jwtSecret: string = JWT_SECRET;

export interface AuthRequest extends Request {
  userId?: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(userId: string): string {
  return jwt.sign({ userId }, jwtSecret, { expiresIn: '30d' });
}

export function verifyToken(token: string): { userId: string } | null {
  try {
    const decoded = jwt.verify(token, jwtSecret);
    if (typeof decoded === 'object' && decoded !== null && 'userId' in decoded) {
      return decoded as { userId: string };
    }
    return null;
  } catch (error) {
    return null;
  }
}

export async function authenticateToken(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  // Verify user still exists
  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
  });

  if (!user) {
    res.status(401).json({ error: 'User not found' });
    return;
  }

  req.userId = decoded.userId;
  next();
}




