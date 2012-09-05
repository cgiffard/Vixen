// Vixen.

/*global HTMLVideoElement:true, HTMLAudioElement:true, document:true, module:true */

(function(glob) {
	"use strict";
	
	function Vixen(mediaObject) {
		
		if (!(mediaObject instanceof HTMLVideoElement ||
				mediaObject instanceof HTMLAudioElement))
					throw new Error("Media input was not a media element.");
		
		this.video = mediaObject;
		this.video.uiController = this;
		this.ui = {};
		
		// For css classes...
		this.namespace = "vixen";
		
		// Build the UI...
		this.buildUI();
		
		// Attach UI Events...
		this.attachEvents();
		
		// ...and update the UI with information from the media object!
		this.updateUI();
		
		return this;
	}
	
	Vixen.prototype.buildUI = function() {
		var self = this;
		
		// Little DSL for element creation.
		var c = function(kind,place) {
				var tmp;
				if (typeof kind === "string") {
					tmp = document.createElement(kind);
				} else {
					tmp = kind;
				}
				
				tmp.a = function(input) {
					tmp.appendChild(input);
					return tmp;
				};
				tmp.r = function(role) {
					tmp.setAttribute("role",role);
					return tmp;
				};
				tmp.c = function(classN,remove) {
					if (remove < 0) {
						tmp.className =
							tmp.className
								.replace(n(classN),"")
								.replace(/\s+/," ")
								.replace(/\s+$/,"")
								.replace(/^\s+/,"");
					} else {
						tmp.className += tmp.className.length ? " " : "";
						tmp.className += n(classN);
					}
					return tmp;
				};
				tmp.t = function(title) {
					tmp.innerHTML = title;
					tmp.setAttribute("title",title);
					return tmp;
				};
				tmp.on = function(event,handler) {
					tmp.addEventListener(event,function(evt) {
						handler.call(self,evt);
					},"false");
					return tmp;
				};
				
				if (place) {
					self.ui[place] = tmp;
					tmp.c(place);
				}
				return tmp;
			},
			n = function(classN) { return self.namespace + "-" + classN; },
			replace = function(node,replacement) {
				return node.parentNode.replaceChild(replacement,node);
			};
		
		
		// Build the UI.
		
		// Create scrubber
		c("div","scrubber")
			.a(c("div","loadindicator"))
			.a(c("div","thumb"));
		
		// Create volume control...
		c("div","volumegroup")
			.a(c("button","mute").t("Mute"));
		
		// Bulk of the UI...
		c("div","container")
			.r("application")
			.a(c("div","videowrapper"))
			.a(
				c("div","toolbar")
					.r("toolbar")
					.a(c("button","playbutton").t("Play"))
					.a(c("label","elapsed"))
					.a(self.ui.scrubber)
					.a(c("label","remaining"))
					.a(self.ui.volumegroup)
			);
		
		// Now swap out the video for the container
		replace(self.video,self.ui.container);
		
		// And plug in the video...
		self.ui.videowrapper.a(self.video);
		
		return this;
	};
	
	Vixen.prototype.attachEvents = function() {
		var self = this;
		
		// Events
		self.ui.playbutton.on("click",self.playpause);
		
		// Video events to listen to
		[
			"abort",
			"canplay",
			"canplaythrough",
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
			w(self.video).on(evt,self.handleMediaEvent);
		});
		
		
		return this;
	}
	
	Vixen.prototype.updateUI = function() {
		
	};
	
	Vixen.prototype.handleMediaEvent = function() {
		// Video state...
		
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
	};
	
	Vixen.prototype.load = function() {
		if 
	};
	
	Vixen.prototype.playpause = function() {
		if (this.video.paused) {
			this.play();
		} else {
			this.pause();
		}
		
		return this;
	};
	
	Vixen.prototype.play = function() {
		this.video.play();
		this.ui.playbutton.t("Pause");
		this.ui.container.c("playing");
		
		return this;
	};
	
	Vixen.prototype.pause = function() {
		this.video.pause();
		this.ui.playbutton.t("Play");
		this.ui.container.c("playing",-1);
		return this;
	};
	
	Vixen.prototype.jumpTo = function(time) {
			
	};
	
	Vixen.prototype.volume = function(volume) {
		if (volume !== null) {
			
		} else {
			return this.video.volume;
		}
	}
	
	// Event emitter...
	Vixen.prototype.on = function(eventName,handler) {
		
	};
	
	
	/*
		Public: Static function for generating and initialising Vixen objects
		for media on the page.
		
		selector	-	input to convert to Vixen video. Can be a query selector
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
	Vixen.prototype.emit = function(eventName) {
		
	};
	
	// Static functions
	
	/*
		Public: Static function for generating and initialising Vixen objects
		for media on the page.
		
		selector	-	input to convert to Vixen video. Can be a query selector
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
		
		selector	-	input to convert to Vixen video. Can be a query selector
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
	
	
	// Publish existence of object
	if (typeof module !== "undefined" && module.exports) {
		module.exports = Vixen;
	} else if (typeof define !== "undefined") {
		 define("vixen", [], function() { return Vixen; });
	} else {
		glob.Vixen = Vixen;
	}
})(this);