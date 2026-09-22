-- custom roles become org-scoped (null keeps system roles global)
ALTER TABLE "Role" ADD COLUMN "orgId" TEXT;
CREATE INDEX "Role_orgId_idx" ON "Role"("orgId");
