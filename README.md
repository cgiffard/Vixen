Vixen
-----

Ultra minimal video player.


Goals:

*	Lean. Light. Attractive.
*	Be as thin as possible. Don't maintain state within the object unless we
	absolutely have to - leave it all to the HTMLMediaElement
*	Enable fairly universal playback of HTMLMediaElement types - audio, video,
	it'll all work!
*	As much as possible, leave all styling to CSS. Don't touch any aspect of
	layout or positioning unless we absolutely have to.
*	Don't polyfill. Leave captioning, format support, etc. up to external
	libraries. But at the same time:
*	No dependencies! Just ES5.
*	Support newer standards, if available in the browser.