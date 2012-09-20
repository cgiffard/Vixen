Vixen
-----

Ultra minimal video player.

![Vixen showing video with shadow theme...](http://cgiffard.com/github/vixen/vixen-shadow-ui-2.png)

## Example

```javascript
window.addEventListener("load",function() {
	var myVideo = Vixen.ify(document.querySelector("video"));
});
```

That's it! :)

## Goals:

*	Lean. Light. Attractive.
*	Be as thin as possible. Don't maintain state within the object unless we
	absolutely have to - leave it all to the HTMLMediaElement
*	Enable fairly universal playback of HTMLMediaElement types - audio, video,
	it'll all work!
*	As much as possible, leave all styling to CSS. Don't touch any aspect of
	layout or positioning unless we absolutely have to.
*	Multiple themes.
*	Don't try and paper over cracks in older browsers. This player won't work
	in IE < 9, and never will. It does support a fallback handler!
*	Don't polyfill. Leave captioning, format support, etc. up to external
	libraries. But at the same time:
*	No dependencies! Just ES5.
*	Support newer standards, if available in the browser.