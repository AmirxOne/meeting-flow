-- CreateTable
CREATE TABLE "AppointmentResponse" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppointmentResponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AppointmentResponse_orgId_userId_idx" ON "AppointmentResponse"("orgId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "AppointmentResponse_programId_userId_key" ON "AppointmentResponse"("programId", "userId");

-- AddForeignKey
-- FK به AppointmentProgram به migration بعدی منتقل شد (جدول در 20261017123807 ساخته می‌شود)

-- AddForeignKey
ALTER TABLE "AppointmentResponse" ADD CONSTRAINT "AppointmentResponse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
