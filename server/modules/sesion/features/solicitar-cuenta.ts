import { usuarioDeCorreo } from '../../../../shared/constantes';
import { registroEsquema } from '../../../../shared/esquemas';
import { type Env, sentenciaAuditoria } from '../../../plumbing/contexto';
import { ApiError, esErrorUnico, json, leerJson } from '../../../plumbing/http';
import { hashPassword } from '../../../plumbing/sesion';

/** Mensaje cuando el usuario que sale del correo ya lo tiene otra cuenta. */
export const usuarioEnUso = (usuario: string) =>
  new ApiError(409, `El usuario «${usuario}» ya está en uso. Use una variante del correo con «+», por ejemplo nombre.apellido+${usuario}2@eneeutcd.hn.`);

/**
 * Solicitud de cuenta: queda pendiente (sin acceso, con el perfil de menor privilegio) hasta que un
 * administrador la apruebe y le asigne su rol.
 * El usuario sale del correo (usuarioDeCorreo). Si la solicitud anterior con ese correo fue rechazada,
 * se puede volver a solicitar: se reutiliza la misma cuenta.
 */
export async function registrarCuenta(env: Env, req: Request, ahora: string): Promise<Response> {
  const d = await leerJson(req, registroEsquema);
  const usuario = usuarioDeCorreo(d.correo);
  const existe = await env.DB.prepare('SELECT id, estado, correo FROM usuarios WHERE correo = ?1 OR usuario = ?2 ORDER BY correo = ?1 DESC')
    .bind(d.correo, usuario)
    .first<{ id: number; estado: string; correo: string | null }>();
  const hash = await hashPassword(d.password);
  if (existe?.correo?.toLowerCase() === d.correo && existe.estado === 'rechazada') {
    await env.DB.batch([
      env.DB.prepare(
        `UPDATE usuarios SET nombre = ?, telefono = ?, hash_password = ?, estado = 'pendiente', activo = 0, solicitud_pendiente = 1, creado_en = ?, actualizado_en = ? WHERE id = ?`,
      ).bind(d.nombre, d.telefono, hash, ahora, ahora, existe.id),
      sentenciaAuditoria(env, null, 'solicitar_cuenta', 'usuario', existe.id, null, { correo: d.correo, nombre: d.nombre, telefono: d.telefono }, ahora),
    ]);
    return json({ ok: true, usuario }, 201);
  }
  if (existe?.correo?.toLowerCase() === d.correo)
    throw new ApiError(
      409,
      existe.estado === 'pendiente'
        ? 'Ya hay una solicitud con ese correo; espere la aprobación de un administrador.'
        : 'Ya existe una cuenta con ese correo. Ingrese con su contraseña.',
    );
  if (existe) throw usuarioEnUso(usuario);
  try {
    const r = await env.DB.prepare(
      `INSERT INTO usuarios (usuario, correo, nombre, telefono, hash_password, rol, estado, activo, solicitud_pendiente, creado_en, actualizado_en)
       VALUES (?, ?, ?, ?, ?, 'tecnico', 'pendiente', 0, 1, ?, ?) RETURNING id`,
    )
      .bind(usuario, d.correo, d.nombre, d.telefono, hash, ahora, ahora)
      .first<{ id: number }>();
    await sentenciaAuditoria(env, null, 'solicitar_cuenta', 'usuario', r!.id, null, { correo: d.correo, nombre: d.nombre, telefono: d.telefono }, ahora).run();
  } catch (e) {
    if (esErrorUnico(e)) throw new ApiError(409, 'Ya existe una cuenta con ese correo o usuario.');
    throw e;
  }
  return json({ ok: true, usuario }, 201);
}
