#!/usr/bin/env python3
"""
agenttop Claude Code hook — active prompt injection protection.

install as a PostToolUse hook to scan all tool results for prompt
injection attempts before Claude processes them. blocks on critical
severity, warns on lower.

hook type: PostToolUse (runs after tool executes, before result
reaches Claude — stderr output with exit code 2 blocks the result)

input (stdin): json with tool_name, tool_input, tool_result
output: exit 0 = pass, exit 2 = block (stderr = reason)

install:
  agenttop --install-hooks
"""

import json
import re
import sys

INJECTION_PATTERNS = [
    (r'ignore\s+(all\s+)?previous\s+instructions', 'ignore previous instructions'),
    (r'ignore\s+(all\s+)?prior\s+instructions', 'ignore prior instructions'),
    (r'disregard\s+(all\s+)?previous', 'disregard previous'),
    (r'you\s+are\s+now\s+', 'role reassignment attempt'),
    (r'new\s+instructions?\s*:', 'new instructions injection'),
    (r'system\s*:\s*you', 'fake system prompt'),
    (r'\bdo\s+not\s+follow\s+(your|the)\s+(original|previous)', 'instruction override'),
    (r'override\s+(your\s+)?(instructions|rules|guidelines)', 'instruction override'),
    (r'forget\s+(your\s+)?(instructions|rules|guidelines)', 'instruction override'),
    (r'act\s+as\s+(if\s+)?(you\s+are|a)\s+', 'role reassignment attempt'),
    (r'pretend\s+(you\s+are|to\s+be)\s+', 'role reassignment attempt'),
    (r'\bAI\s+assistant\b.*\bmust\b', 'directive injection'),
    (r'<\s*system\s*>', 'fake system tag'),
    (r'\[\s*INST\s*\]', 'fake instruction tag'),
    (r'BEGIN\s+HIDDEN\s+INSTRUCTIONS', 'hidden instructions'),
]

ENCODED_PATTERNS = [
    (r'aWdub3JlIHByZXZpb3Vz', 'base64 encoded injection'),
]

EXFIL_PATTERNS = [
    (r'base64.*\|\s*(curl|wget|nc)', 'data exfiltration via encoding + network'),
    (r'cat\s+.*\|\s*(curl|wget|nc)', 'data exfiltration via pipe to network'),
    (r'>\s*/dev/tcp/', 'data exfiltration via /dev/tcp'),
]

TOOLS_WITH_EXTERNAL_CONTENT = [
    'Bash', 'Read', 'Grep', 'Glob', 'WebFetch', 'WebSearch',
]


def scan_text(text: str) -> list[tuple[str, str]]:
    """scan text for injection patterns. returns list of (matched_text, description)."""
    if not text or len(text) < 10:
        return []

    findings = []
    for pattern, desc in INJECTION_PATTERNS + ENCODED_PATTERNS:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            findings.append((match.group(0)[:60], desc))

    return findings


def scan_for_exfil(text: str) -> list[tuple[str, str]]:
    """scan for data exfiltration patterns in tool results."""
    if not text:
        return []

    findings = []
    for pattern, desc in EXFIL_PATTERNS:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            findings.append((match.group(0)[:60], desc))

    return findings


def main():
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError:
        sys.exit(0)

    tool_name = input_data.get('tool_name', '')
    tool_result = input_data.get('tool_result', '')

    if tool_name not in TOOLS_WITH_EXTERNAL_CONTENT:
        sys.exit(0)

    if not tool_result:
        sys.exit(0)

    result_text = str(tool_result) if not isinstance(tool_result, str) else tool_result

    injection_findings = scan_text(result_text)
    exfil_findings = scan_for_exfil(result_text)

    all_findings = injection_findings + exfil_findings

    if not all_findings:
        sys.exit(0)

    print("[agenttop] BLOCKED: potential prompt injection in tool result", file=sys.stderr)
    print("", file=sys.stderr)
    for matched, desc in all_findings[:3]:
        print(f"  [{desc}]: \"{matched}\"", file=sys.stderr)
    print("", file=sys.stderr)
    print(f"  tool: {tool_name}", file=sys.stderr)
    print("  review the tool output carefully before proceeding", file=sys.stderr)
    sys.exit(2)


if __name__ == '__main__':
    main()
