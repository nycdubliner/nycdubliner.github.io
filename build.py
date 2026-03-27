import os
import json
import urllib.request
import datetime

USERNAME = "nycdubliner"
API_URL = f"https://api.github.com/users/{USERNAME}/repos?type=public&sort=pushed&per_page=100"

req = urllib.request.Request(API_URL)
if "GITHUB_TOKEN" in os.environ:
    req.add_header("Authorization", f"Bearer {os.environ['GITHUB_TOKEN']}")

with urllib.request.urlopen(req) as response:
    repos = json.loads(response.read())

# Filter repos that have pages enabled or have a homepage set to github.io
project_repos = [r for r in repos if r.get("has_pages") or (r.get("homepage") and "github.io" in r.get("homepage"))]

# Generate HTML
html = f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Projects | {USERNAME}</title>
    <style>
        :root {{
            --bg-color: #0f172a;
            --text-color: #f8fafc;
            --card-bg: #1e293b;
            --accent-color: #38bdf8;
        }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: var(--bg-color);
            color: var(--text-color);
            line-height: 1.6;
            margin: 0;
            padding: 2rem;
            display: flex;
            flex-direction: column;
            align-items: center;
        }}
        h1 {{ margin-bottom: 2rem; color: var(--accent-color); font-weight: 900; letter-spacing: -0.025em; }}
        .grid {{
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 1.5rem;
            width: 100%;
            max-width: 1000px;
        }}
        .card {{
            background: var(--card-bg);
            border-radius: 1rem;
            padding: 1.5rem;
            text-decoration: none;
            color: inherit;
            transition: transform 0.2s, box-shadow 0.2s;
            border: 1px solid rgba(255,255,255,0.05);
            display: flex;
            flex-direction: column;
        }}
        .card:hover {{
            transform: translateY(-4px);
            box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5);
            border-color: var(--accent-color);
        }}
        .card h2 {{
            margin: 0 0 0.5rem 0;
            font-size: 1.25rem;
            color: var(--accent-color);
        }}
        .card p {{
            margin: 0;
            opacity: 0.8;
            font-size: 0.95rem;
            flex: 1;
        }}
        .meta {{
            margin-top: 1rem;
            font-size: 0.75rem;
            opacity: 0.5;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }}
        footer {{
            margin-top: 4rem;
            font-size: 0.8rem;
            opacity: 0.5;
        }}
        .notes {{
            margin-top: 4rem;
            width: 100%;
            max-width: 1000px;
            background: var(--card-bg);
            border-radius: 1rem;
            padding: 2rem;
            border: 1px solid rgba(255,255,255,0.05);
        }}
        .notes h2 {{
            margin-top: 0;
            color: var(--accent-color);
        }}
        .notes code {{
            background: rgba(0,0,0,0.3);
            padding: 0.2rem 0.4rem;
            border-radius: 0.25rem;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        }}
        .notes pre {{
            background: rgba(0,0,0,0.3);
            padding: 1rem;
            border-radius: 0.5rem;
            overflow-x: auto;
        }}
    </style>
</head>
<body>
    <h1>My Projects</h1>
    <div class="grid">
"""

for repo in project_repos:
    if repo["name"] == f"{USERNAME}.github.io":
        continue
        
    name = repo["name"]
    desc = repo["description"] or "No description provided."
    url = repo["homepage"] if repo["homepage"] else f"https://{USERNAME}.github.io/{name}/"
    date_str = repo["pushed_at"][:10]
    
    html += f"""
        <a href="{url}" class="card">
            <h2>{name}</h2>
            <p>{desc}</p>
            <div class="meta">Last updated: {date_str}</div>
        </a>
    """

html += f"""
    </div>

    <div class="notes">
        <h2>Android Setup</h2>
        <p>To get Gemini CLI running on Android, you'll need <strong>Termux</strong>. Follow these steps:</p>
        <ol>
            <li>Install <a href="https://termux.dev/" style="color: var(--accent-color)">Termux</a> (preferably from F-Droid).</li>
            <li>Update packages: <code>pkg update && pkg upgrade</code></li>
            <li>Install dependencies: <code>pkg install nodejs python git gh</code></li>
            <li>Install Gemini CLI: <code>npm install -g @google/gemini-cli</code></li>
        </ol>
        <p><strong>Note:</strong> With this setup, you have full access to <code>git</code> and the GitHub CLI (<code>gh</code>) directly within your Android environment, enabling powerful mobile development workflows.</p>
    </div>

    <footer>
        Last generated: {datetime.datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}
    </footer>
</body>
</html>
"""

with open("index.html", "w") as f:
    f.write(html)
