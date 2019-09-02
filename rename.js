const electron = require("electron");
const remote = require('electron').remote;
const libAppSettings = require("lib-app-settings");

const settingsFile = "./.settings";
var appSettings = new libAppSettings(settingsFile);

document.getElementById("btnCancel").addEventListener("click", () =>{
    var window = remote.getCurrentWindow();
    window.close();
});

function init(){
    await appSettings.loadSettingsFromFile()
        .then((settings)=>{
        changeTheme(settings.themeIndex);
        })
        .catch((err)=>{
        });
}

init();