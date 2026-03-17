import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Project root .env (app is in a subfolder of the project)
const projectEnv = path.join(__dirname, "..", "..", ".env");
dotenv.config({ path: projectEnv });
