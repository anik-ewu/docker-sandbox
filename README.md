# 🐳 Learn Docker — Task Manager Project

A hands-on, step-by-step Docker learning project. Built with **Node.js + Express + MongoDB**.

Each phase introduces a new Docker concept by solving a real problem.

---

## Table of Contents

- [Phase 1: Build Without Docker](#phase-1-build-without-docker)
- [Phase 2: Docker Fundamentals & Public Images](#phase-2-docker-fundamentals--public-images)
- [Phase 3: Dockerfile & Custom Images](#phase-3-dockerfile--custom-images)
- [Phase 4: Docker Networking](#phase-4-docker-networking)
- [Phase 5: Docker Compose](#phase-5-docker-compose)
- [Phase 6: Docker Volumes](#phase-6-docker-volumes)
- [Docker Commands Cheat Sheet](#docker-commands-cheat-sheet)

---

## Phase 1: Build Without Docker

**Goal:** Run the app using local installs. Experience the pain Docker solves.

### Prerequisites (installed manually)

- Node.js v20+
- MongoDB v7.0
- npm

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Start MongoDB locally
brew services start mongodb-community@7.0

# 3. Create .env file
echo "MONGODB_URI=mongodb://localhost:27017/taskmanager" > .env
echo "PORT=3000" >> .env

# 4. Start the app
npm start
```

Open http://localhost:3000

### The Problem

To run this app, every developer needs to:

1. Install the correct Node.js version
2. Install MongoDB (correct version!)
3. Configure and start MongoDB
4. Run `npm install`
5. Hope everything works on their OS

**This is what Docker solves.** ⬇️

---

## Phase 2: Docker Fundamentals & Public Images

**Goal:** Replace locally-installed MongoDB with a Docker container. One command instead of a full installation.

### Key Concepts

| Concept | What It Means |
|---------|---------------|
| **Docker Image** | A blueprint/snapshot — contains everything needed to run software (OS + app + dependencies). Like a `.iso` file |
| **Docker Container** | A running instance of an image. Like a VM but lighter — shares host OS kernel |
| **Docker Hub** | Public registry of pre-built images (like npm for containers). Visit: https://hub.docker.com |
| **Container vs VM** | VMs include a full OS (heavy, slow). Containers share the host kernel (light, fast, start in seconds) |

### Hands-On

```bash
# Stop local MongoDB — we don't need it anymore!
brew services stop mongodb-community@7.0

# Pull MongoDB image from Docker Hub
docker pull mongo:7

# Run MongoDB in a Docker container
docker run -d --name mongo-local -p 27017:27017 mongo:7
#          │   │                  │               │
#          │   │                  │               └── Image: mongo version 7
#          │   │                  └── Port mapping: host_port:container_port
#          │   └── Name this container "mongo-local"
#          └── Run in background (detached)

# Verify it's running
docker ps

# Our Node.js app still connects to localhost:27017 — works the same!
npm start
```

### What Changed

| Before | After |
|--------|-------|
| `brew install mongodb-community` (download, configure, troubleshoot) | `docker pull mongo:7` (one command) |
| `brew services start mongodb-community@7.0` | `docker run -d mongo:7` |
| MongoDB installed in your system, hard to remove cleanly | Lives in container, `docker rm` = gone completely |
| Switching versions = uninstall + reinstall | `docker run mongo:6` — any version, instantly |

### Useful Commands for This Phase

```bash
# See container logs
docker logs mongo-local

# Open a shell inside the container
docker exec -it mongo-local mongosh

# Stop the container
docker stop mongo-local

# Start it again (data preserved while container exists)
docker start mongo-local

# Remove it completely
docker stop mongo-local && docker rm mongo-local
```

---

## Phase 3: Dockerfile & Custom Images

**Goal:** Package OUR Node.js app into a Docker image so anyone can run it with zero Node.js setup.

### Key Concepts

| Concept | What It Means |
|---------|---------------|
| **Dockerfile** | A text file with instructions to build an image — like a recipe |
| **Build Context** | The folder you point `docker build` at (the `.` in the command). Docker can only COPY files from here |
| **Layers & Caching** | Each Dockerfile instruction creates a cached layer. Unchanged layers are skipped on rebuild |
| **`.dockerignore`** | Files to exclude from the build context (like `.gitignore` for Docker) |

### The Dockerfile — Line by Line

```dockerfile
# STEP 1: Start from a base image that has Node.js
# "alpine" = tiny Linux (~5MB), keeps our image small
FROM node:20-alpine

# STEP 2: Set working directory inside the container
# All following commands run from /app
WORKDIR /app

# STEP 3: Copy package files FIRST (for caching!)
# If package.json hasn't changed, Docker skips npm install on rebuild
COPY package*.json ./

# STEP 4: Install dependencies inside the container
RUN npm install --production

# STEP 5: Copy the rest of our app code
# Source = build context (your project folder)
# Destination = /app (inside container, set by WORKDIR)
COPY . .

# STEP 6: Document which port the app uses (doesn't actually open it)
EXPOSE 3000

# STEP 7: Default command when container starts
CMD ["node", "server.js"]
```

### How COPY Works

```
COPY  .    .
      ↑    ↑
      │    └── TO: inside the container (relative to WORKDIR = /app)
      │
      └── FROM: the build context (folder where you ran `docker build`)

Your Mac (build context)              Container (/app)
├── server.js          ──COPY──►      ├── server.js
├── package.json       ──COPY──►      ├── package.json
├── public/            ──COPY──►      ├── public/
│   └── index.html                    │   └── index.html
├── node_modules/      ──SKIPPED──    │  (excluded by .dockerignore)
└── .env               ──SKIPPED──    │  (excluded by .dockerignore)
```

### Why Two COPY Commands? (Layer Caching)

```
COPY package*.json ./     ← If unchanged: CACHED ✅
RUN npm install           ← If above cached: CACHED ✅ (saves 10+ seconds!)
COPY . .                  ← Code changed? Only this re-runs

vs. doing it wrong:
COPY . .                  ← Code changed? EVERYTHING below re-runs!
RUN npm install           ← npm install runs EVERY TIME 😫
```

### Hands-On

```bash
# Build the image (run from project root where Dockerfile lives)
docker build -t task-manager .
#             │               │
#             │               └── Build context = current directory
#             └── Name (tag) the image "task-manager"

# See your newly built image
docker images task-manager

# Run it
docker run -d --name task-api -p 3000:3000 task-manager

# ⚠️ PROBLEM: It can't connect to MongoDB!
# Inside the container, "localhost" = the container itself, NOT your Mac
docker logs task-api  # No "Connected to MongoDB" message!

# Fix: Tell it where MongoDB actually is
docker stop task-api && docker rm task-api
docker run -d --name task-api -p 3000:3000 \
  -e MONGODB_URI=mongodb://host.docker.internal:27017/taskmanager \
  task-manager
# host.docker.internal = special DNS name to reach your Mac (Docker Desktop only)
```

### Key Takeaway

> **`localhost` inside a container means the container itself.**
> Container A's localhost ≠ Container B's localhost ≠ Your Mac's localhost.
> This is why we need Docker Networking (Phase 4).

---

## Phase 4: Docker Networking

**Goal:** Make containers talk to each other directly by name — no hacks, works everywhere.

### The Problem

In Phase 3, we used `host.docker.internal` — but that's:
- ❌ A Mac/Windows-only hack (doesn't work on Linux)
- ❌ Traffic goes: Container → Host → Container (inefficient)
- ❌ MongoDB port is exposed to the host (security risk)

### The Solution: Custom Docker Networks

Containers on the same custom network can:
- 🔍 Find each other by **container name** (Docker has built-in DNS)
- 🔒 Communicate without exposing ports to the host
- 🌐 Works on all platforms

### Key Concepts

| Concept | What It Means |
|---------|---------------|
| **Default Bridge** | Every container gets this. Containers CAN'T find each other by name on it |
| **Custom Network** | You create it. Containers CAN find each other by name. Always use this! |
| **Port Mapping (`-p`)** | Exposes a container port to the host. Only needed for services YOU access (like the web UI) |
| **DNS Resolution** | On custom networks, container name = hostname. `mongo` resolves to that container's IP |

### Hands-On

```bash
# 1. Create a custom network
docker network create tasknet

# 2. Run MongoDB on the network (NO -p flag! Not exposed to host)
docker run -d --network tasknet --name mongo mongo:7

# 3. Run our app on the SAME network
docker run -d --network tasknet --name task-api -p 3000:3000 \
  -e MONGODB_URI=mongodb://mongo:27017/taskmanager \
  task-manager
#                                  ↑
#                    Container name as hostname!
#                    Docker DNS resolves "mongo" → container IP

# 4. Verify both are on the network
docker network inspect tasknet

# 5. Check logs — should show "Connected to MongoDB at: mongodb://mongo:27017"
docker logs task-api
```

### Network Diagram

```
           docker network: tasknet
  ┌──────────────────────────────────────────┐
  │                                          │
  │  ┌──────────┐        ┌──────────┐       │
  │  │ task-api  │──DNS──►│  mongo   │       │
  │  │ :3000     │        │  :27017  │       │
  │  └────┬─────┘        └──────────┘       │
  │       │                 (no -p flag =    │
  └───────┼────────────────  NOT exposed     │
          │                  to host)        │
          │ -p 3000:3000                     │
          ▼                                  │
    Your Browser                             │
    http://localhost:3000                     │
  ┌──────────────────────────────────────────┘
```

### Why This Is Better

| Phase 3 (host.docker.internal) | Phase 4 (Custom Network) |
|-------------------------------|--------------------------|
| Mac/Windows only | Works everywhere ✅ |
| MongoDB exposed to host (-p 27017:27017) | MongoDB only reachable by containers ✅ |
| Traffic goes through the host machine | Direct container-to-container ✅ |
| Uses a "hack" DNS name | Uses actual container names ✅ |

### But There's Still a Problem...

Starting everything takes 3 commands:
```bash
docker network create tasknet
docker run -d --network tasknet --name mongo mongo:7
docker run -d --network tasknet --name task-api -p 3000:3000 -e MONGODB_URI=mongodb://mongo:27017/taskmanager task-manager
```

What if we had 5 services? 10? That's a lot of commands with a lot of flags to remember.

**Phase 5 (Docker Compose) solves this** — define everything in one file, start with one command.

---

## Phase 5: Docker Compose

> 🚧 Coming next...

---

## Phase 6: Docker Volumes

> 🚧 Coming next...

---

## Docker Commands Cheat Sheet

### Images

```bash
docker pull <image>          # Download an image from Docker Hub
docker images                # List all images on your machine
docker build -t <name> .     # Build image from Dockerfile in current dir
docker rmi <image>           # Remove an image
```

### Containers

```bash
docker run <image>              # Create and start a container
docker run -d <image>           # Run in background (detached)
docker run --name <n> <image>   # Give container a name
docker run -p 3000:3000 <image> # Map host port to container port
docker run -e KEY=VAL <image>   # Pass environment variable

docker ps                       # List running containers
docker ps -a                    # List ALL containers (including stopped)
docker logs <name>              # View container output
docker stop <name>              # Stop a container
docker start <name>             # Start a stopped container
docker rm <name>                # Remove a stopped container
docker exec -it <name> sh      # Open shell inside running container
```

### Networks

```bash
docker network create <name>    # Create a custom network
docker network ls                # List all networks
docker network inspect <name>   # See which containers are on a network
docker network rm <name>        # Remove a network
```

### Cleanup

```bash
docker system prune              # Remove unused containers, networks, images
docker volume prune              # Remove unused volumes
docker system df                 # Show Docker disk usage
```

---

## When to Use Docker (Real-World Guide)

| Scenario | Use Docker? | Why |
|----------|-------------|-----|
| Local dev with many services (DB, cache, queue) | ✅ Yes | One command starts everything |
| Simple frontend dev (Angular/React) | ❌ Usually no | `ng serve` / `npm run dev` is faster |
| CI/CD pipeline | ✅ Yes | Consistent test environment |
| Deploying to production | ✅ Yes | Same container everywhere |
| Quick prototype | ❌ Optional | Direct run is simpler |
| Microservices (10+ services) | ✅ Absolutely | Can't manage without it |
| Sharing project with team | ✅ Yes | Clone + `docker compose up` = done |

---

## Project Structure

```
docker-sandbox/
├── public/
│   └── index.html          # Task Manager UI
├── server.js               # Express API + Mongoose
├── package.json            # Node.js dependencies
├── .env                    # Environment variables (local dev, git-ignored)
├── .dockerignore           # Files excluded from Docker build
├── .gitignore              # Files excluded from git
├── Dockerfile              # Recipe to build our Node.js image
├── docker-compose.yml      # (Phase 5) Multi-container orchestration
└── README.md               # This file!
```
