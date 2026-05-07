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
- [Phase 7: CI/CD with GitHub Actions](#phase-7-cicd-with-github-actions)
- [Phase 8: Nginx Reverse Proxy & Load Balancing](#phase-8-nginx-reverse-proxy--load-balancing)
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

**Goal:** Define your entire multi-container stack in ONE file, start everything with ONE command.

### The Problem

In Phase 4, starting the full stack required 3 commands with lots of flags:

```bash
docker network create tasknet
docker run -d --network tasknet --name mongo mongo:7
docker run -d --network tasknet --name task-api -p 3000:3000 \
  -e MONGODB_URI=mongodb://mongo:27017/taskmanager task-manager
```

- Forget a flag? Broken.
- Close your terminal? Re-type everything.
- 10 services? 10+ commands with 50+ flags. Unmanageable.

**Docker Compose saves all of this in a file — and runs it with one command.**

### Key Concepts

| Concept | What It Means |
|---------|---------------|
| **`docker-compose.yml`** | A YAML file that declares all your services, networks, ports, and env vars in one place |
| **Service** | A container definition — each service becomes one running container |
| **`build: .`** | Build an image from the Dockerfile in the specified directory (like `docker build`) |
| **`image:`** | Use a pre-built image from Docker Hub (like `docker pull`) |
| **`depends_on`** | Controls startup ORDER — "start mongo before api". Does NOT wait for the service to be "ready" |
| **Auto-networking** | Compose creates a network automatically. All services are on it. Service name = hostname |
| **Project name** | Compose uses the folder name as a prefix (e.g., `docker-sandbox_default` network) |

### The docker-compose.yml — Line by Line

```yaml
services:

  # --- MongoDB (uses a public image) ---
  mongo:
    image: mongo:7                  # Pull from Docker Hub
    container_name: mongo           # Explicit name for clarity
    # No "ports:" → MongoDB not exposed to host (same security as Phase 4!)

  # --- Our Node.js API (builds from Dockerfile) ---
  api:
    build: .                        # Build from ./Dockerfile
    container_name: task-api
    ports:
      - "3000:3000"                 # Host:Container port mapping
    environment:
      - MONGODB_URI=mongodb://mongo:27017/taskmanager
      #                      ↑ service name = hostname (auto DNS!)
      - PORT=3000
    depends_on:
      - mongo                       # Start mongo first
    restart: unless-stopped         # Auto-restart on crash
```

### How It Maps to What You Already Know

```
MANUAL COMMANDS (Phase 4)              →  COMPOSE EQUIVALENT
─────────────────────────────          →  ─────────────────────
docker network create tasknet          →  (automatic! Compose creates one)
docker run -d --name mongo mongo:7     →  mongo: image: mongo:7
docker run -d --name task-api \        →  api:
  -p 3000:3000 \                       →    ports: ["3000:3000"]
  -e MONGODB_URI=... \                 →    environment: [MONGODB_URI=...]
  --network tasknet \                  →    (automatic! same network)
  task-manager                         →    build: .
```

### Hands-On

```bash
# ⚠️ FIRST: Clean up any running containers from Phase 4
docker stop task-api mongo 2>/dev/null; docker rm task-api mongo 2>/dev/null
docker network rm tasknet 2>/dev/null

# 1. Start EVERYTHING with one command
docker compose up -d
#               │   │
#               │   └── Detached mode (run in background)
#               └── Reads docker-compose.yml in current directory

# 2. Watch it work!
docker compose ps        # See all running services
docker compose logs      # See combined logs from ALL services
docker compose logs api  # See logs from just the api service

# 3. Open http://localhost:3000 — your Task Manager is running!

# 4. Stop everything
docker compose down
#   → Stops all containers
#   → Removes all containers
#   → Removes the auto-created network
#   → Images are KEPT (instant restart next time)
```

### Compose Lifecycle Diagram

```
docker compose up -d
        │
        ├── 1. Creates network: docker-sandbox_default
        │
        ├── 2. Starts services in dependency order:
        │       ├── mongo  (image: mongo:7 — pulls if not cached)
        │       └── api    (build: . — builds from Dockerfile if needed)
        │
        └── 3. All services running ✅
                Open http://localhost:3000

docker compose down
        │
        ├── 1. Stops all containers
        ├── 2. Removes all containers
        ├── 3. Removes network
        └── 4. Images remain (cached for next time)
```

### Essential Compose Commands

```bash
# Lifecycle
docker compose up -d              # Start all services (background)
docker compose down               # Stop & remove everything
docker compose restart            # Restart all services
docker compose restart api        # Restart just one service

# Monitoring
docker compose ps                 # Status of all services
docker compose logs               # Combined logs (all services)
docker compose logs -f api        # Follow (live-stream) logs for one service
docker compose top                # Show running processes in each container

# Building
docker compose build              # Rebuild images (after code changes)
docker compose up -d --build      # Rebuild AND restart in one command
#                       ↑
#        USE THIS after changing code!
#        Without --build, Compose uses the cached image

# Execute
docker compose exec mongo mongosh       # Open MongoDB shell
docker compose exec api sh              # Open shell in the API container
```

### Common Gotcha: Code Changes Not Showing?

```bash
# ❌ WRONG — reuses the old cached image:
docker compose up -d

# ✅ RIGHT — rebuilds the image with your latest code:
docker compose up -d --build
```

> Compose caches the built image. If you change `server.js` but don't `--build`,
> your old code keeps running. Always use `--build` after code changes!

### What Changed (Phase 4 → Phase 5)

| Phase 4 (Manual Commands) | Phase 5 (Docker Compose) |
|---------------------------|--------------------------|
| 3+ commands to start | `docker compose up -d` (one command) |
| Flags memorized or scripted | Saved in `docker-compose.yml` |
| Manual network creation | Automatic network |
| Easy to forget a flag | Configuration is version-controlled |
| Hard to share with team | `git clone` + `docker compose up` = done |

### But There's Still a Problem...

Try this:

```bash
# 1. Start everything
docker compose up -d

# 2. Add some tasks in http://localhost:3000

# 3. Stop and remove everything
docker compose down

# 4. Start again
docker compose up -d

# 5. Check http://localhost:3000
#    → 😱 All your tasks are GONE!
```

**Why?** When `docker compose down` removes the MongoDB container, all data inside it is destroyed.
Containers are **ephemeral** (temporary) by design.

**Phase 6 (Docker Volumes) solves this** — persistent data that survives container removal.

---

## Phase 6: Docker Volumes

**Goal:** Persist data so it survives container removal. No more losing your database!

### The Problem

We just proved it — `docker compose down` then `docker compose up -d` = all tasks gone.

**Why?** Containers are **ephemeral** (temporary) by design. Everything inside a container — including MongoDB's data files — is part of the container's writable layer. Remove the container, remove the data.

```
Without Volumes:

  Container (mongo)
  ┌──────────────────────┐
  │  /data/db/           │  ← MongoDB stores data HERE
  │  ├── tasks.bson      │
  │  └── indexes.bson    │
  └──────────────────────┘
           │
     docker compose down
           │
           ▼
     💥 Container deleted
     💥 /data/db/ deleted
     💥 All your tasks GONE
```

### The Solution: Named Volumes

A volume is storage that lives **outside** the container, managed by Docker. Even when the container is destroyed, the volume stays.

```
With Volumes:

  Volume (mongo-data)          Container (mongo)
  ┌──────────────────┐         ┌──────────────────────┐
  │  tasks.bson      │◄──mount──│  /data/db/  → volume │
  │  indexes.bson    │         └──────────────────────┘
  └──────────────────┘                  │
        │                        docker compose down
        │                               │
        │                               ▼
        │                        💥 Container deleted
        ▼
  ✅ Volume STILL EXISTS!
  ✅ Data is SAFE!
  ✅ New container re-mounts it
```

### Key Concepts

| Concept | What It Means |
|---------|---------------|
| **Named Volume** | Docker-managed storage with a name (e.g., `mongo-data`). Best for databases. Docker handles the path |
| **Bind Mount** | Maps a specific folder on YOUR machine into the container (e.g., `./src:/app/src`). Good for development |
| **Anonymous Volume** | Volume with no name — hard to find, hard to reuse. Avoid these |
| **`/data/db`** | Where MongoDB stores its data files inside the container. This path is defined by the mongo image |
| **`docker compose down`** | Stops + removes containers and network. **Volumes are kept!** |
| **`docker compose down -v`** | Same as above **BUT also deletes volumes.** ⚠️ Data gone! |

### What We Added to docker-compose.yml

```yaml
services:
  mongo:
    image: mongo:7
    volumes:
      - mongo-data:/data/db     # ← Map named volume to MongoDB's data directory
      #    │          │
      #    │          └── Path INSIDE the container (where MongoDB writes data)
      #    └── Volume NAME (declared in the volumes: section below)

  api:
    build: .
    # ... (unchanged)

volumes:
  mongo-data:                   # ← Declare the named volume
                                # Docker creates it automatically on first "up"
```

### Hands-On: Prove Data Survives

```bash
# 1. Start everything (volume is created automatically)
docker compose up -d

# 2. Add some tasks
#    Open http://localhost:3000 and add tasks, OR:
curl -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"This task will SURVIVE!"}'

# 3. Verify the volume exists
docker volume ls
#    DRIVER    VOLUME NAME
#    local     docker-sandbox_mongo-data    ← There it is!

# 4. Stop and DESTROY containers
docker compose down
#    Containers removed ✅
#    Network removed ✅
#    Volumes KEPT! ✅ (no -v flag)

# 5. Start again
docker compose up -d

# 6. Check — tasks are STILL THERE! 🎉
curl http://localhost:3000/tasks
```

### ⚠️ The Dangerous Flag: `-v`

```bash
# SAFE — data preserved:
docker compose down

# DANGEROUS — data DELETED:
docker compose down -v
#                    ↑
#           This removes volumes too!
#           Only use when you WANT to wipe everything
```

### Volume Types Compared

| Type | Syntax | Use Case | Who Manages Path? |
|------|--------|----------|-------------------|
| **Named Volume** | `mongo-data:/data/db` | Databases, persistent app data | Docker (you just use the name) |
| **Bind Mount** | `./src:/app/src` | Live code reload during development | You (specify exact host path) |
| **Anonymous Volume** | `/data/db` (no name) | Temporary, not recommended | Docker (random hash name) |

### Volume Commands

```bash
# List all volumes
docker volume ls

# Inspect a volume (see where Docker stores it)
docker volume inspect docker-sandbox_mongo-data

# Remove a specific volume (⚠️ deletes data!)
docker volume rm docker-sandbox_mongo-data

# Remove ALL unused volumes (⚠️ dangerous!)
docker volume prune
```

---

## Phase 7: CI/CD with GitHub Actions

**Goal:** Automate the building and pushing of your Docker image every time you push code to `main`. This is the bridge between your local code and a production server.

### The Problem

Right now, to get a new version of your app to a server, you have to:
1. Build the image locally (`docker build -t task-manager .`)
2. Push it to Docker Hub manually (`docker push ...`)
3. Go to the server, pull it, and restart containers.

If you forget a step or someone else on your team pushes code, the server gets outdated.

### The Solution: GitHub Actions

We created a pipeline (`.github/workflows/deploy.yml`) that acts as a robot. It watches your GitHub repository. When it sees new code on the `main` branch, it automatically runs steps to build your image and push it to Docker Hub.

### How it Works (The Pipeline)

| Step | What it Does | Why it Matters |
|------|--------------|----------------|
| **Trigger** | `on: push: branches: ["main"]` | The pipeline only runs when code hits `main`, preventing half-finished feature branches from going to production. |
| **Checkout** | `actions/checkout` | The "robot" downloads your code onto its temporary server (Ubuntu) so it has the files to build. |
| **Login** | `docker/login-action` | Logs into Docker Hub using secrets. Without this, Docker Hub would block the upload. |
| **Build & Push** | `docker/build-push-action` | Runs `docker build` using your `Dockerfile` and `docker push` to send the final image to the cloud. |

### Connecting the Dots: The Big Picture

It's completely normal to feel a bit dizzy looking at all these configuration files. Here is how they all fit together:

1. **The `Dockerfile` (The Packager):** This file only cares about *how to package your specific app*. It doesn't know about databases or the cloud. It just knows how to install dependencies and start your Node.js server.
2. **The `deploy.yml` (The Delivery Truck):** This file is your Pipeline. It grabs your `Dockerfile`, uses it to package the code into an image, and drives that image to Docker Hub.
3. **The `docker-compose.yml` (The Restaurant Manager):** This file cares about the big picture. When you want to run the app (locally or on a server), Compose says: *"I need to start MongoDB first, then I need to grab that Node image we built, and then I need to connect them."*

#### "How does the pipeline know where the code is?"
Look at the **Checkout** step (`uses: actions/checkout@v4`). When the pipeline runs, GitHub boots up a completely empty Linux server in the cloud. The checkout step essentially runs `git clone` on your repository. 

Because the pipeline is triggered by you pushing code (`on: push: branches: ["main"]`), it downloads the **exact, latest version** of the code you just pushed. Then, the **Build** step looks in the folder (`context: .`), finds your `Dockerfile`, and builds the image using those fresh files!

### Hands-On: Setting up Docker Hub Secrets

To make this work, GitHub needs permission to push to your Docker Hub account. We do this securely using **Secrets**.

1. **Create an Access Token in Docker Hub:**
   * Go to Docker Hub -> Account Settings -> Security -> New Access Token.
   * Description: "GitHub Actions", Permissions: Read & Write.
   * Copy the generated token!

2. **Add Secrets to GitHub:**
   * Go to your repository on GitHub.
   * Click **Settings** -> **Secrets and variables** -> **Actions**.
   * Click **New repository secret**.
   * Add `DOCKERHUB_USERNAME` (Your Docker Hub username).
   * Add `DOCKERHUB_TOKEN` (The token you just created).

### The Final Test

Once secrets are set, let's trigger the pipeline!

```bash
# 1. Check your status
git status

# 2. Add all changes (including the new .github folder)
git add .

# 3. Commit your changes
git commit -m "feat: Add CI/CD pipeline and Phase 7 documentation"

# 4. Push to main branch!
git push origin main
```

Now, go to the **"Actions"** tab on your GitHub repository page. You will see the pipeline running automatically! Once it finishes (green checkmark), your new image will be waiting for you in Docker Hub.

---

## Phase 8: Nginx Reverse Proxy & Load Balancing

**Goal:** Understand how enterprise applications manage traffic by scaling your Node.js app to multiple containers and putting an Nginx Load Balancer in front of them.

### What is a Reverse Proxy & Load Balancer?

Imagine a restaurant:
*   **The Chefs (Node.js API):** They do the hard work of cooking (processing data). 
*   **The Waiter (Nginx Reverse Proxy):** Customers don't walk into the kitchen. They give their order to the waiter. The waiter takes it to the kitchen, gets the food, and brings it back. This hides the kitchen and adds security.
*   **The Host (Load Balancer):** When the restaurant gets too busy for one chef, you hire three chefs. The host decides which chef gets the next ticket so no one is overwhelmed. Nginx does this for your web traffic!

### The Architecture We Built

Instead of exposing port `3000` on our single Node app, we made these changes in `docker-compose.yml`:
1.  **Scaled the API:** We added `deploy: replicas: 3` to run THREE copies of the Node.js API container.
2.  **Removed Exposed Ports:** We took away the `ports: ["3000:3000"]` from the API. The outside world can no longer talk directly to Node!
3.  **Added Nginx:** We added an Nginx container that listens on port `80` (the standard web port) and proxies traffic to the APIs.

```
                  ┌──► task-api (Replica 1)
                  │
You ──► Nginx ────┼──► task-api (Replica 2)
   (localhost:80) │
                  └──► task-api (Replica 3)
```

### The Nginx Configuration (`nginx.conf`)

We created a simple configuration file that tells Nginx how to find our APIs:

```nginx
http {
    upstream api_servers {
        # 'api' is the exact name of our service in docker-compose!
        # Docker's internal DNS automatically routes this to all 3 replicas.
        server api:3000;
    }

    server {
        listen 80;
        location / {
            proxy_pass http://api_servers;
        }
    }
}
```

### Hands-On: Test the Load Balancer

Let's see it in action! 

```bash
# 1. Start the new architecture
docker compose up -d

# 2. Look at what is running!
docker compose ps
# Notice there are THREE task-api containers and ONE nginx container!

# 3. Test the application
# Go to http://localhost (Notice you don't need :3000 anymore because Nginx is on 80)
# Add some tasks. It works perfectly!

# 4. View the Load Balancing in action!
docker compose logs -f api
# Open http://localhost in your browser and refresh the page quickly several times.
# Watch the terminal — you will see the requests being handled by different API containers!
```

### Why this is powerful
If `task-api` replica #1 crashes, Nginx instantly notices and stops sending traffic to it. It routes all new users to replicas #2 and #3. Your users experience zero downtime. This is exactly how massive enterprise applications stay online 24/7!

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
├── .github/
│   └── workflows/
│       └── deploy.yml      # (Phase 7) CI/CD Pipeline
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

---

## 🚀 What's Next? (Beyond the Sandbox)

Congratulations! You've taken an app from a local, fragile installation all the way to an automated, containerized pipeline. You now understand the core of how modern software is packaged and distributed.

So, what do you do with that Docker image sitting in Docker Hub?

**Path 1: Simple Deployment (VPS / EC2)**
The easiest way to deploy is to rent a server (like DigitalOcean or AWS EC2), SSH into it, and run `docker compose up -d`. To automate this, you can use tools like **Watchtower**, which automatically pulls new images from Docker Hub and restarts your containers whenever your GitHub Action finishes!

**Path 2: Managed Container Services**
Instead of managing a server yourself, you can hand your Docker image to services like **AWS Fargate**, **Google Cloud Run**, or **Azure Container Apps**. They take your image and run it automatically, scaling it up or down based on traffic.

**Path 3: Kubernetes (K8s)**
This is what your office project uses! Kubernetes is the ultimate container orchestrator. It doesn't build images; it *consumes* the images your pipeline just pushed to Docker Hub. If you have dozens of microservices, K8s ensures they are all running, healthy, and talking to each other across multiple servers. 

*If you want to move to Kubernetes, you are completely ready, because you now understand the fundamental building block: the Container.*
