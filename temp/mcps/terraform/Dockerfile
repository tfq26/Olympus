FROM python:3.11-slim

# Install Terraform
RUN apt-get update && apt-get install -y curl unzip && \
    curl -fsSL https://releases.hashicorp.com/terraform/1.9.5/terraform_1.9.5_linux_amd64.zip -o tf.zip && \
    unzip tf.zip && mv terraform /usr/local/bin/ && rm tf.zip

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY server ./server

VOLUME ["/app/server/terraform"]

ENTRYPOINT ["python", "server/mcp_server.py"]
