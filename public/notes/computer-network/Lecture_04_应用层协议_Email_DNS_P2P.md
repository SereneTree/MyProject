# Lecture 4 学习笔记 — 应用层协议（Email、DNS、P2P）

> 课程：QHE4703 Computer Networks | 教材：Computer Networking: A Top-Down Approach (Forouzan & Mosharraf, 2023) | 对应教材第 2 章（续）

---

## 考试重点速览

| 考点 | 关键词 |
|------|--------|
| 电子邮件系统三组件 | 用户代理、邮件服务器、SMTP |
| SMTP 特性 | 推送协议、使用 TCP、端口 25 |
| 邮件访问协议 | POP3、IMAP、HTTP（Web 邮件） |
| DNS 功能 | 主机名 → IP 地址的翻译 |
| DNS 层级结构 | 根服务器、TLD 服务器、权威 DNS 服务器 |
| P2P 文件分发 | BitTorrent、自扩展性 |

---

## 一、电子邮件（Electronic Mail / E-mail）

### 1.1 Internet 邮件系统的三大组件

| 组件 | 说明 |
|------|------|
| **用户代理（User Agent）** | 允许用户读、回复、转发、保存和撰写邮件（如 Microsoft Outlook） |
| **邮件服务器（Mail Server）** | 管理并维护用户邮箱（Mailbox）；处理邮件队列 |
| **SMTP（Simple Mail Transfer Protocol）** | 在发送方邮件服务器与接收方邮件服务器之间传输邮件的主要协议 |

### 1.2 邮件发送流程（以 Alice 发给 Bob 为例）

```
Alice（用户代理）
    ↓ 撰写邮件
Alice 的邮件服务器（发送方）
    ↓ SMTP（TCP 连接）
Bob 的邮件服务器（接收方）
    ↓ 存入 Bob 的邮箱
Bob（用户代理）← POP3/IMAP/HTTP 取回
```

**详细步骤**：
1. Alice 使用用户代理撰写邮件，填写 Bob 的地址（bob@someschool.edu）
2. Alice 的用户代理将邮件发送到 Alice 的邮件服务器，放入消息队列
3. Alice 邮件服务器上的 SMTP **客户端**看到队列中的邮件，与 Bob 邮件服务器建立 **TCP 连接**
4. SMTP 握手后，客户端将邮件通过 TCP 连接发送
5. Bob 邮件服务器上的 SMTP **服务器端**接收邮件，存入 Bob 的邮箱
6. Bob 使用用户代理读取邮件

### 1.3 SMTP 协议特性

| 特性 | 说明 |
|------|------|
| **协议类型** | **推送协议（Push Protocol）** — 发送方主动推送 |
| **底层传输** | 使用 **TCP**，端口 **25** |
| **双端架构** | 客户端运行在发送方邮件服务器，服务器端运行在接收方邮件服务器 |
| **握手机制** | SMTP 客户端和服务器先进行握手，再传输邮件 |

> **注意**：若 Alice 的邮件服务器无法将邮件传递给 Bob 的邮件服务器，会将邮件保留在**消息队列（Message Queue）**中，稍后重试。

### 1.4 邮件访问协议（接收方取回邮件）

用户需要使用**邮件访问协议**从邮件服务器取回邮件：

| 协议 | 全称 | 特点 |
|------|------|------|
| **POP3** | Post Office Protocol v3 | 简单，下载后可从服务器删除 |
| **IMAP** | Internet Mail Access Protocol | 更复杂，在服务器上维护邮件状态 |
| **HTTP** | （Web 邮件） | 通过浏览器访问，邮件存储在服务器，用 HTTP 传输（如 Gmail、Hotmail、Yahoo） |

**Web 邮件（HTTP 方式）特点**：
- 用户代理是**普通 Web 浏览器**
- 发送邮件：浏览器 → HTTP → 用户邮件服务器 → SMTP → 收件方邮件服务器
- 接收邮件：邮件服务器 → HTTP → 浏览器（而非 POP3/IMAP）

---

## 二、DNS（Domain Name System / 域名系统）

### 2.1 DNS 的作用

**问题**：人们习惯使用主机名（如 www.google.com），但路由器使用 **IP 地址**。  
**解决方案**：DNS 提供**主机名到 IP 地址的翻译（解析）服务**。

| 标识方式 | 示例 | 使用者 |
|----------|------|--------|
| 主机名（Hostname） | www.google.com | 人 |
| IP 地址（IP Address） | 142.250.80.4 | 路由器 |

### 2.2 DNS 的性质

- **分布式数据库（Distributed Database）**：实现在 DNS 服务器层级结构中
- **应用层协议**：允许主机查询分布式数据库
- 常被 HTTP、SMTP、FTP 等其他应用层协议调用（用户通常不直接与 DNS 交互）

### 2.3 DNS 服务器层级结构

```
根 DNS 服务器（Root DNS Servers）
     ↓ 重定向到 TLD 服务器
顶级域服务器（TLD Servers: .com, .org, .edu, .uk 等）
     ↓ 重定向到权威服务器
权威 DNS 服务器（Authoritative DNS Servers）
     ↓ 提供最终的 IP 地址映射
本地 DNS 服务器（Local/ISP Recursive DNS Server）
```

| 层级 | 名称 | 说明 |
|------|------|------|
| **根 DNS 服务器** | Root DNS Servers | 全球约 247 个根服务器；重定向到正确的 TLD 服务器 |
| **TLD 服务器** | Top-Level Domain Servers | 负责顶级域（.com、.org、.net、.edu、.gov、.uk、.fr 等） |
| **权威 DNS 服务器** | Authoritative DNS Servers | 每个拥有公开主机（Web 服务器、邮件服务器）的组织必须提供；存储主机名→IP 的映射记录 |
| **本地 DNS 服务器** | Local/ISP Recursive DNS | ISP 提供；充当代理，递归查询并缓存结果 |

### 2.4 DNS 解析过程（迭代查询示例）

以解析 `www.someschool.edu` 为例：

```
用户主机
  ↓ 1. 查询本地 DNS（ISP DNS）
本地 DNS 服务器
  ↓ 2. 查询根 DNS 服务器
根 DNS 服务器
  ↓ 3. 返回 .edu TLD 服务器地址
本地 DNS
  ↓ 4. 查询 .edu TLD 服务器
TLD 服务器
  ↓ 5. 返回 someschool.edu 权威服务器地址
本地 DNS
  ↓ 6. 查询权威 DNS 服务器
权威 DNS 服务器
  ↓ 7. 返回 www.someschool.edu 的 IP 地址
本地 DNS → 用户主机
```

---

## 三、FTP（File Transfer Protocol / 文件传输协议）

- **FTP** 用于在主机之间传输文件
- 使用**两个并行 TCP 连接**：
  - **控制连接（Control Connection）**：端口 21，传输命令和响应
  - **数据连接（Data Connection）**：端口 20，传输文件数据
- 由于控制信息和数据分离，FTP 使用**带外（out-of-band）**控制

---

## 四、P2P 文件分发——BitTorrent

### 4.1 文件分发场景

**问题**：将大文件从单一服务器分发给大量对等节点（如 Linux 系统镜像、软件补丁）。

| 方式 | 问题 |
|------|------|
| 客户端-服务器 | 服务器需向每个节点发送完整副本，带宽压力极大 |
| P2P（BitTorrent） | 每个节点可将已下载的部分转发给其他节点，分担压力 |

### 4.2 BitTorrent 工作原理

- **Torrent（种子文件）**：一组相互交换文件块的对等节点集合
- **块（Chunk）**：文件被分成固定大小的块（通常 256KB）
- **下载同时上传**：对等节点下载块的同时也向其他节点上传
- **自扩展性**：用户越多，系统分发能力越强

**分发过程**：
1. 对等节点加入 torrent，开始下载文件块
2. 已拥有某块的节点可将其发送给需要该块的其他节点
3. 节点收到全部块后可以离开，也可以继续留在 torrent 中上传

---

## 五、核心概念总结表

| 协议 | 层次 | 功能 | 传输协议 | 端口 |
|------|------|------|----------|------|
| HTTP | 应用层 | Web 页面传输 | TCP | 80 |
| SMTP | 应用层 | 邮件发送（推送） | TCP | 25 |
| POP3 | 应用层 | 邮件访问（拉取） | TCP | 110 |
| IMAP | 应用层 | 邮件访问（保留服务器状态） | TCP | 143 |
| DNS | 应用层 | 主机名→IP 解析 | UDP（通常） | 53 |
| FTP | 应用层 | 文件传输 | TCP | 20/21 |
| BitTorrent | 应用层 | P2P 文件分发 | TCP | — |

---

*参考教材：Computer Networking: A Top-Down Approach, Forouzan & Mosharraf, 2023, 第2章*
