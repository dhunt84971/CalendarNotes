const { app, shell, BrowserWindow, ipcMain } = require("electron");

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win = null;
let settingsSaved = false;

function createWindow() {
  // Create the browser window.
  win = new BrowserWindow({ width: 800, height: 600, show: false,
    webPreferences: {
      nodeIntegration: true,
      webviewTag: true,
      enableRemoteModule: true,
      devtools: true,
    } 
  });
  
  // and load the index.html of the app.
  win.loadFile("index.html").catch((e)=>{console.log(e);});

  // Remove Window Menu
  win.setMenu(null);

  // Open the DevTools.
  // devtools = new BrowserWindow();
  // win.webContents.setDevToolsWebContents(devtools.webContents);
  // win.webContents.openDevTools({mode: 'detach'});

  win.on("close", (e) =>{
    if (!settingsSaved){
      e.preventDefault();
      win.webContents.send("saveSettings", null);
    }
  });
  
  // Emitted when the window is closed.
  win.on("closed", () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    win = null;
  });

  win.once('ready-to-show', () => {
    win.show();
  });

  // Open links in external browser (deprecated)
  win.webContents.on("new-window", function(e, url) {
    e.preventDefault();
    shell.openExternal(url);
  });

  // Open links in external browser
  win.webContents.on("will-navigate", function(e, url) {
    e.preventDefault();
    shell.openExternal(url);
  });

}

//#region IPC EVENTS
ipcMain.on("closeWindow", (event, message) => {
  settingsSaved = true;
  win.close();
});
//#endregion IPC EVENTS

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", createWindow);

// Quit when all windows are closed.
app.on("window-all-closed", () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (win === null) {
    createWindow();
  }
});

app.allowRendererProcessReuse = false;

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
