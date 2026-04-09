# Minimal Dockerfile for modal infra
FROM python:3.11-slim
WORKDIR /app
COPY . /app
RUN pip install --no-cache-dir -r requirements.txt
FROM nvidia/cuda:12.1.0-base-ubuntu22.04

# System deps
RUN apt-get update && apt-get install -y \
    python3.11 \
    python3-pip \
    curl \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

# Install Ollama
RUN curl -fsSL https://ollama.com/install.sh | sh

# Python deps
COPY requirements.txt /tmp/
RUN pip3 install --no-cache-dir -r /tmp/requirements.txt

# Pull Gemma model
RUN ollama serve & \
    sleep 10 && \
    ollama pull gemma2:2b && \
    pkill ollama

WORKDIR /app
