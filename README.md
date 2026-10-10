# University Research Opportunity Portal

Course: Computer Networks (CN) - Assignment #01 - BS (CS 5B), FAST-NUCES Peshawar Campus
Name: **Haziqa Eiman**| Reg. No: **P24-0594** | Class: BS**CS-5B**

**GitHub Repository:** https://github.com/YOUR\_GITHUB\_USERNAME/research-opportunity-portal
**Demo video:** (add your video file name or link here)

A small web application where faculty members can post, view, update, close and delete research opportunities.

|Part|Technology|
|-|-|
|Backend|Python + Flask (REST API)|
|Database|MySQL|
|Frontend|HTML, CSS, vanilla JavaScript|
|Testing|Postman|

## Project structure

```
research-opportunity-portal/
├── app.py                      Flask backend: 5 API routes + serves the frontend
├── schema.sql                  Creates the MySQL database and table
├── requirements.txt            Python packages
├── .env.example                Template for database settings (copy to .env)
├── .gitignore                  Keeps .env (password) out of Git
├── static/
│   ├── index.html              Frontend page
│   ├── style.css               Styling
│   └── script.js               Frontend logic (calls the API with fetch)
├── postman/
│   └── Research\\\_Opportunity\\\_Portal.postman\\\_collection.json
└── README.md
```

## Setup (Windows 10/11)

You need: **Python 3.9+** (tick "Add Python to PATH" when installing) and **MySQL Server 8** with MySQL Workbench (MySQL Installer from mysql.com). Remember the MySQL `root` password you choose.

1. Open **Command Prompt** and go to the project folder:

```
   cd path\\\\to\\\\research-opportunity-portal
   ```

2. Create and activate a virtual environment, then install packages:

```
   python -m venv venv
   venv\\\\Scripts\\\\activate
   pip install -r requirements.txt
   ```

3. Create your private settings file and put your MySQL password in it:

```
   copy .env.example .env
   notepad .env
   ```

Set `DB\\\_PASSWORD=` to your real MySQL root password. (`.env` is ignored by Git, never upload it.)

4. Create the database and table. **Option A (easiest):** open MySQL Workbench, connect, use *File > Open SQL Script* to open `schema.sql`, click the lightning button. **Option B:** in Command Prompt (not PowerShell):

```
   "C:\\\\Program Files\\\\MySQL\\\\MySQL Server 8.0\\\\bin\\\\mysql.exe" -u root -p < schema.sql
   ```

5. Start the server:

```
   python app.py
   ```

6. Open **http://localhost:5000** in your browser.

## API

Base URL: `http://localhost:5000`

|Method|Route|What it does|Success|Errors|
|-|-|-|-|-|
|POST|`/api/opportunities`|Create an opportunity|201|400, 500|
|GET|`/api/opportunities`|Get all opportunities|200|500|
|GET|`/api/opportunities/<id>`|Get one opportunity|200|404, 500|
|PUT|`/api/opportunities/<id>`|Update (any fields) / close|200|400, 404, 500|
|DELETE|`/api/opportunities/<id>`|Delete an opportunity|200|404, 500|

Fields: `id`, `title`, `description`, `research\\\_area`, `faculty\\\_name`, `department`, `required\\\_skills`, `positions` (whole number >= 1), `deadline` (`YYYY-MM-DD`), `status` (`Open` or `Closed`, default `Open`).

Example create request body:

```json
{
  "title": "Machine Learning for Crop Disease Detection",
  "description": "Build image models that detect crop diseases.",
  "research\\\_area": "Machine Learning",
  "faculty\\\_name": "Dr. Ayesha Khan",
  "department": "Computer Science",
  "required\\\_skills": "Python, TensorFlow",
  "positions": 3,
  "deadline": "2026-12-15"
}
```

To close an opportunity, send `PUT /api/opportunities/<id>` with `{"status": "Closed"}`.

Errors are returned as JSON, e.g. `{"error": "Field 'title' is required."}`.

\## Testing with curl (Command Prompt)



With the server running (`python app.py`), open a second Command Prompt and run:



| Test | Command | Expected |

|------|---------|----------|

| Get all | `curl -i http://localhost:5000/api/opportunities` | 200 OK with JSON list |

| Get one | `curl -i http://localhost:5000/api/opportunities/1` | 200 OK with one row |

| Not found | `curl -i http://localhost:5000/api/opportunities/999` | 404 NOT FOUND |

| Invalid data | `curl -i -X POST http://localhost:5000/api/opportunities -H "Content-Type: application/json" -d "{\\"title\\":\\"\\"}"` | 400 BAD REQUEST |

| Delete | `curl -i -X DELETE http://localhost:5000/api/opportunities/2` | 200 OK |

| After delete | `curl -i http://localhost:5000/api/opportunities/2` | 404 NOT FOUND |



All six tests passed on my machine.



## Testing with Postman

1. Start the server (`python app.py`).
2. Postman > **Import** > choose `postman/Research\\\_Opportunity\\\_Portal.postman\\\_collection.json`.
3. Open the collection and run requests **1 to 11 in order** (or use *Run collection*). Requests 1-3 automatically save the new IDs, so later requests use them.
4. Each request has tests (Test Results tab) checking the status code: 201, 200, 200, 200, 200, 200, 200, 200, **404**, **400**, **400**.

## Security notes

* All SQL uses parameterized queries (`%s` placeholders), which prevents SQL injection.
* The database password is only in the local `.env` file, which is excluded from Git.

