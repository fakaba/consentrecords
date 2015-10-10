		/* Add the functionality to a javascript object to attach event targets and
			trigger events on them. This allows events to be fired on model objects.
		 */

var cr = {		
	EventHandler: function () { 
		this.events = {};
	},
	Cell: function() { 
		cr.EventHandler.call(this);
		this.data = [];
	},
	CellValue: function() {
		cr.EventHandler.call(this);
		this.id = null; 
		this.value = null;
	},
	ObjectValue: function() {
		cr.CellValue.call(this);
		this.value = {id: null, description: "None" };
	},
	dataTypes: {
		_string: {
			isEmpty: function(d)
			{
				return !d.value;
			},
			setupValue: function(d)
			{
				d.getDescription = function() { return this.value; };
				$(d).on("dataChanged", function(e) {
					d.trigger_event("dataChanged");
				});
			},
			newValue: function()
			{
				var d = new cr.CellValue();
				this.setupValue(d);
				return d;
			},
			copyValue: function(oldValue)
			{
				var newValue = new cr.CellValue();
				this.setupValue(newValue);
				if (oldValue.id !== null && oldValue.id !== undefined)
					newValue.id = oldValue.id;
				if (oldValue.value !== null && oldValue.value !== undefined)
					newValue.value = oldValue.value;
				return newValue;
			},
			appendData: function(cell, initialData)
			{
				cr.appendStringData(cell, initialData);
			},
		},
		_number: {
			isEmpty: function(d)
			{
				return !d.value;
			},
			setupValue: function(d)
			{
				d.getDescription = function() { return this.value; };
				$(d).on("dataChanged", function(e) {
					d.trigger_event("dataChanged");
				});
			},
			newValue: function()
			{
				var d = new cr.CellValue();
				this.setupValue(d);
				return d;
			},
			copyValue: function(oldValue)
			{
				var newValue = new cr.CellValue();
				this.setupValue(newValue);
				if (oldValue.id !== null && oldValue.id !== undefined)
					newValue.id = oldValue.id;
				if (oldValue.value !== null && oldValue.value !== undefined)
					newValue.value = oldValue.value;
				return newValue;
			},
			appendData: function(cell, initialData)
			{
				cr.appendStringData(cell, initialData);
			},
		},
		_datestamp: {
			isEmpty: function(d)
			{
				return !d.value;
			},
			setupValue: function(d)
			{
				d.getDescription = function() { return this.value; };
				$(d).on("dataChanged", function(e) {
					d.trigger_event("dataChanged");
				});
			},
			newValue: function()
			{
				var d = new cr.CellValue();
				this.setupValue(d);
				return d;
			},
			copyValue: function(oldValue)
			{
				var newValue = new cr.CellValue();
				this.setupValue(newValue);
				if (oldValue.id !== null && oldValue.id !== undefined)
					newValue.id = oldValue.id;
				if (oldValue.value !== null && oldValue.value !== undefined)
					newValue.value = oldValue.value;
				return newValue;
			},
			appendData: function(cell, initialData)
			{
				cr.appendStringData(cell, initialData);
			},
		},
		_object: {
			isEmpty: function(d)
			{
				return !d.value.id && !d.value.cells;
			},
			setupValue: function(d)
			{
				$(d).on("dataChanged", d.handleContentsChanged);
				$(d).on("valueAdded", d.handleContentsChanged);
			},
			newValue: function()
			{
				var d = new cr.ObjectValue();
				this.setupValue(d);
				return d;
			},
			copyValue: function(oldValue)
			{
				var newValue = new cr.ObjectValue();
				this.setupValue(newValue);
				if (oldValue.id !== null && oldValue.id !== undefined)
					newValue.id = oldValue.id;
				if (oldValue.value !== null && oldValue.value !== undefined)
				{
					if (oldValue.value.id)
						newValue.value.id = oldValue.value.id;
					if (oldValue.value.description)
						newValue.value.description = oldValue.value.description;
					if (oldValue.value.cells)
					{
						newValue.value.cells = [];
						$(oldValue.value.cells).each(function()
						{
							newValue.importCell(this);
						});
					}
				}
				return newValue;
			},
			appendData: function(cell, initialData)
			{
				var newData = [];
				if (cell.data)
				{
					for (var i = 0; i < cell.data.length; ++i)
					{
						var d = cell.data[i];
						if (d.getValueID())
						{
							/* This case is true if we are picking an object. */
							var newDatum = {id: null, value: {id: d.getValueID()}};
							newData.push(newDatum);
						}
						else if ("cells" in d.value)
						{
							/* This case is true if we are creating an object */
							var newDatum = {id: null, value: {cells: []}};
							$(d.value.cells).each(function()
							{
								cr.dataTypes[this.field.dataType].appendData(this, newDatum.value.cells);
							});
							
							newData.push(newDatum);
						}
						/* Otherwise, it is blank and shouldn't be saved. */
					}
				}
				initialData.push({"data": newData, "field": cell.field});
			},
		},
	},
	
	urls: {
		selectAll : "/selectall/",
		getData : "/get/data/",
		getConfiguration : "/get/addconfiguration/",
		createInstance : "/createinstance/",
		addValue : "/addvalue/",
		updateValues : "/updatevalues/",
	},
	
	appendStringData: function(cell, initialData)
	{
		var newData = [];
		$(cell.data).each(function()
			{
				if (this.value)
				{
					var newDatum = {id: null, value: this.value};
					newData.push(newDatum);
				}
			});
		if (newData.length > 0)
			initialData.push({"data": newData, "field": cell.field});
	},
	
	postFailed: function(jqXHR, textStatus, errorThrown, failFunction)
	{
		if (textStatus == "timeout")
			failFunction("This operation ran out of time. Try again.")
		else
			failFunction("Connection error " + errorThrown + ": " + jqXHR.status + "; " + jqXHR.statusText)
	},
	
	getValues: function (path, ofKindID, successFunction, failFunction)
	{
		var argList = {};
		if (path)
			argList.path = path;
		else if (ofKindID)
			argList.ofKindID = ofKindID;
		else
			throw "neither path nor ofKindID were specified to selectAll"
		
		$.getJSON(cr.urls.selectAll, 
			argList,
			function(json)
			{
				if (json.success) {
					var newObjects = [];
					$(json.objects).each(function()
					{
						newObjects.push(cr.dataTypes._object.copyValue(this));
					});
					
					if (successFunction)
						successFunction(newObjects);
				}
				else
				{
					if (failFunction)
						failFunction(json.error);
				}
			}
		);
	},
	
	updateValue: function(storedcsrftoken, oldValue, d, successFunction, failFunction)
	{
		var initialData = [{id: oldValue.id, value: d.getValueID()}];
		$.post(cr.urls.updateValues, 
				{ csrfmiddlewaretoken: storedcsrftoken, 
					"commands": JSON.stringify(initialData),
					"timezoneoffset": new Date().getTimezoneOffset()
				})
			  .done(function(json, textStatus, jqXHR)
				{
					if (json.success) {
						oldValue.completeUpdateValue(d);
						successFunction();
					}
					else {
						failFunction(json.error);
					}
				})
			  .fail(function(jqXHR, textStatus, errorThrown)
					{
						cr.postFailed(jqXHR, textStatus, errorThrown, failFunction);
					}
				);
	},
	
	addObjectValue: function (storedcsrftoken, containerCell, containerUUID, initialData, successFunction, failFunction)
	{
		$.post(cr.urls.addValue, 
				{ csrfmiddlewaretoken: storedcsrftoken, 
				  containerUUID: containerUUID,
				  elementUUID: containerCell.field.nameID,
				  valueUUID: initialData.getValueID(),
				  timezoneoffset: new Date().getTimezoneOffset()
				})
			  .done(function(json, textStatus, jqXHR)
				{
					if (json.success) {
						closealert();
						var newData = cr.dataTypes[containerCell.field.dataType].newValue();
						newData.id = json.id;
						newData.value.description = initialData.getDescription();
						newData.value.id = initialData.getValueID();
						containerCell.addValue(newData);
						successFunction(newData);
					}
					else {
						failFunction(json.error);
					}
				})
			  .fail(function(jqXHR, textStatus, errorThrown)
					{
						cr.postFailed(jqXHR, textStatus, errorThrown, failFunction);
					}
				);
	},
			
	createInstance: function(storedcsrftoken, field, containerUUID, initialData, successFunction, failFunction)
	{
		var jsonArray = { csrfmiddlewaretoken: storedcsrftoken, 
					elementUUID: field.nameID,
					typeID: field.ofKindID,
					properties: JSON.stringify(initialData),
					timezoneoffset: new Date().getTimezoneOffset()
				};
		if (containerUUID)
			jsonArray.containerUUID = containerUUID;
	
		$.post(cr.urls.createInstance, 
				jsonArray)
			  .done(function(json, textStatus, jqXHR)
				{
					if (json.success)
					{
						if (successFunction) 
						{
							/* Copy the data from json object into newData so that 
								any functions are properly initialized.
							 */
							var newData = cr.dataTypes._object.newValue();
							/* If there is a container, then the id in newData will contain
								the id of the value object in the database. */
							if (containerUUID)
								newData.id = json.object.id;
							newData.value.id = json.object.value.id;
							newData.value.description = json.object.value.description;
							successFunction(newData);
						}
					}
					else
					{
						failFunction(json.error);
					}
				})
			  .fail(function(jqXHR, textStatus, errorThrown)
					{
						cr.postFailed(jqXHR, textStatus, errorThrown, failFunction);
					}
				);
	},
	
	append: function(storedcsrftoken, oldValue, containerCell, containerUUID, initialData, successFunction, failFunction)
	{
		cr.createInstance(storedcsrftoken, containerCell.field, containerUUID, initialData, 
			function(newData)
			{
				if (oldValue)
					oldValue.completeUpdateValue(newData);
				else
					containerCell.addValue(newData);
				if (successFunction) successFunction(newData);
			}, 
			failFunction);
	},
	
	updateValues: function(storedcsrftoken, initialData, sourceObjects, updateValuesFunction, successFunction, failFunction)
	{
		$.post(cr.urls.updateValues, 
			{ csrfmiddlewaretoken: storedcsrftoken, 
			  commands: JSON.stringify(initialData),
			  timezoneoffset: new Date().getTimezoneOffset()
			})
		  .done(function(json, textStatus, jqXHR)
			{
				if (json.success) {
					if ( updateValuesFunction)
						updateValuesFunction();
					for (var i = 0; i < sourceObjects.length; ++i)
					{
						d = sourceObjects[i];
						newID = json.ids[i];
						if (d.id == newID)	/* An Update */
						{
							d.trigger_event("dataChanged");
						}
						else
						{
							d.id = newID;
							d.trigger_event("dataChanged");
						}
					}
					if (successFunction)
						successFunction();
				}
				else
				{
					if (failFunction)
						failFunction(json.error);
				}
			})
		  .fail(function(jqXHR, textStatus, errorThrown)
				{
					cr.postFailed(jqXHR, textStatus, errorThrown, failFunction);
				}
			);
	},

	getConfiguration: function(typeID, successFunction, failFunction)
	{
		$.getJSON(cr.urls.getConfiguration,
			{ "typeID" : typeID }, 
			function(json)
			{
				if (json.success)
				{
					var cells = [];
					$(json.cells).each(function()
					{
						newCell = new cr.Cell();
						newCell.field = this.field;
						newCell.setup(null);
						cells.push(newCell);
					});
				
					successFunction(cells);
				}
				else
				{
					failFunction(json.error);
				}
			}
		);
	},
	
	getData: function(path, successFunction, failFunction)
	{
		$.getJSON(cr.urls.getData,
			{ "path" : path }, 
			function(json)
			{
				if (json.success) {
					var instances = [];
					for (var i = 0; i < json.data.length; ++i)
					{
						var datum = json.data[i];
						var v = cr.dataTypes._object.newValue();
						v.value.cells = [];
						var cells = datum.cells;
						for (var j = 0; j < cells.length; ++j)
						{
							v.importCell(cells[j]);
						}
						v.value.id = datum.id;
						v.value.parentID = datum.parentID;
						instances.push(v);
					}
				
					successFunction(instances);
				}
				else {
					failFunction(json.error);
				}
			}
		);
	}
}
		
cr.EventHandler.prototype.add_target = function(e, target)
{
	if (!(e in this.events))
		this.events[e] = [];
	this.events[e].push(target);
}

cr.EventHandler.prototype.remove_target = function(e, target)
{
	if (e in this.events)
	{
		var a = this.events[e]
		a.splice($.inArray(target, a), 1);
	}
}
	
cr.EventHandler.prototype.trigger_event = function(e, eventInfo)
{
	if (e in this.events)
		$(this.events[e]).trigger(e, eventInfo);
}

cr.EventHandler.prototype.clear_events = function()
{
	this.events = {};
}
		
cr.Cell.prototype = new cr.EventHandler();
cr.Cell.prototype.setup = function (objectData)
{
	if (this.field.descriptorType !== undefined && objectData)
	{
		this.add_target("valueAdded", objectData);
		this.add_target("dataChanged", objectData);
		$(this).on("dataChanged", function(e) {
			this.trigger_event("dataChanged");
		});
	}
	
	/* If this is a unique value and there is no value, set up an unspecified one. */
	if (this.data.length == 0 &&
		this.field.capacity == "_unique value") {
		this.data = [cr.dataTypes[this.field.dataType].newValue()];
	}
};

cr.Cell.prototype.isEmpty = function()
{
	var isEmpty = cr.dataTypes[this.field.dataType].isEmpty;
	for (var i = 0; i < this.data.length; ++i)
	{
		var d = this.data[i];
		if (!isEmpty(d))
			return false;
	}
	return true;
};
		
cr.Cell.prototype.addValue = function(newData)
{
	var isEmpty = cr.dataTypes[this.field.dataType].isEmpty;
	for (var i = 0; i < this.data.length; ++i)
	{
		var oldData = this.data[i];
		if (!oldData.id && isEmpty(oldData)) {
			oldData.completeUpdateValue(newData);
			return;
		}
	}				
	this.data.push(newData);
	newData.add_target("dataChanged", this);
	this.trigger_event("valueAdded", [newData]);
}

cr.CellValue.prototype = new cr.EventHandler();
cr.CellValue.prototype.completeUpdateValue = function(newData)
{
	if (!this.id)
		this.id = newData.id;
	/* Replace the value completely so that its cells are eliminated and will be
		re-accessed from the server. This handles the case where a value has been added. */
	this.value = {id: newData.getValueID(), description: newData.getDescription()};
	this.trigger_event("dataChanged");
}

cr.ObjectValue.prototype = new cr.CellValue();
cr.ObjectValue.prototype.getDescription = function() { return this.value.description; };
cr.ObjectValue.prototype.getValueID = function() { return this.value.id; };
cr.ObjectValue.prototype.calculateDescription = function()
{
	if (!("cells" in this.value))
		return this.value.description;
	else
	{
		var nameArray = [];
		for (var i = 0; i < this.value.cells.length; ++i)
		{
			var cell = this.value.cells[i];
			if (cell.field.descriptorType == "_by text")
			{
				cellNames = []
				for (var j = 0; j < cell.data.length; ++j)
				{
					cellNames.push(cell.data[j].getDescription());
				}
				nameArray.push(cellNames.join(separator='/'));
			}
			else if (cell.field.descriptorType == "_by count")
			{
				nameArray.push(cell.data.length.toString());
			}
		}
		if (nameArray.length == 0)
			this.value.description = "None";
		else
			this.value.description = nameArray.join(separator = ' ');
	}
}

cr.ObjectValue.prototype.hasTextDescription = function()
{
	for (var i = 0; i < this.value.cells.length; ++i)
	{
		var cell = this.value.cells[i];
		if (cell.field.descriptorType == "_by text" &&
			cell.data.length > 0)
			return true;
	}
	return false;
}

cr.ObjectValue.prototype.handleContentsChanged = function(e)
{
	var oldDescription = this.getDescription();
	this.calculateDescription();
	if (this.getDescription() != oldDescription)
		this.trigger_event("dataChanged");
}

cr.ObjectValue.prototype.importCell = function(oldCell)
{
	var newCell = new cr.Cell();
	newCell.field = oldCell.field;
	if (oldCell.data)
	{
		var dt = cr.dataTypes[newCell.field.dataType];
		$(oldCell.data).each(function()
		{
			newValue = dt.copyValue(this);
			newValue.add_target("dataChanged", newCell);
			newCell.data.push(newValue);
		});
	}
	newCell.setup(this);
	this.value.cells.push(newCell);
	return newCell;
}

cr.ObjectValue.prototype.checkCells = function(containerCell, successFunction, failFunction)
{
	if (this.value.cells)
	{
		successFunction();
	}
	else if (this.getValueID())
	{
		var v = this;
		$.getJSON(cr.urls.getData,
			{ "path" : "#" + this.getValueID() }, 
			function(json)
			{
				if (json.success) {
					datum = json.data[0].cells;
					v.value.cells = [];
					for (var i = 0; i < datum.length; ++i)
					{
						v.importCell(datum[i]);
					}
				
					successFunction();
				}
				else {
					failFunction(json.error);
				}
			}
		);
	}
	else if (containerCell.field.ofKindID)
	{
		v = this;
		/* This is a blank item. This can be a unique item that hasn't yet been initialized. */
		cr.getConfiguration(containerCell.field.ofKindID, 
			function(newCells)
			{
				v.value.cells = newCells;
				successFunction();
			},
			failFunction);
	}
}
