// Vixen.

/*global HTMLVideoElement:true, HTMLAudioElement:true, HTMLElement:true,
document:true, module:true, createVixel:true, window:true, localStorage:true */

(function(glob) {
	"use strict";
	
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
		self.requestFullScreen = Vixen.unprefix("requestFullScreen",document.body);
		self.cancelFullScreen = Vixen.unprefix("cancelFullScreen",document);
		
		// Get the volume - if we've saved it!
		var keyName = self.namespace + "-volume";
		if (window.localStorage && localStorage.getItem instanceof Function)
			if (localStorage.getItem(keyName) !== null)
				self.media.volume = parseFloat(localStorage.getItem(keyName));
		
		// Build the UI...
		self.buildUI();
		
		// Attach UI Events...
		self.attachEvents();
		
		// ...and update the UI with information from the media object!
		self.updateUI();
		
		// A bit of state
		self.isfullscreen = false;
		self.playing = false;
		self.readyState = self.media.readyState;
		
		return self;
	}
	
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
			.a(c("button","mute").t("Mute").ctrl("button",1))
			.a(c("div","volumeslider").ctrl("slider",4)
				.a(
					c("div","volumesliderinner")
						.a(c("div","volumethumb"))));
		
		// Create title header...
		c("header","header");
		
		var mediaTitle = self.media.getAttribute("title");
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
					.a(c("button","playpause").t("Play").ctrl("button",1))
					.a(c("label","elapsed"))
					.a(self.ui.scrubber.ctrl("slider",2))
					.a(c("label","remaining"))
					.a(self.ui.volumegroup));
		
		// Is the fullscreen API present in the browser?
		// Is this a video (i.e. does fullscreen even make sense?)
		if (self.requestFullScreen &&
			self.media instanceof HTMLVideoElement) {
			
			// Append a fullscreen button
			self.ui.toolbar.a(
				c("button","fullscreen")
					.t("Fullscreen"));
		}
		
		// Provide a class based on whether we're an audio or video player
		if (self.media instanceof HTMLVideoElement) {
			self.ui.container.c("video");
		} else {
			self.ui.container.c("audio");
		}
		
		// Now swap out the media for the container
		c.replace(self.media,self.ui.container);
		
		// And plug in the media...
		self.ui.mediawrapper.a(self.media);
		
		// And switch off the native controls for the media element.
		self.media.removeAttribute("controls");
		
		// Just check whether our sliders are horizontal or vertical...
		// A simple width vs. height check should do.
		self.ui.scrubber.vertical =
			self.ui.scrubber.offsetHeight > self.ui.scrubber.offsetWidth;
		
		self.ui.volumeslider.vertical =
			self.ui.volumeslider.offsetHeight > self.ui.volumeslider.offsetWidth;
		
		// Enable chaining...
		return self;
	};
	
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
		
		if (self.ui.fullscreen) {
			self.ui.fullscreen.on("click",self.fullscreen);
		}
		
		// Handle dragging for volume and scrubbing bar
		self.ui.scrubber.ondrag(function(percentage) {
			var vertical = self.ui.scrubber.vertical,
				value = vertical ? percentage.y : percentage.x,
				styleprop = vertical ? "height" : "width";
			
			self.ui.playprogress.s(styleprop,(value*100)+"%");
			
			// As long as we've got at least the metadata for the media
			// resource, permit seeking.
			if (self.media.readyState >= 1)
				self.jumpTo(value * self.media.duration);
		});
		
		// And now volume slider. (y) assumes vertical orientation.
		self.ui.volumeslider.ondrag(function(percentage) {
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
		
		// Some themes are going to need a bit of help from JS.
		// Handle window resize...
		window.addEventListener("resize",function() {
			self.updateUI();
		},"false");
		
		return self;
	}
	
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
		
		// TODO: Update for horizontal/vertical compatibility...
		if (!self.ui.scrubber.dragging)
			self.ui.playprogress.s("width",playPercentage+"%");
		
		self.ui.loadprogress.s("width",loadPercentage+"%");
		
		if (!self.ui.volumeslider.dragging)
			self.ui.volumesliderinner.s("height",(self.media.volume*100));
		
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
		
		spaceAvailable = toolbarRealEstate - (toolbarUIDimension*1.1);
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
		
		self.emit("updateui");
	};
	
	Vixen.prototype.handleMediaEvent = function(eventData) {
		var self = this;
		
		/* 
		
		events:
		
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
		"waiting" 
		*/
		
		
		switch (eventData.type) {
			case "click":
				self.playpause();
				break;
			
			case "error":
				
				break;
				
			case "ended":
				
				break;
				
			case "volumechange":
				
				break;
			
			case "loadeddata":
			case "loadedmetadata":
			case "loadstart":
			case "suspend":
			case "stalled":
			case "waiting":
				
				break;
			
			
		}
		
		// Media state...
		// buffered
		// currentSrc
		// duration
		// ended
		// error
		// networkState
		// paused
		// played
		// readyState
		// seekable
		// seeking
		// startTime
		
		self.updateUI();
		self.emit(eventData.type);
	};
	
	Vixen.prototype.formatTime = function(timestamp) {
		var seconds = (timestamp % 60) | 0,
			minutes	= ((timestamp / 60) % 60) | 0,
			hours	= (timestamp / (60*60)) | 0,
			string	= "";
		
		// Pad if required...
		if (hours && hours < 10) hours = "0" + String(hours);
		if (minutes < 10) minutes = "0" + String(minutes);
		if (seconds < 10) seconds = "0" + String(seconds);
		
		if (hours) string = hours + ":";
		
		return string + minutes + ":" + seconds;
	};
	
	Vixen.prototype.load = function() {
		var self = this;
		
		self.media.load();
		return self;
	};
	
	Vixen.prototype.playpause = function() {
		var self = this;
		
		// Play if we're paused
		if (self.media.paused)
			return self.play();
		
		// Or pause if we're playing!
		return self.pause();
	};
	
	Vixen.prototype.play = function() {
		var self = this;
		
		self.media.play();
		self.ui.playpause.t("Pause");
		self.ui.container.c("playing");
		self.playing = true;
		
		return self;
	};
	
	Vixen.prototype.pause = function() {
		var self = this;
		
		self.media.pause();
		self.ui.playpause.t("Play");
		self.ui.container.c("playing",-1);
		self.playing = false;
		
		return self;
	};
	
	Vixen.prototype.fullscreen = function() {
		var self = this;
		if (!self.isfullscreen) {
			self.requestFullScreen.call(self.ui.container);
			self.ui.container.c("fullscreen");
			self.ui.fullscreen.t("Exit Fullscreen");
			self.isfullscreen = true;
		} else {
			self.cancelFullScreen.call(document);
			self.ui.container.c("fullscreen",-1);
			self.ui.fullscreen.t("Fullscreen");
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
		if (volume !== null) {
			
			if (typeof volume !== "number" || isNaN(volume))
				throw new Error("Non-numeric or NaN volume unacceptable.");
			
			if (volume < 0 || volume > 1)
				throw new Error("Volume outside of acceptable range.");
			
			if (volume === 0)
				self.ui.mute.t("Unmute");
			
			if (window.localStorage && localStorage.setItem)
				localStorage.setItem(self.namespace + "-volume",volume);
			
			self.media.volume = volume;
			return self;
		} else {
			return self.media.volume;
		}
	}
	
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
	Vixen.ify = function(selector) {
		var media = Vixen.get(selector);
		
		if (!media)
			throw new Error("Requested media object not found.");
		
		if (typeof media === "array")
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
			if (typeof selector === "array") {
				result = selector.map(Vixen.ify);
			
			} else if (typeof selector == "string") {
				selector = [].slice.call(document.querySelectorAll(selector));
				result = selector.map(Vixen.ify);
			}
			
			if (result.length === 1)
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