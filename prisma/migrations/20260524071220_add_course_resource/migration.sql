-- CreateTable
CREATE TABLE `course_resources` (
    `id` VARCHAR(64) NOT NULL,
    `course_id` VARCHAR(64) NOT NULL,
    `category` VARCHAR(32) NOT NULL,
    `sub_type` VARCHAR(32) NOT NULL,
    `title` VARCHAR(256) NOT NULL,
    `summary` TEXT NULL,
    `content` TEXT NULL,
    `url` VARCHAR(512) NULL,
    `required_level` VARCHAR(32) NOT NULL DEFAULT 'free',
    `view_count` INTEGER NOT NULL DEFAULT 0,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `course_resources_course_id_category_idx`(`course_id`, `category`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `course_resources` ADD CONSTRAINT `course_resources_course_id_fkey` FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
