# Use a lightweight Node.js image
FROM node:22-slim

# Set working directory
WORKDIR /app

# Install dependencies needed for build (python/make/g++ sometimes needed for native modules, though not here yet)
# RUN apt-get update && apt-get install -y --no-install-recommends ...

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript
RUN npx tsc

# Expose no ports needed (CLI app), but good practice
# EXPOSE 3000

# Run the app
# Use 'dummy' entry to keep container alive? No, it's an interactive CLI.
# Docker run needs -it
CMD ["npm", "start"]
