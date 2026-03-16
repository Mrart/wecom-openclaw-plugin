/**
 * 企业微信公共工具函数
 */

import { DEFAULT_ACCOUNT_ID } from "openclaw/plugin-sdk";
import type { OpenClawConfig } from "openclaw/plugin-sdk";
import { CHANNEL_ID } from "./const.js";

// ============================================================================
// 配置类型定义
// ============================================================================

/**
 * 企业微信群组配置
 */
export interface WeComGroupConfig {
  /** 群组内发送者白名单（仅列表中的成员消息会被处理） */
  allowFrom?: Array<string | number>;
}

/**
 * 企业微信配置类型
 */
export interface WeComConfig {
  enabled?: boolean;
  websocketUrl?: string;
  botId?: string;
  secret?: string;
  name?: string;
  allowFrom?: Array<string | number>;
  dmPolicy?: "open" | "allowlist" | "pairing" | "disabled";
  /** 群组访问策略："open" = 允许所有群组（默认），"allowlist" = 仅允许 groupAllowFrom 中的群组，"disabled" = 禁用群组消息 */
  groupPolicy?: "open" | "allowlist" | "disabled";
  /** 群组白名单（仅 groupPolicy="allowlist" 时生效） */
  groupAllowFrom?: Array<string | number>;
  /** 每个群组的详细配置（如群组内发送者白名单） */
  groups?: Record<string, WeComGroupConfig>;
  /** 是否发送"思考中"消息，默认为 true */
  sendThinkingMessage?: boolean;
  /** 额外允许访问的本地媒体路径白名单（支持 ~ 表示 home 目录），如 ["~/Downloads", "~/Documents"] */
  mediaLocalRoots?: string[];
}

export const DefaultWsUrl = "wss://openws.work.weixin.qq.com";

export interface ResolvedWeComAccount {
  accountId: string;
  name: string;
  enabled: boolean;
  websocketUrl: string;
  botId: string;
  secret: string;
  /** 是否发送"思考中"消息，默认为 true */
  sendThinkingMessage: boolean;
  config: WeComConfig;
}

/**
 * 企业微信多账户配置项（用于 accounts 数组中的每个账户）
 */
export interface WeComAccountConfig {
  accountId: string;
  name?: string;
  enabled?: boolean;
  websocketUrl?: string;
  botId: string;
  secret: string;
  allowFrom?: Array<string | number>;
  dmPolicy?: "open" | "allowlist" | "pairing" | "disabled";
  groupPolicy?: "open" | "allowlist" | "disabled";
  groupAllowFrom?: Array<string | number>;
  groups?: Record<string, WeComGroupConfig>;
  sendThinkingMessage?: boolean;
  mediaLocalRoots?: string[];
}

/**
 * 企业微信配置（支持多账户模式）
 */
export interface WeComMultiAccountConfig {
  enabled?: boolean;
  websocketUrl?: string;
  botId?: string;
  secret?: string;
  name?: string;
  allowFrom?: Array<string | number>;
  dmPolicy?: "open" | "allowlist" | "pairing" | "disabled";
  groupPolicy?: "open" | "allowlist" | "disabled";
  groupAllowFrom?: Array<string | number>;
  groups?: Record<string, WeComGroupConfig>;
  sendThinkingMessage?: boolean;
  mediaLocalRoots?: string[];
  /** 多账户配置（优先级高于单账户配置） */
  accounts?: WeComAccountConfig[];
}

/**
 * 企业微信账户映射表
 */
export type WeComAccountMap = Map<string, ResolvedWeComAccount>;

/**
 * 解析企业微信账户配置
 */
export function resolveWeComAccount(cfg: OpenClawConfig): ResolvedWeComAccount {
  const wecomConfig = (cfg.channels?.[CHANNEL_ID] ?? {}) as WeComConfig;

  return {
    accountId: DEFAULT_ACCOUNT_ID,
    name: wecomConfig.name ?? "企业微信",
    enabled: wecomConfig.enabled ?? false,
    websocketUrl: wecomConfig.websocketUrl || DefaultWsUrl,
    botId: wecomConfig.botId ?? "",
    secret: wecomConfig.secret ?? "",
    sendThinkingMessage: wecomConfig.sendThinkingMessage ?? true,
    config: wecomConfig,
  };
}

/**
 * 解析企业微信多账户配置
 * 支持两种配置格式：
 * 1. 传统单账户格式：channels.wecom.botId
 * 2. 新多账户格式：channels.wecom.accounts
 */
export function resolveWeComAccounts(cfg: OpenClawConfig): ResolvedWeComAccount[] {
  const wecomConfig = (cfg.channels?.[CHANNEL_ID] ?? {}) as WeComMultiAccountConfig;
  const accounts: ResolvedWeComAccount[] = [];

  // 检查是否配置了多账户模式
  if (wecomConfig.accounts && wecomConfig.accounts.length > 0) {
    // 多账户模式：解析每个账户配置
    for (const accountConfig of wecomConfig.accounts) {
      if (!accountConfig.accountId) {
        throw new Error("Multi-account config: each account must have an accountId");
      }
      if (!accountConfig.botId) {
        throw new Error(`Multi-account config: account "${accountConfig.accountId}" is missing botId`);
      }
      if (!accountConfig.secret) {
        throw new Error(`Multi-account config: account "${accountConfig.accountId}" is missing secret`);
      }

      accounts.push({
        accountId: accountConfig.accountId,
        name: accountConfig.name ?? wecomConfig.name ?? "企业微信",
        enabled: accountConfig.enabled ?? wecomConfig.enabled ?? false,
        websocketUrl: accountConfig.websocketUrl ?? wecomConfig.websocketUrl ?? DefaultWsUrl,
        botId: accountConfig.botId,
        secret: accountConfig.secret,
        sendThinkingMessage: accountConfig.sendThinkingMessage ?? wecomConfig.sendThinkingMessage ?? true,
        config: {
          ...wecomConfig,
          ...accountConfig,
        } as WeComConfig,
      });
    }
  } else {
    // 传统单账户模式：回退到单个账户解析
    if (wecomConfig.botId) {
      accounts.push(resolveWeComAccount(cfg));
    }
  }

  return accounts;
}

/**
 * 设置企业微信账户配置
 */
export function setWeComAccount(
  cfg: OpenClawConfig,
  account: Partial<WeComConfig>,
): OpenClawConfig {
  const existing = (cfg.channels?.[CHANNEL_ID] ?? {}) as WeComConfig;
  const merged: WeComConfig = {
    enabled: account.enabled ?? existing?.enabled ?? true,
    botId: account.botId ?? existing?.botId ?? "",
    secret: account.secret ?? existing?.secret ?? "",
    allowFrom: account.allowFrom ?? existing?.allowFrom,
    dmPolicy: account.dmPolicy ?? existing?.dmPolicy,
    // 以下字段仅在已有配置值或显式传入时才写入，onboarding 时不主动生成
    ...(account.websocketUrl || existing?.websocketUrl
      ? { websocketUrl: account.websocketUrl ?? existing?.websocketUrl }
      : {}),
    ...(account.name || existing?.name
      ? { name: account.name ?? existing?.name }
      : {}),
    ...(account.sendThinkingMessage !== undefined || existing?.sendThinkingMessage !== undefined
      ? { sendThinkingMessage: account.sendThinkingMessage ?? existing?.sendThinkingMessage }
      : {}),
  };

  return {
      ...cfg,
      channels: {
        ...cfg.channels,
        [CHANNEL_ID]: merged,
      },
    };
  };
}

/**
 * 根据 accountId 查找已解析的企业微信账户
 */
export function getWeComAccountById(
  cfg: OpenClawConfig,
  accountId: string,
): ResolvedWeComAccount | undefined {
  const accounts = resolveWeComAccounts(cfg);
  return accounts.find((account) => account.accountId === accountId);
}

/**
 * 获取所有已解析的企业微信账户 ID 列表
 */
export function getAllWeComAccountIds(cfg: OpenClawConfig): string[] {
  const accounts = resolveWeComAccounts(cfg);
  return accounts.map((account) => account.accountId);
}

/**
 * 将账户列表转换为账户映射表
 */
export function createWeComAccountMap(
  accounts: ResolvedWeComAccount[],
): WeComAccountMap {
  return new Map(accounts.map((account) => [account.accountId, account]));
}
