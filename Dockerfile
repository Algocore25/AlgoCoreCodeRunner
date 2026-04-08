FROM ubuntu:22.04

# Avoid interactive prompts during installation
ENV DEBIAN_FRONTEND=noninteractive

# Install all required language runtimes and tools
# Install base tools + language runtimes (except Node)
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    python3 \
    python3-pip \
    openjdk-17-jdk \
    sqlite3 \
    curl \
    wget \
    ca-certificates \
    gnupg \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 18 LTS via NodeSource (Ubuntu default is v12, too old for ESM)
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install TypeScript globally
RUN npm install -g typescript ts-node

# Set up Java environment
ENV JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
ENV PATH=$PATH:$JAVA_HOME/bin

# Create app directory
WORKDIR /app

# Create temp directory for code execution
RUN mkdir -p /app/temp

# Copy package files and install Node.js dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the application
COPY . .

# Expose the port
EXPOSE 3000

# Start the server
CMD ["npm", "start"]
