"use strict";

let app_documents = {

    //#region GLOBAL DECLARATIONS
    lstDocuments: {},
    dvDocuments: {},
    contextSelectedDoc: "",

    //#endregion GLOBAL DECLARATIONS

    //#region PAGE RENDER FUNCTIONS
    loadPages: function (docFullName, callback) {
        this.getPages(docFullName)
            .then((rows) => {
                emptyDiv("lstDocs");
                for (var i = 0; i < data.length; i++) {
                    addItemtoDiv("lstDocs", data[i].DocName, "btn srchResultItem");
                }
            })
            .catch((err) => {
                console.log(err);
            });
    },

    docContextMenu: function (el, fullPath) {
        contextSelectedDoc = fullPath;
        console.log(el.clientX);
        var menu = document.querySelector(".docsMenu");
        menu.style.left = el.clientX + "px";
        menu.style.top = el.clientY + "px";
        menu.classList.remove("hide");
        console.log(menu);
    },

    //#endregion PAGE RENDER FUNCTIONS

    //#region DATABASE FUNCTIONS
    getPagesMySQL: function (docFullName) {
        return new Promise(function (resolve, reject) {
            var connection = mysql.createConnection(_settings);
            connection.connect();
            connection.query(
                "SELECT DocName from Docs WHERE DocLocation = '" + docFullName + "'",
                function (err, rows, fields) {
                    if (err) {
                        reject(new Error("DB error occurred!"));
                    } else {
                        retValue = rows;
                        resolve(rows);
                    }
                    connection.end();
                }
            );
        });
    },

    getPagesSqlite: function (docFullName) {
        return new Promise(function (resolve, reject) {
            let db = new sqlite3.Database(dbFile, (err) => {
                if (!err) {
                    let sqlQuery = `
                        SELECT DocName 
                        FROM Docs 
                        WHERE DocLocation = '${docFullName}'
                    `;
                    db.all(sqlQuery, [], (err, rows) => {
                        if (!err) {
                            if (rows.length > 0) {
                                resolve(rows[0].NoteText);
                            } else {
                                resolve();
                            }
                        } else {
                            reject(err);
                        }
                        db.close();
                    });
                } else {
                    reject(err);
                    return;
                }
            });
        });
    },

    getUniqueDocNameMySQL: function (docFullName) {
        return new Promise(async (resolve, reject) => {
            var fileNameIndex = 0;
            var docReturnName = docFullName;
            console.log("looking for name " + docFullName);
            var nameFound = await docNameExists(docFullName);
            console.log("looping");
            while (nameFound) {
                console.log("incrementing name");
                fileNameIndex += 1;
                docReturnName = docFullName + "(" + fileNameIndex + ")";
                console.log("searching for " + docReturnName);
                nameFound = await this.docNameExists(docReturnName);
            }
            resolve(docReturnName);
            return docReturnName;
        });
    },

    getUniqueDocNameSqlite: function (docFullName) {
        return new Promise(async (resolve, reject) => {
            var fileNameIndex = 0;
            var docReturnName = docFullName;
            console.log("looking for name " + docFullName);
            var nameFound = await docNameExists(docFullName);
            console.log("looping");
            while (nameFound) {
                console.log("incrementing name");
                fileNameIndex += 1;
                docReturnName = docFullName + "(" + fileNameIndex + ")";
                console.log("searching for " + docReturnName);
                nameFound = await this.docNameExists(docReturnName);
            }
            resolve(docReturnName);
            return docReturnName;
        });
    },

    addDocLocationMySQL: function (parentDoc, docName) {
        return new Promise((resolve, reject) => {
            var docFullName = parentDoc == "" ? docName : parentDoc + "/" + docName;
            // Make sure the document name is unique.
            var docNewName;
            this.getUniqueDocName(docFullName)
                .then((docNewName) => {
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
                        this.dvDocuments.addTVItem(this.lstDocuments, docNewName, false);
                        this.selectDocument(docNewName);
                    });
                });
        });
    },
    //#endregion DATABASE FUNCTIONS


    //#region DATA RETRIEVAL FUNCTIONS
    getPages: function (docFullName) {
        return (_settings.dbType == "MySql") ?
            this.getPagesMySQL(docFullName) :
            this.getPagesSqlite(docFullName);
    },

    getUniqueDocName: function (docFullName) {
        return new Promise(async (resolve, reject) => {
            var fileNameIndex = 0;
            var docReturnName = docFullName;
            console.log("looking for name " + docFullName);
            var nameFound = await docNameExists(docFullName);
            console.log("looping");
            while (nameFound) {
                console.log("incrementing name");
                fileNameIndex += 1;
                docReturnName = docFullName + "(" + fileNameIndex + ")";
                console.log("searching for " + docReturnName);
                nameFound = await this.docNameExists(docReturnName);
            }
            resolve(docReturnName);
            return docReturnName;
        });
    },

    docNameExists: function (docFullName) {
        return new Promise(function (resolve, reject) {
            var retValue = docFullName;
            var connection = mysql.createConnection(_settings);
            connection.connect();
            connection.query(
                "SELECT DocLocation from Docs WHERE DocLocation = '" + docFullName + "'",
                function (err, rows, fields) {
                    if (err) {
                        reject(new Error("DB error occurred!"));
                    } else {
                        console.log("Rows found = " + rows.length);
                        console.log("Returning = " + (rows.length > 0));
                        retValue = rows.length > 0;
                        resolve(retValue);
                    }
                    connection.end();
                    return retValue;
                }
            );
        });
    },
    //#endregion DATA RETRIEVAL FUNCTIONS

    //#region DATA TRANSMITTAL FUNCTIONS
    addDocLocation: function (parentDoc, docName, callback) {
        var docFullName = parentDoc == "" ? docName : parentDoc + "/" + docName;
        // Make sure the document name is unique.
        var docNewName;
        this.getUniqueDocName(docFullName)
            .then((docNewName) => {
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
                    this.dvDocuments.addTVItem(this.lstDocuments, docNewName, false);
                    this.selectDocument(docNewName);
                });
            });
    },

    getUniqueDocName: function (docFullName) {
        return new Promise(async (resolve, reject) => {
            var fileNameIndex = 0;
            var docReturnName = docFullName;
            console.log("looking for name " + docFullName);
            var nameFound = await docNameExists(docFullName);
            console.log("looping");
            while (nameFound) {
                console.log("incrementing name");
                fileNameIndex += 1;
                docReturnName = docFullName + "(" + fileNameIndex + ")";
                console.log("searching for " + docReturnName);
                nameFound = await this.docNameExists(docReturnName);
            }
            resolve(docReturnName);
            return docReturnName;
        });
    },

    loadDocs: function () {
        // Load treeview with the documents.
        var connection = mysql.createConnection(_settings);
        connection.connect();
        connection.query(
            "SELECT DISTINCT DocLocation from Docs",
            function (err, data) {
                if (err) throw err;
                console.log(data);
                for (var i = 0; i < data.length; i++) {
                    this.dvDocuments.addTVItem(this.lstDocuments, data[i].DocLocation, false);
                }
                // Pick the first location.
                this.dvDocuments.selectFirstItem();
                connection.end();
            }
        );
    },
    //#endregion DATA TRANSMITTAL FUNCTIONS

    //#region DOCUMENT MANAGEMENT FUNCTIONS
    selectDocument: function (docName) {
        this.loadPages(docName);
    },
    //#endregion DOCUMENT MANAGEMENT FUNCTIONS

    //#region HELPER FUNCTIONS

    //#endregion HELPER FUNCTIONS

    //#region INITIALIZATION
    init: function () {
        this.lstDocuments = document.getElementById("lstDocuments");
        this.dvDocuments = new div_treeview(lstDocuments, "/");
        this.dvDocuments.onSelect(this.selectDocument);
        this.dvDocuments.onRightClick(this.docContextMenu);
    },
    //#endregion INITIALIZATION

}

app_documents.init();

//#region DOM EVENT HANDLERS
document.getElementById("btnAddDoc").addEventListener("click", () => {
    app_documents.addDocLocation("", "New Document");
});

//#endregion DON EVENT HANDLERS