/* comparePathsPanel.js */

var AgeCalculator = (function() {
	AgeCalculator.prototype.birthdays = null;
	
	AgeCalculator.prototype.getBirthday = function()
	{
		return this.birthdays[0];
	}
	
	AgeCalculator.prototype.getAge = function(dateString)
	{
		return new Date(dateString) - this.birthdays[0];
	}
	
	AgeCalculator.prototype.getYears = function(dateString)
	{
		var d = new Date(dateString);
		var min = 0;
		var range = this.birthdays.length - 1;
		var mid;
		while (true)
		{
			if (min > range)
			{
				if (min < this.birthdays.length)
					return min - 1;
					
				// Extend the birthday list until it overruns the searched for date.
				while (d > this.birthdays[this.birthdays.length - 1])
				{
					var bd = new Date(this.birthdays[0].valueOf());
					bd.setUTCFullYear(this.birthdays[0].getUTCFullYear() + this.birthdays.length)
					this.birthdays.push(bd);
				}
				return this.birthdays.length - 2;
			}

			mid = Math.floor((min + range) / 2);
			if (this.birthdays[mid] < d)
				min = mid + 1;
			else if (this.birthdays[mid] > d)
				range = mid - 1;
			else
				return mid;
		}
	}
	
	function AgeCalculator(s)
	{
		var d = new Date(s);
		this.birthdays = [d];
	}
	
	return AgeCalculator;
})();

var CompareFlag = (function() {
	CompareFlag.prototype = new FlagData();
	
	CompareFlag.prototype.getEndAge = function()
	{
		endDate = new Date(this.getEndDate());
		return endDate - this.birthday;
	}
	
	CompareFlag.prototype.getStartAge = function()
	{
		startDate = new Date(this.getStartDate());
		return startDate - this.birthday;
	}
	
	CompareFlag.prototype.getYearArray = function()
	{
		var e = this.experience.getDatum("End");
		var ed;
		if (e)
			ed = new Date(e);
		else
			ed = new Date();
		var sd = new Date(this.experience.getDatum("Start"));
		
		
		return {top: this.ageCalculator.getYears(ed), bottom: this.ageCalculator.getYears(sd)};
	}
	
	function CompareFlag(experience, ageCalculator)
	{
		FlagData.call(this, experience);
		this.ageCalculator = ageCalculator;
		this.birthday = ageCalculator.birthdays[0];
	}
	
	return CompareFlag;
})();

var ComparePath = (function() {
	ComparePath.prototype = new PathView();
	
	ComparePath.prototype.youName = "You";
	
	ComparePath.prototype.poleSpacing = 4;
	
	ComparePath.prototype.textLeftMargin = 3;
	ComparePath.prototype.textDetailLeftMargin = 3; /* textLeftMargin; */
	ComparePath.prototype.textDetailRightMargin = 7; /* textRightMargin; */
	ComparePath.prototype.detailTextSpacing = "1.1em";		/* The space between lines of text in the detail box. */
	ComparePath.prototype.pathBackground = "white";
	ComparePath.prototype.showDetailIconWidth = 18;
	ComparePath.prototype.loadingMessageTop = "4.5em";
	ComparePath.prototype.promptRightMargin = 14;		/* The minimum space between the prompt and the right margin of the svg's container */
	ComparePath.prototype.bottomNavHeight = 0;	/* The height of the bottom nav container; set by container. */
	
	/* Translate coordinates for the elements of the experienceGroup within the svg */
	ComparePath.prototype.experienceGroupDX = 40;
	ComparePath.prototype.experienceGroupDY = 37;
	
	ComparePath.prototype.guideHSpacing = 0;
	ComparePath.prototype.labelYs = [11, 33];

	ComparePath.prototype.detailRectX = 1.5;
	
	ComparePath.prototype.leftPath = null;
	ComparePath.prototype.rightPath = null;
	ComparePath.prototype.pathwayContainer = null;
	ComparePath.prototype.svg = null;
	ComparePath.prototype.loadingMessage = null;
	ComparePath.prototype.defs = null;
	ComparePath.prototype.bg = null;
	ComparePath.prototype.loadingText = null;
	ComparePath.prototype.promptAddText = null;
	ComparePath.prototype.yearGroup = null;
	ComparePath.prototype.guideGroup = null;
	ComparePath.prototype.experienceGroup = null;

	ComparePath.prototype.flagWidth = 0;
	
	ComparePath.prototype.columnData = [{labelY: PathView.prototype.labelYs[0], color: "#666"}, 
										{labelY: PathView.prototype.labelYs[0], color: "#666"}];

	ComparePath.prototype.handleValueDeleted = function(experience)
	{
		var index = this.allExperiences.indexOf(experience);
		var _this = this;
		if (index >= 0)
			this.allExperiences.splice(index, 1);
		if (this.detailFlagData && experience == this.detailFlagData.experience)
			this.hideDetail(function() {
					_this.setupHeights();
					_this.setupWidths();
				}, 0);
		this.clearLayout();
		this.checkLayout();
	};

	ComparePath.prototype.handleExperienceDateChanged = function(eventObject)
	{
		var _this = eventObject.data;
		var g = _this.experienceGroup.selectAll('g.flag');
		_this.transitionPositions(g);
	}
	
	ComparePath.prototype.setFlagText = function(node)
	{
		var g = d3.select(node);
		g.selectAll('text').selectAll('tspan:nth-child(1)')
			.text(function(d) { return d.getDescription(); })
	}
		
	/* Sets up each group (this) that displays an experience to delete itself if
		the experience is deleted.
	 */
	ComparePath.prototype.setupDelete = function(fd, node) 
	{
		var _this = this;
		var valueDeleted = function(eventObject)
		{
			$(eventObject.data).remove();
			_this.handleValueDeleted(this);
		};
		
		var dataChanged = function(eventObject)
		{
			_this.setFlagText(eventObject.data);
		}
		
		$(fd.experience).one("valueDeleted.cr", null, node, valueDeleted);
		$(fd.experience).on("dataChanged.cr", null, node, dataChanged);
		
		$(node).on("remove", null, fd.experience, function(eventObject)
		{
			$(eventObject.data).off("valueDeleted.cr", null, valueDeleted);
			$(eventObject.data).off("dataChanged.cr", null, dataChanged);
		});
	}
	
	ComparePath.prototype.getColumn = function(fd)
	{
		if (fd.experience.cell.parent == this.rightPath)
			return 1;
		else
			return 0;
	}

	/* Lay out all of the contents within the svg object. */
	ComparePath.prototype.layout = function()
	{
		var g = this.experienceGroup.selectAll('g.flag');
		var y = this.yearGroup.selectAll('text');
		
		var _this = this;
		
		g.each(function(fd)
		{
			fd.column = _this.getColumn(fd);
		});
		numColumns = 2;
		this.guideHSpacing = (this.sitePanel.scrollAreaWidth() - this.experienceGroupDX) / numColumns;
		
		/* Space out all of the guides */
		this.guideGroup.selectAll('g')
			.attr('transform', function(d, i) { return "translate({0}, 0)".format(i * _this.guideHSpacing); });
			
		this.guideGroup.selectAll('tspan').remove();
		this.guideGroup.selectAll('g>text')
			.each(function(d, i)
				{
					var t = d3.select(this);
					_this.appendWrappedText(d.name, function(i)
							{
								return t.append("tspan")
									.attr("x", 0)
									.attr("dy", "{0}em".format(i));
							},
							_this.guideHSpacing - _this.textDetailRightMargin);
				});

		g.selectAll('rect')
			.attr('height', "{0}em".format(this.flagHeightEM))
			.attr('width', function(fd)
				{
					return $(this.parentNode).children('text').outerWidth() + 5;
				});	
		
		/* Restore the sort order to startDate/endDate */
		g.sort(this._compareExperiences);
	
		this._setCoordinates(g);
		
		g.attr('transform', function(fd) { return "translate({0},{1})".format(fd.x, fd.y * _this.emToPX); });
		
		/* Set the line length to the difference between fd.y2 and fd.y, since g is transformed
			to the fd.y position.
		 */
		g.selectAll('line.flag-pole')
			.attr('y2', function(fd) { return "{0}em".format(fd.y2 - fd.y); });
			
		if (this.detailFlagData != null)
		{
			/*( Restore the detailFlagData */
			var fds = g.data();
			var i = fds.findIndex(function(fd) { return fd.experience === _this.detailFlagData.experience; });
			if (i >= 0)
			{
				_this.hideDetail(function()
					{
						_this.setupClipPaths();
						_this.showDetailGroup(fds[i], 0);
					}, 0
				);
			}
			else
				throw "experience lost in layout";
		}
		else
			this.setupClipPaths();
		
		this.layoutYears(g);
		
		this.setupHeights();
		this.setupWidths();
	}

	ComparePath.prototype.checkLayout = function()
	{
		if ($(this.containerDiv).width() === 0)
			return;
		
		if (!this.isLayoutDirty)
			return;
		
		this.layout();
		this.isLayoutDirty = false;
	}
	
	ComparePath.prototype.redoLayout = function()
	{
		this.clearLayout();
		this.checkLayout();
	}
	
	ComparePath.prototype.transitionPositions = function(g)
	{
		g.sort(this._compareExperiences);
		this._setCoordinates(g);
		g.transition()
			.duration(1000)
			.ease("in-out")
			.attr("transform", function(fd) { return "translate({0},{1})".format(fd.x, fd.y);});
		
		/* Set the line length to the difference between fd.y2 and fd.y, since g is transformed
			to the fd.y position.
		 */
		g.selectAll('line.flag-pole')
			.transition()
			.duration(1000)
			.ease("in-out")
			.attr('y2', function(fd) { return fd.y2 - fd.y; });

		this.layoutYears(g);
	}
	
	ComparePath.prototype.showDetailGroup = function(fd, duration)
	{
		duration = (duration !== undefined ? duration : 700);
		var _this = this;
		
		this.detailGroup.datum(fd);
		this.detailGroup.selectAll('rect').datum(fd);
		var detailText = this.detailGroup.append('text')
			.attr('clip-path', 'url(#id_detailClipPath{0})'.format(this.clipID));
			
		var hasEditChevron = fd.experience.typeName == "More Experience" && fd.experience.canWrite();

		var lines = [];
		
		var s;
		var maxWidth = 0;
		var tspan;
		s = fd.pickedOrCreatedValue("Offering", "User Entered Offering");
		if (s && s.length > 0 && lines.indexOf(s) < 0)
		{
			tspan = detailText.append('tspan')
				.classed('flag-label', true)
				.text(s)
				.attr("x", this.textDetailLeftMargin)
				.attr("dy", this.detailTextSpacing);
			maxWidth = Math.max(maxWidth, tspan.node().getComputedTextLength());
		}
		
		function checkSpacing(dy)
		{
			if (maxWidth > 0)
				detailText.append('tspan')
						  .text(' ')
						  .attr("x", this.textDetailLeftMargin)
						  .attr("dy", dy);
		}
			
		var orgString = fd.pickedOrCreatedValue("Organization", "User Entered Organization");
		if (orgString && orgString.length > 0 && lines.indexOf(orgString) < 0)
		{
			checkSpacing("4px");
			tspan = detailText.append('tspan')
				.classed('detail-organization', true)
				.text(orgString)
				.attr("x", this.textDetailLeftMargin)
				.attr("dy", this.detailTextSpacing);
			maxWidth = Math.max(maxWidth, tspan.node().getComputedTextLength());
		}

		s = fd.pickedOrCreatedValue("Site", "User Entered Site");
		if (s && s.length > 0 && s !== orgString)
		{
			checkSpacing("2px");
			tspan = detailText.append('tspan')
				.classed('site', true)
				.text(s)
				.attr("x", this.textDetailLeftMargin)
				.attr("dy", this.detailTextSpacing);
			maxWidth = Math.max(maxWidth, tspan.node().getComputedTextLength());
		}

		s = getDateRange(fd.experience);
		if (s && s.length > 0)
		{
			checkSpacing("4px");
			tspan = detailText.append('tspan')
				.classed('detail-dates', true)
				.text(s)
				.attr("x", this.textDetailLeftMargin)
				.attr("dy", this.detailTextSpacing);
			maxWidth = Math.max(maxWidth, tspan.node().getComputedTextLength());
		}
		
		var x = fd.x;
		var y = fd.y;

		var iconAreaWidth = (hasEditChevron ? this.showDetailIconWidth + this.textDetailLeftMargin : 0);
		var rectWidth = maxWidth + iconAreaWidth + (this.textDetailLeftMargin * 2);

		s = getTagList(fd.experience);
		if (s && s.length > 0)
		{
			checkSpacing("4px");
			this.appendWrappedText(s, function()
				{
					return detailText.append("tspan")
						.classed('tags', true)
						.attr("x", _this.textDetailLeftMargin)
						.attr("dy", _this.detailTextSpacing);
				},
				maxWidth);
		}

			
		var textBox = detailText.node().getBBox();
		this.detailRectHeight = textBox.height + (textBox.y * 2) + this.textBottomMargin;

		this.detailGroup.attr("transform", 
		                      "translate({0},{1})".format(x + this.experienceGroupDX, (y * this.emToPX) + this.experienceGroupDY));
		this.detailGroup.selectAll('rect')
			.attr("width", rectWidth)
			.attr("x", this.detailRectX)	/* half the stroke width */;
		this.detailFrontRect.datum().colorElement(this.detailFrontRect.node());
		this.detailFrontRect.each(function(d) { _this.setupColorWatchTriggers(this, d); });
		if (duration > 0)
		{
			
			this.detailGroup.selectAll('rect').attr("height", 0)
					   .transition()
					   .duration(duration)
					   .attr("height", this.detailRectHeight);
		}
		else
		{
			this.detailGroup.selectAll('rect').attr("height", this.detailRectHeight);
		}
	   
		/* Set the clip path of the text to grow so the text is revealed in parallel */
		var textClipRect = d3.select("#id_detailClipPath{0}".format(this.clipID)).selectAll('rect')
			.attr('x', textBox.x)
			.attr('y', textBox.y)
			.attr('width', maxWidth); 
		
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
				.attr('height', this.detailRectHeight); 
			detailText				
				.transition()
				.duration(duration)
				.attr("height", this.detailRectHeight);

			if (hasEditChevron)
				iconClipRect.attr('height', 0)
					.transition()
					.duration(duration)
					.attr('height', this.detailRectHeight);
		}
		else
		{
			textClipRect.attr('height', this.detailRectHeight); 
			detailText.attr("height", this.detailRectHeight);
			if (hasEditChevron)
				iconClipRect.attr('height', this.detailRectHeight);
		}
		
		this.detailFlagData = fd;
		
		var experience = this.detailFlagData.experience;
		
		function handleChangeDetailGroup(eventObject, newValue)
		{
			if (!(eventObject.type == "valueAdded" && newValue && newValue.isEmpty()))
				_this.refreshDetail();
		}
		
		var allCells = [experience.getCell("Organization"),
		 experience.getCell("User Entered Organization"),
		 experience.getCell("Site"),
		 experience.getCell("User Entered Site"),
		 experience.getCell("Start"),
		 experience.getCell("End"),
		 experience.getCell("Service"),
		 experience.getCell("User Entered Service")];
		 
		var serviceCells = [experience.getCell("Service"),
		 experience.getCell("User Entered Service")];
		 
		allCells.forEach(function(d)
		 {
			/* d will be null if the experience came from the organization for the 
				User Entered Organization and User Entered Site.
			 */
			if (d)
			{
				$(d).on("dataChanged.cr", null, _this, handleChangeDetailGroup);
				$(d).on("valueAdded.cr", null, _this, handleChangeDetailGroup);
			}
		 });
		serviceCells.forEach(function(d)
		 {
			/* d will be null if the experience came from the organization for the 
				User Entered Organization and User Entered Site.
			 */
			if (d)
			{
				$(d).on("valueDeleted.cr", null, _this, handleChangeDetailGroup);
			}
		 });
		 
		 $(this).one("clearTriggers.cr", function(eventObject)
		 {
			allCells.forEach(function(d)
			 {
				/* d will be null if the experience came from the organization for the 
					User Entered Organization and User Entered Site.
				 */
			 	if (d)
			 	{
					$(d).off("dataChanged.cr", null, handleChangeDetailGroup);
					$(d).off("valueAdded.cr", null, handleChangeDetailGroup);
				}
			 });
			serviceCells.forEach(function(d)
			 {
				/* d will be null if the experience came from the organization for the 
					User Entered Organization and User Entered Site.
				 */
				if (d)
				{
					$(d).off("valueDeleted.cr", null, handleChangeDetailGroup);
				}
			 });
		 });
		
		this.setupHeights();
		this.setupWidths();
		
		if (duration > 0)
		{
			this.scrollToRectangle(this.containerDiv, 
							   {y: (y * this.emToPX) + this.experienceGroupDY,
							    x: x + this.experienceGroupDX,
							    height: this.detailRectHeight,
							    width: rectWidth},
							   parseFloat(this.pathwayContainer.style('top')),
							   this.bottomNavHeight,
							   duration);
		}
	}
	
	ComparePath.prototype.appendExperiences = function()
	{
		var _this = this;

		this.setupClipID();
		
		$(this.experienceGroup.selectAll('g.flag')[0]).remove();
		var g = this.experienceGroup.selectAll('g')
			.data(this.allExperiences.map(function(e) { 
				return new CompareFlag(e, _this.ageCalculators[e.cell.parent.getValueID()]); 
				}))
			.enter()
			.append('g')
			.classed('flag', true)
			.each(function(d)
				{
					_this.setupDelete(d, this);
				})
			.on("click", function() 
				{ 
					d3.event.stopPropagation(); 
				})
			.on("click.cr", showDetail)
			.each(function(d) 
					{ 
						_this.setupServiceTriggers(this, d, function(eventObject)
							{
								d.column = _this.getColumn(d);
								_this.transitionPositions(g);
							});
					});
		
		function showDetail(fd, i)
		{
			cr.logRecord('click', 'show detail: ' + fd.getDescription());
			
			_this.hideDetail(function() {
					_this.showDetailGroup(fd); 
				});
		}
		
		g.append('line').classed('flag-pole', true)
			.each(function(d)
				{
					d.colorElement(this);
					_this.handleChangedExperience(this, d);
					_this.setupColorWatchTriggers(this, d);
				});
		g.append('rect').classed('opaque', true)
			.attr('x', '1.5');
		g.append('rect').classed('bg', true)
			.attr('x', '1.5')
			.each(function(d)
				{
					d.colorElement(this);
					_this.handleChangedExperience(this, d);
					_this.setupColorWatchTriggers(this, d);
				});
		var text = g.append('text').classed('flag-label', true)
			.attr('x', this.textDetailLeftMargin);
		text.append('tspan')
			.attr('dy', '1.1em');
		
		g.each(function() { _this.setFlagText(this); });
	}
	
	ComparePath.prototype.getPathDescription = function(path, ageCalculator)
	{
		return (cr.signedinUser && path.cell.parent == cr.signedinUser && this.youName) ||
			getPathDescription(path) ||
			"{0}-year-old".format(ageCalculator.getYears(new Date().toISOString().substr(0, 10)));
	}
	
	ComparePath.prototype.handleResize = function()
	{
		this.bottomNavHeight = $(this.sitePanel.bottomNavContainer.nav.node()).outerHeight();
		if (this.isLayoutDirty)
			this.checkLayout();
		else
		{
			this.layout();
		}
	}
		
	ComparePath.prototype.showAllExperiences = function()
	{
		var _this = this;
		var firstTime = true;
		
		this.ageCalculators = {};
		this.ageCalculators[this.leftPath.getValueID()] = new AgeCalculator(this.leftPath.getValue("Birthday").getDescription());
		this.ageCalculators[this.rightPath.getValueID()] = new AgeCalculator(this.rightPath.getValue("Birthday").getDescription());

		this.columnData[0].name = this.getPathDescription(this.leftPath, this.ageCalculators[this.leftPath.getValueID()]);
		this.columnData[1].name = this.getPathDescription(this.rightPath, this.ageCalculators[this.rightPath.getValueID()]);
		
		var guides = this.guideGroup.selectAll('g')
			.data(this.columnData)
			.enter()
			.append('g');
		
		guides.append('rect')
			.classed('column-icon', true)
			.attr('x', -10)
			.attr('y', function(d) { return d.labelY - 31; })
			.attr('height', 20)
			.attr('width', 20)
			.attr('stroke', function(d) { return d.color; })
			.attr('fill', function(d) { return d.color; });
		guides.append('text')
			.classed('column-label', true)
			.attr('x', 0)
			.attr('y', function(d, i) { return d.labelY; });
		guides.append('line')
			.classed('column', true)
			.attr('x1', 0)
			.attr('y1', function(d) { 
				return d.labelY + 3 + (9 * (d.name.split(' ').length - 1)); 
				})
			.attr('x2', 0)
			.attr('y2', 500)
			.attr('stroke', function(d) { return d.color; });
	
		var leftCell = this.leftPath.getCell("More Experience");
		var rightCell = this.rightPath.getCell("More Experience");
		var addedFunction = function(eventObject, newData)
			{
				eventObject.data.addMoreExperience(newData);
			}
		$(leftCell).on("valueAdded.cr", null, this, addedFunction);
		$(rightCell).on("valueAdded.cr", null, this, addedFunction);
		$(this.pathwayContainer.node()).on("remove", function()
			{
				$(leftCell).off("valueAdded.cr", null, addedFunction);
				$(rightCell).off("valueAdded.cr", null, addedFunction);
			});
			
		var experiences = leftCell.data;
		
		this.allExperiences = this.allExperiences.concat(experiences);
		
		this.allExperiences = this.allExperiences.concat(rightCell.data);
		$(rightCell.data).each(function() { this.calculateDescription(); });
	
		/* Ensure that all of the offerings have their associated cells. */
		this.allExperiences.forEach(function(experience)
			{
				_this.checkOfferingCells(experience, null);
			});
			
		var resizeFunction = function()
		{
			/* Wrap handleResize in a setTimeout call so that it happens after all of the
				css positioning.
			 */
			setTimeout(function()
				{
					if (firstTime)
					{
						_this.appendExperiences();
						firstTime = false;
					}
					_this.handleResize();
				}, 0);
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

		$(this.sitePanel.mainDiv.node()).on("resize.cr", resizeFunction);
	}
	
	/* Sets the heights of objects that depend on either the layout of 
		the scroll area
		or the layout of the experiences
		or the detail group. 
	 */
	ComparePath.prototype.setupHeights = function()
	{
		var containerBounds = this.containerDiv.getBoundingClientRect();
		var pathwayBounds = this.pathwayContainer.node().getBoundingClientRect();
		var svgHeight = containerBounds.height - (pathwayBounds.top - containerBounds.top);
		
		if (this.detailFlagData != null)
		{
			var h = (this.detailFlagData.y * this.emToPX) + this.detailRectHeight + this.experienceGroupDY + this.bottomNavHeight;
			if (svgHeight < h)
				svgHeight = h;
		}
		
		var _this = this;
		var lastFlag = this.experienceGroup.selectAll('g.flag:last-child');
		var flagHeights = (lastFlag.size() ? (lastFlag.datum().y2 * this.emToPX) + this.experienceGroupDY : this.experienceGroupDY) + this.bottomNavHeight;
		if (svgHeight < flagHeights)
			svgHeight = flagHeights;

		$(this.svg.node()).height(svgHeight);
		$(this.bg.node()).height(svgHeight);
		this.guideGroup.selectAll('line')
			.attr('y2', svgHeight - this.bottomNavHeight);
	}
	
	ComparePath.prototype.setupWidths = function()
	{
		var newWidth = this.sitePanel.scrollAreaWidth();
		var _this = this;
		
		if (this.detailFlagData != null)
		{
			var w = this.experienceGroupDX + this.detailFlagData.x + parseFloat(this.detailFrontRect.attr('width'));
			if (newWidth < w)
				newWidth = w;
		}
		
		this.experienceGroup.selectAll('g.flag').each(function (fd)
			{
				var w = _this.experienceGroupDX + fd.x +parseFloat(d3.select(this).selectAll('rect').attr('width'));
				if (newWidth < w)
					newWidth = w;
			});
		$(this.svg.node()).width(newWidth);
		$(this.bg.node()).width(newWidth);

		/* Position the promptAddText based on the width. */
		if (this.promptAddText)
		{
			this.loadingText
				.attr("y", this.experienceGroupDY + this.loadingText.node().getBBox().height);
	
			var bbox = this.loadingText.node().getBBox();
			var newBBox = this.promptAddText.node().getBBox();
			if (bbox.x + bbox.width + this.textLeftMargin + newBBox.width >
				newWidth - this.experienceGroupDX - this.promptRightMargin)
			{
				this.promptAddText.attr("x", this.loadingText.attr("x"))
					.attr("y", parseFloat(this.loadingText.attr("y")) + bbox.height);
			}
			else
			{
				this.promptAddText.attr("x", bbox.x + bbox.width + this.textLeftMargin)
					.attr("y", this.loadingText.attr("y"));
			}
		}
	}
	
	ComparePath.prototype.setUser = function(leftPath, rightPath, editable)
	{
		if (leftPath.privilege === '_find')
			throw "You do not have permission to see information about {0}".format(leftPath.getDescription());
		if (rightPath.privilege === '_find')
			throw "You do not have permission to see information about {0}".format(rightPath.getDescription());
		if (this.leftPath)
			throw "paths have already been set for this pathtree";
			
		var _this = this;
		
		this.leftPath = leftPath;
		this.rightPath = rightPath;
		this.editable = (editable !== undefined ? editable : true);

		var container = d3.select(this.containerDiv);
		
		this.pathwayContainer = container.append('div')
			.classed("compare-paths", true);
			
		this.svg = this.pathwayContainer.append('svg')
			.classed("pathway compare-paths", true);
		
		this.defs = this.svg.append('defs');
	
		/* bg is a rectangle that fills the background with the background color. */
		this.bg = this.svg.append('rect')
			.style("width", "100%")
			.style("height", "100%")
			.attr("fill", this.pathBackground);
			
		this.loadingMessage = crv.appendLoadingMessage(this.containerDiv)
			.style("position", "absolute")
			.style("left", "0")
			.style("top", this.loadingMessageTop);
		
		this.yearGroup = this.svg.append('g')
			.classed('year', true);
				
		this.guideGroup = this.svg.append('g')
				.classed("guide", true)
				.attr('transform', "translate({0}, 0)".format(this.experienceGroupDX));
				
		this.experienceGroup = this.svg.append('g')
				.classed("experiences", true)
				.attr('transform', 'translate({0},{1})'.format(this.experienceGroupDX, this.experienceGroupDY));
			
		this.detailGroup = this.svg.append('g')
			.classed('detail', true)
			.on("click", function(d) 
				{ 
					d3.event.stopPropagation(); 
				})
			.on("click.cr", function(fd, i)
				{
					_this.showDetailPanel(fd, i);
				});
		this.detailBackRect = this.detailGroup.append('rect')
			.classed('bg', true);
		this.detailFrontRect = this.detailGroup.append('rect')
			.classed('detail', true);
			
		d3.select(this.containerDiv).selectAll('svg')
			.on("click", function() 
			{ 
				d3.event.stopPropagation(); 
			})
			.on("click.cr", function() {
				if (_this.detailFlagData)
				{
					cr.logRecord('click', 'hide details');
					_this.hideDetail(function()
						{
							_this.setupHeights();
							_this.setupWidths();
						});
				}
			});
		
		/* setupHeights now so that the initial height of the svg and the vertical lines
			consume the entire container. */
		this.setupHeights();
		
		var successFunction2 = function()
		{
			if (_this.leftPath == null)
				return;	/* The panel has been closed before this asynchronous action occured. */
				
			_this.showAllExperiences();
			
			crv.stopLoadingMessage(_this.loadingMessage);
			_this.loadingMessage.remove();
			
			$(_this).trigger("userSet.cr");
		}
		
		crp.getData({path:  "#" + this.rightPath.getValueID() + '::reference(_user)::reference(Experience)', 
				   fields: ["parents"], 
				   done: function(experiences)
					{
						_this.allExperiences = experiences.slice();
						$(experiences).each(function()
						{
							this.setDescription(this.getValue("Offering").getDescription());
						});
					}, 
				   fail: asyncFailFunction});
		crp.getData({path: "#" + this.rightPath.getValueID() + '::reference(_user)::reference(Experience)::reference(Experiences)' + 
							'::reference(Session)::reference(Sessions)::reference(Offering)',
					 done: function(newInstances)
						{
						},
						fail: asyncFailFunction});
		crp.getData({path: "#" + this.rightPath.getValueID() + '>"More Experience">Offering',
					 done: function(newInstances)
						{
						},
						fail: asyncFailFunction});			
							
		crp.pushCheckCells(this.rightPath, ["More Experience", "parents"],
					  successFunction2, 
					  asyncFailFunction);
	}
	
	function ComparePath(sitePanel, containerDiv) {
		PathView.call(this, sitePanel, containerDiv);
		d3.select(containerDiv).classed('vertical-scrolling', false)
			.classed('all-scrolling', true);
	}
	
	return ComparePath;
})();

var ComparePathsPanel = (function () {
	ComparePathsPanel.prototype = new SitePanel();
	ComparePathsPanel.prototype.leftUser = null;
	ComparePathsPanel.prototype.rightUser = null;
	ComparePathsPanel.prototype.pathtree = null;
	ComparePathsPanel.prototype.navContainer = null;
	ComparePathsPanel.prototype.bottomNavContainer = null;
	
	function ComparePathsPanel(leftUser, rightUser, previousPanel) {
		var _this = this;
		this.leftUser = leftUser;
		this.rightUser = rightUser;
		
		SitePanel.call(this, previousPanel, null, "Compare Pathways", "compare-paths");

		var panel2Div = this.appendScrollArea();

		this.navContainer = this.appendNavContainer();
		this.navContainer.nav
			.classed("transparentTop", true);

		var settingsButton;
		
		var backButton = this.navContainer.appendLeftButton()
			.on("click", handleCloseRightEvent);
		backButton.append("span").text("Done");

		var addExperienceButton = this.navContainer.appendRightButton();
		
		this.navContainer.appendTitle("Compare Paths");
		
		this.bottomNavContainer = this.appendBottomNavContainer();
		this.bottomNavContainer.nav
			.classed("transparentBottom", true);

		if (this.pathtree)
			throw "pathtree already assigned to pathtree panel";
			
		this.pathtree = new ComparePath(this, panel2Div.node());
		this.pathtree.setUser(this.leftUser.getValue("More Experiences"),
							  this.rightUser.getValue("More Experiences"));
		
		$(this.pathtree).on("userSet.cr", function()
			{
				this.isMinHeight = true;
				_this.calculateHeight();
			});
	}
	
	return ComparePathsPanel;
})();
