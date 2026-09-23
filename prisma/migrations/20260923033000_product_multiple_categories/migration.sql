-- Replace the required one-category relation with a many-to-many relation.
-- Existing assignments are copied before the old categoryId column is removed.
CREATE TABLE "_CategoryToProduct" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

CREATE UNIQUE INDEX "_CategoryToProduct_AB_unique"
ON "_CategoryToProduct"("A", "B");

CREATE INDEX "_CategoryToProduct_B_index"
ON "_CategoryToProduct"("B");

INSERT INTO "_CategoryToProduct" ("A", "B")
SELECT "categoryId", "id" FROM "Product";

ALTER TABLE "_CategoryToProduct"
ADD CONSTRAINT "_CategoryToProduct_A_fkey"
FOREIGN KEY ("A") REFERENCES "Category"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "_CategoryToProduct"
ADD CONSTRAINT "_CategoryToProduct_B_fkey"
FOREIGN KEY ("B") REFERENCES "Product"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Product" DROP CONSTRAINT "Product_categoryId_fkey";
ALTER TABLE "Product" DROP COLUMN "categoryId";
