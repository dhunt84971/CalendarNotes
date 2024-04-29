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
    lastFullPath: "",
    indentChange: 10,
    draggedPageEl: undefined,
    draggedDocEl: undefined,
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
                    if (data.length > 0){
                        let firstPage = {};
                        for (var i = 0; i < data.length; i++) {
                            let pageBtnEl = addItemtoDiv("lstDocs", data[i].DocName, "btn pageItem", "data-grp=page");
                            pageBtnEl.setAttribute("draggable", "true");
                            let marginL = data[i].DocIndentLevel * 10;
                            pageBtnEl.style.marginLeft = `${marginL}px`;
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
                    else{
                        resolve();
                    }
                }
                else{
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
        var menu = document.querySelector(".docsMenu");
        locateMenu(menu, el.clientX, el.clientY);
    },

    pageContextMenu: function (e) {
        let el = e.target;
        this.contextSelectedPage = el.innerHTML;
        var menu = document.querySelector(".pagesMenu");
        locateMenu(menu, e.clientX, e.clientY);
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
            el.classList.remove("pageSelected");
        }
    },

    selectPageButton: function (el) {
        this.unselectPageButtons();
        el.classList.add("pageSelected");
    },

    showPageData: function (data) {
        this.txtDoc.value = (data) ? data : " ";
        showPageMarkdown();
    },

    //#endregion PAGE RENDER FUNCTIONS

    //#region DATABASE FUNCTIONS
    getPagesMySQL: function (docFullName) {
        let sql = `
            SELECT DocName, DocIndentLevel
            FROM Docs 
            WHERE DocLocation = '${docFullName}'
            ORDER BY PageOrder ASC
        `;
        return this.execQueryMySQL(sql);
    },

    getPagesSqlite: function (docFullName) {
        let sql = `
            SELECT DocName, DocIndentLevel
            FROM Docs 
            WHERE DocLocation = '${docFullName}'
            ORDER BY PageOrder ASC
        `;
        return this.execQuerySqlite(sql);
    },

    addDocLocationMySQL: function (parentDoc, docName, docOrder) {
        return new Promise((resolve, reject) => {
            var docFullName = parentDoc == "" ? docName : parentDoc + "/" + docName;
            // Make sure the document name is unique.
            this.getUniqueDocName(docFullName)
                .then((docNewName) => {
                    // Add the document name to the database.
                    showWaitImage();
                    var connection = mysql.createConnection(_settings);
                    connection.connect(function (err) {
                        if (err) throw err;
                        var sql = `
                            INSERT INTO Docs 
                                (DocName, DocLocation, DocColor, DocText, LastModified, DocOrder, PageOrder) 
                                VALUES ('New Page', '${docNewName}',-1, '', '${getMySQLNow()}', ${docOrder}, 0)
                        `;
                        console.log("Executing SQL query = " + sql);
                        connection.query(sql, function (err, result) {
                            hideWaitImage();
                            if (err) reject(err)
                            else resolve(result);
                            connection.end();
                        });
                    });
                });
        });
    },

    addDocLocationSqlite: function (parentDoc, docName, docOrder) {
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
                                (DocName, DocLocation, DocColor, DocText, LastModified, DocOrder, PageOrder) 
                                VALUES ('New Page', '${docNewName}',-1, '', '${getMySQLNow()}', ${docOrder}, 0)
                        `;
                        console.log("Executing SQL query = " + sql);
                        db.run(sql, (err) => {
                            if (err) reject(err)
                            else resolve();
                        });
                        db.close();
                    });
                });
        });
    },

    addPageMySQL: function (path, docOrder, pageOrder) {
        // Get a unique page name.
        let newPageName = this.getUniquePageName("New Page");
        // Add the document to the database.
        var sql = `
            INSERT INTO Docs 
            (DocName, DocLocation, DocColor, DocText, LastModified, DocOrder, PageOrder) 
            VALUES ('${newPageName}', '${path}',
            -1, '','${getMySQLNow()}', ${docOrder}, ${pageOrder})
        `;
        return this.execCommandMySQL(sql);
    },

    addPageSqlite: function (path, docOrder, pageOrder) {
        // Get a unique page name.
        let newPageName = this.getUniquePageName("New Page");
        // Add the document to the database.
        var sql = `
            INSERT INTO Docs 
            (DocName, DocLocation, DocColor, DocText, LastModified, DocOrder, PageOrder) 
            VALUES ('${newPageName}', '${path}',
            -1, '','${getMySQLNow()}', ${docOrder}, ${pageOrder})
        `;
        return this.execCommandSqlite(sql);
    },

    docNameExistsMySQL: function (docFullName) {
        return new Promise(function (resolve, reject) {
            var retValue = docFullName;
            showWaitImage();
            var connection = mysql.createConnection(_settings);
            connection.connect();
            connection.query(
                "SELECT DocLocation from Docs WHERE DocLocation = '" + docFullName + "'",
                function (err, rows, fields) {
                    hideWaitImage();
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
        return new Promise(function (resolve, reject) {
            let sql = `
                SELECT DocName
                FROM Docs 
                WHERE DocLocation = '${fullPath}'
                AND DocName =  '${pageName}';
            `;
            app_documents.execQueryMySQL(sql)
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
            showWaitImage();
            var connection = mysql.createConnection(_settings);
            connection.connect();
            let sql = `
                SELECT DISTINCT DocLocation, DocOrder
                FROM Docs
                ORDER BY DocOrder ASC
            `;
            connection.query( sql, (err, data) => {
                hideWaitImage();
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
            ORDER BY DocOrder ASC
        `;
        return this.execQuerySqlite(sql);
    },

    updateDocNameMySQL: function (oldName, newName){
        var sql1 = `
            UPDATE Docs 
            SET DocLocation = REPLACE(DocLocation, '${oldName}', '${newName}')
            WHERE DocLocation = '${oldName}';
        `;
        var sql2= `
            UPDATE Docs 
            SET DocLocation = CONCAT('${newName}', SUBSTR(DocLocation, LENGTH('${oldName}/')))
            WHERE INSTR(DocLocation, '${oldName}/') = 1;
        `;
        return Promise.all([this.execCommandMySQL(sql1), this.execCommandMySQL(sql2)])
        .catch((err)=>{
            console.log(err);
            ShowWarningMessageBox("Database command failure!");
        });
    },

    updateDocNameSqlite: function (oldName, newName){
        var sql1 = `
            UPDATE Docs 
            SET DocLocation = REPLACE(DocLocation, '${oldName}', '${newName}')
            WHERE DocLocation = '${oldName}';
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

    updatePageNameMySQL: function (fullPath, oldName, newName){
        var sql = `
            UPDATE Docs
            SET DocName = '${newName}'
            WHERE DocLocation = '${fullPath}' 
            AND DocName = '${oldName}';
        `;
        return this.execCommandMySQL(sql);
    },

    updatePageNameSqlite: function (fullPath, oldName, newName){
        var sql = `
            UPDATE Docs
            SET DocName = '${newName}'
            WHERE DocLocation = '${fullPath}' 
            AND DocName = '${oldName}';
        `;
        return this.execCommandSqlite(sql);
    },

    deleteDocMySQL: function (fullPath){
        var sql1 = `
            DELETE FROM Docs 
            WHERE DocLocation = '${fullPath}';
        `;
        var sql2 = `
            DELETE FROM Docs 
            WHERE INSTR(DocLocation, '${fullPath}/') = 1;
        `;
        return Promise.all([this.execCommandMySQL(sql1), this.execCommandMySQL(sql2)])
        .catch((err)=>{
            console.log(err);
            ShowWarningMessageBox("Database command failure!");
        });
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
        var sql = `
            DELETE FROM Docs 
            WHERE DocLocation = '${fullPath}'
            AND DocName = '${pageName}';
        `;
        return this.execCommandMySQL(sql)
        .catch((err)=>{
            console.log(err);
            ShowWarningMessageBox("Database command failure!");
        });
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
        let sql = `
            SELECT DocText FROM Docs
            WHERE DocLocation = '${fullPath}'
            AND DocName = '${pageName}';
        `;
        return this.execQueryMySQL(sql);
    },

    getPageNoteSqlite: function (fullPath, pageName){
        let sql = `
            SELECT DocText FROM Docs
            WHERE DocLocation = '${fullPath}'
            AND DocName = '${pageName}';
        `;
        return this.execQuerySqlite(sql);
    },

    updatePageMySQL: function(fullPath, pageName, docText){
        let sql = `
            UPDATE Docs
                SET DocText = '${sqlSafeText(docText)}',
                LastModified = '${getMySQLNow()}' 
            WHERE DocLocation = '${fullPath}'
            AND DocName = '${pageName}';
        `;
        return this.execCommandMySQL(sql);
    },

    updatePageSqlite: function(fullPath, pageName, docText){
        let sql = `
            UPDATE Docs
                SET DocText = '${sqlSafeText(docText)}',
                LastModified = '${getMySQLNow()}' 
            WHERE DocLocation = '${fullPath}'
            AND DocName = '${pageName}';
        `;
        return this.execCommandSqlite(sql);
    },

    updatePageIndentMySQL: function(fullPath, pageName, indent){
        let sql = `
            UPDATE Docs
                SET DocIndentLevel = ${indent}
            WHERE DocLocation = '${fullPath}'
            AND DocName = '${pageName}';
        `;
        return this.execCommandMySQL(sql);
    },

    updatePageIndentSqlite: function(fullPath, pageName, indent){
        let sql = `
            UPDATE Docs
                SET DocIndentLevel = ${indent}
            WHERE DocLocation = '${fullPath}'
            AND DocName = '${pageName}';
        `;
        return this.execCommandSqlite(sql);
    },

    execQueryMySQL: function (sql) {
        return new Promise(function (resolve, reject) {
            console.log("Executing SQL query = " + sql);
            showWaitImage();
            var connection = mysql.createConnection(_settings);
            connection.connect();
            connection.query(sql,
                function (err, rows, fields) {
                    hideWaitImage();
                    if (err) {
                        reject(new Error("DB error occurred!"));
                    } else {
                        resolve(rows);
                    }
                    connection.end();
                }
            );
        });
    },

    execCommandMySQL: function (sql){
        return new Promise((resolve, reject) => {
            showWaitImage();
            var connection = mysql.createConnection(_settings);
            connection.connect(function (err) {
                if (err) reject(err);
                console.log("Executing SQL query = " + sql);
                connection.query(sql, function (err, result) {
                    hideWaitImage();
                    if (err) reject(err)
                    else resolve(result);
                    connection.end();
                });
            });
        });
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

    getUniquePageDocName: function (path, pageName) {
        return new Promise(async (resolve, reject) => {
            var fileNameIndex = 0;
            var pageReturnName = pageName;
            console.log("looking for name " + pageName);
            var nameFound = await this.docPageExists(path, pageName);
            console.log("looping");
            while (nameFound) {
                console.log("incrementing name");
                fileNameIndex += 1;
                pageReturnName = pageName + "(" + fileNameIndex + ")";
                console.log("searching for " + pageReturnName);
                nameFound = await this.docPageExists(path, pageReturnName);
            }
            resolve(pageReturnName);
            return pageReturnName;
        });
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

    loadDocs: function (selectFirst) {
        return new Promise((resolve, reject)=>{
            document.getElementById("txtDoc").value = "";
            document.getElementById("txtDocView").value = "";
            emptyDiv("lstDocuments");
            emptyDiv("lstDocs");
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
                if (selectFirst) this.dvDocuments.selectFirstItem();
                resolve();
            })
            .catch((err)=>{
                console.log(err);
                reject(err);
            });
        });
    },

    getMaxDocOrder: function (){
        return new Promise(async (resolve, reject)=>{
            let sql = `
            SELECT MAX(DocOrder) AS MaxDocOrder FROM Docs
            `;
            let data = _settings.dbType == "MySql" ? 
                await this.execQueryMySQL(sql) : 
                await this.execQuerySqlite(sql);
            data.length > 0 ? resolve(data[0].MaxDocOrder) : resolve(-1);
        });
    },

    getMaxPageOrder: function (docLocation){
        return new Promise(async (resolve, reject)=>{
            let sql = `
            SELECT MAX(PageOrder) AS MaxPageOrder FROM Docs
            WHERE DocLocation = '${docLocation}'
            `;
            let data = _settings.dbType == "MySql" ? 
                await this.execQueryMySQL(sql) : 
                await this.execQuerySqlite(sql);
            data.length > 0 ? resolve(data[0].MaxPageOrder) : resolve(-1);
        });
    },

    getDocOrder: function (docLocation){
        return new Promise(async (resolve, reject)=>{
            let sql = `
            SELECT DocOrder FROM Docs
            WHERE DocLocation = '${docLocation}'
            `;
            let data = _settings.dbType == "MySql" ? 
                await this.execQueryMySQL(sql) : 
                await this.execQuerySqlite(sql);
            data.length > 0 ? resolve(data[0].DocOrder) : resolve(0);
        });
    },

    getUpDocOrder: function (path, docOrder){
        return new Promise(async (resolve, reject)=>{
            let sql = `
            SELECT MAX(DocOrder) AS UpDocOrder FROM Docs
            WHERE DocLocation LIKE '${path}%'
            AND DocOrder < ${docOrder}
            `;
            let data = _settings.dbType == "MySql" ? 
                await this.execQueryMySQL(sql) : 
                await this.execQuerySqlite(sql);
            data.length > 0 ? resolve(data[0].UpDocOrder) : resolve();
        });
    },

    getDownDocOrder: function (path, docOrder){
        return new Promise(async (resolve, reject)=>{
            let sql = `
            SELECT MIN(DocOrder) AS DownDocOrder FROM Docs
            WHERE DocLocation LIKE '${path}%'
            AND DocOrder > ${docOrder}
            `;
            let data = _settings.dbType == "MySql" ? 
                await this.execQueryMySQL(sql) : 
                await this.execQuerySqlite(sql);
            data.length > 0 ? resolve(data[0].DownDocOrder) : resolve();
        });
    },

    getPageOrder: function (docLocation, pageName){
        return new Promise(async (resolve, reject)=>{
            let sql = `
            SELECT PageOrder FROM Docs
            WHERE DocLocation = '${docLocation}'
            AND DocName = '${pageName}'
            `;
            let data = _settings.dbType == "MySql" ? 
                await this.execQueryMySQL(sql) : 
                await this.execQuerySqlite(sql);
            resolve(data[0].PageOrder);
        });
    },

    //#endregion DATA RETRIEVAL FUNCTIONS

    //#region DATA TRANSMITTAL FUNCTIONS
    addDocLocation: async function (parentDoc, docName) {
        let path = this.dvDocuments.getSelectedFullPath();
        let docOrder = await this.getMaxDocOrder();
        docOrder ++;
        if (_settings.dbType == "MySql"){
            await this.addDocLocationMySQL(parentDoc, docName, docOrder);
        }
        else{
            await this.addDocLocationSqlite(parentDoc, docName, docOrder);
        }
        await this.loadDocs();
        (path) ? this.dvDocuments.setSelectedPath(path) : this.dvDocuments.selectFirstItem();
    },

    addPage: async function (path) {
        let pageOrder = await this.getMaxPageOrder(path);
        pageOrder ++;
        let docOrder = await this.getDocOrder(path);
        return (_settings.dbType == "MySql") ?
            this.addPageMySQL(path, docOrder, pageOrder) :
            this.addPageSqlite(path, docOrder, pageOrder);
    },

    addPage_Clicked: function(){
        let path = this.dvDocuments.getSelectedFullPath();
        let page = this.getSelectedPageName();
        console.log(path);
        this.addPage(path)
        .then(()=>{
            this.loadPages(path);
        })
        .then(()=>{
            this.selectPageByName(page);
        });
    },

    updatePage: function(path, pageName, docText){
        return (_settings.dbType == "MySql") ?
            this.updatePageMySQL(path, pageName, docText) :
            this.updatePageSqlite(path, pageName, docText);
    },

    updatePageIndent(path, pageName, indent){
        return (_settings.dbType == "MySql") ?
            this.updatePageIndentMySQL(path, pageName, indent) :
            this.updatePageIndentSqlite(path, pageName, indent);
    },

    savePage: function(){
        return new Promise((resolve, reject)=>{
            let path = this.lastFullPath;
            let pageName = this.getSelectedPageName();
            if (!pageName) resolve();
            let docText = this.txtDoc.value;
            this.updatePage(path, pageName, docText)
            .then(()=>{
                document.getElementById("btnSave").innerHTML = "SAVE";
                resolve();
            })
            .catch((err)=>{
                console.catch(err);
                reject(err);
            });
        });
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
        let pagesArr = Array.from(pages);
        console.log(pagesArr);
        let newPageName = pageName;
        let idx = 0;
        while (pagesArr.find(x=>x.innerText==newPageName)){
            idx += 1;
            newPageName = `${pageName} (${idx})`;
        }
        return newPageName;
    },

    updateDocName: function (oldDocFullPath, newDocFullPath) {
        return (_settings.dbType == "MySql") ?
            this.updateDocNameMySQL(oldDocFullPath, newDocFullPath) :
            this.updateDocNameSqlite(oldDocFullPath, newDocFullPath);
    },

    updatePageName: function (fullPath, oldName, newName) {
        return (_settings.dbType == "MySql") ?
            this.updatePageNameMySQL(fullPath, oldName, newName) :
            this.updatePageNameSqlite(fullPath, oldName, newName);
    },

    deleteDoc: function (fullPath){
        return (_settings.dbType == "MySql") ?
            this.deleteDocMySQL(fullPath) :
            this.deleteDocSqlite(fullPath);
    },

    deletePage: function (fullPath, pageName){
        return (_settings.dbType == "MySql") ?
            this.deletePageMySQL(fullPath, pageName) :
            this.deletePageSqlite(fullPath, pageName);
    },

    swapPages: function (fullPath, pageOrder1, pageOrder2){
        return new Promise(async (resolve, reject)=>{
            let holdPageOrder = -999;
            let sql = `
                UPDATE Docs SET PageOrder = ${holdPageOrder}
                WHERE DocLocation = '${fullPath}' AND PageOrder = ${pageOrder1}
            `;
            await this.execCommandSql(sql);
            sql = `
                UPDATE Docs SET PageOrder = ${pageOrder1}
                WHERE DocLocation = '${fullPath}' AND PageOrder = ${pageOrder2}
            `;
            await this.execCommandSql(sql);
            sql = `
                UPDATE Docs SET PageOrder = ${pageOrder2}
                WHERE DocLocation = '${fullPath}' AND PageOrder = ${holdPageOrder}
            `;
            await this.execCommandSql(sql);
            resolve();
        });
    },

    movePageUp: async function (fullPath, pageName){
        let pageOrder1 = await this.getPageOrder(fullPath, pageName);
        if (pageOrder1 <= 0) return;  // Already at the top.
        let pageOrder2 = pageOrder1 - 1;
        await this.swapPages(fullPath, pageOrder1, pageOrder2);
        this.loadPages(fullPath)
            .then(()=>{
                this.selectPageByName(pageName);
            });
    },

    movePageDown: async function (fullPath, pageName){
        let pageOrder1 = await this.getPageOrder(fullPath, pageName);
        let maxPageOrder = await this.getMaxPageOrder(fullPath);
        if (pageOrder1 == maxPageOrder) return;  // Already at the bottom.
        let pageOrder2 = pageOrder1 + 1;
        await this.swapPages(fullPath, pageOrder1, pageOrder2);
        this.loadPages(fullPath)
            .then(()=>{
                this.selectPageByName(pageName);
            });
    },

    swapDocs: function (docOrder1, docOrder2){
        return new Promise(async (resolve, reject)=>{
            let holdDocOrder = -999;
            let sql = `
                UPDATE Docs SET DocOrder = ${holdDocOrder}
                WHERE DocOrder = ${docOrder1}
            `;
            await this.execCommandSql(sql);
            sql = `
                UPDATE Docs SET DocOrder = ${docOrder1}
                WHERE DocOrder = ${docOrder2}
            `;
            await this.execCommandSql(sql);
            sql = `
                UPDATE Docs SET DocOrder = ${docOrder2}
                WHERE DocOrder = ${holdDocOrder}
            `;
            await this.execCommandSql(sql);
            resolve();
        });
    },

    moveUpDoc: async function (fullPath){
        // Get the selected location's DocOrder.
        let docOrder1 = await this.getDocOrder(fullPath);
        if (docOrder1 == 0) return; // Cannot go up from the highest point.
        // Get the parent path to the passed fullPath.
        let locations = fullPath.split("/");
        let parentPath = locations.length > 1 ? locations.slice(0,locations.length-1).join("/") : "";
        // Get the DocOrder number of the next highest doc location less than this one.
        let docOrder2 = await this.getUpDocOrder(parentPath, docOrder1);
        if (docOrder2){
            await this.swapDocs(docOrder1, docOrder2);
            await this.loadDocs();
            this.dvDocuments.setSelectedPath(fullPath);
        }
    },

    moveDownDoc: async function (fullPath){
        // Get the selected location's DocOrder.
        let docOrder1 = await this.getDocOrder(fullPath);
        // Get the parent path to the passed fullPath.
        let locations = fullPath.split("/");
        let parentPath = locations.length > 1 ? locations.slice(0,locations.length-1).join("/") : "";
        // Get the DocOrder number of the next highest doc location less than this one.
        let docOrder2 = await this.getDownDocOrder(parentPath, docOrder1);
        if (docOrder2){
            await this.swapDocs(docOrder1, docOrder2);
            await this.loadDocs();
            this.dvDocuments.setSelectedPath(fullPath);
        }
    },

    swapPagesByName: async function (fullPath, pageNameSrc, pageNameDst){
        if (getDocChanged()){
            await this.savePage();
        }
        let pageOrder1 = await this.getPageOrder(fullPath, pageNameSrc);
        let pageOrder2 = await this.getPageOrder(fullPath, pageNameDst);
        await this.swapPages(fullPath, pageOrder1, pageOrder2);
        this.loadPages(fullPath)
            .then(()=>{
                this.selectPageByName(pageNameSrc);
            });
    },

    movePageByName: async function(fullPath, pageNameSrc, docLocationDst){
        if (getDocChanged()){
            await this.savePage();
        }
        let movePageOrder = await this.getMaxPageOrder(docLocationDst);
        let newPageName = await this.getUniquePageDocName(docLocationDst, pageNameSrc);
        movePageOrder ++;
        let sql = `
            UPDATE Docs SET PageOrder = ${movePageOrder}, DocLocation = '${docLocationDst}',
            DocName = '${newPageName}'
            WHERE DocLocation = '${fullPath}' AND DocName = '${pageNameSrc}'
        `;
        await this.execCommandSql(sql);
        await this.loadDocs();
        this.dvDocuments.setSelectedPath(docLocationDst);
        this.loadPages(docLocationDst)
            .then(()=>{
                this.selectPageByName(newPageName);
            });
    },

    swapDocsByLocation: async function (docLocationSrc, docLocationDst){
        if (getDocChanged()){
            await this.savePage();
        }
        let docOrder1 = await this.getDocOrder(docLocationSrc);
        let docOrder2 = await this.getDocOrder(docLocationDst);
        await this.swapDocs(docOrder1, docOrder2);
        await this.loadDocs();
        this.dvDocuments.setSelectedPath(docLocationDst);
    },

    updateDocLocation: function (docLocation, docNewLocation){
        let sql = `
            UPDATE Docs SET DocLocation = REPLACE(DocLocation, '${docLocation}', '${docNewLocation}')
            WHERE DocLocation LIKE '${docLocation}/%'
            OR DocLocation = '${docLocation}'
        `;
        return this.execCommandSql(sql);
    },

    moveDocByLocation: async function (docLocationSrc, docLocationDst){
        // Get the last portion of the source location.
        if (getDocChanged()){
            await this.savePage();
        }
        let srcLocations = docLocationSrc.split("/");
        let srcLastPath = srcLocations[srcLocations.length-1];
        let srcParentPath = srcLocations.length > 1 ? srcLocations.slice(0,srcLocations.length-1).join("/") : "";
        let dstLocations = docLocationDst.split("/");
        let dstParentPath = dstLocations.length > 1 ? dstLocations.slice(0,dstLocations.length-1).join("/") : "";
        if (srcParentPath == dstParentPath) {  // The doc is being dropped onto a doc in the same location.
            await this.swapDocsByLocation(docLocationSrc, docLocationDst);
        }
        else { // The doc is being dropped into a different location.
            let docNewLocation = docLocationDst != "" ? `${docLocationDst}/${srcLastPath}`: srcLastPath;
            docNewLocation = await this.getUniqueDocName(docNewLocation);
            await this.updateDocLocation(docLocationSrc, docNewLocation);
            await this.loadDocs();
            this.dvDocuments.setSelectedPath(docNewLocation);
        }
    },

    execCommandSql: function (sql){
        return (_settings.dbType == "MySql") ?
            this.execCommandMySQL(sql) :
            this.execCommandSqlite(sql);
    },

    //#endregion DATA TRANSMITTAL FUNCTIONS

    //#region DOCUMENT MANAGEMENT FUNCTIONS
    setSelectedPage: async function(docPath, pageName){
        await this.dvDocuments.setSelectedPath(docPath);
        this.selectPageByName(pageName);
    },

    selectDocument: async function (docName, callback) {
        console.log(`Document ${docName} selected.`);
        if (getDocChanged()){
            await this.savePage();
        }
        await this.loadPages(docName);
        if (callback) callback();
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
            await this.loadDocs();
            this.dvDocuments.setSelectedPath(newFullPath);
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
            let paths = fullPath.split("/");
            paths[paths.length-1] = newName;
            let newFullPath = paths.join("/");
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
                this.loadDocs(true);
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

    pageIncIndent_Clicked: function (pageName) {
        let pageEl = this.getSelectedPageElement();
        let marginL = parseInt(pageEl.style.marginLeft);
        console.log(marginL);
        if (marginL < 30){
            let fullPath = this.dvDocuments.getSelectedFullPath();
            let newMarginL = marginL + this.indentChange;
            let indent = newMarginL / this.indentChange;
            this.updatePageIndent(fullPath, pageName, indent);
            pageEl.style.marginLeft = `${newMarginL}px`;
        }
    },

    pageDecIndent_Clicked: function (pageName) {
        let pageEl = this.getSelectedPageElement();
        let marginL = parseInt(pageEl.style.marginLeft);
        console.log(marginL);
        if (marginL >= this.indentChange){
            let fullPath = this.dvDocuments.getSelectedFullPath();
            let newMarginL = marginL - this.indentChange;
            let indent = newMarginL / this.indentChange;
            this.updatePageIndent(fullPath, pageName, indent);
            pageEl.style.marginLeft = `${newMarginL}px`;
        }
    },

    pageMoveUp_Clicked: function (pageName) {
        let fullPath = this.dvDocuments.getSelectedFullPath();
        this.movePageUp(fullPath, pageName);
    },

    pageMoveDown_Clicked: function (pageName) {
        let fullPath = this.dvDocuments.getSelectedFullPath();
        this.movePageDown(fullPath, pageName);
    },

    moveUpDoc_Clicked: function (docName) {
        let fullPath = this.dvDocuments.getSelectedFullPath();
        this.moveUpDoc(fullPath, docName);
    },

    moveDownDoc_Clicked: function (docName) {
        let fullPath = this.dvDocuments.getSelectedFullPath();
        this.moveDownDoc(fullPath, docName);
    },

    swapPage_Dropped: function (pageNameSrc, pageNameDst) {
        let fullPath = this.dvDocuments.getSelectedFullPath();
        this.swapPagesByName(fullPath, pageNameSrc, pageNameDst);
    },

    movePage_Dropped: function (pageNameSrc, docLocationDst) {
        let fullPath = this.dvDocuments.getSelectedFullPath();
        this.movePageByName(fullPath, pageNameSrc, docLocationDst);
    },

    moveDoc_Dropped: function (docLocationSrc, docLocationDst) {
        this.moveDocByLocation(docLocationSrc, docLocationDst);
    },


    selectPage: async function(el){
        if (!el) return;
        if (getDocChanged()) {
            await this.savePage();
        }
        this.selectPageButton(el);
        let fullPath = this.dvDocuments.getSelectedFullPath();
        let pageName = el.innerHTML;
        this.getPageNote(fullPath, pageName)
        .then((data)=>{
            if (data){
                this.showPageData(data[0].DocText);
            }
            this.lastFullPath = fullPath;
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
        this.selectPage(e.target);
        this.pageContextMenu(e);
    },

    //#endregion DOCUMENT MANAGEMENT FUNCTIONS

    //#region HELPER FUNCTIONS
    getSelectedPageName: function(){
        let el = this.getSelectedPageElement();
        if (el) return el.innerHTML;
        return;
    },

    getSelectedPageElement: function(){
        return document.querySelector("#lstDocs .pageSelected");
    },
    //#endregion HELPER FUNCTIONS

    //#region INITIALIZATION
    init: function () {
        this.lstDocuments = document.getElementById("lstDocuments");
        this.txtRename = document.getElementById("txtRename");
        this.txtDoc = document.getElementById("txtDoc");
        this.dvDocuments = new div_treeview(this.lstDocuments, "/");
        this.dvDocuments.onSelect((text, callback)=> {
            this.selectDocument(text, callback);
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

document.getElementById("btnExpandAll").addEventListener("click", (e) =>{
    app_documents.dvDocuments.expandAll();
});

document.getElementById("btnCollapseAll").addEventListener("click", (e) =>{
    app_documents.dvDocuments.collapseAll();
});

//#region DRAG AND DROP EVENT HANDLERS

document.addEventListener("dragstart", (e)=>{
    if (e.target.classList.contains("pageItem")){
        app_documents.draggedPageEl = e.target;
    }
    else if (e.target.classList.contains("div_treeview_item")) {
        app_documents.draggedDocEl = e.target;
    }
    e.target.style.opacity = .5;
});

document.addEventListener("dragend", (e)=> {
    // reset the transparency
    e.target.style.opacity = "";
});

document.addEventListener("dragenter", (e)=> {
    // highlight potential drop target when the draggable element enters it
    if (app_documents.draggedPageEl){
        if (e.target.classList.contains("pageItem")) e.target.classList.add("dragTarget");
        if (e.target.classList.contains("div_treeview_item")) e.target.classList.add("dragTarget");
    }
    else if (app_documents.draggedDocEl){
        if (e.target.classList.contains("div_treeview_item")) e.target.classList.add("dragTarget");
        if (e.target.id == "btnAddDoc") e.target.classList.add("dragTarget");
    }
});

document.addEventListener("dragleave", (e)=> {
    // reset background of potential drop target when the draggable element leaves it
    e.target.classList.remove("dragTarget");
});

document.addEventListener("dragover", (e)=> {
    // prevent default to allow drop
    e.preventDefault();
});

document.addEventListener("drop", (e)=> {
    // move dragged elem to the selected drop target
    if (app_documents.draggedPageEl){
        if (e.target.classList.contains("pageItem")) {
            app_documents.swapPage_Dropped(app_documents.draggedPageEl.innerText, e.target.innerText);
        }
        else if (e.target.classList.contains("div_treeview_item")){
            console.log(app_documents.dvDocuments.getFullPath(e.target));
            app_documents.movePage_Dropped(app_documents.draggedPageEl.innerText, 
                app_documents.dvDocuments.getFullPath(e.target));
        }
    }
    else if (app_documents.draggedDocEl){ 
        if (e.target.classList.contains("div_treeview_item")){
            app_documents.moveDoc_Dropped(app_documents.dvDocuments.getFullPath(app_documents.draggedDocEl), 
                app_documents.dvDocuments.getFullPath(e.target));
        }
        else if (e.target.id == "btnAddDoc"){
            app_documents.moveDoc_Dropped(app_documents.dvDocuments.getFullPath(app_documents.draggedDocEl), 
                "");
        }
    }
    e.target.classList.remove("dragTarget");
    // Reinitialize the dragged item references.
    app_documents.draggedDocEl = undefined;
    app_documents.draggedPageEl = undefined;
    // prevent default action.
    e.preventDefault();    
});

//#endregion DRAG AND DROP EVENT HANDLERS

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

document.getElementById("btnPageIncIndent").addEventListener("click", (e)=>{
    app_documents.pageIncIndent_Clicked(app_documents.contextSelectedPage);
});

document.getElementById("btnPageDecIndent").addEventListener("click", (e)=>{
    app_documents.pageDecIndent_Clicked(app_documents.contextSelectedPage);
});

document.getElementById("btnPageMoveUp").addEventListener("click", (e)=>{
    app_documents.pageMoveUp_Clicked(app_documents.contextSelectedPage);
});

document.getElementById("btnPageMoveDown").addEventListener("click", (e)=>{
    app_documents.pageMoveDown_Clicked(app_documents.contextSelectedPage);
});

document.getElementById("btnMoveUpDoc").addEventListener("click", (e)=>{
    app_documents.moveUpDoc_Clicked(app_documents.contextSelectedDoc);
});

document.getElementById("btnMoveDownDoc").addEventListener("click", (e)=>{
    app_documents.moveDownDoc_Clicked(app_documents.contextSelectedDoc);
});

// #endregion DOC CONTEXT MENU EVENT HANDLERS
  

//#endregion DOM EVENT HANDLERS