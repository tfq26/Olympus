from flask import Flask
from mcp.monitor.routes import monitor_bp

app = Flask(__name__)
app.register_blueprint(monitor_bp, url_prefix="/monitor")

if __name__ == "__main__":
    app.run(debug=True)
