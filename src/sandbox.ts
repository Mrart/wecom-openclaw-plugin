/**
 * Docker 沙箱管理工具
 * 
 * 提供 Agent 沙箱隔离的检查、配置生成和路径解析功能
 */

import os from "os";
import path from "path";
import type { SandboxConfig } from "./interface.js";

// ============================================================================
// 常量定义
// ============================================================================

/**
 * 沙箱模式枚举
 * 
 * - off: 不使用沙箱
 * - non-main: 仅非主 Agent 使用沙箱
 * - all: 所有 Agent 都使用沙箱
 */
export const SANDBOX_MODES = {
  OFF: "off" as const,
  NON_MAIN: "non-main" as const,
  ALL: "all" as const,
} as const;

/**
 * 沙箱配置默认值
 */
export const DEFAULT_SANDBOX_CONFIG: Omit<SandboxConfig, "mode"> = {
  scope: "agent",
  workspaceAccess: "rw",
  docker: {
    binds: [
      "/shared/skills:/skills:ro",
      "/shared/references:/references:ro",
    ],
  },
} as const;

/**
 * Docker 镜像名称
 */
export const DEFAULT_SANDBOX_IMAGE = "openclaw-agent-sandbox";

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 检查是否需要为 Agent 启用沙箱
 * 
 * @param sandboxModeConfig 沙箱模式配置
 * @param isMainAgent Agent 是否为主 Agent
 * @returns 是否需要沙箱
 */
export function isSandboxNeeded(
  sandboxModeConfig: string | undefined,
  isMainAgent: boolean
): boolean {
  if (!sandboxModeConfig) {
    return false;
  }

  const normalizedMode = sandboxModeConfig.toLowerCase() as keyof typeof SANDBOX_MODES;

  switch (SANDBOX_MODES[normalizedMode as keyof typeof SANDBOX_MODES]) {
    case "all":
      // 所有 Agent 都需要沙箱
      return true;
    case "non-main":
      // 仅非主 Agent 需要沙箱
      return !isMainAgent;
    case "off":
    default:
      // 不使用沙箱
      return false;
  }
}

/**
 * 生成 Docker 挂载绑定配置
 * 
 * 从配置文件生成 Docker 容器的 volume binds 参数
 * 
 * @param sandboxConfig 沙箱配置
 * @param agentId Agent 唯一标识符
 * @param homeDir 用户主目录（可选，默认为 os.homedir()）
 * @returns Docker binds 配置数组
 */
export function generateDockerBinds(
  sandboxConfig: SandboxConfig,
  agentId: string,
  homeDir?: string
): string[] {
  const binds: string[] = [];
  const resolvedHomeDir = homeDir ?? os.homedir();

  // 检查 Docker 配置是否存在
  if (!sandboxConfig.docker?.binds) {
    return binds;
  }

  // 处理 Docker binds 配置
  const dockerBinds = Array.isArray(sandboxConfig.docker.binds)
    ? sandboxConfig.docker.binds
    : Object.entries(sandboxConfig.docker.binds).map(([host, container]) => `${host}:${container}`);

  for (const bind of dockerBinds) {
    // 解析绑定配置，支持动态路径替换
    const resolvedBind = resolvePathVariables(bind, {
      homeDir: resolvedHomeDir,
      agentId,
    });
    binds.push(resolvedBind);
  }

  // 添加 Agent 专属工作区映射
  const workspaceDir = resolveSandboxWorkspace(agentId, resolvedHomeDir);
  binds.push(`${workspaceDir}:/workspace`);

  return binds;
}

/**
 * 解析沙箱工作区路径
 * 
 * 为每个 Agent 生成独立的沙箱工作空间路径
 * 
 * @param agentId Agent 唯一标识符
 * @param homeDir 用户主目录（可选，默认为 os.homedir()）
 * @returns 沙箱工作区绝对路径
 */
export function resolveSandboxWorkspace(
  agentId: string,
  homeDir?: string
): string {
  const resolvedHomeDir = homeDir ?? os.homedir();
  const safeAgentId = agentId.replace(/[^a-zA-Z0-9_-]/g, "_");
  
  return path.resolve(resolvedHomeDir, ".openclaw", "sandboxes", safeAgentId);
}

/**
 * 解析路径中的变量占位符
 * 
 * 支持以下变量：
 * - {homeDir}: 用户主目录
 * - {agentId}: Agent 标识符
 * 
 * @param pathString 包含变量的路径字符串
 * @param variables 变量替换值
 * @returns 解析后的路径
 */
function resolvePathVariables(
  pathString: string,
  variables: { homeDir: string; agentId: string }
): string {
  return pathString
    .replace(/{homeDir}/g, variables.homeDir)
    .replace(/{agentId}/g, variables.agentId);
}

/**
 * 检查 Docker 是否已安装并可用
 * 
 * @returns Promise<boolean> Docker 是否可用
 */
export async function checkDockerAvailable(): Promise<boolean> {
  try {
    const { exec } = await import("child_process");
    
    return new Promise((resolve) => {
      exec("docker info", (error) => {
        resolve(!error);
      });
    });
  } catch {
    return false;
  }
}

/**
 * 获取沙箱模式描述
 * 
 * @param mode 沙箱模式
 * @returns 人类可读的模式描述
 */
export function getSandboxModeDescription(mode: keyof typeof SANDBOX_MODES): string {
  const descriptions: Record<keyof typeof SANDBOX_MODES, string> = {
    OFF: "沙箱已禁用",
    "NON-MAIN": "仅非主 Agent 使用沙箱",
    ALL: "所有 Agent 都使用沙箱",
  };
  
  return descriptions[mode] ?? "未知的沙箱模式";
}

/**
 * 验证沙箱配置的有效性
 * 
 * @param config 沙箱配置
 * @returns 验证结果，包含 isValid 和 errors 数组
 */
export function validateSandboxConfig(config: SandboxConfig): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // 检查 mode 字段
  const validModes = ["process", "container", "none"];
  if (!validModes.includes(config.mode)) {
    errors.push(`无效的 mode 值：${config.mode}，有效值为：${validModes.join(", ")}`);
  }

  // 检查 scope 字段
  const validScopes = ["workspace", "agent", "global"];
  if (!validScopes.includes(config.scope as string)) {
    errors.push(`无效的 scope 值：${config.scope}，有效值为：${validScopes.join(", ")}`);
  }

  // 检查 workspaceAccess 字段
  const validAccess = ["read-only", "read-write", "isolated"];
  if (!validAccess.includes(config.workspaceAccess as string)) {
    errors.push(`无效的 workspaceAccess 值：${config.workspaceAccess}，有效值为：${validAccess.join(", ")}`);
  }

  // 检查 Docker 配置（当 mode 为 container 时）
  if (config.mode === "container") {
    if (!config.docker) {
      errors.push("当 mode 为 'container' 时，必须提供 docker 配置");
    } else if (!config.docker.binds || Object.keys(config.docker.binds).length === 0) {
      errors.push("当 mode 为 'container' 时，必须配置 docker.binds");
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// 默认导出
// ============================================================================

export default {
  SANDBOX_MODES,
  DEFAULT_SANDBOX_CONFIG,
  DEFAULT_SANDBOX_IMAGE,
  isSandboxNeeded,
  generateDockerBinds,
  resolveSandboxWorkspace,
  checkDockerAvailable,
  getSandboxModeDescription,
  validateSandboxConfig,
};
