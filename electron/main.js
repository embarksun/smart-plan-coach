const { app, BrowserWindow, ipcMain, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    return null;
  }
}

function firstExistingFile(files) {
  for (const file of files) {
    try {
      if (file && fs.existsSync(file)) return file;
    } catch (err) {
      /* ignore */
    }
  }
  return null;
}

function configSearchDirs() {
  const dirs = [];
  if (process.env.PORTABLE_EXECUTABLE_DIR) {
    dirs.push(process.env.PORTABLE_EXECUTABLE_DIR);
  }
  if (app.isPackaged) {
    dirs.push(path.dirname(process.execPath));
  } else {
    dirs.push(path.join(__dirname, '..'));
  }
  return dirs;
}

function resolveUserDataPath() {
  const fromEnv = (process.env.SMART_PLAN_COACH_USER_DATA || '').trim();
  if (fromEnv) return fromEnv;

  const dirs = configSearchDirs();
  const jsonFile = firstExistingFile(dirs.map((d) => path.join(d, 'app-config.json')));
  if (jsonFile) {
    const cfg = readJson(jsonFile);
    if (cfg && typeof cfg.userData === 'string' && cfg.userData.trim()) {
      return cfg.userData.trim();
    }
  }

  const txtFile = firstExistingFile(dirs.map((d) => path.join(d, 'user-data-path.txt')));
  if (txtFile) {
    const p = fs.readFileSync(txtFile, 'utf8').trim();
    if (p) return p;
  }

  if (process.env.PORTABLE_EXECUTABLE_DIR) {
    return path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'SmartPlanCoach-data');
  }

  return path.join(app.getPath('appData'), 'SmartPlanCoach');
}

const userDataPath = resolveUserDataPath();
fs.mkdirSync(userDataPath, { recursive: true });
app.setPath('userData', userDataPath);

function createWindow() {
  const win = new BrowserWindow({
    width: 500,
    height: 860,
    minWidth: 380,
    minHeight: 640,
    backgroundColor: '#1a2332',
    autoHideMenuBar: true,
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, '..', 'index.html'));

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  return win;
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });

  ipcMain.on('get-user-data-path-sync', (event) => {
    event.returnValue = app.getPath('userData');
  });

  app.whenReady().then(() => {
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
