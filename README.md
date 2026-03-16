# 🤖 WeCom OpenClaw Plugin

**WeCom channel plugin for [OpenClaw](https://github.com/openclaw)** — by the Tencent WeCom team.

> A bot plugin powered by WeCom AI Bot WebSocket persistent connections. Supports direct messages & group chats, streaming replies, and proactive messaging.

---

📖 [WeCom AI Bot Official Documentation](https://open.work.weixin.qq.com/help?doc_id=21657)


## ✨ Features

- 🔗 WebSocket persistent connection for stable communication
- 💬 Supports both direct messages (DM) and group chat
- 📤 Proactive messaging to specific users or groups
- 🖼️ Receives and processes image and file messages with automatic downloading
- ⏳ Streaming replies with "thinking" placeholder messages
- 📝 Markdown formatting support for replies
- 🔒 Built-in access control: DM Policy (pairing / open / allowlist / disabled) and Group Policy (open / allowlist / disabled)
- ⚡ Auto heartbeat keep-alive and reconnection (up to 100 reconnect attempts)
- 🧙 Interactive CLI setup wizard

---

## 🚀 Getting Started

### Requirements

- OpenClaw `>= 2026.2.13`

### Quick Install

Use the CLI tool to automatically install the plugin and complete bot configuration in one step:

```shell
npx -y @wecom/wecom-openclaw-cli install
```

### Manual Install

```shell
openclaw plugins install @wecom/wecom-openclaw-plugin
```

### Configuration

#### Option 1: Interactive Setup

```shell
openclaw channels add
```

Follow the prompts to enter your WeCom bot's **Bot ID** and **Secret**.

#### Option 2: CLI Quick Setup

```shell
openclaw config set channels.wecom.botId <YOUR_BOT_ID>
openclaw config set channels.wecom.secret <YOUR_BOT_SECRET>
openclaw config set channels.wecom.enabled true
openclaw gateway restart
```

### Configuration Reference

| Config Path | Description | Options | Default |
|---|---|---|---|
| `channels.wecom.botId` | WeCom bot ID | — | — |
| `channels.wecom.secret` | WeCom bot secret | — | — |
| `channels.wecom.enabled` | Enable the channel | `true` / `false` | `false` |
| `channels.wecom.websocketUrl` | WebSocket endpoint | — | `wss://openws.work.weixin.qq.com` |
| `channels.wecom.dmPolicy` | DM access policy | `pairing` / `open` / `allowlist` / `disabled` | `open` |
| `channels.wecom.allowFrom` | DM allowlist (user IDs) | — | `[]` |
| `channels.wecom.groupPolicy` | Group chat access policy | `open` / `allowlist` / `disabled` | `open` |
| `channels.wecom.groupAllowFrom` | Group allowlist (group IDs) | — | `[]` |
| `channels.wecom.sendThinkingMessage` | Send "thinking" placeholder | `true` / `false` | `true` |

---

## 🔒 Access Control

### DM (Direct Message) Access

**Default**: `dmPolicy: "open"` — all users can send direct messages without approval.

#### Approve Pairing

```shell
openclaw pairing list wecom            # View pending pairing requests
openclaw pairing approve wecom <CODE>  # Approve a pairing request
```

#### Allowlist Mode

Configure allowed user IDs via `channels.wecom.allowFrom`:

```json
{
  "channels": {
    "wecom": {
      "dmPolicy": "allowlist",
      "allowFrom": ["user_id_1", "user_id_2"]
    }
  }
}
```

#### Open Mode

Set `dmPolicy: "open"` to allow all users to send direct messages without approval.

#### Disabled Mode

Set `dmPolicy: "disabled"` to completely block all direct messages.

### Group Access

#### Group Policy (`channels.wecom.groupPolicy`)

- `"open"` — Allow messages from all groups (default)
- `"allowlist"` — Only allow groups listed in `groupAllowFrom`
- `"disabled"` — Disable all group messages

### Group Configuration Examples

#### Allow All Groups (Default Behavior)

```json
{
  "channels": {
    "wecom": {
      "groupPolicy": "open"
    }
  }
}
```

#### Allow Only Specific Groups

```json
{
  "channels": {
    "wecom": {
      "groupPolicy": "allowlist",
      "groupAllowFrom": ["group_id_1", "group_id_2"]
    }
  }
}
```

#### Allow Only Specific Senders Within a Group (Sender Allowlist)

In addition to the group allowlist, you can restrict which members within a group are allowed to interact with the bot. Only messages from users listed in `groups.<chatId>.allowFrom` will be processed; messages from other members will be silently ignored. This is a sender-level allowlist that applies to **all messages**.

```json
{
  "channels": {
    "wecom": {
      "groupPolicy": "allowlist",
      "groupAllowFrom": ["group_id_1"],
      "groups": {
        "group_id_1": {
          "allowFrom": ["user_id_1", "user_id_2"]
        }
      }
    }
  }
}
```

---

## 🏗️ Multi-Agent Configuration

OpenClaw supports flexible multi-agent deployments with 5 different schemes. Choose based on your isolation needs and team structure.

### Quick Selection Guide

| Scheme | Isolation | Complexity | Best For |
|--------|-----------|------------|----------|
| **A** | None | ⭐ | Personal use, testing |
| **B** | Soft (workspace) | ⭐⭐ | Teams with different roles |
| **B2** | Soft + Routing | ⭐⭐⭐ | Unified bot entry point |
| **C** | Hard (Docker) | ⭐⭐⭐⭐ | Security-sensitive data |
| **D** | Hard (Separate) | ⭐⭐⭐⭐⭐ | Enterprise, high availability |

### Scheme Overview

#### Scheme A: Single Agent, Shared Workspace
- **Use case**: Personal use, testing, small teams
- **Architecture**: One agent serves all users with shared workspace
- **Config example**: [`examples/scheme-a-single-agent.json`](examples/scheme-a-single-agent.json)

```json
{
  "agents": {
    "list": [{
      "id": "main-agent",
      "workspace": "./workspace/main"
    }]
  },
  "bindings": [{
    "agent": "main-agent",
    "peer": { "kind": "wecom", "id": "xxx-your-corp-id-xxx" }
  }]
}
```

#### Scheme B: Multiple Agents, Soft Isolation (Recommended)
- **Use case**: Teams with different roles (frontend, backend, devops)
- **Architecture**: Multiple agents with separate workspaces, single gateway
- **Config example**: [`examples/scheme-b-multi-agent-soft.json`](examples/scheme-b-multi-agent-soft.json)

```json
{
  "agents": {
    "list": [
      { "id": "frontend-agent", "workspace": "./workspace/frontend" },
      { "id": "backend-agent", "workspace": "./workspace/backend" },
      { "id": "devops-agent", "workspace": "./workspace/devops" }
    ]
  },
  "bindings": [
    { "agent": "frontend-agent", "peer": { "kind": "wecom", "id": "xxx-frontend-group-id-xxx" } },
    { "agent": "backend-agent", "peer": { "kind": "wecom", "id": "xxx-backend-group-id-xxx" } }
  ]
}
```

#### Scheme B2: Multiple Agents, Single Bot (Group-Based Routing)
- **Use case**: Single WeCom bot routing to different agents by group
- **Architecture**: Router directs messages based on source group/user
- **Config example**: [`examples/scheme-b2-multi-agent-single-bot.json`](examples/scheme-b2-multi-agent-single-bot.json)

```json
{
  "routing": {
    "enabled": true,
    "strategy": "group-based",
    "fallback": "support-agent",
    "rules": [
      {
        "condition": { "peer.kind": "wecom", "peer.id": "xxx-support-group-id-xxx" },
        "target": "support-agent"
      }
    ]
  }
}
```

#### Scheme C: Docker Sandbox Isolation
- **Use case**: Security-sensitive data, untrusted commands, compliance
- **Architecture**: Each session runs in isolated Docker container
- **Config example**: [`examples/scheme-c-docker-sandbox.json`](examples/scheme-c-docker-sandbox.json)

```json
{
  "agents": {
    "defaults": {
      "sandbox": {
        "enabled": true,
        "type": "docker",
        "image": "node:20-alpine",
        "docker": {
          "binds": ["./workspace:/workspace:rw"],
          "network": "none",
          "memory": "512m"
        }
      }
    }
  },
  "security": {
    "sandboxEnforcement": true,
    "blockedCommands": ["sudo", "su", "rm -rf /"]
  }
}
```

#### Scheme D: Multiple Gateway Hard Isolation
- **Use case**: Enterprise deployments, complete department isolation
- **Architecture**: Separate gateway instances per department
- **Config example**: [`examples/scheme-d-multi-gateway.json`](examples/scheme-d-multi-gateway.json)

```json
// gateway-a/openclaw.json (port 8080)
// gateway-b/openclaw.json (port 8081)
// gateway-c/openclaw.json (port 8082)
{
  "gateway": { "port": 8080 },
  "agents": {
    "list": [{ "id": "dept-a-agent", "workspace": "./workspace/department-a" }]
  }
}
```

---

## 📋 Choosing a Scheme

### Decision Tree

```
Need isolation?
├─ No → Scheme A (personal/testing)
└─ Yes
   ├─ Team with different roles? → Scheme B (soft isolation)
   ├─ Single bot, multiple departments? → Scheme B2 (routing)
   ├─ Security/compliance required? → Scheme C (Docker)
   └─ Enterprise/HA required? → Scheme D (multi-gateway)
```

### Comparison Matrix

| Requirement | A | B | B2 | C | D |
|-------------|---|---|----|---|---|
| Personal use | ✅ | ⚠️ | ❌ | ❌ | ❌ |
| Team collaboration | ❌ | ✅ | ✅ | ⚠️ | ✅ |
| Different roles | ❌ | ✅ | ✅ | ⚠️ | ✅ |
| Single bot entry | ❌ | ❌ | ✅ | ❌ | ❌ |
| Security isolation | ❌ | ❌ | ❌ | ✅ | ✅ |
| Independent scaling | ❌ | ❌ | ❌ | ❌ | ✅ |
| Simple setup | ✅ | ✅ | ⚠️ | ❌ | ❌ |

**Legend**: ✅ Ideal | ⚠️ Possible | ❌ Not suitable

---

## ⚙️ Multi-Agent Configuration Reference

### New Configuration Fields

| Field | Type | Description | Default |
|-------|------|-------------|---------|
| `agents.list[].id` | string | Unique agent identifier | — |
| `agents.list[].name` | string | Human-readable agent name | — |
| `agents.list[].workspace` | string | Agent workspace directory | — |
| `agents.list[].settings.systemPrompt` | string | Agent-specific system prompt | — |
| `agents.list[].settings.temperature` | number | Model temperature (0-2) | 0.7 |
| `agents.defaults` | object | Default settings for all agents | `{}` |
| `agents.defaults.sandbox` | object | Docker sandbox configuration | — |
| `bindings[].agent` | string | Target agent ID for this binding | — |
| `bindings[].description` | string | Optional binding description | — |
| `routing.enabled` | boolean | Enable message routing | `false` |
| `routing.strategy` | string | `group-based` or `user-based` | — |
| `routing.fallback` | string | Default agent when no rule matches | — |
| `routing.rules[]` | array | Routing rules with conditions | `[]` |
| `sessions.isolation` | string | `soft` or `hard` | `soft` |
| `security.sandboxEnforcement` | boolean | Enforce Docker sandbox | `false` |
| `security.blockedCommands` | array | Commands to block in sandbox | `[]` |

### Environment Variables

All sensitive values support environment variable substitution:

```json
{
  "gateway": { "token": "${GATEWAY_TOKEN}" },
  "agents": {
    "list": [{
      "model": { "apiKey": "${OPENAI_API_KEY}" }
    }]
  }
}
```

---

## 🔄 Migration Guide

### From Single Agent (Scheme A) to Multi-Agent (Scheme B)

**Step 1**: Add additional agents to `agents.list`:

```json
// Before
"agents": {
  "list": [{ "id": "main-agent", "workspace": "./workspace/main" }]
}

// After
"agents": {
  "list": [
    { "id": "frontend-agent", "workspace": "./workspace/frontend" },
    { "id": "backend-agent", "workspace": "./workspace/backend" }
  ]
}
```

**Step 2**: Update bindings to specify target agents:

```json
"bindings": [
  { "agent": "frontend-agent", "peer": { "kind": "wecom", "id": "xxx-frontend-group" } },
  { "agent": "backend-agent", "peer": { "kind": "wecom", "id": "xxx-backend-group" } }
]
```

**Step 3**: Create separate workspace directories:

```bash
mkdir -p ./workspace/frontend ./workspace/backend
```

### Adding Routing (Scheme B → B2)

Add a `routing` section to enable automatic message routing:

```json
"routing": {
  "enabled": true,
  "strategy": "group-based",
  "fallback": "main-agent",
  "rules": [
    {
      "condition": { "peer.kind": "wecom", "peer.id": "xxx-group-id" },
      "target": "specific-agent"
    }
  ]
}
```

### Adding Docker Sandbox (Scheme B → C)

Add sandbox configuration to `agents.defaults`:

```json
"agents": {
  "defaults": {
    "sandbox": {
      "enabled": true,
      "type": "docker",
      "image": "node:20-alpine",
      "docker": {
        "binds": ["./workspace:/workspace:rw"],
        "network": "none",
        "memory": "512m",
        "cpuQuota": 50000
      }
    }
  }
}
```

**Prerequisites**:

```bash
# Install Docker
brew install --cask docker  # macOS
apt-get install docker.io   # Linux

# Verify
docker run hello-world
```

### Splitting to Multiple Gateways (Scheme B → D)

1. Copy installation to separate directories:
   ```bash
   cp -r openclaw gateway-a
   cp -r openclaw gateway-b
   ```

2. Update each gateway's port and workspace:
   ```json
   // gateway-a/openclaw.json
   { "gateway": { "port": 8080 }, "agents": { "list": [{ "workspace": "./workspace/department-a" }] } }
   
   // gateway-b/openclaw.json
   { "gateway": { "port": 8081 }, "agents": { "list": [{ "workspace": "./workspace/department-b" }] } }
   ```

3. Run each gateway separately:
   ```bash
   cd gateway-a && openclaw start  # Terminal 1
   cd gateway-b && openclaw start  # Terminal 2
   ```

---

## 📁 Examples

Complete configuration files for all 5 schemes are available in the [`examples/`](examples/) directory:

| File | Scheme | Description |
|------|--------|-------------|
| [`scheme-a-single-agent.json`](examples/scheme-a-single-agent.json) | A | Single agent, shared workspace |
| [`scheme-b-multi-agent-soft.json`](examples/scheme-b-multi-agent-soft.json) | B | Multiple agents, soft isolation |
| [`scheme-b2-multi-agent-single-bot.json`](examples/scheme-b2-multi-agent-single-bot.json) | B2 | Multiple agents with routing |
| [`scheme-c-docker-sandbox.json`](examples/scheme-c-docker-sandbox.json) | C | Docker sandbox isolation |
| [`scheme-d-multi-gateway.json`](examples/scheme-d-multi-gateway.json) | D | Multiple gateway deployment |

For detailed documentation on each scheme, see [`examples/README.md`](examples/README.md).

---

## 📦 Update

```shell
openclaw plugins update wecom-openclaw-plugin
```

---

## 📄 License

MIT
