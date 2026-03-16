# OpenClaw Multi-Agent Deployment Schemes

This directory contains example configuration files for 5 different multi-agent deployment schemes. Each scheme offers different trade-offs in terms of isolation, complexity, and use cases.

## Quick Selection Guide

| Scheme | Isolation | Complexity | Best For |
|--------|-----------|------------|----------|
| A | None | ⭐ | Personal use, testing |
| B | Soft (workspace) | ⭐⭐ | Teams with different roles |
| B2 | Soft + Routing | ⭐⭐⭐ | Unified bot entry point |
| C | Hard (Docker) | ⭐⭐⭐⭐ | Security-sensitive data |
| D | Hard (Separate) | ⭐⭐⭐⭐⭐ | Enterprise, high availability |

---

## Scheme A: Single Agent, Multiple Sessions

**Config**: `scheme-a-single-agent.json`

### When to Use
- Personal use on your own machine
- Testing and development
- Small teams where all users need the same capabilities
- No sensitive data handling required

### Architecture
```
┌─────────────┐
│   Gateway   │ port 8080
└──────┬──────┘
       │
┌──────▼──────┐
│ Single Agent│ ./workspace/main
└──────┬──────┘
       │
┌──────▼──────┐
│  All Users  │ Shared session storage
└─────────────┘
```

### Pros
- Simplest setup, single configuration file
- All users share the same context and workspace
- Easy to manage and debug
- Minimal resource consumption

### Cons
- No isolation between users
- All users share the same workspace
- Session history is shared
- Not suitable for teams with different access levels

### Workspace Structure
```
./workspace/main/     # All agents work here
./sessions/           # Shared session storage
./logs/               # Log files
```

---

## Scheme B: Multiple Agents with Soft Isolation (Recommended)

**Config**: `scheme-b-multi-agent-soft.json`

### When to Use
- Teams with different roles (frontend, backend, devops)
- Need separate workspaces per agent
- Want different model settings per agent
- Trust all agents but need organizational separation

### Architecture
```
┌─────────────┐
│   Gateway   │ port 8080
└──────┬──────┘
       │
   ┌───┴───┬───────────┐
   ▼       ▼           ▼
┌─────┐ ┌─────┐ ┌─────────┐
│ FE  │ │ BE  │ │ DevOps  │ Different workspaces
│ agt │ │ agt │ │  agt    │
└─────┘ └─────┘ └─────────┘
   │       │           │
┌──┴──┐ ┌──┴──┐ ┌─────┴─────┐
│ FE  │ │ BE  │ │  DevOps   │ Separate groups
│ grp │ │ grp │ │   grp     │
└─────┘ └─────┘ └───────────┘
```

### Pros
- Clear separation of concerns
- Different system prompts per agent
- Separate workspace directories
- Easy to scale by adding more agents

### Cons
- Soft isolation only (same process)
- All agents share the same gateway
- Configuration file grows with more agents

### Workspace Structure
```
./workspace/frontend/   # Frontend agent files
./workspace/backend/    # Backend agent files
./workspace/devops/     # DevOps agent files
./sessions/             # Shared session storage
./logs/                 # Log files
```

---

## Scheme B2: Multiple Agents, Single Bot (Routing by Group)

**Config**: `scheme-b2-multi-agent-single-bot.json`

### When to Use
- Single WeCom bot for all departments
- Need to route messages based on source group
- Want unified entry point with backend routing
- Customer support + sales + technical teams

### Architecture
```
┌─────────────┐
│   Gateway   │ port 8080
└──────┬──────┘
       │
┌──────▼──────┐
│   Router    │ Routes by peer.kind + peer.id
└──────┬──────┘
   ┌───┴───┬───────────┐
   ▼       ▼           ▼
┌─────┐ ┌─────┐ ┌─────────┐
│Supp │ │Sales│ │Technical│
│ agt │ │ agt │ │  agt    │
└─────┘ └─────┘ └─────────┘
   │       │           │
┌──┴──┐ ┌──┴──┐ ┌─────┴─────┐
│Supp │ │Sales│ │Technical│ Different groups
│ grp │ │ grp │ │  grp    │
└─────┘ └─────┘ └───────────┘
```

### Key Configuration
```json
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
```

### Pros
- Single bot to manage in WeCom admin
- Clean separation of user groups
- Automatic routing based on sender
- Fallback handling for unknown sources

### Cons
- Requires careful group ID management
- Routing adds complexity
- Need to configure routing rules

### Workspace Structure
```
./workspace/support/    # Support agent files
./workspace/sales/      # Sales agent files
./workspace/technical/  # Technical agent files
./sessions/             # Per-group session storage
./logs/                 # Log files
```

---

## Scheme C: Docker Sandbox Isolation

**Config**: `scheme-c-docker-sandbox.json`

### When to Use
- Handling sensitive or untrusted data
- Running potentially dangerous commands
- Multi-tenant environments
- Compliance requirements for isolation
- Security-first deployments

### Architecture
```
┌─────────────┐
│   Gateway   │ port 8080
└──────┬──────┘
       │
┌──────▼──────┐
│   Agent     │
└──────┬──────┘
       │
┌──────▼──────┐
│ Docker      │ Container per session
│ Container   │ - node:20-alpine
│             │ - Memory: 512m
│             │ - Network: none
└──────┬──────┘
       │
┌──────▼──────┐
│ Safe        │ Binds: ./workspace:/workspace
│ Workspace   │
└─────────────┘
```

### Key Configuration
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

### Pros
- Hard isolation between sessions
- Prevents host system access
- Resource limits (CPU, memory)
- Network isolation possible
- Container cleanup after use

### Cons
- Requires Docker installed
- Higher resource overhead
- Slower cold start
- More complex debugging
- Docker socket access needed

### Prerequisites
```bash
# Install Docker
# macOS: brew install --cask docker
# Linux: apt-get install docker.io

# Start Docker daemon
dockerd

# Verify installation
docker run hello-world
```

### Workspace Structure
```
./workspace/secure/     # Mount point for container
./tmp/                  # Temporary files
./sessions/             # Session storage (outside container)
./logs/                 # Log files
```

---

## Scheme D: Multiple Gateway Hard Isolation

**Config**: `scheme-d-multi-gateway.json`

### When to Use
- Enterprise deployments
- High availability requirements
- Complete isolation between departments
- Different security policies per department
- Geographic distribution

### Architecture
```
Gateway A                    Gateway B                    Gateway C
_port: 8080_                 _port: 8081_                 _port: 8082_
     │                            │                            │
     ▼                            ▼                            ▼
┌─────────┐                  ┌─────────┐                  ┌─────────┐
│ Dept A  │                  │ Dept B  │                  │ Dept C  │
│  Agent  │                  │  Agent  │                  │  Agent  │
└─────────┘                  └─────────┘                  └─────────┘
     │                            │                            │
     ▼                            ▼                            ▼
./workspace/                 ./workspace/                 ./workspace/
department-a/                department-b/                department-c/
```

### Deployment Structure
```
gateway-a/
├── openclaw.json           # Port 8080, Dept A config
├── workspace/
│   └── department-a/
└── sessions/

gateway-b/
├── openclaw.json           # Port 8081, Dept B config
├── workspace/
│   └── department-b/
└── sessions/

gateway-c/
├── openclaw.json           # Port 8082, Dept C config
├── workspace/
│   └── department-c/
└── sessions/
```

### Sample Gateway B Config
```json
{
  "gateway": {
    "host": "0.0.0.0",
    "port": 8081,
    "path": "/openclaw/message",
    "token": "xxx-gateway-b-token-xxx"
  },
  "agents": {
    "list": [
      {
        "id": "department-b-agent",
        "workspace": "./workspace/department-b"
      }
    ]
  }
}
```

### Pros
- Complete isolation (separate processes)
- Independent scaling
- Different versions possible
- Fault isolation (one gateway down, others work)
- Independent security policies

### Cons
- Multiple installations to manage
- Higher resource consumption
- Complex load balancing
- Multiple bot configurations needed
- No shared state between gateways

### Running Multiple Gateways
```bash
# Terminal 1 - Gateway A
cd gateway-a && openclaw start

# Terminal 2 - Gateway B
cd gateway-b && openclaw start

# Terminal 3 - Gateway C
cd gateway-c && openclaw start
```

---

## Migration Paths

### A → B (Add Agents)
```json
// Add to agents.list
{
  "id": "new-agent",
  "workspace": "./workspace/new"
}
// Add binding for new agent
```

### B → B2 (Add Routing)
```json
// Add routing section
{
  "routing": {
    "enabled": true,
    "rules": [...]
  }
}
```

### B → C (Add Docker)
```json
// Add to agents.defaults
{
  "sandbox": {
    "enabled": true,
    "type": "docker"
  }
}
```

### B → D (Split Gateways)
1. Copy entire setup to new directory
2. Change port number
3. Update agent/workspace configs
4. Run as separate process

---

## Configuration Reference

### Required Fields for All Schemes
```json
{
  "gateway": {
    "host": "0.0.0.0",
    "port": 8080,
    "token": "xxx-your-token-xxx"
  },
  "agents": {
    "list": []
  },
  "bindings": [],
  "sessions": {
    "strategy": "multi"
  }
}
```

### Placeholder Values
Replace all `xxx-xxx-xxx` placeholders with your actual values:
- `xxx-your-gateway-token-xxx` → Your gateway authentication token
- `xxx-your-openai-api-key-xxx` → Your OpenAI API key
- `xxx-your-corp-id-xxx` → Your WeCom corporation ID
- `xxx-group-id-xxx` → Specific WeCom group/chat IDs

### Environment Variables (Alternative)
You can use environment variables instead of hardcoding:
```json
{
  "gateway": {
    "token": "${GATEWAY_TOKEN}"
  },
  "agents": {
    "list": [{
      "model": {
        "apiKey": "${OPENAI_API_KEY}"
      }
    }]
  }
}
```

---

## See Also

- Main documentation: [README.md](../README.md)
- Schema reference: [docs/schema.md](../docs/schema.md)
- Security guide: [docs/security.md](../docs/security.md)
