"""
app.py - the Flask backend (REST API) for the University Research Opportunity Portal.

It does two jobs:
  1. Serves the frontend page (static/index.html).
  2. Provides 5 API routes under /api/opportunities that read/write MySQL.
"""

import os
from datetime import datetime

import mysql.connector
from dotenv import load_dotenv
from flask import Flask, jsonify, request

load_dotenv()  # reads the local .env file (database password etc.)

app = Flask(__name__, static_folder="static", static_url_path="")

# Every field a client must send when creating an opportunity.
REQUIRED_FIELDS = [
    "title", "description", "research_area", "faculty_name",
    "department", "required_skills", "positions", "deadline",
]


def get_db():
    """Open a new connection to MySQL using values from .env."""
    return mysql.connector.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", "3306")),
        user=os.getenv("DB_USER", "root"),
        password=os.getenv("DB_PASSWORD", ""),
        database=os.getenv("DB_NAME", "research_portal"),
    )


def row_to_json(row):
    """MySQL returns a DATE object; JSON needs text, so convert it to 'YYYY-MM-DD'."""
    row["deadline"] = row["deadline"].strftime("%Y-%m-%d")
    return row


def validate(data, require_all):
    """
    Check the incoming JSON. Returns an error message (string) or None if all is fine.
    require_all=True  -> used by POST (every field must be present)
    require_all=False -> used by PUT (only validate the fields that were sent)
    """
    if not isinstance(data, dict):
        return "Request body must be a JSON object."

    if require_all:
        for field in REQUIRED_FIELDS:
            if field not in data or str(data[field]).strip() == "":
                return f"Field '{field}' is required."

    # Text fields must not be blank (and not too long for the column).
    limits = {"title": 200, "research_area": 100, "faculty_name": 100,
              "department": 100, "required_skills": 300}
    for field, max_len in limits.items():
        if field in data:
            value = str(data[field]).strip()
            if value == "":
                return f"Field '{field}' cannot be empty."
            if len(value) > max_len:
                return f"Field '{field}' must be at most {max_len} characters."
    if "description" in data and str(data["description"]).strip() == "":
        return "Field 'description' cannot be empty."

    # positions must be a whole number >= 1
    if "positions" in data:
        try:
            positions = int(data["positions"])
        except (ValueError, TypeError):
            return "Field 'positions' must be a whole number."
        if isinstance(data["positions"], bool) or positions < 1:
            return "Field 'positions' must be 1 or more."

    # deadline must be a real date written as YYYY-MM-DD
    if "deadline" in data:
        try:
            datetime.strptime(str(data["deadline"]), "%Y-%m-%d")
        except ValueError:
            return "Field 'deadline' must be a valid date in YYYY-MM-DD format."

    # status can only be Open or Closed
    if "status" in data and data["status"] not in ("Open", "Closed"):
        return "Field 'status' must be either 'Open' or 'Closed'."

    return None


def fetch_one(cursor, opp_id):
    """SELECT one row by id. Returns a dict or None."""
    cursor.execute("SELECT * FROM opportunities WHERE id = %s", (opp_id,))
    row = cursor.fetchone()
    return row_to_json(row) if row else None


# ---------------------------------------------------------------- frontend
@app.route("/")
def home():
    return app.send_static_file("index.html")


# ---------------------------------------------------------------- 1. CREATE
@app.route("/api/opportunities", methods=["POST"])
def create_opportunity():
    data = request.get_json(silent=True)
    error = validate(data, require_all=True)
    if error:
        return jsonify({"error": error}), 400

    status = data.get("status", "Open")
    try:
        db = get_db()
        cursor = db.cursor(dictionary=True)
        cursor.execute(
            """INSERT INTO opportunities
               (title, description, research_area, faculty_name, department,
                required_skills, positions, deadline, status)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)""",
            (data["title"].strip(), data["description"].strip(),
             data["research_area"].strip(), data["faculty_name"].strip(),
             data["department"].strip(), data["required_skills"].strip(),
             int(data["positions"]), data["deadline"], status),
        )
        db.commit()
        new_id = cursor.lastrowid  # the ID MySQL just generated
        created = fetch_one(cursor, new_id)
        cursor.close()
        db.close()
        return jsonify(created), 201
    except mysql.connector.Error as e:
        return jsonify({"error": f"Database error: {e}"}), 500


# ---------------------------------------------------------------- 2. READ ALL
@app.route("/api/opportunities", methods=["GET"])
def get_all_opportunities():
    try:
        db = get_db()
        cursor = db.cursor(dictionary=True)
        cursor.execute("SELECT * FROM opportunities ORDER BY id")
        rows = [row_to_json(r) for r in cursor.fetchall()]
        cursor.close()
        db.close()
        return jsonify(rows), 200
    except mysql.connector.Error as e:
        return jsonify({"error": f"Database error: {e}"}), 500


# ---------------------------------------------------------------- 3. READ ONE
# Flask writes the ":id" from the assignment as <int:id>
@app.route("/api/opportunities/<int:id>", methods=["GET"])
def get_opportunity(id):
    try:
        db = get_db()
        cursor = db.cursor(dictionary=True)
        row = fetch_one(cursor, id)
        cursor.close()
        db.close()
        if row is None:
            return jsonify({"error": f"Opportunity with id {id} not found."}), 404
        return jsonify(row), 200
    except mysql.connector.Error as e:
        return jsonify({"error": f"Database error: {e}"}), 500


# ---------------------------------------------------------------- 4. UPDATE
@app.route("/api/opportunities/<int:id>", methods=["PUT"])
def update_opportunity(id):
    data = request.get_json(silent=True)
    error = validate(data, require_all=False)
    if error:
        return jsonify({"error": error}), 400

    # Only these columns may be changed. Keep only the ones the client sent.
    allowed = ["title", "description", "research_area", "faculty_name",
               "department", "required_skills", "positions", "deadline", "status"]
    changes = {k: data[k] for k in allowed if k in data}
    if not changes:
        return jsonify({"error": "No valid fields were sent to update."}), 400

    try:
        db = get_db()
        cursor = db.cursor(dictionary=True)
        if fetch_one(cursor, id) is None:
            cursor.close()
            db.close()
            return jsonify({"error": f"Opportunity with id {id} not found."}), 404

        # Build "title = %s, status = %s" from the column names (our own fixed list,
        # never user text). The VALUES still go in as %s parameters.
        set_clause = ", ".join(f"{col} = %s" for col in changes)
        values = [int(v) if k == "positions" else (v.strip() if isinstance(v, str) else v)
                  for k, v in changes.items()]
        cursor.execute(f"UPDATE opportunities SET {set_clause} WHERE id = %s",
                       values + [id])
        db.commit()
        updated = fetch_one(cursor, id)
        cursor.close()
        db.close()
        return jsonify(updated), 200
    except mysql.connector.Error as e:
        return jsonify({"error": f"Database error: {e}"}), 500


# ---------------------------------------------------------------- 5. DELETE
@app.route("/api/opportunities/<int:id>", methods=["DELETE"])
def delete_opportunity(id):
    try:
        db = get_db()
        cursor = db.cursor()
        cursor.execute("DELETE FROM opportunities WHERE id = %s", (id,))
        db.commit()
        deleted_rows = cursor.rowcount  # how many rows were removed (0 or 1)
        cursor.close()
        db.close()
        if deleted_rows == 0:
            return jsonify({"error": f"Opportunity with id {id} not found."}), 404
        return jsonify({"message": f"Opportunity {id} deleted successfully."}), 200
    except mysql.connector.Error as e:
        return jsonify({"error": f"Database error: {e}"}), 500


# ---------------------------------------------------------------- error pages
@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Route not found."}), 404


@app.errorhandler(500)
def server_error(e):
    return jsonify({"error": "Internal server error."}), 500


if __name__ == "__main__":
    app.run(debug=True, port=5000)
