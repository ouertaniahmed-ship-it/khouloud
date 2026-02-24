"""
Windows executable entry point for Truck Loading Optimizer.

PyInstaller bundles this file along with all templates, static assets,
and Python dependencies into a single TruckLoadingOptimizer.exe.

When run:
  1. A console window shows the server address.
  2. The default browser opens automatically.
  3. Closing the console window stops the server.
"""

import os
import sys
import socket
import threading
import time
import webbrowser

# ── Resolve base directory ────────────────────────────────────────────────
# When frozen by PyInstaller, all files are extracted to sys._MEIPASS.
# When run normally (python launcher.py), use the script's own directory.
if getattr(sys, "frozen", False):
    BASE_DIR = sys._MEIPASS
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

os.chdir(BASE_DIR)
sys.path.insert(0, BASE_DIR)

# ── Patch Flask before importing app.py ──────────────────────────────────
# Flask resolves templates/static relative to __file__ of the calling module.
# Inside a PyInstaller bundle that path points to a temp dir, so we force it.
from flask import Flask as _Flask  # noqa: E402

_original_init = _Flask.__init__


def _patched_init(self, import_name, **kwargs):
    kwargs.setdefault("template_folder", os.path.join(BASE_DIR, "templates"))
    kwargs.setdefault("static_folder",   os.path.join(BASE_DIR, "static"))
    _original_init(self, import_name, **kwargs)


_Flask.__init__ = _patched_init

# ── Import the Flask application ──────────────────────────────────────────
from app import app  # noqa: E402  (app.py must not be modified)


# ── Find a free port ──────────────────────────────────────────────────────
def _free_port(preferred: int = 5000) -> int:
    for port in range(preferred, preferred + 20):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("127.0.0.1", port))
                return port
            except OSError:
                continue
    return preferred


# ── Main ──────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    PORT = _free_port(5000)
    URL  = f"http://127.0.0.1:{PORT}"

    print("=" * 52)
    print("   Truck Loading Optimizer")
    print(f"   Server : {URL}")
    print("   Close this window to stop the server.")
    print("=" * 52)

    # Open the browser slightly after Flask is ready
    def _open_browser():
        time.sleep(1.5)
        webbrowser.open(URL)

    threading.Thread(target=_open_browser, daemon=True).start()

    app.run(host="127.0.0.1", port=PORT, debug=False, use_reloader=False)
