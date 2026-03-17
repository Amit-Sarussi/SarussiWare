-- CreateTable: Prisma implicit many-to-many join table (Permission A, User B)
CREATE TABLE "_PermissionToUser" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_PermissionToUser_AB_pkey" PRIMARY KEY ("A","B")
);

CREATE INDEX "_PermissionToUser_B_index" ON "_PermissionToUser"("B");

ALTER TABLE "_PermissionToUser" ADD CONSTRAINT "_PermissionToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_PermissionToUser" ADD CONSTRAINT "_PermissionToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate data: user_permissions (userId, permissionId) -> _PermissionToUser (A=permissionId, B=userId)
INSERT INTO "_PermissionToUser" ("A", "B")
SELECT "permissionId", "userId" FROM "user_permissions";

-- DropTable
DROP TABLE "user_permissions";
