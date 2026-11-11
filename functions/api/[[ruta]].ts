import { manejarApi } from '../../server/app';
import type { Env } from '../../server/plumbing/contexto';

/**
 * Los enlaces se configuran en el panel de Cloudflare Pages (Settings → Bindings): DB (D1) y el bucket
 * R2. El proyecto ya tenía el bucket con el nombre PDF_BUCKET; se acepta ese nombre o ARCHIVOS.
 */
type EnvPages = Omit<Env, 'ARCHIVOS'> & { ARCHIVOS?: R2Bucket; PDF_BUCKET?: R2Bucket };

export const onRequest: PagesFunction<EnvPages> = (ctx) =>
  manejarApi(ctx.request, { ...ctx.env, ARCHIVOS: (ctx.env.ARCHIVOS ?? ctx.env.PDF_BUCKET)! }, undefined, (p) => ctx.waitUntil(p));
