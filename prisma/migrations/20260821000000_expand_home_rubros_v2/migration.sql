-- Data-only: expande el catálogo de home_rubros de 10 a 18.
-- Decisión de Producto (CPO Approval — Ampliación de Universo de Rubros,
-- 21/8/2026, cpo-a-cto-aprobacion-ampliacion-rubros-21-8-2026.md): el
-- universo de rubros seleccionables cubre ahora todas las categorías activas
-- de PromoAR salvo "Otros" y "Sin Categoría". No modifica schema ni ninguna
-- otra tabla. Idempotente: reruns no duplican filas.
INSERT INTO "home_rubros" ("id", "label") VALUES
    ('mascotas', 'Mascotas'),
    ('heladerias', 'Heladerías'),
    ('entretenimiento', 'Entretenimiento'),
    ('deportes', 'Deportes'),
    ('jugueterias', 'Jugueterías'),
    ('librerias', 'Librerías'),
    ('shoppings', 'Shoppings'),
    ('automotores', 'Automotores')
ON CONFLICT ("id") DO NOTHING;
