"""Reference spawn adapter for the public Cloud Agents REST API (v0).

Make target: none (called by spawn.py / wait.py / collect.py).
Inputs: CURSOR_API_KEY; subcommands spawn|status|conversation|followup.
Outputs: one JSON object on stdout (adapter contract). Exit: 0 ok · 1 usage · 3 env.

Verified against https://cursor.com/docs/cloud-agent/api/v0 (2026-09-05):
base URL https://api.cursor.com ; Basic auth (`-u KEY:`); POST /v0/agents
(prompt.text, source.repository, source.ref, model, target.branchName,
target.autoCreatePr=false); GET /v0/agents/{id}; GET /v0/agents/{id}/conversation;
POST /v0/agents/{id}/followup. Status values observed: CREATING, RUNNING,
FINISHED, ERROR, EXPIRED. Conversation messages use type user_message /
assistant_message. This module never prints account names, dashboard URLs,
or the API key.
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from typing import Any

BASE_URL = "https://api.cursor.com"
API_VERSION = "v0"

EXIT_OK = 0
EXIT_USAGE = 1
EXIT_ENVIRONMENT = 3


def utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def die(code: int, msg: str) -> None:
    sys.stderr.write(msg.rstrip() + "\n")
    raise SystemExit(code)


def api_key() -> str:
    key = os.environ.get("CURSOR_API_KEY")
    if not key:
        die(EXIT_ENVIRONMENT, "CURSOR_API_KEY is unset")
    return key


def _request(method: str, path: str, body: dict[str, Any] | None = None) -> dict[str, Any]:
    key = api_key()
    token = base64.b64encode(f"{key}:".encode("utf-8")).decode("ascii")
    data = None if body is None else json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        f"{BASE_URL}{path}",
        data=data,
        method=method,
        headers={
            "Authorization": f"Basic {token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            raw = resp.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        die(EXIT_ENVIRONMENT, f"http {exc.code}")
    except urllib.error.URLError:
        die(EXIT_ENVIRONMENT, "network error")
    if not raw:
        return {}
    return json.loads(raw)


def _map_state(status: str | None) -> str:
    s = (status or "").upper()
    if s in {"FINISHED", "COMPLETED", "DONE"}:
        return "FINISHED"
    if s in {"ERROR", "FAILED"}:
        return "ERROR"
    if s in {"EXPIRED"}:
        return "EXPIRED"
    if s in {"RUNNING", "CREATING", "PENDING"}:
        return "RUNNING"
    return "UNKNOWN"


def cmd_spawn(args: argparse.Namespace) -> dict[str, Any]:
    prompt = sys.stdin.read()
    payload = {
        "prompt": {"text": prompt},
        "model": args.model,
        "source": {"repository": args.repo, "ref": args.ref},
        "target": {"autoCreatePr": False, "branchName": args.branch},
    }
    if args.title:
        payload["name"] = args.title
    data = _request("POST", f"/{API_VERSION}/agents", payload)
    seat = str(data.get("id") or "")
    model = str(data.get("model") or args.model)
    spawned = str(data.get("createdAt") or utc_now())
    if spawned and not spawned.endswith("Z") and "+" not in spawned:
        spawned = spawned + "Z" if "T" in spawned else utc_now()
    return {"model": model, "seat_id": seat, "spawned_at": spawned}


def cmd_status(args: argparse.Namespace) -> dict[str, Any]:
    data = _request("GET", f"/{API_VERSION}/agents/{args.seat}")
    finished = data.get("finishedAt") or data.get("completedAt")
    return {
        "credits_reported": data.get("credits") if isinstance(data.get("credits"), (int, float)) else None,
        "finished_at": finished if finished else None,
        "messages": data.get("messageCount") if isinstance(data.get("messageCount"), int) else None,
        "model": data.get("model"),
        "seat_id": args.seat,
        "state": _map_state(data.get("status")),
    }


def cmd_conversation(args: argparse.Namespace) -> dict[str, Any]:
    data = _request("GET", f"/{API_VERSION}/agents/{args.seat}/conversation")
    turns = []
    for i, msg in enumerate(data.get("messages") or []):
        role = "user" if str(msg.get("type") or "").startswith("user") else "assistant"
        turns.append({"index": i, "role": role, "text": str(msg.get("text") or "")})
    return {"seat_id": args.seat, "turns": turns}


def cmd_followup(args: argparse.Namespace) -> dict[str, Any]:
    text = sys.stdin.read()
    _request(
        "POST",
        f"/{API_VERSION}/agents/{args.seat}/followup",
        {"prompt": {"text": text}},
    )
    return {"accepted": True, "seat_id": args.seat}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="cmd", required=True)
    sp = sub.add_parser("spawn")
    sp.add_argument("--repo", required=True)
    sp.add_argument("--ref", required=True)
    sp.add_argument("--branch", required=True)
    sp.add_argument("--model", required=True)
    sp.add_argument("--title", default="")
    st = sub.add_parser("status")
    st.add_argument("--seat", required=True)
    conv = sub.add_parser("conversation")
    conv.add_argument("--seat", required=True)
    fu = sub.add_parser("followup")
    fu.add_argument("--seat", required=True)
    args = parser.parse_args(argv)
    dispatch = {
        "spawn": cmd_spawn,
        "status": cmd_status,
        "conversation": cmd_conversation,
        "followup": cmd_followup,
    }
    out = dispatch[args.cmd](args)
    sys.stdout.write(json.dumps(out, sort_keys=True) + "\n")
    return EXIT_OK


if __name__ == "__main__":
    sys.exit(main())
