from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv
from mcp.monitor.routes import monitor_bp
from mcp.infra.routes import infra_bp

app = Flask(__name__)
# Load environment variables from root .env
load_dotenv()
# Enable CORS for the frontend
# Allow localhost Vite dev server by default; override with FRONTEND_ORIGIN env if set
import os
frontend_origin = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
CORS(
    app,
    resources={r"/*": {"origins": [frontend_origin, "http://127.0.0.1:5173", "http://localhost:8080", "http://127.0.0.1:8080"]}},
    supports_credentials=True,
)
app.register_blueprint(monitor_bp, url_prefix="/monitor")
app.register_blueprint(infra_bp, url_prefix="/infra")

if __name__ == "__main__":
    import os
    port = int(os.getenv("FLASK_PORT", "5000"))
    # Run without debug to avoid TTY suspension and bind on all interfaces
    app.run(host="0.0.0.0", debug=False, port=port)
