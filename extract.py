import json

path = "/Users/erickalwd/.gemini/antigravity-ide/brain/7178d6bf-9744-4447-b3db-6a38be6b0807/.system_generated/logs/transcript.jsonl"
with open(path, "r") as f:
    for line in f:
        data = json.loads(line)
        if data.get("source") == "MODEL" and data.get("type") == "CODE_ACTION":
            # look at tool_calls if any, but wait, CODE_ACTION has content. Or PLANNER_RESPONSE has tool_calls.
            pass
        if data.get("source") == "SYSTEM" and data.get("type") == "TOOL_RESPONSE":
            content = data.get("content", "")
            if "Showing lines 1 to" in content and "VoiceAgent.tsx" in content:
                print("FOUND A VIEW FILE OF VoiceAgent.tsx!")
                lines = content.split("\n")
                with open("old_voiceagent.tsx", "w") as out:
                    for l in lines:
                        if l.startswith(tuple([f"{i}:" for i in range(300)])):
                            out.write(l.split(":", 1)[1][1:] + "\n")

