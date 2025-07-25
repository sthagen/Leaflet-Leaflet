import {Layer} from './Layer.js';
import * as Util from '../core/Util.js';
import {LatLngBounds} from '../geo/LatLngBounds.js';
import {Bounds} from '../geometry/Bounds.js';
import * as DomUtil from '../dom/DomUtil.js';

/*
 * @class ImageOverlay
 * @inherits Interactive layer
 *
 * Used to load and display a single image over specific bounds of the map. Extends `Layer`.
 *
 * @example
 *
 * ```js
 * const imageUrl = 'https://maps.lib.utexas.edu/maps/historical/newark_nj_1922.jpg',
 * 	imageBounds = [[40.712216, -74.22655], [40.773941, -74.12544]];
 * new ImageOverlay(imageUrl, imageBounds).addTo(map);
 * ```
 */

// @constructor ImageOverlay(imageUrl: String, bounds: LatLngBounds, options?: ImageOverlay options)
// Instantiates an image overlay object given the URL of the image and the
// geographical bounds it is tied to.
export class ImageOverlay extends Layer {

	static {
		// @section
		// @aka ImageOverlay options
		this.setDefaultOptions({
			// @option opacity: Number = 1.0
			// The opacity of the image overlay.
			opacity: 1,

			// @option alt: String = ''
			// Text for the `alt` attribute of the image (useful for accessibility).
			alt: '',

			// @option interactive: Boolean = false
			// If `true`, the image overlay will emit [pointer events](#interactive-layer) when clicked or hovered.
			interactive: false,

			// @option crossOrigin: Boolean|String = false
			// Whether the crossOrigin attribute will be added to the image.
			// If a String is provided, the image will have its crossOrigin attribute set to the String provided. This is needed if you want to access image pixel data.
			// Refer to [CORS Settings](https://developer.mozilla.org/en-US/docs/Web/HTML/CORS_settings_attributes) for valid String values.
			crossOrigin: false,

			// @option errorOverlayUrl: String = ''
			// URL to the overlay image to show in place of the overlay that failed to load.
			errorOverlayUrl: '',

			// @option zIndex: Number = 1
			// The explicit [zIndex](https://developer.mozilla.org/docs/Web/CSS/CSS_Positioning/Understanding_z_index) of the overlay layer.
			zIndex: 1,

			// @option className: String = ''
			// A custom class name to assign to the image. Empty by default.
			className: '',

			// @option decoding: String = 'auto'
			// Tells the browser whether to decode the image in a synchronous fashion,
			// as per the [`decoding` HTML attribute](https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/decoding).
			// If the image overlay is flickering when being added/removed, set
			// this option to `'sync'`.
			decoding: 'auto'
		});
	}

	initialize(url, bounds, options) { // (String, LatLngBounds, Object)
		this._url = url;
		this._bounds = new LatLngBounds(bounds);

		Util.setOptions(this, options);
	}

	onAdd() {
		if (!this._image) {
			this._initImage();

			if (this.options.opacity < 1) {
				this._updateOpacity();
			}
		}

		if (this.options.interactive) {
			this._image.classList.add('leaflet-interactive');
			this.addInteractiveTarget(this._image);
		}

		this.getPane().appendChild(this._image);
		this._reset();
	}

	onRemove() {
		this._image.remove();
		if (this.options.interactive) {
			this.removeInteractiveTarget(this._image);
		}
	}

	// @method setOpacity(opacity: Number): this
	// Sets the opacity of the overlay.
	setOpacity(opacity) {
		this.options.opacity = opacity;

		if (this._image) {
			this._updateOpacity();
		}
		return this;
	}

	setStyle(styleOpts) {
		if (styleOpts.opacity) {
			this.setOpacity(styleOpts.opacity);
		}
		return this;
	}

	// @method bringToFront(): this
	// Brings the layer to the top of all overlays.
	bringToFront() {
		if (this._map) {
			DomUtil.toFront(this._image);
		}
		return this;
	}

	// @method bringToBack(): this
	// Brings the layer to the bottom of all overlays.
	bringToBack() {
		if (this._map) {
			DomUtil.toBack(this._image);
		}
		return this;
	}

	// @method setUrl(url: String): this
	// Changes the URL of the image.
	setUrl(url) {
		this._url = url;

		if (this._image) {
			this._image.src = url;
		}
		return this;
	}

	// @method setBounds(bounds: LatLngBounds): this
	// Update the bounds that this ImageOverlay covers
	setBounds(bounds) {
		this._bounds = new LatLngBounds(bounds);

		if (this._map) {
			this._reset();
		}
		return this;
	}

	getEvents() {
		const events = {
			zoom: this._reset,
			viewreset: this._reset
		};

		if (this._zoomAnimated) {
			events.zoomanim = this._animateZoom;
		}

		return events;
	}

	// @method setZIndex(value: Number): this
	// Changes the [zIndex](#imageoverlay-zindex) of the image overlay.
	setZIndex(value) {
		this.options.zIndex = value;
		this._updateZIndex();
		return this;
	}

	// @method getBounds(): LatLngBounds
	// Get the bounds that this ImageOverlay covers
	getBounds() {
		return this._bounds;
	}

	// @method getElement(): HTMLElement
	// Returns the instance of [`HTMLImageElement`](https://developer.mozilla.org/docs/Web/API/HTMLImageElement)
	// used by this overlay.
	getElement() {
		return this._image;
	}

	_initImage() {
		const wasElementSupplied = this._url.tagName === 'IMG';
		const img = this._image = wasElementSupplied ? this._url : DomUtil.create('img');

		img.classList.add('leaflet-image-layer');
		if (this._zoomAnimated) { img.classList.add('leaflet-zoom-animated'); }
		if (this.options.className) { img.classList.add(...Util.splitWords(this.options.className)); }

		img.onselectstart = Util.falseFn;
		img.onpointermove = Util.falseFn;

		// @event load: Event
		// Fired when the ImageOverlay layer has loaded its image
		img.onload = this.fire.bind(this, 'load');
		img.onerror = this._overlayOnError.bind(this);

		if (this.options.crossOrigin || this.options.crossOrigin === '') {
			img.crossOrigin = this.options.crossOrigin === true ? '' : this.options.crossOrigin;
		}

		img.decoding = this.options.decoding;

		if (this.options.zIndex) {
			this._updateZIndex();
		}

		if (wasElementSupplied) {
			this._url = img.src;
			return;
		}

		img.src = this._url;
		img.alt = this.options.alt;
	}

	_animateZoom(e) {
		const scale = this._map.getZoomScale(e.zoom),
		    offset = this._map._latLngBoundsToNewLayerBounds(this._bounds, e.zoom, e.center).min;

		DomUtil.setTransform(this._image, offset, scale);
	}

	_reset() {
		const image = this._image,
		    bounds = new Bounds(
		        this._map.latLngToLayerPoint(this._bounds.getNorthWest()),
		        this._map.latLngToLayerPoint(this._bounds.getSouthEast())),
		    size = bounds.getSize();

		DomUtil.setPosition(image, bounds.min);

		image.style.width  = `${size.x}px`;
		image.style.height = `${size.y}px`;
	}

	_updateOpacity() {
		this._image.style.opacity = this.options.opacity;
	}

	_updateZIndex() {
		if (this._image && this.options.zIndex !== undefined && this.options.zIndex !== null) {
			this._image.style.zIndex = this.options.zIndex;
		}
	}

	_overlayOnError() {
		// @event error: Event
		// Fired when the ImageOverlay layer fails to load its image
		this.fire('error');

		const errorUrl = this.options.errorOverlayUrl;
		if (errorUrl && this._url !== errorUrl) {
			this._url = errorUrl;
			this._image.src = errorUrl;
		}
	}

	// @method getCenter(): LatLng
	// Returns the center of the ImageOverlay.
	getCenter() {
		return this._bounds.getCenter();
	}
}
