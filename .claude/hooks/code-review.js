// Hook helper: extract file_path from Claude Code PostToolUse JSON on stdin
let d = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", function (c) { d += c; });
process.stdin.on("end", function () {
  try {
    const obj = JSON.parse(d);
    const fp = (obj.tool_input && obj.tool_input.file_path) || "";
    process.stdout.write(fp);
  } catch (_) {
    process.stdout.write("");
  }
});
