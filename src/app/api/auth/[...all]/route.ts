import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/auth/auth";

const handler = (request: Request) => auth().handler(request);

export const { GET, POST, PATCH, PUT, DELETE } = toNextJsHandler(handler);
