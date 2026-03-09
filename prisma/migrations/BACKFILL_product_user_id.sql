-- Backfill: copiar Store.ownerId a Product.userId para todos los productos existentes.
-- Ejecutar DESPUÉS de 20260308120000_add_product_user_id_optional
--         y ANTES de 20260308120001_product_user_required_store_optional.
--
-- Estrategia: en esta etapa todos los productos tienen storeId (aún NOT NULL).
-- Rellenamos userId desde Store.ownerId para poder marcar userId como NOT NULL después.

UPDATE "Product" p
SET "userId" = s."ownerId"
FROM "Store" s
WHERE p."storeId" = s."id";

-- Verificación (opcional): no debe quedar ningún producto con userId nulo
-- SELECT id, "storeId", "userId" FROM "Product" WHERE "userId" IS NULL;
