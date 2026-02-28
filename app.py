"""Flask web application for truck loading optimization."""

from flask import Flask, render_template, request, jsonify
from packing import pack_boxes_with_stacking

app = Flask(__name__)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/optimize", methods=["POST"])
def optimize():
    data = request.get_json()
    try:
        result = pack_boxes_with_stacking(
            american_stackable=int(data.get("american_stackable", 0)),
            american_non_stackable=int(data.get("american_non_stackable", 0)),
            european_stackable=int(data.get("european_stackable", 0)),
            european_non_stackable=int(data.get("european_non_stackable", 0)),
            custom_boxes=data.get("custom_boxes"),
        )
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 400


if __name__ == "__main__":
    app.run(debug=True, port=5000)
