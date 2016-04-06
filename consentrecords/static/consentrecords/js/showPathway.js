function _pickedOrCreatedValue(i, pickedName, createdName)
{
	var v = i.getValue(pickedName);
	if (v && v.getValueID())
		return v.getDescription();
	else {
		v = i.getValue(createdName);
		if (v)
			return v.text;
		else
			return undefined;
	}
}

// var FlagData = (function() {
// 	FlagData.prototype.experience = null;
// 	FlagData.prototype.x = null;
// 	FlagData.prototype.y = null;
// 	FlagData.prototype.height = null;
// 	
// 	FlagData.prototype.getDescription = function()
// 	{
// 		return this.experience.getDescription();
// 	}
// 	
// 	FlagData.prototype.pickedOrCreatedValue = function(pickedName, createdName)
// 	{
// 		return _pickedOrCreatedValue(this.experience, pickedName, createdName);
// 	}
// 
// 	function FlagData(experience)
// 	{
// 		this.experience = experience;
// 		this.y = null;
// 		this.x = null;
// 		this.height = null;
// 	}
// 	return FlagData;
// })();
// 
function getMarkerList(experience)
{
	var names = [];
	
	var offering = experience.getValue("Offering");
	if (offering && offering.getValueID())
	{
		names = offering.getCell("Service").data
			.filter(function(v) { return !v.isEmpty(); })
			.map(function(v) { return v.getDescription(); });
	}
	
	var serviceCell = experience.getCell("Service");
	var userServiceCell = experience.getCell("User Entered Service");

	if (serviceCell)
		names = names.concat(serviceCell.data
			.filter(function(v) { return !v.isEmpty(); })
			.map(function(v) { return v.getDescription(); }));
	
	if (userServiceCell)
		names = names.concat(userServiceCell.data
			.filter(function(v) { return !v.isEmpty(); })
			.map(function(v) { return v.getDescription(); }));
	
	return names.join(", ");
}

var Pathway = (function () {
	Pathway.prototype.dataTopMargin = 5;
	Pathway.prototype.dataBottomMargin = 5;
	Pathway.prototype.dataLeftMargin = 40;			/* The space between the left margin and the beginning of the flags */
	Pathway.prototype.trunkWidth = 5;
	Pathway.prototype.trunkSpacing = 5;
	Pathway.prototype.trunkColumnWidth = 10;		/* trunkWidth + trunkSpacing; */
	Pathway.prototype.textLeftMargin = 10;
	Pathway.prototype.textRightMargin = 10;
	Pathway.prototype.textBottomBorder = 3;
	Pathway.prototype.flagsLeftMargin = 14;
	Pathway.prototype.flagsRightMargin = 14;
	Pathway.prototype.flagSpacing = 5;
	Pathway.prototype.stemHeight = 3;
	Pathway.prototype.otherColor = "#bbbbbb";
	Pathway.prototype.textDetailLeftMargin = 10; /* textLeftMargin; */
	Pathway.prototype.textDetailRightMargin = 10; /* textRightMargin; */
	Pathway.prototype.detailTextSpacing = 2;		/* The space between lines of text in the detail box. */
	Pathway.prototype.pathBackground = "white";
	Pathway.prototype.showDetailIconWidth = 18;
	
	Pathway.prototype.user = null;
	Pathway.prototype.allExperiences = [];
	Pathway.prototype.sitePanel = null;
	Pathway.prototype.containerDiv = null;
	Pathway.prototype.pathwayContainer = null;
	Pathway.prototype.timeContainer = null;
	Pathway.prototype.svg = null;
	Pathway.prototype.svgTime = null;
	Pathway.prototype.loadingMessage = null;
	Pathway.prototype.defs = null;
	Pathway.prototype.bg = null;
	Pathway.prototype.bgTime = null;
	Pathway.prototype.loadingText = null;
	Pathway.prototype.promptAddText = null;
	Pathway.prototype.experienceGroup = null;
	Pathway.prototype.yearGroup = null;
	Pathway.prototype.detailGroup = null;
	Pathway.prototype.detailBackRect = null;
	Pathway.prototype.detailFrontRect = null;
	
	Pathway.prototype.detailFlagData = null;
	Pathway.prototype.flagElement = null;
	Pathway.prototype.flagHeight = 0;
	Pathway.prototype.flagWidth = 0;
	
	Pathway.prototype.minDate = null;
	Pathway.prototype.maxDate = null;
	Pathway.prototype.timespan = 0;
	Pathway.prototype.isLayoutDirty = true;
	Pathway.prototype.isMinHeight = false;
	Pathway.prototype.dayHeight = 0;
	Pathway.prototype.years = [];
	
	Pathway.prototype.nextClipID = 1;
	Pathway.prototype.clipID = null;
	
	//This is the accessor function we talked about above
	Pathway.prototype._lineFunction = d3.svg.line()
		.x(function(d) { return d.x; })
		.y(function(d) { return d.y; })
		.interpolate("linear");

	Pathway.prototype.getService = function(experience)
	{
		var offering = experience.getValue("Offering");
		if (offering && offering.getValueID())
		{
			var service = offering.getValue("Service");
			if (service)
				return service;
		}
		return experience.getValue("Service");
	}

	Pathway.prototype._compareExperiences = function(a, b, ordered)
	{
		var aService = this.getService(a);
		var bService = this.getService(b);
		
		var aServiceDomain = aService && crp.getInstance(aService.getValueID()).getValue("Service Domain");
		var bServiceDomain = bService && crp.getInstance(bService.getValueID()).getValue("Service Domain");
		if (!bServiceDomain)
		{
			if (aServiceDomain) return -1;
		}
		else if (!aServiceDomain)
			return 1;
		else
		{
			var aDescription = aServiceDomain.getDescription();
			var bDescription = bServiceDomain.getDescription();
			var aOrder = ordered.indexOf(aDescription);
			var bOrder = ordered.indexOf(bDescription);
			if (aOrder < 0) 
			{
				ordered.push(aDescription);
				aOrder = ordered.length;
			}
			if (bOrder < 0)
			{
				ordered.push(bDescription);
				bOrder = ordered.length;
			}
			if (aOrder != bOrder)
				return aOrder - bOrder;
		}
		
		var aStartDate = getStartDate(a);
		var bStartDate = getStartDate(b);
		if (aStartDate > bStartDate) return 1;
		else if (aStartDate < bStartDate) return -1;
		else
		{
			var aEndDate = getEndDate(a);
			var bEndDate = getEndDate(b);
			if (aEndDate > bEndDate) return 1;
			else if (aEndDate < bEndDate) return -1;
			else return 0;
		}
		return aStartDate - bStartDate;
	}

	Pathway.prototype.DateToY = function(d)
	{
		var daySpan = (new TimeSpan(d-this.minDate)).days;
		return this.dataTopMargin + (this.timespan - daySpan) * this.dayHeight;
	}

	Pathway.prototype.getExperienceY = function(fd)
	{
		return this.DateToY(Date.parse(getEndDate(fd.experience)));
	}

	Pathway.prototype.getExperienceHeight = function(experience)
	{
		var startDate = getStartDate(experience);
		var endDate = getEndDate(experience);
		var days = (new TimeSpan(Date.parse(endDate)-Date.parse(startDate))).days;
		return days * this.dayHeight;
	}

	Pathway.prototype.getExperiencePath = function(g, fd)
	{
		var flagX = 2 * this.trunkWidth;
		var h = this.getExperienceHeight(fd.experience);
		var x1 = 0;
		var x2 = x1 + flagX + this.flagWidth;
		var x3 = x1 + flagX;
		var x4 = x1 + this.trunkWidth;
		var y1 = 0;
		var y2 = y1 + this.flagHeight;
		var y3;
		if (h < this.stemHeight)
			y3 = y1 + h;
		else
			y3 = y1 + this.stemHeight;
		var y4 = y1 + h;
		return this._lineFunction([{x: x1, y: y1}, 
							 {x: x2, y: y1}, 
							 {x: x2, y: y2}, 
							 {x: x3, y: y2}, 
							 {x: x3, y: y3}, 
							 {x: x4, y: y3}, 
							 {x: x4, y: y4}, 
							 {x: x1, y: y4}, 
							 {x: x1, y: y1}]);
	}
	
	Pathway.prototype.clearLayout = function()
	{
		/* Do whatever it takes to force layout when checkLayout is called. */
		this.isLayoutDirty = true;
	}
	
	Pathway.prototype.truncatedText = function(text, textNode, maxWidth)
	{
		var t = d3.select(textNode);
		t.text(text);
		if (text.length <= 1)
			return;
		else if (textNode.getBBox().width < maxWidth)
			return;
		
		var testText = text.slice(0, -1);
		while (testText.length > 0)
		{
			t.text(testText + "...");
			if (textNode.getBBox().width <= maxWidth)
				return;
			testText = testText.slice(0, -1);
		}
		t.text("...");
	}
	
	Pathway.prototype.scaleDayHeightToSize = function()
	{
		var containerHeight = $(this.svg.node()).height();
		var dataHeight = containerHeight - this.dataTopMargin - this.dataBottomMargin;
		var oldDayHeight = this.dayHeight;
		this.dayHeight = dataHeight / this.timespan;
		return oldDayHeight != this.dayHeight;
	}
	
	/* Lay out all of the contents within the svg object. */
	Pathway.prototype.layout = function()
	{
		var svgHeight = $(this.svg.node()).height();
		
		this.isMinHeight = (svgHeight == $(this.containerDiv).height());
		$(this.bg.node()).height(svgHeight);
		$(this.bg.node()).width($(this.svg.node()).width());
		$(this.bgTime.node()).height(svgHeight);
		
		this.sitePanel.contractButton
			.classed('disabled', svgHeight <= $(this.containerDiv).height())
			.classed('enabled', svgHeight > $(this.containerDiv).height());
	
		var columns = [];
		var g = this.experienceGroup.selectAll('g');
		var y = this.yearGroup.selectAll('text');
		
		var _thisPathway = this;
		
		var ordered = ["Housing", "Education", "Extra-Curricular", "Wellness", "Career & Finance", "Helping Out"];
		/* Restore the sort order to startDate/endDate */
		g.sort(function(a, b)
		{
			return _thisPathway._compareExperiences(a.experience, b.experience, ordered);
		});
	
		/* MaxHeight is the maximum height of the top of a column before skipping to the
			next column.
			this represents the SVG group being added. */
		function addToBestColumn(fd, columns)
		{
			var thisTop = fd.y;
			var thisBottom = fd.y + Math.max(fd.height, _thisPathway.flagHeight);
			var j;
			for (j = 0; j < columns.length; ++j)
			{
				// If this item's height + y is greater than the last item,
				// then add this to the column.
				var column = columns[j];
				var lastTop = d3.select(column[column.length - 1]).datum().y;
				if (lastTop > thisBottom)
				{
					column.push(this);
					break;
				}
				else
				{
					var isInserted = false;
					for (var i = column.length - 1; i > 0; --i)
					{
						var aboveFlag = d3.select(column[i]);
						var belowFlag = d3.select(column[i-1]);
						var aboveBottom = aboveFlag.datum().y + Math.max(aboveFlag.datum().height, _thisPathway.flagHeight);
						var belowTop = belowFlag.datum().y;
						if (thisTop > aboveBottom &&
							thisBottom < belowTop)
						{
							column.splice(i, 0, this);
							isInserted = true;
							break;
						}
						else if (thisTop < aboveBottom)
							break;
					}
					if (isInserted)
						break;
					var aboveFlag = d3.select(column[0]);
					var aboveDatum = aboveFlag.datum();
					var aboveBottom = aboveDatum.y + Math.max(aboveDatum.height, _thisPathway.flagHeight);
					if (thisTop > aboveBottom)
					{
						column.splice(0, 0, this);
						break;
					}
				}
			}
			if (j == columns.length)
			{
				columns.push([this]);
			}
		}
		
		/* Compute the y attribute for every item */
		
		/* Fit each item to a column, according to the best layout. */	
		g.each(function(fd, i)
			{
				fd.y = _thisPathway.getExperienceY(fd);
				fd.height = _thisPathway.getExperienceHeight(fd.experience);
				addToBestColumn.call(this, fd, columns);
			});
		
		/* Compute the column width for each column of flags + spacing to its right. 
			Add flagSpacing before dividing so that the rightmost column doesn't need spacing to its right.
		 */
		// var flagsLeft = this.dataLeftMargin + (this.trunkColumnWidth * columns.length) + this.flagsLeftMargin;
	
		var flagColumnWidth = ($(this.svg.node()).width() - this.flagsRightMargin + this.flagSpacing) / columns.length;
		this.flagWidth = flagColumnWidth - this.flagSpacing - (2 * this.trunkWidth);
		var textWidth = this.flagWidth - this.textLeftMargin - this.textRightMargin;
		if (textWidth < 0)
			textWidth = 0;
		
		/* Compute the x attribute for every item */
		/* Then, Add the items to the flag columns in the column order for better results than
			the current sort order.
		 */
		for (var j = 0; j < columns.length; ++j)
		{
			var x = (flagColumnWidth * j);
			var column = columns[j];
			for (var i = 0; i < column.length; ++i)
			{
				var fd = d3.select(column[i]).datum();
				fd.x = x;
			}
		}
	
		g.attr("transform", 
			function(fd)
			{
				return "translate(" + fd.x + "," + fd.y + ")";
			})
			
		if (this.detailFlagData != null)
		{
			/*( Restore the flagElement */
			 g.each(function(fd)
			 {
				if (fd === _thisPathway.detailFlagData)
					_thisPathway.flagElement = this;
			 });
		}
		
		if (columns.length > 0)
		{
			this.defs.selectAll('clipPath').remove();
			
			/* Add a clipPath for the text box size. */
			this.defs.append('clipPath')
				.attr('id', 'id_clipPath{0}'.format(this.clipID))
				.append('rect')
				.attr('x', 0)
				.attr('y', 0)
				.attr('height', this.flagHeight)
				.attr('width', textWidth);
			this.defs.append('clipPath')
				.attr('id', 'id_detailClipPath{0}'.format(this.clipID))
				.append('rect');
			this.defs.append('clipPath')
				.attr('id', 'id_detailIconClipPath{0}'.format(this.clipID))
				.append('rect');

			/* Transform each text node relative to its containing group. */
			g.selectAll('text').attr("transform", 
				"translate(" + ((2 * _thisPathway.trunkWidth) + _thisPathway.textLeftMargin).toString() + ", 0)")
				.each(function(fd) { _thisPathway.truncatedText(fd.getDescription(), this, textWidth); });
			
			/* Calculate the path for each containing group. */
			g.selectAll('path').attr("d", function(fd) {
					return _thisPathway.getExperiencePath(this.parentNode, fd);
				});
		}

		y.attr("y", function(d) { 
				return _thisPathway.DateToY(new Date(d, 0, 0));
			});
			
		if (y.size() >= 2)
		{
			var oldD0 = y[0][0];
			var thisHeight = oldD0.getBBox().height;
			var spacing = 365 * this.dayHeight;
			
			var yearPeriod = parseInt(thisHeight / spacing) + 1;
			if (yearPeriod == 1)
				y.attr("display", null);
			else
			{
				// Set the target so that the latest year is always visible.
				var target = (y.size() - 1) % yearPeriod;
				y.attr("display", function(d, i) { if (i % yearPeriod == target) return null; else return "none";});
			}
		}
	
		/* Hide the detail so that if detail is visible before a resize, it isn't left behind. */	
		if (this.detailFlagData != null)
		{
			this.refreshDetail();
		}
	}

	Pathway.prototype.checkLayout = function()
	{
		if ($(this.containerDiv).width() === 0)
			return;
		
		if (!this.isLayoutDirty)
			return;
		
		/* Calculate the height of the area where data appears and the height of a single day. */
		var dataHeight = this.dayHeight * this.timespan;
		var svgHeight = dataHeight + this.dataTopMargin + this.dataBottomMargin;
		var containerHeight = $(this.containerDiv).height();
		var containerWidth = $(this.containerDiv).width();

		$(this.svg.node()).height(svgHeight);
		$(this.svgTime.node()).height(svgHeight);
		
		this.layout();
		this.isLayoutDirty = false;
	}
	
	Pathway.prototype.scale = function(multiple)
	{
		var newDataHeight = this.dayHeight * multiple * this.timespan;
		var newContainerHeight = Math.max(newDataHeight + this.dataTopMargin + this.dataBottomMargin, 
										  $(this.containerDiv).height());
										  
		var _this = this;
		$(this.svg.node()).animate({height: newContainerHeight},
		   {duration: 400, easing: "swing",
			progress: function(animation, progress, remainingMs)
				{
					var containerNode = _this.pathwayContainer.node();
					var newContainerHeight = $(_this.svg.node()).height();
					var newContainerWidth = Math.max($(containerNode).width(),
													 newContainerHeight * $(_this.containerDiv).width() / $(_this.containerDiv).height()
														- _this.dataLeftMargin);
					var oldCenter = containerNode.scrollTop + $(containerNode).height() / 2;
					var oldDayHeight = _this.dayHeight;
					$(_this.svg.node()).width(newContainerWidth);
					$(_this.svgTime.node()).height(newContainerHeight);
					if (_this.scaleDayHeightToSize())
					{
						_this.layout();
						var newCenter = (oldCenter - _this.dataTopMargin) * (_this.dayHeight / oldDayHeight) + _this.dataTopMargin;
						if (containerNode.scrollTop > 0)
						{
							containerNode.scrollTop += newCenter - oldCenter;
							_this.timeContainer.node().scrollTop = containerNode.scrollTop;
						}
					}
				},
			 complete: unblockClick
			});
	}
	
	Pathway.prototype.setDateRange = function()
	{
		var birthday = this.user.getValue("Birthday");
		if (birthday && birthday.text)
			this.minDate = new Date(birthday.text);
		else
			this.minDate = new Date();
		
		this.maxDate = new Date();
		var _this = this;
		$(this.allExperiences).each(function()
			{
				var startDate = new Date(getStartDate(this));
				var endDate = new Date(getEndDate(this));
				if (_this.minDate > startDate)
					_this.minDate = startDate;
				if (_this.maxDate < endDate)
					_this.maxDate = endDate;
			});
			
		/* Make the timespan start on Jan. 1 of that year. */
		this.minDate.setUTCMonth(0);
		this.minDate.setUTCDate(1);
		
		if (this.maxDate < this.minDate)
		{
			/* Make sure that the maxDate is at least 365 days after the minDate, but no later than today. */
			this.maxDate = (new Date(this.minDate)).addDays(365);
			if (this.maxDate > new Date())
				this.maxDate = new Date();
		}
		
		/* Now make sure that the minimum date is at least a year before the maximum date. */
		var maxMinDate = (new Date(this.maxDate)).addDays(-365);
		if (this.minDate > maxMinDate)
			this.minDate = maxMinDate;
	
		this.timespan = new TimeSpan(this.maxDate - this.minDate).days;

		var minYear = this.minDate.getUTCFullYear();
		var maxYear = this.maxDate.getUTCFullYear();
		this.years = [];
		for (var y = minYear; y <= maxYear; ++y)
			this.years.push(y);

		/* create the set of text objects for each year. */
		this.yearGroup.selectAll('text').remove();
		this.yearGroup
			.selectAll('text')
			.data(this.years)
			.enter()
			.append('text')
			.text(function(d) { return d; })
			.attr("font", "sans-serif")
			.attr("font-size", "10px")
			.attr("x", this.textLeftMargin);
;
	}
	
	Pathway.prototype.checkDateRange = function(experience)
	{
		var oldMinDate = this.minDate;
		var oldMaxDate = this.maxDate;
		var oldMinYear = this.minDate.getUTCFullYear();	
		var oldMaxYear = this.maxDate.getUTCFullYear();	
		
		var startDate = new Date(getStartDate(experience));
		var endDate = new Date(getEndDate(experience));
		if (this.minDate > startDate)
			this.minDate = startDate;
		if (this.maxDate < endDate)
			this.maxDate = endDate;
		
		/* Make the timespan start on Jan. 1 of that year. */
		this.minDate.setUTCMonth(0);
		this.minDate.setUTCDate(1);
		
		var minYear = this.minDate.getUTCFullYear();
		var maxYear = this.maxDate.getUTCFullYear();
		
		this.timespan = new TimeSpan(this.maxDate - this.minDate).days;
		if (minYear < oldMinYear || maxYear > oldMaxYear)
		{
			this.years = [];
			for (var y = minYear; y <= maxYear; ++y)
				this.years.push(y);

			/* create the set of text objects for each year. */
			this.yearGroup.selectAll('text').remove();
			this.yearGroup
				.selectAll('text')
				.data(this.years)
				.enter()
				.append('text')
				.text(function(d) { return d; })
				.attr("font", "sans-serif")
				.attr("font-size", "10px")
				.attr("x", this.textLeftMargin);
		}
			
		return this.minDate < oldMinDate || this.maxDate > oldMaxDate;
	}
	
	Pathway.prototype.getServiceDomain = function(service)
	{
		return service.getValue("Service Domain");
	}
	
	Pathway.prototype.setColorByService = function(service)
	{
		var serviceInstance = crp.getInstance(service.getValueID());
		var serviceDomain = serviceInstance && serviceInstance.getValue("Service Domain");
		if (serviceDomain && serviceDomain.getValueID())
		{
			var sdInstance = crp.getInstance(serviceDomain.getValueID());
			color = sdInstance.getValue("Color");
			if (color && color.text)
				this.attr("fill", color.text)
					 .attr("stroke", color.text);
		}
		else
			this.attr("fill", otherColor)
				.attr("stroke", otherColor);
	}

	Pathway.prototype.setColor = function(fd)
	{
		var _this = d3.select(this);

		var offering = fd.experience.getValue("Offering");
		if (offering && offering.getValueID())
		{
			var experienceColor = otherColor;
			var service = offering.getValue("Service");
			if (service)
				Pathway.prototype.setColorByService.call(_this, service);
			else
				_this.attr("fill", otherColor)
					 .attr("stroke", otherColor);
		}
		else
		{
			var service = fd.experience.getValue("Service");
			if (service && service.getValueID())
				Pathway.prototype.setColorByService.call(_this, service);
			else
				_this.attr("fill", otherColor)
					 .attr("stroke", otherColor);
		}
	}

	Pathway.prototype.showDetailPanel = function(fd, i)
	{
		if (prepareClick('click', 'show experience detail: ' + fd.getDescription()))
		{
			var panel = $(this).parents(".site-panel")[0];
			var editPanel = new EditExperiencePanel(fd.experience, panel, revealPanelLeft);
												  
			revealPanelLeft(editPanel.node());
			d3.event.stopPropagation();
		}
	}
	
	Pathway.prototype.showDetailGroup = function(g, fd, duration)
	{
		duration = (duration !== undefined ? duration : 700);
		var _this = this;
		
		this.detailGroup.datum(fd);
		this.detailGroup.selectAll('rect').datum(fd);
		var detailText = this.detailGroup.append('text')
			.attr("width", "100")
			.attr("height", "1")
			.attr('clip-path', 'url(#id_detailClipPath{0})'.format(this.clipID));
			
		var hasEditChevron = fd.experience.typeName == "More Experience" && fd.experience.canWrite();

		var lines = [];
	
		var s;
		s = fd.pickedOrCreatedValue("Offering", "User Entered Offering");
		if (s && s.length > 0 && lines.indexOf(s) < 0)
		{
			var tspan = detailText.append('tspan')
				.style("font-weight", "bold")
				.text(s)
				.attr("x", this.textDetailLeftMargin)
				.attr("dy", 
					function(d) {
						return $(this).height() + _this.detailTextSpacing;
					});
		}
			
		s = fd.pickedOrCreatedValue("Organization", "User Entered Organization");
		if (s && s.length > 0 && lines.indexOf(s) < 0)
		{
			var tspan = detailText.append('tspan')
				.text(s)
				.attr("x", this.textDetailLeftMargin)
				.attr("dy", 
					function(d) {
						return $(this).height() + _this.detailTextSpacing;
					});
		}

		s = fd.pickedOrCreatedValue("Site", "User Entered Site");
		if (s && s.length > 0 && lines.indexOf(s) < 0)
		{
			var tspan = detailText.append('tspan')
				.classed('address-line', true)
				.text(s)
				.attr("x", this.textDetailLeftMargin);
				
			tspan.attr("dy", 
					function(d) {
						return $(this).height() + _this.detailTextSpacing;
					});
		}

		s = getDateRange(fd.experience);
		if (s && s.length > 0)
		{
			var tspan = detailText.append('tspan')
				.text(s)
				.attr("x", this.textDetailLeftMargin);
				
			tspan.attr("dy", 
					function(d) {
						return $(this).height() + _this.detailTextSpacing;
					});
		}
		
		var x = fd.x + 2 * this.trunkWidth;
		var y = fd.y;

		var textBox = detailText.node().getBBox();
		
		var iconAreaWidth = (hasEditChevron ? this.showDetailIconWidth + this.textDetailLeftMargin : 0);
		var maxX = $(this.svg.node()).width() - this.flagsRightMargin - textBox.width - iconAreaWidth - (this.textDetailLeftMargin * 2);
		if (x > maxX)
			x = maxX;
		var rectWidth = textBox.width + iconAreaWidth + (this.textDetailLeftMargin * 2);
		if (rectWidth < this.flagWidth)
		{
			rectWidth = this.flagWidth;
			textBox.width = rectWidth - iconAreaWidth - (this.textDetailLeftMargin * 2);
		}

		s = getMarkerList(fd.experience);
		if (s && s.length > 0)
		{
			var text = d3.select(this),
				words = s.split(/\s+/).reverse(),
				word,
				line = [],
				tspan = detailText.append("tspan").attr("x", this.textDetailLeftMargin).classed('markers', true);
			while (word = words.pop()) {
			  line.push(word);
			  tspan.text(line.join(" "));
			  if (tspan.node().getComputedTextLength() > textBox.width) {
				line.pop();
				tspan.text(line.join(" "));
				tspan.attr("dy", 
					function(d) {
						return $(this).height() + _this.detailTextSpacing;
					});
				line = [word];
				tspan = detailText.append("tspan").attr("x", this.textDetailLeftMargin).classed('markers', true).text(word);
			  }
			}
			tspan.attr("dy", 
				function(d) {
					return $(this).height() + _this.detailTextSpacing;
				});

			textBox = detailText.node().getBBox();
		}

		var rectHeight = textBox.height + (textBox.y * 2);
		var strokeWidth = parseInt($(this.detailFrontRect.node()).css("stroke-width"));
		var maxY = $(this.svg.node()).height() - rectHeight - strokeWidth;
		if (y > maxY)
			y = maxY;
			
		this.detailGroup.attr("x", x)
				 .attr("y", y)
				 .attr("transform", "translate("+x + "," + y+")")
				 .attr("height", 0);
		this.detailGroup.selectAll('rect')
			.attr("width", rectWidth)
		   .attr("x", textBox.x - this.textDetailLeftMargin)
		   .attr("y", 0);
		this.detailFrontRect.each(this.setColor)
					   .each(this.setupServicesTriggers);
		if (duration > 0)
		{
			this.detailGroup.selectAll('rect').attr("height", 0)
					   .transition()
					   .duration(duration)
					   .attr("height", rectHeight);
		}
		else
		{
			this.detailGroup.selectAll('rect').attr("height", rectHeight);
		}
	   
		/* Set the clip path of the text to grow so the text is revealed in parallel */
		var textClipRect = d3.select("#id_detailClipPath{0}".format(this.clipID)).selectAll('rect')
			.attr('x', textBox.x)
			.attr('y', textBox.y)
			.attr('width', textBox.width); 
		
		var iconClipRect;
		
		if (hasEditChevron)
		{	
			iconClipRect = d3.select("#id_detailIconClipPath{0}".format(this.clipID)).selectAll('rect')
				.attr('x', rectWidth - this.showDetailIconWidth - this.textDetailLeftMargin)
				.attr('y', textBox.y)
				.attr('width', this.showDetailIconWidth);
				
			var detailChevron = this.detailGroup.append('image')
				.attr("width", this.showDetailIconWidth)
				.attr("height", this.showDetailIconWidth)
				.attr("xlink:href", rightChevronPath)
				.attr('clip-path', 'url(#id_detailIconClipPath{0})'.format(this.clipID))

			detailChevron.attr('x', rectWidth - this.showDetailIconWidth - this.textDetailLeftMargin)
				.attr('y', textBox.y + (textBox.height - this.showDetailIconWidth) / 2);
		}
			
		if (duration > 0)
		{
			textClipRect.attr('height', 0)
				.transition()
				.duration(duration)
				.attr('height', textBox.height); 
			detailText				
				.transition()
				.duration(duration)
				.attr("height", textBox.height);

			if (hasEditChevron)
				iconClipRect.attr('height', 0)
					.transition()
					.duration(duration)
					.attr('height', textBox.height);
		}
		else
		{
			textClipRect.attr('height', textBox.height); 
			detailText.attr("height", textBox.height);
			if (hasEditChevron)
				iconClipRect.attr('height', textBox.height);
		}
		
		this.detailFlagData = fd;
		this.flagElement = g;
		
		var experience = this.detailFlagData.experience;
		[experience.getCell("Organization"),
		 experience.getCell("User Entered Organization"),
		 experience.getCell("Site"),
		 experience.getCell("User Entered Site"),
		 experience.getCell("Start"),
		 experience.getCell("End"),
		 experience.getCell("Service"),
		 experience.getCell("User Entered Service")].forEach(function(d)
		 {
			/* d will be null if the experience came from the organization for the 
				User Entered Organization and User Entered Site.
			 */
			if (d)
			{
				$(d).on("dataChanged.cr", null, _this, _this.handleChangeDetailGroup);
				$(d).on("valueAdded.cr", null, _this, _this.handleChangeDetailGroup);
			}
		 });
		[experience.getCell("Service"),
		 experience.getCell("User Entered Service")].forEach(function(d)
		 {
			/* d will be null if the experience came from the organization for the 
				User Entered Organization and User Entered Site.
			 */
			if (d)
			{
				$(d).on("valueDeleted.cr", null, _this, _this.handleChangeDetailGroup);
			}
		 });
		 
	}
	
	Pathway.prototype.handleChangeDetailGroup = function(eventObject, newValue)
	{
		if (!(eventObject.type == "valueAdded" && newValue && newValue.isEmpty()))
			eventObject.data.refreshDetail();
	}
	
	Pathway.prototype.clearDetail = function()
	{
		this.detailGroup.selectAll('text').remove();
		this.detailGroup.selectAll('rect').attr('height', 0);
		/* Remove the image here instead of when the other clipPath ends
			so that it is sure to be removed when the done method is called. 
		 */
		this.detailGroup.selectAll('image').remove();
		d3.select("#id_detailClipPath{0}".format(this.clipID)).attr('height', 0);
		d3.select("#id_detailIconClipPath{0}".format(this.clipID)).attr('height', 0);
		
		var _this = this;
		if (this.detailFlagData)
		{
			var experience = this.detailFlagData.experience;
			[experience.getCell("Organization"),
			 experience.getCell("User Entered Organization"),
			 experience.getCell("Site"),
			 experience.getCell("User Entered Site"),
			 experience.getCell("Start"),
			 experience.getCell("End"),
			 experience.getCell("Service"),
			 experience.getCell("User Entered Service")].forEach(function(d)
			 {
				/* d will be null if the experience came from the organization for the 
					User Entered Organization and User Entered Site.
				 */
			 	if (d)
			 	{
					$(d).off("dataChanged.cr", null, _this.handleChangeDetailGroup);
					$(d).off("valueAdded.cr", null, _this.handleChangeDetailGroup);
				}
			 });
			[experience.getCell("Service"),
			 experience.getCell("User Entered Service")].forEach(function(d)
			 {
				/* d will be null if the experience came from the organization for the 
					User Entered Organization and User Entered Site.
				 */
				if (d)
				{
					$(d).off("valueDeleted.cr", null, _this.handleChangeDetailGroup);
				}
			 });
			 
			 this.detailFrontRect.each(this.clearServicesTriggers);
			 
		}
		
		this.detailGroup.datum(null);
		this.detailGroup.selectAll('rect').datum(null);
		this.detailFlagData = null;
		this.flagElement = null;
	}

	Pathway.prototype.hideDetail = function(done, duration)
	{
		duration = (duration !== undefined ? duration : 250);
		
		var _this = this;
		if (this.flagElement != null)
		{
			if (duration === 0)
			{
				this.clearDetail();
				if (done) done();
			}
			else
			{
				d3.select("#id_detailClipPath{0}".format(this.clipID)).selectAll('rect')
					.transition()
					.attr("height", 0)
					.duration(duration)
					.each("end", function() {
						_this.clearDetail();
						if (done)
							done();
					});
				d3.select("#id_detailIconClipPath{0}".format(this.clipID)).selectAll('rect')
					.transition()
					.duration(duration)
					.attr("height", 0);
				this.detailGroup.selectAll('rect')
					.transition()
					.duration(duration)
					.attr("height", 0);
			}
		}
		else if (done)
			done();
	}
	
	Pathway.prototype.refreshDetail = function()
	{
		var oldFlagData = this.detailFlagData;
		var oldElement = this.flagElement;
		var _this = this;
		this.hideDetail(
			function() { _this.showDetailGroup(oldElement, oldFlagData, 0); },
			0);
	}
	
	/* setup up each group (this) that displays an experience to delete itself if
		the experience is deleted.
	 */
	Pathway.prototype.setupDelete = function(fd, node) 
	{
		var _this = this;
		var valueDeleted = function(eventObject)
		{
			d3.select(eventObject.data).remove();
			_this.handleValueDeleted(this);
		};
		
		var dataChanged = function(eventObject)
		{
			d3.select(eventObject.data).selectAll('text')
				.text(function(d) { return d.getDescription(); })
		}
		
		$(fd.experience).one("valueDeleted.cr", null, node, valueDeleted);
		$(fd.experience).on("dataChanged.cr", null, node, dataChanged);
		
		$(node).on("remove", null, fd.experience, function()
		{
			$(eventObject.data).off("valueDeleted.cr", null, valueDeleted);
			$(eventObject.data).off("dataChanged.cr", null, dataChanged);
		});
	}
	
	Pathway.prototype.handleChangeServices = function(eventObject)
	{
		var rect = d3.select(eventObject.data);
		var experience = rect.datum();
		
		Pathway.prototype.setColor.call(eventObject.data, experience);
	}
	
	Pathway.prototype.setupServicesTriggers = function(fd)
		{
			var e = fd.experience;
			var serviceCell = e.getCell("Service");
			var userServiceCell = e.getCell("User Entered Service");
			$(serviceCell).on("valueAdded.cr valueDeleted.cr dataChanged.cr", null, this, Pathway.prototype.handleChangeServices);
			$(userServiceCell).on("valueAdded.cr valueDeleted.cr dataChanged.cr", null, this, Pathway.prototype.handleChangeServices);
		}
	
	Pathway.prototype.clearServicesTriggers = function(fd)
		{
			var e = fd.experience;
			var serviceCell = e.getCell("Service");
			var userServiceCell = e.getCell("User Entered Service");
			$(serviceCell).off("valueAdded.cr valueDeleted.cr dataChanged.cr", null, Pathway.prototype.handleChangeServices);
			$(userServiceCell).off("valueAdded.cr valueDeleted.cr dataChanged.cr", null, Pathway.prototype.handleChangeServices);
		}
	
	Pathway.prototype.appendExperiences = function()
	{
		var _this = this;

		this.experienceGroup.selectAll('g').remove();
		var g = this.experienceGroup.selectAll('g')
			.data(this.allExperiences.map(function(e) { return new FlagData(e); }))
			.enter()
			.append('g')
			.each(function(d)
				{
					_this.setupDelete(d, this);
				});
		
		function showDetail(fd, i)
		{
			cr.logRecord('click', 'show detail: ' + fd.getDescription());
			var g = this.parentNode;
			var pathway = this.pathway;
			
			pathway.hideDetail(function() {
					pathway.showDetailGroup(g, fd); 
				});
		}
		
		/* Set up a clipID that uniquely identifies the clip paths for this Pathway. */
		this.clipID = Pathway.prototype.nextClipID;
		Pathway.prototype.nextClipID += 1;

		g.append('path')
			.each(function()
				{ this.pathway = _this; })
			.attr("fill", '#FFFFFF')
			.attr("stroke", '#FFFFFF');

		g.append('path')
			.each(function()
				{ this.pathway = _this; })
			.attr("fill-opacity", "0.3")
			.attr("stroke-opacity", "0.7")
			.on("click", function() 
				{ 
					d3.event.stopPropagation(); 
				})
			.on("click.cr", showDetail)
			.each(this.setColor)
			.each(this.setupServicesTriggers);

		/* t is the set of all text nodes. */
		var t = g.append('text')
			.each(function() { this.pathway = _this; })
			.attr("x", 0)
			.attr("dy", "1.1")
			.attr('clip-path', 'url(#id_clipPath{0})'.format(_this.clipID))
			.text(function(fd) { return fd.getDescription(); })
			.on("click", function() 
				{ 
					d3.event.stopPropagation(); 
				})
			.on("click.cr", showDetail);
	
		/* bbox is used for various height calculations. */
		var bbox;
		if (t.node())
			bbox = t.node().getBBox();
		else
			bbox = {height: 20, y: -18};
			
		this.flagHeight = bbox.height + this.textBottomBorder;

		t.attr("y", function()
			{
				return 0 - bbox.y;
			});
	
		this.clearLayout();
		this.checkLayout();
	}
	
	Pathway.prototype.handleDataChanged = function(eventObject)
	{
		var _this = eventObject.data;

		_this.clearLayout();
		_this.checkLayout();
	}
	
	Pathway.prototype.handleValueDeleted = function(experience)
	{
		var index = this.allExperiences.indexOf(experience);
		if (index >= 0)
			this.allExperiences.splice(index, 1);
		if (experience == this.detailFlagData.experience)
			this.hideDetail(function() { }, 0);
		this.clearLayout();
		this.checkLayout();
	};

	Pathway.prototype.handleExperienceDateChanged = function(eventObject)
	{
		var _this = eventObject.data;
		_this.setDateRange();
		_this.appendExperiences();
	}
		
	Pathway.prototype.setupExperienceTriggers = function(experience)
	{
		var _this = this;
		
		$(experience).on("dataChanged.cr", null, this, this.handleDataChanged);
		$(experience.getCell("Start")).on("valueAdded.cr valueDeleted.cr dataChanged.cr", null, this, this.handleExperienceDateChanged);
		$(experience.getCell("End")).on("valueAdded.cr valueDeleted.cr dataChanged.cr", null, this, this.handleExperienceDateChanged);
		
		$(this.sitePanel.node()).on("remove", null, experience, function(eventObject)
		{
			$(eventObject.data).off("dataChanged.cr", null, _this.handleDataChanged);
			$(eventObject.data.getCell("Start")).off("valueAdded.cr valueDeleted.cr dataChanged.cr", null, this.handleExperienceDateChanged);
			$(eventObject.data.getCell("End")).off("valueAdded.cr valueDeleted.cr dataChanged.cr", null, this.handleExperienceDateChanged);
		});
	}
	
	Pathway.prototype.checkOfferingCells = function(experience)
	{
		offering = experience.getValue("Offering");
		if (offering && offering.getValueID() && !offering.isDataLoaded)
		{
			var storedI = crp.getInstance(offering.getValueID());
			offering.importCells(storedI.cells);
		}
	}
	
	Pathway.prototype.addMoreExperience = function(experience)
	{
		this.checkDateRange(experience);
		experience.typeName = "More Experience";
		
		this.checkOfferingCells(experience);
		
		this.allExperiences.push(experience);
		
		this.setupExperienceTriggers(experience);
		
		this.appendExperiences();
		
		if (this.loadingText)
		{
			this.loadingText.remove();
			this.promptAddText.remove();
			this.loadingText = null;
			this.promptAddText = null;
		}
	}
	
	Pathway.prototype.handleResize = function()
	{
		this.sitePanel.calculateHeight();
		
		var newHeight = this.sitePanel.scrollAreaHeight();
		var pathwayContainer = $(this.pathwayContainer.node());
		$(this.timeContainer.node()).height(newHeight);
		pathwayContainer.height(newHeight);
		pathwayContainer.width(this.sitePanel.scrollAreaWidth() - this.dataLeftMargin);
		
		var svg = $(this.svg.node());
		var isPinnedHeight = (this.isMinHeight && svg.height() > newHeight);
		var isPinnedWidth = (this.isMinHeight && svg.width() > pathwayContainer.width());
		
		if (svg.height() < newHeight ||
			isPinnedHeight ||
			svg.width() != pathwayContainer.width())
		{
			if (svg.height() < newHeight ||
				isPinnedHeight)
			{
				svg.height(newHeight);
				this.scaleDayHeightToSize();
			}
				
			if (svg.width() < pathwayContainer.width() ||
				isPinnedHeight ||
				isPinnedWidth)
				svg.width(pathwayContainer.width());
				
			this.clearLayout();
			this.checkLayout();
		}
	}
	
	Pathway.prototype.showAllExperiences = function()
	{
		this.setDateRange();
		this.scaleDayHeightToSize();
		
		var _this = this;
		
		var resizeFunction = function()
		{
			_this.handleResize();
		}
	
		var node = this.sitePanel.node();
		this.allExperiences.filter(function(d)
			{
				return d.typeName === "More Experience";
			})
			.forEach(function(d)
			{
				_this.setupExperienceTriggers(d);
			});

		$(window).on("resize", null, this, resizeFunction);
		$(this).on("clearing.cr", function()
		{
			$(window).off("resize", null, resizeFunction);
		});
		$(this).on("clear.cr", function()
		{
			$(window).off("resize", null, resizeFunction);
		});
	
		this.appendExperiences();
	}
		
	Pathway.prototype.clear = function()
	{
		$(this).trigger("clear.cr");
		
		d3.select(this.containerDiv).selectAll('div').remove();
		
		this.user = null;
		this.allExperiences = [];
		this.pathwayContainer = null;
		this.timeContainer = null;
		this.svg = null;
		this.svgTime = null;
		this.defs = null;
		this.bg = null;
		this.bgTime = null;
		this.loadingText = null;
		this.promptAddText = null;
		this.experienceGroup = null;
		this.yearGroup = null;
		this.detailGroup = null;
		this.detailFrontRect = null;
		this.detailBackRect = null;
	
		this.detailFlagData = null;
		this.flagElement = null;
		this.flagHeight = 0;
		this.flagWidth = 0;
	
		this.minDate = null;
		this.maxDate = null;
		this.timespan = 0;
		this.isLayoutDirty = true;
		this.isMinHeight = false;
		this.dayHeight = 0;
		this.years = [];
	}
	
	Pathway.prototype.setUser = function(user, editable)
	{
		if (user.privilege === '_find')
			throw "You do not have permission to see information about {0}".format(user.getDescription());
		if (this.user)
			throw "user has already been set for this pathway";
			
		var _this = this;
		
		this.user = user;
		editable = (editable !== undefined ? editable : true);
		
		var container = d3.select(this.containerDiv);
		
		this.timeContainer = container.append('div')
			.classed("years", true)
			.style("width", this.dataLeftMargin)
			.style("height", "100%");
		
		this.svgTime = this.timeContainer.append('svg')
			.style("width", this.dataLeftMargin)
			.style("height", "100%");

		this.pathwayContainer = container.append('div')
			.classed("pathway", true)
			.style("width", $(this.containerDiv).width() - this.dataLeftMargin)
			.style("height", "100%");
			
		this.svg = this.pathwayContainer.append('svg')
			.classed("pathway", true)
			.style("width", $(this.containerDiv).width() - this.dataLeftMargin)
			.style("height", "100%");
		
		/* Keep the scrolling of the timeContainer and the pathwayContainer synchronized */
		var timeScroller = function()
			{
				var n = _this.pathwayContainer.node();
				if (this.scrollTop != n.scrollTop)
				{
					$(n).off("scroll", pathwayScroller);
					$(n).one("scroll", pathwayScrollReset);
					n.scrollTop = this.scrollTop;
				}
			}
		var timeScrollReset = function()
			{
				$(this).scroll(timeScroller);
			}
			
		var pathwayScroller = function()
			{
				var n = _this.timeContainer.node();
				if (this.scrollTop != n.scrollTop)
				{
					$(n).off("scroll", timeScroller);
					$(n).one("scroll", timeScrollReset);
					n.scrollTop = this.scrollTop;
				}
			}
		var pathwayScrollReset = function()
			{
				$(this).scroll(pathwayScroller);
			}
			
			
		$(this.timeContainer.node()).scroll(timeScroller);
		$(this.pathwayContainer.node()).scroll(pathwayScroller);

		this.defs = this.svg.append('defs');
	
		/* bg is a rectangle that fills the background with the background color. */
		this.bg = this.svg.append('rect')
			.attr("x", 0).attr("y", 0)
			.style("width", "100%")
			.style("height", "100%")
			.attr("fill", this.pathBackground);
			
		/* bgTime is a rectangle that fills the background of the timeline with the background color. */
		this.bgTime = this.svgTime.append('rect')
			.attr("x", 0).attr("y", 0)
			.style("width", "100%")
			.style("height", "100%")
			.attr("fill", this.pathBackground);
			
		this.loadingMessage = crv.appendLoadingMessage(this.containerDiv)
			.style("position", "absolute")
			.style("left", "0")
			.style("top", "0");
		
		this.experienceGroup = this.svg.append('g')
				.attr("font-family", "San Francisco,Helvetica Neue,Arial,Helvetica,sans-serif")
				.attr("font-size", "1.3rem");
		this.yearGroup = this.svgTime.append('g')
			.attr("fill", "#777");
			
		this.detailGroup = this.svg.append('g')
				.attr("font-family", "San Francisco,Helvetica Neue,Arial,Helvetica,sans-serif")
				.attr("font-size", "1.3rem")
			.style("width", "100%")
			.style("height", "100%")
			.on("click", function(d) 
				{ 
					d3.event.stopPropagation(); 
				})
			.on("click.cr", this.showDetailPanel);
		this.detailBackRect = this.detailGroup.append('rect')
			.attr("fill", this.pathBackground)
			.attr("width", "100%");
		this.detailFrontRect = this.detailGroup.append('rect')
			.attr("fill-opacity", "0.3")
			.attr("stroke-opacity", "0.8")
			.attr("width", "100%");
			
		$(_this.sitePanel.node()).one("revealing.cr", function()
			{
				$(_this.svg.node()).width(_this.sitePanel.scrollAreaWidth() - _this.dataLeftMargin);
			});

		d3.select(this.containerDiv).selectAll('svg')
			.on("click", function() 
			{ 
				d3.event.stopPropagation(); 
			})
			.on("click.cr", function() {
				cr.logRecord('click', 'hide details');
				_this.hideDetail();
			});
		
		var successFunction1 = function(experiences)
		{
			_this.allExperiences = experiences;
			$(experiences).each(function()
			{
				this.typeName = "Experience";
				this.setDescription(this.getValue("Offering").getDescription());
			});
		
			crp.getData({path: "#" + _this.user.getValueID() + '::reference(Experience)::reference(Experiences)' + 
								'::reference(Session)::reference(Sessions)::reference(Offering)',
						 done: function(newInstances)
							{
							},
							fail: asyncFailFunction});
			crp.getData({path: "#" + _this.user.getValueID() + '>"More Experiences">"More Experience">Offering',
						 done: function(newInstances)
							{
							},
							fail: asyncFailFunction});			
			crp.getData({path: "Service", 
						 done: function(newInstances)
							{
							},
							fail: asyncFailFunction});
			crp.getData({path: '"Service Domain"', 
						 done: function(newInstances)
							{
								for (i = 0; i < newInstances.length; ++i)
								{
									if (newInstances[i].getDescription() == "Other")
									{
										color = newInstances[i].getValue("Color");
										if (color && color.text)
											otherColor = color.text;
										break;
									}
								}
							},
						fail: asyncFailFunction});
								
			crp.pushCheckCells(_this.user, undefined, 
				function() {
					var m = _this.user.getValue("More Experiences");
					if (m && m.getValueID())
					{
						m.getCellData("More Experience",
									  successFunction2, 
									  asyncFailFunction);
					}
					else
						successFunction2([]);	/* There are none. */
				},
				function(err)
				{
					asyncHidePanelRight(_this.sitePanel.node());
					asyncFailFunction(err);
				});
		}

		var successFunction2 = function(experiences)
		{
			_this.allExperiences = _this.allExperiences.concat(experiences);
			
			$(experiences).each(function()
			{
				this.typeName = "More Experience";
				this.calculateDescription();
			});
			
			/* Ensure that all of the offerings have their associated cells. */
			_this.allExperiences.forEach(_this.checkOfferingCells);
		
			_this.showAllExperiences();
			
			crv.stopLoadingMessage(_this.loadingMessage);
			_this.loadingMessage.remove();
			
			if (_this.allExperiences.length == 0 && editable)
			{
				_this.loadingText = _this.svg.append('text')
					.attr("x", 0).attr("y", 0)
					.attr("fill", "#777")
					.text('Ready to record an experience?');
				
				_this.loadingText
					.attr("y", _this.loadingText.node().getBBox().height);
			
				var bbox = _this.loadingText.node().getBBox();
				_this.promptAddText = _this.svg.append('text')
					.attr("fill", "#2C55CC")
					.text(" Record one now.")
					.on("click", function(d) {
						if (prepareClick('click', 'Record one now prompt'))
						{
							try
							{
								showClickFeedback(this);
								var newPanel = new NewExperiencePanel(_this, _this.sitePanel.node());
							}
							catch (err)
							{
								syncFailFunction(err);
							}
						}
						d3.event.preventDefault();
					})
					.attr("cursor", "pointer");
				
				var newBBox = _this.promptAddText.node().getBBox();
				if (bbox.x + bbox.width + _this.textLeftMargin + newBBox.width >
					$(_this.bg.node()).width - _this.flagsRightMargin)
				{
					_this.promptAddText.attr("x", _this.loadingText.attr("x"))
						.attr("y", parseFloat(_this.loadingText.attr("y")) + bbox.height);
				}
				else
				{
					_this.promptAddText.attr("x", bbox.x + bbox.width + _this.textLeftMargin)
						.attr("y", _this.loadingText.attr("y"));
				}
			}
			
			$(_this).trigger("userSet.cr");
		}
		
		var path = "#" + this.user.getValueID() + '::reference(Experience)';
		cr.getData({path: path, 
				   fields: ["parents"], 
				   done: successFunction1, 
				   fail: asyncFailFunction});
	}

	function Pathway(sitePanel, containerDiv) {
		this.containerDiv = containerDiv;
		this.sitePanel = sitePanel;
		this.detailFlagData = null;
		this.flagElement = null;
		this.allExperiences = [];
		
		$(this).on("clear.cr", null, null, function() {
			this.clearDetail();
		});
		
	}
	
	return Pathway;
})();

var PathwayPanel = (function () {
	PathwayPanel.prototype = new SitePanel();
	PathwayPanel.prototype.pathway = null;
	
	function PathwayPanel(user, previousPanel, canDone) {
		canDone = canDone !== undefined ? canDone : true;
		var _this = this;

		SitePanel.call(this, previousPanel, null, "My Pathway", "pathway");
		var navContainer = this.appendNavContainer();
		if (canDone)
		{
			var backButton = navContainer.appendLeftButton()
				.on("click", handleCloseRightEvent);
			backButton.append("span").text("Done");
		}
		
		if (user == cr.signedinUser)
		{
			var signinSpan = navContainer.appendRightButton()
				.on("click", function()
					{
						showClickFeedback(this);
						if (prepareClick('click',  'Sign Out button'))
						{
							if (cr.signedinUser.getValueID())
							{
								var successFunction = function()
								{
									cr.signedinUser.clearValue();
									$(cr.signedinUser).trigger("signout.cr");
									unblockClick();
								};
					
								sign_out(successFunction, syncFailFunction);
							}
							else
							{
								showFixedPanel(_this.node(), "#id_sign_in_panel");
							}
						}
						d3.event.preventDefault();
					})
				.append('span').text('Sign Out');
			
			updateSignoutText = function(eventObject) {
				var panel = new WelcomePanel(previousPanel);
				if (_this.pathway)
					$(_this.pathway).trigger("clearing.cr");
				showPanelLeft(panel.node(),
					function()
					{
						$(_this.node()).remove();
					});
			};
			
			$(cr.signedinUser).on("signout.cr", null, signinSpan.node(), updateSignoutText);
			$(this.node()).on("remove", null, cr.signedinUser, function(eventObject)
				{
					$(cr.signedinUser).off("signout.cr", null, updateSignoutText);
				});
		}

		navContainer.appendTitle(getUserDescription(user));
		
		var panel2Div = this.appendScrollArea();
		panel2Div.classed('vertical-scrolling', false)
			.classed('no-scrolling', true);

		var bottomNavContainer = this.appendBottomNavContainer();

		var settingsButton = bottomNavContainer.appendLeftButton()
			.on("click", 
				function() {
					if (prepareClick('click', "Settings"))
					{
						var settings = new Settings(user, _this.node());
					}
					d3.event.preventDefault();
				});
		settingsButton.append("i").classed("site-active-text fa fa-lg fa-cog", true);
		settingsButton.style("display", "none");

		var sharingButton = bottomNavContainer.appendLeftButton()
			.on("click", 
				function() {
					if (prepareClick('click', "Sharing"))
					{
						var settings = new SharingPanel(user, _this.node());
					}
		
					d3.event.preventDefault();
				});
		sharingButton.append("i").classed("site-active-text fa fa-lg fa-users", true);
		sharingButton.style("display", "none");
		
		var findButton = bottomNavContainer.appendRightButton()
				.on("click",
					function() {
						if (prepareClick('click', 'find experience'))
						{
							showClickFeedback(this);
							var newPanel = new FindExperiencePanel(cr.signedinUser, null, null, _this.node());
							showPanelLeft(newPanel.node(), unblockClick);
						}
						d3.event.preventDefault();
					});
		findButton.append("i").classed("site-active-text fa fa-lg fa-search", true);
		findButton.style("display", "none");
		
		var addExperienceButton = bottomNavContainer.appendRightButton()
			.on("click", function(d) {
				if (prepareClick('click', 'add experience'))
				{
					showClickFeedback(this);
	
					var newPanel = new NewExperiencePanel(_this.pathway, _this.node());
				}
				d3.event.preventDefault();
			});
		addExperienceButton.append("i").classed("site-active-text fa fa-lg fa-plus", true);
		addExperienceButton.style("display", "none");
		
		/* Add buttons that sit on top of the scroll area. */
		this.expandButton = this.panelDiv.append('button')
			.classed('expand', true)
			.on('click', function(d)
				{
					if (prepareClick('click', 'year'))
					{
						_this.pathway.scale(1.3);
						d3.event.preventDefault();
					}
				});
		this.expandButton
			.append('span').text("+");
		this.contractButton = this.panelDiv.append('button')
			.classed('contract', true)
			.on('click', function(d)
				{
					if (prepareClick('click', 'year'))
					{
						_this.pathway.scale(1/1.3);
						d3.event.preventDefault();
					}
				});
		this.contractButton
			.append('span').text("—");
		
		if (this.pathway)
			throw "pathway already assigned to pathway panel";
			
		this.pathway = new Pathway(this, panel2Div.node());
		
		$(this.node()).on("remove", function()
		{
			_this.pathway.clear();
		});
		
		$(this.pathway).on("userSet.cr", function()
			{
				var moreExperiences = user.getValue("More Experiences");
				var canAddExperience = (moreExperiences.getValueID() === null ? user.canWrite() : moreExperiences.canWrite());
				addExperienceButton.style("display", canAddExperience ? null : "none");
				settingsButton.style("display", user.privilege === "_administer" ? null : "none");
				sharingButton.style("display", user.privilege === "_administer" ? null : "none");
				findButton.style("display", user.privilege === "_administer" ? null : "none");
			});
	}
	
	return PathwayPanel;
})();

var ExperienceDetailPanel = (function () {
	ExperienceDetailPanel.prototype = new SitePanel();
	ExperienceDetailPanel.prototype.experience = null;
	
	ExperienceDetailPanel.prototype.setupTarget = function(targetNode, d, cellName, update)
	{
		var pickDatum = d.getCell(cellName).data[0];
		
		$(pickDatum).on("valueAdded.cr valueDeleted.cr dataChanged.cr", null, targetNode, update);
		
		$(targetNode).on("remove", function() {
			$(pickDatum).off("valueAdded.cr valueDeleted.cr dataChanged.cr", null, update);
		});
		update.call(this, {data: targetNode});
	}
	
	ExperienceDetailPanel.prototype.setupPickOrCreateTarget = function(targetNode, experience, pickedName, createName, update)
	{
		var pickDatum = experience.getCell(pickedName).data[0];
		var createCell = experience.getCell(createName);
		var createDatum = createCell ? createCell.data[0] : null;
		
		$(pickDatum).on("valueAdded.cr valueDeleted.cr dataChanged.cr", null, targetNode, update);
		if (createDatum)
			$(createDatum).on("valueAdded.cr valueDeleted.cr dataChanged.cr", null, targetNode, update);
		
		$(targetNode).on("remove", function() {
			$(pickDatum).off("valueAdded.cr valueDeleted.cr dataChanged.cr", null, update);
			if (createDatum)
				$(createDatum).off("valueAdded.cr valueDeleted.cr dataChanged.cr", null, update);
		});
		update.call(this, {data: targetNode});
	}
	
	function ExperienceDetailPanel(experience, previousPanel) {
		
		SitePanel.call(this, previousPanel, experience, "Offering", "view session");
		this.experience = experience;
		
		var navContainer = this.appendNavContainer();
		
		var backButton = navContainer.appendLeftButton()
			.on("click", handleCloseRightEvent);
		backButton.append("span").text("Done");
		var _this = this;
		
		if (experience.typeName == "More Experience" && experience.canWrite())
		{
			var editButton = navContainer.appendRightButton()
				.on("click", function(d) {
					if (prepareClick('click', 'edit experience: ' + experience.getDescription()))
					{
						showClickFeedback(this);
				
						var panel = new EditExperiencePanel(experience, _this.node(), revealPanelUp);
					}
					d3.event.preventDefault();
				});
			editButton.append("span").text("Edit");
			
			var node = this.node();
			var f = function(eventObject)
				{
					d3.select(eventObject.data).remove();
				};
			$(experience).one("valueDeleted.cr", null, node, f);
			$(node).on("remove", null, function(eventObject)
				{
					$(experience).off("valueDeleted.cr", null, f);
				});
		}
		
		var panel2Div = this.appendScrollArea();
		
		var headerDiv = panel2Div.appendHeader();
		this.setupPickOrCreateTarget(headerDiv.node(), experience, "Offering", "User Entered Offering",
			function() {
			var offering = _pickedOrCreatedValue(experience, "Offering", "User Entered Offering");
			headerDiv.text(offering);
		});
		
		var orgDiv = panel2Div.appendSection(experience);
		orgDiv.classed("organization", true);

		var organizationNameDiv = orgDiv.append("label");
		this.setupPickOrCreateTarget(organizationNameDiv.node(), experience, "Organization", "User Entered Organization", 
			function(eventObject) {
				var organization = _pickedOrCreatedValue(experience, "Organization", "User Entered Organization");
				d3.select(eventObject.data).text(organization);
			});

		var siteNameDiv = orgDiv.append('div')
				.classed("address-line", true);
		this.setupPickOrCreateTarget(siteNameDiv.node(), experience, "Site", "User Entered Site", function() {
			var organization = _pickedOrCreatedValue(experience, "Organization", "User Entered Organization");
			var siteDescription = _pickedOrCreatedValue(experience, "Site", "User Entered Site");
			if (siteDescription && siteDescription.length > 0 && (siteDescription !== organization))
				siteNameDiv.text(siteDescription);
			else
				siteNameDiv.text(null);
		});
		
		var siteAddressDiv = orgDiv.append('div');
		this.setupTarget(siteAddressDiv.node(), experience, "Site",
			function() {
				siteAddressDiv.selectAll('div').remove();
				var site = experience.getValue("Site");
				if (site && site.getValueID())
				{
					crp.pushCheckCells(site, undefined, function()
						{
							var address = site.getValue("Address");
							appendAddress.call(siteAddressDiv.node(), address);
						},
						function() { }
					);
				}
			});
		
		var firstDiv = null;
		var nextDiv;
		
		this.showViewCells([experience.getCell("Start"),
								 experience.getCell("End")]);

		var offeringCell = experience.getCell("Offering");
		var offeringServiceCell = new OfferingServiceCell(offeringCell);
		this.showViewCells([offeringServiceCell])
		         .each(function(cell)
					{
						offeringServiceCell.setupHandlers(this, _this.node());
					});
		
		var serviceCell = experience.getCell("Service");
		var userServiceCell = experience.getCell("User Entered Service");
		/* If this experience is of a type that has custom markers, show them. */
		if (serviceCell && userServiceCell)
		{
			serviceCell.field.label = "My Markers";
			var sections = this.showViewCells([serviceCell]);
			panel2Div.appendCellData(sections.node(), userServiceCell);
		}
		
		var offering = experience.getValue("Offering");
		if (offering && offering.getValueID())
		{
			var webSiteDiv = panel2Div.append("section");	
			showWebSite(offering, function(newText)
				{
					if (newText)
					{
						var labelDiv = webSiteDiv.append("div")
							.classed("more-info", true);
						var link = labelDiv
							.append("a")
							.classed("site-active-text", true)
							.attr("href", newText)
							.attr("target", "_blank")
							.text("More Info");
					}
				});
		}
		showPanelLeft(this.node(), unblockClick);
	}
	
	return ExperienceDetailPanel;
})();

var PickOrCreateSearchView = (function () {
	PickOrCreateSearchView.prototype = new PanelSearchView();
	PickOrCreateSearchView.prototype.pickDatum = null;
	PickOrCreateSearchView.prototype.createDatum = null;
	
	/* Overrides SearchView.prototype.onClickButton */
	PickOrCreateSearchView.prototype.onClickButton = function(d, i) {
		if (prepareClick('click', 'pick ' + d.getDescription()))
		{
			this.sitePanel.updateValues(d, null);
		}
		d3.event.preventDefault();
	}
	
	/* Overrides SearchView.setupInputBox */
	PickOrCreateSearchView.prototype.setupInputBox = function()
	{
		if (!this.createDatum.isEmpty())
		{
			this.inputBox.value = this.createDatum.getDescription();
			$(this.inputBox).trigger("input");
		}
		else if (!this.pickDatum.isEmpty())
		{
			this.inputBox.value = this.pickDatum.getDescription();
			$(this.inputBox).trigger("input");
		}
	}
	
	/* Overrides SearchView.prototype.isButtonVisible */
	PickOrCreateSearchView.prototype.isButtonVisible = function(button, d, compareText)
	{
		if (compareText.length === 0)
			return true;
			
		return d.getDescription().toLocaleLowerCase().indexOf(compareText) >= 0;
	}
	
	/* Overrides SearchView.searchPath */
	PickOrCreateSearchView.prototype.searchPath = function(val)
	{
		if (val.length == 0)
			/* This case occurs when searching for sites within an organization. */
			return this.pickDatum.cell.field.ofKindID;
		else
		{
			var symbol = (val.length < 3) ? "^=" : "*=";
			return this.pickDatum.cell.field.ofKindID+'[?'+symbol+'"'+val+'"]';
		}
	}
	
	PickOrCreateSearchView.prototype.showObjects = function(foundObjects)
	{
		var buttons = SearchView.prototype.showObjects.call(this, foundObjects);
			
		if (!this.pickDatum.isEmpty())
		{
			var _this = this;
			buttons.insert("span", ":first-child").classed("glyphicon glyphicon-ok pull-left", 
				function(d) { return d.getDescription() == _this.pickDatum.getDescription(); });
		}
		return buttons;
	}
	
	function PickOrCreateSearchView(sitePanel, pickDatum, createDatum)
	{
		if (sitePanel)
		{
			this.pickDatum = pickDatum;
			this.createDatum = createDatum;
			PanelSearchView.call(this, sitePanel, pickDatum.cell.field.name, undefined, GetDataChunker /* Could be SelectAllChunker */);
		}
		else
			PanelSearchView.call(this);
	}
	
	return PickOrCreateSearchView;
})();

var PickOrCreatePanel = (function () {
	PickOrCreatePanel.prototype = new SitePanel();
	PickOrCreatePanel.prototype.navContainer = null;
	PickOrCreatePanel.prototype.searchView = null;
	PickOrCreatePanel.prototype.done = null;
	PickOrCreatePanel.prototype.pickDatum = null;
	PickOrCreatePanel.prototype.createDatum = null;
	
	PickOrCreatePanel.prototype.onClickCancel = function()
	{
		if (prepareClick('click', 'Cancel'))
		{
			this.hide();
		}
		d3.event.preventDefault();
	}
	
	PickOrCreatePanel.prototype.save = function(initialData, sourceObjects)
	{
		if (initialData.length > 0)
		{
			var _this = this;
			cr.updateValues(initialData, sourceObjects,
				function () { _this.hide(); },
				syncFailFunction);
		}
		else
			this.hide();
	}
	
	PickOrCreatePanel.prototype.updateValues = function(newValue, newText)
	{
		if (newValue && newValue.getValueID() === this.pickDatum.getValueID())
			this.hide();
		else if (!newValue && newText && newText === this.createDatum.text)
			this.hide();
		else 
		{
			var initialData = [];
			var sourceObjects = [];
			if (newValue)
			{
				if (this.pickDatum.cell.parent && this.pickDatum.cell.parent.getValueID())	/* In this case, we are adding an object to an existing object. */
				{
					this.pickDatum.appendUpdateCommands(0, newValue, initialData, sourceObjects);
					this.createDatum.appendUpdateCommands(0, null, initialData, sourceObjects);
					this.save(initialData, sourceObjects);
				}
				else 
				{
					/* In this case, we are replacing an old value for
					   an item that was added to the cell but not saved;
					   a placeholder or a previously picked value.
					 */
					this.pickDatum.updateFromChangeData({instanceID: newValue.getValueID(), description: newValue.getDescription()});
					this.createDatum.updateFromChangeData({text: null});
					this.pickDatum.triggerDataChanged();
					this.hide();
				}
			}
			else
			{
				if (this.pickDatum.cell.parent && this.pickDatum.cell.parent.getValueID())	/* In this case, we are adding an object to an existing object. */
				{
					this.pickDatum.appendUpdateCommands(0, null, initialData, sourceObjects);
					this.createDatum.appendUpdateCommands(0, newText, initialData, sourceObjects);
					this.save(initialData, sourceObjects);
				}
				else 
				{
					/* In this case, we are replacing an old value for
					   an item that was added to the cell but not saved;
					   a placeholder or a previously picked value.
					 */
					this.pickDatum.updateFromChangeData({instanceID: null, description: "None"});
					this.createDatum.updateFromChangeData({text: newText});
					this.createDatum.triggerDataChanged();
					this.hide();
				}
			}
			
		}
	}
	
	PickOrCreatePanel.prototype.onClickDone = function(d, i) {
		d3.event.preventDefault();

		if (prepareClick('click', 'Done'))
		{
			var newText = this.searchView.inputText();
			var compareText = newText.toLocaleLowerCase()
			var d = this.searchView.getDataChunker.buttons().data().find(function(d)
				{
					return d.getDescription && d.getDescription().toLocaleLowerCase() === compareText;
				});
			if (d) {
				this.updateValues(d, null);
				return;
			}

			if (newText.length == 0)
			{
				this.updateValues(null, null);
			}
			else
			{
				var _this = this;
				function done(newInstances)
				{
					if (newInstances.length == 0)
						_this.updateValues(null, newText);
					else
						_this.updateValues(newInstances[0], null);
				}
				
				var searchPath = this.searchView.searchPath("");
				if (searchPath.length > 0)
				{
					cr.selectAll({path: searchPath+'[_name='+'"'+newText+'"]', 
						end: 50, done: done, fail: syncFailFunction});
				}
				else
				{
					this.updateValues(null, newText);
				}
			}
		}
	}
	
	PickOrCreatePanel.prototype.getTitle = function()
	{
		return this.pickDatum.cell.field.name;
	}
	
	PickOrCreatePanel.prototype.createSearchView = function()
	{
		return new PickOrCreateSearchView(this, this.pickDatum, this.createDatum);
	}
	
	function PickOrCreatePanel(previousPanelNode, pickDatum, createDatum, done)
	{
		if (previousPanelNode === undefined)
		{
			SitePanel.call(this);
		}
		else
		{
			SitePanel.call(this, previousPanelNode, pickDatum, pickDatum.cell.field.name, "list");
			this.pickDatum = pickDatum;
			this.createDatum = createDatum;
			this.done = done;
			this.navContainer = this.appendNavContainer();

			var _this = this;
			var backButton = this.navContainer.appendLeftButton()
				.on("click", function()
				{
					_this.onClickCancel();
				});
			backButton.append("span").text("Cancel");
			
			this.navContainer.appendRightButton()
				.on("click", function()
				{
					_this.onClickDone();
				})
				.append("span").text("Done");

			var title = this.getTitle();
			if (title)
				this.navContainer.appendTitle(title);
			
			this.searchView = this.createSearchView();

			showPanelLeft(this.node(), unblockClick);
		}
	}
	return PickOrCreatePanel;
})();

var PickOrCreateSiteSearchView = (function () {
	PickOrCreateSiteSearchView.prototype = new PickOrCreateSearchView();
	
	PickOrCreateSiteSearchView.prototype.searchPath = function(val)
	{
		var organization = this.pickDatum.cell.parent.getCell("Organization").data[0];
		
		if (organization.getValueID())
		{
			return "#"+organization.getValueID()+">Sites>"+PickOrCreateSearchView.prototype.searchPath.call(this, val);
		}
		else
			return "";
	}
	
	PickOrCreateSiteSearchView.prototype.textCleared = function()
	{
		PickOrCreateSearchView.prototype.textCleared.call(this);
		
		var organization = this.pickDatum.cell.parent.getCell("Organization").data[0];
		
		if (organization.getValueID())
		{
			this.startSearchTimeout("");
		}
	}
	
	function PickOrCreateSiteSearchView(sitePanel, pickDatum, createDatum)
	{
		PickOrCreateSearchView.call(this, sitePanel, pickDatum, createDatum);
	}
	
	return PickOrCreateSiteSearchView;
	
})();

var PickOrCreateSitePanel = (function () {
	PickOrCreateSitePanel.prototype = new PickOrCreatePanel();
	
	PickOrCreateSitePanel.prototype.createSearchView = function()
	{
		return new PickOrCreateSiteSearchView(this, this.pickDatum, this.createDatum);
	}
	
	function PickOrCreateSitePanel(previousPanelNode, pickDatum, createDatum, done)
	{
		PickOrCreatePanel.call(this, previousPanelNode, pickDatum, createDatum, done);
		var organization = this.pickDatum.cell.parent.getCell("Organization").data[0];
		
		if (organization.getValueID() && this.createDatum.text == null)
		{
			this.searchView.search("");
		}
	}
	
	return PickOrCreateSitePanel;
})();

var PickOrCreateOfferingSearchView = (function () {
	PickOrCreateOfferingSearchView.prototype = new PickOrCreateSearchView();
	
	PickOrCreateOfferingSearchView.prototype.searchPath = function(val)
	{
		var site = this.pickDatum.cell.parent.getCell("Site").data[0];
		
		if (site.getValueID())
		{
			return "#"+site.getValueID()+">Offerings>"+PickOrCreateSearchView.prototype.searchPath.call(this, val);
		}
		else
			return "";
	}
	
	PickOrCreateOfferingSearchView.prototype.textCleared = function()
	{
		PickOrCreateSearchView.prototype.textCleared.call(this);
		
		var site = this.pickDatum.cell.parent.getCell("Site").data[0];
		
		if (site.getValueID())
		{
			this.startSearchTimeout("");
		}
	}
	
	function PickOrCreateOfferingSearchView(sitePanel, pickDatum, createDatum)
	{
		PickOrCreateSearchView.call(this, sitePanel, pickDatum, createDatum);
	}
	
	return PickOrCreateOfferingSearchView;
	
})();

var PickOrCreateOfferingPanel = (function () {
	PickOrCreateOfferingPanel.prototype = new PickOrCreatePanel();
	
	PickOrCreateOfferingPanel.prototype.createSearchView = function()
	{
		return new PickOrCreateOfferingSearchView(this, this.pickDatum, this.createDatum);
	}
	
	function PickOrCreateOfferingPanel(previousPanelNode, pickDatum, createDatum, done)
	{
		PickOrCreatePanel.call(this, previousPanelNode, pickDatum, createDatum, done);
		var site = this.pickDatum.cell.parent.getCell("Site").data[0];
		
		if (site.getValueID() && this.createDatum.text == null)
		{
			this.searchView.search("");
		}
	}
	
	return PickOrCreateOfferingPanel;
})();

var PickOrCreateMarkerPanel = (function () {
	PickOrCreateMarkerPanel.prototype = new PickOrCreatePanel();
	
	function PickOrCreateMarkerPanel(previousPanelNode, pickDatum, createDatum, done)
	{
		PickOrCreatePanel.call(this, previousPanelNode, pickDatum, createDatum, done);
		
		if (this.createDatum.text == null)
		{
			this.searchView.search("");
		}
	}
	
	return PickOrCreateMarkerPanel;
})();

var PickOrCreateValue = (function() {
	PickOrCreateValue.prototype = new cr.CellValue();
	PickOrCreateValue.prototype.pickValue = null;
	PickOrCreateValue.prototype.createValue = null;
	
	PickOrCreateValue.prototype.getDescription = function()
	{
		if (!this.pickValue.isEmpty())
			return this.pickValue.getDescription();
		else
			return this.createValue.getDescription();
	}
	
	PickOrCreateValue.prototype.isEmpty = function()
	{
		return this.pickValue.isEmpty() && this.createValue.isEmpty();
	}
	
	/* In this subclass, delete the pickValue, the createValue and then
		trigger a delete event for this.
	 */
	PickOrCreateValue.prototype.deleteValue = function(done, fail)
	{
		if (!this.cell)
			throw ("PickOrCreateValue cell is not set up");
			
		var _this = this;
		this.pickValue.deleteValue(
			function(oldValue)
			{
				_this.createValue.deleteValue(
					function(oldCreateValue) {
						_this.triggerDeleteValue();
						done(_this);
					}, 
					fail);
			},
			fail);
	}
	
	PickOrCreateValue.prototype.removeUnusedValue = function()
	{
		var pickValue = this.pickValue;
		var createValue = this.createValue;

		if (!pickValue.cell.isUnique())
		{
			if (!pickValue.id)
			{
				pickValue.triggerDeleteValue();
			}
			if (!createValue.id)
			{
				createValue.triggerDeleteValue();
			}
		}
	}
	
	PickOrCreateValue.prototype.pushTextChanged = function(textNode)
	{
		var pickValue = this.pickValue;
		var createValue = this.createValue;
		
		var _this = this;
		var onValueChanged = function(eventObject)
		{
			$(eventObject.data).trigger("dataChanged.cr", eventObject.data);
		}
		var f = function(eventObject)
		{
			d3.select(eventObject.data).text(_this.getDescription());
		}
		$(this.pickValue).on("valueAdded.cr dataChanged.cr valueDeleted.cr", null, this, onValueChanged);
		$(this.createValue).on("valueAdded.cr dataChanged.cr valueDeleted.cr", null, this, onValueChanged);
		$(this).on("dataChanged.cr", null, textNode, f);
		$(textNode).on("remove", null, null, function() {
			$(_this.pickValue).off("valueAdded.cr dataChanged.cr valueDeleted.cr", null, onValueChanged);
			$(_this.createValue).off("valueAdded.cr dataChanged.cr valueDeleted.cr", null, onValueChanged);
			$(_this).off("dataChanged.cr", null, f);
		});
	}
	
	function PickOrCreateValue(pickValue, createValue)
	{
		cr.CellValue.call(this);
		this.pickValue = pickValue;
		this.createValue = createValue;
	}
	
	return PickOrCreateValue;
})();

var PickOrCreateCell = (function () {
	PickOrCreateCell.prototype = new cr.Cell();
	PickOrCreateCell.prototype.pickCell = null;
	PickOrCreateCell.prototype.createCell = null;
	PickOrCreateCell.prototype.editPanel = null;
	
	PickOrCreateCell.prototype.isEmpty = function()
	{
		return this.pickCell.isEmpty() && this.createCell.isEmpty();
	}
	
	PickOrCreateCell.prototype.pickedObject = function(d)
	{
		if (pickedObject.getValueID() == this.pickCell.data[0].getValueID())
			this.editPanel.hide();
		else
		{
			var initialData = [];
			var sourceObjects = [];
			this.editPanel.appendUpdateCommands(initialData, sourceObjects);
			if (initialData.length > 0)
			{
				cr.updateValues(initialData, sourceObjects, 
					function() {
						this.editPanel.hide();
					}, 
					syncFailFunction);
			}
			else
				this.editPanel.hide();
		}
	}

	PickOrCreateCell.prototype.showPickOrCreatePanel = function(pickDatum, createDatum, previousPanelNode)
	{
		var _this = this;
		var done = function(d, i)
		{
			_this.pickedObject(d);
		}
		this.editPanel = new PickOrCreatePanel(previousPanelNode, pickDatum, createDatum, done);
	}
	
	PickOrCreateCell.prototype.showValueAdded = function()
	{
		/* getOnValueAddedFunction(true, true, showEditObjectPanel)); */
	}
	
	PickOrCreateCell.prototype.newValue = function()
	{
		return new PickOrCreateValue(this.pickCell.newValue(), this.createCell.newValue());
	}
	
	PickOrCreateCell.prototype.addNewValue = function()
	{
		var pickValue = this.pickCell.addNewValue();
		var createValue = this.createCell.addNewValue();
		var newValue = new PickOrCreateValue(pickValue, createValue);
		newValue.cell = this;
		this.data.push(newValue);
		$(this).trigger("valueAdded.cr", newValue);
		return newValue;
	};
	
	PickOrCreateCell.prototype.updateCell = function(sectionObj)
	{
		/* Do nothing */
	};
	
	PickOrCreateCell.prototype.appendData = function(initialData)
	{
		this.pickCell.appendData(initialData);
		this.createCell.appendData(initialData);
	}

	PickOrCreateCell.prototype.showEdit = function(obj, containerPanel)
	{
		var sectionObj = d3.select(obj);

		this.appendLabel(obj);
		var itemsDiv = sectionObj.append("ol");
			
		var _this = this;
		
		if (this.isUnique())
		{
			itemsDiv.classed("right-label", true);

			sectionObj.classed("btn row-button", true)
				.on("click", function(cell) {
						if (prepareClick('click', 'pick or create cell: ' + _this.field.name))
						{
							var sitePanelNode = $(this).parents(".site-panel")[0];
							var pickDatum = _this.pickCell.data[0];
							var createDatum = _this.createCell.data[0];
							_this.showPickOrCreatePanel(pickDatum, createDatum, sitePanelNode);
						}
					});
		}

		function showAdded(oldData, previousPanelNode)
		{
			var pickDatum = oldData.pickValue;
			var createDatum = oldData.createValue;
			_this.showPickOrCreatePanel(pickDatum, createDatum, previousPanelNode);
		}
	
		var addedFunction = getOnValueAddedFunction(true, true, showAdded);
		var onValueAdded = function(eventObject, newValue)
		{
			var item = addedFunction.call(this, eventObject, newValue);
			newValue.pushTextChanged(item.selectAll(".description-text").node());
		}

		$(this).on("valueAdded.cr", null, itemsDiv.node(), onValueAdded);
		$(itemsDiv.node()).on("remove", null, this, function(eventObject)
			{
				$(eventObject.data).off("valueAdded.cr", null, onValueAdded);
			});
			
		var divs = appendItems(itemsDiv, this.data);
	
		if (!this.isUnique())
			appendConfirmDeleteControls(divs);
		
		var buttons = appendRowButtons(divs);

		if (!this.isUnique())
		{
			buttons.on("click", function(d) {
					if (prepareClick('click', 'edit ' + _this.field.name))
					{
						var sitePanelNode = $(this).parents(".site-panel")[0];
						var pickDatum = d.pickValue;
						var createDatum = d.createValue;
						_this.showPickOrCreatePanel(d.pickValue, d.createValue, sitePanelNode);
					}
				});
			appendDeleteControls(buttons);
		}

		appendRightChevrons(buttons);	
		
		appendButtonDescriptions(buttons)
			.each(function(d)
					{
						d.pushTextChanged(this);
					});
	
		if (!this.isUnique())
		{
			/* newValue is generated by the newValue() function, above. */
			function done(newValue)
			{
				var sitePanelNode = $(obj).parents(".site-panel")[0];
				_this.showPickOrCreatePanel(newValue.pickValue, newValue.createValue, sitePanelNode);
			}
		
			crv.appendAddButton(sectionObj, done);
			_setupItemsDivHandlers(itemsDiv, this);
		}
	}

	function PickOrCreateCell(pickCell, createCell, field)
	{
		if (pickCell === undefined)
		{
			cr.Cell.call(this);
		}
		else {
			if (field === undefined)
				field = {
					name: pickCell.field.name,
					capacity: "_unique value",
				};
			cr.Cell.call(this, field);
			this.pickCell = pickCell;
			this.createCell = createCell;
			if (this.isUnique())
				this.pushValue(new PickOrCreateValue(this.pickCell.data[0], this.createCell.data[0]));
			else
			{
				/* Make a copy of the create cell data before creating the PickOrCreateValue objects for the pickPairs */
				var _this = this;
				var createData = this.createCell.data.concat([]);
				var pickPairs = this.pickCell.data.map(function(d) { return new PickOrCreateValue(d, _this.createCell.addNewValue()); });
				var createPairs = createData.map(function(d) { return new PickOrCreateValue(_this.pickCell.addNewValue(), d); });
				pickPairs.forEach(function(d) { _this.pushValue(d); });
				createPairs.forEach(function(d) { _this.pushValue(d); });
			}
		}
	}

	return PickOrCreateCell;
})();

var PickOrCreateOrganizationCell = (function () {
	PickOrCreateOrganizationCell.prototype = new PickOrCreateCell();
	PickOrCreateOrganizationCell.prototype.experience = null;
	
	function PickOrCreateOrganizationCell(experience)
	{
		PickOrCreateCell.call(this, 
							  experience.getCell("Organization"),
							  experience.getCell("User Entered Organization"));
		this.experience = experience;
	}
	
	return PickOrCreateOrganizationCell;
})();

var PickOrCreateSiteCell = (function () {
	PickOrCreateSiteCell.prototype = new PickOrCreateCell();
	PickOrCreateSiteCell.prototype.experience = null;
	
	PickOrCreateSiteCell.prototype.showPickOrCreatePanel = function(pickDatum, createDatum, previousPanelNode)
	{
		var _this = this;
		var done = function(d, i)
		{
			_this.pickedObject(d);
		}
		this.editPanel = new PickOrCreateSitePanel(previousPanelNode, pickDatum, createDatum, done);
	}
	
	function PickOrCreateSiteCell(experience)
	{
		PickOrCreateCell.call(this, 
							  experience.getCell("Site"),
							  experience.getCell("User Entered Site"));
		this.experience = experience;
	}
	
	return PickOrCreateSiteCell;
})();

var PickOrCreateOfferingCell = (function () {
	PickOrCreateOfferingCell.prototype = new PickOrCreateCell();
	PickOrCreateOfferingCell.prototype.experience = null;
	
	PickOrCreateOfferingCell.prototype.showPickOrCreatePanel = function(pickDatum, createDatum, previousPanelNode)
	{
		var _this = this;
		var done = function(d, i)
		{
			_this.pickedObject(d);
		}
		this.editPanel = new PickOrCreateOfferingPanel(previousPanelNode, pickDatum, createDatum, done);
	}
	
	function PickOrCreateOfferingCell(experience)
	{
		PickOrCreateCell.call(this, 
							  experience.getCell("Offering"),
							  experience.getCell("User Entered Offering"));
		this.experience = experience;
	}
	
	return PickOrCreateOfferingCell;
})();

var ConfirmAlert = (function () {

	function ConfirmAlert(panelNode, confirmText, done, cancel)
	{
		var panel = d3.select(panelNode).append('panel')
			.classed("confirm", true);
		var div = panel.append('div');
		var confirmButton = div.append('button')
			.text(confirmText)
			.classed("text-danger", true)
			.on("click", function()
				{
					if (prepareClick('click', confirmText))
					{
						$(panel.node()).hide("slide", {direction: "down"}, 400, function() {
							panel.remove();
							done();
						});
					}
				});
		div.append('button')
			.text("Cancel")
			.on("click", function()
				{
					if (prepareClick('click', 'Cancel'))
					{
						$(panel.node()).hide("slide", {direction: "down"}, 400, function() {
							panel.remove();
							cancel();
						});
					}
				});
		
		$(panel.node()).toggle("slide", {direction: "down", duration: 0});
		$(panel.node()).effect("slide", {direction: "down", duration: 400, complete: 
			function() {
				$(confirmButton.node()).focus();
				unblockClick();
			}});
		$(confirmButton.node()).on('blur', function()
			{
				if (prepareClick('blur', confirmText))
				{
					$(panel.node()).hide("slide", {direction: "down"}, 400, function() {
						panel.remove();
						cancel();
					});
				}
			});
		$(panel.node()).mousedown(function(e)
			{
				e.preventDefault();
			});
	}
	
	return ConfirmAlert;
})();

/* A special implementation of a cell that can be viewed and displays the
	services of the offering in the specified offering cell. */
var OfferingServiceCell = (function () {
	OfferingServiceCell.prototype = new cr.Cell();
	OfferingServiceCell.prototype.offeringCell = null;
	
	OfferingServiceCell.prototype.isEmpty = function()
	{
		if (this.offeringCell.isEmpty())
			return true;
		return this.offeringCell.data[0].getCell("Service").isEmpty();
	}
	
	OfferingServiceCell.prototype.checkCells = function(done, fail)
	{
		if (!this.offeringCell.isEmpty())
		{
			var offering = this.offeringCell.data[0];
			offering.checkCells([],
				done,
				fail);
		}
	}
	
	OfferingServiceCell.prototype.clear = function(obj)
	{
		d3.select(obj).selectAll('ol>li').remove();
	}
	
	OfferingServiceCell.prototype.show = function(obj, containerPanel)
	{
		this.clear(obj);
		var _this = this;
		this.checkCells(function() {
							var offering = _this.offeringCell.data[0];
							offering.getCell("Service").show(obj, containerPanel);
						},
						asyncFailFunction);
	}
	
	OfferingServiceCell.prototype.setupHandlers = function(obj, containerPanel)
	{
		var offeringCell = this.offeringCell;
		var _this = this;
		var checkView = function(e)
		{
			if (offeringCell.isEmpty())
			{
				_this.clear(obj);
				$(obj).css("display", "none");
			}
			else
				_this.checkCells(function()
					{
						_this.show(obj, containerPanel);
						$(obj).css("display", !_this.isEmpty() ? "" : "none");
					}, 
					asyncFailFunction);
		}
		$(offeringCell).on("valueAdded.cr valueDeleted.cr dataChanged.cr", checkView);
		$(obj).on("remove", function(e)
		{
			$(offeringCell).off("valueAdded.cr valueDeleted.cr dataChanged.cr", checkView);
		});
	}
	
	function OfferingServiceCell(offeringCell) {
		var field = {capacity: "_multiple values", name: "Marker", label: "Markers"};
		cr.Cell.call(this, field);
		this.offeringCell = offeringCell;
	}
	
	return OfferingServiceCell;
})();

var MyMarkersCell = (function () {
	MyMarkersCell.prototype = new PickOrCreateCell();
	
	MyMarkersCell.prototype.showPickOrCreatePanel = function(pickDatum, createDatum, previousPanelNode)
	{
		var _this = this;
		var done = function(d, i)
		{
			_this.pickedObject(d);
		}
		this.editPanel = new PickOrCreateMarkerPanel(previousPanelNode, pickDatum, createDatum, done);
	}
	
	function MyMarkersCell(pickCell, createCell) {
		var field = {capacity: "_multiple values", name: "marker", label: "My Markers"};
		PickOrCreateCell.call(this, pickCell, createCell, field);
	}
	return MyMarkersCell;
})();

var EditExperiencePanel = (function () {
	EditExperiencePanel.prototype = new SitePanel();
	EditExperiencePanel.prototype.experience = null;
	
	EditExperiencePanel.prototype.handleDeleteButtonClick = function()
	{
		if (prepareClick('click', 'delete experience'))
		{
			var _this = this;
			new ConfirmAlert(this.node(), "Delete Experience", 
				function() { 
					_this.datum().deleteValue(
						function() { _this.hidePanelDown() },
						syncFailFunction);
				}, 
				function() { 
					unblockClick();
				});
		}
	}
	
	function EditExperiencePanel(experience, previousPanel, showFunction) {
		SitePanel.call(this, previousPanel, experience, "Edit Experience", "edit session", showFunction);
		var navContainer = this.appendNavContainer();
		var panel2Div = this.appendScrollArea();
		var bottomNavContainer = this.appendBottomNavContainer();

		navContainer.appendRightButton()
			.on("click", function()
				{
					panel2Div.handleDoneEditingButton.call(this,
						function()
						{
							myMarkersCell.data.forEach(function(d)
								{ d.removeUnusedValue(); });
						});
				})
			.append("span").text("Done");

		navContainer.appendTitle("Edit Experience");
		
		var _this = this;
		bottomNavContainer.appendRightButton()
			.on("click", 
				function() {
					_this.handleDeleteButtonClick();
				})
			.append("span").classed("text-danger", true).text("Delete");
			
		cells = [new PickOrCreateOrganizationCell(experience),
				 new PickOrCreateSiteCell(experience),
				 new PickOrCreateOfferingCell(experience),
				 experience.getCell("Start"),
				 experience.getCell("End"),
				];
				
		this.showEditCells(cells);
		
		var startSection = panel2Div.selectAll(":nth-child(4)");
		var startDateInput = startSection.selectAll(".date-row").node().dateInput;
		var endSection = panel2Div.selectAll(":nth-child(5)");
		var endDateInput = endSection.selectAll(".date-row").node().dateInput;
		endDateInput.checkMinDate(new Date(startDateInput.value));
		
		$(startDateInput).on('change', function()
		{
			endDateInput.checkMinDate(new Date(startDateInput.value()));
		});
		
		var offeringCell = experience.getCell("Offering");
		var offeringServiceCell = new OfferingServiceCell(offeringCell);
		this.showViewCells([offeringServiceCell])
				 .each(function(cell)
					{
						offeringServiceCell.setupHandlers(this, _this.node());
					});
		
		var serviceCell = experience.getCell("Service");
		var userServiceCell = experience.getCell("User Entered Service");
		var myMarkersCell = new MyMarkersCell(serviceCell, userServiceCell);
		var sections = this.showEditCells([myMarkersCell]);
	}
	
	return EditExperiencePanel;
})();

var AddExperiencePanel = (function () {
	AddExperiencePanel.prototype = new SitePanel();
	AddExperiencePanel.prototype.experience = null;
	
	function AddExperiencePanel(container, experience, previousPanel, showFunction, done) {
		var newExperience = new cr.ObjectValue();
		newExperience.importCells(experience.cells);
		newExperience.privilege = container.privilege;
		newExperience.isDataLoaded = true;
		
		SitePanel.call(this, previousPanel, newExperience, "Add Experience", "edit", showFunction);
		var navContainer = this.appendNavContainer();
		var panel2Div = this.appendScrollArea();

		var _this = this;

		doneButton = navContainer.appendRightButton();
		doneButton.append("span").text("Add");
		doneButton.on("click", 	function(d) {
			if (prepareClick('click', 'done adding'))
			{
				showClickFeedback(this);
				
				var initialData = {}
				var sections = panel2Div.selectAll("section");
				sections.each(
					function(cell) {
						if ("updateCell" in cell)
						{
							cell.updateCell(this);
							cell.appendData(initialData);
						}
					});
	
				field = {ofKind: "More Experience", name: "More Experience"};
				cr.createInstance(field, container.getValueID(), initialData, 
					function(newData)
					{
						newData.checkCells([],
							function() {
								if (done)
									done(newData);
							},
						syncFailFunction);
					}, 
					syncFailFunction);
			}
			d3.event.preventDefault();
		});
		
		var backButton = navContainer.appendLeftButton()
			.on("click", function()
			{
				if (prepareClick('click', 'AddExperiencePanel: Cancel'))
				{
					_this.hide();
				}
				d3.event.preventDefault();
			});
		backButton.append("span").text("Cancel");

		navContainer.appendTitle("Add Experience");
			
		cells = [new PickOrCreateOrganizationCell(newExperience),
				 new PickOrCreateSiteCell(newExperience),
				 new PickOrCreateOfferingCell(newExperience),
				 newExperience.getCell("Start"),
				 newExperience.getCell("End"),
				];
				
		this.showEditCells(cells);
		
		var startSection = panel2Div.selectAll(":nth-child(4)");
		var startDateInput = startSection.selectAll(".date-row").node().dateInput;
		var endSection = panel2Div.selectAll(":nth-child(5)");
		var endDateInput = endSection.selectAll(".date-row").node().dateInput;
		endDateInput.checkMinDate(new Date(startDateInput.value));
		
		$(startDateInput).on('change', function()
		{
			endDateInput.checkMinDate(new Date(startDateInput.value()));
		});
		
		var offeringCell = newExperience.getCell("Offering");
		function showMarkers()
		{
			var offeringServiceCell = new OfferingServiceCell(offeringCell);
			_this.showViewCells([offeringServiceCell])
					 .each(function(cell)
						{
							offeringServiceCell.setupHandlers(this, _this.node());
						});
		
			var serviceCell = newExperience.getCell("Service");
			var userServiceCell = newExperience.getCell("User Entered Service");
			var myMarkersCell = new MyMarkersCell(serviceCell, userServiceCell);
			var sections = _this.showEditCells([myMarkersCell]);
		}
		
		var offering = newExperience.getValue("Offering");
		if (offering && offering.getValueID())
			crp.pushCheckCells(offering, undefined, showMarkers, asyncFailFunction);
		else
			showMarkers();
	}
	
	return AddExperiencePanel;
})();

