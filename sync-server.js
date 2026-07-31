#!/usr/bin/env node
'use strict';
// 萌子的小天地 —— 同步服务（零依赖，仅用 Node 内置模块）
// 作用：让电脑端和手机端共用同一份数据。
//   GET  /api/data          返回 { key: { ts, data }, ... }
//   POST /api/data          body: { key, data, ts } 或 { keys: { key: {ts,data} } }
//   / 及静态文件            直接提供 待办工作台.html / icon.png
// 数据落盘在同级 sync-data.json。

var http = require('http');
var fs = require('fs');
var path = require('path');

var PORT = process.env.PORT || 8787;
var ROOT = __dirname;
var DATA_FILE = path.join(ROOT, 'sync-data.json');
var HTML_FILE = path.join(ROOT, '待办工作台.html');

var MIME = {
  '.html': 'text/html; charset=utf-8',
  '.png': 'image/png',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.ico': 'image/x-icon'
};

function readData() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch (e) { return {}; }
}
function writeData(obj) {
  // 先写临时文件再改名，避免写入中断损坏数据
  var tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
  fs.renameSync(tmp, DATA_FILE);
}

function accept(cur, key, data, ts) {
  if (!key) return;
  ts = ts || Date.now();
  if (!cur[key] || ts >= cur[key].ts) cur[key] = { ts: ts, data: data };
}

var server = http.createServer(function (req, res) {
  // 允许任意来源（个人工具，数据不敏感）；本地同源时同样可用
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // ---- 同步 API ----
  if (req.url.split('?')[0] === '/api/data') {
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(readData()));
      return;
    }
    if (req.method === 'POST') {
      var body = '';
      req.on('data', function (c) { body += c; });
      req.on('end', function () {
        try {
          var payload = JSON.parse(body);
          var cur = readData();
          if (payload.key) {
            accept(cur, payload.key, payload.data, payload.ts);
          } else if (payload.keys) {
            Object.keys(payload.keys).forEach(function (k) {
              accept(cur, k, payload.keys[k].data, payload.keys[k].ts);
            });
          }
          writeData(cur);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: String(e) }));
        }
      });
      return;
    }
  }

  // ---- 静态文件（默认提供工作台页面）----
  var urlPath = req.url === '/' ? '/' : req.url.split('?')[0];
  var fileName = urlPath === '/' ? '待办工作台.html' : decodeURIComponent(urlPath.replace(/^\//, ''));
  var filePath = path.join(ROOT, fileName);
  if (filePath.indexOf(ROOT) !== 0) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.readFile(filePath, function (err, content) {
    if (err) {
      // 兜底：找不到时回退到工作台页面
      fs.readFile(HTML_FILE, function (e2, html) {
        if (e2) { res.writeHead(404); res.end('Not found'); return; }
        res.writeHead(200, { 'Content-Type': MIME['.html'] });
        res.end(html);
      });
      return;
    }
    var ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(content);
  });
});

server.listen(PORT, function () {
  console.log('🌱 萌子的小天地 同步服务已启动');
  console.log('   本机访问：  http://localhost:' + PORT);
  console.log('   手机访问：  http://<你的局域网IP>:' + PORT + ' （在 Mac「系统设置→网络」查看 IP）');
  console.log('   数据文件：  ' + DATA_FILE);
});
