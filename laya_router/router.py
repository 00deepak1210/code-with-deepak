"""Laya task router: picks SMALL or LARGE for a request and calls Laya.

Configure with environment variables:
  LAYA_API_URL            endpoint that accepts {"model", "prompt"} JSON
  LAYA_API_KEY            sent as a Bearer token
  LAYA_SMALL_MODEL_NAME   fast, cheap model
  LAYA_LARGE_MODEL_NAME   slower, more capable model

Usage:
  python router.py "your request here"
  python router.py --model LARGE "force a model"
"""

import argparse
import json
import os
import re
import sys
import urllib.request

SMALL = os.environ.get("LAYA_SMALL_MODEL_NAME", "laya-small")
LARGE = os.environ.get("LAYA_LARGE_MODEL_NAME", "laya-large")

HEAVY_PATTERNS = [
    r"\b(debug|refactor|implement|write (a |the )?(function|script|program|code|class))\b",
    r"\b(prove|derive|calculate|solve|equation|algorithm|optimi[sz]e)\b",
    r"\b(plan|strategy|step[- ]by[- ]step|architecture|design)\b",
    r"\b(compare|comparison|pros and cons|trade-?offs?|research|analy[sz]e|analysis)\b",
    r"\b(legal|medical|financial|contract|security)\b",
    r"```",
]
LOW_CONFIDENCE = re.compile(r"\b(i'?m not sure|i don'?t know|cannot determine|unclear)\b", re.I)


def classify(prompt: str) -> tuple[str, str]:
    """Return ("SMALL"|"LARGE", short reason)."""
    if len(prompt.split()) > 500:
        return "LARGE", "long input needs capacity"
    for pat in HEAVY_PATTERNS:
        if re.search(pat, prompt, re.I):
            return "LARGE", "complex reasoning or code"
    return "SMALL", "light, simple request"


def call_laya(model: str, prompt: str, timeout: int = 60) -> str:
    """Adapter for the Laya API. Adjust the payload/response parsing to match it."""
    url = os.environ.get("LAYA_API_URL")
    if not url:
        raise RuntimeError("LAYA_API_URL is not set")
    req = urllib.request.Request(
        url,
        data=json.dumps({"model": model, "prompt": prompt}).encode(),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {os.environ.get('LAYA_API_KEY', '')}",
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        body = json.loads(resp.read())
    return body.get("output") or body.get("text") or json.dumps(body)


def call_with_fallback(tier: str, prompt: str) -> tuple[str, str, str | None]:
    """Try the chosen tier twice, then the other tier. Returns (tier, answer, note)."""
    model = SMALL if tier == "SMALL" else LARGE
    for _ in range(2):
        try:
            return tier, call_laya(model, prompt), None
        except Exception as err:  # noqa: BLE001
            last_err = err
    other = "LARGE" if tier == "SMALL" else "SMALL"
    answer = call_laya(SMALL if other == "SMALL" else LARGE, prompt)
    return other, answer, f"{tier} failed ({last_err}); fell back to {other}."


def route(prompt: str, forced: str | None = None) -> str:
    if forced:
        tier, reason = forced, "user named the model"
    else:
        tier, reason = classify(prompt)

    tier, answer, note = call_with_fallback(tier, prompt)

    # Escalate weak SMALL answers.
    if tier == "SMALL" and not forced and (len(answer.strip()) < 5 or LOW_CONFIDENCE.search(answer)):
        tier, answer, note = call_with_fallback("LARGE", prompt)
        reason = "escalated after weak answer"
    elif note:
        reason = "fallback after failed call"

    out = answer.rstrip()
    if note:
        out += f"\n\nNote: {note}"
    return f"{out}\n\nModel used: {tier} ({reason})"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("prompt", nargs="+")
    parser.add_argument("--model", choices=["SMALL", "LARGE"])
    args = parser.parse_args()
    try:
        print(route(" ".join(args.prompt), args.model))
    except Exception as err:  # noqa: BLE001
        sys.exit(f"Laya call failed on both models: {err}")


if __name__ == "__main__":
    main()
