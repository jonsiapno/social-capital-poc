FROM node:18-slim

WORKDIR /app

# Install required system packages for ChromaDB
RUN apt-get update && \
    apt-get install -y python3-full python3-pip python3-venv && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Create and activate virtual environment
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Install sentence-transformers for embeddings
RUN /opt/venv/bin/pip install sentence-transformers

# Install app dependencies
COPY package*.json ./
RUN npm install

# Copy application files
COPY . .

EXPOSE 3000

# Changed this line to point to new entry file
CMD ["node", "src/index.mjs"]