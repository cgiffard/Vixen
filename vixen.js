// Vixen.

/*global HTMLVideoElement:true, HTMLAudioElement:true, HTMLElement:true,
document:true, module:true, createVixel:true, window:true, localStorage:true,
setTimeout:true, clearTimeout:true, captionator:true */

(function(glob) {
	"use strict";
	
	
	/*
		Public: Initialises the vixen media wrapper - establishes any required
		state, scans the video or audio object for media details, and initialises
		the UI creation.
		
		mediaObject		-	The media (audio/video) object which should be wrapped.
		options			-	An object containing recognised initialisation options
							for vixen in a key/value format.
		
		Examples
			
			new Vixen(myVideoObject);
			new Vixen(myVideoObject,{"uiActivityGracePeriod":2500});
		
		Returns the new Vixen object which has now been constructed.
	
	*/
	function Vixen(mediaObject,options) {
		var self = this;
		
		if (!(mediaObject instanceof HTMLVideoElement ||
				mediaObject instanceof HTMLAudioElement))
					throw new Error("Media input was not a media element.");
		
		self.media = mediaObject;
		
		// I'm trusting modern JS engines will be up to handling this
		// circular reference (of which there's only one anyway.)
		self.media.uiController = self;
		self.options = options && options instanceof Object ? options : {};
		
		// If the user hasn't specified options when initialising vixen,
		// then we assume a safe default of five seconds for the UI 'inactivity'
		// state to become active (a theme might use this to fade out the
		// toolbar, for example.)
		if (!self.options.uiActivityGracePeriod)
			self.options.uiActivityGracePeriod = 5000;
		
		self.ui = {};
		
		// Get the sources for the video...
		self.sources =
			[].slice.call(document.querySelectorAll("source",self.media),0);
		
		// Get the sources we can deal with.
		self.compatibleSources = self.sources.filter(function(source) {
			return self.media.canPlayType(source.type).length;
		});
		
		// Order and store indexed by resolution
		self.sourcesByResolution = {};
		self.compatibleSources.forEach(function(source) {
			var sourceLineHeight = source.getAttribute("res");
			if (sourceLineHeight && !isNaN(sourceLineHeight)) {
				sourceLineHeight = parseInt(sourceLineHeight,10);
				
				if (!self.sourcesByResolution[sourceLineHeight])
					self.sourcesByResolution[sourceLineHeight] = source;
			}
		});
		
		// For css classes...
		self.namespace = "vixen";
		
		// Check API support for newer features and store functions we discover
		self.fullScreenEnabled = Vixen.unprefix("fullScreenEnabled",document);
		
		// Get the volume - if we've saved it!
		var keyName = self.namespace + "-volume";
		if (window.localStorage && localStorage.getItem instanceof Function)
			if (localStorage.getItem(keyName) !== null)
				self.media.volume = parseFloat(localStorage.getItem(keyName));
		
		// And save our prior volume...
		self.previousVolume = self.media.volume;
		
		// Build the UI...
		self.buildUI();
		
		// Attach UI Events...
		self.attachEvents();
		
		// ...and update the UI with information from the media object!
		self.updateUI();
		
		// A bit of state
		self.isfullscreen		= false;
		self.playing			= false;
		self.readyState			= self.media.readyState;
		self.resumePlayingAt	= 0;
		self.currentChapter		= "";
		
		return self;
	}
	
	
	/*
		Private: Creates the Vixen UI DOM elements, and binds them together.
		This function mutates the state of the Vixen object and its associated
		UI elements - and should only be called once, after instantiating the
		Vixen wrapper.
		
		Examples
		
			self.buildUI();
		
		Returns the Vixen object against which this method was called.
	
	*/
	Vixen.prototype.buildUI = function() {
		var self = this;
		
		// Tiny DSL for element creation.
		var c = self.c = createVixel(self), w = c;
		
		// Wrap media element
		w(self.media,"media");
		
		// Build the UI.
		// Create scrubber
		c("div","scrubber")
			.a(c("div","loadprogress"))
			.a(
				c("div","playprogress").a(
					c("div","thumb")));
		
		// Create volume control...
		c("div","volumegroup")
			.a(c("button","mute").t("Mute").ctrl("button"))
			.a(c("div","volumeslider").ctrl("slider")
				.a(
					c("div","volumesliderinner")
						.a(c("div","volumethumb"))));
		
		// Create title header...
		c("header","header");
		
		var mediaTitle = self.media.attr("title");
		if (mediaTitle && mediaTitle.replace(/\s/ig,"").length) {
			self.ui.header.a(c("h1","title").t(mediaTitle))
		}
		
		// Bulk of the UI...
		c("div","container")
			.r("application")
			.a(self.ui.header)
			.a(c("div","mediawrapper"))
			.a(
				c("div","toolbar")
					.r("toolbar")
					.a(c("button","playpause").t("Play").ctrl("button"))
					.a(c("label","elapsed"))
					.a(self.ui.scrubber.ctrl("slider"))
					.a(c("label","remaining"))
					.a(self.ui.volumegroup));
		
		// If Captionator is present...
		// Get the TextTrack API ready for our use...
		if (window.captionator && captionator.captionify) {
			captionator.captionify(self.media,null,{
				"controlHeight": self.options.controlHeight || 30,
				"appendCueCanvasTo": self.ui.mediawrapper
			});
		}
		
		// Auxilliary tools...
		self.ui.header.a(
			c("div","auxtools")
				.r("toolbar"));
		
		// Video resolution switcher...
		if (self.compatibleSources.length > 1) {
			var resDropdown =
				c.createSelector("Video Resolution","resselector",self);
				self.ui.auxtools.a(resDropdown);
			
			for (var resolution in self.sourcesByResolution) {
				var source = self.sourcesByResolution[resolution],
					resolutionText = resolution + "p" +
									(resolution >= 720 ? " HD" : " SD");
				
				// Closure to ensure link to source is correct!
				(function(source) {
					
					resDropdown.addItem(resolutionText, resolution, function() {
						if (self.media.currentSrc !== source.src) {
							var prevCurrentTime = self.media.currentTime;
							self.media.src = source.src;
							self.resumePlayingAt = prevCurrentTime;
						}
					});
					
				})(source);
			}
		}
		
		// Text Tracks...
		if (self.media.textTracks && self.media.textTracks.length) {
			
			// Get text tracks, and sort them into various buckets depending on
			// type.
			
			var trackArray		= [].slice.call(self.media.textTracks,0),
				captionArray	=	trackArray.filter(function(track) {
										return	track.kind === "subtitles" ||
												track.kind === "captions";
									}),
				chaptersArray	=	trackArray.filter(function(track) {
										return	track.kind === "chapters";
									}),
				metadataArray	=	trackArray.filter(function(track) {
										return	track.kind === "metadata";
									});
			
			// Create the captions/subtitle selector
			
			if (captionArray.length) {
				var captionList =
					c.createSelector("Captions","captionsselector",self);
					self.ui.auxtools.a(captionList);
				
				captionList.addItem("Captions off","");
				
				captionArray.forEach(function(track, index) {
					captionList.addItem(
						"[" + (track.language||"unknown") + "] " + track.label,
						null,
						function() {
							// Switch off all other tracks...
							captionArray.forEach(function(loopTrack) {
								loopTrack.mode = 0;
							});
							
							// Switch on our track
							track.mode = 2;
						});
					
					if (track.mode === 2) {
						captionList.selectedIndex = index;
					}
				});
			}
			
			if (chaptersArray.length) {
				var chapterList =
					c.createSelector("Chapters","chapterselector",self);
				
				// Define function to be called when all the chapter tracks
				// have loaded
				var buildChapterList = function() {
					// Put all the cues into a single array, which we can
					// then sort in order of startTime.
					var cueArr = [];
					
					chaptersArray.forEach(function(track) {
						cueArr = cueArr.concat([].slice.call(track.cues,0));
					});
					
					// Sort...
					cueArr = cueArr.sort(function(a,b) {
						return a.startTime - b.startTime;
					});
					
					cueArr.forEach(function(cue) {
						chapterList.addItem(cue.text,null,function() {
							self.jumpTo(cue.startTime);
						});
					});
					
					if (cueArr.length)
						self.ui.auxtools.a(chapterList);
				}
				
				var chaptersLoaded = 0;
				
				chaptersArray.forEach(function(chapter) {
					chapter.mode = 1; // Hidden, but triggers download...
					
					// WHY DO TRACKS NOT HAVE A BLEEDIN' LOAD EVENT!?
					// What is this, seriously!?
					var trackLoadAttemptCount = 0;
					setTimeout(function waitForLoad() {
						if (chapter.cues && chapter.readyState > 1) {
							chaptersLoaded ++;
							
							if (chaptersLoaded === chaptersArray.length) {
								buildChapterList();
							}
							
						} else {
							
							// Maybe they didn't get the message.
							// (webkit bug. Ugh)
							chapter.mode = 1;
							
							// Try again, every 50msec, for ten seconds.
							// Then give up.
							if (trackLoadAttemptCount < 200) {
								
								trackLoadAttemptCount ++;
								setTimeout(waitForLoad,50);
							}
						}
					},100);
				});
			}
		}
		
		// Audio Tracks...
		if (self.media.audioTracks && self.media.audioTracks.length) {
			
			// Build the selector...
		
			var audioTracks = [].slice.call(self.media.audioTracks,0),
				audioTrackList =
				c.createSelector("Audio Tracks","audiotrackselector",self);
				self.ui.auxtools.a(audioTrackList);
			
			audioTrackList.addItem("Audio tracks off","");
			
			audioTracks.forEach(function(track, index) {
				audioTrackList.addItem(
					"[" + (track.language||"unknown") + "] " + track.label,
					null,
					function() {
						// Switch off all other tracks...
						audioTracks.forEach(function(loopTrack) {
							loopTrack.mode = 0;
						});
						
						// Switch on our track
						track.mode = 2;
					});
				
				if (track.mode === 2) {
					audioTrackList.selectedIndex = index;
				}
			});
		}
		
		// Video Tracks...
		if (self.media.videoTracks && self.media.videoTracks.length) {
		
			// Build the selector...
		
			var videoTracks = [].slice.call(self.media.videoTracks,0),
				videoTrackList =
				c.createSelector("Video Tracks","videotrackselector",self);
				self.ui.auxtools.a(videoTrackList);
		
			videoTrackList.addItem("Video tracks off","");
		
			videoTracks.forEach(function(track, index) {
				videoTrackList.addItem(
					"[" + (track.language||"unknown") + "] " + track.label,
					null,
					function() {
						// Switch off all other tracks...
						videoTracks.forEach(function(loopTrack) {
							loopTrack.mode = 0;
						});
		
						// Switch on our track
						track.mode = 2;
					});
				
				if (track.mode === 2) {
					videoTrackList.selectedIndex = index;
				}
			});
		}
		
		// Is the fullscreen API present in the browser?
		// Is this a video (i.e. does fullscreen even make sense?)
		if (self.fullScreenEnabled &&
			self.media instanceof HTMLVideoElement) {
			
			// Append a fullscreen button
			self.ui.toolbar.a(
				c("button","fullscreenbutton")
					.t("Fullscreen")
					.ctrl("button"));
		}
		
		// Provide a class based on whether we're an audio or video player
		if (self.media instanceof HTMLVideoElement) {
			self.ui.container.c("video");
		} else {
			self.ui.container.c("audio");
		}
		
		// Slider accessibility...
		self.ui.volumeslider
			.r("slider")
			.attr("aria-label","Volume");
		
		self.ui.scrubber
			.r("progressbar")
			.attr("aria-label","Playback progress");
		
		// Accessibility for time labels
		self.ui.elapsed
			.r("progressbar")
			.attr("aria-label","Time elapsed")
			.attr("aria-valuetext","0 seconds")
			.attr("aria-live","off");
			
		self.ui.remaining
			.r("progressbar")
			.attr("aria-label","Time remaining")
			.attr("aria-valuetext","0 seconds")
			.attr("aria-live","off");
		
		// Now swap out the media for the container
		// If the user is on iOS, we need a different solution.
		// I'm trying this messy clone to start with.
		
		if (navigator.userAgent &&
			navigator.userAgent.match(/(iPhone|iPad)/g)) {
			
			// This gets hoisted, but it's clearer here.
			var tmpMedia	= self.media,
				mediaKind	= self.media.tagName.toLowerCase();
			
			console.log("Creating new",mediaKind);
			
			self.media = document.createElement(mediaKind);
			
			// Transfer attributes
			[].slice.call(tmpMedia.attributes,0)
				.forEach(function(attribute) {
					self.media.setAttribute(attribute.name,attribute.value);
				});
			
			// Transfer inner HTML
			self.media.innerHTML = tmpMedia.innerHTML;
			
			// Replace the old media element with the container
			c.replace(tmpMedia,self.ui.container);
			
			// Wrap the new element in our DSL sugar
			w(self.media,"media");
			
		} else {
			c.replace(self.media,self.ui.container);
		}
		
		// And plug in the media...
		self.ui.mediawrapper.a(self.media);
		
		// And switch off the native controls for the media element.
		self.media.removeAttribute("controls");
		
		// Unprefix functions we need for fullscreen...
		self.requestFullScreen = Vixen.unprefix("requestFullScreen",self.ui.container);
		self.cancelFullScreen = Vixen.unprefix("cancelFullScreen",document);
		
		// TODO
		if (self.requestFullScreen)
			self.requestFullScreen =
				self.requestFullScreen.bind(self.ui.container);
		
		// Enable chaining...
		return self;
	};
	
	/*
		Private: Binds the appropriate event listeners to the UI generated by
		Vixen.buildUI. Mutates the state of the Vixen object and its associated
		UI elements - and should only be called once, after generating the UI.
		
		Examples
		
			self.attachEvents();
		
		Returns the Vixen object against which this method was called.
	
	*/
	
	Vixen.prototype.attachEvents = function() {
		var self = this;
		
		// Button Events
		self.ui.playpause.on("click",self.playpause);
		
		self.ui.mute.on("click",function() {
			if (self.media.volume > 0) {
				self.ui.mute.t("Unmute");
				self.previousVolume = self.media.volume;
				self.volume(0);
			} else {
				self.ui.mute.t("Mute");
				self.volume(self.previousVolume);
			}
		});
		
		if (self.ui.fullscreenbutton) {
			self.ui.fullscreenbutton.on("click",self.fullscreen);
		}
		
		// Handle dragging for volume and scrubbing bar
		self.ui.scrubber.attachDragHandler(function(percentage) {
			var vertical = self.ui.scrubber.vertical,
				value = vertical ? percentage.y : percentage.x,
				styleprop = vertical ? "height" : "width";
			
			self.ui.playprogress.s(styleprop,(value*100)+"%");
			
			// Try and break the actual video seeking out of reflow operations
			(window.setImmediate||window.setTimeout)(function() {
				// As long as we've got at least the metadata for the media
				// resource, permit seeking.
				if (self.media.readyState >= 1)
					self.jumpTo(value * self.media.duration);
			},0);
		});
		
		// And now volume slider. (y) assumes vertical orientation.
		self.ui.volumeslider.attachDragHandler(function(percentage) {
			var vertical = self.ui.volumeslider.vertical,
				value = vertical ? percentage.y : percentage.x,
				styleprop = vertical ? "height" : "width";
			
			self.ui.volumesliderinner.s(styleprop,(value*100)+"%");
			self.volume(value);
		});
		
		// Prevent selection and default actions happening to anything
		// in the toolbar...
		self.ui.toolbar.on("mousedown",function(evt) {
			evt.preventDefault();
		});
		
		// If the user clicks the header in an area which is really just
		// a transparent window through to the video, just run what the video
		// would if it were clicked directly!
		self.ui.header.on("mousedown",function(evt) {
			if (evt.target === self.ui.header ||
				evt.target === self.ui.title)
				self.playpause();
		});
		
		// media events to listen to
		[
			"abort",
			"canplay",
			"canplaythrough",
			"click",
			"durationchange",
			"emptied",
			"ended",
			"error",
			"loadeddata",
			"loadedmetadata",
			"loadstart",
			"pause",
			"play",
			"playing",
			"progress",
			"ratechange",
			"seeked",
			"seeking",
			"stalled",
			"suspend",
			"timeupdate",
			"volumechange",
			"waiting" ].forEach(function(evt) {
			
			// Just throw them all out to the catchall...
			self.media.on(evt,self.handleMediaEvent);
		});
		
		// Window and document events to intercept...
		// Some themes are going to need a bit of help from JS.
		// Handle window resize...
		window.addEventListener("resize",function() {
			self.updateUI();
		},"false");
		
		// And document events
		[
			"webkitfullscreenchange",
			"msiefullscreenchange",
			"mozfullscreenchange",
			"ofullscreenchange",
			"fullscreenchange" ].forEach(function(evt) {
			
			document.addEventListener(evt,function(evt) {
				
				// Often when we go fullscreen/unfullscreen we haven't got
				// proper dimensions yet. Clean up quickly!
				setTimeout(function() {
						self.updateUI();
					},100);
				
				self.updateUI();
			});
		});
		
		// Attach error handlers to all the video sources...
		var sourcesFailed = 0;
		self.sources.forEach(function(source) {
			source.addEventListener("error",function(evt) {
				sourcesFailed ++;
				
				if (sourcesFailed === self.sources.length) {
					// all media failed to display!
					self.emit("fatalerror");
					self.ui.container.c("error");
					
					var c = self.c;
					
					self.ui.container.a(c("div","errormsg"));
					self.ui.errormsg
						.a(
							c("h1","errortitle")
								.t("Error Loading Video"))
						.a(
							c("p","messagebody"));
					
					self.ui.messagebody.innerHTML = 
						"No formats compatible with your browser" +
						" could be found. Please try downloading one below:";
					
					self.ui.errormsg.a(c("ul","downloadlist"));
					self.sources.forEach(function(source) {
						var link = c("a");
						link.setAttribute("href",source.src);
						link.innerHTML =
							source.type.split(/\//ig).pop().toUpperCase() +
							", " + 
							source.getAttribute("res") + "p";
						
						self.ui.downloadlist.a(c("li").a(link));
					});
				}
			});
		});
		
		// Handle UI Events
		[
			"mousedown",
			"mousemove",
			"mouseup",
			"click",
			"focus",
			"focusin",
			"blur",
			"focusout",
			"keydown",
			"keyup",
			"keypress",
			"touchstart",
			"touchend" ].forEach(function(evt) {
				
				self.ui.container.on(evt,function(evt) {
					self.handleUIEvent(evt);
				});
			});
		
		return self;
	}
	
	
	/*
		Public: Examines the state of the media object and updates the UI to
		reflect it. Emits the 'updateui' event.
		
		Examples
		
			myVideo.updateUI();
		
		Returns the Vixen object against which this method was called.
	
	*/
	Vixen.prototype.updateUI = function() {
		var	self				= this,
			duration			= self.media.duration || 0,
			currentTime			= self.media.currentTime,
			playPercentage		= (currentTime/duration)*100,
			loadPercentage		= 0,
			loadedTo			= 0,
			range				= 0,
			timeRemaining		= 0,
			toolbarUIDimension	= 0,
			vertical			= self.ui.scrubber.vertical,
			toolbar				= self.ui.toolbar,
			spaceAvailable		= 0,
			toolbarRealEstate	= 
				(vertical ? toolbar.offsetWidth : toolbar.offsetWidth);
		
		if (currentTime > duration || !currentTime) currentTime = 0;
		
		// This is a little simplistic, but it works. Get the largest endTime
		// for buffered time ranges.
		for (range = 0; range < self.media.buffered.length; range ++) {
			if (self.media.buffered.end(range) > loadedTo)
				loadedTo = self.media.buffered.end(range);
				loadPercentage = (loadedTo/duration)*100;
		}
		
		// Just check whether our sliders are horizontal or vertical...
		// A simple width vs. height check should do.
		self.ui.scrubber.vertical =
			self.ui.scrubber.offsetHeight > self.ui.scrubber.offsetWidth;
		
		self.ui.volumeslider.vertical =
			self.ui.volumeslider.offsetHeight > self.ui.volumeslider.offsetWidth;
		
		if (!self.ui.scrubber.dragging)
			self.ui.playprogress.s(
				(self.ui.scrubber.vertical ? "height" : "width"),
				playPercentage+"%");
		
		self.ui.loadprogress.s(
			(self.ui.scrubber.vertical ? "height" : "width"),
			loadPercentage+"%");
		
		if (!self.ui.volumeslider.dragging)
			self.ui.volumesliderinner.s(
				(self.ui.volumeslider.vertical ? "height" : "width"),
				(self.volume()*100) + "%");
		
		// Render time remaining and time elapsed timestamps out to labels...
		timeRemaining = self.media.duration-self.media.currentTime;
		self.ui.elapsed.t(self.formatTime(self.media.currentTime));
		self.ui.remaining.t(self.formatTime(timeRemaining));
		
		// Get offset dimension (either width or height, depending on whether
		// the scrubbing bar is oriented horizontally or vertically) of all
		// elements in the toolbar that aren't the scrubber itself...
		[].slice.call(self.ui.toolbar.childNodes).forEach(function(node) {
			if (node instanceof HTMLElement && node !== self.ui.scrubber) {
				toolbarUIDimension +=
					vertical ? node.offsetHeight: node.offsetWidth;
			}
		});
		
		spaceAvailable = toolbarRealEstate - (toolbarUIDimension*1.05);
		self.ui.scrubber.s(vertical? "height" : "width",spaceAvailable + "px");
		
		// Add classes to the UI base, so the theme can reflect network and
		// playback state.
		
		// Do we have metadata for the video (so we can seek?)
		self.ui.container.c("seekable", (self.media.readyState >= 1) ? 1 : -1);
		
		// Is the video finished?
		self.ui.container.c("ended", (!!self.media.ended) ? 1 : -1);
		
		// What's our network state?
		self.ui.container.c("netempty", !self.media.networkState ? 1 : -1);
		self.ui.container.c("netidle", self.media.networkState===1 ? 1 : -1);
		self.ui.container.c("loading", self.media.networkState===2 ? 1 : -1);
		self.ui.container.c("nosource", self.media.networkState===3 ? 1 : -1);
		
		// Is the video muted?
		self.ui.container.c("muted", self.media.muted ? 1 : -1);
		
		// Are we playing?
		if (self.media.paused) {
			self.ui.playpause.t("Play");
			self.ui.container.c("playing",-1);
			self.playing = false;
		} else {
			self.ui.playpause.t("Pause");
			self.ui.container.c("playing");
			self.playing = true;
		}
		
		// Are we still fullscreen? Is there a mismatch between what the
		// browser thinks and what we think? Correct it!
		if ((
			!!Vixen.unprefix("fullScreenElement",document) !== self.isfullscreen ||
			document.webkitIsFullScreen === false
			)
			&& self.ui.fullscreenbutton) {
				
			if (!!Vixen.unprefix("fullScreenElement",document) &&
				document.webkitIsFullScreen !== false) {
				
				self.ui.container.c("fullscreen");
				self.ui.fullscreenbutton.t("Exit Fullscreen");
				self.isfullscreen = true;
				
			} else {
				
				self.ui.container.c("fullscreen",-1);
				self.ui.fullscreenbutton.t("Fullscreen");
				self.isfullscreen = false;
				
			}
		}
		
		// Accessible value text for less obvious elements
		var humanElapsedTime =
				self.formatTime(self.media.currentTime,true),
			humanRemainingTime =
				self.formatTime(self.media.duration-self.media.currentTime,true);
		
		self.ui.elapsed.attr("aria-valuetext",humanElapsedTime);
		self.ui.remaining.attr("aria-valuetext",humanRemainingTime);
		
		self.ui.volumeslider
			.attr("aria-valuetext",(self.media.volume*100|0) + " percent");
		
		self.ui.scrubber
			.attr("aria-valuetext",(playPercentage|0) + " percent complete.");
		
		self.emit("updateui");
		
		return self;
	};
	
	/*
		Private: Given an event a playback or network event (timeupdate, network
		stall, volume change, etc.) effecting the media object, the function
		updates the internal application state and UI accordingly. It also
		re-emits any events passed to it.
		
		eventData	-	Event object provided by the browser.
		
		Examples
		
			myVideo.handleMediaEvent(myEvent);
		
		Returns the Vixen object against which this method was called.
	
	*/
	Vixen.prototype.handleMediaEvent = function(eventData) {
		var self = this;
		
		// Mostly just stubbed placeholders for event handling which may be in
		// place soon.
		
		switch (eventData.type) {
			case "click":
				if (eventData.button === 0)
					self.playpause();
				
				break;
			
			case "error":
				
				break;
				
			case "ended":
				
				self.ui.container.c("finished");
				self.pause();
				
				break;
				
			case "volumechange":
			
				if (self.media.volume > 0) {
					// Save video volume prior to being muted...
					self.previousVolume = self.media.volume;
				}
				
				break;
			
			case "suspend":
			case "stalled":
			case "waiting":
				
				break;
			
			case "loadedmetadata":
			case "canplay":
			case "canplaythrough":
				
				// If we previously changed resolution and want to resume at a
				// certain point, we'll have flagged that in resumePlayingAt.
				//
				// Jump to that time and clear the flag.
				
				if (self.resumePlayingAt) {
					self.jumpTo(self.resumePlayingAt).play();
					self.resumePlayingAt = 0;
				}
				
				break;
			
		}
		
		self.updateUI();
		self.emit(eventData.type);
		
		return self;
	};
	
	/*
		Private: Given an event representing user interaction (touch, keypress)
		the function updates the internal application state and UI accordingly.
		It also re-emits any events passed to it.
		
		eventData	-	Event object provided by the browser.
		
		Examples
		
			myVideo.handleUIEvent(myEvent);
		
		Returns the Vixen object against which this method was called.
	
	*/
	Vixen.prototype.handleUIEvent = function(eventData) {
		var self = this,
			eventClass =
				String(eventData)
					.replace(/\[object /i,"")
					.replace(/\]/g,"");
		
		switch (eventClass) {
			case "MouseEvent":
				break;
			
			case "KeyboardEvent":
				
				if (eventData.type === "keydown" &&
					!eventData.target.tagName.match(/select/i)) {
					
					if (eventData.keyCode === 39) {
						self.skipForward();
						eventData.preventDefault();
						eventData.cancelBubble = true;
					}
					
					if (eventData.keyCode === 37) {
						self.skipBackward();
						eventData.preventDefault();
						eventData.cancelBubble = true;
					}
					
					if (eventData.keyCode === 38) {
						self.volumeUp();
						eventData.preventDefault();
						eventData.cancelBubble = true;
					}
					
					if (eventData.keyCode === 40) {
						self.volumeDown();
						eventData.preventDefault();
						eventData.cancelBubble = true;
					}
					
					if (!eventData.target.tagName.match(/button/i) &&
						eventData.keyCode === 32) {
						
						self.playpause();
						eventData.preventDefault();
						eventData.cancelBubble = true;
					}
				}
				
				break;
			
		}
		
		// Add a class (if required) to the UI container on UI interactions
		//
		// This enables a timeout so the UI can fade out (even when hovered or
		// focused) after a certain time.
		
		self.ui.container.c("ui-activity-timeout",-1);
		
		if (self.interactionTimer)
			clearTimeout(self.interactionTimer);
		
		self.interactionTimer = setTimeout(function() {
			self.ui.container.c("ui-activity-timeout");
		}, self.options.uiActivityGracePeriod);
		
		self.updateUI();
		self.emit(eventData.type);
		
		return self;
	};
	
	/*
		Public: Given a timestamp, formats a human-readable time string optimised
		for display in the media player UI.
		
		timestamp	-	Javascript timestamp (in milliseconds.)
		
		Examples
		
			myVideo.formatTime(1348055311046);
		
		Returns a colon-delimited string representing the timestamp in hours,
		minutes, and seconds (like '04:20:23'.)
	
	*/
	Vixen.prototype.formatTime = function(timestamp,human) {
		var seconds = (timestamp % 60) | 0,
			minutes	= ((timestamp / 60) % 60) | 0,
			hours	= (timestamp / (60*60)) | 0,
			string	= "";
		
		if (human) {
			if (hours)
				string += hours + " hours" + (minutes || seconds? ", and " : "");
			if (minutes)
				string += minutes + " minutes" + (seconds ? ", and " : "");
			if (seconds)
				string += seconds + " seconds";
			
			return string;
			
		} else {
			
			// Pad if required...
			if (hours && hours < 10) hours = "0" + String(hours);
			if (minutes < 10) minutes = "0" + String(minutes);
			if (seconds < 10) seconds = "0" + String(seconds);
			
			if (hours) string = hours + ":";
			
			return string + minutes + ":" + seconds;
		}
	};
	
	/*
		Public: Requests the media resource wrapped by the vixen object be
		loaded.
		
		Examples
		
			myVideo.load();
		
		Returns the Vixen object against which this method was called.
	
	*/
	Vixen.prototype.load = function() {
		var self = this;
		
		self.media.load();
		return self;
	};
	
	/*
		Public: Toggles the playback state of the vixen media object. If the
		object is currently playing, it pauses it; and vice versa.
		
		Examples
		
			myVideo.playpause();
		
		Returns the Vixen object against which this method was called.
	
	*/
	Vixen.prototype.playpause = function() {
		var self = this;
		
		// Play if we're paused
		if (self.media.paused)
			return self.play();
		
		// Or pause if we're playing!
		return self.pause();
	};
	
	/*
		Public: Plays the vixen media object.
		
		Examples
		
			myVideo.play();
		
		Returns the Vixen object against which this method was called.
	
	*/
	Vixen.prototype.play = function() {
		var self = this;
		
		self.media.play();
		self.ui.playpause.t("Pause");
		self.ui.container.c("playing");
		self.playing = true;
		
		return self;
	};
	
	/*
		Public: Pauses the vixen media object.
		
		Examples
		
			myVideo.pause();
		
		Returns the Vixen object against which this method was called.
	
	*/
	Vixen.prototype.pause = function() {
		var self = this;
		
		self.media.pause();
		self.ui.playpause.t("Play");
		self.ui.container.c("playing",-1);
		self.playing = false;
		
		return self;
	};
	
	/*
		Public: If fullscreen support is available in the browser, it requests
		that the UI container object be converted to a fullscreen context, and
		applies appropriate UI changes.
		
		Examples
		
			myVideo.fullscreen();
		
		Returns the Vixen object against which this method was called.
	
	*/
	Vixen.prototype.fullscreen = function() {
		var self = this;
		if (!self.isfullscreen) {
			self.requestFullScreen.call(self.ui.container);
			self.ui.container.c("fullscreen");
			self.ui.fullscreenbutton.t("Exit Fullscreen");
			self.isfullscreen = true;
		} else {
			self.cancelFullScreen.call(document);
			self.ui.container.c("fullscreen",-1);
			self.ui.fullscreenbutton.t("Fullscreen");
			self.isfullscreen = false;
		}
		
		return self;
	};
	
	/*
		Public: Seeks the media to the specified time in seconds.
		
		time		-	Time in seconds - decimal precision allowed.
		
		Examples
		
			myVideo.jumpTo(100);
			myVideo.jumpTo(232.55);
		
		Returns the Vixen object against which this method was called.
	
	*/
	Vixen.prototype.jumpTo = function(time) {
		var self = this;
		
		self.media.currentTime = time;
		self.updateUI();
		
		return self;
	};
	
	/*
		Public: Skips forward by a predetermined amount (5% or 30 seconds,
				whichever is smaller.) Minimum skip time of five seconds.
		
		Examples
		
			myVideo.skipForward();
		
		Returns the Vixen object against which this method was called.
	
	*/
	Vixen.prototype.skipForward = function() {
		var self = this,
			skipTo = 0,
			skipAmount = (self.media.duration * 0.05);
			skipAmount = skipAmount > 30 ? 30 : skipAmount;
			skipAmount = skipAmount < 5 ? 5 : skipAmount;
		
		skipTo = self.media.currentTime + skipAmount;
		skipTo = skipTo > self.media.duration ? self.media.duration : skipTo;
		
		self.jumpTo(skipTo);
		
		return self;
	};
	
	
	/*
		Public: Skips backward by a predetermined amount (5% or 30 seconds,
				whichever is smaller.) Minimum skip time of five seconds.
		
		Examples
		
			myVideo.skipBackward();
		
		Returns the Vixen object against which this method was called.
	
	*/
	Vixen.prototype.skipBackward = function() {
		var self = this,
			skipTo = 0,
			skipAmount = (self.media.duration * 0.05);
			skipAmount = skipAmount > 30 ? 30 : skipAmount;
			skipAmount = skipAmount < 5 ? 5 : skipAmount;
		
		skipTo = self.media.currentTime - skipAmount;
		skipTo = skipTo < 0 ? 0 : skipTo;
		
		self.jumpTo(skipTo);
		
		return self;
	};
	
	/*
		Public: Sets or returns the volume for a media element.
		
		volume		-	Optional number between 0 and 1 describing media volume.
		
		Examples
		
			var myVolume = myVideo.volume();
			myVideo.volume(0.5);
		
		Returns either the volume of the media element (if called without=
		arguments) or the Vixen object to which the volume was assigned (if
		called with arguments.)
	
	*/
	Vixen.prototype.volume = function(volume) {
		var self = this;
		
		if (volume !== null && volume !== undefined) {
			
			if (typeof volume !== "number" || isNaN(volume))
				throw new Error("Non-numeric or NaN volume unacceptable.");
			
			if (volume < 0 || volume > 1)
				throw new Error("Volume outside of acceptable range.");
			
			if (volume === 0)
				self.ui.mute.t("Unmute");
			
			if (window.localStorage && localStorage.setItem)
				localStorage.setItem(self.namespace + "-volume",volume);
			
			if (volume === 0) {
				self.media.muted = true;
			} else {
				self.media.muted = false;
			}
			
			self.media.volume = volume;
			return self;
		} else {
			return self.media.volume;
		}
	}
	
	/*
		Public: Increases volume by a predetermined amount (0.1, or 10%.)
		
		Examples
		
			myVideo.volumeUp();
		
		Returns the Vixen object against which this method was called.
	
	*/
	Vixen.prototype.volumeUp = function() {
		var self = this,
			volumeTo = self.volume() + 0.1;
			volumeTo = volumeTo > 1 ? 1 : volumeTo;
		
		self.volume(volumeTo);
		
		return self;
	};
	
	/*
		Public: Decreases volume by a predetermined amount (0.1, or 10%.)
		
		Examples
		
			myVideo.volumeDown();
		
		Returns the Vixen object against which this method was called.
	
	*/
	Vixen.prototype.volumeDown = function() {
		var self = this,
			volumeTo = self.volume() - 0.1;
			volumeTo = volumeTo < 0 ? 0 : volumeTo;
		
		self.volume(volumeTo);
		
		return self;
	};
	
	/*
		Public: Function for binding a handler to a Vixen event.
		
		eventName	-	String - name of event to bind handler to.
		handler		-	Function which is bound to the event.
		
		Examples
		
			myVideo.on("pause",updateMyAppUI);
			myVideo.on("stall",function() {
				console.log("Media stalled. Network issues?");
			});
		
		Returns the Vixen object to which the handler was bound.
	
	*/
	Vixen.prototype.on = function(eventName,handler) {
		var self = this;
		
		// We must have a valid name...
		
		if (!eventName ||
			typeof eventName !== "string" ||
			eventName.match(/[^a-z0-9\.\*\-]/ig)) {
			
			throw new Error("Attempt to subscribe to event with invalid name!");
		}
		
		// We've gotta have a valid function
		if (!handler || !(handler instanceof Function)) {
			throw new Error("Attempt to subscribe to event without a handler!");
		}
		
		// OK, we got this far.
		// Create handler object if it doesn't exist...
		if (!self.eventHandlers || !(self.eventHandlers instanceof Object)) {
			self.eventHandlers = {};
		}
		
		if (self.eventHandlers[eventName] &&
			self.eventHandlers[eventName] instanceof Array) {
			
			self.eventHandlers[eventName].push(handler);
		} else {
			self.eventHandlers[eventName] = [handler];
		}
		
		return self;
	};
	
	
	/*
		Private: Called by Vixen internally when emitting an event. This
		function is responsible for calling all the event handlers in turn.
		
		eventName	-	used to determine which event is being emitted.
		
		Examples
		
			this.emit("pause");
			
		Returns the Vixen object which emitted the event in question.
	
	*/
	Vixen.prototype.emit = function(eventName) {
		var self = this, args = arguments;
		
		// If we've lost our handler object, or have no handlers, just return.
		if (!self.eventHandlers) return;
		
		// Ensure we've got handlers in the format we expect...
		if (!self.eventHandlers[eventName] ||
			!(self.eventHandlers[eventName] instanceof Array)) return;
		
		// OK, so we have handlers for this event.
		self.eventHandlers[eventName]
			// We need these to be functions!
			.filter(function(handler) {
				return handler instanceof Function;
			})
			.forEach(function(handler) {
				// Execute each handler in the context of the Vixen object,
				// and with the arguments we were passed (less the event name)
				handler.apply(self,[].slice.call(args,1));
			});
		
		
		
		return self;
	};
	
	// Static functions
	
	/*
		Public: Static function for generating and initialising Vixen objects
		for media on the page.
		
		selector	-	input to convert to Vixen media. Can be a query selector
						specifying one or more media objects, an array with
						either queryselectors /or/ media objects, or a single
						media object. Vixen will resolve them accordingly.
		
		fallback	-	Function called when HTML5 video support is not present.
		
		Examples
		
			Vixen.ify("#myVideo")
			Vixen.ify("video")
			Vixen.ify("#content .media .soundbites")
			Vixen.ify([myVideoObject1, myVideoObject2]);
			Vixen.ify(myVideoObject);
		
		Returns either an array of Vixen objects, or a single object - depending
		on whether one or many media elements were matched by the input
		selector.
	
	*/
	Vixen.ify = function(selector,fallback) {
		
		// Gotta have HTML video/audio support!
		if (!document.createElement("video").canPlayType ||
			!(document.createElement("video").canPlayType instanceof Function)) {
			
			if (fallback && fallback instanceof Function) {
				return fallback(selector);
			} else {
				throw new Error("HTML5 Media support not present!");
			}
		}
		
		var media = Vixen.get(selector);
		
		if (!media)
			throw new Error("Requested media object not found.");
		
		if (typeof media === "array" || media instanceof Array)
			return media;
		
		if (media instanceof Vixen)
			return media;
		
		// OK. We're just dealing with one object then!
		return new Vixen(media);
	};
	
	/*
		Public: Static function for converting selectors to actual objects Vixen
		can deal with.
		
		selector	-	input to convert to Vixen media. Can be a query selector
						specifying one or more media objects, an array with
						either queryselectors /or/ media objects, or a single
						media object. Vixen will resolve them accordingly.
		
		Examples
		
			Vixen.get("#myVideo")
			Vixen.get("video")
			Vixen.get("#content .media .soundbites")
			Vixen.get([myVideoObject1, myVideoObject2]);
			Vixen.get(myVideoObject);
		
		Returns either an array of Vixen objects, or a single media object -
		depending on whether one or many media elements were matched by the
		input selector.
	
	*/
	Vixen.get = function(selector) {
		var result = null;
		
		if (selector instanceof HTMLVideoElement ||
			selector instanceof HTMLAudioElement) {
			
			return selector;
			
		} else {
			
			if (selector instanceof NodeList)
				selector = [].slice.call(selector);
			
			if (typeof selector === "array" || selector instanceof Array) {
				result = selector.map(Vixen.ify);
			
			} else if (typeof selector == "string") {
				selector = [].slice.call(document.querySelectorAll(selector));
				result = selector.map(Vixen.ify);
			
			} else if (selector === null || selector === undefined) {
				// Vixen-ify all video if no selector supplied!
				result = Vixen.get("video");
			}
			
			if (result && typeof result === "array" && result.length === 1)
				return result[0];
			
			return result;
		}
		
		return false;
	};
	
	/*
		Public: Static function for getting the vendor-prefixed function using
		an unprefixed name. The function simply does a case-insensitive search
		through the `lookIn` object (which defaults to window if unspecified.)
		
		name		-	the name of the function to search for.
		lookIn		-	the object in which to look for the function.
		
		Examples
		
			Vixen.unprefix("requestFullScreen")
		
		Returns the function in question, or false if a matching function could
		not be located.
		
	*/
	Vixen.unprefix = function(name,lookIn) {
		lookIn = lookIn || window;
		name = name.replace(/[^a-z0-9\_]/ig,"");
		
		var search = new RegExp(name + "$","ig");
		
		// No hasOwnProperty here!
		for (var fName in lookIn) {
			if (search.exec(fName)) {
				if (lookIn[fName] !== null && !fName.match(/^on/))
					return lookIn[fName];
			}
		}
		
		// No match?
		return false;
	};
	
	
	// Publish existence of object
	if (typeof module !== "undefined" && module.exports) {
		module.exports = Vixen;
	} else if (typeof define !== "undefined") {
		 define("vixen", [], function() { return Vixen; });
	} else {
		glob.Vixen = Vixen;
	}
})(this);