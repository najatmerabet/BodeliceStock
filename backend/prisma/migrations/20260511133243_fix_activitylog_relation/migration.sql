-- DropForeignKey
ALTER TABLE "activitylog" DROP CONSTRAINT "activitylog_userId_fkey";

-- AddForeignKey
ALTER TABLE "activitylog" ADD CONSTRAINT "activitylog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
