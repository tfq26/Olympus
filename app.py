from flask import Flask
from mcp.monitor.routes import monitor_bp
from mcp.infra.routes import infra_bp

app = Flask(__name__)
app.register_blueprint(monitor_bp, url_prefix="/monitor")
app.register_blueprint(infra_bp, url_prefix="/infra")

if __name__ == "__main__":
    app.run(debug=True)
