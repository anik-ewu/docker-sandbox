# ============================================
# Dockerfile — Recipe to build our app image
# ============================================
# Think of this like a step-by-step cooking recipe:
# Each instruction creates a "layer" in the image.

# STEP 1: Start from a base image that has Node.js
# "alpine" = tiny Linux (~5MB), keeps our image small
FROM node:20-alpine

# STEP 2: Set the working directory inside the container
# All following commands run from /app
WORKDIR /app

# STEP 3: Copy package files FIRST (for caching!)
# Docker caches each layer. If package.json hasn't changed,
# Docker skips npm install on rebuild — saves minutes!
COPY package*.json ./

# STEP 4: Install dependencies inside the container
RUN npm install --production

# STEP 5: Copy the rest of our app code
COPY . .

# STEP 6: Document which port our app uses
# (This doesn't actually open the port — it's documentation)
EXPOSE 3000

# STEP 7: The command to run when the container starts
CMD ["node", "server.js"]
