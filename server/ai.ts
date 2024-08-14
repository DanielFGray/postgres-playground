import Elysia, { t } from "elysia";
import { Stream } from "@elysiajs/stream";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { match, P } from "ts-pattern";

if (!process.env.GEMINI_KEY) {
  throw new Error("GEMINI_KEY environment variable is required");
}

const providers = {
  google: new GoogleGenerativeAI(process.env.GEMINI_KEY),
};

// TODO: feed the model with postgres training data

export function getAI(app: Elysia) {
  return app.get(
    "/ai/:provider",
    ({ body }) => {
      return new Stream(async stream => {
        const model = providers.google.getGenerativeModel({
          model: "gemini-1.5-flash",
        });

        if (typeof body.message !== "string") {
          stream.send("Invalid message type");
        }
        const result = model.generateContentStream(body.message);
        stream.send(result);
      });
    },
    {
      body: t.Object({
        message: t.String(),
      }),
    },
  );
}
