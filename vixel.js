// Little DSL for Vixen Element Creation (Vix-El, hence 'vixel'.)
(function(glob) {
	
	// We publish a function that makes a new Vixel factory, and binds a var in
	// the scope of that factory to the Vixen object which created it...
	glob.createVixel = function(self) {
		
		if (!self.ui) self.ui = {};
		
		var Vixel = function(kind,place) {
			var tmp;
			
			// Make a new element, or just add convenience functions
			// to existing element.
			if (typeof kind === "string") {
				tmp = document.createElement(kind);
			} else {
				tmp = kind;
			}
			
			// Append an element
			tmp.a = function(input) {
				tmp.appendChild(input);
				return tmp;
			};
			
			// Set an ARIA role
			tmp.r = function(role) {
				tmp.setAttribute("role",role);
				return tmp;
			};
			
			// Add or remove a class from the element
			tmp.c = function(classN,remove) {
				if (remove < 0) {
					tmp.className =
						tmp.className
							.replace(Vixel.namespace(classN),"")
							.replace(/\s+/," ")
							.replace(/\s+$/,"")
							.replace(/^\s+/,"");
				} else {
					tmp.className += tmp.className.length ? " " : "";
					tmp.className += Vixel.namespace(classN);
				}
				return tmp;
			};
			
			// Set the inner HTML and the title of an element
			tmp.t = function(title) {
				tmp.innerHTML = title;
				tmp.setAttribute("title",title);
				return tmp;
			};
			
			// Bind an event handler to the element
			tmp.on = function(event,handler) {
				tmp.addEventListener(event,function(evt) {
					handler.call(self,evt);
				},"false");
				return tmp;
			};
			
			// Style an element
			tmp.s = function(styleName,value) {
				tmp.style[styleName] = value;
				return tmp;	
			};
			
			// Little helper for implementing draggable functionality
			tmp.ondrag = function(handler) {
				tmp.addEventListener("mousedown",function(evt) {
					// We don't listen to anything other than a nice left-click.
					if (evt.button !== 0) return;
					
					var width = tmp.offsetWidth,
						height = tmp.offsetHeight,
						on = window.addEventListener,
						offsetLeft = 0,
						offsetTop = 0,
						pointerNode = tmp;
					
					tmp.dragging = true;
					
					console.log(width,height);
					console.log(evt);
					
					while (pointerNode.parentNode) {
						offsetLeft += pointerNode.offsetLeft;
						offsetTop += pointerNode.offsetTop;
						pointerNode = pointerNode.parentNode;
					}
					
					console.log(offsetLeft,offsetTop);
					
					if (!tmp.moveListener) {
						tmp.moveListener =
							on("mousemove",function(evt) {
							if (tmp.dragging) {
								var currentX = evt.clientX - offsetLeft,
									currentY = evt.clientY - offsetTop;
								console.log(currentX / width,1 - (currentY / height));
								// We invert the y calculation to follow the
								// logical order vertical sliders work...
								handler({
									"x": currentX / width,
									"y": 1 - (currentY / height) // invert
								});
							}
						});
						
						on("mouseup",function(evt) {
							tmp.dragging = false;
						});
					}
				});
			};
			
			// Now add the object to the UI map.
			if (place) {
				if (typeof self.ui.place !== "undefined")
					throw Error("A UI object with this ID already exists!");
				
				self.ui[place] = tmp;
				tmp.c(place);
			}
			
			// Return for chaining!
			return tmp;
		};
		
		// Little syntax sugar for replacing a DOM element
		Vixel.replace = function(node,replacement) {
			return node.parentNode.replaceChild(replacement,node);
		};
		
		// Namespaces string input - for classes and such.
		Vixel.namespace = function(stringInput) {
			return self.namespace + "-" + stringInput;
		};
		
		return Vixel;
	};
})(this);