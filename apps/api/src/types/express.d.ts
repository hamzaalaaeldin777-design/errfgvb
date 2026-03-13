declare global {
  namespace Express {
    interface Request {
      authUser?: {
        id: string;
        role: "developer" | "admin";
        plan: "free" | "pro" | "enterprise";
        email: string;
        name: string;
      };
      apiKeyContext?: {
        id: string;
        userId: string;
        plan: "free" | "pro" | "enterprise";
      };
    }
  }
}

export {};
