#!/usr/bin/env node
/**
 * 企业微信配置迁移工具
 * 
 * 支持将单账户格式的配置迁移到多账户格式
 * 
 * 功能:
 * - migrateSingleToMultiAccount(): 迁移单账户到多账户格式
 * - validateConfig(): 验证配置 schema
 * - createBackup(): 创建配置备份
 * - CLI 命令支持
 * 
 * @example
 * // 程序化使用
 * import { migrateSingleToMultiAccount, validateConfig, createBackup } from './migrate-config.js';
 * 
 * @example
 * // CLI 使用
 * npx tsx src/migrate-config.ts --config ~/.openclaw/openclaw.json
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { CHANNEL_ID } from "./const.js";
import type { WeComConfig, WeComAccountConfig } from "./utils.js";

// ============================================================================
// 常量定义
// ============================================================================

/** 默认的配置存储目录 */
const DEFAULT_CONFIG_DIR = path.join(os.homedir(), ".openclaw");

/** 旧版配置文件路径 */
const LEGACY_CONFIG_PATH = path.join(DEFAULT_CONFIG_DIR, "wecomConfig", "config.json");

/** 新版配置文件路径 */
const NEW_CONFIG_PATH = path.join(DEFAULT_CONFIG_DIR, "openclaw.json");

/** 备份目录 */
const BACKUP_DIR = path.join(DEFAULT_CONFIG_DIR, "config-backups");

/** 配置版本标识 */
const CONFIG_VERSION_KEY = "_migrateVersion";
const CURRENT_CONFIG_VERSION = "2.0.0";

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 单账户格式的配置（旧版）
 */
export interface SingleAccountConfig {
  pluginConfigPath?: string;
  mcpConfig?: Record<string, unknown>;
  channels?: {
    wecom?: WeComConfig;
  };
  [key: string]: unknown;
}

/**
 * 多账户格式的配置（新版）
 */
export interface MultiAccountConfig {
  pluginConfigPath?: string;
  mcpConfig?: Record<string, unknown>;
  channels?: {
    wecom?: WeComConfig & {
      accounts?: Record<string, WeComAccountConfig>;
    };
  };
  [key: string]: unknown;
}

/**
 * 迁移结果
 */
export interface MigrationResult {
  /** 是否成功 */
  success: boolean;
  /** 迁移前的配置 */
  originalConfig: SingleAccountConfig | null;
  /** 迁移后的配置 */
  migratedConfig: MultiAccountConfig | null;
  /** 备份文件路径 */
  backupPath: string | null;
  /** 错误信息（如果有） */
  error?: string;
  /** 日志信息 */
  logs: string[];
}

/**
 * 配置验证结果
 */
export interface ValidationResult {
  /** 是否有效 */
  valid: boolean;
  /** 错误列表 */
  errors: string[];
  /** 警告列表 */
  warnings: string[];
  /** 配置格式类型 */
  configType: "single" | "multi" | "unknown";
}

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 生成带时间戳的备份文件名
 */
function generateBackupFilename(originalPath: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const basename = path.basename(originalPath, ".json");
  return `${basename}.${timestamp}.backup.json`;
}

/**
 * 格式化 JSON 输出
 */
function formatJson(obj: unknown): string {
  return JSON.stringify(obj, null, 2);
}

/**
 * 日志输出
 */
function log(message: string, level: "info" | "warn" | "error" = "info"): void {
  const timestamp = new Date().toISOString();
  const prefix = {
    info: "ℹ️",
    warn: "⚠️",
    error: "❌",
  }[level];
  console.log(`${prefix} [${timestamp}] ${message}`);
}

// ============================================================================
// 核心功能函数
// ============================================================================

/**
 * 创建配置备份
 * 
 * @param configPath 配置文件路径
 * @param backupDir 备份目录（可选，默认 ~/.openclaw/config-backups）
 * @returns 备份文件路径
 * 
 * @throws Error 当备份失败时抛出错误
 * 
 * @example
 * const backupPath = await createBackup("~/.openclaw/openclaw.json");
 * console.log(`Backup created at: ${backupPath}`);
 */
export async function createBackup(
  configPath: string,
  backupDir: string = BACKUP_DIR,
): Promise<string> {
  const logs: string[] = [];
  
  // 展开 ~ 路径
  const expandedPath = configPath.startsWith("~")
    ? path.join(os.homedir(), configPath.slice(1))
    : configPath;
  const expandedBackupDir = backupDir.startsWith("~")
    ? path.join(os.homedir(), backupDir.slice(1))
    : backupDir;

  log(`Creating backup of: ${expandedPath}`, "info");
  logs.push(`Creating backup of: ${expandedPath}`);

  try {
    // 检查源文件是否存在
    await fs.access(expandedPath);
    
    // 读取源文件内容
    const content = await fs.readFile(expandedPath, "utf-8");
    
    // 确保备份目录存在
    await fs.mkdir(expandedBackupDir, { recursive: true });
    
    // 生成备份文件名
    const backupFilename = generateBackupFilename(expandedPath);
    const backupPath = path.join(expandedBackupDir, backupFilename);
    
    // 写入备份文件
    await fs.writeFile(backupPath, content, "utf-8");
    
    const message = `Backup created: ${backupPath}`;
    log(message, "info");
    logs.push(message);
    
    return backupPath;
  } catch (err: any) {
    const message = `Failed to create backup: ${err.message}`;
    log(message, "error");
    logs.push(message);
    throw new Error(message);
  }
}

/**
 * 验证配置 schema
 * 
 * @param config 配置对象
 * @returns 验证结果
 * 
 * @example
 * const result = await validateConfig(configObject);
 * if (!result.valid) {
 *   console.error("Config validation failed:", result.errors);
 * }
 */
export async function validateConfig(config: unknown): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  log("Validating configuration schema...", "info");
  
  // 检查是否为对象
  if (!config || typeof config !== "object") {
    errors.push("Configuration must be a non-null object");
    return {
      valid: false,
      errors,
      warnings,
      configType: "unknown",
    };
  }
  
  const cfg = config as Record<string, unknown>;
  let configType: "single" | "multi" | "unknown" = "unknown";
  
  // 检查 channels.wecom 配置
  const channels = cfg.channels as Record<string, unknown> | undefined;
  if (channels) {
    const wecom = channels.wecom as Record<string, unknown> | undefined;
    if (wecom) {
      // 检查是否有多账户配置
      if (wecom.accounts) {
        const accounts = wecom.accounts as Record<string, unknown>;
        if (typeof accounts === "object" && accounts !== null) {
          configType = "multi";
          log("Detected multi-account format", "info");
          
          // 验证每个账户的配置
          for (const [accountId, account] of Object.entries(accounts)) {
            if (!account || typeof account !== "object") {
              errors.push(`Account "${accountId}" must be an object`);
              continue;
            }
            const acc = account as Record<string, unknown>;
            
            // 检查必填字段
            if (!acc.botId || typeof acc.botId !== "string") {
              errors.push(`Account "${accountId}" missing required field: botId`);
            }
            if (!acc.secret || typeof acc.secret !== "string") {
              errors.push(`Account "${accountId}" missing required field: secret`);
            }
            
            // 检查可选字段类型
            if (acc.enabled !== undefined && typeof acc.enabled !== "boolean") {
              warnings.push(`Account "${accountId}": enabled should be a boolean`);
            }
            if (acc.allowFrom !== undefined && !Array.isArray(acc.allowFrom)) {
              warnings.push(`Account "${accountId}": allowFrom should be an array`);
            }
          }
        }
      } else if (wecom.botId || wecom.secret) {
        configType = "single";
        log("Detected single-account format", "info");
        
        // 验证单账户字段
        if (wecom.botId !== undefined && typeof wecom.botId !== "string") {
          errors.push("botId should be a string");
        }
        if (wecom.secret !== undefined && typeof wecom.secret !== "string") {
          errors.push("secret should be a string");
        }
        if (wecom.enabled !== undefined && typeof wecom.enabled !== "boolean") {
          warnings.push("enabled should be a boolean");
        }
      }
    }
  }
  
  // 检查版本标识
  if (cfg[CONFIG_VERSION_KEY]) {
    const version = cfg[CONFIG_VERSION_KEY] as string;
    log(`Config version: ${version}`, "info");
  }
  
  const valid = errors.length === 0;
  const message = valid
    ? `Configuration validation passed (format: ${configType})`
    : `Configuration validation failed with ${errors.length} error(s)`;
  log(message, valid ? "info" : "error");
  
  if (warnings.length > 0) {
    log(`Warnings: ${warnings.length}`, "warn");
  }
  
  return {
    valid,
    errors,
    warnings,
    configType,
  };
}

/**
 * 迁移单账户到多账户格式
 * 
 * 将旧版的单账户配置转换为新版的多账户格式:
 * - 保留所有现有配置值
 * - 将 channels.wecom 下的 botId/secret 等迁移到 channels.wecom.accounts.default
 * - 添加版本标识
 * 
 * @param config 原始配置对象
 * @param targetAccountId 目标账户 ID（默认为 "default"）
 * @param accountName 账户名称（默认为"企业微信"）
 * @returns 迁移后的配置对象
 * 
 * @throws Error 当配置格式不正确时抛出错误
 * 
 * @example
 * const migrated = await migrateSingleToMultiAccount(originalConfig);
 */
export async function migrateSingleToMultiAccount(
  config: SingleAccountConfig,
  targetAccountId: string = "default",
  accountName: string = "企业微信",
): Promise<MultiAccountConfig> {
  log("Starting migration from single-account to multi-account format...", "info");
  
  // 验证输入配置
  const validationResult = await validateConfig(config);
  if (!validationResult.valid) {
    throw new Error(`Invalid configuration: ${validationResult.errors.join(", ")}`);
  }
  
  if (validationResult.configType === "multi") {
    log("Configuration is already in multi-account format, skipping migration", "warn");
    return config as MultiAccountConfig;
  }
  
  const cfg = { ...config } as SingleAccountConfig;
  
  // 提取现有的 wecom 配置
  const existingWecomConfig: WeComConfig = {
    ...(cfg.channels?.wecom as WeComConfig | undefined),
  };
  
  // 构建新的账户配置
  const newAccountConfig: WeComAccountConfig = {
    accountId: targetAccountId,
    name: accountName,
    enabled: existingWecomConfig.enabled ?? true,
    botId: existingWecomConfig.botId ?? "",
    secret: existingWecomConfig.secret ?? "",
  };
  
  // 迁移其他配置字段
  const fieldsToMigrate: (keyof WeComConfig)[] = [
    "websocketUrl",
    "allowFrom",
    "dmPolicy",
    "groupPolicy",
    "groupAllowFrom",
    "groups",
    "sendThinkingMessage",
    "mediaLocalRoots",
  ];
  
  for (const field of fieldsToMigrate) {
    if (existingWecomConfig[field] !== undefined) {
      (newAccountConfig as Record<string, unknown>)[field] = existingWecomConfig[field];
    }
  }
  
  // 构建新的 channels 配置
  const newWecomConfig: WeComConfig & { accounts?: Record<string, WeComAccountConfig> } = {
    // 保留顶层的 enabled 作为总开关
    enabled: existingWecomConfig.enabled,
    // 添加 accounts 配置
    accounts: {
      [targetAccountId]: newAccountConfig,
    },
  };
  
  // 构建迁移后的配置
  const migratedConfig: MultiAccountConfig = {
    ...cfg,
    channels: {
      ...cfg.channels,
      wecom: newWecomConfig,
    },
    // 添加版本标识
    [CONFIG_VERSION_KEY]: CURRENT_CONFIG_VERSION,
  };
  
  // 移除已迁移到账户级别的字段（避免重复）
  const fieldsToRemove: (keyof WeComConfig)[] = [
    "botId",
    "secret",
    "allowFrom",
    "dmPolicy",
    "groupPolicy",
    "groupAllowFrom",
    "groups",
    "sendThinkingMessage",
    "mediaLocalRoots",
  ];
  
  for (const field of fieldsToRemove) {
    delete (migratedConfig.channels!.wecom as Record<string, unknown>)[field];
  }
  
  log("Migration completed successfully", "info");
  log(`Account "${targetAccountId}" created with botId: ${newAccountConfig.botId ? "******" : "(empty)"}`, "info");
  
  return migratedConfig;
}

/**
 * 加载配置文件
 */
async function loadConfig(configPath: string): Promise<SingleAccountConfig> {
  // 展开 ~ 路径
  const expandedPath = configPath.startsWith("~")
    ? path.join(os.homedir(), configPath.slice(1))
    : configPath;
  
  log(`Loading configuration from: ${expandedPath}`, "info");
  
  try {
    const content = await fs.readFile(expandedPath, "utf-8");
    return JSON.parse(content) as SingleAccountConfig;
  } catch (err: any) {
    if (err.code === "ENOENT") {
      throw new Error(`Configuration file not found: ${expandedPath}`);
    }
    if (err instanceof SyntaxError) {
      throw new Error(`Invalid JSON in configuration file: ${err.message}`);
    }
    throw err;
  }
}

/**
 * 保存配置文件
 */
async function saveConfig(config: MultiAccountConfig, configPath: string): Promise<void> {
  // 展开 ~ 路径
  const expandedPath = configPath.startsWith("~")
    ? path.join(os.homedir(), configPath.slice(1))
    : configPath;
  
  log(`Saving configuration to: ${expandedPath}`, "info");
  
  // 确保目录存在
  const dir = path.dirname(expandedPath);
  await fs.mkdir(dir, { recursive: true });
  
  // 写入配置
  const content = formatJson(config);
  await fs.writeFile(expandedPath, content, "utf-8");
  
  log("Configuration saved successfully", "info");
}

/**
 * 自动检测配置文件路径
 */
function detectConfigPath(preferNew: boolean = true): string | null {
  const candidates = preferNew
    ? [NEW_CONFIG_PATH, LEGACY_CONFIG_PATH]
    : [LEGACY_CONFIG_PATH, NEW_CONFIG_PATH];
  
  for (const candidate of candidates) {
    try {
      fs.accessSync(candidate);
      return candidate;
    } catch {
      // 文件不存在，继续检查下一个
    }
  }
  
  return null;
}

// ============================================================================
// CLI 入口
// ============================================================================

/**
 * 打印帮助信息
 */
function printHelp(): void {
  console.log(`
企业微信配置迁移工具

用法:
  npx tsx src/migrate-config.ts [选项]

选项:
  --config, -c <path>    配置文件路径（默认自动检测）
  --backup, -b <dir>     备份目录（默认：~/.openclaw/config-backups）
  --dry-run              仅模拟运行，不实际修改配置
  --output, -o <path>    输出迁移后的配置到指定文件
  --account-id <id>      目标账户 ID（默认：default）
  --account-name <name>  账户名称（默认：企业微信）
  --validate             仅验证配置，不执行迁移
  --help, -h             显示帮助信息

示例:
  # 自动检测配置并迁移
  npx tsx src/migrate-config.ts

  # 指定配置文件
  npx tsx src/migrate-config.ts --config ~/.openclaw/openclaw.json

  # 仅验证配置
  npx tsx src/migrate-config.ts --validate --config ./config.json

  # 模拟运行（查看变更但不保存）
  npx tsx src/migrate-config.ts --dry-run

  # 迁移到新账户
  npx tsx src/migrate-config.ts --account-id gushen --account-name "客服机器人"
`);
}

/**
 * 解析命令行参数
 */
function parseArgs(args: string[]): Record<string, string | boolean> {
  const parsed: Record<string, string | boolean> = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
    } else if (arg === "--config" || arg === "-c") {
      parsed.config = args[++i];
    } else if (arg === "--backup" || arg === "-b") {
      parsed.backup = args[++i];
    } else if (arg === "--dry-run") {
      parsed.dryRun = true;
    } else if (arg === "--output" || arg === "-o") {
      parsed.output = args[++i];
    } else if (arg === "--account-id") {
      parsed.accountId = args[++i];
    } else if (arg === "--account-name") {
      parsed.accountName = args[++i];
    } else if (arg === "--validate") {
      parsed.validate = true;
    }
  }
  
  return parsed;
}

/**
 * CLI 主函数
 */
async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  
  // 显示帮助
  if (args.help) {
    printHelp();
    return 0;
  }
  
  const logs: string[] = [];
  
  try {
    // 检测配置文件
    let configPath = args.config as string | undefined;
    if (!configPath) {
      configPath = detectConfigPath() || undefined;
      if (!configPath) {
        log("No configuration file found. Please specify with --config", "error");
        return 1;
      }
      log(`Auto-detected configuration file: ${configPath}`, "info");
    }
    
    // 加载配置
    const config = await loadConfig(configPath);
    
    // 验证配置
    const validationResult = await validateConfig(config);
    if (!validationResult.valid) {
      log(`Configuration validation failed:`, "error");
      validationResult.errors.forEach(e => log(`  - ${e}`, "error"));
      return 1;
    }
    
    log(`Configuration format: ${validationResult.configType}`, "info");
    
    // 如果仅需验证
    if (args.validate) {
      log("Configuration validation passed", "info");
      if (validationResult.configType === "multi") {
        log("Already in multi-account format, no migration needed", "info");
      }
      return 0;
    }
    
    // 如果已是多账户格式，跳过迁移
    if (validationResult.configType === "multi") {
      log("Configuration is already in multi-account format, skipping migration", "info");
      return 0;
    }
    
    // 创建备份
    const backupDir = (args.backup as string) || BACKUP_DIR;
    const backupPath = await createBackup(configPath, backupDir);
    
    // 执行迁移
    const accountId = (args.accountId as string) || "default";
    const accountName = (args.accountName as string) || "企业微信";
    const migratedConfig = await migrateSingleToMultiAccount(config, accountId, accountName);
    
    // 输出结果
    if (args.dryRun) {
      log("DRY RUN - Changes preview:", "info");
      console.log("\n--- Migrated Configuration ---");
      console.log(formatJson(migratedConfig));
      console.log("--- End Preview ---\n");
    } else if (args.output) {
      // 输出到指定文件
      await saveConfig(migratedConfig, args.output as string);
      log(`Migrated configuration saved to: ${args.output}`, "info");
    } else {
      // 保存到原文件
      await saveConfig(migratedConfig, configPath);
      log(`Migration completed!`, "info");
      log(`Backup: ${backupPath}`, "info");
      log(`Original config preserved in backup.`, "info");
      
      console.log("\n" + "=".repeat(60));
      console.log("MIGRATION SUMMARY");
      console.log("=".repeat(60));
      console.log(`Config file: ${configPath}`);
      console.log(`Backup file: ${backupPath}`);
      console.log(`Account ID: ${accountId}`);
      console.log(`Account name: ${accountName}`);
      console.log("Format: Single-account → Multi-account");
      console.log("=".repeat(60) + "\n");
    }
    
    return 0;
  } catch (err: any) {
    log(`Migration failed: ${err.message}`, "error");
    
    if (process.env.DEBUG) {
      console.error(err);
    }
    
    return 1;
  }
}

// ============================================================================
// 导出
// ============================================================================

// 程序化使用导出（常量）
export {
  LEGACY_CONFIG_PATH,
  NEW_CONFIG_PATH,
  BACKUP_DIR,
  CONFIG_VERSION_KEY,
  CURRENT_CONFIG_VERSION,
  type SingleAccountConfig,
  type MultiAccountConfig,
  type MigrationResult,
  type ValidationResult,
};

// CLI 入口
if (process.argv[1]?.endsWith("migrate-config.ts") || 
    process.argv[1]?.endsWith("migrate-config.js")) {
  main()
    .then(code => process.exit(code))
    .catch(err => {
      console.error("Fatal error:", err);
      process.exit(1);
    });
}
