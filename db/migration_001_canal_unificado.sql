-- =============================================================
--  CAPSTORE — Migración 001: unificar canal web + WhatsApp
--  Ejecutar en: Supabase → SQL Editor → New query
--  Antes de correr esto: verificar la estructura real con
--    SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'registro_chat';
--  porque no hay certeza de que db/schema.sql se haya ejecutado
--  tal cual (el código del widget web ya usa 'departamento',
--  que schema.sql no define).
-- =============================================================

-- 1) Columna de canal de origen (pieza central de la unificación)
ALTER TABLE registro_chat
  ADD COLUMN IF NOT EXISTS canal VARCHAR(10) NOT NULL DEFAULT 'web';

ALTER TABLE registro_chat
  DROP CONSTRAINT IF EXISTS registro_chat_canal_check;
ALTER TABLE registro_chat
  ADD CONSTRAINT registro_chat_canal_check CHECK (canal IN ('web', 'whatsapp'));

CREATE INDEX IF NOT EXISTS idx_registro_canal ON registro_chat (canal);

-- 2) Columna 'departamento' — ya usada por script.js:439, ausente en schema.sql
ALTER TABLE registro_chat
  ADD COLUMN IF NOT EXISTS departamento VARCHAR(100);

-- 3) Ampliar el estado permitido: el bot de WhatsApp usa 'pendiente'
--    al confirmar el pedido (chatbot/index.js), no solo confirmado/cancelado
ALTER TABLE registro_chat
  DROP CONSTRAINT IF EXISTS registro_chat_estado_check;
ALTER TABLE registro_chat
  ADD CONSTRAINT registro_chat_estado_check
  CHECK (estado IN ('pendiente', 'confirmado', 'cancelado'));

-- 4) Quitar UNIQUE de numero_pedido
--    Motivo: el carrito de WhatsApp permite VARIOS productos en un mismo
--    pedido. Se inserta UNA FILA POR PRODUCTO del carrito, todas compartiendo
--    el mismo numero_pedido (coherente con el propio diseño del esquema:
--    "cada fila es un evento de compra o intento"). Eso rompe UNIQUE si no
--    se ajusta. Se mantiene indexado (no único) para poder agrupar/filtrar
--    por numero_pedido eficientemente.
--    NOTA: el nombre exacto de la constraint autogenerada por Postgres para
--    un UNIQUE inline suele ser "<tabla>_<columna>_key". Si este DROP falla
--    con "constraint does not exist", buscar el nombre real en
--    Supabase → Table Editor → registro_chat → columna numero_pedido,
--    o con: SELECT conname FROM pg_constraint WHERE conrelid = 'registro_chat'::regclass;
ALTER TABLE registro_chat
  DROP CONSTRAINT IF EXISTS registro_chat_numero_pedido_key;

CREATE INDEX IF NOT EXISTS idx_registro_numero_pedido ON registro_chat (numero_pedido);

-- 5) Verificación rápida post-migración
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'registro_chat'
-- ORDER BY ordinal_position;
