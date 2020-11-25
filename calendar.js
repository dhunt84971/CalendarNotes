const { dialog } = require("electron").remote;
const electron = require("electron");
const { remote } = require("electron");
const ipc = require("electron").ipcRenderer;
const libAppSettings = require("lib-app-settings");

var mysql = require("mysql");
var sqlite3 = require("sqlite3").verbose();
var fs = require("fs");
var marked = require("marked");

var initialLoad = true;
var settingsShown = false;
var calRows = 5;

const settingsFile = "./.settings";
const dbFile = "./.calendarNotes.db";

var appSettings = new libAppSettings(settingsFile);

var monthDisplayed, daySelected, yearDisplayed;
var lastDaySelected;

// These are placeholders that will be written over when the settings
// are read from the settings file.
var _settings = {
  host: "localhost",
  user: "calendaruser",
  password: "calendaruser",
  database: "CalendarNotesDB",
  port: 3306
};

var calChangeDate;
var blockInterface = false;

// #region THEMES
var select = document.getElementById("selThemes");

for (var i = 0; i < themes.length; i++) {
  console.log("loop " + i);
  var opt = themes[i].name;
  var el = document.createElement("option");
  el.textContent = opt;
  el.value = i;
  select.appendChild(el);
}

// #endregion THEMES

// #region INITIALIZATION CODE
tasksSelected();
notesViewSelected();
document.getElementById("txtView").classList.add("hide");
document.getElementById("settingsSlider").classList.add("hide");
marked.setOptions({
  gfm: true,
  breaks: true
});
document.getElementById("chkDocuments").checked = false;
document.getElementById("btnDocs").classList.add("hide");
document.getElementById("optSqlite").checked = true;
updateDBSelection("optSqlite");

// #endregion INITIALIZATION CODE

// #region CALENDAR OBJECT CODE
var CALENDAR = function () {
  var wrap,
    label,
    months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December"
    ];

  async function init(newWrap) {
    wrap = $(newWrap || "#cal");
    label = wrap.find("#label");

    wrap.find("#prev").bind("click.calender", function (ev) {
      if (ev.ctrlKey){
        switchYear(false);
      }
      else{
        switchMonth(false);
      }
    });
    wrap.find("#next").bind("click.calender", function (ev) {
      if (ev.ctrlKey){
        switchYear(true);
      }
      else{
        switchMonth(true);
      }
    });
    label.bind("click.calendar", function () {
      switchMonth(null, new Date().getMonth(), new Date().getFullYear());
    });

    monthDisplayed = new Date().getMonth() + 1;
    daySelected = new Date().getDate();
    yearDisplayed = new Date().getFullYear();

    switchMonth(null, new Date().getMonth(), new Date().getFullYear());
    lastDaySelected = getSelectedDate();

    console.log("MySQL Datetime  = " + getMySQLNow());

    // Load the settings from the file.
    await appSettings.loadSettingsFromFile()
    .then((settings)=>{
      document.getElementById("selThemes").selectedIndex = settings.themeIndex;
      changeTheme(settings.themeIndex, function () {
        initSettingsIcon();
      });
      document.getElementById("txtHost").value = settings.host;
      document.getElementById("txtPort").value = settings.port;
      document.getElementById("txtDatabase").value = settings.database;
      document.getElementById("txtUsername").value = settings.user;
      document.getElementById("txtPassword").value = settings.password;
      document.getElementById("chkDocuments").checked = settings.documents == true;
      settings.documents ? document.getElementById("btnDocs").classList.remove("hide") 
      : document.getElementById("btnDocs").classList.add("hide");
      
      _settings = settings;
      dateSelected(daySelected);
      //loadDocs();
      document.getElementById("leftSideBar").style.width = settings.leftSideBarWidth;
      document.getElementById("docsSideBar").style.width = settings.docsSideBarWidth;
      document.getElementById("optSqlite").checked = (settings.dbType == "Sqlite");
      document.getElementById("optMySql").checked = (settings.dbType == "MySql");     
      updateDBSelection("opt" + settings.dbType); 
    })
    .catch((err)=>{
        // Assume any error means the settings file does not exist and create it.
        ////alert("No settings found.  Configure your settings.");
        ShowWarningMessageBox("No settings found.  Assigning defaults.");
        appSettings.setSettingsInFile(getSettingsfromDialog());
        createSqliteDB();
    });
    
    console.log("1" + document.querySelector(".curr").innerHTML);
  }

  function switchYear(next, year) {
    var curr = label
      .text()
      .trim()
      .split(" "),
      calendar,
      tempYear = parseInt(curr[1], 10);

    if (next != null) {
      year =
        year || (next ? tempYear + 1 : tempYear - 1);
    }
    
    switchMonth(null, months.indexOf(curr[0]), year);
  }

  function switchMonth(next, month, year) {
    var curr = label
      .text()
      .trim()
      .split(" "),
      calendar,
      tempYear = parseInt(curr[1], 10);

    // If null is passed then just keep the passed month and year value.
    if (next != null) {
      month =
        month ||
        (next ?
          curr[0] === "December" ?
          0 :
          months.indexOf(curr[0]) + 1 :
          curr[0] === "January" ?
          11 :
          months.indexOf(curr[0]) - 1);
      year =
        year ||
        (next && month === 0 ?
          tempYear + 1 :
          !next && month === 11 ?
          tempYear - 1 :
          tempYear);
    }

    console.profile("createCal");
    calendar = createCal(year, month);
    console.profileEnd("createCal");

    $("#cal-frame", wrap)
      .find(".curr")
      .removeClass("curr")
      .addClass("temp")
      .end()
      .prepend(calendar.calendar())
      .find(".temp")
      .fadeOut("slow", function () {
        $(this).remove();
      });
    label.text(calendar.label);

    monthDisplayed = month + 1;
    yearDisplayed = year;
  }

  function changeDate(month, year, callback) {
    month -= 1;
    console.profile("createCal");
    calendar = createCal(year, month);
    console.profileEnd("createCal");

    $("#cal-frame", wrap)
      .find(".curr")
      .removeClass("curr")
      .addClass("temp")
      .end()
      .prepend(calendar.calendar())
      .find(".temp")
      .fadeOut("slow", function () {
        $(this).remove();
      });
    label.text(calendar.label);

    monthDisplayed = month + 1;

    yearDisplayed = year;

    if (callback) callback();
  }

  function createCal(year, month) {
    var day = 1,
      i,
      j,
      haveDays = true,
      startDay = new Date(year, month, day).getDay(),
      daysInMonth = [
        31,
        (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28,
        31,
        30,
        31,
        30,
        31,
        31,
        30,
        31,
        30,
        31
      ],
      calendar = [];
    /* This code uses a cache to speed things up, but this bypasses the calRows counter.
        if (createCal.cache[year]) {
			if (createCal.cache[year][month]) {
        		return createCal.cache[year][month];
			}
		} else {
			createCal.cache[year] = {};
		}
        */
    createCal.cache[year] = {};
    i = 0;
    while (haveDays) {
      calendar[i] = [];
      for (j = 0; j < 7; j++) {
        if (i === 0) {
          if (j === startDay) {
            calendar[i][j] = day++;
            startDay++;
          }
        } else if (day <= daysInMonth[month]) {
          calendar[i][j] = day++;
        } else {
          calendar[i][j] = "";
          haveDays = false;
        }
        if (day > daysInMonth[month]) {
          haveDays = false;
        }
      }
      i++;
    }

    /*if (calendar[5]) {
			for (i = 0; i < calendar[5].length; i++) {
				if (calendar[5][i] !== "") {
					calendar[4][i] = "<span>" + calendar[4][i] + "</span><span>" + calendar[5][i] + "</span>";
				}
			}
			calendar = calendar.slice(0, 5);
		}
		*/

    var rowDays;
    calRows = 0;
    for (i = 0; i < calendar.length; i++) {
      rowDays = "<tr>";
      for (j = 0; j < calendar[i].length; j++) {
        if (calendar[i][j]) {
          day = twoDigits(calendar[i][j]);
          rowDays +=
            "<td id='day" +
            day +
            "' onclick='dateSelected(" +
            day +
            ")'>" +
            calendar[i][j] +
            "</td>";
        } else {
          rowDays += "<td></td>";
        }
      }
      rowDays += "</tr>";
      calRows += 1;
      //calendar[i] = "<tr><td id='day" + i + "'>" + calendar[i].join("</td><td>") + "</td></tr>";
      calendar[i] = rowDays;
      console.log(calendar[i]);
    }

    calendar = $("<table>" + calendar.join("") + "</table").addClass("curr");

    $("td:empty", calendar).addClass("nil");
    /*
        if (month === new Date().getMonth()) {
			$('td', calendar).filter(function () { return $(this).text() === new Date().getDate().toString(); }).addClass("today");
		}
		*/

    createCal.cache[year][month] = {
      calendar: function () {
        return calendar.clone();
      },
      label: months[month] + " " + year
    };

    return createCal.cache[year][month];
  }
  createCal.cache = {};
  calChangeDate = changeDate;

  return {
    init: init,
    switchMonth: switchMonth,
    createCal: createCal
  };
};
// #endregion CALENDAR OBJECT CODE

// #region DATABASE CODE
function getRowsMySql(sql, callback){
  console.log("SQL = " + sql);
  var connection = mysql.createConnection(_settings);
  connection.connect();
  connection.query(sql, function (err, rows, fields) {
    if (!err) {
      if (callback){
        callback(err, rows);
      }
    } else {
      if (callback) {
        callback(err, null);
      }
    }
  });
  connection.end();
}

function getRowsSqlite(sql, callback){
  console.log("SQL = " + sql);
  let db = new sqlite3.Database(dbFile, (err) => {
    if (!err) {
      db.all(sql, [], (err, rows) => {
        if (!err) {
          if (callback){
            callback(err, rows);
          }
        } else {
          if (callback) {
            callback(err, null);
          }
        }
      });
    }
    db.close();
  });
}


function getNotesMySQL(dateForDay, callback){
  var connection = mysql.createConnection(_settings);
  connection.connect();
  var sqlQuery = "SELECT * from Notes where NoteDate = '" + dateForDay + "'";
  console.log(sqlQuery);
  connection.query(sqlQuery, function (err, rows, fields) {
    console.log("Notes received");
    if (!err) {
      if (rows.length > 0) {
        if (callback){
          callback(err, rows[0].NoteText);
        }
      } else {
        if (callback){
          callback(err, " ");
        }
        return;
      }
    } else {
      if (callback){ callback(err); }
      return;
    }
    connection.end();
  });
}

function getNotesSqlite(dateForDay, callback){
  let db = new sqlite3.Database(dbFile, (err) => {
    if (!err) {
      db.all("SELECT * FROM Notes WHERE NoteDate = '" + formatDateSqlite(dateForDay) + "'", [], (err, rows) => {
        if (!err) {
          if (rows.length > 0) {
            if (callback){
              callback(err, rows[0].NoteText);
            }
          } else {
            if (callback){
              callback(err, " ");
            }
            return;
          }
        } else {
          if (callback){ callback(err); }
          return;
        }
        db.close();
      });
    } else {
      console.error(err.message);
      if (callback){ callback(err); }
      return;
    }
  });
}

function saveNotesMySql(dateForDay, notesText, callback) {
  //var noteExists = sqlNoteExists(dateForDay);
  console.log("Saving notes = '" + notesText + "'");
  if (notesText == "") notesText = " ";

  sqlNoteExistsMySql(dateForDay, function (result) {
    if (result) {
      updateNotesMySql(dateForDay, notesText, callback);
    } else {
      insertNotesMySql(dateForDay, notesText, callback);
    }
  });
}

function saveNotesSqlite(dateForDay, notesText, callback) {
  //var noteExists = sqlNoteExists(dateForDay);
  console.log("Saving notes = '" + notesText + "'");
  if (notesText == "") notesText = " ";

  sqlNoteExistsSqlite(dateForDay, function (result) {
    if (result) {
      updateNotesSqlite(dateForDay, notesText, callback);
    } else {
      insertNotesSqlite(dateForDay, notesText, callback);
    }
  });
}

function getTasksMySql(callback) {
  console.log("a");
  var connection = mysql.createConnection(_settings);
  connection.connect();
  console.log("b");
  connection.query("SELECT * FROM TasksList LIMIT 1",  (err, rows, fields) => {
    console.log("c");
    if (!err) {
      console.log(rows);
      if (callback) {
        callback(err, rows[0].TasksList);
      }
    } else {
      console.log("Error while performing Query.");
      if (callback) {
        callback(err);
      }
    }
    connection.end();
  });
}

function getTasksSqlite(callback) {
  let db = new sqlite3.Database(dbFile, (err) => {
    if (!err) {
      db.all("SELECT * FROM TasksList", [], (err, rows) => {
        if (!err) {
          if (rows.length > 0) {
            if (callback){
              callback(err, rows[0].TasksList);
            }
          } else {
            if (callback){
              callback(err, " ");
            }
            return;
          }
        } else {
          if (callback){ callback(err); }
          return;
        }
        db.close();
      });
    } else {
      console.error(err.message);
      if (callback){ callback(err); }
      return;
    }
  });
}

function createSqliteDB(callback){
  return new Promise((resolve, reject) => {
    let db = new sqlite3.Database(dbFile, (err) => {
      if (err) {
        console.error(err.message);
        reject();
      } else {
        // Create the tables.
        var sql = `CREATE TABLE Notes (
          ID INTEGER PRIMARY KEY,
          NoteDate TEXT,
          NoteText TEXT,
          LastModified TEXT
        )`;
        db.run(sql);
        sql = `CREATE TABLE TasksList (
          ID INTEGER PRIMARY KEY,
          TasksList TEXT
        )`;
        db.run(sql);
        sql = `CREATE TABLE Docs (
          ID INTEGER PRIMARY KEY,
          DocName TEXT,
          DocLocation TEXT,
          DocColor INTEGER DEFAULT 16777215,
          DocText TEXT,
          LastModified TEXT,
          DocIndentLevel INTEGER DEFAULT 0
        )`;
        db.run(sql);
        db.close();
        resolve();
        if (callback) callback();
      }
      console.log('Connected to the database.');
    });
  });
}
// #endregion DATABASE CODE

// #region NOTES CODE
// Get the notes from the MySQL database.
function loadNotes(notes){
  document.getElementById("txtNotes").value = notes;
  if (!document.getElementById("btnViewText").classList.contains("btnSelected")) {
    document.getElementById("txtView").innerHTML = marked(notes);
  }
}

function getNotes(dateForDay, callback) {
  return new Promise(function(resolve, reject){
    // Block the interface from acting on any input.
    if (_settings.dbType == "MySql"){
      getNotesMySQL(dateForDay, (err, notes) => {
        if (!err) {
          loadNotes(notes);
        } else {
          alert("Error querying database.  Check settings.");
          console.log("Error while performing query.");
          console.log(_settings);
          reject(err);
        }
        resolve();
      });
    } else { //if (dbType == "Sqlite")
      getNotesSqlite(dateForDay, (err, notes) => {
        if (!err) {
          loadNotes(notes);
        } else {
          alert("Error querying database.  Check settings.");
          console.log("Error while performing query.");
          console.log(_settings);
          reject(err);
        }
        resolve();
      });
    }
  });
}

function saveNotes(dateForDay, notesText) {
  return new Promise(function(resolve, reject){
    console.log("Saving notes = '" + notesText + "'");
    if (notesText == "") notesText = " ";
    if (_settings.dbType == "MySql"){
      saveNotesMySql(dateForDay, notesText, () => {
        resolve();
      });
    }
    else {
      saveNotesSqlite(dateForDay, notesText, () => {
        resolve();
      });
    }
    document.getElementById("btnSave").innerHTML = "SAVE";
  });
}

function updateNotesMySql(dateForDay, notesText, callback) {
  var connection = mysql.createConnection(_settings);
  connection.connect(function (err) {
    if (err) throw err;
    var sql = "UPDATE Notes SET NoteText = '" + sqlSafeText(notesText) + "', ";
    sql += "LastModified = '" + getMySQLNow() + "' ";
    sql += "WHERE NoteDate = '" + dateForDay + "'";
    console.log("Executing SQL query = " + sql);

    connection.query(sql, function (err, result) {
      if (err) throw err;
      console.log(result.affectedRows + " record(s) updated");
      if (callback) callback(err, result);
      connection.end();
    });
  });
}

function updateNotesSqlite(dateForDay, notesText, callback) {
  console.log(formatDateSqlite(dateForDay));
  let db = new sqlite3.Database(dbFile, (err) => {
    if (err) throw err;
    var sql = "UPDATE Notes SET NoteText = '" + sqlSafeText(notesText) + "', ";
    sql += "LastModified = '" + getMySQLNow() + "' ";
    sql += "WHERE NoteDate = '" + formatDateSqlite(dateForDay) + "'";
    console.log("Executing SQL query = " + sql);

    db.run(sql, function (err) {
      if (err) throw err;
      if (callback) callback(err, "success");
    });
    db.close();
  });
}

function insertNotesMySql(dateForDay, notesText, callback) {
  var connection = mysql.createConnection(_settings);
  connection.connect(function (err) {
    if (err) throw err;
    var sql = "INSERT INTO Notes (NoteDate, NoteText, LastModified) VALUES (";
    sql += "'" + dateForDay + "', ";
    sql += "'" + sqlSafeText(notesText) + "', ";
    sql += "'" + getMySQLNow() + "')";
    console.log("Executing SQL query = " + sql);

    connection.query(sql, function (err, result) {
      if (err) throw err;
      if (callback) callback(err, result);
      connection.end();
    });
  });
}

function insertNotesSqlite(dateForDay, notesText, callback) {
  let db = new sqlite3.Database(dbFile, (err) => {
    if (err) throw err;
    var sql = "INSERT INTO Notes (NoteDate, NoteText, LastModified) VALUES (";
    sql += "'" + formatDateSqlite(dateForDay) + "', ";
    sql += "'" + sqlSafeText(notesText) + "', ";
    sql += "'" + getMySQLNow() + "')";
    console.log("Executing SQL query = " + sql);

    db.run(sql, (err) => {
      if (err) throw err;
      if (callback) callback(err, "success");
    });
    db.close();
  });
}

function sqlNoteExistsMySql(dateForDay, callback) {
  var retValue = false;
  var connection = mysql.createConnection(_settings);
  connection.connect();
  console.log(
    "Searching for Note : " +
    "SELECT * from Notes where NoteDate = '" +
    dateForDay +
    "'"
  );

  connection.query(
    "SELECT * from Notes where NoteDate = '" + dateForDay + "'",
    function (err, rows, fields) {
      if (!err) {
        console.log("Rows found = " + rows.length);
        console.log("Returning = " + (rows.length > 0));
        retValue = rows.length > 0;
        if (callback) callback(retValue);
      }
      connection.end();
    }
  );

  return retValue;
}

function sqlNoteExistsSqlite(dateForDay, callback) {
  var retValue = false;
  let db = new sqlite3.Database(dbFile, (err) => {
    if (!err) {
      console.log(
        "Searching for Note : " +
        "SELECT * from Notes where NoteDate = '" +
        dateForDay +
        "'"
      );
      var sql = "SELECT * FROM Notes WHERE NoteDate = '" + formatDateSqlite(dateForDay) + "'";
      db.all(sql, [], (err, rows) => {
        if (!err) {
          console.log("Rows found = " + rows.length);
          console.log("Returning = " + (rows.length > 0));
          retValue = rows.length > 0;
          if (callback) callback(retValue);
        }
      });
      db.close();
    }
  });
  return retValue;
}

function saveTasksMySql(tasksText, callback) {
  //var noteExists = sqlNoteExists(dateForDay);
  sqlTasksExistsMySql(function (result) {
    if (result) {
      updateTasksMySql(tasksText, callback);
    } else {
      insertTasksMySql(tasksText, callback);
    }
  });
}

function saveTasksSqlite(tasksText, callback) {
  //var noteExists = sqlNoteExists(dateForDay);
  sqlTasksExistsSqlite(function (result) {
    if (result) {
      updateTasksSqlite(tasksText, callback);
    } else {
      insertTasksSqlite(tasksText, callback);
    }
  });
}

function showNoteMarkdown() {

  var viewDiv = document.getElementById("txtView");
  var notesText = document.getElementById("txtNotes");
  console.log("show notesText = " + notesText.value);
  var customMods = notesText.value;
  console.log("Loading markdown view.");
  
  // Replace all check marks with their respective images.
  // |_| = <img src="./images/chkmt.png" width="12px">
  // |X| = <img src="./images/chk_x.png" width="12px">
  var checkedSrc = "<img src='./images/chk_x_blk.png' width='12px'>";
  var uncheckedSrc = "<img src='./images/chkmt_blk.png' width='12px'>";
  if (_settings.themeIndex == 5){
      checkedSrc = "<img src='./images/chk_x.png' width='12px'>";
      uncheckedSrc = "<img src='./images/chkmt.png' width='12px'>"
  }
  else if (_settings.themeIndex == 6) {
    checkedSrc = "<img src='./images/chk_x_clu.png' width='12px'>";
    uncheckedSrc = "<img src='./images/chkmt_clu.png' width='12px'>"
  }
  customMods = customMods.replace(/\|X\|/g, checkedSrc);
  customMods = customMods.replace(/\|_\|/g, uncheckedSrc);
  
  var markedNote = marked(customMods);

  viewDiv.innerHTML = markedNote;
}

function hideAllViews() {
  document.getElementById("txtNotesArea").classList.add("hide");
  document.getElementById("txtView").classList.add("hide");
  document.getElementById("divDocsView").classList.add("hide");
  document.getElementById("txtDocArea").classList.add("hide");
  document.getElementById("txtDocView").classList.add("hide");
}

function notesViewSelected() {
  hideAllViews();
  document.getElementById("btnViewText").classList.add("btnSelected");
  document.getElementById("btnViewMD").classList.remove("btnSelected");
  if (document.getElementById("btnDocs").classList.contains("tabSelected")) {
    document.getElementById("txtDocArea").classList.remove("hide");
  } else {
    document.getElementById("txtNotesArea").classList.remove("hide");
  }

}

function mdViewSelected() {
  hideAllViews();
  document.getElementById("btnViewText").classList.remove("btnSelected");
  document.getElementById("btnViewMD").classList.add("btnSelected");
  if (document.getElementById("btnDocs").classList.contains("tabSelected")) {
    document.getElementById("txtDocView").classList.remove("hide");
  } else {
    document.getElementById("txtView").classList.remove("hide");
  }
  showNoteMarkdown();
}

function docsViewSelected() {
  hideAllViews();
  document.getElementById("divDocsView").classList.remove("hide");
  // If markdown view is selected display the view div.
  if (document.getElementById("btnViewMD").classList.contains("btnSelected")) {
    document.getElementById("txtDocView").classList.remove("hide");
  } else {
    document.getElementById("txtDocArea").classList.remove("hide");
  }
}

function docsViewUnselected() {
  hideAllViews();
  if (document.getElementById("btnViewMD").classList.contains("btnSelected")) {
    document.getElementById("txtView").classList.remove("hide");
  } else {
    document.getElementById("txtNotesArea").classList.remove("hide");
  }
}


// #endregion NOTES CODE

// #region TASKS CODE
function loadTasks(tasks){
  document.getElementById("txtTasks").value = tasks;
}

// Get the tasks from the database.
function getTasks() {
  return new Promise(function(resolve, reject){
  // Block the interface from acting on any input.
    if (_settings.dbType == "MySql"){
      getTasksMySql((err, tasks) => {
        if (!err) {
          loadTasks(tasks);
        } else {
          alert("Error querying database.  Check settings.");
          console.log("Error while performing Query.");
          console.log(_settings);
          reject(err);
        }
        resolve();
      });
    } else { //if (dbType == "Sqlite")
      getTasksSqlite((err, tasks) => {
        if (!err) {
          loadTasks(tasks);
        } else {
          alert("Error querying database.  Check settings.");
          console.log("Error while performing Query.");
          console.log(_settings);
          reject(err);
        }
        resolve();
      });
    }
  });
}

function saveTasks(tasksText) {
  return new Promise(function(resolve, reject){
    if (_settings.dbType == "MySql"){
      saveTasksMySql(tasksText, () => {
        resolve();
      });
    }
    else {
      saveTasksSqlite(tasksText, () => {
        resolve();
      });
    }
  });
}

function updateTasksMySql(tasksText, callback) {
  console.log("1");
  var connection = mysql.createConnection(_settings);
  console.log("2");
  connection.connect(function (err) {
    console.log("3");
    if (err) throw err;
    var sql =
      "UPDATE TasksList SET TasksList = '" + sqlSafeText(tasksText) + "'";
    console.log("Executing SQL query = " + sql);

    connection.query(sql, function (err, result) {
      console.log("4");
      if (err) throw err;
      console.log(result.affectedRows + " record(s) updated");
      if (callback) callback(err, result);
      connection.end();
    });
  });
}

function updateTasksSqlite(tasksText, callback) {
  let db = new sqlite3.Database(dbFile, (err) => {
    if (err) throw err;
    var sql =
      "UPDATE TasksList SET TasksList = '" + sqlSafeText(tasksText) + "'";
    console.log("Executing SQL query = " + sql);

    db.run(sql, (err) => {
      if (err) throw err;
      if (callback) callback(err);
    });
    db.close();
  });
}

function insertTasksMySql(tasksText, callback) {
  var connection = mysql.createConnection(_settings);
  connection.connect(function (err) {
    if (err) throw err;
    var sql = "INSERT INTO TasksList (TasksList) VALUES (";
    sql += "'" + sqlSafeText(tasksText) + "')";
    console.log("Executing SQL query = " + sql);

    connection.query(sql, function (err, result) {
      if (err) throw err;
      if (callback) callback(err, result);
      connection.end();
    });
  });

}

function insertTasksSqlite(tasksText, callback) {
  let db = new sqlite3.Database(dbFile, (err) => {
    if (err) throw err;
    var sql = "INSERT INTO TasksList (TasksList) VALUES (";
    sql += "'" + sqlSafeText(tasksText) + "')";
    console.log("Executing SQL query = " + sql);

    db.run(sql, function (err) {
      if (err) throw err;
      if (callback) callback(err, "success");
    });
    db.close();
  });

}

function sqlTasksExistsMySql(callback) {
  var retValue = false;
  var connection = mysql.createConnection(_settings);
  connection.connect();
  console.log("Searching for Tasks : " + "SELECT * from TasksList");

  connection.query("SELECT * from TasksList", function (err, rows, fields) {
    if (!err) {
      console.log("Rows found = " + rows.length);
      console.log("Returning = " + (rows.length > 0));
      retValue = rows.length > 0;
      if (callback) callback(retValue);
    }
    connection.end();
  });

  return retValue;
}

function sqlTasksExistsSqlite(callback) {
  var retValue = false;
  let db = new sqlite3.Database(dbFile, (err) => {
    if (err) throw err;
    var sql = "SELECT * from TasksList";

    db.all(sql, [], (err, rows) => {
      if (!err) {
        console.log("Rows found = " + rows.length);
        console.log("Returning = " + (rows.length > 0));
        retValue = rows.length > 0;
        if (callback) callback(retValue);
      }
    });
    db.close();
  });

  return retValue;
}

// #endregion TASKS CODE

// #region DOCS CODE

//var lstDocuments = document.getElementById("lstDocuments");
//var dvDocuments = new div_treeview(lstDocuments, "/");
//var documentSelected = function (text){
//   selectDocument(text);
// }
// dvDocuments.onSelect(documentSelected);
// var onDocContextMenu = function (el, fullPath){
//   docContextMenu(el, fullPath);
// }
// dvDocuments.onRightClick(onDocContextMenu);

// :: TODO :: 

// Show Doc context menu
//var contextSelectedDoc;
// function docContextMenu (el, fullPath){
//   contextSelectedDoc = fullPath;
//   console.log(el.clientX);
//   var menu = document.querySelector(".docsMenu");
//   menu.style.left = el.clientX + "px";
//   menu.style.top = el.clientY + "px";
//   menu.classList.remove("hide");
//   console.log(menu);
// }

// Select doc
function selectDocument(docName){
  loadPages(docName);
}

// Load docs
function loadDocs(){
  // Load treeview with the documents.
  var connection = mysql.createConnection(_settings);
    connection.connect();
    connection.query(
      "SELECT DISTINCT DocLocation from Docs", function (err, data) {
        if (err) throw err;
        console.log(data);
        for(var i=0; i<data.length; i++){
          
          dvDocuments.addTVItem(lstDocuments,data[i].DocLocation, false);
        }
        // Pick the first location.
        dvDocuments.selectFirstItem();
      
        connection.end();
      }
    );
}

// Rename doc
function renameDoc(docFullPath){
  // Display dialog box for data entry.
  var docs = docFullPath.split("/");
  showRenameWindow(docs[docs.length-1]);
}

function showRenameWindow(oldName) {

  // Get the current window size and position.
  const pos = remote.getCurrentWindow().getPosition();
  const size = remote.getCurrentWindow().getSize();
  var xPos = pos[0] + (size[0] / 2) - 170;
  var yPos = pos[1] + (size[1] / 2) - 200;

  let win = new remote.BrowserWindow({
      parent: remote.getCurrentWindow(),
      ////frame: false,
      modal: true,
      width: 340,
      height:150,
      resizable: false,
      x: xPos,
      y: yPos,
      show: false
  });

  var theUrl = 'file://' + __dirname + '/rename.html'
  console.log('url', theUrl);

  win.loadURL(theUrl);
  win.webContents.openDevTools();
  win.setMenuBarVisibility(false);

  win.webContents.on('did-finish-load', () => {
      win.webContents.send('data', oldName);
  });
  
  win.once('ready-to-show', () => {
      win.show();
  });

};


// Remove doc
function removeDoc(docFullPath){
  // Display warning confirmation dialog to remove doc.
}

// Update docs

// Add doc
function addDocLocation(parentDoc, docName, callback){
  var docFullName = parentDoc == "" ? docName : parentDoc + "/" + docName;
  // Make sure the document name is unique.
  var docNewName;
  getUniqueDocName(docFullName, (docNewName)=>{
    // Add the document name to the database.
    var connection = mysql.createConnection(_settings);
    connection.connect(function (err) {
      if (err) throw err;
      var sql = "INSERT INTO Docs (DocName, DocLocation, DocColor, DocText, LastModified) VALUES (";
      sql += "'New Page', ";
      sql += "'" + docNewName + "', ";
      sql += "-1, ";
      sql += "'', ";
      sql += "'" + getMySQLNow() + "')";
      console.log("Executing SQL query = " + sql);

      connection.query(sql, function (err, result) {
        if (err) throw err;
        if (callback) callback(err, result);
        connection.end();
      });
      dvDocuments.addTVItem(lstDocuments, docNewName, false);
      selectDocument(docNewName);
    });
  });
}

function docNameExists(docFullName, callback){
  return new Promise(function(resolve, reject){
    var retValue = docFullName;
    var connection = mysql.createConnection(_settings);
    connection.connect();
    connection.query(
      "SELECT DocLocation from Docs WHERE DocLocation = '" + docFullName + "'",
      function (err, rows, fields) {
        if (err){
          reject(new Error("DB error occurred!"));
        }
        else{
          console.log("Rows found = " + rows.length);
          console.log("Returning = " + (rows.length > 0));
          retValue = rows.length > 0;
          if (callback) callback(retValue);
          resolve(retValue);
        }
        connection.end();
      }
    );
  });
}

async function getUniqueDocName(docFullName, callback){
  var fileNameIndex = 0;
  var docReturnName = docFullName;
  console.log("looking for name " + docFullName);
  var nameFound = await docNameExists(docFullName);
  console.log("looping");
  while (nameFound){
    console.log("incrementing name");
    fileNameIndex += 1;
    docReturnName = docFullName + "(" + fileNameIndex + ")";
    console.log("searching for " + docReturnName);
    nameFound = await docNameExists(docReturnName);
  }
  if (callback){
    callback(docReturnName);
  }
  return docReturnName;
}

// Load pages
function emptyDiv(divById){
  document.getElementById(divById).innerHTML = "";
}

function addItemtoDiv(divById, itemInnerText, classAdd){
  var newItem = document.createElement("div");
  newItem.innerText = itemInnerText;
  var classes = classAdd.split(" ");
  for (var i=0; i<classes.length;i++){
    newItem.classList.add(classes[i]);
  }
  document.getElementById(divById).appendChild(newItem);
}

async function loadPages(docFullName, callback){
  var data = await getPages(docFullName);
  emptyDiv("lstDocs");
  for (var i=0; i<data.length;i++){
    addItemtoDiv("lstDocs", data[i].DocName, "btn srchResultItem");
  }
}

function getPages(docFullName, callback){
  return new Promise(function(resolve, reject){
    var connection = mysql.createConnection(_settings);
      connection.connect();
      connection.query(
        "SELECT DocName from Docs WHERE DocLocation = '" + docFullName + "'",
        function (err, rows, fields) {
          if (err){
            reject(new Error("DB error occurred!"));
          }
          else{
            
            retValue = rows;
            if (callback) callback(retValue);
            resolve(rows);
          }
          connection.end();
        }
      );
  });
}
// Update pages

// Add page



// Delete page

// Rename page

// Cut page

// Paste page

// #endregion DOCS CODE

// #region SQL HELPER FUNCTIONS
function formatDateSqlite(date) {
  var d = new Date(date),
      month = '' + (d.getMonth() + 1),
      day = '' + d.getDate(),
      year = d.getFullYear();

  if (month.length < 2) 
      month = '0' + month;
  if (day.length < 2) 
      day = '0' + day;

  return [year, month, day].join('-');
}

function sqlSafeText(unSafeText) {
  var safe;
  if (unSafeText) {
    //safe = unSafeText;
    safe = unSafeText.replace(/'/g, "''");
    //safe = safe.replace("""", "''''");
  }
  return safe;
}

function getMySQLNow() {
  // gets the current date and time in MyQL format.
  var today = new Date();
  return (
    today.getFullYear() +
    "-" +
    twoDigits(1 + today.getMonth()) +
    "-" +
    twoDigits(today.getDate()) +
    " " +
    twoDigits(today.getHours()) +
    ":" +
    twoDigits(today.getMinutes()) +
    ":" +
    twoDigits(today.getSeconds())
  );
}

function getNow() {
  // gets the current date and time in MySQL format.
  var today = new Date();
  return (
    twoDigits(1 + today.getMonth()) +
    "/" +
    twoDigits(today.getDate() + "/" + today.getFullYear())
  );
}

function twoDigits(d) {
  if (d.length >= 2) return d;
  if (0 <= d && d < 10) return "0" + d.toString();
  if (-10 < d && d < 0) return "-0" + (-1 * d).toString();
  return d.toString();
}

function getSelectedDate() {
  //return monthDisplayed + '/' + daySelected + '/' + yearDisplayed;
  return yearDisplayed + "-" + monthDisplayed + "-" + daySelected;
}

/// Create SQL table.
function execSqlQuery(_settings, query, callback) {
  var connection = mysql.createConnection(_settings);
  connection.connect(function (err) {
    if (err) throw err;
    console.log("Executing SQL query = " + query);

    connection.query(query, function (err, result) {
      if (err) throw err;
      if (callback) callback(err);
    });
  });
}

// #endregion SQL HELPER FUNCTIONS

// #region SEARCH CODE

function searchNotes(srchText, callback) {
  var searchWords, word, where, first, noteDate;

  // Build the where clause from the individual search words.
  searchWords = srchText.split(" ");
  first = true;
  for (var i = 0; i <= searchWords.length; i++) {
    word = searchWords[i];
    if (word) {
      if (first) {
        where = " WHERE UPPER(NoteText) LIKE '%" + word.toUpperCase() + "%'";
        first = false;
      } else {
        where += " AND UPPER(NoteText) LIKE '%" + word.toUpperCase() + "%'";
      }
    }
  }

  var processRows = function (err, rows){
    if (!err) {
      if (rows.length > 0) {
        console.log("Search results found = " + rows.length);
        console.log(rows);
        for (var irec = 0; irec < rows.length; irec++) {
          addSearchResultItem(rows[irec].srchDate);
        }
      } else {
        alert("Nothing found containing search items.");
      }
    } else {
      console.log("Error while performing Query.");
      console.log(err);
      alert("Error executing search query.");
    }
  }

  if (_settings.dbType == "MySql"){
    var sql =
    "SELECT DATE_FORMAT(NoteDate, '%m/%d/%Y') as srchDate FROM Notes " +
    where +
    " ORDER BY NoteDate DESC";
    getRowsMySql(sql, processRows);
  } else {
    var sql = 
    "SELECT NoteDate, strftime('%m/%d/%Y', NoteDate) as srchDate FROM Notes " +
    where +
    " ORDER BY NoteDate DESC";
    getRowsSqlite(sql, processRows);
  }
  if (callback) callback();
}

function unselectButton() {
  document.getElementById("btnTasks").classList.remove("tabSelected");
  document.getElementById("btnSearch").classList.remove("tabSelected");
  document.getElementById("btnDocs").classList.remove("tabSelected");
  document.getElementById("divTasks").classList.add("hide");
  document.getElementById("divSearch").classList.add("hide");
  document.getElementById("divDocs").classList.add("hide");
}

function searchSelected() {
  unselectButton();
  document.getElementById("btnSearch").classList.add("tabSelected");
  document.getElementById("divSearch").classList.remove("hide");
}

function tasksSelected() {
  unselectButton();
  document.getElementById("btnTasks").classList.add("tabSelected");
  document.getElementById("divTasks").classList.remove("hide");
}

function docsSelected() {
  unselectButton();
  document.getElementById("btnDocs").classList.add("tabSelected");
  document.getElementById("divDocs").classList.remove("hide");

}

function clearSearchResults(callback) {
  var listResults = document.getElementById("lstSearch");
  listResults.innerHTML = "";
  if (callback) callbakc();
}

function addSearchResultItem(srchDate) {
  var listResults = document.getElementById("lstSearch");
  var element = document.createElement("div");
  //element.type = "button";
  element.innerHTML = srchDate;
  element.value = srchDate;
  element.className = "srchResultItem btn";
  element.setAttribute("onclick", "gotoDate('" + srchDate + "')");
  element.setAttribute("onmouseover", "showSearchPreview('" + srchDate + "')");
  element.setAttribute("onmouseout", "hideSearchPreview()");
  //element.addEventListener('click', srchItemClick(srchDate));
  listResults.appendChild(element);
}

function convertMySQLDate(dateForDay) {
  var dateParts = dateForDay.split("/");
  var mm = dateParts[0];
  var dd = dateParts[1];
  var yy = dateParts[2];

  return yy + "-" + mm + "-" + dd;
}

function highlightWords(words, content, markD) {
  var newContent = content;
  for (var i = 0; i < words.length; i++) {
    var pattern = new RegExp(words[i], "gi");
    newContent = newContent.replace(
      pattern,
      "<span><mark>$&</mark></span>"
    );
  }
  if (!markD) {
    newContent = "<div>" + newContent.replace(
      /(\r\n|\n|\r)/g,
      "</div><div>"
    );
    // Add a paragraph break for each empty div.
    newContent = newContent.replaceAll(
      "<div></div>",
      "<div><br/></div>"
    );
    // Get rid of ther last <div>.
    if (newContent.substring(newContent.length - 5, newContent.length) == "<div>"){
      newContent = newContent.slice(0, -5);
    }
  }

  return newContent;
}

function getNotePreview(dateForDay, callback) {
  var txtSearchPreview = document.getElementById("txtSearchPreview");
  var markD = false;

  var processRows = function (err, rows) {
    if (!err) {
      if (rows.length > 0) {
        console.log("getNotes rows returned = " + rows.length);
        var previewText = rows[0].NoteText;
        if (document.getElementById("btnViewMD").classList.contains("btnSelected")) {
          console.log("db notesText = " + previewText);
          previewText = marked(previewText);
          markD = true;
        }
        var searchText = document.getElementById("txtSearch").value;
        var searchWords = searchText.split(" ");
        var previewTextHighlighted = highlightWords(searchWords, previewText, markD);
        txtSearchPreview.innerHTML = previewTextHighlighted;
      } else {
        txtSearchPreview.innerText = dateForDay;
      }
    } else {
      console.log("Error while performing Query, " + sqlQuery);
      console.log(_settings);
    }
  }
  
  var sql =
    "SELECT * from Notes where NoteDate = '" +
    convertMySQLDate(dateForDay) +
    "'";
  var sqlite =
    "SELECT * from Notes where NoteDate = '" +
    formatDateSqlite(dateForDay) +
    "'";
  console.log(sql);
  if (_settings.dbType == "MySql"){
    getRowsMySql(sql, processRows);
  }
  else {
    getRowsSqlite(sqlite, processRows);
  }
  if (callback) callback();
}

String.prototype.replaceAll = function (search, replacement) {
  var target = this;
  return target.replace(new RegExp(search, 'g'), replacement);
};

function showSearchPreview(srchDate) {
  getNotePreview(srchDate, function () {
    document.getElementById("txtNotesArea").classList.add("hide");
    document.getElementById("txtView").classList.add("hide");
    document.getElementById("txtSearchPreview").classList.remove("hide");
  });
}

function hideSearchPreview() {
  document.getElementById("txtSearchPreview").classList.add("hide");
  if (document.getElementById("btnViewMD").classList.contains("btnSelected")) {
    document.getElementById("txtView").classList.remove("hide");
  } else {
    document.getElementById("txtNotesArea").classList.remove("hide");
  }
}

function gotoDate(selDate) {
  var dateParts = selDate.split("/");
  var mm = dateParts[0];
  var dd = dateParts[1];
  var yy = dateParts[2];

  calChangeDate(mm, yy, function () {
    dateSelected(dd);
  });
}
// #endregion SEARCH CODE

// #region SETTINGS CODE

/// Save settings to the .settings file.
function getSettingsfromDialog() {
  var el = document.getElementById("selThemes");
  var settings = {
    host: document.getElementById("txtHost").value,
    user: document.getElementById("txtUsername").value,
    password: document.getElementById("txtPassword").value,
    database: document.getElementById("txtDatabase").value,
    port: document.getElementById("txtPort").value,
    themeIndex: el.options[el.selectedIndex].value,
    documents: document.getElementById("chkDocuments").checked,
    dbType: (document.getElementById("optSqlite").checked) ? "Sqlite" : "MySql"
  };
  return settings;
}

/// Test the connection to the database using the settings entered into the dialog box.
function testDBConnection() {
  var settings = getSettingsfromDialog();
  var connection = mysql.createConnection(settings);
  connection.connect(function (err) {
    if (err) {
      alert("Database connection failed.");
    } else {
      alert("Database connection successful.");
    }
  });
}

function createNotesDB(callback) {
  return new Promise(function(resolve, reject){
    var settings = getSettingsfromDialog();
    var createDBSql = "CREATE SCHEMA `" + settings.database + "` ;";
    execSqlQuery(settings, createDBSql, function (err) {
      if (!err){
        resolve();
      }
      else {
        reject(err);
      }
      if (callback) callback(err);
    });
  });
}

/// Create Calendar Notes DB Tables
function createNotesDBTables(callback) {
  var createNotesTable = "CREATE TABLE `Notes` (";
  createNotesTable += "`ID` int(10) unsigned NOT NULL AUTO_INCREMENT,";
  createNotesTable += "`NoteDate` date NOT NULL,";
  createNotesTable += "`NoteText` varchar(10000) DEFAULT NULL,";
  createNotesTable += "`LastModified` datetime NOT NULL,";
  createNotesTable += "PRIMARY KEY (`ID`),";
  createNotesTable += "UNIQUE KEY `ID_UNIQUE` (`ID`)";
  createNotesTable +=
    ") ENGINE=InnoDB AUTO_INCREMENT=939 DEFAULT CHARSET=latin1;";

  var createTasksTable = "CREATE TABLE `TasksList` (";
  createTasksTable += "`ID` int(10) unsigned NOT NULL AUTO_INCREMENT,";
  createTasksTable += "`TasksList` varchar(10000) DEFAULT NULL,";
  createTasksTable += "PRIMARY KEY (`ID`),";
  createTasksTable += "UNIQUE KEY `ID_UNIQUE` (`ID`)";
  createTasksTable +=
    ") ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=latin1;";
  var settings = getSettingsfromDialog();

  execSqlQuery(settings, createNotesTable, function (err) {
    execSqlQuery(settings, createTasksTable, function (err) {
      if (callback) callback(err);
    });
  });
}

function initSettingsIcon() {
  console.log("Themeindex = " + selectedTheme);
  console.log(
    "invertSettingsIcon = " + themes[selectedTheme].invertSettingsIcon
  );
  if (themes[selectedTheme].invertSettingsIcon == "true") {
    document
      .getElementById("btnSettings")
      .setAttribute("src", "settingsIconBlk.png");
  } else {
    document
      .getElementById("btnSettings")
      .setAttribute("src", "settingsIconWht.png");
  }
}

function toggleSettingsBox() {
  if (!settingsShown) {
    document.getElementById("settingsSlider").classList.remove("hide");
    $("#settingsSlider").animate({
      right: "5px"
    });
    settingsShown = true;
  } else {
    $("#settingsSlider").animate({
      right: "-200px"
    }, 500, () => {
      document.getElementById("settingsSlider").classList.add("hide");
    });
    settingsShown = false;
  }
}

function updateDBSelection(elSelected){
  (elSelected == "optSqlite") ? document.getElementById("optMySql").checked = false : document.getElementById("optSqlite").checked = false
  var optSqlite = document.getElementById("optSqlite");
  var mySqlEls = document.querySelectorAll("tr[db='mysql']");
  for (var el of mySqlEls){
    (optSqlite.checked) ? el.classList.add("hide") : el.classList.remove("hide");
  }
}

// #endregion SETTINGS CODE

// #region RESIZE SIDE BARS
var startX, startWidth;
var leftDiv = document.getElementById("leftSideBar");
var rightDiv = document.getElementById("docsSideBar");
var dragTargetDiv;

function initVDrag(e) {
  startX = e.clientX;
  console.log("Initializing resize drag....");
  console.log(e.target.id);
  dragTargetDiv = e.target.id == "vSplitter" ? leftDiv : rightDiv;
  startWidth = parseInt(document.defaultView.getComputedStyle(dragTargetDiv).width, 10);
  document.documentElement.addEventListener('mousemove', doVDrag, false);
  document.documentElement.addEventListener('mouseup', stopVDrag, false);
}

function doVDrag(e) {
  if (dragTargetDiv === leftDiv) {
    leftDiv.style.width = (startWidth + e.clientX - startX) + 'px';
  } else {
    rightDiv.style.width = (startWidth + startX - e.clientX) + 'px';
  }
}

function stopVDrag(e) {
  document.documentElement.removeEventListener('mousemove', doVDrag, false);
  document.documentElement.removeEventListener('mouseup', stopVDrag, false);
  // Save the new size to the settings file.
  saveWidths();
}

function saveWidths(){
  if (dragTargetDiv === leftDiv) {
    appSettings.setSettingInFile("leftSideBarWidth", leftDiv.style.width);
  } else {
    appSettings.setSettingInFile("docsSideBarWidth", rightDiv.style.width);
  }
}

// #endregion RESIZE SIDE BARS

// #region HELPER FUNCTIONS

function ShowOKMessageBox(message) {
  const options = {
    type: "info",
    title: "Information",
    buttons: ["OK"],
    message: message,
  };

  dialog.showMessageBox(null, options);
}

function ShowWarningMessageBox(message) {
  const options = {
    type: "warning",
    title: "Warning",
    buttons: ["OK"],
    message: message,
  };

  dialog.showMessageBox(null, options);
}

// #endregion HELPER FUNCTIONS

// #region DOCUMENT EVENT HANDLERS
document.getElementById("btnNow").addEventListener("click", function () {
  gotoDate(getNow());
});

document.getElementById("btnSave").addEventListener("click", function () {
  saveNotes(lastDaySelected, document.getElementById("txtNotes").value);
  saveTasks(document.getElementById("txtTasks").value);
  //initWidths();
});

document.getElementById("btnRevert").addEventListener("click", function () {
  getNotes(getSelectedDate());
  getTasks();
});

document.getElementById("btnSearch").addEventListener("click", function () {
  docsViewUnselected();
  searchSelected();
});

document.getElementById("btnTasks").addEventListener("click", function () {
  docsViewUnselected();
  tasksSelected();
});

document.getElementById("btnDocs").addEventListener("click", function () {
  docsViewSelected();
  docsSelected();
});

document.getElementById("btnGo").addEventListener("click", function () {
  //addSearchResultItem("Test");
  var searchText = document.getElementById("txtSearch").value;
  console.log("Searching for " + searchText);
  clearSearchResults(searchNotes(searchText));
});

document.getElementById("btnHideLeft").addEventListener("click", function () {
  var leftSideBar = document.getElementById("leftSideBar");
  var btnHideLeft = document.getElementById("btnHideLeft");
  var txtNotesTitle = document.getElementById("txtNotesTitle");
  if (btnHideLeft.classList.contains("div_arrow_collapse")) {
    btnHideLeft.classList.remove("div_arrow_collapse");
    btnHideLeft.classList.add("div_arrow_expand");
    leftSideBar.classList.add("hide");
    txtNotesTitle.innerText = "NOTES - " + monthDisplayed + "/" + daySelected + "/" + yearDisplayed;
  } else {
    btnHideLeft.classList.add("div_arrow_collapse");
    btnHideLeft.classList.remove("div_arrow_expand");
    leftSideBar.classList.remove("hide");
    txtNotesTitle.innerText = "NOTES";
  }
});

document.getElementById("optSqlite").addEventListener("change", (e) =>{
  updateDBSelection(e.target.id);
});

document.getElementById("optMySql").addEventListener("change", (e) =>{
  updateDBSelection(e.target.id);
});

// Callback from each td representing each day in the calendar.
// OnClick events are html embedded and generated during the createCal function.
async function dateSelected(dayNum) {
  if (blockInterface == true) return;
  blockInterface = true;
  if (dayNum == null) return;
  var strDayNum = dayNum + "";
  var selDate = strDayNum.split("-");
  if (selDate.length == 3) {
    console.log("Day from date = " + selDate[2]);
    dayNum = twoDigits(selDate[2]);
  }

  dayNum = twoDigits(dayNum);
  console.log("dateSelected called with day = " + dayNum);
  var dayClicked = document.getElementById("day" + dayNum);
  dayClicked.classList.add("dateSelected");
  if (daySelected != dayNum) {
    //} && (!initialLoad)){
    var lastDayClicked = document.getElementById("day" + daySelected);
    if (lastDayClicked){
      lastDayClicked.classList.remove("dateSelected");
    }
  }

  daySelected = dayNum;
  console.log(getSelectedDate());
  // Save the notes for the last selected date.
  if (lastDaySelected != getSelectedDate() && !initialLoad) {
    await saveNotes(lastDaySelected, document.getElementById("txtNotes").value);
    await saveTasks(document.getElementById("txtTasks").value);
  }
  console.log("3 getNotes.");
  await getNotes(getSelectedDate());
  blockInterface = false;
  getTasks();
  lastDaySelected = getSelectedDate();
  
  initialLoad = false;
}

document
  .getElementById("btnSettings")
  .addEventListener("mouseenter", function () {
    console.log("Themeindex = " + selectedTheme);
    console.log(
      "invertSettingsIcon = " + themes[selectedTheme].invertSettingsIcon
    );
    if (themes[selectedTheme].invertSettingsIcon == "false") {
      document
        .getElementById("btnSettings")
        .setAttribute("src", "settingsIconBlk.png");
    } else {
      document
        .getElementById("btnSettings")
        .setAttribute("src", "settingsIconWht.png");
    }
  });

document
  .getElementById("btnSettings")
  .addEventListener("mouseleave", function () {
    initSettingsIcon();
  });

document.getElementById("btnSettings").addEventListener("click", function () {
  toggleSettingsBox();
});

document
  .getElementById("btnSettingsClose")
  .addEventListener("click", function () {
    _settings = getSettingsfromDialog();
    _settings.documents ? document.getElementById("btnDocs").classList.remove("hide") 
      : document.getElementById("btnDocs").classList.add("hide");
    appSettings.setSettingsInFile(_settings, (err) => {
      if (!err) {
        dateSelected(lastDaySelected);
      }
      else{
        console.log("Error saving settings file.");
      }
    });

    $("#settingsSlider").animate({
      right: "-200px"
    });
    document.getElementById("settingsSlider").classList.add("hide");
    
    settingsShown = false;
  });

document
  .getElementById("btnTestConnection")
  .addEventListener("click", function () {
    testDBConnection();
  });

document
  .getElementById("btnCreateTables")
  .addEventListener("click", function () {
    createNotesDBTables(function (err) {
      if (!err) {
        alert("Tables created.");
      } else {
        alert("Table creation failed.");
      }
    });
  });

document
  .getElementById("btnCreateDB")
  .addEventListener("click", function () {
    createNotesDB(function (err) {
      if (!err) {
        alert("Database created.");
      } else {
        alert("Database creation failed.");
      }
    });
  });

document.getElementById("selThemes").addEventListener("change", function () {
  var el = document.getElementById("selThemes");
  var themeIndex = el.options[el.selectedIndex].value;
  changeTheme(themeIndex);
});

document.getElementById("btnViewText").addEventListener("click", () => {
  notesViewSelected();
});

document.getElementById("btnViewMD").addEventListener("click", () => {
  mdViewSelected();
});

document.getElementById("txtNotes").addEventListener("input", () => {
  document.getElementById("btnSave").innerHTML = "*SAVE*";
});

document.getElementById("txtTasks").addEventListener("input", () => {
  document.getElementById("btnSave").innerHTML = "*SAVE*";
});

document.getElementById("txtDoc").addEventListener("input", () => {
  document.getElementById("btnSave").innerHTML = "*SAVE*";
});

document.getElementById("txtNotes").addEventListener("contextmenu", (e) => {
  console.log(e.clientX);
  var menu = document.querySelector(".notesMenu");
  menu.style.left = e.clientX + "px";
  menu.style.top = e.clientY + "px";
  menu.classList.remove("hide");
  console.log(menu);
});

// document.getElementById("btnHideMenu").addEventListener("click", (e)=>{
//   var menu = document.querySelector(".notesMenu");
//   menu.classList.add("hide");
// });

document.getElementById("btnInsertTable").addEventListener("click", (e) => {
  var tableTemplate = "| header1 | header2 | header3 |\n| --- | --- | --- |\n|  |  |  |";
  var cursorPos = $('#txtNotes').prop('selectionStart');
  console.log("txtNotes cursorposition = " + cursorPos);
  var v = $('#txtNotes').val();
  var textBefore = v.substring(0, cursorPos);
  var textAfter = v.substring(cursorPos, v.length);
  $('#txtNotes').val(textBefore + tableTemplate + textAfter);
  var menu = document.querySelector(".notesMenu");
  menu.classList.add("hide");
  document.getElementById("btnSave").innerHTML = "*SAVE*";
});

// Hide the contextmenu whenever any where on the document is clicked.
document.querySelector("body").addEventListener("click", () => {
  document.querySelector(".notesMenu").classList.add("hide");
  document.querySelector(".docsMenu").classList.add("hide");
});

// Intercept the tab key while in the txtNotes area.
document.querySelector("#txtNotes").addEventListener('keydown', function (e) {
  if (e.keyCode === 9) { // tab was pressed
    // get caret position/selection
    var start = this.selectionStart;
    var end = this.selectionEnd;

    var target = e.target;
    var value = target.value;

    // set textarea value to: text before caret + tab + text after caret
    target.value = value.substring(0, start) +
      "\t" +
      value.substring(end);

    // put caret at right position again (add one for the tab)
    this.selectionStart = this.selectionEnd = start + 1;

    // The notes have been changed.  Indicate this with the Save button stars.
    document.getElementById("btnSave").innerHTML = "*SAVE*";

    // prevent the focus lose
    e.preventDefault();
  }
}, false);

document.getElementById("vSplitter").addEventListener("mousedown", initVDrag, false);
document.getElementById("vSplitterDoc").addEventListener("mousedown", initVDrag, false);

// #region DOC CONTEXT MENU EVENT HANDLERS
document.getElementById("btnAddSubDoc").addEventListener("click", ()=>{
  addDocLocation(contextSelectedDoc,"New Document");
});

document.getElementById("btnRenameDoc").addEventListener("click", ()=>{
  renameDoc(contextSelectedDoc);
});

document.getElementById("btnRemoveDoc").addEventListener("click", ()=>{
  removeDoc(contextSelectedDoc);
});

// #endregion DOC CONTEXT MENU EVENT HANDLERS


// #endregion DOCUMENT EVENT HANDLERS