function div_treeview(divTVElement, divTVDelimeter) {

    var onSelect_Callback;
    var _expandedStyle = "div_treeview_arrow_up";
    var _collapsedStyle = "div_treeview_arrow_down";
    var _mkStyle = "div_treeview_marker";

    function addTVText(parent, text) {
        var newItem = document.createElement("div");
        //newItem.innerText = text;
        newItem.classList.add("div_treeview_item");
        newItem.classList.add("div_treeview_hbox");
        newItem.innerHTML = "<div class='" + _mkStyle + " " + _expandedStyle + "'></div>" + text;
        parent.appendChild(newItem);
    }

    function addTVItem(parent, tvData, isSubitem) {
        var tvItems = tvData.split(divTVDelimeter);

        if (!parent){
            parent = divTVElement;
        }
        var elements = parent.children;
        if (tvItems.length > 0) {
            // if there are some children elements see if this tvItem is among them.
            var i = 0;
            var found = false;
            while (i < elements.length && !found) {
                var newParent = elements[i];
                if (!newParent.classList.contains("div_treeview_item")) {
                    if (newParent.children[0].innerText == tvItems[0]) {
                        // A match was found.
                        found = true;
                        // Continue if there is a subitem in tvItem.
                        if (tvItems.length > 1) {
                            tvItems.shift();
                            var newTVData = tvItems.join(divTVDelimeter);
                            addTVItem(newParent, newTVData, true);
                            fixLastMarkers();
                        }
                        return;
                    }
                }
                i++;
            }
            // if the tvItem was not found add it to the parent.
            if (!found) {
                var newItem = document.createElement("div");
                newItem.classList.add("div_treeview_vbox");
                isSubitem ? newItem.classList.add("div_treeview_leftMargin") : null;
                var newParent = parent.appendChild(newItem);
                addTVText(newParent, tvItems[0]);

                // if there are any items left to add then recurse.
                if (tvItems.length > 1) {
                    tvItems.shift();
                    var newTVData = tvItems.join(divTVDelimeter);
                    addTVItem(newParent, newTVData, true);
                    fixLastMarkers();
                }
                return;
            }
        }
    }

    function loadItems(tvDatas) {
        for (var i = 0; i < tvDatas.length; i++) {
            addTVItem(divTVElement, tvDatas[i], false);
        }
    }

    function onSelect(callback){
        onSelect_Callback = callback;
        divTVElement.ownerDocument.addEventListener("click", (e)=>{
            console.log(e.target);
            if (e.target.classList.contains("div_treeview_item")){
                removeAllSelected(divTVElement);
                e.target.classList.add("div_treeview_selected");
                callback(getFullPath(e.target));  
            }
            else if (e.target.classList.contains(_mkStyle)){
                if (e.target.classList.contains(_collapsedStyle)){
                    expand(e.target.parentNode);
                }
                else{
                    collapse(e.target.parentNode);
                }
            }
        });
    }

    function selectFirstItem(){
        if (divTVElement.innerHTML !=""){
            removeAllSelected(divTVElement);
            var firstItem = divTVElement.children[0].children[0];
            firstItem.classList.add("div_treeview_selected");
            if (onSelect_Callback) onSelect_Callback(firstItem.innerText);
        }
    }

    function onDblClick(callback){
        divTVElement.ownerDocument.addEventListener("dblclick", (e)=>{
            if (e.target.classList.contains("div_treeview_item")){
                if (e.target.classList.contains("div_treeview_children_hidden")){
                    expand(e.target);
                }
                else{
                    collapse(e.target);
                }
                callback(getFullPath(e.target));
            }
        });
    }

    function getFullPath(divItem){
        var fullPath = [];
        var noParent = false;
        var divParent;
        while(!noParent){
            console.log("Found innertext = '" + divItem.innerText.trim() + "'");
            fullPath.unshift(divItem.innerText.trim()); //Inner text will have the marker on it.
            try{
                divItem = divItem.parentNode.parentNode.children[0];
                if (divItem.parentNode === divTVElement){
                    noParent = true;
                }
            }
            catch(err){
                noParent = true;
            }
        }
        return fullPath.join(divTVDelimeter);
    }

    function collapse(divItem){
        console.log("collapsing:");
        console.log(divItem);
        divItem.classList.add("div_treeview_children_hidden");
        var marker = divItem.children[0];
        if (marker.classList.contains(_expandedStyle)){
            marker.classList.remove(_expandedStyle);
            marker.classList.add(_collapsedStyle);
        }
        var divParent = divItem.parentNode;
        var children = divParent.children;
        for (var i=0; i<children.length; i++){
            if (!children[i].classList.contains("div_treeview_children_hidden")){
                children[i].classList.add("div_treeview_collapsed");
                noChildren = false;
            }
        }
    }

    function collapseAll(divParent){
        // Set the parent to the root element if none was set.
        if (!divParent){
            divParent = divTVElement;
        }
        // Set all markers to "-""
        if (divParent.classList.contains(_mkStyle)){
            collapse(divParent.parentNode);
        }
        // Recurse through the children.
        var children = divParent.children;
        for (var i=0;i<children.length;i++){
            collapseAll(children[i]);
        }
    }

    function expandAll(divParent){
        // Set the parent to the root element if none was set.
        if (!divParent){
            divParent = divTVElement;
        }
        // Set all markers to exapnded.
        if (divParent.classList.contains(_mkStyle)){
            if (divParent.classList.contains(_collapsedStyle)){
                divParent.classList.add(_expandedStyle);
                divParent.classList.remove(_collapsedStyle);
            }
        }
        // Remove all the hidden and collapse classes.
        divParent.classList.remove("div_treeview_children_hidden");
        divParent.classList.remove("div_treeview_collapsed");
        // Recurse through the children.
        var children = divParent.children;
        for (var i=0;i<children.length;i++){
            expandAll(children[i]);
        }
    }

    function expand(divItem){
        console.log("expanding:");
        console.log(divItem);
        divItem.classList.remove("div_treeview_children_hidden");
        var marker = divItem.children[0];
        marker.classList.add(_expandedStyle);
        marker.classList.remove(_collapsedStyle);
        var divParent = divItem.parentNode;
        var children = divParent.children;
        for (var i=0; i<children.length; i++){
            children[i].classList.remove("div_treeview_collapsed");
        }
    }

    function removeAllSelected(divParent){
        if (divParent){
            // It is necessary to copy the children into an array variable.
            // reference: https://stackoverflow.com/questions/17094230/how-do-i-loop-through-children-objects-in-javascript
            var children = divParent.children;
            divParent.classList.remove("div_treeview_selected");
            for (var i=0; i<children.length; i++){
                removeAllSelected(children[i]);
            }
        }
    }

    function fixLastMarkers(divItem){
        if (!divItem){
            divItem = divTVElement;
        }
        if (divItem.classList.contains(_expandedStyle)){
            console.log("found expanded marker.");
            if(divItem.parentNode.parentNode.children.length == 1){
                divItem.classList.remove(_expandedStyle);
                divItem.classList.remove(_collapsedStyle);
            }
        }
        var children = divItem.children;
        for (var i=0;i<children.length; i++){
            fixLastMarkers(children[i]);
        }
    }


    // Expose all public functions/objects here.
    this.loadItems = loadItems;
    this.addTVItem = addTVItem;
    this.onSelect = onSelect;
    this.onDblClick = onDblClick;
    this.expandAll = expandAll;
    this.collapseAll = collapseAll;
    this.selectFirstItem = selectFirstItem;
    
    return this.div_treeview;
}
