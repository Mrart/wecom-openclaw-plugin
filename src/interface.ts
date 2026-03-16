/**
 * 企业微信渠道类型定义
 */

import type { OpenClawConfig, RuntimeEnv } from "openclaw/plugin-sdk";
import type { ResolvedWeComAccount } from "./utils.js";
import { WeComCommand } from "./const.js";

// ============================================================================
// 运行时类型
// ============================================================================

/**
 * Monitor 配置选项
 */
export type WeComMonitorOptions = {
  account: ResolvedWeComAccount;
  config: OpenClawConfig;
  runtime: RuntimeEnv;
  abortSignal?: AbortSignal;
  /** Optional per-agent MCP server configuration from agents.list[].mcpServers */
  agentMcpConfig?: Record<string, { type?: string; url: string }>;
};

// ============================================================================
// 内部状态类型
// ============================================================================

/**
 * 消息状态
 */
export interface MessageState {
  accumulatedText: string;
  /** 流式回复的 streamId，用于保持同一个流式回复使用相同的 streamId */
  streamId?: string;
  /** 是否有用户可见的文本内容（不包括 <think>...</think> 标签） */
  hasText?: boolean;
  /** 是否已成功发送过媒体文件 */
  hasMedia?: boolean;
  /** 是否有媒体发送失败（权限不足、文件过大等） */
  hasMediaFailed?: boolean;
  /** 媒体发送失败时的纯文本错误摘要（用于替换 thinking 流展示给用户） */
  mediaErrorSummary?: string;
  /** deliver 回调是否被调用过（用于区分"核心无回复"和"核心回复了空内容"） */
  deliverCalled?: boolean;
}

// ============================================================================
// MCP 配置类型
// ============================================================================

/**
 * MCP 配置响应体
 */
export interface McpConfigBody {
  /** MCP Server 的 StreamableHttp URL */
  url: string;
  /** 连接类型，如 "streamable-http" */
  type?: string;
  /** 是否已授权 */
  is_authed?: boolean;
  /** mcp业务类型 */
  biz_type?: string;
}

// ============================================================================
// WebSocket 消息类型
// ============================================================================

/**
 * WebSocket 请求消息基础格式
 */
export interface WeComRequest {
  cmd: string;
  headers: {
    req_id: string;
  };
  body: any;
}

/**
 * WebSocket 响应消息格式
 */
export interface WeComResponse {
  headers: {
    req_id: string;
  };
  errcode: number;
  errmsg: string;
}

/**
 * 企业微信认证请求
 */
export interface WeComSubscribeRequest extends WeComRequest {
  cmd: WeComCommand.SUBSCRIBE;
  body: {
    secret: string;
    bot_id: string;
  };
}

/**
 * 企业微信推送消息格式
 */
export interface WeComCallbackMessage {
  cmd: WeComCommand.AIBOT_CALLBACK;
  headers: {
    req_id: string;
  };
  body: {
    msgid: string;
    aibotid: string;
    chatid: string;
    chattype: "single" | "group";
    from: {
      userid: string;
    };
    response_url: string;
    msgtype: "text" | "image" | "voice" | "video" | "file" | "stream" | "mixed";
    text?: {
      content: string;
    };
    image?: {
      /** 图片 URL（通过 URL 方式接收图片时） */
      url?: string;
      /** 图片 base64 数据（直接传输时） */
      base64?: string;
      md5?: string;
    };
    /** 图文混排消息 */
    mixed?: {
      msg_item: Array<{
        msgtype: "text" | "image";
        text?: {
          content: string;
        };
        image?: {
          url?: string;
          base64?: string;
          md5?: string;
        };
      }>;
    };
    quote?: {
      msgtype: string;
      text?: {
        content: string;
      };
      image?: {
        url?: string;
        aeskey?: string;
      };
      file?: {
        url?: string;
        aeskey?: string;
      };
    };
    stream?: {
      id: string;
    };
  };
}

/**
 * 企业微信响应消息格式
 */
export interface WeComResponseMessage extends WeComRequest {
  cmd: WeComCommand.AIBOT_RESPONSE;
  body: {
    msgtype: "stream" | "text" | "markdown";
    stream?: {
      id: string;
      finish: boolean;
      content: string;
      msg_item?: Array<{
        msgtype: "image" | "file";
        image?: {
          base64: string;
          md5: string;
        };
      }>;
      feedback?: {
        id: string;
      };
    };
    text?: {
      content: string;
    };
    markdown?: {
      content: string;
    };
  };
}

// ============================================================================
// 多 Agent 配置类型
// ============================================================================

/**
 * Docker 沙箱配置
 * 
 * 用于 Scheme C: Docker 沙箱隔离
 * 支持容器化运行环境，提供完全的文件系统和进程隔离
 */
export interface SandboxDockerConfig {
  /** Docker 镜像名称 */
  image?: string;
  /** 容器挂载配置 */
  binds?: Record<string, string>;
  /** 容器网络模式 */
  networkMode?: string;
  /** 容器环境变量 */
  env?: Record<string, string>;
  /** 容器资源限制 */
  resources?: {
    memory?: string;
    cpu?: number;
  };
}

/**
 * 沙箱配置
 * 
 * 支持多种沙箱模式：
 * - 'process': 进程级隔离
 * - 'container': 容器级隔离（Docker）
 * - 'none': 无沙箱
 */
export interface SandboxConfig {
  /** 沙箱模式 */
  mode: "process" | "container" | "none";
  /** 沙箱作用域 */
  scope: "workspace" | "agent" | "global";
  /** 工作区访问权限 */
  workspaceAccess: "read-only" | "read-write" | "isolated";
  /** Docker 配置（当 mode 为 'container' 时） */
  docker?: SandboxDockerConfig;
  /** 允许的系统调用列表 */
  allowedSyscalls?: string[];
  /** 超时配置（毫秒） */
  timeout?: number;
}

/**
 * Agent 默认配置
 * 
 * 为所有 Agent 提供默认的沙箱配置
 */
export interface AgentDefaults {
  /** 默认沙箱配置 */
  sandbox: SandboxConfig;
  /** 默认超时配置（毫秒） */
  timeout?: number;
  /** 默认重试配置 */
  retry?: {
    /** 最大重试次数 */
    maxAttempts: number;
    /** 重试延迟（毫秒） */
    delay: number;
  };
}

/**
 * Agent 定义
 * 
 * 定义一个独立的 Agent 实例，包含其工作区和沙箱配置
 * 支持 Scheme A/B/B2/C/D 多种部署方案
 */
export interface AgentDefinition {
  /** Agent 唯一标识符 */
  id: string;
  /** Agent 工作区路径 */
  workspace: string;
  /** Agent 专属沙箱配置（可选，覆盖 defaults） */
  sandbox?: SandboxConfig;
  /** Agent 描述信息 */
  description?: string;
  /** Agent 标签，用于分类和路由 */
  tags?: string[];
  /** Agent 优先级（数字越大优先级越高） */
  priority?: number;
  /** Agent 状态 */
  status?: "active" | "inactive" | "maintenance";
}

/**
 * 通道账号配置
 * 
 * 支持每个通道配置多个账号，实现多账号管理
 * 适用于企业微信多公众号、多机器人场景
 */
export interface ChannelAccountConfig {
  /** 账号唯一标识符 */
  accountId: string;
  /** 账号凭证配置 */
  credentials: Record<string, string>;
  /** 账号状态 */
  status?: "active" | "inactive" | "suspended";
  /** 账号描述 */
  description?: string;
  /** 账号专属配置 */
  config?: Record<string, unknown>;
}

/**
 * 通道配置
 * 
 * 支持多账号配置，每个通道可以有多个账号
 */
export interface ChannelConfig {
  /** 通道类型，如 'wecom', 'wechat', 'dingtalk' */
  type: string;
  /** 通道账号配置，key 为 accountId */
  accounts: Record<string, ChannelAccountConfig>;
  /** 默认账号 ID（可选） */
  defaultAccountId?: string;
  /** 通道专属配置 */
  config?: Record<string, unknown>;
}

/**
 * 绑定规则匹配条件
 * 
 * 定义消息路由的匹配条件，用于将消息路由到正确的 Agent
 */
export interface BindingMatch {
  /** 通道类型匹配 */
  channel: string;
  /** 账号 ID 匹配（可选，不指定则匹配所有账号） */
  accountId?: string;
  /** 对等方标识（用户 ID 或群 ID） */
  peer: string;
  /** 消息类型匹配（可选） */
  messageType?: "text" | "image" | "file" | "voice" | "video" | "mixed";
  /** 标签匹配（可选） */
  tags?: string[];
}

/**
 * 绑定规则
 * 
 * 定义 Agent 与通道之间的路由规则
 * 支持 Scheme B2: 多 Agent 单 Bot（按群组路由）
 */
export interface BindingRule {
  /** 绑定的 Agent ID */
  agentId: string;
  /** 匹配条件 */
  match: BindingMatch;
  /** 规则优先级（数字越大优先级越高） */
  priority?: number;
  /** 规则描述 */
  description?: string;
  /** 规则状态 */
  status?: "active" | "inactive";
}

/**
 * 多 Agent 配置
 * 
 * 完整的多 Agent 系统配置，支持：
 * - Scheme A: 单 Agent 多 Session
 * - Scheme B: 多 Agent 软隔离
 * - Scheme B2: 多 Agent 单 Bot（按群组路由）
 * - Scheme C: Docker 沙箱隔离
 * - Scheme D: 多 Gateway 硬隔离
 */
export interface MultiAgentConfig {
  /** Agent 定义列表 */
  agents: AgentDefinition[];
  /** 所有 Agent 的默认配置 */
  defaults?: AgentDefaults;
  /** 通道配置 */
  channels: Record<string, ChannelConfig>;
  /** Agent-通道绑定规则 */
  bindings: BindingRule[];
}
