import json

transcript_path = r"C:\Users\adm-09\.gemini\antigravity-ide\brain\36e6aed2-56dd-4ec8-91f1-2d32791b0fab\.system_generated\logs\transcript.jsonl"

def parse():
    steps = []
    with open(transcript_path, 'r', encoding='utf-8') as f:
        for line in f:
            try:
                steps.append(json.loads(line))
            except Exception:
                pass
    
    print(f"Total steps: {len(steps)}")
    # Print the last 15 steps
    for s in steps[-15:]:
        print(f"\n--- Step {s.get('step_index')} (Source: {s.get('source')}, Type: {s.get('type')}, Status: {s.get('status')}) ---")
        content = s.get('content')
        if content:
            print("Content summary:", content[:300] + "..." if len(content) > 300 else content)
        tool_calls = s.get('tool_calls')
        if tool_calls:
            print("Tool calls:", json.dumps(tool_calls, indent=2)[:500])
        # If there is a tool result/output
        output = s.get('output')
        if output:
            print("Output:", str(output)[:300] + "..." if len(str(output)) > 300 else str(output))

if __name__ == "__main__":
    parse()
