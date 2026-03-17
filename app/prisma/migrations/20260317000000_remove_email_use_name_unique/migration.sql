-- DropIndex
DROP INDEX IF EXISTS "users_email_key";

-- AlterTable
ALTER TABLE "users" DROP COLUMN IF EXISTS "email";

-- CreateIndex (ensure name is unique for login lookup)
CREATE UNIQUE INDEX "users_name_key" ON "users"("name");
