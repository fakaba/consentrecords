var crs = {
	privilegesByID: {},
	privileges: [
		{name: "_find", id: "", accessRecords: [], accessors: [], label: "Who Can Find You"},
		{name: "_read", id: "", accessRecords: [], accessors: [], label: "Who Can Learn About You"},
		{name: "_write", id: "", accessRecords: [], accessors: [], label: "Who Can Add Information About You"},
		{name: "_administer", id: "", accessRecords: [], accessors: [], label: "Who Can Manage Your Account"}],
	
	initialize: function()
	{
		crs.privilegesByID = {};
		crs.privileges = [
			{name: "_find", id: "", accessRecords: [], accessors: [], label: "Who Can Find You"},
			{name: "_read", id: "", accessRecords: [], accessors: [], label: "Who Can Learn About You"},
			{name: "_write", id: "", accessRecords: [], accessors: [], label: "Who Can Add Information About You"},
			{name: "_administer", id: "", accessRecords: [], accessors: [], label: "Who Can Manage Your Account"}
			];
	}
};

function showSharing(containerDiv) {
	var allExperiences = [];
	
	var panelDiv = $(containerDiv).parents(".site-panel")[0];
	var container = d3.select(containerDiv);
	var containerHeight = parseInt(container.style("height"));
	
	crs.initialize();
	
	function successFunction1(accessRecords)
	{
		// Sort the access records by type.
		for (var i = 0; i < accessRecords.length; ++i)
		{
			var a = accessRecords[i];
			var cell = a.getCell("_privilege");
			if (cell && cell.data.length > 0)
			{
				var d = cell.data[0];
				if (d.getValueID() in crs.privilegesByID)
				{
					var sa = crs.privilegesByID[d.getValueID()];
					sa.accessRecords.push(a);
					var userCell = a.getCell("_user");
					var groupCell = a.getCell("_group");
					for (var j = 0; j < userCell.data.length; ++j)
					{
						sa.accessors.push(userCell.data[j]);
					}
					for (var j = 0; j < groupCell.data.length; ++j)
					{
						sa.accessors.push(groupCell.data[j]);
					}
				}
			}
		}
		
		container.selectAll("div").remove();
		var cells = container.selectAll("div")
			.data(crs.privileges)
			.enter()
			.append("div")
			.classed("cell-div", true);
		cells.append("div")
			.classed("cell-label top-label", true)
			.text(function(d) { return d.label });
		var itemCells = cells.append("div")
			.classed("cell-items", true);
			
		var items = itemCells.selectAll("li")
			.data(function(d) { return d.accessors })
			.enter()
			.append("li");
			
		appendConfirmDeleteControls(items);
		
		var buttons = items.append("div")
			.classed("btn row-button multi-row-content expanding-div", true);
		
		var clickFunction = null;	
		if (clickFunction)
			buttons.on("click", clickFunction);
	
		appendDeleteControls(buttons);

		appendRightChevrons(buttons);	
		
		appendButtonDescriptions(buttons, null);

		/* Add one more button for the add Button item. */
		var buttonDiv = cells.append("div")
			.append("button").classed("btn row-button multi-row-content site-active-text border-above border-below", true)
			.on("click", function(d) {
				addAccessor.call(this, userInstance, d);
			})
			.append("div").classed("pull-left", true);
		buttonDiv.append("span").classed("glyphicon glyphicon-plus", true);
		buttonDiv.append("span").text(" add user or group");
	}
	
	function getPrivileges(enumerators)
	{
		for (var i = 0; i < enumerators.length; ++i)
		{
			var e = enumerators[i];
			for (var j = 0; j < crs.privileges.length; ++j)
			{
				var p = crs.privileges[j];
				if (p.name == e.getDescription())
				{
					p.id = e.getValueID();
					crs.privilegesByID[p.id] = p;
					break;
				}
			}
		}
		cr.getData({path: "#" + userInstance.getValueID() + '>"_access record"', 
					fields: ["parents"], 
					done: successFunction1, 
					fail: asyncFailFunction});
	}

	var privilegePath = "_uuname[_uuname=_privilege]>enumerator";
	crp.getData({path: privilegePath, 
				 done: getPrivileges, 
				 fail: asyncFailFunction});
}

/*
	This function should be called within a prepareClick block. 
 */
function pickAccessor(header, containerPanel, successFunction)
{
	var panelDiv = createPanel(containerPanel, null, header)
		.classed("list-panel", true);

	var navContainer = panelDiv.appendNavContainer();

	var backButton = navContainer.appendLeftButton()
		.on("click", handleCloseRightEvent);
	backButton.append("span").text("Done");

	var centerButton = navContainer.appendTitle(header);

	var searchText = "";
	function show_users()
	{
		var val = this.value.toLocaleLowerCase().trim();
		var inputBox = this;
		
		if (val.length == 0)
		{
			panel2Div.selectAll("section").remove();
			searchText = val;
		}
		else
		{
			var startVal = val;
						
			function show_user(user, containerPanel)
			{
				showViewOnlyObjectPanel(user, user.cell, undefined, containerPanel);
			}
	
			var selectAllSuccess = function(userObjects)
			{
				if (inputBox.value.toLocaleLowerCase().trim() == startVal)
				{
					panel2Div.selectAll("section").remove();
					var sections = panel2Div.appendSections(userObjects);
					var buttons = appendViewButtons(sections)
						.on("click", function(user) {
							if (prepareClick())
							{
								successFunction(user, panelDiv);
							}
							d3.event.preventDefault();
						});
					var infoButtons =  buttons.insert("div", ":first-child")
						.classed("info-button right-fixed-width-div", true)
						.on("click", function(user) {
							if (prepareClick())
							{
								show_user(user, panelDiv);
							}
							d3.event.preventDefault();
						});
					drawInfoButtons(infoButtons);

					searchText = startVal;
				}
			}
			
			if (val.length < 3)
				cr.selectAll({path: '_user[?^="'+val+'"]', limit: 50, done: selectAllSuccess, fail: asyncFailFunction});
			else
				cr.selectAll({path: '_user[?*="'+val+'"]', limit: 50, done: selectAllSuccess, fail: asyncFailFunction} );
		}
	}
	
	var searchBar = panelDiv.appendSearchBar(show_users);

	var panel2Div = panelDiv.appendScrollArea();
	panel2Div.appendAlertContainer();

	showPanelLeft(panelDiv.node());
}

function addAccessor(userInstance, accessorLevel)
{
	if (prepareClick())
	{
		var _this = this;
		var panelDiv = d3.select($(this).parents(".site-panel")[0]);
		var accessRecordCell = userInstance.getCell("_access record");
		function successFunction(pickedUser, panelDiv)
		{
			if (accessorLevel.accessRecords.length == 0)
			{
				function _createAccessRecordSuccess(newData)
				{
					accessorLevel.accessRecords.push(newData);
					var itemsDiv = $(_this).parents(".cell-div").children(".cell-items")[0];
					_getOnValueAddedFunction(panelDiv, accessRecordCell, userInstance.getValueID(), true, true, showViewObjectPanel, revealPanelLeft).call(itemsDiv, null, newData);
					hidePanelRight(panelDiv.node());
				}

				// Create an instance of an access record with this accessor level
				// and this user.
				var field = accessRecordCell.field;
				var initialData = {"_privilege": accessorLevel.id,
								   "_user": pickedUser.getValueID() };
				cr.createInstance(field, userInstance.getValueID(), initialData, _createAccessRecordSuccess, syncFailFunction);
			}
			else
			{
				function _createAccessRecordSuccess(newData)
				{
					accessorLevel.accessRecords.push(newData);
					var itemsDiv = $(_this).parents(".cell-div").children(".cell-items")[0];
					_getOnValueAddedFunction(panelDiv, accessRecordCell, userInstance.getValueID(), true, true, showViewObjectPanel, revealPanelLeft).call(itemsDiv, null, newData);
					hidePanelRight(panelDiv.node());
				}

				// Add this user to the access record associated with this accessor level.
				var ar = accessorLevel.accessRecords[0]
				cr.addObjectValue(ar.getCell("_user"), ar.getValueID(), pickedUser, _createAccessRecordSuccess, syncFailFunction);
			}
		}
		pickAccessor("Add User Or Group", panelDiv, successFunction);
	}
}