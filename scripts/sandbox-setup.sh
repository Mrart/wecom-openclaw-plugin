#!/usr/bin/env bash
#
# sandbox-setup.sh - Build Docker image for OpenClaw agent sandbox
#
# Usage: ./scripts/sandbox-setup.sh [build|clean|check]
#
# Commands:
#   build  - Create Dockerfile and build the sandbox image (default)
#   clean  - Remove the sandbox image
#   check  - Verify Docker is installed and accessible
#

set -euo pipefail

# Configuration
IMAGE_NAME="openclaw-agent-sandbox"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is installed and accessible
check_docker() {
    log_info "Checking Docker installation..."
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed or not in PATH"
        log_error "Please install Docker: https://docs.docker.com/get-docker/"
        return 1
    fi
    
    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running"
        log_error "Please start Docker Desktop or docker service"
        return 1
    fi
    
    log_info "Docker is available: $(docker --version)"
    return 0
}

# Get the current user's home directory dynamically
get_home_dir() {
    echo "$HOME"
}

# Create Dockerfile for the sandbox
create_dockerfile() {
    local dockerfile_path="$PROJECT_ROOT/Dockerfile.sandbox"
    
    log_info "Creating Dockerfile at $dockerfile_path"
    
    cat > "$dockerfile_path" << 'DOCKERFILE'
# OpenClaw Agent Sandbox
# Provides isolated environment for agent execution with controlled resource access

FROM node:20-alpine

# Install essential tools
RUN apk add --no-cache \
    git \
    curl \
    bash \
    vim \
    && rm -rf /var/cache/apk/*

# Create non-root user for security
RUN addgroup -g 1001 sandbox && \
    adduser -D -u 1001 -G sandbox sandbox

# Set up directory structure
WORKDIR /sandbox

# Create directories for volumes
RUN mkdir -p /skills /references /workspace /sandboxes && \
    chown -R sandbox:sandbox /sandbox /skills /references /workspace /sandboxes

# Set environment variables
ENV NODE_ENV=production
ENV SANDBOX_MODE=true
ENV HOME=/sandbox

# Switch to non-root user
USER sandbox

# Default command - keep container running
CMD ["/bin/sh", "-c", "while true; do sleep 3600; done"]
DOCKERFILE
    
    log_info "Dockerfile created successfully"
    return 0
}

# Build the Docker image
build_image() {
    log_info "Building Docker image: $IMAGE_NAME"
    
    if [ ! -f "$PROJECT_ROOT/Dockerfile.sandbox" ]; then
        log_warn "Dockerfile not found, creating it first..."
        create_dockerfile
    fi
    
    cd "$PROJECT_ROOT"
    
    if docker build -t "$IMAGE_NAME" -f Dockerfile.sandbox .; then
        log_info "Image built successfully: $IMAGE_NAME"
        
        # Display image info
        log_info "Image details:"
        docker images "$IMAGE_NAME" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"
        
        return 0
    else
        log_error "Failed to build Docker image"
        return 1
    fi
}

# Clean up the image
clean_image() {
    log_info "Removing Docker image: $IMAGE_NAME"
    
    if docker rmi "$IMAGE_NAME" 2>/dev/null; then
        log_info "Image removed successfully"
    else
        log_warn "Image not found or could not be removed"
    fi
    
    # Also remove Dockerfile if it exists
    if [ -f "$PROJECT_ROOT/Dockerfile.sandbox" ]; then
        rm -f "$PROJECT_ROOT/Dockerfile.sandbox"
        log_info "Removed Dockerfile.sandbox"
    fi
}

# Show usage information
show_usage() {
    cat << EOF
OpenClaw Agent Sandbox Setup

Usage: $(basename "$0") [COMMAND]

Commands:
    build   Create Dockerfile and build the sandbox image (default)
    clean   Remove the sandbox image and Dockerfile
    check   Verify Docker is installed and running
    help    Show this help message

Examples:
    $(basename "$0")          # Build the sandbox image
    $(basename "$0") build    # Build the sandbox image
    $(basename "$0") clean    # Remove the sandbox image
    $(basename "$0") check    # Check Docker installation

Configuration:
    Image Name: $IMAGE_NAME
    Project Root: $PROJECT_ROOT
EOF
}

# Main function
main() {
    local command="${1:-build}"
    
    case "$command" in
        build)
            check_docker || exit 1
            create_dockerfile
            build_image
            ;;
        clean)
            clean_image
            ;;
        check)
            check_docker
            ;;
        help|--help|-h)
            show_usage
            ;;
        *)
            log_error "Unknown command: $command"
            echo ""
            show_usage
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"
