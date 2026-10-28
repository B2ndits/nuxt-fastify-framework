# Nuxt + Fastify 全栈框架 · 项目介绍文档

## 1. 项目概述

本项目是一个基于 **npm workspaces** 的 monorepo 全栈开发框架，采用**前后端分离架构**：

- **前端**（`apps/web`）：基于 Nuxt 4（Vue 3）的 Web 应用，负责页面渲染与交互；
- **后端**（`apps/server`）：基于 Fastify 5 的独立 API 服务，负责业务逻辑与数据接口；
- **共享包**（`packages/shared`）：存放前后端共用的 Zod 数据校验 Schema，保证两端数据结构类型一致。

项目定位是**全栈脚手架 / 起步模板**：已完成工程化配置（monorepo、双服务并行启动、开发代理、共享类型），但业务代码保持最小化——后端目前只有一个 `/api/ping` 健康检查路由，前端为 Nuxt 欢迎页，共享包中预置了一个任务（Task）输入校验 Schema，作为后续业务开发的范例。

## 2. 技术栈

| 分类             | 技术                      | 版本     | 说明                                                |
| ---------------- | ------------------------- | -------- | --------------------------------------------------- |
| 前端框架         | Nuxt                      | ^4.6.3   | 含 SSR、文件路由、Nuxt DevTools                     |
| 前端视图         | Vue                       | ^3.5.44  | —                                                   |
| 前端路由         | vue-router                | ^5.4.0   | —                                                   |
| 后端框架         | Fastify                   | ^5.12.7  | 高性能 Node.js Web 框架，内置日志                   |
| Cookie 处理      | @fastify/cookie           | ^11.1.5  | 已安装，预留 Cookie 读写能力                        |
| 参数校验         | Zod                       | ^4.6.7   | Schema 化校验，前后端共用                           |
| Fastify 类型桥接 | fastify-type-provider-zod | ^7.0.0   | 已安装，用于将 Zod Schema 接入 Fastify 路由类型系统 |
| 后端运行时工具   | tsx                       | ^4.23.15 | 免编译直接运行 TypeScript，`tsx watch` 支持热重启   |
| TypeScript       | typescript                | ^7.0.2   | 严格模式（`strict: true`）                          |
| 进程管理         | concurrently              | ^10.0.6  | 一条命令并行启动前后端两个 dev 服务                 |

## 3. 目录结构

```
nuxt-fastify-framework/
├── package.json                 # 根工作区配置（workspaces + concurrently 脚本）
├── apps/
│   ├── web/                     # Nuxt 4 前端应用（端口 3000）
│   │   ├── app/
│   │   │   └── app.vue          # 根组件（当前为 NuxtWelcome 欢迎页）
│   │   ├── public/              # 静态资源（favicon、robots.txt）
│   │   ├── server/              # Nuxt/Nitro 服务端目录（空，预留）
│   │   ├── nuxt.config.ts       # Nuxt 配置（devProxy 将 /api 代理到后端）
│   │   └── package.json
│   └── server/                  # Fastify 5 后端应用（端口 3001）
│       ├── src/
│       │   ├── main.ts          # 入口：构建实例并监听 3001 端口
│       │   └── app.ts           # 应用工厂 buildApp()，注册路由与插件
│       ├── tsconfig.json        # 独立 TS 配置（ES2022 + strict）
│       └── package.json
└── packages/
    └── shared/                  # 前后端共享包
        ├── src/
        │   ├── index.ts         # 统一导出入口
        │   └── task.ts          # 任务输入校验 Schema（Zod）
        └── package.json
```

## 4. 架构设计

### 4.1 整体架构图

```
                    浏览器访问 http://localhost:3000
                              │
                              ▼
                ┌──────────────────────────┐
                │   apps/web  (Nuxt 4)     │
                │   前端 SSR / 页面渲染      │
                │   端口 3000               │
                └────────────┬─────────────┘
                             │  /api/* 请求
                             │  devProxy 开发代理
                             ▼
                ┌──────────────────────────┐
                │ apps/server (Fastify 5)  │
                │ 独立 API 服务             │
                │ 端口 3001 (host 0.0.0.0) │
                └────────────┬─────────────┘
                             │
                             ▼
                ┌──────────────────────────┐
                │  packages/shared (Zod)   │
                │  前后端共享数据校验 Schema │
                └──────────────────────────┘
```

### 4.2 三个核心设计

**① 前后端分离 + 开发代理**

前后端是两个完全独立的进程，开发时由根目录的 `devProxy` 打通：

```ts
// apps/web/nuxt.config.ts
devProxy: {
  '/api': { target: 'http://localhost:3001', changeOrigin: true },
}
```

前端代码中所有 `/api/...` 的请求，在开发环境下会被 Nuxt 开发服务器转发到 Fastify（3001 端口），从而绕过浏览器的跨域限制；生产环境则可通过反向代理（如 Nginx）实现同样的效果。这种模式下前端不需要配置任何 CORS。

**② 应用工厂模式（buildApp）**

后端没有直接在入口文件里堆砌代码，而是拆成两层：

```ts
// apps/server/src/app.ts —— 应用工厂：组装实例、注册路由/插件
export function buildApp() {
  const app = Fastify({ logger: true });
  app.get("/api/ping", async () => ({ ok: true, ts: Date.now() }));
  return app;
}

// apps/server/src/main.ts —— 入口：只负责监听端口
const app = buildApp();
app.listen({ port: 3001, host: "0.0.0.0" });
```

好处：测试时可以 `buildApp()` 拿到实例做 `app.inject()` 注入式请求测试，无需真正占用端口；启动逻辑与业务组装解耦。

**③ 共享包零构建直引 TS 源码**

```json
// packages/shared/package.json
"exports": { ".": "./src/index.ts" }
```

共享包**不做编译打包**，直接把 TypeScript 源文件作为导出入口。两端消费侧都能原生处理 TS 源码——服务端用 `tsx` 运行，前端由 Nuxt/Vite 打包器处理——因此省去了共享包的构建步骤和 `dist` 产物，改 Schema 时两端立即生效。

### 4.3 共享校验 Schema

```ts
// packages/shared/src/task.ts
export const taskInputSchema = z.object({
  title: z.string().trim().min(1, "标题不能为空"),
  status: z.enum(["todo", "doing", "done"]).optional(),
});
export type TaskInput = z.infer<typeof taskInputSchema>;
```

这是整个框架"契约共享"理念的示例：**同一份 Schema，后端用来校验请求体，前端用来推导表单类型**。Zod 的 `z.infer` 会直接生成 TypeScript 类型，Schema 变更时两端类型自动同步，杜绝"后端改了字段、前端类型没跟上"的问题。从 Schema 内容看，项目预留的业务示例是一个任务管理（todo / doing / done）应用。

## 5. 开发工作流

### 5.1 启动

在项目根目录执行：

```bash
npm install    # 安装所有工作区依赖
npm run dev    # concurrently 并行启动 web + api
```

启动后：

| 服务        | 地址                  | 启动方式                                    |
| ----------- | --------------------- | ------------------------------------------- |
| web（前端） | http://localhost:3000 | `nuxt dev`                                  |
| api（后端） | http://localhost:3001 | `tsx watch src/main.ts`（文件变动自动重启） |

终端中两个服务的日志会以 `web`（青色）和 `api`（绿色）为前缀区分输出。

### 5.2 验证链路

访问 `http://localhost:3000/api/ping`，请求经 Nuxt 开发代理转发到 Fastify，返回：

```json
{ "ok": true, "ts": 1750000000000 }
```

也可以直接访问 `http://localhost:3001/api/ping` 验证后端本体。

## 6. 当前状态与扩展指南

### 6.1 当前状态

| 模块                                           | 状态                                      |
| ---------------------------------------------- | ----------------------------------------- |
| Monorepo 工作区 + 双服务并行启动               | ✅ 已完成                                 |
| 开发代理 `/api` → 3001                         | ✅ 已完成                                 |
| 共享包 Zod Schema（TaskInput）                 | ✅ 已完成                                 |
| 后端健康检查路由 `/api/ping`                   | ✅ 已完成                                 |
| 前端页面                                       | 🔲 Nuxt 欢迎页占位                        |
| 任务管理业务路由（增删改查）                   | 🔲 未实现（Schema 已就绪）                |
| `fastify-type-provider-zod`、`@fastify/cookie` | 🔲 已安装依赖，尚未在 `app.ts` 中注册使用 |

### 6.2 如何新增一个业务路由（推荐姿势）

以"创建任务"为例，利用已安装的 `fastify-type-provider-zod` 和共享 Schema：

```ts
// apps/server/src/app.ts
import Fastify from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import { taskInputSchema } from "shared";

export function buildApp() {
  const app = Fastify({ logger: true });

  // 让 Fastify 用 Zod 做校验和序列化
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.get("/api/ping", async () => ({ ok: true, ts: Date.now() }));

  app.post(
    "/api/tasks",
    {
      schema: { body: taskInputSchema }, // 请求体自动按共享 Schema 校验
    },
    async (request) => {
      const task = request.body; // 类型自动推导为 TaskInput
      // ...业务逻辑（持久化等）
      return { id: crypto.randomUUID(), ...task };
    },
  );

  return app;
}
```

前端则直接复用同一份 Schema 推导类型：

```ts
import { taskInputSchema, type TaskInput } from "shared";
// 表单提交前可用 taskInputSchema.safeParse() 做客户端预校验
```

### 6.3 建议的后续演进方向

- **持久化**：引入数据库（如 Prisma / Drizzle）或先用 Nuxt/Nitro 的 `useStorage` 做键值存储；
- **路由模块化**：路由增多后，按 Fastify 插件（`app.register`）拆分路由文件；
- **生产部署脚本**：为 `apps/server` 补充 `build` / `start` 脚本（如先 `tsc` 编译再 `node dist/main.js`，或直接用 tsx 运行）；
- **统一错误响应**：结合 Zod 错误信息（如"标题不能为空"）定制 Fastify 错误格式；
- **测试基建**：利用 `buildApp()` 工厂 + `app.inject()` 搭建 API 集成测试。

---
