import { z } from "zod";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ORPCError } from "@orpc/server";
import { authed } from "../middleware/auth";
import { bucket, s3, storageConfigurado, urlPublica } from "../lib/s3";
import { garantirFichaDaSessao } from "../lib/sessao";

const TIPOS = ["image/jpeg", "image/png", "image/webp"] as const;

export const upload = {
  /**
   * URL assinada para o cliente logado subir a propria foto de perfil.
   * O arquivo vai do navegador direto para o storage; a API so assina e
   * devolve a URL publica que sera gravada em `usuarios.avatar_url`.
   */
  avatar: authed
    .input(
      z.object({
        contentType: z.enum(TIPOS),
        /** tamanho em bytes, so para barrar arquivo grande antes de subir */
        tamanho: z.number().int().positive().max(5 * 1024 * 1024),
      }),
    )
    .handler(async ({ input, context }) => {
      if (!storageConfigurado()) {
        throw new ORPCError("SERVICE_UNAVAILABLE", {
          message: "O armazenamento de arquivos não está configurado.",
        });
      }
      const ficha = await garantirFichaDaSessao(context.user);
      if (!ficha) throw new ORPCError("NOT_FOUND", { message: "Ficha do cliente não encontrada." });

      const ext = input.contentType === "image/png" ? "png" : input.contentType === "image/webp" ? "webp" : "jpg";
      const key = `avatares/${ficha.id}-${Date.now()}.${ext}`;

      const url = await getSignedUrl(
        s3,
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          ContentType: input.contentType,
          ACL: "public-read",
        }),
        { expiresIn: 600 },
      );

      return { url, key, publicUrl: urlPublica(key) };
    }),
};
