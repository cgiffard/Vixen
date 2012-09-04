// Vixen.


/* global HTMLVideoElement:true, document:true, module:true */

(function(glob) {
	"use strict";
	
	function Vixen(mediaObject) {
		this.video = mediaObject;
		this.video.controller = this;
		this.ui = {};
		
		this.buildUI();
	};
	
	Vixen.prototype.buildUI = function() {
		
		// Little aliases.
		var c = function(kind,classN,title) {
				var tmp = document.createElement(kind);
				if (classN) tmp.setAttribute("class",classN);
				if (title) tmp.setAttribute("title",title);
				return tmp;
			},
			a = function(a,b) { a.appendChild(b); };
		
		this.ui.container	= c("div");
		this.ui.toolbar		= c("div");
		this.ui.playbutton	= c("button");
		this.ui.elapsed		= c("label");
		this.ui.remaining	= c("label");
		
		
		this.updateUI();	
	};
	
	Vixen.prototype.updateUI = function() {
		
	};
	
	Vixen.prototype.play = function() {
		this.video.play();
	};
	
	Vixen.prototype.pause = function() {
		this.video.pause();
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
	Vixen.prototype.on = function(eventName,function) {
		
	};
	
	Vixen.prototype.emit = function(eventName) {
		
	};
	
	// Static functions
	
	/*
		Public: Static function for generating 
		
		selector	- 
		
		Examples
		
			GrammarGenus.compile(node,compiler);
		
		Returns a string containing the text to be inserted into the Duckdown
		document buffer.
	
	*/
	Vixen.ify = function(selector) {
		var mediaObject = Vixen.get(selector);
		
		if (!mediaObject) throw new Error("Requested media object not found.");
		
		return new Vixen(mediaObject);
	};
	
	Vixen.get = function(selector) {
		if (selector instanceof HTMLVideoElement) {
			return selector;
		} else if (typeof selector === "array") {
			for (var index = 0; index < selector.length; index++) {
				Vixen.ify(selector);
			}
			
		} else if (typeof selector == "string") {
			if (typeof document.querySelectorAll !== "undefined") {
				
			}
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