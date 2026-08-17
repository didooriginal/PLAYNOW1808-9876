import { S3Client } from "@aws-sdk/client-s3";

/**
 * Object storage (Tigris, API compativel com S3).
 * Usado hoje só pela foto de perfil do cliente: o arquivo vai direto do
 * navegador para o bucket via URL assinada — nunca passa pelo servidor.
 */
export const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.S3_ENDPOINT,
  forcePathStyle: false,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
});

export const bucket = process.env.S3_BUCKET ?? "";

export function storageConfigurado() {
  return Boolean(
    process.env.S3_ENDPOINT &&
      process.env.S3_BUCKET &&
      process.env.S3_ACCESS_KEY_ID &&
      process.env.S3_SECRET_ACCESS_KEY,
  );
}

/** URL publica do objeto (bucket com leitura publica por objeto). */
export function urlPublica(key: string) {
  const endpoint = (process.env.S3_ENDPOINT ?? "").replace(/^https?:\/\//, "").replace(/\/$/, "");
  return `https://${bucket}.${endpoint}/${key}`;
}
