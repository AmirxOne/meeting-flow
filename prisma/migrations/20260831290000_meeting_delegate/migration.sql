-- Delegate: manager appoints users who may book in their name
CREATE TABLE "Delegate" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "managerId" TEXT NOT NULL,
    "delegateId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Delegate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Delegate_managerId_delegateId_key" ON "Delegate"("managerId", "delegateId");
CREATE INDEX "Delegate_orgId_idx" ON "Delegate"("orgId");
CREATE INDEX "Delegate_delegateId_idx" ON "Delegate"("delegateId");

ALTER TABLE "Delegate" ADD CONSTRAINT "Delegate_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Delegate" ADD CONSTRAINT "Delegate_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Delegate" ADD CONSTRAINT "Delegate_delegateId_fkey" FOREIGN KEY ("delegateId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Who actually submitted the booking when acting on behalf of the organizer
ALTER TABLE "Meeting" ADD COLUMN "createdById" TEXT;
CREATE INDEX "Meeting_createdById_idx" ON "Meeting"("createdById");
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
