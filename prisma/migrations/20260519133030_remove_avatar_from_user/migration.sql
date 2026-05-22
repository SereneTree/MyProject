/*
  Warnings:

  - You are about to drop the column `sort_order` on the `user_favorites` table. All the data in the column will be lost.
  - You are about to drop the column `avatar` on the `users` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `user_favorites` DROP COLUMN `sort_order`;

-- AlterTable
ALTER TABLE `users` DROP COLUMN `avatar`;
