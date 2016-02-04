		/* Create a panel to show the details of the session and allow the user to sign up. */
		function showSessionDetails(userInstance, session, service, previousPanelNode)
		{
			var organization = session.getValue("Organization");
			var offering = session.getValue("Offering");
			var site = session.getValue("Site");
			
			session.calculateDescription();
			
			var sitePanel = new SitePanel(previousPanelNode, session, offering.getDescription(), "session");
			var panel = sitePanel.node();
			
			var navContainer = sitePanel.appendNavContainer();

			var backButton = navContainer.appendLeftButton()
				.on("click", handleCloseRightEvent);
			backButton.append("span").text("Done");
			
			var buttonDiv = navContainer.appendRightButton();
			
			var shareDiv = null;
			if (service)
				shareDiv = sitePanel.appendBottomNavContainer();

			var panel2Div = sitePanel.appendScrollArea();
			panel2Div.appendHeader();
			panel2Div.appendAlertContainer();
			
			if (organization)
			{
				var orgDiv = panel2Div.append("section");
				orgDiv.classed("organization", true);

				var labelDiv = orgDiv.append("label")
					.text(organization.getDescription());

				if (site.getDescription() && (site.getDescription() !== organization.getDescription()))
				{
					orgDiv.append('div')
						.classed("address-line", true)
						.text(site.getDescription());
				}
				
				crp.pushCheckCells(site, function()
				{
					var address = site.getValue("Address");
					crp.pushCheckCells(address, function()
					{
						var streetCell = address.getCell("Street");
						var cityCell = address.getCell("City");
						var stateCell = address.getCell("State");
						var zipCell = address.getCell("Zip Code");
						if (streetCell)
							$(streetCell.data).each(function() {
								orgDiv.append('div')
									.classed("address-line", true)
									.text(this.value);
							});
						line = "";
						if (cityCell && cityCell.data.length)
							line += cityCell.data[0].value;
						if (stateCell && stateCell.data.length)
							line += ", " + stateCell.data[0].getDescription();
						if (zipCell && zipCell.data.length && zipCell.data[0].value)
							line += "  " + zipCell.data[0].value;
						if (line.trim())
							orgDiv.append('div')
								.classed('address-line', true)
								.text(line.trim());
					},
					function() {
					});
				},
				function() { }
				);
			}
			
			function appendStringDatum(cellName)
			{
				var v = session.getDatum(cellName);
				if (v)
				{
					var deadlineDiv = panel2Div.append("section");
					appendStringItem(deadlineDiv.node(), cellName, v);
					return deadlineDiv;
				}
				else
					return null;
			}
			
			var firstDiv = null;
			var nextDiv;
			firstDiv = appendStringDatum("Registration Deadline");
			
			nextDiv = appendStringDatum("Start");
			if (!firstDiv)
				firstDiv = nextDiv;
				
			nextDiv = appendStringDatum("End");
			if (!firstDiv)
				firstDiv = nextDiv;

			var cellDiv = panel2Div.append("section")
				.classed("cell", true);
			
			crp.pushCheckCells(offering, function()
				{
					var serviceCell = offering.getCell("Service");
					if (!service && serviceCell.data.length > 0)
						service = serviceCell.data[0];
						
					if (service)
					{
						shareDiv.div.classed("share-container always-visible border-above", true);

						appendFacebookButton(shareDiv, service, session);
					}

					if (serviceCell.data.length > 0)
					{
						var labelDiv = cellDiv.append("label")
							.text("Services");
						var itemsDiv = cellDiv.append("ol").classed("items-div", true);

						var divs = appendItems(itemsDiv, serviceCell.data);
						var buttons = divs.append("div").classed("multi-line-item", true);
						appendButtonDescriptions(buttons);
						cellDiv.append("div").classed("cell-border-below", true);
					}
				},
				asyncFailFunction);
			
			var agesDiv = panel2Div.append("section");
			showAgeRange(offering, function(newText)
				{
					if (newText)
					{
						appendStringItem(agesDiv.node(), "Ages", newText);
					}
				});
			var gradesDiv = panel2Div.append("section");
			showGradeRange(offering, function(newText)
				{
					if (newText)
					{
						appendStringItem(gradesDiv.node(), "Grades", newText);
					}
				});
			
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

			var inquiryValueID = null;
			
			var checkInquiryFunction = function(newValueID)
			{
				inquiryValueID = newValueID;
				if (newValueID)
				{
					buttonDiv.text("Back Out");
					buttonDiv.on("click", deleteInquiryFunction);
				}
				else
				{
					buttonDiv.text("Sign Up");
					buttonDiv.on("click", addNameFunction);
				}
			};
			
			var addInquiry = function()
			{
				groupPath = '#'+organization.getValueID() + '>"Inquiry Access Group"';
				cr.selectAll({path: groupPath,
					done: function(groupPaths)
						{
							cr.addObjectValue('#'+session.getValueID()+">Inquiries",
											  '_user',
											  userInstance,
											  function(newInquiryID) { 
													function done()
													{
														bootstrap_alert.success("You have signed up for " + 
																	  offering.getDescription() + "/" + session.getDescription() + "." +
																	  " Look out for a notice when you are enrolled.",
																	  ".alert-container");
														checkInquiryFunction(newInquiryID); 
													};
													if (groupPaths.length == 0)
														done();
													else {
														addMissingAccess(userInstance, "_read", groupPaths[0], "_group", done, asyncFailFunction);
													}
												},
												asyncFailFunction);
						},
					fail: asyncFailFunction 
					});
			}
			
			var tryAddInquiry = function()
			{
				if (userInstance.getValueID())
				{
					addInquiry();
					unblockClick();
				}
				else
				{
					var onSignin = function(eventObject)
					{
						var _this = this;
						
						cr.getValues({path: '#'+session.getValueID()+">Inquiries",
							field: "_user",
							value: this.getValueID(),
							done: function(valueIDs)
							{
								if (valueIDs.length > 0)
								{
									checkInquiryFunction(valueIDs[0].id);
									bootstrap_alert.success(_this.getDescription() + 
														  " already signed up for " + 
														  offering.getDescription() + "/" + session.getDescription(),
														  ".alert-container");
								}
								else
								{
									addInquiry();
								}
							},
							fail: asyncFailFunction});
					};
					var onSigninCanceled = function(eventObject)
					{
					};
					
					$(userInstance).on("signin.cr", null, panel, onSignin);
					$(userInstance).on("signinCanceled.cr", null, panel, onSigninCanceled);
					
					$(panel).on("hiding.cr", null, userInstance, function(eventObject)
					{
						$(eventObject.data).off("signin.cr", null, onSignin);
						$(eventObject.data).off("signinCanceled.cr", null, onSigninCanceled);
					});
					
					showFixedPanel(panel, "#id_sign_in_panel");
				}
			}
			
			var addNameFunction = function(e)
			{
				if (prepareClick())
				{
					showClickFeedback(this);
					
					tryAddInquiry();
				}
				d3.event.preventDefault();
			};
			
			var deleteInquiryFunction = function(e)
			{
				if (prepareClick())
				{
					showClickFeedback(this);
					
					var successFunction = function(valueID)
					{
						bootstrap_alert.success("You have backed out of " + 
									  offering.getDescription() + "/" + session.getDescription() + ".",
									  ".alert-container");
						checkInquiryFunction(null);
					}
					
					cr.deleteValue(inquiryValueID, successFunction, asyncFailFunction);
					
					unblockClick();
				}
				d3.event.preventDefault();
			};
			
			if (userInstance.getValueID())
			{
				function done(values)
				{
					checkInquiryFunction(values.length ? values[0].id : null);
				}
				cr.getValues({path: '#'+session.getValueID()+">Inquiries",
					field: "_user",
					value: userInstance.getValueID(),
					done: done,
					fail: asyncFailFunction});
			}
			else
				checkInquiryFunction(null);
			
			return sitePanel;
		}
		
var PickOfferingPanel = (function() {
	PickOfferingPanel.prototype = new SitePanel();
	
	function PickOfferingPanel(userInstance, marker, offeringID, previousPanel) {
		var header = "Find a New Experience";
		SitePanel.call(this, previousPanel, null, header, "list");
		var navContainer = this.appendNavContainer();
		
		navContainer.appendLeftButton()
			.on("click", handleCloseRightEvent)
		    .append("span").text("Done");
			
		navContainer.appendTitle(header);

		textChanged = function()
		{
			var val = this.value.toLocaleLowerCase();
			if (val.length == 0)
			{
				/* Show all of the items. */
				panel2Div.selectAll("li")
					.style("display", null);
			}
			else
			{
				/* Show the items whose description is this.value */
				panel2Div.selectAll("li")
					.style("display", function(d)
						{
							if (d.getDescription().toLocaleLowerCase().indexOf(val) >= 0)
								return null;
							else
								return "none";
						});
			}
		}

		this.appendSearchBar(textChanged);

		var panel2Div = this.appendScrollArea();
		panel2Div.appendAlertContainer();

		var _this = this;
		var successFunction = function(sessions)
		{
			$(sessions).each(function() { this.calculateDescription(); });
			
			if (sessions.length == 0)
			{
				panel2Div.append("p")
					.append("p")
					.text('Sorry, there are no upcoming offerings for "' + marker.getDescription() + '".'); 
			}
			else
			{
				sessions.sort(compareSessions);
			
				var section = panel2Div.append("section")
					.classed("cell", true);
				var divs = section.selectAll("li")
					.data(sessions)
					.enter()
					.append("li").classed("consent-record", true);	// So that each button appears on its own row.

				var buttons = divs.append("button").classed("btn row-button", true)
					.on("click", function(session)
						{
							if (prepareClick())
							{
								showClickFeedback(this);

								var sitePanel = showSessionDetails(userInstance, session, marker, _this.node());
			
								showPanelLeft(sitePanel.node());
							}
						});

				appendRightChevrons(buttons);
				var rightText = buttons.append('span').classed("centered-right-2", true);
			
				rightText.append('div')
					.classed("sub-text", true)
					.text(getDateRange);
				rightText.append('div').classed("sub-text", true)
					.text(function(d) {
						var registrationDeadline = d.getDatum("Registration Deadline");
						if (registrationDeadline)
							return "register by " + registrationDeadline;
						else
							return "";
					});
			
				appendSessionDescriptions(buttons);
				
				if (offeringID != null)
				{
					divs.each(function(d)
					{
						if (d.getValueID() == offeringID)
						{
					
							var sitePanel = showSessionDetails(userInstance, d, marker, _this.node());
							showPanelNow(sitePanel.node());
						}
					});
				}
			}
		}
		
		var offeringSuccessFunction = function(offerings)
		{
			if (offerings.length > 0)
			{
				var rightText = panel2Div.selectAll("li>button>.centered-right-2");
				var offeringsList = {};
				for (var i = 0; i < offerings.length; ++i)
				{
					var offering = offerings[i];
					offeringsList[offering.getValueID()] = offering;
				}
				rightText.each(function(d, i)
					{
						var thisBlock = d3.select(this);
						var offering = offeringsList[d.getValue("Offering").getValueID()];
						var ageText = getOfferingAgeRange(offering);
						var gradeText = getOfferingGradeRange(offering);
						if (ageText.length > 0)
						{
							thisBlock.append('div').classed("sub-text", true)
								.text("Ages: " + ageText);
						}
						if (gradeText.length > 0)
						{
							thisBlock.append('div').classed("sub-text", true)
								.text("Grades: " + gradeText);
						}
					});
			}
		}
					
		var currentDate = new Date();
		var todayString = currentDate.toISOString().substring(0, 10);
		var path = "#" + marker.value.id + '::reference(Offering)>Sessions>Session:not(["Registration Deadline"<"' + todayString + '"])';
		crp.getData({path: path, 
					fields: ["parents"], 
					done: successFunction, 
					fail: asyncFailFunction});
		var path = "#" + marker.value.id + '::reference(Offering)>Sessions>Session:not(["Registration Deadline"<"' + todayString + '"])::reference(Sessions)::reference(Offering)';
		crp.getData({path: path, 
					fields: ["parents"], 
					done: offeringSuccessFunction, 
					fail: asyncFailFunction});

		showPanelLeft(this.node());
	}
	
	return PickOfferingPanel;
})();

var FindExperiencePanel = (function () {
	FindExperiencePanel.prototype = new SitePanel();
	
	function FindExperiencePanel(userInstance, serviceValueID, offeringID, previousPanel) {
		var header = "Find a New Experience";
		SitePanel.call(this, previousPanel, null, header, "list");
		var navContainer = this.appendNavContainer();
		
		navContainer.appendLeftButton()
			.on("click", handleCloseRightEvent)
		    .append("span").text("Done");
			
		navContainer.appendRightButton()
			.classed('add-button', true)
			.on("click", function()
			{
				if (prepareClick())
				{
					hidePanelRight(sitePanel.node());
				}
				d3.event.preventDefault();
			})
			.append("span").text("+");
		
		navContainer.appendTitle(header);
		
		textChanged = function()
		{
			var val = this.value.toLocaleLowerCase();
			if (val.length == 0)
			{
				/* Show all of the items. */
				panel2Div.selectAll("li")
					.style("display", null);
			}
			else
			{
				/* Show the items whose description is this.value */
				panel2Div.selectAll("li")
					.style("display", function(d)
						{
							if (d.getDescription().toLocaleLowerCase().indexOf(val) >= 0)
								return null;
							else
								return "none";
						});
			}
		}

		this.appendSearchBar(textChanged);
		
		var panel2Div = this.appendScrollArea();
		panel2Div.appendAlertContainer();

		var field = {
					  dataType: "_object",
					  name: "Service",
					  capacity: "_multiple values",
					  };
		var cell = cr.createCell(field);
		cell.setup(null);

		var itemsDiv = panel2Div.append("section")
			.classed("multiple", true)
			.append("ol")
			.classed("items-div border-above", true)
			.datum(cell);

		var _this = this;
		var successFunction = function(newInstances)
		{
			newInstances.sort(function(a, b)
				{
					return a.getDescription().localeCompare(b.getDescription());
				});
				
			for (var i = 0; i < newInstances.length; i++)
			{
				var newI = crp.pushInstance(newInstances[i]);
				cell.pushValue(newI);
			}
			
			panel2Div.datum(cell);
			appendViewCellItems(itemsDiv, cell, 
				function(d) {
					if (prepareClick())
					{
						showClickFeedback(this);
						
						var panel = new PickOfferingPanel(userInstance, d, offeringID, _this.node());
					}
				});
				
			panel2Div.selectAll('p').remove();
			for (var i = 0; i < cell.data.length; ++i)
			{
				var d = cell.data[i];
				if (d.getValueID() == serviceValueID)
				{
					var panel = new PickOfferingPanel(userInstance, d, offeringID, _this.node);
					break;
				}
			}
		}
		
		panel2Div.appendLoadingMessage();
			
		var path = "Service";
		crp.getData({path: path, 
					 done: successFunction, 
					 fail: asyncFailFunction});

		showPanelLeft(this.node());
	}
	
	return FindExperiencePanel;
})();