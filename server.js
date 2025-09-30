require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');

const app = express();

// أمن أساسي
app.use(helmet());
app.use(express.json());
// افتح CORS باش تقدر تستعملو من التليفون/السحابة
app.use(cors());

const PORT = process.env.PORT || 4000;
const SECRET = process.env.SECRET_TOKEN || '';
if (!SECRET) {
  console.error('SECRET_TOKEN not set. Add it as env var (Render/Replit) أو في .env محلياً.');
  process.exit(1);
}

// Rate limit
app.use(rateLimit({
  windowMs: 30 * 1000,
  max: 20,
  message: { error: 'Too many requests, try later.' }
}));

// Middleware للتحقق من المفتاح
function requireToken(req, res, next) {
  const token = req.headers['x-api-key'];
  if (!token || token !== SECRET) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

// أوامر مسموحة فقط
const ACTIONS = {
  list: (dir) => `ls -la ${dir}`,
  sysinfo: () =>
    (process.platform === 'win32' ? 'systeminfo' : 'uname -a && uptime && free -h'),
  start: (dir) => `cd ${dir} && npm start`
};

// Helper لتنفيذ أمر بشروط
function runCmd(cmd, cwd = process.cwd()) {
  return new Promise((resolve) => {
    exec(cmd, { cwd, timeout: 60 * 1000, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
      resolve({
        ok: !err,
        error: err ? String(err.message).slice(0, 1000) : null,
        stdout: stdout?.toString().slice(0, 50000) || '',
        stderr: stderr?.toString().slice(0, 5000) || ''
      });
    });
  });
}

// صفحة الواجهة
app.use('/static', express.static(path.join(__dirname, 'public')));
app.get('/', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// APIs
app.post('/api/list', requireToken, async (req, res) => {
  const dir = req.body?.dir || '.';
  const safe = path.resolve(dir);
  const root = path.resolve(process.cwd());
  if (!safe.startsWith(root)) return res.status(400).json({ error: 'Directory not allowed' });
  const out = await runCmd(ACTIONS.list(safe));
  res.json({ command: ACTIONS.list(safe), ...out });
});

app.post('/api/sysinfo', requireToken, async (_req, res) => {
  const out = await runCmd(ACTIONS.sysinfo());
  res.json(out);
});

app.post('/api/start', requireToken, async (req, res) => {
  const dir = req.body?.dir || '.';
  const safe = path.resolve(dir);
  const root = path.resolve(process.cwd());
  if (!safe.startsWith(root)) return res.status(400).json({ error: 'Directory not allowed' });
  const out = await runCmd(ACTIONS.start(safe), safe);
  res.json({ command: ACTIONS.start(safe), ...out });
});

app.post('/api/backup', requireToken, async (req, res) => {
  const dir = req.body?.dir || '.';
  const safe = path.resolve(dir);
  const root = path.resolve(process.cwd());
  if (!safe.startsWith(root)) return res.status(400).json({ error: 'Directory not allowed' });

  const ts = Date.now();
  const zipName = `backup_${path.basename(safe)}_${ts}.zip`;
  const zipPath = path.join(process.cwd(), zipName);

  const output = fs.createWriteStream(zipPath);
  const archive = archiver('zip', { zlib: { level: 9 } });

  output.on('close', () => res.json({ ok: true, zip: zipName, size: archive.pointer() }));
  archive.on('error', (e) => res.status(500).json({ error: String(e) }));

  archive.pipe(output);
  archive.directory(safe, path.basename(safe));
  archive.finalize();
});

// Cloud-ready: استمع لكل الواجهات
app.listen(PORT, '0.0.0.0', () => console.log(`App on port ${PORT}`));
