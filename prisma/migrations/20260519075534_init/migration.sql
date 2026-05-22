-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(16) NOT NULL,
    `nickname` VARCHAR(64) NULL DEFAULT '未命名同学',
    `school` VARCHAR(128) NULL,
    `major` VARCHAR(128) NULL,
    `grade_id` VARCHAR(64) NULL,
    `goal` VARCHAR(32) NULL,
    `member_level` VARCHAR(191) NOT NULL DEFAULT 'free',
    `member_expires_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `users_phone_key`(`phone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `grades` (
    `id` VARCHAR(64) NOT NULL,
    `name` VARCHAR(32) NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `courses` (
    `id` VARCHAR(64) NOT NULL,
    `grade_id` VARCHAR(64) NOT NULL,
    `name` VARCHAR(128) NOT NULL,
    `is_hot` BOOLEAN NOT NULL DEFAULT false,
    `view_count` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `assignments` (
    `id` VARCHAR(64) NOT NULL,
    `course_id` VARCHAR(64) NOT NULL,
    `title` VARCHAR(256) NOT NULL,
    `summary` TEXT NULL,
    `difficulty` VARCHAR(191) NOT NULL,
    `assignment_type` VARCHAR(191) NOT NULL,
    `view_count` INTEGER NOT NULL DEFAULT 0,
    `favorite_count` INTEGER NOT NULL DEFAULT 0,
    `is_free_full` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `assignment_modules` (
    `id` VARCHAR(128) NOT NULL,
    `assignment_id` VARCHAR(64) NOT NULL,
    `module_type` VARCHAR(64) NOT NULL,
    `title` VARCHAR(128) NOT NULL,
    `required_level` VARCHAR(191) NOT NULL DEFAULT 'free',
    `content` TEXT NOT NULL,
    `preview_content` TEXT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `membership_plans` (
    `id` VARCHAR(64) NOT NULL,
    `level` VARCHAR(191) NOT NULL,
    `name` VARCHAR(64) NOT NULL,
    `tagline` VARCHAR(256) NULL,
    `price` DECIMAL(10, 2) NOT NULL,
    `period` VARCHAR(32) NOT NULL,
    `benefits` JSON NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `membership_plans_level_key`(`level`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `orders` (
    `id` VARCHAR(64) NOT NULL,
    `user_id` VARCHAR(64) NOT NULL,
    `plan_id` VARCHAR(64) NOT NULL,
    `plan_level` VARCHAR(191) NOT NULL,
    `plan_name` VARCHAR(64) NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `external_trade_no` VARCHAR(128) NULL,
    `payment_channel` VARCHAR(32) NULL,
    `payment_status` VARCHAR(32) NULL,
    `refund_status` VARCHAR(32) NULL,
    `paid_at` DATETIME(3) NULL,
    `expired_at` DATETIME(3) NULL,
    `raw_callback` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `consultation_leads` (
    `id` VARCHAR(64) NOT NULL,
    `user_id` VARCHAR(64) NULL,
    `name` VARCHAR(64) NOT NULL,
    `contact` VARCHAR(128) NOT NULL,
    `school` VARCHAR(128) NULL,
    `major` VARCHAR(128) NULL,
    `grade_id` VARCHAR(64) NULL,
    `goal` VARCHAR(64) NULL,
    `description` TEXT NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'new',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_favorites` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` VARCHAR(64) NOT NULL,
    `assignment_id` VARCHAR(64) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `user_favorites_user_id_assignment_id_key`(`user_id`, `assignment_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `login_records` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` VARCHAR(64) NOT NULL,
    `ip_address` VARCHAR(64) NULL,
    `user_agent` TEXT NULL,
    `device_info` JSON NULL,
    `login_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_grade_id_fkey` FOREIGN KEY (`grade_id`) REFERENCES `grades`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `courses` ADD CONSTRAINT `courses_grade_id_fkey` FOREIGN KEY (`grade_id`) REFERENCES `grades`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assignments` ADD CONSTRAINT `assignments_course_id_fkey` FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assignment_modules` ADD CONSTRAINT `assignment_modules_assignment_id_fkey` FOREIGN KEY (`assignment_id`) REFERENCES `assignments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_plan_id_fkey` FOREIGN KEY (`plan_id`) REFERENCES `membership_plans`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `consultation_leads` ADD CONSTRAINT `consultation_leads_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `consultation_leads` ADD CONSTRAINT `consultation_leads_grade_id_fkey` FOREIGN KEY (`grade_id`) REFERENCES `grades`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_favorites` ADD CONSTRAINT `user_favorites_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_favorites` ADD CONSTRAINT `user_favorites_assignment_id_fkey` FOREIGN KEY (`assignment_id`) REFERENCES `assignments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `login_records` ADD CONSTRAINT `login_records_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
