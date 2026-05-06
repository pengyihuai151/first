const { app, BrowserWindow } = require('electron');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

// 动态端口
let PORT = 5173;
let serverProcess = null;
let mainWindow = null;

function startHttpServer() {
  return new Promise((resolve) => {
    // 尝试多个端口
    const tryPort = (p) => {
      const server = http.createServer((req, res) => {
        const fs = require('fs');
        const urlPath = req.url.split('?')[0];
        let filePath = path.join(__dirname, 'dist', urlPath === '/' ? 'index.html' : urlPath);

        // 安全检查：防止路径遍历
        if (!filePath.startsWith(path.join(__dirname, 'dist'))) {
          res.writeHead(403);
          res.end('Forbidden');
          return;
        }

        const ext = path.extname(filePath);
        const mimeTypes = {
          '.html': 'text/html; charset=utf-8',
          '.js': 'application/javascript',
          '.css': 'text/css',
          '.json': 'application/json',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.ico': 'image/x-icon',
          '.svg': 'image/svg+xml',
        };

        fs.readFile(filePath, (err, data) => {
          if (err) {
            // 尝试 index.html（用于 SPA 路由）
            fs.readFile(path.join(__dirname, 'dist', 'index.html'), (err2, data2) => {
              if (err2) {
                res.writeHead(404);
                res.end('Not Found: ' + urlPath);
              } else {
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(data2);
              }
            });
            return;
          }
          res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
          res.end(data);
        });
      });

      server.listen(p, '127.0.0.1', () => {
        PORT = p;
        resolve(PORT);
      });

      server.on('error', (e) => {
        if (e.code === 'EADDRINUSE') {
          tryPort(p + 1);
        }
      });
    };

    tryPort(PORT);
  });
}

function createWindow(port) {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 780,
    minWidth: 360,
    minHeight: 640,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    autoHideMenuBar: true,
    show: false,
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // 从本地 HTTP 服务器加载（解决 file:// 协议下输入框不可用问题）
  mainWindow.loadURL(`http://127.0.0.1:${port}`).catch((err) => {
    console.error('Failed to load URL:', err);
  });

  // 关闭窗口时退出应用
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  try {
    const port = await startHttpServer();
    createWindow(port);
  } catch (err) {
    console.error('Failed to start server:', err);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) {
    startHttpServer().then((port) => createWindow(port));
  }
});