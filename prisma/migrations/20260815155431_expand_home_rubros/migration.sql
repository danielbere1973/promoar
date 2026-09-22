-- Data-only: expande el catálogo de home_rubros de 5 a 10.
-- Decisión de Producto (CPO Approval — Preferencias → selección personalizada
-- de rubros v2, 15/8/2026): universo inicial de rubros habilitables para
-- selección personalizada de la Home. No modifica schema ni ninguna otra
-- tabla. Idempotente: reruns no duplican filas.
INSERT INTO "home_rubros" ("id", "label") VALUES
    ('transporte', 'Transporte'),
    ('tecnologia', 'Tecnología'),
    ('hogar', 'Hogar'),
    ('salud-y-belleza', 'Salud y Belleza'),
    ('viajes-y-turismo', 'Viajes y Turismo')
ON CONFLICT ("id") DO NOTHING;
