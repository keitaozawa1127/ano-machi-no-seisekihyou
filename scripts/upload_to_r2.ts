import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import * as fs from "fs";
import * as path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const BUCKET_NAME = "stations-data";
const DATA_DIR = path.resolve(process.cwd(), "data", "stations");
const CONCURRENCY = 100; // number of files to upload in parallel

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

if (!accountId) {
  console.error(
    "R2_ACCOUNT_ID is not set. Please add R2_ACCOUNT_ID to your .env.local file."
  );
  process.exit(1);
}

if (!accessKeyId || !secretAccessKey) {
  console.error(
    "R2_ACCESS_KEY_ID or R2_SECRET_ACCESS_KEY is not set. Please check your .env.local file."
  );
  process.exit(1);
}

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

async function listJsonFiles(dir: string): Promise<string[]> {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const subFiles = await listJsonFiles(fullPath);
      files.push(...subFiles);
    } else if (entry.isFile() && fullPath.endsWith(".json")) {
      files.push(fullPath);
    }
  }

  return files;
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

async function uploadFile(filePath: string) {
  const body = await fs.promises.readFile(filePath);
  const key = path.basename(filePath);

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: body,
    ContentType: "application/json",
  });

  await s3.send(command);
}

async function main() {
  console.log("Listing JSON files in", DATA_DIR);
  const files = await listJsonFiles(DATA_DIR);
  const total = files.length;

  console.log(`Found ${total} files to upload.`);

  const chunks = chunkArray(files, CONCURRENCY);
  let uploaded = 0;

  for (const chunk of chunks) {
    await Promise.all(
      chunk.map(async (file) => {
        try {
          await uploadFile(file);
          uploaded += 1;
          if (uploaded % 50 === 0 || uploaded === total) {
            console.log(`[${uploaded} / ${total}] アップロード完了...`);
          }
        } catch (error) {
          console.error("Failed to upload", file, error);
        }
      })
    );
  }

  console.log(`All uploads finished. Total uploaded: ${uploaded}`);
}

main().catch((err) => {
  console.error("Upload script failed:", err);
  process.exit(1);
});

