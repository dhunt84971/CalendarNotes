"use strict";

var app_documents = {

    //#region GLOBAL DECLARATIONS
    lstDocuments: {},
    dvDocuments: {},
    txtRename: {},
    contextSelectedDoc: "",
    renameTarget: {},
    //#endregion GLOBAL DECLARATIONS

    //#region PAGE RENDER FUNCTIONS
    loadPages: function (docFullName) {
        console.log(docFullName);
        this.getPages(docFullName)
            .then((data) => {
                emptyDiv("lstDocs");
                console.log(data);
                if(data){
                    for (var i = 0; i < data.length; i++) {
                        addItemtoDiv("lstDocs", data[i].DocName, "btn srchResultItem");
                    }
                }
            })
            .catch((err) => {
                console.log(err);
            });
    },

    docContextMenu: function (el, fullPath) {
        this.contextSelectedDoc = fullPath;
        console.log(el.clientX);
        var menu = document.querySelector(".docsMenu");
        menu.style.left = el.clientX + "px";
        menu.style.top = el.clientY + "px";
        menu.classList.remove("hide");
        console.log(menu);
    },

    showtxtRename: function (el) {
        console.log(el);
        var rect = el.getBoundingClientRect();
        console.log(rect);
        this.txtRename.style.left = rect.left + "px";
        this.txtRename.style.top = rect.top + "px";
        this.txtRename.style.width = rect.width + "px";
        this.txtRename.style.height = rect.height + "px";
        this.txtRename.value = el.innerText;
        this.txtRename.classList.remove("hide");
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
                                resolve(rows);
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

    addDocLocationMySQL: function (parentDoc, docName) {
        return new Promise((resolve, reject) => {
            var docFullName = parentDoc == "" ? docName : parentDoc + "/" + docName;
            // Make sure the document name is unique.
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
                            if (err) reject(err)
                            else resolve(result);
                            connection.end();
                        });
                        this.dvDocuments.addTVItem(this.lstDocuments, docNewName, false);
                        this.selectDocument(docNewName);
                    });
                });
        });
    },

    addDocLocationSqlite: function (parentDoc, docName) {
        return new Promise((resolve, reject) => {
            var docFullName = parentDoc == "" ? docName : parentDoc + "/" + docName;
            // Make sure the document name is unique.
            this.getUniqueDocName(docFullName)
                .then((docNewName) => {
                    // Add the document name to the database.
                    let db = new sqlite3.Database(dbFile, (err) => {
                        if (err) throw err;
                        var sql = `
                            INSERT INTO Docs 
                            (DocName, DocLocation, DocColor, DocText, LastModified) 
                            VALUES ('New Page', '${docNewName}',
                            -1, '','${getMySQLNow()}')
                        `;
                        console.log("Executing SQL query = " + sql);
                        db.run(sql, (err) => {
                            if (err) reject(err)
                            else resolve();
                        });
                        db.close();
                        this.dvDocuments.addTVItem(this.lstDocuments, docNewName, false);
                        this.selectDocument(docNewName);
                    });
                });
        });
    },

    addPageMySQL: function (parentDoc, docName) {
        return new Promise((resolve, reject) => {
            var docFullName = parentDoc == "" ? docName : parentDoc + "/" + docName;
            // Make sure the document name is unique.
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
                            if (err) reject(err)
                            else resolve(result);
                            connection.end();
                        });
                        this.dvDocuments.addTVItem(this.lstDocuments, docNewName, false);
                        this.selectDocument(docNewName);
                    });
                });
        });
    },

    addPageSqlite: function (docName) {
        return new Promise((resolve, reject) => {
            var docFullName = parentDoc == "" ? docName : parentDoc + "/" + docName;
            // Make sure the document name is unique.
            this.getUniqueDocName(docFullName)
                .then((docNewName) => {
                    // Add the document name to the database.
                    let db = new sqlite3.Database(dbFile, (err) => {
                        if (err) throw err;
                        var sql = `
                            INSERT INTO Docs 
                            (DocName, DocLocation, DocColor, DocText, LastModified) 
                            VALUES ('New Page', '${docNewName}',
                            -1, '','${getMySQLNow()}')
                        `;
                        console.log("Executing SQL query = " + sql);
                        db.run(sql, (err) => {
                            if (err) reject(err)
                            else resolve();
                        });
                        db.close();
                        this.dvDocuments.addTVItem(this.lstDocuments, docNewName, false);
                        this.selectDocument(docNewName);
                    });
                });
        });
    },

    docNameExistsMySQL: function (docFullName) {
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

    docNameExistsSqlite: function (docFullName) {
        return new Promise(function (resolve, reject) {
            var retValue = docFullName;
            let db = new sqlite3.Database(dbFile, (err) => {
                if (!err) {
                    let sql = `
                        SELECT DocLocation 
                        FROM Docs 
                        WHERE DocLocation = '${docFullName}'
                    `;
                    db.all(sql, [], (err, rows) => {
                        if (!err){
                            retValue = rows.length > 0;
                            resolve(retValue);
                        }
                        else{
                            reject(err);
                        }
                    });
                }
                else{
                    reject(err);
                }
                db.close();
                return;
            });
        });
    },

    getDocsMySQL: function () {
        return new Promise((resolve, reject)=>{
            var connection = mysql.createConnection(_settings);
            connection.connect();
            let sql = `
                SELECT DISTINCT DocLocation
                FROM Docs
            `;
            connection.query( sql, (err, data) => {
                if (err) reject(err);
                console.log(data);
                resolve(data);
                connection.end();
            });
        }); 
    },

    getDocsSqlite: function () {
        // Load treeview with the documents.
        return new Promise((resolve, reject)=>{
            let db = new sqlite3.Database(dbFile, (err) => {
                if (!err) {
                    let sql = `
                        SELECT DISTINCT DocLocation 
                        FROM Docs
                    `;
                    db.all(sql, [], (err, rows) => {
                        if (!err){
                            console.log(rows);
                            resolve(rows);
                        }
                        else{
                            reject(err);
                        }
                    });
                }
                else{
                    reject(err);
                }
                db.close();
                return;
            });
        });
    },

    updateDocNameSqlite: function (oldName, newName){
        return new Promise((resolve, reject) => {
            // Add the document name to the database.
            let db = new sqlite3.Database(dbFile, (err) => {
                if (err) throw err;
                var sql = `
                    UPDATE Docs 
                    SET DocLocation = REPLACE(DocLocation, '${oldName}', '${newName}')
                    WHERE DocLocation LIKE '${oldName}%'
                `;
                console.log("Executing SQL query = " + sql);
                db.run(sql, (err) => {
                    if (err) reject(err)
                    else resolve();
                });
                db.close();
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
            var nameFound = await this.docNameExists(docFullName);
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
        return (_settings.dbType == "MySql") ?
            this.docNameExistsMySQL(docFullName) :
            this.docNameExistsSqlite(docFullName);
    },

    getDocs: function (){
        return (_settings.dbType == "MySql") ?
            this.getDocsMySQL() :
            this.getDocsSqlite();
    },

    loadDocs: function () {
        emptyDiv("lstDocuments");
        this.getDocs()
        .then((data)=>{
            console.log(data);
            for (var i = 0; i < data.length; i++) {
                this.dvDocuments.addTVItem(this.lstDocuments, data[i].DocLocation, false);
            }
            data.length > 0 ? 
                document.getElementById("btnAddPage").classList.remove("hide") : 
                document.getElementById("btnAddPage").classList.add("hide");
            // Pick the first location.
            this.dvDocuments.selectFirstItem();
        })
        .catch((err)=>{
            console.log(err);
        });
    },
    //#endregion DATA RETRIEVAL FUNCTIONS

    //#region DATA TRANSMITTAL FUNCTIONS
    addDocLocation: function (parentDoc, docName) {
        return (_settings.dbType == "MySql") ?
            this.addDocLocationMySQL(parentDoc, docName) :
            this.addDocLocationSqlite(parentDoc, docName);
    },

    addPage: function (docName) {
        return (_settings.dbType == "MySql") ?
            this.addPageMySQL(parentDoc, docName) :
            this.addPageSqlite(parentDoc, docName);
    },

    getUniqueDocName: function (docFullName) {
        return new Promise(async (resolve, reject) => {
            var fileNameIndex = 0;
            var docReturnName = docFullName;
            console.log("looking for name " + docFullName);
            var nameFound = await this.docNameExists(docFullName);
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

    updateDocName: function (oldDocFullPath, newDocFullPath) {
        return this.updateDocNameSqlite(oldDocFullPath, newDocFullPath);
    },
    //#endregion DATA TRANSMITTAL FUNCTIONS

    //#region DOCUMENT MANAGEMENT FUNCTIONS
    selectDocument: function (docName) {
        console.log(`Document ${docName} selected.`);
        this.loadPages(docName);
    },

    renameDoc_Clicked: function (docName) {
        let el = this.dvDocuments.getSelectedElement();
        this.showtxtRename(el);
        this.renameTarget = function (newName) {return this.renameDoc(newName);}
    },

    renamed: function (){
        let newName = this.txtRename.value;
        this.renameTarget(newName)
        .then(()=>{
            this.txtRename.classList.add("hide");
            this.loadDocs();
        })
        .catch((err)=>{
            ShowWarningMessageBox(err);
        });
    },

    renameDoc: function(newName){
        return new Promise ((resolve, reject) => {
            // Create the new full path.
            let fullPath = this.dvDocuments.getSelectedFullPath();
            let oldName = this.dvDocuments.getSelectedElement().innerText;
            let newFullPath = fullPath.replace(oldName, newName);
            console.log(newFullPath);
            // Make sure the new full path does not exist.
            if (this.docNameExists(newFullPath) == true){
                ShowWarningMessageBox("Name already exists!");
                reject("Name already exists!");
            }
            else{
                this.updateDocName(fullPath, newFullPath)
                .then(()=>{resolve();});
            }
        });
    },

    //#endregion DOCUMENT MANAGEMENT FUNCTIONS

    //#region HELPER FUNCTIONS

    //#endregion HELPER FUNCTIONS

    //#region INITIALIZATION
    init: function () {
        this.lstDocuments = document.getElementById("lstDocuments");
        this.txtRename = document.getElementById("txtRename");
        this.dvDocuments = new div_treeview(this.lstDocuments, "/");
        this.dvDocuments.onSelect((text)=> {
            this.selectDocument(text);
        });
        this.dvDocuments.onRightClick((el, fullPath)=>{
            this.docContextMenu(el, fullPath)
        });
    },
    //#endregion INITIALIZATION

}

app_documents.init();

//#region DOM EVENT HANDLERS
document.getElementById("btnAddDoc").addEventListener("click", () => {
    app_documents.addDocLocation("", "New Document");
});

document.getElementById("btnAddPage").addEventListener("click", () => {
    app_documents.addPage("", "New Document");
});

document.getElementById("txtRename").addEventListener("keyup", (e) =>{
    if (e.key == "Enter"){
        app_documents.renamed();
    }
});

// #region DOC CONTEXT MENU EVENT HANDLERS
document.getElementById("btnAddSubDoc").addEventListener("click", ()=>{
    app_documents.addDocLocation(app_documents.contextSelectedDoc,"New Document");
});
  
document.getElementById("btnRenameDoc").addEventListener("click", (e)=>{
    app_documents.renameDoc_Clicked(app_documents.contextSelectedDoc);
});

document.getElementById("btnRemoveDoc").addEventListener("click", (e)=>{
    app_documents.removeDoc(app_documents.contextSelectedDoc);
});

// #endregion DOC CONTEXT MENU EVENT HANDLERS
  

//#endregion DOM EVENT HANDLERS