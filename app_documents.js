"use strict";

var app_documents = {

    //#region GLOBAL DECLARATIONS
    lstDocuments: {},
    dvDocuments: {},
    txtRename: {},
    txtDoc: {},
    contextSelectedDoc: "",
    contextSelectedPage: "",
    renameTarget: {},
    //#endregion GLOBAL DECLARATIONS

    //#region PAGE RENDER FUNCTIONS
    loadPages: function (docFullName) {
        return new Promise((resolve, reject) => {
            console.log(docFullName);
            this.getPages(docFullName)
            .then((data) => {
                emptyDiv("lstDocs");
                console.log(data);
                if(data){
                    let firstPage = {};
                    for (var i = 0; i < data.length; i++) {
                        let pageBtnEl = addItemtoDiv("lstDocs", data[i].DocName, "btn srchResultItem", "data-grp=page");
                        pageBtnEl.addEventListener("click", (e)=>{
                            this.btnPage_Clicked(e.target);
                        });
                        pageBtnEl.addEventListener("contextmenu", (e)=>{
                            this.btnPage_RtClicked(e);
                        });
                        if (i == 0) firstPage = pageBtnEl;
                    }
                    this.selectPage(firstPage);
                    resolve();
                }
            })
            .catch((err) => {
                console.log(err);
                reject(err);
            });
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

    pageContextMenu: function (e) {
        let el = e.target;
        this.contextSelectedPage = el.innerHTML;
        console.log(e.clientX);
        var menu = document.querySelector(".pagesMenu");
        menu.style.left = e.clientX + "px";
        menu.style.top = e.clientY + "px";
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
        this.txtRename.focus();
        this.txtRename.select();
    },

    unselectPageButtons: function () {
        let pages = document.querySelectorAll("div[data-grp='page']");
        for (let el of pages){
            el.classList.remove("selected");
        }
    },

    selectPageButton: function (el) {
        this.unselectPageButtons();
        el.classList.add("selected");
    },

    showPageData: function (data) {
        this.txtDoc.value = (data) ? data : " ";
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

    addPageSqlite: function (path) {
        // Get a unique page name.
        let newPageName = this.getUniquePageName("New Page");
        // Add the document to the database.
        var sql = `
            INSERT INTO Docs 
            (DocName, DocLocation, DocColor, DocText, LastModified) 
            VALUES ('${newPageName}', '${path}',
            -1, '','${getMySQLNow()}')
        `;
        return this.execCommandSqlite(sql);
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

    docPageExistsMySQL: function(fullPath, pageName){
        // ::TODO::
    },

    docPageExistsSqlite: function(fullPath, pageName){
        return new Promise(function (resolve, reject) {
            let sql = `
                SELECT DocName
                FROM Docs 
                WHERE DocLocation = '${fullPath}'
                AND DocName =  '${pageName}';
            `;
            app_documents.execQuerySqlite(sql)
            .then((data)=>{
                let retValue = data.length > 0;
                resolve(retValue);
            })
            .catch((err)=>{
                console.log(err);
                reject(err);
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
        let sql = `
            SELECT DISTINCT DocLocation 
            FROM Docs
        `;
        return this.execQuerySqlite(sql);
    },

    updateDocNameSqlite: function (oldName, newName){
        var sql1 = `
            UPDATE Docs 
            SET DocLocation = REPLACE(DocLocation, '${oldName}', '${newName}')
            WHERE DocLocation LIKE '${oldName}';
        `;
        var sql2= `
            UPDATE Docs 
            SET DocLocation = '${newName}' || SUBSTR(DocLocation, LENGTH('${oldName}/'))
            WHERE INSTR(DocLocation, '${oldName}/') = 1;
        `;
        return Promise.all([this.execCommandSqlite(sql1), this.execCommandSqlite(sql2)])
        .catch((err)=>{
            console.log(err);
            ShowWarningMessageBox("Database command failure!");
        });
    },

    updatePageNameSqlite: function (fullPath, oldName, newName){
        var sql = `
            UPDATE DOCS
            SET DocName = '${newName}'
            WHERE DocLocation = '${fullPath}' 
            AND DocName = '${oldName}';
        `;
        return this.execCommandSqlite(sql);
    },

    deleteDocSqlite: function (fullPath){
        var sql1 = `
            DELETE FROM Docs 
            WHERE DocLocation = '${fullPath}';
        `;
        var sql2 = `
            DELETE FROM Docs 
            WHERE INSTR(DocLocation, '${fullPath}/') = 1;
        `;
        return Promise.all([this.execCommandSqlite(sql1), this.execCommandSqlite(sql2)])
        .catch((err)=>{
            console.log(err);
            ShowWarningMessageBox("Database command failure!");
        });
    },

    deletePageMySQL: function(fullPath, pageName){
        // ::TODO::
    },

    deletePageSqlite: function(fullPath, pageName){
        var sql = `
            DELETE FROM Docs 
            WHERE DocLocation = '${fullPath}'
            AND DocName = '${pageName}';
        `;
        return this.execCommandSqlite(sql)
        .catch((err)=>{
            console.log(err);
            ShowWarningMessageBox("Database command failure!");
        });
    },

    getPageNoteMySQL: function (fullPath, pageName){
        // ::TODO::
    },

    getPageNoteSqlite: function (fullPath, pageName){
        let sql = `
            SELECT DocText FROM DOCS
            WHERE DocLocation = '${fullPath}'
            AND DocName = '${pageName}';
        `;
        return this.execQuerySqlite(sql);
    },

    updatePageMySQL: function(fullPath, pageName, docText){

    },

    updatePageSqlite: function(fullPath, pageName, docText){
        let sql = `
            UPDATE DOCS
                SET DocText = '${sqlSafeText(docText)}',
                LastModified = '${getMySQLNow()}' 
            WHERE DocLocation = '${fullPath}'
            AND DocName = '${pageName}';
        `;
        return this.execCommandSqlite(sql);
    },

    execQuerySqlite: function (sql) {
        // Load treeview with the documents.
        return new Promise((resolve, reject)=>{
            let db = new sqlite3.Database(dbFile, (err) => {
                if (!err) {
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

    execCommandSqlite: function (sql){
        return new Promise((resolve, reject) => {
            // Add the document name to the database.
            let db = new sqlite3.Database(dbFile, (err) => {
                if (err) throw err;
                console.log("Executing SQL command = " + sql);
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

    getPageNote: function (docFullName, pageName){
        return (_settings.dbType == "MySql") ?
            this.getPageNoteMySQL(docFullName, pageName) :
            this.getPageNoteSqlite(docFullName, pageName);
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

    docPageExists: function (fullPath, pageName){
        return (_settings.dbType == "MySql") ?
            this.docPageExistsMySQL(fullPath, pageName) :
            this.docPageExistsSqlite(fullPath, pageName);
    },

    getDocs: function (){
        return (_settings.dbType == "MySql") ?
            this.getDocsMySQL() :
            this.getDocsSqlite();
    },

    loadDocs: function () {
        return new Promise((resolve, reject)=>{
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
                resolve();
            })
            .catch((err)=>{
                console.log(err);
                reject(err);
            });
        });
    },
    //#endregion DATA RETRIEVAL FUNCTIONS

    //#region DATA TRANSMITTAL FUNCTIONS
    addDocLocation: function (parentDoc, docName) {
        return (_settings.dbType == "MySql") ?
            this.addDocLocationMySQL(parentDoc, docName) :
            this.addDocLocationSqlite(parentDoc, docName);
    },

    addPage: function (path) {
        return (_settings.dbType == "MySql") ?
            this.addPageMySQL(path) :
            this.addPageSqlite(path);
    },

    addPage_Clicked: function(){
        let path = this.dvDocuments.getSelectedFullPath();
        console.log(path);
        this.addPage(path)
        .then(()=>{
            this.loadPages(path);
        });
    },

    updatePage: function(path, pageName, docText){
        return (_settings.dbType == "MySql") ?
            this.updatePageMySQL(path, pageName, docText) :
            this.updatePageSqlite(path, pageName, docText);
    },

    savePage: function(){
        let path = this.dvDocuments.getSelectedFullPath();
        let pageName = this.getSelectedPageName();
        let docText = this.txtDoc.value;
        this.updatePage(path, pageName, docText);
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

    getUniquePageName: function (pageName) {
        let pages = document.querySelectorAll("div[data-grp='page']");
        console.log(pages);
        let newPageName = pageName;
        let idx = 0;
        for (let el of pages){
            if (el.innerHTML == newPageName){
                idx += 1;
                newPageName = `${pageName} (${idx})`;
            }
        }
        return newPageName;
    },

    updateDocName: function (oldDocFullPath, newDocFullPath) {
        return this.updateDocNameSqlite(oldDocFullPath, newDocFullPath);
    },

    updatePageName: function (fullPath, oldName, newName) {
        return this.updatePageNameSqlite(fullPath, oldName, newName);
    },

    deleteDoc: function (fullPath){
        return this.deleteDocSqlite(fullPath);
    },

    deletePage: function (fullPath, pageName){
        return this.deletePageSqlite(fullPath, pageName);
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
        this.renameTarget = "document";
    },

    renamePage_Clicked: function (fullPath, pageName) {
        let el = this.getSelectedPageElement();
        this.showtxtRename(el);
        this.renameTarget = "page";
    },

    renamed: async function (){
        let newName = this.txtRename.value;
        if (this.renameTarget == "document"){
            let newFullPath = await this.renameDoc(newName);
            this.loadDocs()
            .then (()=>{
                this.dvDocuments.setSelectedPath(newFullPath);
            });
        }
        else{
            let fullPath = this.dvDocuments.getSelectedFullPath();
            let oldName = this.getSelectedPageName();
            let newPageName = await this.renamePage(fullPath, oldName, newName);
            this.loadPages(this.dvDocuments.getSelectedFullPath())
            .then(()=>{
                this.selectPageByName(newPageName);
            });
        }
        this.txtRename.classList.add("hide");
    },

    renameDoc: function(newName){
        return new Promise (async (resolve, reject) => {
            // Create the new full path.
            let fullPath = this.dvDocuments.getSelectedFullPath();
            let oldName = this.dvDocuments.getSelectedElement().innerText;
            let newFullPath = fullPath.replace(oldName, newName);
            console.log(newFullPath);
            // Make sure the new full path does not exist.

            let exists = await this.docNameExists(newFullPath);
            if (exists == true){
                ShowWarningMessageBox("Name already exists!");
                reject("Name already exists!");
            }
            else{
                await this.updateDocName(fullPath, newFullPath)
                .catch((err)=>{reject(err);});
                resolve(newFullPath);
                return newFullPath;
            }
        });
    },

    renamePage: function (fullPath, oldName, newName){
        return new Promise (async (resolve, reject) => {
            let exists = await this.docPageExists(fullPath, newName);
            if (exists == true){
                ShowWarningMessageBox("Name already exists!");
                reject("Name already exists!");
            }
            else{
                await this.updatePageName(fullPath, oldName, newName)
                .catch((err)=>{reject(err);});
                resolve(newName);
                return newName;
            }
        });
    },

    removeDoc_Clicked: function (docName) {
        if (showConfirmationBox("Are you sure?\nNote: Deleting this document deletes all children.")){
            this.deleteDoc(docName)
            .then(()=>{
                this.loadDocs();
            });
        }
    },

    removePage_Clicked: function (pageName) {
        if (showConfirmationBox("Are you sure?")){
            let fullPath = this.dvDocuments.getSelectedFullPath();
            this.deletePage(fullPath, pageName)
            .then(()=>{
                this.loadPages(this.dvDocuments.getSelectedFullPath());
            });
        }
    },

    selectPage: function(el){
        this.selectPageButton(el);
        let fullPath = this.dvDocuments.getSelectedFullPath();
        let pageName = el.innerHTML;
        this.getPageNote(fullPath, pageName)
        .then((data)=>{
            this.showPageData(data[0].DocText);
        })
        .catch((err)=>{
            console.log(err);
        })
    },

    selectPageByName: function(name){
        let pages = document.querySelectorAll("div[data-grp='page']");
        let elSelect = {};
        for (let el of pages){
            if (el.innerHTML == name){
                elSelect = el;
            }
        }
        this.selectPage(elSelect);
    },

    btnPage_Clicked: function (el) {
        this.selectPage(el);
    },

    btnPage_RtClicked: function (e) {
        this.pageContextMenu(e);
    },

    //#endregion DOCUMENT MANAGEMENT FUNCTIONS

    //#region HELPER FUNCTIONS
    getSelectedPageName: function(){
        let el = this.getSelectedPageElement();
        return el.innerHTML;
    },

    getSelectedPageElement: function(){
        return document.querySelector("#lstDocs .selected");
    },
    //#endregion HELPER FUNCTIONS

    //#region INITIALIZATION
    init: function () {
        this.lstDocuments = document.getElementById("lstDocuments");
        this.txtRename = document.getElementById("txtRename");
        this.txtDoc = document.getElementById("txtDoc");
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
    app_documents.addPage_Clicked();
});

document.getElementById("txtRename").addEventListener("keyup", (e) =>{
    if (e.key == "Enter"){
        app_documents.renamed();
    }
});

document.getElementById("txtRename").addEventListener("click", (e) =>{
    e.stopPropagation();
});

// #region DOC CONTEXT MENU EVENT HANDLERS
document.getElementById("btnAddSubDoc").addEventListener("click", ()=>{
    app_documents.addDocLocation(app_documents.contextSelectedDoc,"New Document");
});
  
document.getElementById("btnRenameDoc").addEventListener("click", (e)=>{
    app_documents.renameDoc_Clicked(app_documents.contextSelectedDoc);
    e.stopPropagation();
    document.querySelector(".docsMenu").classList.add("hide");
});

document.getElementById("btnRemoveDoc").addEventListener("click", (e)=>{
    app_documents.removeDoc_Clicked(app_documents.contextSelectedDoc);
});

document.getElementById("btnPageRenameDoc").addEventListener("click", (e)=>{
    app_documents.renamePage_Clicked(app_documents.contextSelectedPage);
    e.stopPropagation();
    document.querySelector(".pagesMenu").classList.add("hide");
});

document.getElementById("btnPageRemoveDoc").addEventListener("click", (e)=>{
    app_documents.removePage_Clicked(app_documents.contextSelectedPage);
});

// #endregion DOC CONTEXT MENU EVENT HANDLERS
  

//#endregion DOM EVENT HANDLERS