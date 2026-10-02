"""Prepare human review of scenarios; this does not invoke or grade a model."""
import argparse
import json
from pathlib import Path
import subprocess
import sys

root = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--viewer-script", required=True, type=Path,
                    help="Path to create-skill/eval-viewer/generate_review.py")
parser.add_argument("--output", type=Path,
                    default=root / "skills/spec-driven-superpowers-workspace/prepared")
args = parser.parse_args()
scenarios = json.loads((root / "skills/spec-driven-superpowers/evals/evals.json").read_text())
workspace = args.output.resolve()
workspace.mkdir(parents=True, exist_ok=True)
for scenario in scenarios["evals"]:
    directory = workspace / f"eval-{scenario['id']}-{scenario['name']}"
    outputs = directory / "prepared-not-run/outputs"
    outputs.mkdir(parents=True, exist_ok=True)
    metadata = {
        "eval_id": scenario["id"], "eval_name": scenario["name"],
        "prompt": scenario["prompt"], "assertions": scenario["assertions"],
        "execution_status": "prepared_not_run",
    }
    (directory / "eval_metadata.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2))
    (outputs / "scenario-not-model-output.json").write_text(json.dumps({
        "status": "NOT RUN — scenario review only; no model output or grade",
        "expected_output": scenario["expected_output"],
        "assertions_to_review": scenario["assertions"],
        "input_paths_relative_to_toolkit": scenario["files"],
    }, ensure_ascii=False, indent=2))
result = subprocess.run([
    sys.executable, str(args.viewer_script.resolve()), str(workspace),
    "--skill-name", "spec-driven-superpowers — PREPARED, NOT RUN",
    "--static", str(workspace / "review.html"),
], check=False)
if result.returncode:
    raise SystemExit(result.returncode)
print(f"Scenario review (not model evaluation): {workspace / 'review.html'}")
