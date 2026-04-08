import { z } from "zod";
import { createEnv } from "@/lib/create-env";

const EnvSchema = z.object({
  // Note: the key in .env file should be prefixed with VITE_.
  API_URL: z.string().default("http://localhost:3000"),
  GLM_API_KEY: z
    .string()
    .default("3e1202fedda7482ab0322638653f6d7e.3wJqp7TLgGIx1Mbf"),
  GLM_OCR_URL: z
    .string()
    .default("https://open.bigmodel.cn/api/paas/v4/layout_parsing"),
});

const env = createEnv(EnvSchema) as z.TypeOf<typeof EnvSchema>;
export default env;
