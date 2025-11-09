from flask import Blueprint, jsonify, request
from .client import InfraClient

infra_bp = Blueprint("infra", __name__)
client = InfraClient()


@infra_bp.route("/ping", methods=["GET"])
def ping():
    return jsonify(client.ping())


# --------------------
# Natural Language Processing endpoint
# --------------------
@infra_bp.route("/nlp", methods=["POST"])
def nlp():
    """
    Natural language interface to all tools (infra + monitoring)
    Body: { "message": "Create an S3 bucket named demo-test" }
    """
    data = request.get_json() or {}
    message = data.get("message")
    if not message:
        return jsonify({"ok": False, "error": "message is required"}), 400
    
    # Forward to Node unified NLP endpoint
    import requests
    node_url = client.base_url
    try:
        resp = requests.post(f"{node_url}/nlp", json={"message": message}, timeout=client.timeout)
        resp.raise_for_status()
        return jsonify(resp.json())
    except requests.exceptions.RequestException as e:
        return jsonify({"ok": False, "error": str(e)}), 500


@infra_bp.route("/s3", methods=["POST"])
def create_s3():
    data = request.get_json() or {}
    bucket_name = data.get("bucket_name")
    aws_region = data.get("aws_region", "us-east-1")
    if not bucket_name:
        return jsonify({"ok": False, "error": "bucket_name is required"}), 400
    return jsonify(client.s3_create(bucket_name, aws_region))


@infra_bp.route("/s3/<bucket_name>", methods=["DELETE"])
def destroy_s3(bucket_name):
    return jsonify(client.s3_destroy(bucket_name))


@infra_bp.route("/ec2", methods=["POST"])
def create_ec2():
    return jsonify(client.ec2_create())


@infra_bp.route("/ec2", methods=["DELETE"])
def destroy_ec2():
    return jsonify(client.ec2_destroy())


@infra_bp.route("/lambda", methods=["POST"])
def create_lambda():
    data = request.get_json() or {}
    function_name = data.get("function_name")
    if not function_name:
        return jsonify({"ok": False, "error": "function_name is required"}), 400
    aws_region = data.get("aws_region", "us-east-1")
    source_code = data.get("source_code")
    return jsonify(client.lambda_create(function_name, aws_region, source_code))


@infra_bp.route("/lambda", methods=["DELETE"])
def destroy_lambda():
    return jsonify(client.lambda_destroy())
