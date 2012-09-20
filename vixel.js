// Little DSL for Vixen Element Creation (Vix-El, hence 'vixel'.)
(function(glob) {
	
	// We publish a function that makes a new Vixel factory, and binds a var in
	// the scope of that factory to the Vixen object which created it...
	glob.createVixel = function(self) {
		
		if (!self.ui) self.ui = {};
		
		var Vixel = c = function(kind,place) {
			var element;
			
			// Make a new element, or just add convenience functions
			// to existing element.
			if (typeof kind === "string") {
				element = document.createElement(kind);
			} else {
				element = kind;
			}
			
			// Append an element
			element.a = function(input) {
				element.appendChild(input);
				return element;
			};
			
			// Set an ARIA role
			element.r = function(role) {
				element.setAttribute("role",role);
				return element;
			};
			
			// Add or remove a class from the element
			element.c = function(classN,remove) {
				var rep = new RegExp(Vixel.namespace(classN),"ig");
				if (remove < 0) {
					element.className =
						element.className
							.replace(rep,"")
							.replace(/\s+/," ")
							.replace(/\s+$/,"")
							.replace(/^\s+/,"");
				
				// Class shouldn't already exist!
				} else if (!element.className.match(rep)) {
					element.className += element.className.length ? " " : "";
					element.className += Vixel.namespace(classN);
				}
				return element;
			};
			
			// Set the inner HTML and the title of an element
			element.t = function(title) {
				element.innerHTML = title;
				// I determined that this was annoying for screen reader users.
				// Can put it back if required.
				// element.setAttribute("title",title);
				return element;
			};
			
			// Bind an event handler to the element
			element.on = function(event,handler) {
				element.addEventListener(event,function(evt) {
					handler.call(self,evt);
				},"false");
				return element;
			};
			
			// Style an element
			element.s = function(styleName,value) {
				element.style[styleName] = value;
				return element;	
			};
			
			// Try and replicate the accessibility features of a native control
			element.ctrl = function(ariaRole,tabIndex) {
				element.setAttribute("tabIndex",tabIndex);
				return element.r(ariaRole);
			};
			
			// Little helper for implementing draggable functionality
			element.ondrag = function(handler) {
				element.addEventListener("mousedown",function(evt) {
					// We don't listen to anything other than a nice left-click.
					if (evt.button !== 0) return;
					
					var width = element.offsetWidth,
						height = element.offsetHeight,
						on = window.addEventListener,
						offsetLeft = 0,
						offsetTop = 0,
						pointerNode = element;
						
					element.c("dragging");
					element.dragging = true;
					
					if (pointerNode.offsetParent) {
						do {
							offsetLeft += pointerNode.offsetLeft;
							offsetTop += pointerNode.offsetTop;
						} while (pointerNode = pointerNode.offsetParent);
					}
					
					function eventHandler(evt) {
						if (evt.preventDefault) evt.preventDefault();
						evt.cancelBubble = true;
						
						if (element.dragging) {
							// We invert the y calculation to follow the
							// logical visual order vertical sliders work...
							var currentX = evt.clientX - offsetLeft,
								currentY = evt.clientY - offsetTop,
								x = currentX / width,
								y = 1-(currentY / height);
							
							handler.call(element,{
								"x": x >= 0 ? x <= 1 ? x : 1 : 0,
								"y": y >= 0 ? y <= 1 ? y : 1 : 0
							});
						}
					}
					
					eventHandler(evt);
					
					if (!element.moveListener) {
						element.moveListener = on("mousemove",eventHandler);
						on("mouseup",function(evt) {
							element.dragging = false;
							element.c("dragging",-1);
						});
					}
				});
			};
			
			// Now add the object to the UI map.
			if (place) {
				if (typeof self.ui.place !== "undefined")
					throw Error("A UI object with this ID already exists!");
				
				self.ui[place] = element;
				element.c(place);
			}
			
			// Return for chaining!
			return element;
		};
		
		// Little syntax sugar for replacing a DOM element
		Vixel.replace = function(node,replacement) {
			return node.parentNode.replaceChild(replacement,node);
		};
		
		// Namespaces string input - for classes and such.
		Vixel.namespace = function(stringInput) {
			return self.namespace + "-" + stringInput;
		};
		
		// Function for generating selector elements!
		// Helpful since it's a more complicated function that would otherwise
		// clutter vixen-core.
		Vixel.createSelector = function(labelText,className,self) {
			var label		= c("label"),
				valueSpan	= c("span"),
				wrapper		= c("div"),
				selector	= c("select"),
				idSeed		= String(Math.random()).replace(/\D/,""),
				id 			= Vixel.namespace("rs-" + idSeed)
				handler		= function(){},
				optionCount	= 0;
			
			label.c("selectorlabel");
			wrapper.c("dropdownwrapper");
			valueSpan.c("currentselectorvalue");
			
			// Don't show the value of the selector to screen readers - they can
			// get the value from the popup list instead.
			valueSpan.setAttribute("aria-hidden","true");
			
			if (className) {
				wrapper.c(className);
				self.ui[className] = wrapper;
			}
			
			// Add a label if available
			if (labelText)
				label.t(labelText);
			
			// Build rest of UI
			wrapper
				.a(label.a(valueSpan))
				.a(selector);
			
			// Add label relationship
			selector.id = id;
			label.setAttribute("for",id);
			
			// Focus styling for accessibility
			// (we give the wrapper a class based on whether the control is
			// focussed - this gives us more flexibility when styling.)
			c(selector).on("focus",function() {
				wrapper.c("focus");
			});
			
			c(selector).on("blur",function() {
				wrapper.c("focus",-1);
			});
			
			// Add nice little methods for adding to list
			wrapper.addItem = function(text,value,funcSelect) {
				var option = c("option");
					option.value = value;
					option.innerHTML = text;
					option.funcSelect = funcSelect;
				
				if (optionCount === 0) {
					valueSpan.innerHTML = "&nbsp" + text;
				}
				
				optionCount ++;
				selector.a(option);
			};
			
			// And for doing something when the value changes...
			wrapper.onChange = function(newHandler) {
				if (newHandler instanceof Function)
					handler = newHandler;
			};
			
			wrapper.on("change", function() {
				var index = selector.selectedIndex,
					optionList =
						[].slice.call(wrapper.querySelectorAll("option"),0),
					currentOption = optionList[index];
				
				valueSpan.innerHTML = "&nbsp" + currentOption.innerHTML;
				
				if (currentOption.funcSelect instanceof Function) {
					currentOption.funcSelect.call(currentOption);
				}
				
				handler(currentOption);
			})
			
			return wrapper;
		};
		
		return Vixel;
	};
	
})(this);