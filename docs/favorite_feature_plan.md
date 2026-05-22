# 收藏功能完善方案 (Favorites Feature Plan)

## 1. 目标与范围
- **目标**：将现有的本地收藏功能升级为后端数据库存储，在作业详情页增加收藏按钮，新增独立的收藏夹页面，并支持分页（10条/页）和拖拽自定义排序。
- **范围**：
  - 数据库模型更新 (`UserFavorite` 增加排序字段)。
  - 后端新增收藏相关的增删查改及排序 API。
  - 前端状态管理改造（从 LocalStorage 迁移到后端接口）。
  - 前端详情页补充收藏交互。
  - 前端新增收藏夹页面（集成 `@dnd-kit` 实现拖拽排序，集成 Ant Design 实现分页）。

## 2. 当前状态分析
- 现有的收藏状态仅仅保存在前端 `localStorage` 的 `favoriteAssignmentIds` 变量中，切换设备会丢失。
- 数据库 `prisma/schema.prisma` 中已经存在 `UserFavorite` 表，但缺乏记录自定义顺序的字段，且后端尚未提供相关接口。
- 目前后端使用一个硬编码的 `mockUserId = 'user_test_001'` 代表当前登录用户，本次后端开发将继续沿用此设定以保持 MVP 一致性。

## 3. 具体修改步骤

### 3.1 数据库层变更
- **文件**: `prisma/schema.prisma`
- **操作**: 
  - 在 `UserFavorite` 模型中新增字段 `sortOrder BigInt @default(0) @map("sort_order")`。
  - 运行迁移命令 `npx prisma migrate dev --name add_favorite_sort_order` 更新数据库结构。

### 3.2 后端 API 开发
- **文件**: `server/index.mjs`
- **新增接口**:
  1. `POST /api/favorites/toggle`: 切换作业的收藏状态。如果新增收藏，`sortOrder` 默认设置为当前时间戳的负值（保证默认按时间倒序排列）；如果已存在则删除记录。
  2. `GET /api/favorites/ids`: 返回当前用户 (`user_test_001`) 所有已收藏的 `assignmentId` 数组，供前端全局状态使用。
  3. `GET /api/favorites`: 获取用户的收藏作业列表，支持分页参数 `page` 和 `pageSize` (默认10)，数据关联 `Assignment` 表，并按 `sortOrder` ASC 排序返回。
  4. `PUT /api/favorites/reorder`: 接收前端拖拽后的排序数据 `[{ id, sortOrder }]`，批量更新 `UserFavorite` 的 `sortOrder`。

### 3.3 前端变更
- **依赖安装**:
  - 运行 `npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities` 安装拖拽库。
- **前端 API 层 (`src/api.ts`)**:
  - 增加对应上述 4 个后端接口的请求函数。
- **全局状态与入口 (`src/App.tsx`)**:
  - **状态重构**: 在 `AppShell` 中，当 `isLoggedIn` 为 `true` 时，调用接口获取 `favoriteIds` 并保存在 React 状态中，移除原来的 `useLocalState` 实现。
  - **导航入口**: 在顶部 `<Header>` 的右侧操作区，增加一个“我的收藏”入口（使用 `StarOutlined` 图标），点击跳转至 `/favorites` 路由。
- **作业详情页 (`AssignmentPage` component)**:
  - 将 `favoriteIds` 和 `toggleFavorite` 逻辑传入该组件。
  - 在 `detail-header` 标题卡片的右下角添加收藏按钮 (Button type="text", icon 为实心/空心星星)。点击后请求 toggle 接口并更新本地状态，展示 `message` 反馈。
- **收藏夹页面 (`FavoritesPage` component) (新增)**:
  - 路由: 新增 `<Route path="/favorites" ... />`。
  - **列表展示与分页**: 请求 `GET /api/favorites` 获取当前页数据，使用 Ant Design 的 `<Pagination>` 进行分页（pageSize = 10）。
  - **拖拽排序**: 在列表外层包裹 `@dnd-kit` 的 `DndContext` 和 `SortableContext`，使列表项支持拖拽。
  - **排序持久化**: 当用户完成拖拽后（仅限当前页内排序），重新计算当前页各元素的 `sortOrder`，并调用 `PUT /api/favorites/reorder` 保存到后端。

## 4. 验证步骤
1. 点击首页资源列表或详情页的收藏按钮，检查后端数据库 `user_favorites` 表是否成功写入/删除记录。
2. 点击顶部导航栏的“我的收藏”进入收藏夹，检查是否能正确渲染列表，且分页功能正常（每页最多展示 10 条）。
3. 在收藏夹页面按住某个作业卡片进行拖拽，松开后刷新页面，检查该作业的顺序是否被成功保存。
4. 退出登录再重新登录，检查之前收藏的作业状态和顺序是否正确恢复。