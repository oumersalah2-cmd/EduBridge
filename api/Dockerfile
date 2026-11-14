FROM node:20-bookworm-slim

# Install system dependencies: FFmpeg, Python 3, venv, and build tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    python3 \
    python3-venv \
    python3-pip \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Set up dedicated Python virtual environment to avoid externally-managed-environment issues
ENV VIRTUAL_ENV=/opt/venv
RUN python3 -m venv $VIRTUAL_ENV
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

# Install faster-whisper in virtual environment
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir faster-whisper

# Set working directory
WORKDIR /app

# Configure persistent cache for Hugging Face / faster-whisper models
ENV HF_HOME=/root/.cache/huggingface
RUN mkdir -p /root/.cache/huggingface /app/uploads

# Install Node.js dependencies
COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev

# Copy application source code
COPY . .

# Expose port (default 4000)
EXPOSE 4000

CMD ["npm", "start"]
