-- CreateTable
CREATE TABLE "permissions" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "permissions_name_key" ON "permissions"("name");

-- Migrate existing permissions: insert distinct names from users.permissions (before creating user_permissions so we have permission ids)
INSERT INTO "permissions" ("name")
SELECT DISTINCT unnest("permissions") FROM "users"
ON CONFLICT ("name") DO NOTHING;

-- CreateTable (with FKs; users and permissions exist)
CREATE TABLE "user_permissions" (
    "userId" INTEGER NOT NULL,
    "permissionId" INTEGER NOT NULL,

    CONSTRAINT "user_permissions_pkey" PRIMARY KEY ("userId","permissionId")
);

ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate: link users to permissions via user_permissions
INSERT INTO "user_permissions" ("userId", "permissionId")
SELECT u.id, p.id
FROM "users" u
CROSS JOIN LATERAL unnest(u.permissions) AS perm_name
JOIN "permissions" p ON p.name = perm_name;

-- AlterTable: drop old column
ALTER TABLE "users" DROP COLUMN "permissions";
