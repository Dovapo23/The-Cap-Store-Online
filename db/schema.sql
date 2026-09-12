-- =============================================================
--  CAPSTORE — Esquema PostgreSQL (Supabase free tier)
--  Ejecutar en: Supabase → SQL Editor → New query
-- =============================================================

-- =============================================================
--  MODELO ENTIDAD-RELACIÓN
-- =============================================================
--
--   Una sola entidad: cada fila es un evento de compra o intento
--   con datos de contacto. No se guarda ningún registro si el
--   usuario solo exploró sin proporcionar información.
--
--   ┌──────────────────────────────────────────────────────┐
--   │                    registro_chat                     │
--   ├──────────────────────────────────────────────────────┤
--   │ PK  id              UUID                             │
--   │     fecha           TIMESTAMPTZ                      │
--   │  ── Producto ──────────────────────────────────────  │
--   │     referencia      VARCHAR(20)   ← agro-1, lux-5   │
--   │     nombre_producto VARCHAR(200)                     │
--   │     coleccion       VARCHAR(20)                      │
--   │     precio          INTEGER                          │
--   │  ── Contacto ──────────────────────────────────────  │
--   │     nombre          VARCHAR(100)                     │
--   │     celular         VARCHAR(15)                      │
--   │     direccion       TEXT                             │
--   │     ciudad          VARCHAR(100)                     │
--   │     correo          VARCHAR(150)  ← nullable         │
--   │  ── Resultado ─────────────────────────────────────  │
--   │     estado          confirmado | cancelado           │
--   │     numero_pedido   VARCHAR(20)   ← solo confirmados │
--   │     pago            VARCHAR(60)                      │
--   └──────────────────────────────────────────────────────┘
--
--  Regla de negocio:
--    · estado = 'confirmado'  → compra completada, numero_pedido presente
--    · estado = 'cancelado'   → usuario canceló pero ya había dado datos
--    · Sin registro            → usuario solo exploró sin dar información
-- =============================================================


-- ---- TABLA ÚNICA ----
CREATE TABLE IF NOT EXISTS registro_chat (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  -- Producto
  referencia      VARCHAR(20),
  nombre_producto VARCHAR(200),
  coleccion       VARCHAR(20)  CHECK (coleccion IN ('agropecuario', 'colombia', 'luxury')),
  precio          INTEGER,

  -- Contacto del cliente
  nombre          VARCHAR(100),
  celular         VARCHAR(15),
  direccion       TEXT,
  ciudad          VARCHAR(100),
  correo          VARCHAR(150),

  -- Resultado de la conversación
  estado          VARCHAR(12)  NOT NULL CHECK (estado IN ('confirmado', 'cancelado')),
  numero_pedido   VARCHAR(20)  UNIQUE,               -- presente solo en confirmados
  pago            VARCHAR(60)  DEFAULT 'Contra entrega en efectivo'
);

COMMENT ON TABLE  registro_chat               IS 'Un registro por cada compra o intento con datos de contacto';
COMMENT ON COLUMN registro_chat.referencia    IS 'ID del producto en el catálogo: agro-1, col-3, lux-12, etc.';
COMMENT ON COLUMN registro_chat.numero_pedido IS 'CS-XXXXXX — presente solo cuando estado = confirmado';


-- =============================================================
--  ÍNDICES
-- =============================================================
CREATE INDEX IF NOT EXISTS idx_registro_fecha    ON registro_chat (fecha DESC);
CREATE INDEX IF NOT EXISTS idx_registro_estado   ON registro_chat (estado);
CREATE INDEX IF NOT EXISTS idx_registro_celular  ON registro_chat (celular);
CREATE INDEX IF NOT EXISTS idx_registro_coleccion ON registro_chat (coleccion);


-- =============================================================
--  ROW LEVEL SECURITY
--  La clave anon del frontend solo puede INSERT — nunca leer
--  ni modificar registros existentes.
-- =============================================================
ALTER TABLE registro_chat ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_insert_registro"
  ON registro_chat FOR INSERT TO anon WITH CHECK (true);


-- =============================================================
--  VISTA DE GESTIÓN (útil en el panel de Supabase)
-- =============================================================
CREATE OR REPLACE VIEW pedidos_confirmados AS
SELECT
  numero_pedido,
  fecha::DATE        AS dia,
  nombre,
  celular,
  direccion,
  ciudad,
  correo,
  referencia,
  nombre_producto,
  coleccion,
  precio,
  pago
FROM registro_chat
WHERE estado = 'confirmado'
ORDER BY fecha DESC;
