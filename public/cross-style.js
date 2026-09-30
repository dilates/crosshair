// Shared crosshair styling helpers — used by both the settings preview and the
// overlay window. Exposes window.CrossStyle.
(function () {
  function color(value, fallback) {
    return typeof value === 'string' && value ? value : fallback;
  }

  // Builds a CSS filter chain: hue rotation (original colors), a solid outline
  // built from stacked drop-shadows, and an optional soft glow.
  function buildFilter(d) {
    d = d || {};
    const parts = [];
    if (!d.fillColor) parts.push('hue-rotate(' + (Number(d.hue) || 0) + 'deg)');
    if (d.outline) {
      const width = Math.max(1, Math.min(5, Math.round(Number(d.outlineWidth) || 2)));
      const c = color(d.outlineColor, '#000000');
      for (let i = 1; i <= width; i++) {
        parts.push('drop-shadow(' + i + 'px 0 0 ' + c + ')');
        parts.push('drop-shadow(-' + i + 'px 0 0 ' + c + ')');
        parts.push('drop-shadow(0 ' + i + 'px 0 ' + c + ')');
        parts.push('drop-shadow(0 -' + i + 'px 0 ' + c + ')');
      }
    }
    if (d.glow) {
      const blur = 6 + Math.max(1, Math.min(5, Math.round(Number(d.outlineWidth) || 2))) * 3;
      parts.push('drop-shadow(0 0 ' + blur + 'px ' + color(d.glowColor, '#6c8cff') + ')');
    }
    return parts.join(' ');
  }

  // Applies the shared visual state to a plain <img>.
  function applyToImg(img, d) {
    img.style.opacity = String(d.opacity != null ? d.opacity : 1);
    img.style.transform = 'rotate(' + (Number(d.rotation) || 0) + 'deg)';
    img.style.filter = buildFilter(d);
    if (d.imageUrl && img.getAttribute('src') !== d.imageUrl) img.src = d.imageUrl;
  }

  // Applies the shared visual state to a masked <div> recolored with a solid
  // fill (works on any image, including white/black SVGs where hue-rotate is a
  // no-op).
  function applyToSolid(el, d) {
    el.style.opacity = String(d.opacity != null ? d.opacity : 1);
    el.style.transform = 'rotate(' + (Number(d.rotation) || 0) + 'deg)';
    el.style.filter = buildFilter(d);
    el.style.backgroundColor = color(d.fillColor, '#ffffff');
    const url = d.imageUrl ? 'url("' + d.imageUrl + '")' : 'none';
    el.style.webkitMaskImage = url;
    el.style.maskImage = url;
  }

  window.CrossStyle = { buildFilter: buildFilter, applyToImg: applyToImg, applyToSolid: applyToSolid };
})();
