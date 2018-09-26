var mysql = require('mysql');
var fs = require('fs');

const settingsFile = "./.settings";

var monthDisplayed, daySelected, yearDisplayed;
var lastDaySelected;

// These are placeholders that will be written over when the settings
// are read from the settings file.
var dbConnection = { 
    host     : 'localhost',
    user     : 'calendaruser',
    password : 'calendaruser',
    database : 'CalendarNotesDB',
    port     : 3306
};

var calChangeDate;

// #region INITIALIZATION CODE
tasksSelected();

// #endregion INITIALIZATION CODE

// #region CALENDAR OBJECT CODE
var CALENDAR = function () {
	var wrap, label, 
			months = ["January", "February", "March", "April", "May", "June", "July","August", "September", "October", "November", "December"];

		function init(newWrap) {
			wrap  = $(newWrap || "#cal");
			label = wrap.find("#label");
				
			wrap.find("#prev").bind("click.calender", function () { switchMonth(false); });
			wrap.find("#next").bind("click.calender", function () { switchMonth(true); });
			label.bind("click.calendar", function () { switchMonth(null, new Date().getMonth(), new Date().getFullYear() ); });
            
            monthDisplayed = new Date().getMonth() + 1;
            daySelected = new Date().getDate();
            yearDisplayed = new Date().getFullYear();
            
            switchMonth(null, new Date().getMonth(), new Date().getFullYear() );
            lastDaySelected = getSelectedDate();
            
            console.log("MySQL Datetime  = " + getMySQLNow());

            // Load the settings from the file.
            loadSettingsfromFile(settingsFile, function(err, settings){

                if (!err){
                    // Load the settings entry fields.
                    document.getElementById("txtHost").value = settings.host;
                    document.getElementById("txtPort").value = settings.port;
                    document.getElementById("txtDatabase").value = settings.database;
                    document.getElementById("txtUsername").value = settings.user;
                    document.getElementById("txtPassword").value = settings.password;
                    console.log(settings);
                    dbConnection = settings;
                    dateSelected(daySelected);
                }
                else {
                    alert("Error getting settings.");
                    document.querySelector(".settingsBox").style.display="block";
                }
            });
            console.log("1" + document.querySelector(".curr").innerHTML);
            
        }
		
		function switchMonth(next, month, year) {
			var curr = label.text().trim().split(" "), calendar, tempYear = parseInt(curr[1], 10);

			month = month || ((next) ? ((curr[0] === "December") ? 0 : months.indexOf(curr[0]) + 1) : ( (curr[0] === "January") ? 11 : months.indexOf(curr[0]) - 1) );
			year  = year  || ((next && month === 0) ? tempYear + 1 : (!next && month === 11) ? tempYear -1 : tempYear);
				
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
					.fadeOut("slow", function () { $(this).remove(); });
			label.text(calendar.label);
            
            monthDisplayed = month + 1;
            yearDisplayed = year;
		}
    
        function changeDate(month, year, callback){
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
					.fadeOut("slow", function () { $(this).remove(); });
			label.text(calendar.label);
            
            monthDisplayed = month + 1;
            yearDisplayed = year;

            if (callback) callback();
        }
		
	function createCal(year, month) {
		var day = 1, i, j, haveDays = true, 
				startDay = new Date(year, month, day).getDay(),
				daysInMonth = [31, (((year%4===0)&&(year%100!==0))||(year%400===0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31 ],
				calendar = [];
		if (createCal.cache[year]) {
			if (createCal.cache[year][month]) {
				return createCal.cache[year][month];
			}
		} else {
			createCal.cache[year] = {};
		}
		i = 0;
		while(haveDays) {
			calendar[i] = [];
			for (j = 0; j < 7; j++) {
				if (i === 0) {
					if (j === startDay) {
						calendar[i][j] = day++;
						startDay++;
					}
				} else if ( day <= daysInMonth[month]) {
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
		for (i = 0; i < calendar.length; i++) {
            rowDays = "<tr>";
            for (var j = 0; j < calendar[i].length; j++){
                if (calendar[i][j]){
                    var day = twoDigits(calendar[i][j]);
                    rowDays += "<td id='day" + day + "' onclick='dateSelected(" + day + ")'>" + calendar[i][j] + "</td>";
                }
                else{
                    rowDays += "<td></td>";
                }
            }
            rowDays += "</tr>";
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
        
		createCal.cache[year][month] = { calendar : function () { return calendar.clone(); }, label : months[month] + " " + year };

		return createCal.cache[year][month];
	}
	createCal.cache = {};
    calChangeDate = changeDate;
    
	return {
		init : init,
		switchMonth : switchMonth,
		createCal : createCal
	};

};
// #endregion CALENDAR OBJECT CODE

// #region NOTES CODE
// Get the notes from the MySQL database.
function getNotes(dateForDay){
    
    var connection = mysql.createConnection(dbConnection);
    connection.connect();

    var sqlQuery = 'SELECT * from Notes where NoteDate = \'' + dateForDay + '\'';
    connection.query(sqlQuery, function(err, rows, fields) {
      if (!err){
          if (rows.length > 0){
            console.log("getNotes rows returned = " + rows.length);
            document.getElementById('txtNotes').value = rows[0].NoteText;
          }
          else{
            document.getElementById('txtNotes').value = " ";
          }
      }
      else{
        console.log('Error while performing Query, ' + sqlQuery);
        console.log(dbConnection);
      }
    });

    connection.end();
}

function saveNotes(dateForDay, notesText) {
    
    //var noteExists = sqlNoteExists(dateForDay);
    console.log("Saving notes = '" + notesText + "'");
    if (notesText == "") notesText = " ";
    
    sqlNoteExists(dateForDay, function(result) {
        if (result){
            updateNotes(dateForDay, notesText, null);   
        }
        else{
            insertNotes(dateForDay, notesText, null);
        }
    })
}

function updateNotes(dateForDay, notesText, callback) {
    
    var connection = mysql.createConnection(dbConnection);
    connection.connect(function(err) {
        if (err) throw err;
        var sql = "UPDATE Notes SET NoteText = '" + sqlSafeText(notesText) + "', ";
        sql += "LastModified = '" + getMySQLNow() + "' "
        sql += "WHERE NoteDate = '" + dateForDay + "'"
        console.log("Executing SQL query = " + sql);
        
        connection.query(sql, function (err, result) {
            if (err) throw err;
            console.log(result.affectedRows + " record(s) updated");
            if (callback) callback(err, result);
        });
    });
    
    //connection.end();
}

function insertNotes(dateForDay, notesText, callback) {
    
    var connection = mysql.createConnection(dbConnection);
    connection.connect(function(err) {
        if (err) throw err;
        var sql = "INSERT INTO Notes (NoteDate, NoteText, LastModified) VALUES (";
        sql += "'" + dateForDay + "', "    
        sql += "'" + sqlSafeText(notesText) + "', ";
        sql += "'" + getMySQLNow() + "')";
      console.log("Executing SQL query = " + sql);
        
        connection.query(sql, function (err, result) {
            if (err) throw err;
            if (callback) callback(err, result);
        });
    });
    
    //connection.end();
}

function sqlNoteExists(dateForDay, callback){
    var retValue = false;;
    var connection = mysql.createConnection(dbConnection);
    connection.connect();
    console.log("Searching for Note : " + "SELECT * from Notes where NoteDate = \'" + dateForDay + "\'");
    
    connection.query('SELECT * from Notes where NoteDate = \'' + dateForDay 
        + '\'', function(err, rows, fields) {
      if (!err){
          console.log("Rows found = " + rows.length);
          console.log("Returning = " + (rows.length > 0) );
          retValue = (rows.length > 0);
          if (callback) callback(retValue);
      }
    });

    connection.end();
    return retValue;
}

// #endregion NOTES CODE

// #region TASKS CODE
// Get the tasks from the MySQL database.
function getTasks(){
    
    var connection = mysql.createConnection(dbConnection);
    connection.connect();

    connection.query('SELECT * FROM TasksList LIMIT 1', function(err, rows, fields) {
      if (!err){
        console.log(rows);
        document.getElementById('txtTasks').value = rows[0].TasksList;
      }
      else{
        console.log('Error while performing Query.');
      }
    });

    connection.end();
}
function saveTasks(tasksText) {
    
    //var noteExists = sqlNoteExists(dateForDay);
    sqlTasksExists(function(result) {
        if (result){
            updateTasks(tasksText, null);   
        }
        else{
            insertTasks(tasksText, null);
        }
    })
}

function updateTasks(tasksText, callback) {
    
    var connection = mysql.createConnection(dbConnection);
    connection.connect(function(err) {
        if (err) throw err;
        var sql = "UPDATE TasksList SET TasksList = '" + sqlSafeText(tasksText) + "'";
        console.log("Executing SQL query = " + sql);
        
        connection.query(sql, function (err, result) {
            if (err) throw err;
            console.log(result.affectedRows + " record(s) updated");
            if (callback) callback(err, result);
        });
    });
    
    //connection.end();
}

function insertTasks(tasksText, callback) {
    
    var connection = mysql.createConnection(dbConnection);
    connection.connect(function(err) {
        if (err) throw err;
        var sql = "INSERT INTO TasksList (TasksList) VALUES (";
        sql += "'" + sqlSafeText(tasksText) + "')";
      console.log("Executing SQL query = " + sql);
        
        connection.query(sql, function (err, result) {
            if (err) throw err;
            if (callback) callback(err, result);
        });
    });
    
    //connection.end();
}

function sqlTasksExists(callback){
    var retValue = false;
    var connection = mysql.createConnection(dbConnection);
    connection.connect();
    console.log("Searching for Tasks : " + "SELECT * from TasksList");
    
    connection.query("SELECT * from TasksList", function(err, rows, fields) {
      if (!err){
          console.log("Rows found = " + rows.length);
          console.log("Returning = " + (rows.length > 0) );
          retValue = (rows.length > 0);
          if (callback) callback(retValue);
      }
    });

    connection.end();
    return retValue;
}

// #endregion TASKS CODE

// #region SQL HELPER FUNCTIONS
function sqlSafeText(unSafeText){
    var safe;
    if (unSafeText){
        safe = unSafeText;
        safe = unSafeText.replace("'", "''");
        //safe = safe.replace("""", "''''");
    }
    return safe;
}

function getMySQLNow() {
    // gets the current date and time in MyQL format.
    var today = new Date();
    return today.getFullYear() + "-" + twoDigits(1 + today.getMonth()) + "-" + twoDigits(today.getDate()) + " " + twoDigits(today.getHours()) + ":" + twoDigits(today.getMinutes()) + ":" + twoDigits(today.getSeconds());
}

function getNow() {
    // gets the current date and time in MyQL format.
    var today = new Date();
    return twoDigits(1 + today.getMonth()) + "/" + twoDigits(today.getDate() + "/" + today.getFullYear() );
}

function twoDigits(d) {
    if(0 <= d && d < 10) return "0" + d.toString();
    if(-10 < d && d < 0) return "-0" + (-1*d).toString();
    return d.toString();
}

function getSelectedDate() {
    //return monthDisplayed + '/' + daySelected + '/' + yearDisplayed;
    return yearDisplayed + '-' + monthDisplayed + '-' + daySelected;
}

/// Create SQL table.
function createSQLTable(dbConnection, query, callback){
    var connection = mysql.createConnection(dbConnection);
    connection.connect(function(err) {
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

function searchNotes(srchText){
    var sqlCommand, searchWords, word, where, first, noteDate;
    
    // Build the where clause from the individual search words.
    searchWords = srchText.split(" ");
    first = true;
    for (var i=0; i<=searchWords.length;i++){
        word = searchWords[i];
        if (word){
            if (first){
                where = " WHERE UPPER(NoteText) LIKE '%" + word.toUpperCase() + "%'";
                first = false;
            }
            else{
                where += " AND UPPER(NoteText) LIKE '%" + word.toUpperCase() + "%'";
            }
        }
    }
    sqlCommand = "SELECT DATE_FORMAT(NoteDate, '%m/%d/%Y') as srchDate FROM Notes " 
        + where + " ORDER BY NoteDate DESC";
    console.log("SQL = " + sqlCommand);

    var connection = mysql.createConnection(dbConnection);
    connection.connect();

    //connection.query('SELECT * from TasksList where ID = 1', function(err, rows, fields) {
    connection.query(sqlCommand, function(err, rows, fields) {
      if (!err){
          if (rows.length > 0){
            console.log("Search results found = " + rows.length);
            for (var irec=0;irec<=rows.length;irec++){
                addSearchResultItem(rows[irec].srchDate);
            }
          }
      }
      else{
        console.log('Error while performing Query.');
      }
    });

    connection.end();
}

function searchSelected() {
    document.querySelector(".search").style.display = "block";
    document.querySelector(".tasks").style.display = "none";
    document.getElementById("btnTasks").style.backgroundColor = "#fff";
    document.getElementById("btnSearch").style.backgroundColor = "yellow";
}

function tasksSelected() {
    document.querySelector(".tasks").style.display = "block";
    document.querySelector(".search").style.display = "none";
    document.getElementById("btnTasks").style.backgroundColor = "yellow";
    document.getElementById("btnSearch").style.backgroundColor = "#fff";
}

function addSearchResultItem(srchDate){
    var listResults = document.getElementById("lstSearch");
    var element = document.createElement("div");
    //element.type = "button";
    element.innerHTML = srchDate;
    element.value = srchDate;
    element.className = "srchResultItem btn";
    element.setAttribute("onclick", "gotoDate('"+ srchDate +"')");
    element.setAttribute("onmouseover", "showSearchPreview('" + srchDate + "')");
    element.setAttribute("onmouseout", "hideSearchPreview()");
    //element.addEventListener('click', srchItemClick(srchDate));
    listResults.appendChild(element);
};

function convertMySQLDate(dateForDay){
    var dateParts = dateForDay.split("/");
    var mm = dateParts[0];
    var dd = dateParts[1];
    var yy = dateParts[2];

    return yy + "-" + mm + "-" + dd;
}

function getNotePreview(dateForDay, callback){
    
    var txtSearchPreview = document.getElementById("txtSearchPreview");
    var connection = mysql.createConnection(dbConnection);
    connection.connect();

    var sqlQuery = 'SELECT * from Notes where NoteDate = \'' + convertMySQLDate(dateForDay) + '\'';
    console.log(sqlQuery);
    connection.query(sqlQuery, function(err, rows, fields) {
      if (!err){
          if (rows.length > 0){
            console.log("getNotes rows returned = " + rows.length);
            var previewText = rows[0].NoteText;
            var searchText = document.getElementById("txtSearch").value;
            previewText = previewText.replace(searchText, "<strong>" + searchText + "</strong>");
            previewText = previewText.replace(/(\r\n|\n|\r)/g,"<br />");
            txtSearchPreview.innerHTML = previewText;
          }
          else{
            txtSearchPreview.innerText = dateForDay;
          }
      }
      else{
        console.log('Error while performing Query, ' + sqlQuery);
        console.log(dbConnection);
      }
    });

    connection.end();

    if (callback) callback();
}

function showSearchPreview(srchDate){
    getNotePreview(srchDate, function(){
        var txtSearchPreview = document.getElementById("txtSearchPreview");
        txtSearchPreview.style.display = "block";
    });
};

function hideSearchPreview() {
    document.getElementById("txtSearchPreview").style.display = "none";
}

function gotoDate(selDate){
    var dateParts = selDate.split("/");
    var mm = dateParts[0];
    var dd = dateParts[1];
    var yy = dateParts[2];
    
    calChangeDate(mm, yy, function(){
        dateSelected(dd);
    });
    
};
// #endregion SEARCH CODE

// #region SETTINGS CODE

/// Save settings to the .settings file.
function saveSettingstoFile(settings, callback){
    var json = JSON.stringify(settings);
    fs.writeFile(settingsFile, json, "utf8", callback);
}

/// Load settings from the .settings file.
function loadSettingsfromFile(fName, callback){
    var settings;
    fs.readFile(fName, "utf8", function readFileCallback(err, data){
        if (err){
            console.log(err);
        } else {
            settings = JSON.parse(data); //now it an object
        }
        if (callback) callback(err, settings);
        return settings;
    });
}

function getSettingsfromDialog(){
    var settings = { 
        host     : document.getElementById("txtHost").value,
        user     : document.getElementById("txtUsername").value,
        password : document.getElementById("txtPassword").value,
        database : document.getElementById("txtDatabase").value,
        port     : document.getElementById("txtPort").value
    }
    return settings;
}

/// Test the connection to the database using the settings entered into the dialog box.
function testDBConnection(){
    var settings = getSettingsfromDialog();
    var connection = mysql.createConnection(settings);
    connection.connect(function(err){
        if (err){
            alert("Database connection failed.");
        }
        else
        {
            alert("Database connection successful.");
        }
    });
}

/// Create Calendar Notes DB Tables
function createNotesDBTables(callback){
    var createNotesTable = "CREATE TABLE `Notes` (";
    createNotesTable += "`ID` int(10) unsigned NOT NULL AUTO_INCREMENT,";
    createNotesTable += "`NoteDate` date NOT NULL,";
    createNotesTable += "`NoteText` varchar(10000) DEFAULT NULL,";
    createNotesTable += "`LastModified` datetime NOT NULL,";
    createNotesTable += "PRIMARY KEY (`ID`),";
    createNotesTable += "UNIQUE KEY `ID_UNIQUE` (`ID`)";
    createNotesTable += ") ENGINE=InnoDB AUTO_INCREMENT=939 DEFAULT CHARSET=latin1;";

    var createTasksTable = "CREATE TABLE `TasksList` (";
    createTasksTable += "`ID` int(10) unsigned NOT NULL AUTO_INCREMENT,";
    createTasksTable += "`TasksList` varchar(10000) DEFAULT NULL,";
    createTasksTable += "PRIMARY KEY (`ID`),";
    createTasksTable += "UNIQUE KEY `ID_UNIQUE` (`ID`)";
    createTasksTable += ") ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=latin1;";
    var settings = getSettingsfromDialog();

    createSQLTable(settings, createNotesTable, function(err){
        createSQLTable(settings, createTasksTable, function(err){
            if (callback) callback(err);
        });
    });

}

// #endregion SETTINGS CODE

// #region DOCUMENT EVENT HANDLERS
document.getElementById("btnNow").addEventListener('click', function(){
    gotoDate(getNow());
});

document.getElementById("btnSave").addEventListener('click', function(){
    saveNotes(lastDaySelected, document.getElementById('txtNotes').value);
    saveTasks(document.getElementById('txtTasks').value);
});

document.getElementById("btnRevert").addEventListener('click', function(){
    getNotes(getSelectedDate());
    getTasks();
});

document.getElementById("btnSearch").addEventListener('click', function(){
    searchSelected();
});

document.getElementById("btnTasks").addEventListener('click', function(){
    tasksSelected();
});

document.getElementById("btnGo").addEventListener('click', function(){
    //addSearchResultItem("Test");
    var searchText = document.getElementById("txtSearch").value;
    console.log("Searching for " + searchText);
    searchNotes(searchText);
});

// Callback from each td representing each day in the calendar.
// OnClick events are html embedded and generated during the createCal function.
function dateSelected(dayNum){
    if (dayNum == null) return;
    var strDayNum = dayNum + '';
    var selDate = strDayNum.split("-");
    if (selDate.length == 3){
        console.log("Day from date = " + selDate[2]);
        dayNum = twoDigits(selDate[2]);
    }

    //dayNum = twoDigits(dayNum);
    console.log('dateSelected called with day = ' + dayNum);
    var dayClicked = document.getElementById('day' + dayNum);
    dayClicked.style.background = '#cd310d';
    dayClicked.style.color = '#fff';
    if (daySelected != dayNum){
        var lastDayClicked = document.getElementById('day' + daySelected);
        lastDayClicked.style.background = null;
        lastDayClicked.style.color = null;
    }
    daySelected = dayNum;
    console.log(getSelectedDate());
    // Save the notes for the last selected date.
    if (lastDaySelected != getSelectedDate()){
        console.log("Saving notes - " + lastDaySelected);
        saveNotes(lastDaySelected, document.getElementById('txtNotes').value);
        saveTasks(document.getElementById('txtTasks').value);
    }
    getNotes(getSelectedDate());
    getTasks();
    lastDaySelected = getSelectedDate();
};

document.getElementById("btnSettings").addEventListener("mouseenter", function(){
    document.getElementById("btnSettings").setAttribute("src", "settingsIconBlk.png");
});

document.getElementById("btnSettings").addEventListener("mouseleave", function(){
    document.getElementById("btnSettings").setAttribute("src", "settingsIconWht.png");
});

document.getElementById("btnSettings").addEventListener("click", function(){
    document.querySelector(".settingsBox").style.display="block";
});

document.getElementById("btnSettingsClose").addEventListener("click", function(){
    dbConnection = getSettingsfromDialog();
    
    saveSettingstoFile(dbConnection, function(){
        document.querySelector(".settingsBox").style.display="none";
        dateSelected(lastDaySelected);
    });
});

document.getElementById("btnTestConnection").addEventListener("click", function(){
    testDBConnection();
});

document.getElementById("btnCreateTables").addEventListener("click", function(){
    createNotesDBTables(function(err){
        if (!err){
            alert("Tables created.");
        }
        else{
            alert("Table creation failed.");
        }
    });
});



// #endregion DOCUMENT EVENT HANDLERS

