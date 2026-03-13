import type { Response } from "express";

export function sendCollection<T>(res: Response, data: T[]) {
  return res.json({
    success: true,
    count: data.length,
    data,
  });
}

