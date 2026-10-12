const { app, BrowserWindow, ipcMain, protocol, net, dialog, shell } = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { convertDocxToPdf, detectEngine } = require("./converter.cjs");

const isDev = !!process.env.ELECTRON_DEV;
const DIST = path.join(__dirname, "..", "dist");
let win;

// Doit être déclaré avant app.ready
protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true },
  },
]);

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    title: "Attestation Generator",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Les liens externes s'ouvrent dans le navigateur, pas dans l'app
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  if (isDev) {
    win.loadURL("http://localhost:5173");
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    win.loadURL("app://local/index.html");
  }
}

app.whenReady().then(() => {
  // Sert le dossier dist/ via app://local/...
  protocol.handle("app", (request) => {
    const { pathname } = new URL(request.url);
    const rel = decodeURIComponent(pathname === "/" ? "/index.html" : pathname);
    const filePath = path.normalize(path.join(DIST, rel));
    if (!filePath.startsWith(DIST)) return new Response("Interdit", { status: 403 });
    return net.fetch(pathToFileURL(filePath).toString());
  });

  ipcMain.handle("engine-info", async () => {
    const engine = await detectEngine();
    return engine ? engine.type : null;
  });

  ipcMain.handle("docx-to-pdf", async (_event, bytes) => {
    const engine = await detectEngine();
    if (!engine) {
      const { response } = await dialog.showMessageBox(win, {
        type: "warning",
        title: "Moteur de conversion manquant",
        message: "Ni Microsoft Word ni LibreOffice n'est installé sur ce poste.",
        detail: "LibreOffice (gratuit) est nécessaire pour exporter les attestations en PDF.",
        buttons: ["Télécharger LibreOffice", "Annuler"],
        defaultId: 0,
        cancelId: 1,
      });
      if (response === 0) {
        shell.openExternal("https://www.libreoffice.org/download/download-libreoffice/");
      }
      throw new Error("Aucun moteur de conversion (Word ou LibreOffice) n'est installé sur ce poste.");
    }
    return convertDocxToPdf(Buffer.from(bytes));
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});