import os

transcript_path = r"C:\Users\adm-09\.gemini\antigravity-ide\brain\36e6aed2-56dd-4ec8-91f1-2d32791b0fab\.system_generated\logs\transcript.jsonl"

def read_tail():
    try:
        # Open using low-level os.open with read-only flags
        fd = os.open(transcript_path, os.O_RDONLY)
        with os.fdopen(fd, 'r', encoding='utf-8', errors='ignore') as f:
            lines = f.readlines()
            print(f"Total lines: {len(lines)}")
            # print last 50 lines
            for line in lines[-50:]:
                print(line.strip())
    except Exception as e:
        print("Error reading transcript:", e)

if __name__ == "__main__":
    read_tail()
