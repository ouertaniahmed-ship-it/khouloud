"""Flask web application for truck loading optimization."""

from flask import Flask, render_template, request, jsonify
from packing import pack_boxes_with_stacking

app = Flask(__name__)

MAX_PER_CATEGORY = 500


def _clamp(value) -> int:
    n = int(value or 0)
    if n < 0:
        return 0
    if n > MAX_PER_CATEGORY:
        return MAX_PER_CATEGORY
    return n


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/optimize", methods=["POST"])
def optimize():
    data = request.get_json(silent=True) or {}
    try:
        custom = data.get("custom_boxes") or []
        for ct in custom:
            ct["stackable"]     = _clamp(ct.get("stackable", 0))
            ct["non_stackable"] = _clamp(ct.get("non_stackable", 0))

        result = pack_boxes_with_stacking(
            american_stackable     = _clamp(data.get("american_stackable")),
            american_non_stackable = _clamp(data.get("american_non_stackable")),
            european_stackable     = _clamp(data.get("european_stackable")),
            european_non_stackable = _clamp(data.get("european_non_stackable")),
            custom_boxes           = custom,
        )
        return jsonify(result)
    except (TypeError, ValueError):
        return jsonify({"error": "Invalid request"}), 400
    except Exception:
        return jsonify({"error": "Internal error"}), 500


if __name__ == "__main__":
    app.run(debug=False, port=5000)
