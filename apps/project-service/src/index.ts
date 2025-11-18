import express, { NextFunction, Request, Response } from "express";
import { clerkMiddleware, getAuth } from '@clerk/express';
import { shouldBeUser } from "./middleware/authMiddleware.js";
import { connectKafka, consumer, producer } from "./utils/kafka.js";
import cors from "cors";

const app = express();


//app.use(cors({
    //origin: ["http://localhost:3000", "http://localhost:3001","http://localhost:3002"],
    //methods: ["GET", "POST", "PUT", "DELETE"],
   // allowedHeaders: ["Content-Type", "Authorization"],
   // credentials: true,
//}));

app.use(clerkMiddleware())

app.use(express.json());

 app.get("/", (req: Request, res: Response) => {
    res.status(200).json({ message: "Project service is running on port 8000" });
 });

app.get("/health", (req: Request, res: Response) => {
    res.status(200).json({ 
        status: "ok",
        uptime: process.uptime(),
        timestamp: Date.now()
    });
});

app.get("/test", (req: Request, res: Response) => {
  const data = getAuth(req);
  console.log(data);
    res.json({
        message: "Project service authenticated!",
        userId: data.userId
    });
});

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.log(err);
    return res
      .status(err.status || 500)
      .json({ message: err.message || "Inter Server Error!" });
  });
  
  const start = async () => {
    try {
      app.listen(8000, () => {
        console.log("Project service is running on 8000");
      });
    } catch (error) {
      console.log(error);
      process.exit(1);
    }
  };

  start();
