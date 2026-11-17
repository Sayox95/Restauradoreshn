-- Idempotency-Key (lineamientos v2 §7, «doble clic»): crear algo importante lleva una clave única por
-- intento; repetir la misma clave devuelve lo ya creado en lugar de crearlo otra vez. Se guardan un día.

CREATE TABLE IF NOT EXISTS idempotencia (
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  clave TEXT NOT NULL,
  ruta TEXT NOT NULL,
  estado INTEGER NOT NULL,
  respuesta TEXT NOT NULL,
  creado_en TEXT NOT NULL,
  PRIMARY KEY (usuario_id, clave)
);
