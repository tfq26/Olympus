FROM python:3.11-slim

# Install Terraform and AWS CLI
RUN apt-get update && apt-get install -y curl unzip && \
    curl -fsSL https://releases.hashicorp.com/terraform/1.9.5/terraform_1.9.5_linux_amd64.zip -o tf.zip && \
    unzip tf.zip && mv terraform /usr/local/bin/ && rm tf.zip && \
    curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip" && \
    unzip awscliv2.zip && \
    ./aws/install && \
    rm -rf aws awscliv2.zip

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

# Copy everything in mcps into /app
COPY . .

# ✅ Entry point for MCP server
ENTRYPOINT ["python", "mcp_server.py"]
