# Taste
- Expects enterprise-grade, authentic Microsoft look & feel in Windows apps — pixel-faithful Fluent UI (tokens, themes, native components like DataGrid/drawers/toasts), not generic "basic" styling. Confidence: 0.85
- Prefers rich, dense information displays (full telemetry, structured fields, detail drawers/appendix data) over minimal/basic tables — do not under-inform. Confidence: 0.85
- Wants bulk operations via multi-select (e.g. multi-select rows → batch action) instead of one-at-a-time actions. Confidence: 0.85
- Strongly dislikes setup/launch friction — prefers one-command, double-clickable startup with auto dependency caching, health checks, and browser auto-open over multi-script manual launches (phrased the complexity as "very hectic"). Confidence: 0.85
- Explicitly rejects PowerShell scripts for launching/starting the app ("i dont want any powershell script to start the app") — prefers pure .bat batch file launchers on Windows; keep the start path free of .ps1 files, verify bat syntax pitfalls carefully (findstr /c: patterns, CRLF endings, escaping parens in echo blocks). Confidence: 0.9
- Communicates tersely and approves autonomously — responds to a detailed plan with a single word ("proceed"), signaling: present the plan, then execute end-to-end without further check-ins; avoid re-asking for confirmation mid-work. Confidence: 0.7
