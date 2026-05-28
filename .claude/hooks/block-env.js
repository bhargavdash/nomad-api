let d = '';
process.stdin.on('data', c => (d += c));
process.stdin.on('end', () => {
  try {
    const p = (JSON.parse(d).tool_input || {}).file_path || '';
    if (/(^|[/\\])\.env$/.test(p)) {
      process.stderr.write('Blocked: .env cannot be edited directly. Update .env.example for docs.\n');
      process.exit(2);
    }
  } catch (e) {}
});
