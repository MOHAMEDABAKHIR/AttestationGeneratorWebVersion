const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktop", {
  docxToPdf: (bytes) => ipcRenderer.invoke("docx-to-pdf", bytes),
  getEngine: () => ipcRenderer.invoke("engine-info"),
});