-- CreateTable
CREATE TABLE "PersonDirectory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'INTERNAL',
    "email" TEXT,
    "phone" TEXT,
    "company" TEXT,
    "jobTitle" TEXT,
    "notes" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonDirectory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PersonDirectory_userId_key" ON "PersonDirectory"("userId");

-- CreateIndex
CREATE INDEX "PersonDirectory_kind_idx" ON "PersonDirectory"("kind");

-- CreateIndex
CREATE INDEX "PersonDirectory_name_idx" ON "PersonDirectory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PersonDirectory_name_company_key" ON "PersonDirectory"("name", "company");
